-- Migration: create populate_jobs table
-- Adds persistent storage for long-running admin population jobs

CREATE TABLE IF NOT EXISTS populate_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_type VARCHAR(32) NOT NULL,
  params JSON,
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, interrupted
  total_cities INT DEFAULT 0,
  completed_cities INT DEFAULT 0,
  total_saved INT DEFAULT 0,
  errors JSON,
  progress JSON,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_populate_jobs_status ON populate_jobs (status);
