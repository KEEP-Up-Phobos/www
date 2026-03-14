module.exports = {
  apps: [
    {
      name: 'keepup-server',
      script: './main_server.js',
      cwd: 'C:\\SERVER\\www\\KEEPUP\\node',
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: 'C:\\SERVER\\logs\\keepup-error.log',
      out_file: 'C:\\SERVER\\logs\\keepup-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M'
    }
  ]
};
