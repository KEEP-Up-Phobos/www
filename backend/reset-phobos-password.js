#!/usr/bin/env node
/**
 * Reset Phobos admin password
 * Usage: node reset-phobos-password.js [new_password]
 * If no password provided, uses 'Phobos123!Secure'
 */

const mysql = require('mysql2/promise');
require('dotenv').config();
const JoomlaPassword = require('./joomla_password');

async function resetPassword() {
  const newPassword = process.argv[2] || 'Phobos123!Secure';
  
  try {
    console.log('🔐 Connecting to Joomla database...');
    
    // Try Docker hostname first, then fall back to localhost
    const dbHost = process.env.JOOMLA_DB_HOST || 'keepup_mariadb';
    const dbPort = process.env.JOOMLA_DB_PORT || 3306;
    const dbUser = process.env.JOOMLA_DB_USER || 'root';
    const dbPassword = process.env.JOOMLA_DB_PASSWORD || '';
    const dbName = process.env.JOOMLA_DB_NAME || 'keepup_db';

    console.log(`Attempting connection to ${dbHost}:${dbPort}...`);

    let connection;
    try {
      connection = await mysql.createConnection({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 1,
        queueLimit: 0
      });
    } catch (connectErr) {
      console.warn(`⚠️  Could not connect to ${dbHost}, trying localhost:3307 (Docker port mapping)...`);
      connection = await mysql.createConnection({
        host: 'localhost',
        port: 3307,
        user: dbUser,
        password: dbPassword,
        database: dbName
      });
    }

    // Check if Phobos user exists
    console.log('🔍 Looking for Phobos user...');
    const [users] = await connection.execute(
      'SELECT id, username, email FROM clone_users WHERE username = ?',
      ['Phobos']
    );

    if (users.length === 0) {
      console.error('❌ Phobos user not found in database');
      await connection.end();
      process.exit(1);
    }

    const user = users[0];
    console.log(`✅ Found Phobos user (ID: ${user.id}, Email: ${user.email})`);

    // Generate new password hash
    console.log('🔐 Generating new bcrypt hash...');
    const newHash = await JoomlaPassword.hash(newPassword);
    
    console.log(`   Password: ${newPassword}`);
    console.log(`   Hash: ${newHash}`);

    // Update the password in database
    console.log('💾 Updating password in database...');
    await connection.execute(
      'UPDATE clone_users SET password = ? WHERE id = ?',
      [newHash, user.id]
    );

    console.log('✅ Password reset successful!');
    console.log(`\n📝 Login credentials:`);
    console.log(`   Username: Phobos`);
    console.log(`   Password: ${newPassword}`);
    console.log(`   Email: ${user.email}\n`);

    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting password:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

resetPassword();
