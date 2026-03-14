const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/events.controller');
const { optionalAuth, requireAuth } = require('../middleware/requireAuth');

// Public routes (no auth required)
router.get('/discover', optionalAuth(), eventsController.discover);
router.post('/search', eventsController.searchPost);
router.get('/search', eventsController.searchGet);
router.get('/artist/:name', eventsController.byArtist);
router.get('/country/:country', eventsController.byCountry);
router.get('/nearby', eventsController.nearby);

// Auth-required routes (must be logged in)
router.post('/save', requireAuth(), eventsController.save);
router.post('/unsave', requireAuth(), eventsController.unsave);
router.get('/saved', requireAuth(), eventsController.saved);
router.get('/is-saved', requireAuth(), eventsController.isSaved);
router.post('/create', requireAuth(), eventsController.create);
router.post('/populate-town', eventsController.populateTown);

// Viagogo search - searches Viagogo and auto-saves new events to Postgres
router.get('/viagogo-search', eventsController.viagogoSearch);
router.post('/viagogo-search', eventsController.viagogoSearch);

// Single event detail (must be LAST — :id is a catch-all pattern)
router.get('/:id', eventsController.getById);

module.exports = router;
