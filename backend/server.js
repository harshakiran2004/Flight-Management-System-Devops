require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH || require('path').join(__dirname, '..', 'server', '.env') });
const express = require('express');
const cors = require('cors');
const { connectDatabase } = require('./config/db');
const { requireAuth, requireAdmin } = require('./middleware/authMiddleware');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const authRoutes = require('./routes/authRoutes');
const flightRoutes = require('./routes/flightRoutes');
const externalDataRoutes = require('./routes/externalDataRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const Booking = require('./models/Booking');
const { serializeBooking } = require('./controllers/bookingController');
const Flight = require('./models/Flight');

const app = express();
const PORT = Number(process.env.API_PORT || process.env.PORT || 5000);
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.get('/', (req, res) => res.json({ success: true, message: 'Flight Booking API is running', frontend: process.env.CLIENT_URL || 'http://localhost:3000', health: '/api/health' }));
app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', mode: 'database', database: process.env.MONGO_DB_NAME || 'flight_booking_system' }));
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/external', externalDataRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/dashboard/summary', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [totalFlights, totalBookings, totalSeatsBooked, statusCounts] = await Promise.all([
      Flight.countDocuments(), Booking.countDocuments(), Booking.aggregate([{ $match: { bookingStatus: 'CONFIRMED' } }, { $group: { _id: null, total: { $sum: '$numberOfPassengers' } } }]), Booking.aggregate([{ $group: { _id: '$bookingStatus', count: { $sum: 1 } } }])
    ]);
    const summary = { totalFlights, totalBookings, totalSeatsBooked: totalSeatsBooked[0]?.total || 0, scheduled: 0, delayed: 0, cancelled: 0 };
    statusCounts.forEach((entry) => { if (entry._id === 'CONFIRMED') summary.scheduled += entry.count; if (entry._id === 'CANCELLED') summary.cancelled += entry.count; });
    const flights = await Flight.find({}, 'status');
    summary.scheduled = flights.filter((flight) => flight.status === 'Scheduled').length;
    summary.delayed = flights.filter((flight) => flight.status === 'Delayed').length;
    summary.cancelled = flights.filter((flight) => flight.status === 'Cancelled').length;
    res.json(summary);
  } catch (error) { next(error); }
});

app.get('/api/dashboard/analytics', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [flights, bookings] = await Promise.all([Flight.find(), Booking.find({ bookingStatus: 'CONFIRMED' })]);
    const bookedSeats = bookings.reduce((sum, booking) => sum + booking.numberOfPassengers, 0);
    const capacity = flights.reduce((sum, flight) => sum + flight.economySeats + flight.businessSeats, 0);
    const averageFare = flights.length ? Math.round(flights.reduce((sum, flight) => sum + flight.price, 0) / flights.length) : 0;
    res.json({ occupancyRate: capacity ? Math.round((bookedSeats / capacity) * 100) : 0, averageFare, revenueEstimate: bookings.reduce((sum, booking) => sum + booking.totalAmount, 0) });
  } catch (error) { next(error); }
});

app.get('/api/dashboard/booking-trends', requireAuth, requireAdmin, async (req, res, next) => {
  try { const result = await Booking.aggregate([{ $match: { bookingStatus: 'CONFIRMED' } }, { $group: { _id: { $month: '$bookingDate' }, value: { $sum: '$numberOfPassengers' } } }, { $sort: { _id: 1 } }]); res.json(result.map((entry) => ({ label: String(entry._id), value: entry.value }))); } catch (error) { next(error); }
});

app.get('/api/bookings', requireAuth, requireAdmin, async (req, res, next) => {
  try { const bookings = await Booking.find().populate('flight').populate('user', 'name email phone').sort({ createdAt: -1 }); res.json(bookings.map(serializeBooking)); } catch (error) { next(error); }
});
app.use(notFound);
app.use(errorHandler);

async function start() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required. Configure server/.env before starting the backend.');
  await connectDatabase();
  app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
}

if (require.main === module) start().catch((error) => { console.error(`Startup failed: ${error.message}`); process.exitCode = 1; });
module.exports = { app, start };
