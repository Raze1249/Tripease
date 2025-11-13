// public/app.js
// Tripease frontend: full app script including trips, destinations, flights, hotels, booking, auth.
// Ensure this file is loaded after the DOM (or it uses DOMContentLoaded below).

/* ============================
   API Endpoints (server proxies)
   ============================ */
const API = {
  trips: '/api/trips',
  flights: '/api/search-flights',
  bookings: '/api/bookings',
  destinations: '/api/destinations',
  hotels: '/api/hotels',
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    logout: '/api/auth/logout',
    me: '/api/auth/me'
  }
};

/* ============================
   Helpers
   ============================ */
const $ = id => document.getElementById(id);
const buildUrl = (u, q = {}) => u + (Object.keys(q).length ? `?${new URLSearchParams(q)}` : '');
const get = (u, q = {}) => fetch(buildUrl(u, q)).then(r => r.json());
const post = (u, b, cred = false) =>
  fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), ...(cred ? { credentials: 'include' } : {}) })
    .then(async r => {
      if (!r.ok) {
        const t = await r.text().catch(() => null);
        throw new Error(t || `HTTP ${r.status}`);
      }
      return r.json().catch(() => ({}));
    });

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

function toast(message, ms = 1600) {
  const el = $('toast');
  if (!el) {
    // fallback to alert if toast element missing
    console.log('TOAST:', message);
    return;
  }
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, ms);
}

/* ============================
   DOM Ready Initialization
   ============================ */
document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------
     Element references (defensive)
     --------------------------- */
  const toastEl = $('toast');

  // Auth elements (optional)
  const A = {
    userEl: $('auth-user'),
    btnLogin: $('btn-login'),
    btnRegister: $('btn-register'),
    btnLogout: $('btn-logout'),
    mLogin: $('modal-login'),
    mRegister: $('modal-register'),
    loginEmail: $('login-email'),
    loginPass: $('login-pass'),
    loginSubmit: $('login-submit'),
    loginCancel: $('login-cancel'),
    regName: $('reg-name'),
    regEmail: $('reg-email'),
    regPass: $('reg-pass'),
    regSubmit: $('reg-submit'),
    regCancel: $('reg-cancel')
  };

  // Popular / Suggested
  const popularGrid = $('popularGrid');
  const popularPanel = $('popular-panel');
  const suggestedWrap = $('suggestedContainer');

  // Trips UI & search
  const cards = $('cardsContainer');
  const qIn = $('searchInput');
  const qBtn = $('searchBtn');
  const cat = $('categorySelect');
  const reset = $('resetBtn');

  // Flights UI
  const ff = { src: $('ff-source'), dst: $('ff-destination'), date: $('ff-date'), btn: $('ff-search'), out: $('ff-results') };

  // Hotels UI
  const hotelLocationInput = $('hotel-location');
  const hotelCheckinInput = $('hotel-checkin');
  const hotelCheckoutInput = $('hotel-checkout');
  const hotelGuestsInput = $('hotel-guests');
  const hotelSearchBtn = $('hotel-search-btn');
  const hotelsResults = $('hotels-results');

  // Booking UI
  const bk = {
    panel: $('booking-panel'), form: $('booking-form'),
    name: $('bk-name'), email: $('bk-email'), phone: $('bk-phone'), trav: $('bk-travelers'), notes: $('bk-notes'),
    tripId: $('bk-tripId'),
    c: $('bk-flight-carrier'), route: $('bk-flight-route'), d: $('bk-flight-date'),
    dep: $('bk-flight-departure'), dur: $('bk-flight-duration'), price: $('bk-flight-price'),
    cancel: $('bk-cancel')
  };

  // View toggles
  const viewGridBtn = $('viewGrid');
  const viewListBtn = $('viewList');

  /* ---------------------------
     Small UI helpers
     --------------------------- */
  const open = el => el && (el.style.display = 'block');
  const close = el => el && (el.style.display = 'none');

  /* ---------------------------
     AUTH: simple flows
     --------------------------- */
  function setUser(user) {
    if (!A.userEl) return;
    if (user) {
      A.userEl.style.display = 'inline';
      A.userEl.textContent = `Hello, ${user.name}`;
      A.btnLogin && (A.btnLogin.style.display = 'none');
      A.btnRegister && (A.btnRegister.style.display = 'none');
      A.btnLogout && (A.btnLogout.style.display = 'inline-block');
    } else {
      A.userEl.style.display = 'none';
      A.btnLogin && (A.btnLogin.style.display = 'inline-block');
      A.btnRegister && (A.btnRegister.style.display = 'inline-block');
      A.btnLogout && (A.btnLogout.style.display = 'none');
    }
  }

  async function me() {
    try {
      const r = await fetch(API.auth.me, { credentials: 'include' });
      const j = await r.json();
      setUser(j.user);
    } catch {
      setUser(null);
    }
  }

  // auth bindings
  A.btnLogin?.addEventListener('click', () => open(A.mLogin));
  A.loginCancel?.addEventListener('click', () => close(A.mLogin));
  A.loginSubmit?.addEventListener('click', async () => {
    const email = A.loginEmail?.value?.trim(), password = A.loginPass?.value?.trim();
    if (!email || !password) return toast('Email & password required');
    try { await post(API.auth.login, { email, password }, true); close(A.mLogin); toast('Logged in'); me(); }
    catch (e) { console.error(e); toast('Login failed'); }
  });

  A.btnRegister?.addEventListener('click', () => open(A.mRegister));
  A.regCancel?.addEventListener('click', () => close(A.mRegister));
  A.regSubmit?.addEventListener('click', async () => {
    const name = A.regName?.value?.trim(), email = A.regEmail?.value?.trim(), password = A.regPass?.value?.trim();
    if (!name || !email || !password) return toast('All fields required');
    try { await post(API.auth.register, { name, email, password }, true); close(A.mRegister); toast('Account created'); me(); }
    catch (e) { console.error(e); toast('Registration failed'); }
  });

  A.btnLogout?.addEventListener('click', async () => {
    try { await fetch(API.auth.logout, { method: 'POST', credentials: 'include' }); toast('Logged out'); setUser(null); }
    catch { toast('Logout failed'); }
  });

  /* ---------------------------
     POPULAR + DESTINATIONS
     --------------------------- */
  const POPULAR_PLACES = [
    { name: 'Bali, Indonesia', imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', blurb: 'Beaches & temples', rating: 5 },
    { name: 'Swiss Alps', imageUrl: 'https://images.unsplash.com/photo-1472689807769-993ee44a1bfc?auto=format&fit=crop&w=1200&q=80', blurb: 'Snowy peaks', rating: 5 },
    { name: 'Santorini, Greece', imageUrl: 'https://images.unsplash.com/photo-1508739826987-b79cd8b7da12?auto=format&fit=crop&w=1200&q=80', blurb: 'Aegean views', rating: 5 }
  ];

  const popularCard = p => `
    <div class="card" style="width:260px">
      <img src="${p.imageUrl || FALLBACK_IMG}" alt="${p.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
      <div class="card-content">
        <h3>${p.name}</h3>
        <p class="stars">${'★'.repeat(Math.round(p.rating || 5))}</p>
        <p style="font-size:14px;color:#444;margin-top:6px;">${p.blurb || ''}</p>
      </div>
    </div>
  `;

  async function loadExternalDestinations({ limit = 6, keyword = '', subType = 'CITY' } = {}) {
    try {
      const resp = await get(API.destinations, { limit, keyword, subType });
      const list = Array.isArray(resp?.data) ? resp.data : [];
      if (!list.length) return null;
      return list.map(d => ({
        name: d.name || d.title || 'Unknown',
        imageUrl: d.imageUrl || FALLBACK_IMG,
        blurb: d.description || d.region || '',
        rating: d.rating || 5,
        id: d.id || d.name,
        raw: d.raw || null
      }));
    } catch (err) {
      console.error('loadExternalDestinations error', err);
      return null;
    }
  }

  async function renderPopular() {
    if (!popularGrid || !popularPanel) return;
    const external = await loadExternalDestinations({ limit: 8 });
    const items = external && external.length ? external : POPULAR_PLACES;
    popularGrid.innerHTML = items.map(popularCard).join('');
    popularPanel.style.display = 'block';
    window.scrollTo({ top: popularPanel.offsetTop - 80, behavior: 'smooth' });
  }
  $('popularBtn')?.addEventListener('click', renderPopular);

  /* ---------------------------
     SUGGESTED TRIPS
     --------------------------- */
  const SUGGESTED_FALLBACK = [
    { _id: 'sg1', name: 'Goa Beaches', imageUrl: FALLBACK_IMG, rating: 5 },
    { _id: 'sg2', name: 'Himalayan Trek', imageUrl: FALLBACK_IMG, rating: 5, category: 'Mount' },
    { _id: 'sg3', name: 'Rajasthan Heritage', imageUrl: FALLBACK_IMG, rating: 4, category: 'Cultural' }
  ];

  const miniTripCard = t => `
    <div class="card" style="width:240px">
      <img src="${t.imageUrl || FALLBACK_IMG}" alt="${t.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
      <div class="card-content">
        <h3>${t.name}</h3>
        <p class="stars">${'★'.repeat(Math.round(t.rating || 5))}</p>
      </div>
    </div>
  `;

  async function loadSuggestedTrips() {
    if (!suggestedWrap) return;
    try {
      const data = await get(API.trips, { sort: '-rating', limit: 6 });
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      if (list.length) { suggestedWrap.innerHTML = list.map(miniTripCard).join(''); return; }
      const ext = await loadExternalDestinations({ limit: 6 });
      if (ext && ext.length) { suggestedWrap.innerHTML = ext.map(miniTripCard).join(''); return; }
      suggestedWrap.innerHTML = SUGGESTED_FALLBACK.map(miniTripCard).join('');
    } catch (e) {
      console.error(e);
      suggestedWrap.innerHTML = SUGGESTED_FALLBACK.map(miniTripCard).join('');
    }
  }

  /* ---------------------------
     TRIPS list/grid rendering
     --------------------------- */
  let TRIP_VIEW = 'grid';

  const groupBy = (arr, key) => arr.reduce((acc, x) => ((acc[x[key] || 'Others'] ||= []).push(x), acc), {});

  const tripCard = t => `
    <div class="card">
      <img src="${t.imageUrl || FALLBACK_IMG}" alt="${t.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
      <div class="card-content">
        <h3>${t.name}</h3>
        <p class="stars">${'★'.repeat(Math.round(t.rating || 5))}</p>
        <p style="font-size:14px;color:#444;margin-top:8px;">${t.description || ''}</p>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn flight-btn" data-name="${t.name}">Flights</button>
          <button class="btn book-trip-btn" data-id="${t._id}">Book Trip</button>
        </div>
      </div>
    </div>
  `;

  function renderTripsGrid(list) {
    if (!cards) return;
    cards.classList.remove('trip-list');
    cards.classList.add('places');
    cards.innerHTML = list.map(tripCard).join('');
  }

  function listItem(t) {
    return `
      <div class="item">
        <img src="${t.imageUrl || FALLBACK_IMG}" alt="${t.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
        <div>
          <h4>${t.name} <span class="badge">${t.category || 'Other'}</span></h4>
          <div class="stars" style="color:gold">${'★'.repeat(Math.round(t.rating || 5))}</div>
          <p style="font-size:13px;color:#444;margin-top:4px">${t.description || ''}</p>
        </div>
        <div class="actions">
          <button class="btn flight-btn" data-name="${t.name}">Flights</button>
          <button class="btn book-trip-btn" data-id="${t._id}">Book</button>
        </div>
      </div>
    `;
  }

  function renderTripsList(list) {
    if (!cards) return;
    cards.classList.remove('places');
    cards.classList.add('trip-list');
    const byCat = groupBy(list, 'category');
    const html = Object.keys(byCat).sort().map(catName => `
      <div class="cat-block">
        <div class="cat-title">${catName}</div>
        ${byCat[catName].map(listItem).join('')}
      </div>
    `).join('');
    cards.innerHTML = html;
  }

  function renderTrips(raw) {
    if (!cards) return;
    const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
    if (!list.length) { cards.innerHTML = '<p>No trips found.</p>'; return; }
    TRIP_VIEW === 'list' ? renderTripsList(list) : renderTripsGrid(list);
  }

  const loadTrips = (p = {}) => get(API.trips, p).then(renderTrips).catch(err => { console.error(err); toast('Failed to load trips'); });

  /* ---------------------------
     Search: combined logic (trips + destinations)
     --------------------------- */
  async function runSearch() {
    try {
      console.log('runSearch invoked');
      if (!qIn) { console.error('Search input element missing'); toast('Search input missing'); return; }

      const qVal = (qIn.value || '').trim();
      const params = {};
      if (cat && cat.value) params.category = cat.value;
      params.sort = TRIP_VIEW === 'list' ? 'category name' : '-createdAt';

      if (qBtn) { qBtn.disabled = true; qBtn.textContent = 'Searching...'; }

      let trips = [];
      let destinations = [];

      // 1) local trips
      try {
        const tripRes = await fetch(buildUrl(API.trips, Object.assign({}, qVal ? { q: qVal } : {}, params)));
        const tripJson = await tripRes.json().catch(() => null);
        trips = Array.isArray(tripJson?.data) ? tripJson.data : [];
      } catch (err) {
        console.warn('local trips search failed', err);
      }

      // 2) external destinations
      try {
        if (qVal) {
          const destRes = await fetch(buildUrl(API.destinations, { keyword: qVal, limit: 8 }));
          const destJson = await destRes.json().catch(() => null);
          destinations = Array.isArray(destJson?.data) ? destJson.data : [];
        }
      } catch (err) {
        console.warn('destinations search failed', err);
      }

      // Combine dests first so user sees broad results, then local trips
      const combined = [...(destinations || []), ...(trips || [])];
      if (!combined.length) {
        cards.innerHTML = `<p>No results found${qVal ? ` for "${qVal}"` : ''}.</p>`;
        toast('No trips found for your search.');
        return;
      }

      // Normalize combined items to expected render shape if needed
      // If a destination item lacks _id, provide id-like field for booking mapping
      const normalized = combined.map((it, idx) => {
        // If item is from local DB, likely has _id; keep as-is
        if (it._id || it.id) return it;
        // else it's likely a destination from Amadeus => convert fields to expected structure
        return {
          _id: it.id || `dest-${idx}-${(it.name||'').replace(/\s+/g,'-')}`,
          name: it.name || it.title || 'Unknown',
          imageUrl: it.imageUrl || (it.image || FALLBACK_IMG),
          description: it.description || it.blurb || '',
          rating: it.rating || 5,
          category: it.category || it.subType || 'Destination'
        };
      });

      renderTrips({ data: normalized });

    } catch (err) {
      console.error('runSearch error', err);
      toast('Search failed — see console');
    } finally {
      if (qBtn) { qBtn.disabled = false; qBtn.textContent = 'Search'; }
    }
  }

  // Bind search events
  qBtn?.addEventListener('click', runSearch);
  qIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });

  // view toggles
  viewGridBtn?.addEventListener('click', () => { TRIP_VIEW = 'grid'; runSearch(); viewGridBtn.style.background = '#00b3b3'; viewListBtn && (viewListBtn.style.background = '#555'); });
  viewListBtn?.addEventListener('click', () => { TRIP_VIEW = 'list'; runSearch(); viewListBtn.style.background = '#00b3b3'; viewGridBtn && (viewGridBtn.style.background = '#555'); });
  reset?.addEventListener('click', () => { if (qIn) qIn.value = ''; if (cat) cat.value = ''; loadTrips(); });

  /* ---------------------------
     Flights search + booking
     --------------------------- */
  function renderFlights(list = []) {
    if (!ff.out) return;
    ff.out.innerHTML = !list.length ? '<p>No flights found.</p>' : `
      <div style="display:grid;gap:12px;">
        ${list.map(f => `
          <div style="background:#fff;color:#000;border-radius:12px;padding:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <strong>${f.carrier}</strong>
              <span>${f.source} → ${f.destination}</span>
              <span>Departs: ${f.departure}</span>
              <span>Duration: ${f.duration}</span>
              <span>Price: $${f.price}</span>
              <button class="btn book-flight-btn"
                data-carrier="${f.carrier}" data-source="${f.source}" data-destination="${f.destination}"
                data-departure="${f.departure}" data-duration="${f.duration}" data-price="${f.price}"
                data-date="${ff.date?.value || ''}">Book</button>
            </div>
          </div>`).join('')}
      </div>`;
  }

  async function searchFlights() {
    const source = ff.src?.value.trim(), destination = ff.dst?.value.trim(), departureDate = ff.date?.value;
    if (!source || !destination || !departureDate) return toast('Fill source, destination, date');
    try {
      ff.btn.disabled = true; ff.btn.textContent = 'Searching...';
      const flights = await post(API.flights, { source, destination, departureDate });
      renderFlights(flights);
      toast('Flights loaded');
    } catch (e) {
      console.error(e); toast('Flight search failed');
    } finally {
      ff.btn.disabled = false; ff.btn.textContent = 'Search Flights';
    }
  }
  ff.btn?.addEventListener('click', searchFlights);

  /* ---------------------------
     Hotels search + rendering
     --------------------------- */
  function hotelCard(h) {
    return `
      <div class="card" style="background:#fff;color:#000;border-radius:12px;overflow:hidden">
        <img src="${h.imageUrl || `https://source.unsplash.com/800x600/?hotel,${encodeURIComponent(h.name || 'hotel')}`}" alt="${h.name}" style="width:100%;height:160px;object-fit:cover" onerror="this.onerror=null;this.src='https://source.unsplash.com/800x600/?hotel'">
        <div style="padding:12px">
          <h3 style="margin:0 0 6px">${h.name}</h3>
          <p style="margin:0;font-size:13px;color:#444">${h.city || ''}${h.country ? ', ' + h.country : ''}</p>
          <p style="margin:6px 0;font-size:14px;color:#333">${(h.description || '').slice(0,120)}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
            <div>
              ${h.rating ? `<span style="color:gold">${'★'.repeat(Math.round(h.rating || 4))}</span>` : ''}
            </div>
            <div style="text-align:right">
              ${h.price ? `<div style="font-weight:700">${h.currency || 'USD'} ${h.price}</div>` : ''}
              <button class="btn book-hotel-btn" data-id="${h.id}" data-name="${h.name}" style="margin-top:8px">Book</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function searchHotels() {
    const location = hotelLocationInput?.value?.trim();
    if (!location) { toast('Enter a location'); return; }
    const checkin = hotelCheckinInput?.value || '';
    const checkout = hotelCheckoutInput?.value || '';
    const guests = hotelGuestsInput?.value || 1;

    hotelSearchBtn.disabled = true;
    hotelSearchBtn.textContent = 'Searching...';

    try {
      const params = { location, checkin, checkout, guests, limit: 12 };
      const res = await fetch(buildUrl(API.hotels, params));
      const json = await res.json().catch(() => null);
      const list = Array.isArray(json?.data) ? json.data : [];
      if (!hotelsResults) {
        toast('Hotels container missing');
        return;
      }
      if (!list.length) {
        hotelsResults.innerHTML = `<p>No hotels found for ${location}.</p>`;
        return;
      }
      hotelsResults.innerHTML = list.map(hotelCard).join('');
    } catch (err) {
      console.error('searchHotels error', err);
      toast('Hotel search failed');
    } finally {
      hotelSearchBtn.disabled = false;
      hotelSearchBtn.textContent = 'Search Hotels';
    }
  }

  hotelSearchBtn?.addEventListener('click', searchHotels);
  hotelLocationInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); searchHotels(); } });

  /* ---------------------------
     Booking panel logic (trips/flights/hotels)
     --------------------------- */
  const openBk = () => { if (!bk.panel) return; bk.panel.style.display = 'block'; window.scrollTo({ top: bk.panel.offsetTop - 80, behavior: 'smooth' }); };
  const closeBk = () => {
    if (!bk.panel) return;
    bk.panel.style.display = 'none';
    bk.form?.reset();
    if (bk.tripId) bk.tripId.value = '';
    if (bk.c) bk.c.value = '';
    if (bk.route) bk.route.value = '';
    if (bk.d) bk.d.value = '';
    if (bk.dep) bk.dep.value = '';
    if (bk.dur) bk.dur.value = '';
    if (bk.price) bk.price.value = '';
  };

  // Trips cards: book or flights
  cards?.addEventListener('click', e => {
    const tBtn = e.target.closest('.book-trip-btn');
    const fBtn = e.target.closest('.flight-btn');
    if (tBtn) { closeBk(); if (bk.tripId) bk.tripId.value = tBtn.dataset.id; openBk(); }
    if (fBtn) { if (ff.dst) { ff.dst.value = fBtn.dataset.name || ''; window.scrollTo({ top: ff.dst.getBoundingClientRect().top + scrollY - 100, behavior: 'smooth' }); } }
  });

  // Flights results -> book
  ff.out?.addEventListener('click', e => {
    const b = e.target.closest('.book-flight-btn'); if (!b) return;
    closeBk();
    if (bk.c) bk.c.value = b.dataset.carrier;
    if (bk.route) bk.route.value = `${b.dataset.source} → ${b.dataset.destination}`;
    if (bk.d) bk.d.value = b.dataset.date;
    if (bk.dep) bk.dep.value = b.dataset.departure;
    if (bk.dur) bk.dur.value = b.dataset.duration;
    if (bk.price) bk.price.value = b.dataset.price;
    openBk();
  });

  // Hotels results -> book
  hotelsResults?.addEventListener('click', e => {
    const b = e.target.closest('.book-hotel-btn'); if (!b) return;
    const id = b.dataset.id, name = b.dataset.name;
    closeBk();
    // prefill booking form with hotel info (you can adapt fields)
    if (bk.tripId) bk.tripId.value = `hotel:${id}`;
    if (bk.notes) bk.notes.value = `Booking hotel: ${name}`;
    openBk();
  });

  // Booking form submit -> post to /api/bookings
  bk.form?.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      name: bk.name?.value?.trim(), email: bk.email?.value?.trim(), phone: bk.phone?.value?.trim(),
      travelers: Number(bk.trav?.value || 1), notes: bk.notes?.value?.trim()
    };
    if (!payload.name || !payload.email) return toast('Name & email required');
    if (bk.tripId && bk.tripId.value) payload.tripId = bk.tripId.value;
    if (bk.c?.value || bk.route?.value) {
      const [source, destination] = (bk.route?.value || '').split('→').map(s => (s || '').trim());
      payload.flight = { carrier: bk.c?.value || '', source, destination, date: bk.d?.value || '', departure: bk.dep?.value || '', duration: bk.dur?.value || '', price: Number(bk.price?.value || 0) };
    }
    try {
      await post(API.bookings, payload);
      toast('✅ Booking submitted');
      closeBk();
    } catch (err) {
      console.error('booking submit error', err);
      toast('Booking failed');
    }
  });

  bk.cancel?.addEventListener('click', closeBk);

  /* ---------------------------
     Global click handlers & boot
     --------------------------- */
  // fallback booking triggers (e.g., small book buttons)
  document.addEventListener('click', (ev) => {
    const bookTrip = ev.target.closest('.book-trip-btn');
    if (bookTrip) {
      // ensure booking panel opens with trip id
      if (bk.tripId) bk.tripId.value = bookTrip.dataset.id;
      openBk();
    }
  });

  // Boot sequence
  me();
  loadSuggestedTrips();
  loadTrips();

}); // end DOMContentLoaded
