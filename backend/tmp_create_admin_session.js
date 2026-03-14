(async ()=>{
  const mysql = require('mysql2/promise');
  try{
    const joomlaConfig = {
      host: process.env.JOOMLA_DB_HOST || 'db',
      port: parseInt(process.env.JOOMLA_DB_PORT) || 3306,
      user: process.env.JOOMLA_DB_USER || 'root',
      password: process.env.JOOMLA_DB_PASSWORD || 'As30281163',
      database: process.env.JOOMLA_DB_NAME || 'keepup_db'
    };

    const conn = await mysql.createPool(joomlaConfig);
    const [rows] = await conn.query('SELECT id, username, email, block FROM clone_users WHERE username = ?', ['Phobos']);
    if (!rows || rows.length === 0) {
      console.error('User Phobos not found'); process.exit(2);
    }
    const user = rows[0];
    if (user.block !== 0) console.warn('User is blocked');

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2,15);
    const token = Buffer.from(`admin_${user.id}_${timestamp}_${random}`).toString('base64');

    const ip = '127.0.0.1';
    const ua = 'cli-script';

    const sql = `INSERT INTO unified_sessions (session_token, user_id, username, email, is_super_user, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, 1, DATE_ADD(NOW(), INTERVAL 24 HOUR), ?, ?)
      ON DUPLICATE KEY UPDATE expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR), last_activity = NOW()`;

    await conn.query(sql, [token, user.id, user.username, user.email, ip, ua]);
    console.log('TOKEN:', token);
    process.exit(0);
  }catch(e){
    console.error('ERR', e.message, e.stack);
    process.exit(1);
  }
})();