# Flight Booking Backend

This backend uses Express, Mongoose, JWT, bcryptjs, and a simulated payment flow. Copy `server/.env.example` to `server/.env`, then paste your local Compass connection string into `MONGO_URI`; the database name is `flight_booking_system`.

## Commands

From the repository root:

```powershell
npm install
npm run seed
npm run dev
```

Open MongoDB Compass and connect with the same `MONGO_URI`. The seed creates 30 flights and the `admin@skyroute.local` admin account with password `admin123`. The seed and server require MongoDB to be running. Production deployments should use a MongoDB replica set or Atlas for transactional payment seat updates.

The React client runs at `http://localhost:3000` and the API runs at `http://localhost:5000`. The client proxy is configured in `client/vite.config.js`.

If the default API port is already occupied, set `API_PORT` to a free port; it takes precedence over `PORT`. To point the Vite client at that port, set `API_PROXY_TARGET` to its base URL before starting Vite.

## External data

The home page can look up current weather through Open-Meteo and nearby live aircraft through the OpenSky Network. Weather and anonymous OpenSky access do not require API keys. For authenticated OpenSky access and a higher request quota, create an API client in your OpenSky account and set `OPEN_SKY_CLIENT_ID` and `OPEN_SKY_CLIENT_SECRET` in `server/.env`; the backend refreshes the OAuth token automatically. Keep those credentials on the server and never add them to the client environment.

The integration endpoints are `GET /api/external/weather?location=London` and `GET /api/external/aircraft?latitude=51.5&longitude=-0.12`. OpenSky returns aircraft transmitting within roughly 40 km of the selected location; availability depends on receiver coverage and its API limits.
