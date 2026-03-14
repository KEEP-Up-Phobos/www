/**
 * KEEPUP Main Server - Basic Implementation
 */

require('dotenv').config({ path: './.env' });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const { Pool } = require('pg');  // PostgreSQL for events
const Redis = require('ioredis');  // Redis for caching and message queues

// Import controllers for DB setup
const authController = require('./controllers/auth.controller');
const userController = require('./controllers/user.controller');
const adminController = require('./controllers/admin.controller');
const eventsController = require('./controllers/events.controller');
const interestsController = require('./controllers/interests.controller');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');
const eventsRoutes = require('./routes/events.routes');
const interestsRoutes = require('./routes/interests.routes');
const EnhancedIntelligentFetcher = require('./fetcher');
const { initAuth } = require('./middleware/requireAuth');
const requireAuth = require('./middleware/requireAuth')();
const optionalAuth = require('./middleware/requireAuth').optionalAuth();
const requireAdmin = require('./middleware/requireAuth').requireAdmin();

// Define auth routes directly
const authRoutes = express.Router();
authRoutes.get('/check', authController.check);
authRoutes.post('/login', authController.login);
authRoutes.post('/logout', authController.logout);
authRoutes.post('/validate-session', authController.validateSession);
authRoutes.get('/validate-session', authController.validateSessionGet);
authRoutes.post('/joomla-session', authController.joomlaSession);
authRoutes.post('/register', authController.register);
authRoutes.get('/user', authController.getUser);

const app = express();
const PORT = Number(process.env.NODE_PORT || process.env.PORT || 3002);

// Trust proxy (Cloudflare terminates HTTPS → forwards HTTP to us)
// Required for secure cookies to work behind reverse proxies
app.set('trust proxy', true);

// Allow embedding from specific origins (useful for remote debug iframes)
const allowIframe = require('./middleware/allowIframe');

// Database config (MariaDB — main app DB)
const dbConfig = {
    host: process.env.DB_HOST || 'db',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'keepup',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'keepup_db'
};
if (!dbConfig.password) {
    console.warn('⚠️  DB_PASSWORD env var not set — MariaDB connection may fail');
}

console.log('DB Config:', { ...dbConfig, password: '***' });

// Joomla DB config
const joomlaDbConfig = {
    host: process.env.JOOMLA_DB_HOST || 'db',
    port: parseInt(process.env.JOOMLA_DB_PORT) || 3306,
    user: process.env.JOOMLA_DB_USER || 'root',
    password: process.env.JOOMLA_DB_PASSWORD,
    database: process.env.JOOMLA_DB_NAME || 'keepup_db'
};
if (!joomlaDbConfig.password) {
    console.warn('⚠️  JOOMLA_DB_PASSWORD env var not set — Joomla DB connection may fail');
}

console.log('Joomla DB Config:', { ...joomlaDbConfig, password: '***' });

// Postgres config for events (PostGIS)
const pgConfig = {
    host: process.env.PG_DB_HOST || 'keepup_postgres',
    port: parseInt(process.env.PG_DB_PORT) || 5432,
    user: process.env.PG_DB_USER || 'keepup_user',
    password: process.env.PG_DB_PASSWORD,
    database: process.env.PG_DB_NAME || 'keepup_events'
};
if (!pgConfig.password) {
    console.warn('⚠️  PG_DB_PASSWORD env var not set — Postgres connection may fail');
}

console.log('Postgres Config:', { ...pgConfig, password: '***' });

// Redis config for caching and message queues
const redisConfig = {
    url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    connectTimeout: 5000,
    commandTimeout: 5000
};

console.log('Redis Config:', { url: redisConfig.url.replace(/:[^:]*@/, ':***@'), maxRetriesPerRequest: redisConfig.maxRetriesPerRequest });

let db;
let joomlaDb;
let pgDb;  // Postgres pool for events
let redis;  // Redis client

// Middleware
console.log('CORS middleware loaded');
app.use(cors({
    origin: [
        'http://127.0.0.1:3001', 'http://192.168.15.8:3001', 'http://localhost:3001',  // React nginx container
        'http://127.0.0.1:3002', 'http://192.168.15.8:3002', 'http://localhost:3002',  // Node Express server
        'https://app.keepup.lat', 'https://adm.keepup.lat', 'https://keepup.lat'       // Production domain
    ],
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
console.log('Middleware set up (CORS + cookie-parser + JSON)');

// Serve static files from public directory
app.use(express.static('public'));
console.log('Static files served from public directory');

// Allow the current ngrok debug URL to embed the app in an iframe.
// Replace or extend this list with your InfinityFree domain when uploading the iframe page.
// Allow both the active ngrok URL and the keepup.lat domain to embed the app.
app.use(allowIframe([
    'https://juelz-gracelike-elaine.ngrok-free.dev',
    // Production domain
    'https://app.keepup.lat',
    'https://adm.keepup.lat'
]));

// Admin dashboard route
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/public/admin.html');
});
console.log('Admin dashboard route configured');

// Mount routes immediately
console.log('About to mount auth routes...');
app.use('/api/auth', authRoutes);
console.log('Auth routes mounted');

// Mount user routes (profile endpoints) — auth handled per-route in user.routes.js
app.use('/api', userRoutes);
console.log('User routes mounted');

// Mount events routes (discover, search, etc)
app.use('/api/events', eventsRoutes);
console.log('Events routes mounted');

// OpenStreetMap OAuth & API routes (login, callback, user info)
try {
  const osmRoutes = require('./routes/osm.routes');
  app.use('/api/osm', osmRoutes);
  console.log('OSM routes mounted');
} catch (e) {
  console.warn('OSM routes not mounted (file may not exist yet)');
}

// Mount interests routes (user preferences)
app.use('/api/interests', interestsRoutes);
console.log('Interests routes mounted');

// Protect admin routes with requireAdmin (super-user required)
app.use('/api/admin', requireAdmin, adminRoutes);
console.log('Admin routes mounted (with requireAdmin)');

// Simple test route
app.get('/api/simple', (req, res) => {
    console.log('Simple route called');
    res.json({ success: true, message: 'Simple route works' });
});
console.log('Simple route defined');

// ── Comprehensive health endpoint ──────────────────────────────
async function healthHandler(_req, res) {
    const checks = {};
    const start = Date.now();

    // MariaDB (main / joomla)
    try {
        if (joomlaDb) {
            const [[row]] = await joomlaDb.query('SELECT 1 AS ok');
            checks.mariadb = row && row.ok === 1 ? 'connected' : 'error';
        } else {
            checks.mariadb = 'not_initialised';
        }
    } catch (e) {
        checks.mariadb = 'error: ' + (e.message || e);
    }

    // Postgres
    try {
        if (pgDb) {
            const { rows } = await pgDb.query('SELECT 1 AS ok');
            checks.postgres = rows[0] && rows[0].ok === 1 ? 'connected' : 'error';
        } else {
            checks.postgres = 'not_initialised';
        }
    } catch (e) {
        checks.postgres = 'error: ' + (e.message || e);
    }

    // Redis (best-effort — detect ioredis / redis client on app.locals)
    try {
        const redis = app.locals.redis || null;
        if (redis && typeof redis.ping === 'function') {
            await redis.ping();
            checks.redis = 'connected';
        } else {
            checks.redis = 'not_configured';
        }
    } catch (e) {
        checks.redis = 'error: ' + (e.message || e);
    }

    const allOk = checks.mariadb === 'connected' && checks.postgres === 'connected';
    const status = allOk ? 'healthy' : 'degraded';
    const code   = allOk ? 200 : 503;

    res.status(code).json({
        ok: allOk,
        status,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        responseMs: Date.now() - start,
        services: checks
    });
}

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Basic API endpoint
app.get('/', (req, res) => {
    res.json({ message: 'KEEPUP API Server', status: 'running' });
});

// Initialize database
async function initDB() {
    console.log('initDB called');
    try {
        // Initialize Redis first (non-blocking failures)
        try {
            redis = new Redis(redisConfig);
            redis.on('error', (err) => {
                console.error('[Redis Error]', {
                    message: err?.message || 'Unknown Redis error',
                    code: err?.code,
                    errno: err?.errno,
                    syscall: err?.syscall,
                    address: err?.address,
                    port: err?.port
                });
            });
            redis.on('connect', () => {
                console.log('✅ Redis connected');
                app.locals.redis = redis;
            });
            redis.on('ready', () => {
                console.log('✅ Redis ready to accept commands');
            });
            // Test connection with timeout
            await Promise.race([
                redis.ping(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout')), 3000))
            ]);
            app.locals.redis = redis;
            console.log('✅ Redis initialized and connected');
        } catch (err) {
            console.warn('⚠️  Redis connection failed (will continue without cache):', {
                message: err?.message || err,
                code: err?.code,
                address: err?.address
            });
            if (redis) {
                try { redis.disconnect(); } catch (e) { /* ignore */ }
            }
            // Continue without Redis
        }

        console.log('Creating DB pool...');
        db = await mysql.createPool(dbConfig);
        console.log(`✅ Database connected to ${dbConfig.database}`);
        joomlaDb = await mysql.createPool(joomlaDbConfig);
        console.log(`✅ Joomla Database connected to ${joomlaDbConfig.database}`);
        console.log('DB pool created successfully');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return; // Exit early on DB failure
    }

    // Initialize Postgres pool for events
    try {
        pgDb = new Pool(pgConfig);
        await pgDb.query('SELECT 1');  // Test connection
        console.log(`✅ Postgres (PostGIS) connected to ${pgConfig.database}`);
    } catch (error) {
        console.error('❌ Postgres connection failed:', error.message);
    }

    // expose DB pools on app.locals so middleware can access them
    try {
        app.locals.joomlaDb = joomlaDb;
        app.locals.mainDb = db;
        app.locals.pgDb = pgDb;
        console.log('App locals DB references set');
    } catch (err) {
        console.warn('Could not set app.locals DB references', err && err.message);
    }

    // Initialise unified auth middleware now that joomlaDb is ready
    try {
        initAuth(joomlaDb, db);
        console.log('✅ Unified auth middleware initialised');
    } catch (err) {
        console.error('Failed to initialise unified auth:', err.message);
    }

    // Set up database pools for controllers
    try {
        authController.setDbPools({ joomla: joomlaDb, main: db, pg: pgDb });
        console.log('Auth DB pools set');
    } catch (error) {
        console.error('Failed to set auth DB pools:', error.message);
    }
    try {
        userController.setDbPools({ joomla: joomlaDb, main: db, pg: pgDb });
        console.log('User DB pools set (MariaDB + Postgres)');
    } catch (error) {
        console.error('Failed to set user DB pools:', error.message);
    }
    try {
        eventsController.setDbPool(db, pgDb);  // Pass both MariaDB and Postgres
        console.log('Events DB pools set (MariaDB + Postgres)');
    } catch (error) {
        console.error('Failed to set events DB pool:', error.message);
    }
    try {
        interestsController.setDbPool(db, pgDb);
        console.log('Interests DB pool set (MariaDB + Postgres)');
    } catch (error) {
        console.error('Failed to set interests DB pool:', error.message);
    }

    // Initialize fetcher
    let activeFetcher = null;
    try {
        activeFetcher = new EnhancedIntelligentFetcher(dbConfig);
        console.log('Fetcher initialized');
    } catch (error) {
        console.error('Failed to initialize fetcher:', error.message);
    }

    // Set up admin controller dependencies
    try {
        adminController.setAdminDeps({
            main: db,
            joomla: joomlaDb,
            pg: pgDb,
            fetcher: activeFetcher,
            activeGetter: () => activeFetcher,
            activeSetter: (newFetcher) => { activeFetcher = newFetcher; },
            broadcast: (message) => {
                // TODO: Implement WebSocket broadcasting to admin clients
                console.log('Admin broadcast:', message);
            }
        });
        console.log('Admin controller dependencies set');

        // Recover any previously-running populate jobs (mark them interrupted)
        try {
          if (typeof adminController.recoverJobs === 'function') {
            adminController.recoverJobs().then(() => console.log('Job recovery check complete')).catch(e => console.error('Job recovery failed', e));
          }
        } catch (e) {
          console.warn('Job recovery skipped', e && e.message ? e.message : e);
        }
    } catch (error) {
        console.error('Failed to set admin controller dependencies:', error.message);
    }

    console.log('Database initialization complete');
}

// Start server
console.log('About to start server...');
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    initDB();
});
