const amqp = require('amqplib');

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://keepup:keepup_pass@localhost:5672';
const EXCHANGE = process.env.EXCHANGE || 'keepup.events';
const ROUTING_KEY = process.env.ROUTING_KEY || 'event.created';

async function publish(envelope) {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, 'topic', { durable: false });
  const payload = Buffer.from(JSON.stringify(envelope));
  ch.publish(EXCHANGE, ROUTING_KEY, payload);
  console.log('Published to', EXCHANGE, ROUTING_KEY, JSON.stringify(envelope));
  await ch.close();
  await conn.close();
}

// Example envelope (matches backend/schemas/event-envelope.json)
const sample = {
  type: 'event:created',
  event_id: 'sample-evt-001',
  version: '1.0',
  ts: new Date().toISOString(),
  source: 'demo-publisher',
  location: { lat: -23.55052, lon: -46.633308, city: 'São Paulo', country: 'BR' },
  payload: {
    title: 'Demo Concert',
    start_time: new Date(Date.now() + 3600 * 1000).toISOString(),
    url: 'https://example.com/event/1'
  },
  meta: { radius_m: 5000 }
};

// publish once, or publish N times if env var set
(async () => {
  const times = parseInt(process.env.TIMES || '1', 10);
  for (let i = 0; i < times; i++) {
    const env = Object.assign({}, sample, { event_id: `sample-evt-${Date.now()}-${i}` });
    await publish(env);
    await new Promise(r => setTimeout(r, 200));
  }
})().catch(err => {
  console.error('Publish error', err);
  process.exit(1);
});
