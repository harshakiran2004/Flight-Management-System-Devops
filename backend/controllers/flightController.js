const { validationResult } = require('express-validator');
const Flight = require('../models/Flight');

function serializeFlight(flight) {
  const value = flight.toObject ? flight.toObject() : flight;
  return { ...value, origin: value.from, destination: value.to, seatsAvailable: value.availableEconomySeats, departureTime: value.departureTime, arrivalTime: value.arrivalTime };
}

function normalizedPayload(body) {
  const from = body.from || body.origin;
  const to = body.to || body.destination;
  const fromCode = body.fromCode || from;
  const toCode = body.toCode || to;
  const economySeats = Number(body.economySeats ?? body.seatsAvailable ?? 0);
  const businessSeats = Number(body.businessSeats ?? 0);
  return { ...body, from, to, fromCode, toCode, airlineCode: body.airlineCode || String(body.airline || 'AIR').slice(0, 2).toUpperCase(), aircraft: body.aircraft || 'Airbus A320', departureDate: body.departureDate || new Date().toISOString().slice(0, 10), arrivalDate: body.arrivalDate || body.departureDate || new Date().toISOString().slice(0, 10), duration: body.duration || '2h 15m', stops: Number(body.stops || 0), price: Number(body.price || 0), economySeats, businessSeats, availableEconomySeats: Number(body.availableEconomySeats ?? economySeats), availableBusinessSeats: Number(body.availableBusinessSeats ?? businessSeats), baggageAllowance: body.baggageAllowance || '15 kg', status: body.status || 'Scheduled' };
}

async function list(req, res, next) {
  try {
    const query = {};
    const search = req.query.search;
    if (search) query.$or = [{ airline: new RegExp(search, 'i') }, { flightNumber: new RegExp(search, 'i') }, { from: new RegExp(search, 'i') }, { to: new RegExp(search, 'i') }, { fromCode: new RegExp(search, 'i') }, { toCode: new RegExp(search, 'i') }];
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    if (req.query.maxPrice) query.price = { $lte: Number(req.query.maxPrice) };
    const flights = await Flight.find(query).sort({ departureDate: 1, departureTime: 1 });
    res.json(flights.map(serializeFlight));
  } catch (error) { next(error); }
}

async function search(req, res, next) {
  try {
    const { from, to, departureDate, passengers = 1, class: seatClass = 'economy', sort = 'departure' } = req.query;
    if (!from || !to || !departureDate) return res.status(400).json({ success: false, message: 'from, to and departureDate are required' });
    if (!['economy', 'business'].includes(String(seatClass).toLowerCase())) return res.status(400).json({ success: false, message: 'Invalid class' });
    const availability = seatClass.toLowerCase() === 'business' ? 'availableBusinessSeats' : 'availableEconomySeats';
    const query = { fromCode: String(from).toUpperCase(), toCode: String(to).toUpperCase(), departureDate, status: { $nin: ['Cancelled', 'Completed'] }, [availability]: { $gte: Number(passengers) } };
    let flights = await Flight.find(query);
    if (sort === 'cheapest') flights.sort((a, b) => a.price - b.price);
    if (sort === 'fastest') flights.sort((a, b) => a.duration.localeCompare(b.duration));
    res.json({ success: true, message: 'Flight search successful', data: flights.map(serializeFlight) });
  } catch (error) { next(error); }
}

async function details(req, res, next) {
  try { const flight = await Flight.findById(req.params.id); if (!flight) return res.status(404).json({ success: false, message: 'Flight not found' }); res.json({ success: true, data: serializeFlight(flight) }); } catch (error) { next(error); }
}

async function create(req, res, next) { try { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ success: false, message: errors.array()[0].msg }); const flight = await Flight.create(normalizedPayload(req.body)); res.status(201).json({ success: true, message: 'Flight created', data: serializeFlight(flight), ...serializeFlight(flight) }); } catch (error) { next(error); } }
async function update(req, res, next) { try { const flight = await Flight.findByIdAndUpdate(req.params.id, normalizedPayload(req.body), { new: true, runValidators: true }); if (!flight) return res.status(404).json({ success: false, message: 'Flight not found' }); res.json({ success: true, message: 'Flight updated', data: serializeFlight(flight), ...serializeFlight(flight) }); } catch (error) { next(error); } }
async function remove(req, res, next) { try { const flight = await Flight.findByIdAndUpdate(req.params.id, { status: 'Cancelled' }, { new: true }); if (!flight) return res.status(404).json({ success: false, message: 'Flight not found' }); res.json({ success: true, message: 'Flight deactivated' }); } catch (error) { next(error); } }

module.exports = { list, search, details, create, update, remove, serializeFlight };
