const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');


router.post('/login', adminController.login);
router.post('/feather-dragon/search', adminController.featherDragonSearch);
router.post('/dragons-unleashed', adminController.dragonsUnleashed);

router.get('/fetcher/status', adminController.fetcherStatus);
router.post('/fetcher/start', adminController.fetcherStart);
router.post('/fetcher/pause', adminController.fetcherPause);
router.post('/fetcher/resume', adminController.fetcherResume);
router.post('/fetcher/stop', adminController.fetcherStop);
router.post('/crawler/start', adminController.crawlerStart);
router.post('/intelligent/enhanced', adminController.enhancedCrawler);
router.post('/crawler/pause', adminController.crawlerPause);
router.post('/intelligent/pause', adminController.crawlerPause);
router.post('/crawler/resume', adminController.crawlerResume);
router.post('/intelligent/resume', adminController.crawlerResume);
router.post('/crawler/stop', adminController.crawlerStop);
router.post('/intelligent/stop', adminController.crawlerStop);
router.get('/intelligent/status', adminController.intelligentStatus);

router.get('/cache/stats', adminController.cacheStats);
router.post('/cache/clear', adminController.cacheClear);

router.get('/events', adminController.adminEvents);
router.delete('/event/:id', adminController.deleteEvent);

router.post('/populate-town', adminController.populateTown);
router.post('/populate-world', adminController.populateWorld);
router.post('/populate-country', adminController.populateCountry);
router.get('/populate-countries', adminController.populateCountries);
router.get('/populate-status', adminController.populateStatus);
router.get('/populate-jobs', adminController.listJobs);
router.get('/populate-job/:id', adminController.getJob);
router.post('/populate-job/:id/resume', adminController.resumePopulateJob);
router.get('/town-status/:town', adminController.townStatus);

router.get('/stats', adminController.stats);

router.get('/ai-config', adminController.getAIConfig);
router.post('/ai-config', adminController.saveAIConfig);
router.post('/ai-config/test', adminController.testAIConfig);

router.get('/users', adminController.getUsers);

// Unified Fetcher — consolidated multi-API event fetching
router.post('/unified-fetch', adminController.unifiedFetch);
router.get('/unified-sources', adminController.unifiedSources);

// Hot Refresh — restart Node / rebuild React without Docker rebuild
router.post('/refresh-node', adminController.refreshNode);
router.post('/refresh-react', adminController.refreshReact);
router.get('/refresh-status', adminController.refreshStatus);

module.exports = router;
