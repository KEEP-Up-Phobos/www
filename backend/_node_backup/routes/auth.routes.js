const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');


// Auth endpoints
router.get('/check', authController.check);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/validate-session', authController.validateSession);
router.get('/validate-session', authController.validateSessionGet);
router.post('/joomla-session', authController.joomlaSession);
router.post('/register', authController.register);
router.get('/user', authController.getUser);

module.exports = router;
