-- Create table to store serpent job results
CREATE TABLE IF NOT EXISTS serpent_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  source VARCHAR(32) NOT NULL,
  data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  INDEX (job_id),
  INDEX (status)
);
