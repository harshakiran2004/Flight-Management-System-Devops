const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transactionId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['Credit Card', 'Debit Card', 'UPI', 'Net Banking'], required: true },
  paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'], default: 'PENDING' },
  paymentDate: Date
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
