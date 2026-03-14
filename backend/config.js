const config = {
  port: parseInt(process.env.NODE_PORT) || 3000,
  env: process.env.NODE_ENV || "development",
  db: {
    host: process.env.DB_HOST || "db",
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "As30281163",
    database: process.env.DB_NAME || "keepup_events",
  },
  joomlaDb: {
    host: process.env.JOOMLA_DB_HOST || "db",
    port: parseInt(process.env.JOOMLA_DB_PORT) || 3306,
    user: process.env.JOOMLA_DB_USER || "root",
    password: process.env.JOOMLA_DB_PASSWORD || "As30281163",
    database: process.env.JOOMLA_DB_NAME || "keepup_db",
    tablePrefix: "clone_",
  },
  pgDb: {
    host: process.env.PG_DB_HOST || "postgres",
    port: parseInt(process.env.PG_DB_PORT) || 5432,
    user: process.env.PG_DB_USER || "keepup_user",
    password: process.env.PG_DB_PASSWORD,
    database: process.env.PG_DB_NAME || "keepup_new",
  },
  auth: {
    secret: process.env.JWT_SECRET || "keepup-jwt-secret",
    jwtExpiry: "24h",
  },
  urls: {
    frontend: process.env.FRONTEND_URL || "http://localhost:3000",
    joomla: process.env.JOOMLA_URL || "http://localhost:80",
    api: process.env.API_URL || "http://localhost:3000/api",
  },
  osm: {
    clientId: process.env.OSM_CLIENT_ID || null,
    clientSecret: process.env.OSM_CLIENT_SECRET || null,
    redirectUri: process.env.OSM_REDIRECT_URI || `${process.env.API_URL || 'http://localhost:3002'}/api/osm/callback`
  },
  logConfig() {
    console.log("Config loaded:", this.env, "Port:", this.port);
  }
};
module.exports = config;

// Production sanity checks: avoid using default/committed secrets in production
console.log('🔍 NODE_ENV check:', process.env.NODE_ENV);
if (process.env.NODE_ENV === 'production') {
  console.log('🔍 Running production checks...');
  const insecureDbPassword = (process.env.DB_PASSWORD && process.env.DB_PASSWORD === 'As30281163') || (!process.env.DB_PASSWORD);
  const missingJwt = !process.env.JWT_SECRET || process.env.JWT_SECRET === 'keepup-jwt-secret';
  console.log('🔍 insecureDbPassword:', insecureDbPassword, 'missingJwt:', missingJwt);
  if (insecureDbPassword || missingJwt) {
    console.error('❌ Missing or insecure production environment variables. See backend/.env.example and set secure values.');
    process.exit(1);
  }
} else {
  console.log('✅ Development mode - skipping production security checks');
}
