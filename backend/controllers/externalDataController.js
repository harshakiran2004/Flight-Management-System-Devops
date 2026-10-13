const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_SKY_STATES_URL = 'https://opensky-network.org/api/states/all';
const OPEN_SKY_TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const WEATHER_CODES = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Dense freezing drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain', 71: 'Slight snowfall', 73: 'Moderate snowfall', 75: 'Heavy snowfall',
  77: 'Snow grains', 80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
};

let openSkyToken;
let openSkyTokenExpiresAt = 0;

async function fetchJson(url, service, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const status = response.status === 429 ? 503 : 502;
      const message = response.status === 429 ? `${service} is temporarily rate limited. Try again later.` : `${service} is temporarily unavailable.`;
      const error = new Error(message);
      error.status = status;
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error.status) throw error;
    const wrapped = new Error(error.name === 'AbortError' ? `${service} request timed out.` : `${service} could not be reached.`);
    wrapped.status = 502;
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }
}

async function getOpenSkyHeaders() {
  const clientId = process.env.OPEN_SKY_CLIENT_ID;
  const clientSecret = process.env.OPEN_SKY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return {};
  if (openSkyToken && Date.now() < openSkyTokenExpiresAt) return { Authorization: `Bearer ${openSkyToken}` };

  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const tokenData = await fetchJson(OPEN_SKY_TOKEN_URL, 'OpenSky authentication', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!tokenData.access_token) {
    const error = new Error('OpenSky authentication did not return an access token.');
    error.status = 502;
    throw error;
  }
  openSkyToken = tokenData.access_token;
  openSkyTokenExpiresAt = Date.now() + Math.max(60, (tokenData.expires_in || 1800) - 60) * 1000;
  return { Authorization: `Bearer ${openSkyToken}` };
}

async function weather(req, res) {
  const location = String(req.query.location || '').trim();
  if (location.length < 2 || location.length > 100) {
    return res.status(400).json({ success: false, message: 'Enter a location between 2 and 100 characters.' });
  }

  try {
    const geocodeUrl = new URL(OPEN_METEO_GEOCODING_URL);
    geocodeUrl.search = new URLSearchParams({ name: location, count: '1', language: 'en', format: 'json' }).toString();
    const geocoding = await fetchJson(geocodeUrl, 'Open-Meteo geocoding');
    const place = geocoding.results?.[0];
    if (!place) return res.status(404).json({ success: false, message: `No matching location found for "${location}".` });

    const forecastUrl = new URL(OPEN_METEO_FORECAST_URL);
    forecastUrl.search = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
      timezone: 'auto'
    }).toString();
    const forecast = await fetchJson(forecastUrl, 'Open-Meteo weather');
    return res.json({
      success: true,
      data: {
        location: { name: place.name, region: place.admin1 || '', country: place.country || '', latitude: place.latitude, longitude: place.longitude, timezone: forecast.timezone },
        current: forecast.current,
        units: forecast.current_units,
        condition: WEATHER_CODES[forecast.current?.weather_code] || 'Conditions unavailable',
        source: 'Open-Meteo'
      }
    });
  } catch (error) {
    return res.status(error.status || 502).json({ success: false, message: error.message });
  }
}

async function aircraft(req, res) {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required.' });
  }

  try {
    const radiusKm = 40;
    const latitudeRadius = radiusKm / 111.32;
    const longitudeRadius = Math.min(180, latitudeRadius / Math.max(Math.cos(latitude * Math.PI / 180), 0.01));
    const params = new URLSearchParams({
      lamin: String(Math.max(-90, latitude - latitudeRadius)),
      lomin: String(Math.max(-180, longitude - longitudeRadius)),
      lamax: String(Math.min(90, latitude + latitudeRadius)),
      lomax: String(Math.min(180, longitude + longitudeRadius))
    });
    const states = await fetchJson(`${OPEN_SKY_STATES_URL}?${params}`, 'OpenSky', { headers: await getOpenSkyHeaders() });
    const aircraft = (states.states || []).filter((state) => state[5] != null && state[6] != null).map((state) => ({
      icao24: state[0],
      callsign: String(state[1] || '').trim() || 'Unknown',
      country: state[2],
      longitude: state[5],
      latitude: state[6],
      altitudeMeters: state[7],
      onGround: state[8],
      speedMetersPerSecond: state[9],
      heading: state[10],
      lastContact: state[4],
      distanceKm: 6371 * 2 * Math.asin(Math.sqrt(
        Math.sin(((state[6] - latitude) * Math.PI / 180) / 2) ** 2
        + Math.cos(latitude * Math.PI / 180) * Math.cos(state[6] * Math.PI / 180) * Math.sin(((state[5] - longitude) * Math.PI / 180) / 2) ** 2
      ))
    })).filter((plane) => plane.distanceKm <= radiusKm)
      .sort((first, second) => (first.onGround === second.onGround ? 0 : first.onGround ? 1 : -1)).slice(0, 30);

    return res.json({ success: true, data: { timestamp: states.time, count: aircraft.length, aircraft, source: 'The OpenSky Network' } });
  } catch (error) {
    return res.status(error.status || 502).json({ success: false, message: error.message });
  }
}

module.exports = { weather, aircraft };