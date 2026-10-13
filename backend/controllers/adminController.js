const User = require('../models/User');
const Flight = require('../models/Flight');
const Booking = require('../models/Booking');
const { serializeBooking } = require('./bookingController');

async function dashboard(req, res, next) { try { const [totalUsers, totalFlights, totalBookings, confirmedBookings, cancelledBookings, revenueResult] = await Promise.all([User.countDocuments(), Flight.countDocuments(), Booking.countDocuments(), Booking.countDocuments({ bookingStatus: 'CONFIRMED' }), Booking.countDocuments({ bookingStatus: 'CANCELLED' }), Booking.aggregate([{ $match: { paymentStatus: 'PAID' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }])]); res.json({ success: true, data: { totalUsers, totalFlights, totalBookings, confirmedBookings, cancelledBookings, revenue: revenueResult[0]?.total || 0 } }); } catch (error) { next(error); } }
async function bookings(req, res, next) { try { const query = req.query.search ? { $or: [{ bookingReference: new RegExp(req.query.search, 'i') }, { PNR: new RegExp(req.query.search, 'i') }] } : {}; const records = await Booking.find(query).populate('flight').populate('user', 'name email').sort({ createdAt: -1 }); res.json({ success: true, data: records.map(serializeBooking) }); } catch (error) { next(error); } }
module.exports = { dashboard, bookings };
