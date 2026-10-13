const express = require('express');
const controller = require('../controllers/userController');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();
router.get('/profile', requireAuth, controller.profile);
router.put('/profile', requireAuth, controller.updateProfile);
router.put('/change-password', requireAuth, controller.changePassword);
module.exports = router;
