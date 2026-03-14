
const Redis = require('ioredis');
const client = new Redis('redis://redis:6379');
client.on('error', console.error);
client.on('connect', () => { console.log('Connected!'); client.disconnect(); });
client.ping().then(console.log).catch(console.error);
