const { Worker } = require('bullmq')
const axios = require('axios')
const { execFile } = require('child_process')
const path = require('path')
const mysql = require('mysql2/promise')

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost'
const MYSQL_USER = process.env.MYSQL_USER || 'root'
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || ''
const MYSQL_DB = process.env.MYSQL_DB || 'keepup_events'
const connection = REDIS_URL

// create a mysql pool for persisting job results
const pool = mysql.createPool({
  host: MYSQL_HOST,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
})

// Worker processes 'fetch' jobs: try .NET then fallback to legacy fetcher
const worker = new Worker('fetch', async (job) => {
  const payload = job.data || {}
  // Try .NET endpoint
  try {
    const dotnetUrl = payload.dotnetUrl || process.env.DOTNET_SERPENT_URL || 'http://dotnet-eventserpent:80/api/serpents'
    const resp = await axios.get(dotnetUrl, { timeout: 5000 })
    if (resp.status === 200) {
      return { from: 'dotnet', data: resp.data }
    }
  } catch (err) {
    console.log('[worker] .NET unavailable, falling back:', err.message)
  }

  // Fallback: call fetcher-cli.js
  const cli = path.join(__dirname, '..', 'fetcher-cli.js')
  const result = await new Promise((resolve, reject) => {
    execFile('node', [cli], { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
      if (err) return reject(err)
      try {
        const j = JSON.parse(stdout)
        resolve({ from: 'legacy', data: j })
      } catch (e) {
        resolve({ from: 'legacy', data: stdout })
      }
    })
  })

  // persist result to DB
  try {
    const conn = pool
    await conn.execute(
      'INSERT INTO serpent_jobs (job_id, status, source, data, completed_at) VALUES (?, ?, ?, ?, NOW())',
      [job.id.toString(), 'completed', result.from || 'legacy', JSON.stringify(result.data || {})]
    )
  } catch (dbErr) {
    console.error('[worker] failed to persist job result', dbErr.message)
  }

  return result
}, { connection })

worker.on('completed', (job, returnvalue) => {
  console.log('[worker] job completed', job.id, returnvalue && returnvalue.from)
  // also persist completion if not already
  (async () => {
    try {
      await pool.execute(
        'UPDATE serpent_jobs SET status = ?, completed_at = NOW() WHERE job_id = ?',
        ['completed', job.id.toString()]
      )
    } catch (e) {
      console.error('[worker] persist completion failed', e.message)
    }
  })()
})
worker.on('failed', (job, err) => {
  console.error('[worker] job failed', job.id, err.message)
  ;(async () => {
    try {
      await pool.execute(
        'INSERT INTO serpent_jobs (job_id, status, source, data) VALUES (?, ?, ?, ?)',
        [job.id.toString(), 'failed', 'worker', JSON.stringify({ error: err.message })]
      )
    } catch (e) {
      console.error('[worker] failed to persist failure', e.message)
    }
  })()
})

console.log('[worker] started, connected to', REDIS_URL)
