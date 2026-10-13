const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  dateOfBirth: { type: String, required: true },
  gender: { type: String, required: true },
  nationality: { type: String, required: true },
  passportNumber: { type: String, default: '' }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  bookingReference: { type: String, required: true, unique: true },
  PNR: { type: String, unique: true, sparse: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  flight: { type: mongoose.Schema.Types.ObjectId, ref: 'Flight', required: true },
  passengers: { type: [passengerSchema], required: true },
  contactDetails: { email: { type: String, required: true }, phone: { type: String, required: true } },
  seatClass: { type: String, enum: ['economy', 'business'], required: true },
  selectedSeats: { type: [String], default: [] },
  numberOfPassengers: { type: Number, required: true, min: 1 },
  baseFare: { type: Number, required: true, min: 0 },
  taxes: { type: Number, required: true, min: 0 },
  serviceFee: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
  bookingStatus: { type: String, enum: ['CONFIRMED', 'CANCELLED', 'PENDING'], default: 'PENDING' },
  bookingDate: { type: Date, default: Date.now },
  cancellationDate: Date
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
