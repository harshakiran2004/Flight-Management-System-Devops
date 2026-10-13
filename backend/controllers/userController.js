
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { publicUser } = require('./authController');

async function profile(req, res, next) { try { const user = await User.findById(req.user.id); if (!user) return res.status(404).json({ success: false, message: 'User not found' }); res.json({ success: true, data: publicUser(user) }); } catch (error) { next(error); } }
async function updateProfile(req, res, next) { try { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg }); const allowed = {}; ['name', 'email', 'phone'].forEach((field) => { if (req.body[field] !== undefined) allowed[field] = req.body[field]; }); if (allowed.email) { const duplicate = await User.findOne({ email: allowed.email.toLowerCase(), _id: { $ne: req.user.id } }); if (duplicate) return res.status(409).json({ success: false, message: 'Email already registered' }); allowed.email = allowed.email.toLowerCase(); } const user = await User.findByIdAndUpdate(req.user.id, allowed, { new: true, runValidators: true }); res.json({ success: true, message: 'Profile updated', data: publicUser(user) }); } catch (error) { next(error); } }
async function changePassword(req, res, next) { try { const user = await User.findById(req.user.id).select('+password'); if (!user || !(await user.comparePassword(req.body.currentPassword || ''))) return res.status(401).json({ success: false, message: 'Current password is incorrect' }); user.password = req.body.newPassword; await user.save(); res.json({ success: true, message: 'Password changed successfully' }); } catch (error) { next(error); } }
async function listUsers(req, res, next) { try { const users = await User.find().select('-password').sort({ createdAt: -1 }); res.json({ success: true, data: users }); } catch (error) { next(error); } }
module.exports = { profile, updateProfile, changePassword, listUsers };
