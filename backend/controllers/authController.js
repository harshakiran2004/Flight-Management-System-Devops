const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

function tokenFor(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '8h' });
}

function publicUser(user) {
  return { id: user._id, name: user.name, username: user.name, email: user.email, phone: user.phone, role: user.role };
}

async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    const name = req.body.name || req.body.username;
    const email = String(req.body.email || `${req.body.username || name}@demo.local`).toLowerCase();
    const { password, phone, role } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });
    const user = await User.create({ name, email: email.toLowerCase(), password, phone, role: role === 'admin' ? 'admin' : 'user' });
    res.status(201).json({ success: true, message: 'Registration successful', token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
}

async function login(req, res, next) {
  try {
    const identifier = String(req.body.email || req.body.username || '').trim();
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { name: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      ]
    }).select('+password');
    if (!user || !user.isActive || !(await user.comparePassword(req.body.password || ''))) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    res.json({ success: true, message: 'Login successful', token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: publicUser(user) });
  } catch (error) { next(error); }
}

module.exports = { register, login, me, publicUser };
