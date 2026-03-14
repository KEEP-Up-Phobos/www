(async () => {
  const TownPopulator = require('./town-populator');
  const pop = new TownPopulator({ host: process.env.DB_HOST || 'db', user: process.env.DB_USER || 'keepup', password: process.env.DB_PASSWORD || 'As30281163', database: process.env.DB_NAME || 'keepup_db' }, { town: 'Porto Alegre', country: 'Brazil', maxEvents: 5, usePython: true, useDragons: true, maxParallel: 5, pythonSources: ['ticketmaster','sympla'] });
  pop.on('log', msg => console.log('[POP]', msg));
  pop.on('error', e => console.error('[POP ERR]', e));
  const ok = await pop.init();
  if (!ok) { console.error('Init failed'); process.exit(1); }
  try {
    const result = await pop.populateTown();
    console.log('RESULT:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('POP ERROR', e);
  }
  process.exit(0);
})();