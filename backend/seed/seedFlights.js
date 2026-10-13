require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'server', '.env') });
const mongoose = require('mongoose');
const Flight = require('../models/Flight');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { connectDatabase } = require('../config/db');

const routes = [
  ['BLR', 'Bengaluru', 'DEL', 'Delhi'], ['BLR', 'Bengaluru', 'BOM', 'Mumbai'], ['BLR', 'Bengaluru', 'HYD', 'Hyderabad'], ['BLR', 'Bengaluru', 'MAA', 'Chennai'], ['BLR', 'Bengaluru', 'CCU', 'Kolkata'], ['BLR', 'Bengaluru', 'GOI', 'Goa'], ['DEL', 'Delhi', 'BLR', 'Bengaluru'], ['DEL', 'Delhi', 'BOM', 'Mumbai'], ['DEL', 'Delhi', 'HYD', 'Hyderabad'], ['BOM', 'Mumbai', 'BLR', 'Bengaluru'], ['BOM', 'Mumbai', 'DEL', 'Delhi'], ['MAA', 'Chennai', 'BLR', 'Bengaluru'], ['HYD', 'Hyderabad', 'BLR', 'Bengaluru'], ['BLR', 'Bengaluru', 'DXB', 'Dubai'], ['BLR', 'Bengaluru', 'SIN', 'Singapore'], ['DEL', 'Delhi', 'DXB', 'Dubai'], ['DXB', 'Dubai', 'BLR', 'Bengaluru'], ['BLR', 'Bengaluru', 'LHR', 'London'], ['BOM', 'Mumbai', 'DXB', 'Dubai'], ['DEL', 'Delhi', 'SIN', 'Singapore'], ['MAA', 'Chennai', 'DEL', 'Delhi'], ['CCU', 'Kolkata', 'BLR', 'Bengaluru'], ['GOI', 'Goa', 'DEL', 'Delhi'], ['HYD', 'Hyderabad', 'MAA', 'Chennai'], ['BLR', 'Bengaluru', 'COK', 'Kochi'], ['COK', 'Kochi', 'BLR', 'Bengaluru'], ['DEL', 'Delhi', 'BKK', 'Bangkok'], ['BOM', 'Mumbai', 'LHR', 'London'], ['BLR', 'Bengaluru', 'FRA', 'Frankfurt'], ['DEL', 'Delhi', 'JFK', 'New York']
];
const airlines = [['IndiGo', '6E', 'Airbus A320'], ['Air India', 'AI', 'Airbus A321'], ['Vistara', 'UK', 'Airbus A320neo'], ['Akasa Air', 'QP', 'Boeing 737 MAX'], ['SpiceJet', 'SG', 'Boeing 737-800'], ['Emirates', 'EK', 'Boeing 777'], ['Qatar Airways', 'QR', 'Airbus A350']];

async function seed() {
  await connectDatabase();
  await Flight.deleteMany({});
  const flights = routes.map((route, index) => {
    const airline = airlines[index % airlines.length];
    const international = ['DXB', 'SIN', 'LHR', 'BKK', 'FRA', 'JFK'].includes(route[2]);
    const hour = String(5 + ((index * 2) % 17)).padStart(2, '0');
    return { flightNumber: `${airline[1]}${100 + index}`, airline: airline[0], airlineCode: airline[1], aircraft: airline[2], from: route[1], fromCode: route[0], to: route[3], toCode: route[2], departureDate: '2026-09-15', departureTime: `${hour}:30`, arrivalDate: '2026-09-15', arrivalTime: `${String((Number(hour) + (international ? 5 : 2)) % 24).padStart(2, '0')}:45`, duration: international ? '5h 15m' : '2h 15m', stops: index % 5 === 0 ? 1 : 0, price: international ? 12500 + index * 275 : 3500 + index * 125, economySeats: international ? 240 : 180, businessSeats: international ? 30 : 20, availableEconomySeats: international ? 240 : 180, availableBusinessSeats: international ? 30 : 20, baggageAllowance: international ? '25 kg' : '15 kg', status: 'Scheduled' };
  });
  await Flight.insertMany(flights);
  await User.findOneAndUpdate(
    { email: 'admin@skyroute.local' },
    { name: 'admin', email: 'admin@skyroute.local', password: await bcrypt.hash('admin123', 12), role: 'admin', isActive: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Seeded ${flights.length} flights into ${mongoose.connection.name}`);
  await mongoose.disconnect();
}
seed().catch((error) => { console.error(error); process.exitCode = 1; });
