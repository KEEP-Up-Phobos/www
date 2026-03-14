/**
 * Interests Routes
 * API endpoints for user interests management
 */

const express = require('express');
const router = express.Router();
const interestsController = require('../controllers/interests.controller');

// GET /api/interests/categories - Get all interest categories
router.get('/categories', interestsController.getCategories);

// GET /api/interests/category/:categoryId - Get items in a category
router.get('/category/:categoryId', interestsController.getCategoryItems);

// GET /api/interests/user/:userId - Get user's selected interests
router.get('/user/:userId', interestsController.getUserInterests);

// POST /api/interests/user/:userId - Save user's interests
router.post('/user/:userId', interestsController.saveUserInterests);

// GET /api/interests/match/:userId - Get events matching user's interests
router.get('/match/:userId', interestsController.getMatchingEvents);

// POST /api/interests/sync - Sync interest data to database (admin)
router.post('/sync', interestsController.syncToDatabase);

module.exports = router;
