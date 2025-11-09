// ===== Endpoints =====
const ENDPOINTS = {
  trips: '/api/trips',
  airports: '/api/airports',
  flights: '/api/search-flights',
  bookings: '/api/bookings'
};

// ===== Elements ===== (you likely already have most of these)
const cardsContainer = document.getElementById('cardsContainer');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const categorySelect = document.getElementById('categorySelect');
const resetBtn = document.getElementById('resetBtn');
const popularBtn = document.getElementById('popularBtn');

// Flights UI
const FF = {
  source: document.getElementById('ff-source'),
  dest: document.getElementById('ff-destination'),
  date: document.getElementById('ff-date'),
  btn: document.getElementById('ff-search'),
  results: document.getElementById('ff-results')
};

// Toast
const toastEl = document.getElementById('toast');
function toast(msg, ms = 2000) {
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
  setTimeout(() => (toastEl.style.display = 'none'), ms);
}

// ===== Booking Panel Elements =====
const BK = {
  panel: document.getElementById('booking-panel'),
  form: document.getElementById('booking-form'),
  name: document.getElementById('bk-name'),
  email: document.getElementById('bk-email'),
  phone: document.getElementById('bk-phone'),
  travelers: document.getElementById('bk-travelers'),
  notes: document.getElementById('bk-notes'),
  tripId: document.getElementById('bk-tripId'),

  fCarrier: document.getElementById('bk-flight-carrier'),
  fRoute: document.getElementById('bk-flight-route'),
  fDate: document.getElementById('bk-flight-date'),
  fDeparture: document.getElementById('bk-flight-departure'),
  fDuration: document.getElementById('bk-flight-duration'),
  fPrice: document.getElementById('bk-flight-price'),

  cancel: document.getElementById('bk-cancel')
};

function openBookingPanel() {
  BK.panel.style.display = 'block';
  window.scrollTo({ top: BK.panel.offsetTop - 80, behavior: 'smooth' });
}
function closeBookingPanel() {
  BK.panel.style.display = 'none';
  BK.form.reset();
  // clear readonly details
  BK.tripId.value = '';
  BK.fCarrier.value = '';
  BK.fRoute.value = '';
  BK.fDate.value = '';
  BK.fDeparture.value = '';
  BK.fDuration.value = '';
  BK.fPrice.value = '';
}

// ===== API helpers =====
async function apiGet(url, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${url}${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`GET ${url} ${res.status}`);
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let msg = '';
    try { msg = await res.text(); } catch {}
    throw new Error(`POST ${url} ${res.status} ${msg}`);
  }
  return res.json();
}

// ===== Trips (unchanged rendering, but add a Book button) =====
function tripCard(t) {
  const stars = '★'.repeat(Math.round(t.rating || 5));
  return `
    <div class="card">
      <img src="${t.imageUrl}" alt="${t.name}">
      <div class="card-content">
        <h3>${t.name}</h3>
        <p class="stars">${stars}</p>
        <p style="font-size:14px;color:#444;margin-top:8px;">${t.description || ''}</p>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn flight-btn" data-name="${t.name}">Flights</button>
          <button class="btn book-trip-btn" data-id="${t._id}">Book Trip</button>
        </div>
      </div>
    </div>
  `;
}

function renderTrips(raw) {
  const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
  cardsContainer.innerHTML = list.length ? list.map(tripCard).join('') : '<p>No trips found.</p>';
}

async function loadTrips(params = {}) {
  try {
    const data = await apiGet(ENDPOINTS.trips, params);
    renderTrips(data);
  } catch (e) {
    console.error(e);
    toast('Could not load trips');
  }
}

async function runSearch() {
  const q = searchInput.value.trim();
  const category = categorySelect.value;
  const params = {};
  if (q) params.q = q;
  if (category) params.category = category;
  await loadTrips(params);
}

searchBtn?.addEventListener('click', runSearch);
categorySelect?.addEventListener('change', runSearch);
popularBtn?.addEventListener('click', async () => { await loadTrips({ q: 'popular' }); });
resetBtn?.addEventListener('click', async () => {
  searchInput.value = '';
  categorySelect.value = '';
  await loadTrips();
});

// ===== Flights (existing) =====
async function searchFlights({ source, destination, departureDate }) {
  return apiPost(ENDPOINTS.flights, { source, destination, departureDate });
}

function renderFlights(list) {
  if (!Array.isArray(list) || list.length === 0) {
    FF.results.innerHTML = `<p>No flights found.</p>`;
    return;
  }
  FF.results.innerHTML = `
    <div style="display:grid;gap:12px;">
      ${list.map((f, idx) => `
        <div style="background:#fff;color:#000;border-radius:12px;padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <strong>${f.carrier}</strong>
            <span>${f.source} → ${f.destination}</span>
            <span>Departs: ${f.departure}</span>
            <span>Duration: ${f.duration}</span>
            <span>Price: $${f.price}</span>
            <button class="btn book-flight-btn"
              data-carrier="${f.carrier}"
              data-source="${f.source}"
              data-destination="${f.destination}"
              data-departure="${f.departure}"
              data-duration="${f.duration}"
              data-price="${f.price}"
              data-date="${FF.date.value}"
            >Book</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

FF?.btn?.addEventListener('click', async () => {
  const source = FF.source.value.trim();
  const destination = FF.dest.value.trim();
  const departureDate = FF.date.value;

  if (!source || !destination || !departureDate) {
    toast('Please fill source, destination and date');
    return;
  }

  try {
    FF.btn.disabled = true;
    FF.btn.textContent = 'Searching...';
    const flights = await searchFlights({ source, destination, departureDate });
    renderFlights(flights);
    toast('Flights loaded');
  } catch (e) {
    console.error(e);
    toast('Flight search failed');
    FF.results.innerHTML = `<pre style="white-space:pre-wrap">${e.message}</pre>`;
  } finally {
    FF.btn.disabled = false;
    FF.btn.textContent = 'Search Flights';
  }
});

// ===== Booking interactions =====

// Open booking from a Trip card
cardsContainer?.addEventListener('click', (e) => {
  const btn = e.target.closest('.book-trip-btn');
  if (!btn) return;
  const tripId = btn.dataset.id;
  closeBookingPanel();
  BK.tripId.value = tripId;
  openBookingPanel();
});

// Open booking from a Flight result
FF.results?.addEventListener('click', (e) => {
  const btn = e.target.closest('.book-flight-btn');
  if (!btn) return;

  closeBookingPanel();
  // Prefill flight info
  BK.fCarrier.value = btn.dataset.carrier || '';
  BK.fRoute.value = `${btn.dataset.source || ''} → ${btn.dataset.destination || ''}`;
  BK.fDate.value = btn.dataset.date || '';
  BK.fDeparture.value = btn.dataset.departure || '';
  BK.fDuration.value = btn.dataset.duration || '';
  BK.fPrice.value = btn.dataset.price || '';
  openBookingPanel();
});

// Submit booking to API
BK.form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    name: BK.name.value.trim(),
    email: BK.email.value.trim(),
    phone: BK.phone.value.trim(),
    travelers: Number(BK.travelers.value || 1),
    notes: BK.notes.value.trim()
  };

  // include tripId if present
  if (BK.tripId.value) payload.tripId = BK.tripId.value;

  // include flight if any flight fields exist
  if (BK.fCarrier.value || BK.fRoute.value) {
    const [source, destination] = (BK.fRoute.value || '').split('→').map(s => (s || '').trim());
    payload.flight = {
      carrier: BK.fCarrier.value || '',
      source,
      destination,
      date: BK.fDate.value || '',
      departure: BK.fDeparture.value || '',
      duration: BK.fDuration.value || '',
      price: Number(BK.fPrice.value || 0)
    };
  }

  if (!payload.name || !payload.email) {
    toast('Name and email are required');
    return;
  }

  try {
    await apiPost(ENDPOINTS.bookings, payload);
    toast('✅ Booking submitted!');
    closeBookingPanel();
  } catch (err) {
    console.error(err);
    toast('Booking failed');
  }
});

// Cancel
BK.cancel?.addEventListener('click', closeBookingPanel);

// ===== Boot =====
loadTrips();
