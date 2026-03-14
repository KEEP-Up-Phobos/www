const { getPool } = require('./postgres-events');

async function createJob(jobType, params = {}, totals = {}) {
  const db = getPool();
  const res = await db.query(
    `INSERT INTO populate_jobs (job_type, params, status, total_cities, completed_cities, total_saved, errors, current_city, logs, created_at)
     VALUES ($1, $2::jsonb, 'running', $3, 0, 0, 0, '', '[]'::jsonb, NOW())
     RETURNING *`,
    [jobType, params, totals.totalCities || 0]
  );
  return res.rows[0];
}

async function updateProgress(jobId, { completedCities, totalSaved, currentCity, errors }) {
  const db = getPool();
  await db.query(
    `UPDATE populate_jobs SET completed_cities = $1, total_saved = $2, current_city = $3, errors = $4, last_updated = NOW() WHERE id = $5`,
    [completedCities || 0, totalSaved || 0, currentCity || '', errors || 0, jobId]
  );
}

async function appendLog(jobId, message) {
  const db = getPool();
  const entry = { ts: new Date().toISOString(), message };
  await db.query(`SELECT append_populate_job_log($1, $2::jsonb)`, [jobId, entry]);
}

async function finishJob(jobId, { status = 'completed' } = {}) {
  const db = getPool();
  const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
  await db.query(
    `UPDATE populate_jobs SET status = $1, last_updated = NOW(), completed_at = ${completedAt} WHERE id = $2`,
    [status, jobId]
  );
}

async function getJob(jobId) {
  const db = getPool();
  const res = await db.query(`SELECT * FROM populate_jobs WHERE id = $1`, [jobId]);
  return res.rows[0];
}

async function listJobs(limit = 50) {
  const db = getPool();
  const res = await db.query(`SELECT * FROM populate_jobs ORDER BY created_at DESC LIMIT $1`, [limit]);
  return res.rows;
}

async function markInterruptedRunningJobs() {
  const db = getPool();
  // Mark jobs that were running as interrupted so UI can resume/inspect
  await db.query(`UPDATE populate_jobs SET status = 'interrupted', last_updated = NOW() WHERE status = 'running'`);
}

async function resumeJob(jobId) {
  const db = getPool();
  await db.query(`UPDATE populate_jobs SET status = 'running', last_updated = NOW() WHERE id = $1`, [jobId]);
}

module.exports = {
  createJob,
  updateProgress,
  appendLog,
  finishJob,
  getJob,
  listJobs,
  markInterruptedRunningJobs,
  resumeJob
};
