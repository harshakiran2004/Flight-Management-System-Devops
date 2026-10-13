const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();
router.post('/register', [body('name').optional().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'), body('email').optional().isEmail().withMessage('Valid email is required'), body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')], controller.register);
router.post('/login', controller.login);
router.get('/me', requireAuth, controller.me);
module.exports = router;
