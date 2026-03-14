const express = require('express')
const axios = require('axios')
const { execFile } = require('child_process')
const path = require('path')

process.on('uncaughtException', (err) => {
  console.error('[serpents-service] Uncaught Exception:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[serpents-service] Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

const app = express()
app.use(express.json())

// Health endpoint with dependency checks
app.get('/health', async (req, res) => {
  let redisStatus = 'not-configured';
  let mysqlStatus = 'not-configured';
  let dotnetStatus = 'unknown';
  
  // Check Redis connectivity
  try {
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000
    });
    await redis.ping();
    redisStatus = 'connected';
    await redis.quit();
  } catch (err) {
    redisStatus = 'disconnected';
  }
  
  // Check MySQL connectivity
  try {
    const mysql = require('mysql2/promise');
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DB || 'keepup_events',
      connectionLimit: 1
    });
    await pool.query('SELECT 1');
    mysqlStatus = 'connected';
    await pool.end();
  } catch (err) {
    mysqlStatus = 'disconnected';
  }
  
  // Check .NET service availability
  try {
    const dotnetUrl = process.env.DOTNET_SERPENT_URL || 'http://dotnet-eventserpent:80/health';
    const resp = await axios.get(dotnetUrl, { timeout: 2000 });
    dotnetStatus = resp.status === 200 ? 'available' : 'unavailable';
  } catch (err) {
    dotnetStatus = 'unavailable';
  }
  
  const isHealthy = mysqlStatus === 'connected';
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    service: 'serpents-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies: {
      redis: redisStatus,
      mysql: mysqlStatus,
      dotnetSerpent: dotnetStatus
    }
  });
});

// Alias for API consumers
app.get('/api/serpents/health', async (req, res) => {
  // reuse /health logic by invoking same checks
  try {
    const resp = await axios.get(`http://localhost:${process.env.PORT || 3003}/health`, { timeout: 2000 });
    return res.status(resp.status).json(resp.data);
  } catch (err) {
    return res.status(503).json({ status: 'degraded', service: 'serpents-service', dependencies: { error: 'self-check failed' } });
  }
});

app.get('/api/serpents', async (req, res) => {
  // Try the .NET service first
  try {
    const dotnetUrl = process.env.DOTNET_SERPENT_URL || 'http://dotnet-eventserpent:80/api/serpents'
    const resp = await axios.get(dotnetUrl, { timeout: 5000 })
    if (resp.status === 200) {
      return res.json(resp.data)
    }
  } catch (err) {
    console.log('[serpents-service] .NET service unavailable, falling back:', err.message)
  }

  // Fallback: call legacy fetcher CLI (assumes fetcher-cli.js exists in backend/)
  const cli = path.join(__dirname, '..', 'fetcher-cli.js')
  execFile('node', [cli], { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
    if (err) {
      console.error('[serpents-service] legacy fetcher error', err)
      return res.status(500).json({ error: 'legacy fetcher failed' })
    }
    try {
      const j = JSON.parse(stdout)
      return res.json(j)
    } catch (e) {
      // If parse fails, return raw output
      return res.status(200).json({ data: stdout })
    }
  })
})

// Add queue support for async jobs
// const { Queue } = require('bullmq')
// const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
// const queue = new Queue('fetch', { connection: REDIS_URL })

// app.post('/api/serpents/enqueue', async (req, res) => {
//   try {
//     const job = await queue.add('fetch-job', { dotnetUrl: 'http://dotnet-eventserpent:80/api/serpents' }, {
//       attempts: 3,
//       backoff: { type: 'exponential', delay: 2000 },
//       removeOnComplete: true,
//       removeOnFail: false
//     })
//     return res.json({ enqueued: true, jobId: job.id })
//   } catch (err) {
//     console.error('[serpents-service] enqueue error', err.message)
//     return res.status(500).json({ error: 'enqueue failed' })
//   }
// })

const port = process.env.PORT || 3003
app.listen(port, () => console.log(`[serpents-service] listening on ${port}`))

// Serve dashboard static files
app.use('/dashboard', express.static(path.join(__dirname, 'public')))

// Jobs listing endpoint: read latest jobs from DB
app.get('/api/serpents/jobs', async (req, res) => {
  const mysql = require('mysql2/promise')
  const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost'
  const MYSQL_USER = process.env.MYSQL_USER || 'root'
  const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || ''
  const MYSQL_DB = process.env.MYSQL_DB || 'keepup_events'
  try {
    const pool = mysql.createPool({ host: MYSQL_HOST, user: MYSQL_USER, password: MYSQL_PASSWORD, database: MYSQL_DB })
    const [rows] = await pool.query('SELECT id, job_id, status, source, data, created_at, completed_at FROM serpent_jobs ORDER BY id DESC LIMIT 200')
    await pool.end()
    return res.json(rows)
  } catch (err) {
    console.error('[serpents-service] jobs query failed', err.message)
    return res.status(500).json({ error: 'jobs query failed' })
  }
})
