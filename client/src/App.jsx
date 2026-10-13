import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';

function getStoredAuth() {
  try {
    const saved = localStorage.getItem('fms-auth');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function RoleBadge({ role }) {
  const label = role === 'admin' ? 'Admin Access' : role === 'user' ? 'Member Access' : 'Guest Access';
  return <span className={`role-badge ${role === 'admin' ? 'admin' : role === 'user' ? 'user' : 'guest'}`}>{label}</span>;
}

const weatherLabels = {
  temperature_2m: 'Temperature',
  apparent_temperature: 'Feels like',
  relative_humidity_2m: 'Humidity',
  wind_speed_10m: 'Wind',
  precipitation: 'Precipitation',
  cloud_cover: 'Cloud cover'
};

const seatColumns = ['A', 'B', 'C', 'D', 'E', 'F'];

function buildCabinSeats(flight, seatClass) {
  if (!flight) return [];
  const business = seatClass.toLowerCase() === 'business';
  const cabin = business ? 'B' : 'E';
  const capacity = Number(business ? flight.businessSeats : flight.economySeats) || 0;
  const available = Number(business ? flight.availableBusinessSeats : flight.availableEconomySeats) || 0;
  const reserved = (flight.reservedSeats || []).filter((seat) => seat.seatClass === seatClass.toLowerCase());
  const occupied = new Set(reserved.map((seat) => seat.seatNumber));
  const legacyReservedCount = Math.max(0, capacity - available - reserved.length);

  return Array.from({ length: capacity }, (_, index) => {
    const label = `${Math.floor(index / seatColumns.length) + 1}${seatColumns[index % seatColumns.length]}`;
    const number = `${cabin}-${label}`;
    return { number, label, occupied: occupied.has(number) || index < legacyReservedCount };
  });
}

function OperationsPanel({ api }) {
  const [locationQuery, setLocationQuery] = useState('London');
  const [weather, setWeather] = useState(null);
  const [aircraft, setAircraft] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const loadOperations = async (event) => {
    event?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const weatherResponse = await api(`/api/external/weather?location=${encodeURIComponent(locationQuery)}`);
      const weatherData = weatherResponse.data;
      setWeather(weatherData);
      const aircraftResponse = await api(`/api/external/aircraft?latitude=${weatherData.location.latitude}&longitude=${weatherData.location.longitude}`);
      setAircraft(aircraftResponse.data.aircraft || []);
      setUpdatedAt(new Date());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const current = weather?.current;
  const units = weather?.units || {};

  return (
    <section className="operations-panel" aria-labelledby="operations-title">
      <div className="operations-heading">
        <div>
          <p className="badge">Live External Data</p>
          <h2 id="operations-title">Weather &amp; nearby air traffic</h2>
          <p>Current local conditions and aircraft positions reported around the selected area.</p>
        </div>
        <form className="operations-search" onSubmit={loadOperations}>
          <label htmlFor="operations-location">Location</label>
          <div className="operations-search-controls">
            <input id="operations-location" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder="City or region" minLength="2" maxLength="100" required />
            <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Search'}</button>
          </div>
        </form>
      </div>

      {error ? <div className="operations-error" role="status">{error}</div> : null}
      {loading && !weather ? <p className="muted">Loading current conditions...</p> : null}
      {!weather && !loading ? <p className="muted operations-prompt">Search a city or region to load current weather and nearby aircraft.</p> : null}

      {weather ? (
        <div className="operations-grid">
          <section className="weather-summary" aria-label="Current weather">
            <div className="weather-place">
              <div>
                <h3>{weather.location.name}</h3>
                <p>{[weather.location.region, weather.location.country].filter(Boolean).join(', ')}</p>
              </div>
              <span className="weather-condition">{weather.condition}</span>
            </div>
            <strong className="weather-temperature">{current?.temperature_2m ?? '--'}{units.temperature_2m || '°C'}</strong>
            <div className="weather-metrics">
              {Object.entries(weatherLabels).filter(([key]) => key !== 'temperature_2m').map(([key, label]) => (
                <div className="weather-metric" key={key}>
                  <span>{label}</span>
                  <strong>{current?.[key] ?? '--'} {units[key] || ''}</strong>
                </div>
              ))}
            </div>
            <p className="data-attribution">Weather by Open-Meteo</p>
          </section>

          <section className="traffic-summary" aria-label="Nearby aircraft">
            <div className="traffic-heading">
              <div>
                <h3>Nearby aircraft</h3>
                <p>{aircraft.length} tracked within approximately 40 km</p>
              </div>
              <span className="live-indicator">LIVE</span>
            </div>
            <div className="traffic-list">
              {aircraft.length ? aircraft.slice(0, 8).map((plane) => (
                <div className="traffic-row" key={plane.icao24}>
                  <div>
                    <strong>{plane.callsign}</strong>
                    <span>{plane.country || 'Unknown origin'}</span>
                  </div>
                  <div className="traffic-meta">
                    <span>{plane.onGround ? 'On ground' : `${Math.round((plane.altitudeMeters || 0) * 3.28084).toLocaleString()} ft`}</span>
                    <span>{plane.speedMetersPerSecond == null ? '--' : `${Math.round(plane.speedMetersPerSecond * 1.94384)} kt`}</span>
                  </div>
                </div>
              )) : <p className="muted">No aircraft are currently visible in this area.</p>}
            </div>
            <p className="data-attribution">Aircraft data by The OpenSky Network{updatedAt ? ` · Updated ${updatedAt.toLocaleTimeString()}` : ''}</p>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function Navbar({ auth, onLogout, theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="nav-bar">
      <Link to="/" className="nav-brand" onClick={() => setMenuOpen(false)}>SkyRoute</Link>
      <button className="nav-toggle print-hide" onClick={() => setMenuOpen((prev) => !prev)} type="button">☰</button>
      <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
        <Link to="/" className="nav-link" onClick={() => setMenuOpen(false)}>Home</Link>
        <Link to="/booking" className="nav-link" onClick={() => setMenuOpen(false)}>Book</Link>
        <Link to="/bookings" className="nav-link" onClick={() => setMenuOpen(false)}>My Bookings</Link>
        <Link to="/profile" className="nav-link" onClick={() => setMenuOpen(false)}>Profile</Link>
        {auth?.user?.role === 'admin' ? (
          <Link to="/admin" className="nav-link" onClick={() => setMenuOpen(false)}>Admin</Link>
        ) : (
          <Link to="/admin/auth" className="nav-link" onClick={() => setMenuOpen(false)}>Admin Access</Link>
        )}
        <button className="nav-link nav-button theme-toggle" onClick={() => { onToggleTheme(); setMenuOpen(false); }} type="button">{theme === 'dark' ? '☀️' : '🌙'}</button>
        {auth ? <button className="nav-link nav-button" onClick={() => { onLogout(); setMenuOpen(false); }} type="button">Logout</button> : null}
      </div>
    </nav>
  );
}

function HomePage({ auth, api }) {
  return (
    <div className="page">
      <header className="hero">
        <div>
          <div className="hero-top">
            <p className="badge">Interactive Flight Management</p>
            <RoleBadge role={auth?.user?.role || 'guest'} />
          </div>
          <h1>Book flights, manage reservations, and oversee operations</h1>
          <p>Designed for travelers who want a smooth booking journey and admins who need a powerful control panel.</p>
          <div className="actions">
            <Link to="/booking" className="btn primary">Book a Flight</Link>
            <Link to="/bookings" className="btn secondary">View My Bookings</Link>
            {auth?.user?.role === 'admin' ? <Link to="/admin" className="btn secondary">Admin Dashboard</Link> : <Link to="/admin/auth" className="btn secondary">Admin Sign In</Link>}
          </div>
        </div>
      </header>

      <OperationsPanel api={api} />

      <section className="feature-grid">
        <div className="feature-card card">
          <h3>For Travelers</h3>
          <p>Browse available flights, filter by route and price, and confirm seats in seconds.</p>
          <Link to="/booking" className="btn secondary">Open Booking Page</Link>
        </div>
        <div className="feature-card card">
          <h3>For Admins</h3>
          <p>Create flights, update schedules, manage bookings, and monitor operations from one panel.</p>
          <Link to="/admin/auth" className="btn secondary">Create Admin Account</Link>
        </div>
      </section>
    </div>
  );
}

function TicketPage({ auth, api }) {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add('ticket-print');
    return () => document.body.classList.remove('ticket-print');
  }, []);

  useEffect(() => {
    let active = true;
    api(`/api/bookings/${encodeURIComponent(id)}/ticket`)
      .then((response) => { if (active) setTicket(response.data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, api]);

  if (!auth) return <Navigate to="/login" replace />;

  return (
    <div className="page ticket-page">
      <header className="ticket-page-heading print-hide">
        <div>
          <p className="badge">SkyRoute E-Ticket</p>
          <h1>Your travel document</h1>
        </div>
        <div className="actions">
          <Link className="btn secondary" to="/bookings">My Bookings</Link>
          <button className="btn primary" onClick={() => window.print()} type="button">Print Ticket</button>
        </div>
      </header>
      {loading ? <section className="card"><p className="muted">Loading ticket details...</p></section> : null}
      {error ? <section className="card ticket-error" role="alert"><h2>Ticket unavailable</h2><p>{error}</p><Link to="/bookings" className="btn secondary">Back to My Bookings</Link></section> : null}
      {ticket ? (
        <article className="ticket-card" aria-label="Electronic flight ticket">
          <header className="ticket-topline">
            <div>
              <p className="ticket-kicker">Electronic ticket</p>
              <h2>{ticket.airline} <span>{ticket.flightNumber}</span></h2>
            </div>
            <span className={`ticket-status ${ticket.bookingStatus?.toLowerCase()}`}>{ticket.bookingStatus}</span>
          </header>
          <section className="ticket-route" aria-label="Flight route">
            <div className="ticket-city">
              <span className="ticket-code">{ticket.fromAirport}</span>
              <strong>{ticket.from}</strong>
              <span>{ticket.departureDate} · {ticket.departureTime}</span>
            </div>
            <div className="ticket-route-line" aria-hidden="true"><span>✈</span></div>
            <div className="ticket-city destination">
              <span className="ticket-code">{ticket.toAirport}</span>
              <strong>{ticket.to}</strong>
              <span>{ticket.arrivalDate} · {ticket.arrivalTime}</span>
            </div>
          </section>
          <section className="ticket-details">
            <div className="ticket-field passenger-field"><span>Passenger</span><strong>{ticket.passengerName}</strong></div>
            <div className="ticket-field primary-ticket-field"><span>Booking reference</span><strong>{ticket.bookingReference}</strong></div>
            <div className="ticket-field primary-ticket-field"><span>PNR</span><strong>{ticket.PNR || 'Pending'}</strong></div>
            <div className="ticket-field"><span>Seat{ticket.selectedSeats?.length === 1 ? '' : 's'}</span><strong>{ticket.selectedSeats?.map((seat) => seat.slice(2)).join(', ') || 'Not assigned'}</strong></div>
            <div className="ticket-field"><span>Class</span><strong>{ticket.seatClass}</strong></div>
            <div className="ticket-field"><span>Passengers</span><strong>{ticket.numberOfPassengers}</strong></div>
            <div className="ticket-field"><span>Baggage</span><strong>{ticket.baggageAllowance}</strong></div>
            <div className="ticket-field"><span>Payment</span><strong>{ticket.paymentStatus}</strong></div>
            <div className="ticket-field"><span>Total paid</span><strong>{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(ticket.totalAmount || 0)}</strong></div>
          </section>
          <footer className="ticket-footer"><span>Keep this ticket available for your journey.</span><span>SkyRoute · {ticket.bookingReference}</span></footer>
        </article>
      ) : null}
    </div>
  );
}

function BookingPage({ auth, api, setMessage }) {
  const [flights, setFlights] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [step, setStep] = useState(() => new URLSearchParams(window.location.search).get('flight') ? 2 : 1);
  const [confirmation, setConfirmation] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookingForm, setBookingForm] = useState({
    passengerName: '',
    email: '',
    phone: auth?.user?.phone || '',
    flightId: '',
    seatCount: '1',
    travelClass: 'Economy'
  });
  const navigate = useNavigate();

  const loadFlights = async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (maxPriceFilter) params.set('maxPrice', maxPriceFilter);
      const data = await api(`/api/flights?${params.toString()}`);
      setFlights(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadBookings = async () => {
    if (!auth) {
      setBookings([]);
      return;
    }
    try {
      const response = await api('/api/bookings/me');
      const data = response.data || response;
      setBookings(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    loadFlights();
    loadBookings();
  }, [searchQuery, statusFilter, maxPriceFilter]);

  useEffect(() => {
    const selectedFlightId = new URLSearchParams(window.location.search).get('flight');
    if (selectedFlightId && flights.length) {
      const flight = flights.find((entry) => String(entry._id) === selectedFlightId);
      if (flight) {
        setSelectedFlight(flight);
        setBookingForm((current) => ({ ...current, flightId: String(flight._id) }));
      }
    }
  }, [flights]);

  const chooseFlight = (flight) => {
    setSelectedFlight(flight);
    setSelectedSeats([]);
    setBookingForm((current) => ({ ...current, flightId: String(flight._id) }));
    setStep(2);
    window.history.replaceState({}, '', `/booking?flight=${encodeURIComponent(flight._id)}`);
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    const passengerCount = Number(bookingForm.seatCount);
    if (selectedSeats.length !== passengerCount) {
      setMessage(`Select ${passengerCount} seat${passengerCount === 1 ? '' : 's'} before confirming.`);
      return;
    }
    try {
      const payload = {
        ...bookingForm,
        contactDetails: { email: bookingForm.email, phone: bookingForm.phone },
        seatCount: passengerCount,
        selectedSeats,
        userId: auth?.user?.id || undefined,
        userName: auth?.user?.username || undefined
      };
      if (!auth) {
        setMessage('Please sign in before booking a flight.');
        return;
      }
      const createdResponse = await api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const created = createdResponse.data || createdResponse;
      const paymentResponse = await api('/api/payments/process', {
        method: 'POST',
        body: JSON.stringify({ bookingId: created._id, amount: created.totalAmount, paymentMethod })
      });
      const data = paymentResponse.data?.booking;
      if (!data?._id) throw new Error('Payment succeeded, but ticket details could not be loaded. Check My Bookings.');
      const passengerName = data.passengers?.map((passenger) => `${passenger.firstName} ${passenger.lastName}`).join(', ') || bookingForm.passengerName;
      setMessage(`Booking confirmed for ${passengerName}.`);
      setConfirmation({
        bookingId: data._id,
        passengerName,
        bookingReference: data.bookingReference,
        PNR: data.PNR,
        airline: data.flight?.airline || selectedFlight?.airline,
        flightNumber: data.flight?.flightNumber || selectedFlight?.flightNumber,
        from: data.flight?.from || selectedFlight?.origin,
        fromCode: data.flight?.fromCode,
        to: data.flight?.to || selectedFlight?.destination,
        toCode: data.flight?.toCode,
        departureDate: data.flight?.departureDate,
        departureTime: data.flight?.departureTime,
        arrivalDate: data.flight?.arrivalDate,
        arrivalTime: data.flight?.arrivalTime,
        passengerCount: data.numberOfPassengers,
        seatClass: data.seatClass,
        selectedSeats: data.selectedSeats || selectedSeats,
        totalAmount: data.totalAmount,
        paymentStatus: data.paymentStatus
      });
      setBookingForm({ passengerName: '', email: '', phone: auth?.user?.phone || '', flightId: '', seatCount: '1', travelClass: 'Economy' });
      setSelectedFlight(null);
      setStep(1);
      window.history.replaceState({}, '', '/booking');
      loadFlights();
      loadBookings();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="page">
      <header className="hero small">
        <div>
          <p className="badge">User Booking Center</p>
          <h1>Reserve seats with a simple guided flow</h1>
          <p>Search flights, choose your route, and confirm your booking instantly.</p>
          <div className="actions">
            <Link to="/bookings" className="btn secondary">View My Bookings</Link>
            {auth ? <Link to="/" className="btn primary">Back Home</Link> : <Link to="/login" className="btn primary">Sign In</Link>}
          </div>
        </div>
      </header>

      <section className="grid">
        <div className="card">
          <div className="section-head">
            <h2>Available Flights</h2>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search airline or route" />
          </div>
          <div className="filter-row">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Delayed">Delayed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <input type="number" min="0" value={maxPriceFilter} onChange={(e) => setMaxPriceFilter(e.target.value)} placeholder="Max price" />
          </div>
          <div className="flight-list">
            {flights.map((flight) => (
              <div key={flight._id} className="flight-item">
                <div>
                  <h3>{flight.airline} {flight.flightNumber}</h3>
                  <p>{flight.origin} → {flight.destination}</p>
                  <p>{flight.departureTime} - {flight.arrivalTime}</p>
                </div>
                <div className="meta">
                  <span>${flight.price}</span>
                  <span>{flight.seatsAvailable} seats</span>
                  <span>{flight.status}</span>
                  <button className="btn secondary compact-btn" onClick={() => chooseFlight(flight)} type="button">Select</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>{step === 1 ? 'Step 1: Choose Flight' : 'Step 2: Passenger Details'}</h2>
          <div className="step-indicator">
            <span className={step >= 1 ? 'active' : ''}>1</span>
            <span className={step >= 2 ? 'active' : ''}>2</span>
          </div>
          {step === 1 ? (
            <p className="muted">Pick a flight from the list to start your reservation. Sign in is required before payment.</p>
          ) : (
            <form onSubmit={handleBookingSubmit} className="form">
              {selectedFlight ? <div className="selected-flight"><strong>{selectedFlight.airline} {selectedFlight.flightNumber}</strong><span>{selectedFlight.origin} → {selectedFlight.destination}</span><span>${selectedFlight.price} · {selectedFlight.seatsAvailable} seats available</span></div> : null}
              <input value={bookingForm.passengerName} onChange={(e) => setBookingForm({ ...bookingForm, passengerName: e.target.value })} placeholder="Passenger Name" required />
              <input type="email" value={bookingForm.email} onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })} placeholder="Email" required />
              <input type="tel" value={bookingForm.phone} onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })} placeholder="Contact Phone" required />
              <select value={bookingForm.flightId} onChange={(e) => { const flight = flights.find((entry) => String(entry._id) === e.target.value); setSelectedFlight(flight || null); setSelectedSeats([]); setBookingForm((current) => ({ ...current, flightId: e.target.value })); }} required>
                <option value="">Select Flight</option>
                {flights.map((flight) => (
                  <option key={flight._id} value={flight._id}>{flight.airline} - {flight.flightNumber}</option>
                ))}
              </select>
              <label className="field-label" htmlFor="passenger-count">Passengers</label>
              <input id="passenger-count" type="number" min="1" max="9" value={bookingForm.seatCount} onChange={(e) => { setBookingForm({ ...bookingForm, seatCount: e.target.value }); setSelectedSeats([]); }} placeholder="Passengers" required />
              <label className="field-label" htmlFor="travel-class">Travel class</label>
              <select id="travel-class" value={bookingForm.travelClass} onChange={(e) => { setBookingForm({ ...bookingForm, travelClass: e.target.value }); setSelectedSeats([]); }}>
                <option>Economy</option>
                <option>Business</option>
              </select>
              {selectedFlight ? (
                <fieldset className="seat-picker">
                  <legend>Choose {bookingForm.travelClass} seats</legend>
                  <div className="seat-legend">
                    <span><i className="seat-key available" /> Available</span>
                    <span><i className="seat-key chosen" /> Selected</span>
                    <span><i className="seat-key occupied" /> Occupied</span>
                  </div>
                  <div className="seat-map" aria-label={`${bookingForm.travelClass} seat map`}>
                    {buildCabinSeats(selectedFlight, bookingForm.travelClass).map((seat) => {
                      const chosen = selectedSeats.includes(seat.number);
                      return <button key={seat.number} className={`seat-button${chosen ? ' chosen' : ''}${seat.occupied ? ' occupied' : ''}`} type="button" disabled={seat.occupied} aria-pressed={chosen} aria-label={`Seat ${seat.label}${seat.occupied ? ', occupied' : chosen ? ', selected' : ', available'}`} onClick={() => setSelectedSeats((current) => chosen ? current.filter((number) => number !== seat.number) : current.length < Number(bookingForm.seatCount) ? [...current, seat.number] : current)}>{seat.label}</button>;
                    })}
                  </div>
                  <p className="seat-selection-count" aria-live="polite">Selected: {selectedSeats.map((seat) => seat.slice(2)).join(', ') || 'none'} ({selectedSeats.length}/{bookingForm.seatCount})</p>
                </fieldset>
              ) : null}
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option>UPI</option>
                <option>Credit Card</option>
                <option>Debit Card</option>
                <option>Net Banking</option>
              </select>
              <div className="actions">
                <button className="btn secondary" onClick={() => { setSelectedFlight(null); setStep(1); window.history.replaceState({}, '', '/booking'); }} type="button">Back</button>
                <button className="btn primary" type="submit" disabled={!selectedFlight || selectedSeats.length !== Number(bookingForm.seatCount)}>Confirm Booking</button>
              </div>
            </form>
          )}
        </div>
      </section>

      {confirmation ? (
        <div className="confirmation-backdrop" role="presentation">
          <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
            <div className="confirmation-header">
              <div>
                <p className="badge">Payment Confirmed</p>
                <h2 id="confirmation-title">Your ticket is ready</h2>
              </div>
              <button className="ticket-close print-hide" onClick={() => setConfirmation(null)} type="button" aria-label="Close confirmation">×</button>
            </div>
            <div className="confirmation-route">
              <div><span>{confirmation.fromCode}</span><strong>{confirmation.from}</strong><small>{confirmation.departureDate} · {confirmation.departureTime}</small></div>
              <span className="confirmation-arrow" aria-hidden="true">→</span>
              <div><span>{confirmation.toCode}</span><strong>{confirmation.to}</strong><small>{confirmation.arrivalDate} · {confirmation.arrivalTime}</small></div>
            </div>
            <div className="confirmation-details">
              <div><span>Passenger</span><strong>{confirmation.passengerName}</strong></div>
              <div><span>Flight</span><strong>{confirmation.airline} {confirmation.flightNumber}</strong></div>
              <div><span>Booking reference</span><strong>{confirmation.bookingReference}</strong></div>
              <div><span>PNR</span><strong>{confirmation.PNR}</strong></div>
              <div><span>Passengers · class</span><strong>{confirmation.passengerCount} · {confirmation.seatClass}</strong></div>
              <div><span>Selected seats</span><strong>{confirmation.selectedSeats?.map((seat) => seat.slice(2)).join(', ') || 'Not assigned'}</strong></div>
              <div><span>Total paid</span><strong>{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(confirmation.totalAmount || 0)}</strong></div>
            </div>
            <div className="actions confirmation-actions">
              <button className="btn primary" onClick={() => navigate(`/ticket/${confirmation.bookingId}`)} type="button">View E-Ticket</button>
              <button className="btn secondary" onClick={() => setConfirmation(null)} type="button">Continue</button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="card inventory-card">
        <h2>Your Recent Bookings</h2>
        <div className="flight-list">
          {bookings.length === 0 ? <p className="muted">No bookings yet. Start by reserving a seat.</p> : bookings.map((booking) => (
            <div key={booking._id} className="flight-item">
              <div>
                <h3>{booking.passengerName}</h3>
                <p>{booking.email}</p>
              </div>
              <div className="meta">
                <span>{booking.bookingReference} · {booking.PNR || 'PNR pending'}</span>
                <span>Seats: {booking.seatCount}</span>
                <span>{booking.travelClass}</span>
                <Link className="btn secondary compact-btn" to={`/ticket/${booking._id}`}>View Ticket</Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BookingChart({ data }) {
  const maxValue = Math.max(...data.map((entry) => entry.value), 1);

  return (
    <div className="chart-card">
      <svg viewBox="0 0 320 180" className="chart-svg" role="img" aria-label="Booking trend chart">
        <line x1="20" y1="150" x2="300" y2="150" className="chart-axis" />
        <line x1="20" y1="20" x2="20" y2="150" className="chart-axis" />
        {data.map((entry, index) => {
          const barWidth = 36;
          const gap = 22;
          const x = 40 + index * (barWidth + gap);
          const height = (entry.value / maxValue) * 100;
          const y = 150 - height;
          return (
            <g key={entry.label}>
              <rect x={x} y={y} width={barWidth} height={height} rx="6" className="chart-bar" />
              <text x={x + barWidth / 2} y="170" textAnchor="middle" className="chart-label">{entry.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ProfilePage({ auth, api, setMessage }) {
  const [bookings, setBookings] = useState([]);
  const [profile, setProfile] = useState({ name: auth?.user?.name || auth?.user?.username || '', email: auth?.user?.email || '', phone: auth?.user?.phone || '' });

  useEffect(() => {
    async function loadBookings() {
      try {
        const response = await api('/api/bookings/me');
        setBookings(response.data || response);
      } catch (error) {
        setMessage(error.message);
      }
    }

    if (auth) {
      loadBookings();
    }
  }, [auth]);

  const updateProfile = async (event) => {
    event.preventDefault();
    try {
      const response = await api('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify(profile)
      });
      setProfile(response.data || profile);
      setMessage('Profile updated successfully.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="page">
      <header className="hero small">
        <div>
          <p className="badge">Traveler Profile</p>
          <h1>Welcome, {auth.user.username}</h1>
          <p>Track your bookings and keep your travel details organized.</p>
          <div className="actions">
            <Link to="/booking" className="btn primary">Book Again</Link>
            <Link to="/" className="btn secondary">Back Home</Link>
          </div>
        </div>
      </header>

      <section className="card">
        <h2>Personal Details</h2>
        <form onSubmit={updateProfile} className="form">
          <input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Full name" required />
          <input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} placeholder="Email" required />
          <input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="Phone" />
          <button className="btn primary" type="submit">Save Profile</button>
        </form>
      </section>

      <section className="card">
        <h2>Your Booking History</h2>
        <div className="flight-list">
          {bookings.length === 0 ? <p className="muted">You have not booked any flights yet.</p> : bookings.map((booking) => (
            <div key={booking._id} className="flight-item">
              <div>
                <h3>{booking.passengerName}</h3>
                <p>{booking.email}</p>
              </div>
              <div className="meta">
                <span>Flight ID: {booking.flightId}</span>
                <span>Seats: {booking.seatCount}</span>
                <span>{booking.travelClass}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function BookingsPage({ auth, api }) {
  const [bookings, setBookings] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [message, setMessage] = useState('');

  const exportCsv = () => {
    if (!bookings.length) {
      return;
    }

    const rows = [
      ['Passenger', 'Email', 'Flight ID', 'Seats', 'Travel Class', 'Booking Date'],
      ...bookings.map((booking) => [
        booking.passengerName,
        booking.email,
        booking.flightId,
        booking.seatCount,
        booking.travelClass,
        new Date(booking.bookingDate).toLocaleString()
      ])
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bookings.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const cancelBooking = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await api(`/api/bookings/${id}/cancel`, { method: 'PUT' });
      setBookings((current) => current.map((booking) => booking._id === id ? { ...booking, bookingStatus: 'CANCELLED' } : booking));
      setMessage('Booking cancelled and seats restored.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    async function loadBookings() {
      try {
        const response = await api('/api/bookings/my-bookings');
        setBookings(response.data || response);
      } catch (error) {
        console.error(error);
      }
    }

    async function loadTrends() {
      try {
        const data = await api('/api/dashboard/booking-trends');
        setTrendData(data);
      } catch (error) {
        console.error(error);
      }
    }

    if (auth) {
      loadBookings();
    }
    if (auth?.user?.role === 'admin') {
      loadTrends();
    }
  }, [auth]);

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="page">
      {message ? <div className="message">{message}</div> : null}
      <header className="hero small">
        <div>
          <p className="badge">Booking Dashboard</p>
          <h1>Passenger reservations</h1>
          <p>Review recent ticket bookings and travel classes.</p>
          <Link to="/" className="btn secondary">Back to Flights</Link>
        </div>
      </header>

      <section className="card">
        <div className="section-head">
          <h2>Booking Trend</h2>
          <div className="actions compact">
            <button className="btn secondary print-hide" onClick={exportCsv} type="button">Export CSV</button>
            <button className="btn secondary print-hide" onClick={() => window.print()} type="button">Print Report</button>
          </div>
        </div>
        {trendData.length > 0 ? <BookingChart data={trendData} /> : <p className="muted">No booking trend data yet.</p>}
      </section>

      <section className="card">
        <h2>Recent Bookings</h2>
        <div className="flight-list">
          {bookings.map((booking) => (
            <div key={booking._id} className="flight-item">
              <div>
                <h3>{booking.passengerName}</h3>
                <p>{booking.email}</p>
              </div>
              <div className="meta">
                <span>Flight ID: {booking.flightId}</span>
                <span>Seats: {booking.seatCount}</span>
                <span>{booking.travelClass}</span>
                <span>{booking.bookingStatus || 'CONFIRMED'}</span>
                <Link className="btn secondary compact-btn" to={`/ticket/${booking._id}`}>View Ticket</Link>
                {booking.bookingStatus !== 'CANCELLED' ? <button className="btn secondary compact-btn" onClick={() => cancelBooking(booking._id)} type="button">Cancel Booking</button> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function LoginPage({ auth, onAuthSuccess, setMessage }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '' });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      }).then((res) => res.json());

      if (!payload.token) {
        throw new Error(payload.message || 'Authentication failed');
      }

      onAuthSuccess(payload);
      setMessage(`${mode === 'login' ? 'Logged in' : 'Account created'} successfully.`);
      navigate(payload.user.role === 'admin' ? '/admin' : '/');
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (auth) {
    return <Navigate to={auth.user.role === 'admin' ? '/admin' : '/'} replace />;
  }

  return (
    <div className="page">
      <div className="auth-card card">
        <div className="auth-toggle">
          <button className={mode === 'login' ? 'btn primary' : 'btn secondary'} onClick={() => setMode('login')} type="button">Login</button>
          <button className={mode === 'register' ? 'btn primary' : 'btn secondary'} onClick={() => setMode('register')} type="button">Register</button>
        </div>
        <h2>{mode === 'login' ? 'Sign in to your account' : 'Create a user account'}</h2>
        <p className="muted">Users can browse flights and confirm bookings. Admins use the dedicated admin access page.</p>
        <form onSubmit={handleSubmit} className="form">
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username or email" autoComplete="username" required />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" autoComplete="current-password" required />
          <button className="btn primary" type="submit">{mode === 'login' ? 'Log in' : 'Register'}</button>
        </form>
      </div>
    </div>
  );
}

function AdminAuthPage({ auth, onAuthSuccess, setMessage }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', password: '' });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'admin' })
      }).then((res) => res.json());

      if (!payload.token) {
        throw new Error(payload.message || 'Authentication failed');
      }

      onAuthSuccess(payload);
      setMessage(`${mode === 'login' ? 'Admin signed in' : 'Admin account created'} successfully.`);
      navigate('/admin');
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (auth?.user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="page">
      <div className="auth-card card">
        <div className="auth-toggle">
          <button className={mode === 'login' ? 'btn primary' : 'btn secondary'} onClick={() => setMode('login')} type="button">Admin Login</button>
          <button className={mode === 'register' ? 'btn primary' : 'btn secondary'} onClick={() => setMode('register')} type="button">Admin Signup</button>
        </div>
        <h2>{mode === 'login' ? 'Admin sign in' : 'Create admin access'}</h2>
        <p className="muted">Admins receive full control over flights, bookings, and analytics.</p>
        <p className="muted">Demo admin: admin / admin123</p>
        <form onSubmit={handleSubmit} className="form">
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Admin username or email" autoComplete="username" required />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" autoComplete="current-password" required />
          <button className="btn primary" type="submit">{mode === 'login' ? 'Sign in' : 'Create admin account'}</button>
        </form>
      </div>
    </div>
  );
}

function AdminPage({ auth, api, setMessage, onLogout }) {
  const [flights, setFlights] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [summary, setSummary] = useState({ totalFlights: 0, totalBookings: 0, totalSeatsBooked: 0, scheduled: 0, delayed: 0, cancelled: 0 });
  const [analytics, setAnalytics] = useState({ occupancyRate: 0, averageFare: 0, revenueEstimate: 0 });
  const [health, setHealth] = useState({ status: 'ok', mode: 'demo' });
  const [form, setForm] = useState({
    airline: '',
    flightNumber: '',
    origin: '',
    destination: '',
    departureTime: '',
    arrivalTime: '',
    price: '',
    seatsAvailable: '',
    status: 'Scheduled'
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    loadFlights();
    loadBookings();
    loadSummary();
    loadAnalytics();
    loadHealth();
  }, []);

  const loadFlights = async () => {
    try {
      const data = await api('/api/flights');
      setFlights(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadBookings = async () => {
    try {
      const data = await api('/api/bookings');
      setBookings(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await api('/api/dashboard/summary');
      setSummary(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadAnalytics = async () => {
    try {
      const data = await api('/api/dashboard/analytics');
      setAnalytics(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadHealth = async () => {
    try {
      const data = await api('/api/health');
      setHealth(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        seatsAvailable: Number(form.seatsAvailable)
      };

      if (editingId) {
        const updated = await api(`/api/flights/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage(`Flight ${updated.flightNumber} updated.`);
      } else {
        const created = await api('/api/flights', { method: 'POST', body: JSON.stringify(payload) });
        setMessage(`Flight ${created.flightNumber} created.`);
      }

      setForm({ airline: '', flightNumber: '', origin: '', destination: '', departureTime: '', arrivalTime: '', price: '', seatsAvailable: '', status: 'Scheduled' });
      setEditingId(null);
      loadFlights();
      loadSummary();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleEdit = (flight) => {
    setEditingId(flight._id);
    setForm({
      airline: flight.airline,
      flightNumber: flight.flightNumber,
      origin: flight.origin,
      destination: flight.destination,
      departureTime: flight.departureTime,
      arrivalTime: flight.arrivalTime,
      price: flight.price,
      seatsAvailable: flight.seatsAvailable,
      status: flight.status
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this flight?')) {
      return;
    }
    try {
      await api(`/api/flights/${id}`, { method: 'DELETE' });
      setMessage('Flight deleted successfully.');
      loadFlights();
      loadSummary();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const handleDeleteBooking = async (id) => {
    if (!window.confirm('Remove this booking?')) {
      return;
    }
    try {
      await api(`/api/bookings/${id}/cancel`, { method: 'PUT' });
      setMessage('Booking removed successfully.');
      loadBookings();
      loadFlights();
      loadSummary();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="page">
      <header className="hero small">
        <div>
          <p className="badge">Admin Dashboard</p>
          <h1>Welcome back, {auth?.user?.username}</h1>
          <p>Manage routes, update fares, and remove flights when needed.</p>
          <div className="actions">
            <Link to="/" className="btn secondary">Back to Home</Link>
            <button className="btn primary" onClick={onLogout} type="button">Log out</button>
          </div>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stat-card">
          <p>Total Flights</p>
          <strong>{summary.totalFlights}</strong>
        </div>
        <div className="stat-card">
          <p>Scheduled</p>
          <strong>{summary.scheduled}</strong>
        </div>
        <div className="stat-card">
          <p>Delayed</p>
          <strong>{summary.delayed}</strong>
        </div>
        <div className="stat-card">
          <p>Cancelled</p>
          <strong>{summary.cancelled}</strong>
        </div>
        <div className="stat-card wide">
          <p>Total Bookings</p>
          <strong>{summary.totalBookings}</strong>
        </div>
        <div className="stat-card wide">
          <p>Seats Booked</p>
          <strong>{summary.totalSeatsBooked}</strong>
        </div>
      </section>

      <section className="analytics-grid admin-analytics">
        <div className="analytics-card">
          <p>Occupancy Rate</p>
          <strong>{analytics.occupancyRate}%</strong>
        </div>
        <div className="analytics-card">
          <p>Average Fare</p>
          <strong>${analytics.averageFare}</strong>
        </div>
        <div className="analytics-card">
          <p>Revenue Estimate</p>
          <strong>${analytics.revenueEstimate}</strong>
        </div>
      </section>

      <section className="grid admin-grid">
        <div className="card">
          <h2>{editingId ? 'Update Flight' : 'Create Flight'}</h2>
          <form onSubmit={handleSubmit} className="form">
            <input value={form.airline} onChange={(e) => setForm({ ...form, airline: e.target.value })} placeholder="Airline" required />
            <input value={form.flightNumber} onChange={(e) => setForm({ ...form, flightNumber: e.target.value })} placeholder="Flight Number" required />
            <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="Origin" required />
            <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="Destination" required />
            <input value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} placeholder="Departure Time" required />
            <input value={form.arrivalTime} onChange={(e) => setForm({ ...form, arrivalTime: e.target.value })} placeholder="Arrival Time" required />
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" required />
            <input type="number" value={form.seatsAvailable} onChange={(e) => setForm({ ...form, seatsAvailable: e.target.value })} placeholder="Seats" required />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Scheduled</option>
              <option>Delayed</option>
              <option>Cancelled</option>
            </select>
            <div className="actions">
              <button className="btn primary" type="submit">{editingId ? 'Update Flight' : 'Create Flight'}</button>
              {editingId && <button className="btn secondary" type="button" onClick={() => { setEditingId(null); setForm({ airline: '', flightNumber: '', origin: '', destination: '', departureTime: '', arrivalTime: '', price: '', seatsAvailable: '', status: 'Scheduled' }); }}>Cancel</button>}
            </div>
          </form>
        </div>

        <div className="card">
          <h2>MongoDB Connection Guide</h2>
          <p className="muted">Current backend mode: {health.mode}</p>
          <ol className="guide-list">
            <li>Create a MongoDB Atlas cluster and database user.</li>
            <li>Allow access from 0.0.0.0/0 or your current IP.</li>
            <li>Set the connection string in the server environment file.</li>
          </ol>
          <pre className="code-block">PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/fms?retryWrites=true&w=majority
JWT_SECRET=your-secret</pre>
          <p className="muted">Restart the backend after saving the environment file.</p>
        </div>
      </section>

      <section className="card inventory-card">
        <h2>Flight Inventory</h2>
        <div className="flight-list">
          {flights.length === 0 ? (
            <p className="muted">No flights available right now.</p>
          ) : flights.map((flight) => (
            <div key={flight._id} className="flight-item admin-item">
              <div>
                <h3>{flight.airline} {flight.flightNumber}</h3>
                <p>{flight.origin} → {flight.destination}</p>
                <p>{flight.departureTime} - {flight.arrivalTime}</p>
              </div>
              <div className="meta">
                <span>${flight.price}</span>
                <span>{flight.seatsAvailable} seats</span>
                <span className={`status-pill ${flight.status.toLowerCase()}`}>{flight.status}</span>
                <div className="actions compact">
                  <button className="btn secondary" onClick={() => handleEdit(flight)} type="button">Edit</button>
                  <button className="btn primary" onClick={() => handleDelete(flight._id)} type="button">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card inventory-card">
        <h2>Booking Management</h2>
        <div className="flight-list">
          {bookings.length === 0 ? (
            <p className="muted">No bookings have been made yet.</p>
          ) : bookings.map((booking) => (
            <div key={booking._id} className="flight-item admin-item">
              <div>
                <h3>{booking.passengerName}</h3>
                <p>{booking.email}</p>
                <p>Flight ID: {booking.flightId}</p>
              </div>
              <div className="meta">
                <span>Seats: {booking.seatCount}</span>
                <span>{booking.travelClass}</span>
                <span>{new Date(booking.bookingDate).toLocaleString()}</span>
                <div className="actions compact">
                  <button className="btn primary" onClick={() => handleDeleteBooking(booking._id)} type="button">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(getStoredAuth);
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('fms-theme') || 'light');

  const handleAuthSuccess = (payload) => {
    const authData = { token: payload.token, user: payload.user };
    localStorage.setItem('fms-auth', JSON.stringify(authData));
    setAuth(authData);
  };

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark');
    document.body.classList.toggle('theme-light', theme === 'light');
    localStorage.setItem('fms-theme', theme);
  }, [theme]);

  const handleLogout = () => {
    localStorage.removeItem('fms-auth');
    setAuth(null);
    setMessage('Logged out successfully.');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const api = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (!options.body || !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (auth?.token) {
      headers.Authorization = `Bearer ${auth.token}`;
    }

    const response = await fetch(url, { ...options, headers });
    const text = await response.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  };

  return (
    <div className="app-shell">
      <Navbar auth={auth} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
      {message && <div className="message">{message}</div>}
      <Routes>
        <Route path="/" element={<HomePage auth={auth} api={api} />} />
        <Route path="/booking" element={<BookingPage auth={auth} api={api} setMessage={setMessage} />} />
        <Route path="/ticket/:id" element={auth ? <TicketPage auth={auth} api={api} /> : <Navigate to="/login" replace />} />
        <Route path="/bookings" element={<BookingsPage auth={auth} api={api} />} />
        <Route path="/profile" element={<ProfilePage auth={auth} api={api} setMessage={setMessage} />} />
        <Route path="/login" element={<LoginPage auth={auth} onAuthSuccess={handleAuthSuccess} setMessage={setMessage} />} />
        <Route path="/admin/auth" element={<AdminAuthPage auth={auth} onAuthSuccess={handleAuthSuccess} setMessage={setMessage} />} />
        <Route path="/admin" element={auth?.user?.role === 'admin' ? <AdminPage auth={auth} api={api} setMessage={setMessage} onLogout={handleLogout} /> : <Navigate to="/admin/auth" replace />} />
      </Routes>
    </div>
  );
}

export default App;
