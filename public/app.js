// ===== Config / endpoints (same-origin) =====
const ENDPOINTS = {
  trips: '/api/trips',
  airports: '/api/airports',
  flights: '/api/search-flights'
};

// ===== Elements =====
const cardsContainer = document.getElementById('cardsContainer');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const categorySelect = document.getElementById('categorySelect');
const resetBtn = document.getElementById('resetBtn');
const popularBtn = document.getElementById('popularBtn');

const FF = {
  source: document.getElementById('ff-source'),
  dest: document.getElementById('ff-destination'),
  date: document.getElementById('ff-date'),
  btn: document.getElementById('ff-search'),
  results: document.getElementById('ff-results')
};

const toastEl = document.getElementById('toast');
function toast(msg, ms = 2000) {
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
  setTimeout(() => (toastEl.style.display = 'none'), ms);
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

// ===== Trips =====
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
        </div>
      </div>
    </div>
  `;
}

function renderTrips(raw) {
  // backend may return {data:[],meta:{}} or []
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

// UI events for trips
searchBtn?.addEventListener('click', runSearch);
categorySelect?.addEventListener('change', runSearch);
popularBtn?.addEventListener('click', async () => {
  await loadTrips({ q: 'popular' });
});
resetBtn?.addEventListener('click', async () => {
  searchInput.value = '';
  categorySelect.value = '';
  await loadTrips();
});

// Card-level flight button to prefill destination
cardsContainer?.addEventListener('click', (e) => {
  const btn = e.target.closest('.flight-btn');
  if (!btn) return;
  const destName = btn.dataset.name || '';
  FF.dest.value = destName;
  window.scrollTo({ top: FF.dest.getBoundingClientRect().top + window.scrollY - 100, behavior: 'smooth' });
});

// ===== Flights =====
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
      ${list.map(f => `
        <div style="background:#fff;color:#000;border-radius:12px;padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
            <strong>${f.carrier}</strong>
            <span>${f.source} → ${f.destination}</span>
            <span>Departs: ${f.departure}</span>
            <span>Duration: ${f.duration}</span>
            <span>Price: $${f.price}</span>
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

// ===== Boot =====
loadTrips();
