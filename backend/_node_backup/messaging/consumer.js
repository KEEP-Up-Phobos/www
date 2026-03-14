const amqp = require('amqplib');

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://keepup:keepup_pass@localhost:5672';
const EXCHANGE = process.env.EXCHANGE || 'keepup.events';
const QUEUE = process.env.QUEUE || 'keepup.events.consumer';
const ROUTING_KEY = process.env.ROUTING_KEY || '#';

function haversineMeters(lat1, lon1, lat2, lon2){
  function toRad(x){return x * Math.PI / 180;}
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

(async () => {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange(EXCHANGE, 'topic', { durable: false });
  await ch.assertQueue(QUEUE, { durable: false });
  await ch.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);

  console.log('Consumer waiting for messages on', QUEUE);

  ch.consume(QUEUE, msg => {
    if (!msg) return;
    try {
      const envelope = JSON.parse(msg.content.toString());
      const filterLat = process.env.FILTER_LAT ? parseFloat(process.env.FILTER_LAT) : null;
      const filterLon = process.env.FILTER_LON ? parseFloat(process.env.FILTER_LON) : null;
      const filterRadius = process.env.FILTER_RADIUS_M ? parseFloat(process.env.FILTER_RADIUS_M) : null;

      let accepted = true;
      if (filterLat !== null && filterLon !== null && filterRadius !== null && envelope.location && envelope.location.lat && envelope.location.lon) {
        const d = haversineMeters(filterLat, filterLon, envelope.location.lat, envelope.location.lon);
        accepted = d <= filterRadius;
        console.log(`Distance=${Math.round(d)}m (filter ${filterRadius}m) -> ${accepted ? 'ACCEPT' : 'REJECT'}`);
      }

      if (accepted) {
        console.log('RECEIVED:', envelope.event_id, envelope.type, envelope.location && envelope.location.city, envelope.payload && envelope.payload.title);
      }
    } catch (e) {
      console.error('Failed to parse message', e);
    } finally {
      ch.ack(msg);
    }
  });

})().catch(err => {
  console.error('Consumer error', err);
  process.exit(1);
});
