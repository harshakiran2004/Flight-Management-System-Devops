const mongoose = require('mongoose');

const reservedSeatSchema = new mongoose.Schema({
  seatNumber: { type: String, required: true },
  seatClass: { type: String, enum: ['economy', 'business'], required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true }
}, { _id: false });

const flightSchema = new mongoose.Schema({
  flightNumber: { type: String, required: true, unique: true, trim: true },
  airline: { type: String, required: true, trim: true },
  airlineCode: { type: String, required: true, uppercase: true, trim: true },
  aircraft: { type: String, required: true, trim: true },
  from: { type: String, required: true, trim: true },
  fromCode: { type: String, required: true, uppercase: true, trim: true },
  to: { type: String, required: true, trim: true },
  toCode: { type: String, required: true, uppercase: true, trim: true },
  departureDate: { type: String, required: true },
  departureTime: { type: String, required: true },
  arrivalDate: { type: String, required: true },
  arrivalTime: { type: String, required: true },
  duration: { type: String, required: true },
  stops: { type: Number, default: 0, min: 0 },
  price: { type: Number, required: true, min: 0 },
  economySeats: { type: Number, required: true, min: 0 },
  businessSeats: { type: Number, required: true, min: 0 },
  availableEconomySeats: { type: Number, required: true, min: 0 },
  availableBusinessSeats: { type: Number, required: true, min: 0 },
  reservedSeats: { type: [reservedSeatSchema], default: [] },
  baggageAllowance: { type: String, default: '15 kg' },
  status: { type: String, enum: ['Scheduled', 'Delayed', 'Cancelled', 'Completed'], default: 'Scheduled' }
}, { timestamps: true });

flightSchema.index({ fromCode: 1, toCode: 1, departureDate: 1 });

module.exports = mongoose.model('Flight', flightSchema);
