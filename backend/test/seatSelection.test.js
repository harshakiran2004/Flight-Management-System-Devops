const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assignSeats, getSeatInventory } = require('../controllers/bookingController');

const flight = {
  economySeats: 12,
  businessSeats: 4,
  availableEconomySeats: 10,
  availableBusinessSeats: 4,
  reservedSeats: [
    { seatNumber: 'E-1B', seatClass: 'economy' },
    { seatNumber: 'E-2A', seatClass: 'economy' }
  ]
};

test('accepts exactly the requested number of available cabin seats', () => {
  assert.deepEqual(assignSeats(['E-1A', 'E-1C'], flight, 'economy', 2), ['E-1A', 'E-1C']);
});

test('rejects occupied seats, duplicate choices, and another cabin', () => {
  assert.throws(() => assignSeats(['E-1B'], flight, 'economy', 1), { status: 409 });
  assert.throws(() => assignSeats(['E-1A', 'E-1A'], flight, 'economy', 2), /only be selected once/);
  assert.throws(() => assignSeats(['B-1A'], flight, 'economy', 1), /do not belong/);
});

test('automatically assigned legacy bookings skip occupied seats', () => {
  assert.deepEqual(assignSeats(undefined, flight, 'economy', 2), ['E-1A', 'E-1C']);
});

test('marks seats occupied by bookings created before seat IDs were stored', () => {
  const inventory = getSeatInventory({ economySeats: 12, availableEconomySeats: 10, reservedSeats: [] }, 'economy');
  assert.equal(inventory.blockedSeats.has('E-1A'), true);
  assert.equal(inventory.blockedSeats.has('E-1B'), true);
  assert.equal(inventory.blockedSeats.has('E-1C'), false);
});