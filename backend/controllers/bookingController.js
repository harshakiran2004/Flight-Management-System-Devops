const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Flight = require('../models/Flight');
const Payment = require('../models/Payment');
const { createIdentifier, createPNR } = require('../utils/identifiers');

function calculatePrice(flight, count) { const baseFare = Number(flight.price) * count; const taxes = Math.round(baseFare * 0.18); const serviceFee = 250; return { baseFare, taxes, serviceFee, totalAmount: baseFare + taxes + serviceFee }; }
function legacyPassengers(body) { if (Array.isArray(body.passengers) && body.passengers.length) return body.passengers; const [firstName = 'Passenger', ...rest] = String(body.passengerName || 'Passenger').trim().split(/\s+/); return [{ title: 'Mr', firstName, lastName: rest.join(' ') || 'Guest', dateOfBirth: '1990-01-01', gender: 'Other', nationality: 'Indian', passportNumber: '' }]; }
function populateTicket(booking) { return Booking.findById(booking._id).populate('flight').populate('user', 'name email phone'); }
function serializeBooking(booking) {
  const value = booking.toObject ? booking.toObject() : booking;
  const passengers = value.passengers || [];
  const flight = value.flight && typeof value.flight === 'object' ? value.flight : null;
  return {
    ...value,
    passengerName: passengers.map((passenger) => `${passenger.firstName} ${passenger.lastName}`).join(', '),
    email: value.contactDetails?.email || '',
    phone: value.contactDetails?.phone || '',
    flightId: flight?._id || value.flight,
    seatCount: value.numberOfPassengers,
    travelClass: value.seatClass,
    flight
  };
}

const SEAT_COLUMNS = 'ABCDEF';

function seatCode(rowIndex, seatClass) {
  const cabin = seatClass === 'business' ? 'B' : 'E';
  return `${cabin}-${Math.floor(rowIndex / SEAT_COLUMNS.length) + 1}${SEAT_COLUMNS[rowIndex % SEAT_COLUMNS.length]}`;
}

function getSeatInventory(flight, seatClass) {
  const isBusiness = seatClass === 'business';
  const capacity = Number(isBusiness ? flight.businessSeats : flight.economySeats) || 0;
  const available = Number(isBusiness ? flight.availableBusinessSeats : flight.availableEconomySeats) || 0;
  const reserved = (flight.reservedSeats || []).filter((seat) => seat.seatClass === seatClass);
  const seatCodes = Array.from({ length: capacity }, (_, index) => seatCode(index, seatClass));
  const legacyReservedCount = Math.max(0, capacity - available - reserved.length);
  const blockedSeats = new Set([...reserved.map((seat) => seat.seatNumber), ...seatCodes.slice(0, legacyReservedCount)]);
  return { seatCodes, blockedSeats };
}

function assignSeats(requestedSeats, flight, seatClass, count) {
  const { seatCodes, blockedSeats } = getSeatInventory(flight, seatClass);
  const seats = requestedSeats === undefined
    ? seatCodes.filter((seat) => !blockedSeats.has(seat)).slice(0, count)
    : requestedSeats;
  const invalid = (message, status = 400) => Object.assign(new Error(message), { status });

  if (!Array.isArray(seats) || seats.length !== count) throw invalid(`Choose exactly ${count} seat${count === 1 ? '' : 's'}.`);
  if (new Set(seats).size !== seats.length) throw invalid('A seat can only be selected once.');
  if (seats.some((seat) => !seatCodes.includes(seat))) throw invalid('One or more selected seats do not belong to this cabin.');
  if (seats.some((seat) => blockedSeats.has(seat))) throw invalid('One or more selected seats are already occupied.', 409);
  return seats;
}

async function create(req, res, next) {
  const session = await mongoose.startSession();
  try {
    const body = req.body;
    const flight = await Flight.findById(body.flight || body.flightId);
    const count = Number(body.numberOfPassengers || body.seatCount || body.passengers?.length || 1);
    const seatClass = String(body.seatClass || body.travelClass || 'economy').toLowerCase() === 'business' ? 'business' : 'economy';
    if (!flight) return res.status(404).json({ success: false, message: 'Flight not found' });
    if (flight.status === 'Cancelled' || flight.status === 'Completed') return res.status(400).json({ success: false, message: 'This flight is not available for booking' });
    if (!Number.isInteger(count) || count < 1 || count > 9) return res.status(400).json({ success: false, message: 'Passenger count must be between 1 and 9' });
    const availableField = seatClass === 'business' ? 'availableBusinessSeats' : 'availableEconomySeats';
    if (flight[availableField] < count) return res.status(400).json({ success: false, message: 'Not enough seats available' });
    let selectedSeats;
    try {
      selectedSeats = assignSeats(body.selectedSeats, flight, seatClass, count);
    } catch (error) {
      return res.status(error.status || 400).json({ success: false, message: error.message });
    }
    const price = calculatePrice(flight, count);
    const bookingData = { bookingReference: createIdentifier('BK', 5), user: req.user.id, flight: flight._id, passengers: legacyPassengers(body), contactDetails: body.contactDetails || { email: body.email || req.user.email || '', phone: body.phone || '' }, seatClass, selectedSeats, numberOfPassengers: count, ...price, paymentStatus: 'PENDING', bookingStatus: 'PENDING' };
    const booking = new Booking(bookingData);
    await booking.save();
    res.status(201).json({ success: true, message: 'Booking created. Complete payment to confirm.', data: booking, ...booking.toObject(), totalAmount: price.totalAmount });
  } catch (error) { next(error); } finally { session.endSession().catch(() => {}); }
}
async function processPayment(req, res, next) { try { const booking = await Booking.findById(req.body.bookingId).populate('flight'); if (!booking || String(booking.user) !== String(req.user.id)) return res.status(404).json({ success: false, message: 'Booking not found' }); if (booking.bookingStatus === 'CANCELLED') return res.status(400).json({ success: false, message: 'Booking is cancelled' }); if (booking.paymentStatus === 'PAID') return res.status(409).json({ success: false, message: 'Booking has already been paid' }); if (Number(req.body.amount) !== Number(booking.totalAmount)) return res.status(400).json({ success: false, message: 'Payment amount does not match booking total' }); const field = booking.seatClass === 'business' ? 'availableBusinessSeats' : 'availableEconomySeats'; const selectedSeats = booking.selectedSeats.length ? booking.selectedSeats : assignSeats(undefined, booking.flight, booking.seatClass, booking.numberOfPassengers); const flight = await Flight.findOneAndUpdate({ _id: booking.flight._id, [field]: { $gte: booking.numberOfPassengers }, reservedSeats: { $not: { $elemMatch: { seatNumber: { $in: selectedSeats } } } } }, { $inc: { [field]: -booking.numberOfPassengers }, $push: { reservedSeats: { $each: selectedSeats.map((seatNumber) => ({ seatNumber, seatClass: booking.seatClass, booking: booking._id })) } } }, { new: true }); if (!flight) return res.status(409).json({ success: false, message: 'One or more selected seats have just been taken. Please choose different seats.' }); booking.selectedSeats = selectedSeats; booking.paymentStatus = 'PAID'; booking.bookingStatus = 'CONFIRMED'; booking.PNR = createPNR(); await booking.save(); const payment = await Payment.create({ booking: booking._id, user: req.user.id, transactionId: createIdentifier('TXN', 6), amount: booking.totalAmount, paymentMethod: req.body.paymentMethod, paymentStatus: 'PAID', paymentDate: new Date() }); const result = await populateTicket(booking); res.json({ success: true, message: 'Payment successful. Booking confirmed.', data: { booking: result, payment }, PNR: result.PNR, bookingReference: result.bookingReference, transactionId: payment.transactionId, totalAmount: result.totalAmount, bookingStatus: result.bookingStatus }); } catch (error) { next(error); } }
async function myBookings(req, res, next) { try { const records = await Booking.find({ user: req.user.id }).populate('flight').sort({ bookingDate: -1 }); res.json({ success: true, data: records.map(serializeBooking) }); } catch (error) { next(error); } }
async function getOne(req, res, next) { try { const booking = await Booking.findById(req.params.id).populate('flight').populate('user', 'name email phone'); if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' }); if (req.user.role !== 'admin' && String(booking.user._id || booking.user) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'You cannot access this booking' }); res.json({ success: true, data: booking }); } catch (error) { next(error); } }
async function cancel(req, res, next) { try { const booking = await Booking.findById(req.params.id); if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' }); if (req.user.role !== 'admin' && String(booking.user) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'You cannot cancel this booking' }); if (booking.bookingStatus === 'CANCELLED') return res.status(400).json({ success: false, message: 'Booking is already cancelled' }); const field = booking.seatClass === 'business' ? 'availableBusinessSeats' : 'availableEconomySeats'; await Flight.findByIdAndUpdate(booking.flight, { $inc: { [field]: booking.numberOfPassengers }, $pull: { reservedSeats: { booking: booking._id } } }); booking.bookingStatus = 'CANCELLED'; booking.paymentStatus = booking.paymentStatus === 'PAID' ? 'REFUNDED' : booking.paymentStatus; booking.cancellationDate = new Date(); await booking.save(); await Payment.findOneAndUpdate({ booking: booking._id, paymentStatus: 'PAID' }, { paymentStatus: 'REFUNDED' }); res.json({ success: true, message: 'Booking cancelled and seats restored', data: booking }); } catch (error) { next(error); } }
async function ticket(req, res, next) { try { const booking = await Booking.findById(req.params.id).populate('flight'); if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' }); if (req.user.role !== 'admin' && String(booking.user) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'You cannot access this ticket' }); res.json({ success: true, data: { airline: booking.flight.airline, flightNumber: booking.flight.flightNumber, PNR: booking.PNR, bookingReference: booking.bookingReference, passengerName: booking.passengers.map((passenger) => `${passenger.firstName} ${passenger.lastName}`).join(', '), from: booking.flight.from, fromAirport: booking.flight.fromCode, to: booking.flight.to, toAirport: booking.flight.toCode, departureDate: booking.flight.departureDate, departureTime: booking.flight.departureTime, arrivalDate: booking.flight.arrivalDate, arrivalTime: booking.flight.arrivalTime, seatClass: booking.seatClass, selectedSeats: booking.selectedSeats, numberOfPassengers: booking.numberOfPassengers, baggageAllowance: booking.flight.baggageAllowance, bookingStatus: booking.bookingStatus, paymentStatus: booking.paymentStatus, totalAmount: booking.totalAmount } }); } catch (error) { next(error); } }
module.exports = { create, processPayment, myBookings, getOne, cancel, ticket, calculatePrice, serializeBooking, getSeatInventory, assignSeats };
