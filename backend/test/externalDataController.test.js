const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { weather, aircraft } = require('../controllers/externalDataController');

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function responseRecorder() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('weather resolves a place and returns its current Open-Meteo conditions', async () => {
  const urls = [];
  global.fetch = async (url) => {
    urls.push(new URL(url));
    const payload = urls.length === 1
      ? { results: [{ name: 'Berlin', country: 'Germany', admin1: 'Berlin', latitude: 52.52, longitude: 13.41 }] }
      : { timezone: 'Europe/Berlin', current: { temperature_2m: 17, weather_code: 2 }, current_units: { temperature_2m: '°C' } };
    return { ok: true, json: async () => payload };
  };

  const res = responseRecorder();
  await weather({ query: { location: 'Berlin' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.condition, 'Partly cloudy');
  assert.equal(res.body.data.location.timezone, 'Europe/Berlin');
  assert.equal(urls[0].searchParams.get('name'), 'Berlin');
  assert.equal(urls[1].searchParams.get('latitude'), '52.52');
});

test('aircraft bounds the OpenSky query and normalizes state vectors', async () => {
  let requestedUrl;
  global.fetch = async (url) => {
    requestedUrl = new URL(url);
    return {
      ok: true,
      json: async () => ({ time: 123, states: [['abc123', ' TEST123 ', 'Germany', 0, 123, 10, 20, 1000, false, 200, 90]] })
    };
  };

  const res = responseRecorder();
  await aircraft({ query: { latitude: '20', longitude: '10' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Number(requestedUrl.searchParams.get('lamin')), 20 - (40 / 111.32));
  assert.equal(res.body.data.aircraft[0].callsign, 'TEST123');
  assert.equal(res.body.data.aircraft[0].speedMetersPerSecond, 200);
  assert.equal(res.body.data.aircraft[0].distanceKm, 0);
});

test('invalid weather locations are rejected before making upstream requests', async () => {
  global.fetch = async () => { throw new Error('unexpected upstream request'); };
  const res = responseRecorder();

  await weather({ query: { location: 'x' } }, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /location/i);
});