const express = require('express');
const controller = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();
router.post('/process', requireAuth, controller.processPayment);
module.exports = router;
