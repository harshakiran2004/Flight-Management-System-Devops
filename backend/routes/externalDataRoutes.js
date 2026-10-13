const express = require('express');
const controller = require('../controllers/externalDataController');

const router = express.Router();
router.get('/weather', controller.weather);
router.get('/aircraft', controller.aircraft);

module.exports = router;