// ===================== Tripease Frontend (app.js) =====================

// ----- Endpoints -----
const API = {
  trips: '/api/trips',
  flights: '/api/search-flights',
  bookings: '/api/bookings',
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    logout: '/api/auth/logout',
    me: '/api/auth/me'
  }
};

// ----- Helpers -----
const $ = id => document.getElementById(id);
const get = (u, q={}) =>
  fetch(u + (Object.keys(q).length ? `?${new URLSearchParams(q)}` : '')).then(r => r.json());
const post = (u, b, cred=false) =>
  fetch(u, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b), ...(cred?{credentials:'include'}:{}) })
    .then(r => { if(!r.ok) throw new Error(`${r.status}`); return r.json(); });

const toastEl = $('toast');
const toast = (m, ms=1800) => { toastEl.textContent = m; toastEl.style.display = 'block'; setTimeout(()=>toastEl.style.display='none', ms); };

// Universal fallback image so broken links never show blanks
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

// ===================== AUTH (Login / Register / Logout) =====================
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
const open = el => el.style.display = 'block';
const close = el => el.style.display = 'none';

function setUser(user){
  if (user){
    A.userEl.style.display='inline';
    A.userEl.textContent = `Hello, ${user.name}`;
    A.btnLogin.style.display='none';
    A.btnRegister.style.display='none';
    A.btnLogout.style.display='inline-block';
  } else {
    A.userEl.style.display='none';
    A.btnLogin.style.display='inline-block';
    A.btnRegister.style.display='inline-block';
    A.btnLogout.style.display='none';
  }
}
async function me(){
  try {
    const r = await fetch(API.auth.me, { credentials:'include' });
    const j = await r.json();
    setUser(j.user);
  } catch {
    setUser(null);
  }
}

// Auth events
A.btnLogin?.addEventListener('click', ()=> open(A.mLogin));
A.loginCancel?.addEventListener('click', ()=> close(A.mLogin));
A.loginSubmit?.addEventListener('click', async ()=>{
  const email = A.loginEmail.value.trim(), password = A.loginPass.value.trim();
  if (!email || !password) return toast('Email & password required');
  try {
    await post(API.auth.login, { email, password }, true);
    close(A.mLogin); toast('Logged in'); me();
  } catch { toast('Login failed'); }
});

A.btnRegister?.addEventListener('click', ()=> open(A.mRegister));
A.regCancel?.addEventListener('click', ()=> close(A.mRegister));
A.regSubmit?.addEventListener('click', async ()=>{
  const name = A.regName.value.trim(), email = A.regEmail.value.trim(), password = A.regPass.value.trim();
  if (!name || !email || !password) return toast('All fields required');
  try {
    await post(API.auth.register, { name, email, password }, true);
    close(A.mRegister); toast('Account created'); me();
  } catch { toast('Registration failed'); }
});

A.btnLogout?.addEventListener('click', async ()=>{
  await fetch(API.auth.logout, { method:'POST', credentials:'include' });
  toast('Logged out'); setUser(null);
});

// ===================== POPULAR PLACES (static gallery) =====================
const POPULAR_PLACES = [
  {
    name: 'Bali, Indonesia',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    blurb: 'Beaches, temples & tropical vibes', rating: 5
  },
  {
    name: 'Swiss Alps',
    imageUrl: 'https://images.unsplash.com/photo-1472689807769-993ee44a1bfc?auto=format&fit=crop&w=1200&q=80',
    blurb: 'Snowy peaks & alpine towns', rating: 5
  },
  {
    name: 'Santorini, Greece',
    imageUrl: 'https://images.unsplash.com/photo-1508739826987-b79cd8b7da12?auto=format&fit=crop&w=1200&q=80',
    blurb: 'White cliffs over the Aegean', rating: 5
  },
  {
    name: 'Kyoto, Japan',
    imageUrl: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=1200&q=80',
    blurb: 'Shrines, gardens & tea houses', rating: 5
  },
  {
    name: 'Maldives',
    imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
    blurb: 'Overwater villas & lagoons', rating: 5
  },
  {
    name: 'Paris, France',
    imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80',
    blurb: 'Cafés, art & the Eiffel Tower', rating: 5
  }
];

const popularGrid = $('popularGrid');
const popularPanel = $('popular-panel');

const popularCard = p => `
  <div class="card" style="width:260px">
    <img src="${p.imageUrl}" alt="${p.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
    <div class="card-content">
      <h3>${p.name}</h3>
      <p class="stars">${'★'.repeat(Math.round(p.rating||5))}</p>
      <p style="font-size:14px;color:#444;margin-top:6px;">${p.blurb||''}</p>
    </div>
  </div>
`;

function renderPopular(){
  if (!popularGrid || !popularPanel) return;
  popularGrid.innerHTML = POPULAR_PLACES.map(popularCard).join('');
  popularPanel.style.display = 'block';
  window.scrollTo({ top: popularPanel.offsetTop - 80, behavior: 'smooth' });
}
$('popularBtn')?.addEventListener('click', renderPopular);

// ===================== SUGGESTED TRIPS (top-rated from API with fallback) =====================
const suggestedWrap = $('suggestedContainer');

const SUGGESTED_FALLBACK = [
  {
    _id:'sg1',
    name:'Goa Beaches',
    imageUrl:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    rating:5
  },
  {
    _id:'sg2',
    name:'Himalayan Trek',
    imageUrl:'https://images.unsplash.com/photo-1477414348463-c0eb7f1359b6?auto=format&fit=crop&w=1200&q=80',
    rating:5,
    description:'Breathtaking trails',
    category:'Mount'
  },
  {
    _id:'sg3',
    name:'Rajasthan Heritage',
    imageUrl:'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80',
    rating:4,
    description:'Palaces & desert safaris',
    category:'Cultural'
  }
];

const miniTripCard = t => `
  <div class="card" style="width:240px">
    <img src="${t.imageUrl}" alt="${t.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
    <div class="card-content">
      <h3>${t.name}</h3>
      <p class="stars">${'★'.repeat(Math.round(t.rating||5))}</p>
    </div>
  </div>
`;

async function loadSuggestedTrips(){
  if (!suggestedWrap) return;
  try {
    const data = await get(API.trips, { sort:'-rating', limit:6 });
    const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    suggestedWrap.innerHTML = (list.length ? list : SUGGESTED_FALLBACK).map(miniTripCard).join('');
  } catch {
    suggestedWrap.innerHTML = SUGGESTED_FALLBACK.map(miniTripCard).join('');
  }
}

// ===================== TRIPS (Grid/List with categories) =====================
let TRIP_VIEW = 'grid'; // 'grid' | 'list'
const groupBy = (arr, key) =>
  arr.reduce((acc, x) => ((acc[x[key] || 'Others'] ||= []).push(x), acc), {});

const cards = $('cardsContainer'), qIn = $('searchInput'), qBtn = $('searchBtn'), cat = $('categorySelect'), reset = $('resetBtn');

const tripCard = t => `
  <div class="card">
    <img src="${t.imageUrl}" alt="${t.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
    <div class="card-content">
      <h3>${t.name}</h3>
      <p class="stars">${'★'.repeat(Math.round(t.rating||5))}</p>
      <p style="font-size:14px;color:#444;margin-top:8px;">${t.description||''}</p>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn flight-btn" data-name="${t.name}">Flights</button>
        <button class="btn book-trip-btn" data-id="${t._id}">Book Trip</button>
      </div>
    </div>
  </div>
`;

function renderTripsGrid(list){
  cards.classList.remove('trip-list');
  cards.classList.add('places');
  cards.innerHTML = list.map(tripCard).join('');
}

function listItem(t){
  return `
    <div class="item">
      <img src="${t.imageUrl}" alt="${t.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
      <div>
        <h4>${t.name} <span class="badge">${t.category || 'Other'}</span></h4>
        <div class="stars" style="color:gold">${'★'.repeat(Math.round(t.rating||5))}</div>
        <p style="font-size:13px;color:#444;margin-top:4px">${t.description || ''}</p>
      </div>
      <div class="actions">
        <button class="btn flight-btn" data-name="${t.name}">Flights</button>
        <button class="btn book-trip-btn" data-id="${t._id}">Book</button>
      </div>
    </div>
  `;
}
function renderTripsList(list){
  cards.classList.remove('places');
  cards.classList.add('trip-list');
  const byCat = groupBy(list, 'category');
  const html = Object.keys(byCat).sort().map(cat => `
    <div class="cat-block">
      <div class="cat-title">${cat}</div>
      ${byCat[cat].map(listItem).join('')}
    </div>
  `).join('');
  cards.innerHTML = html;
}

const renderTrips = raw => {
  if (!cards) return;
  const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
  if (!list.length) { cards.innerHTML = '<p>No trips found.</p>'; return; }
  TRIP_VIEW === 'list' ? renderTripsList(list) : renderTripsGrid(list);
};

const loadTrips = (p={}) => get(API.trips, p).then(renderTrips).catch(()=>toast('Failed to load trips'));
const runSearch = () => {
  const p={};
  if(qIn?.value.trim()) p.q=qIn.value.trim();
  if(cat?.value) p.category=cat.value;
  p.sort = TRIP_VIEW === 'list' ? 'category name' : '-createdAt';
  loadTrips(p);
};

// View toggles
const viewGridBtn = $('viewGrid');
const viewListBtn = $('viewList');

viewGridBtn?.addEventListener('click', ()=>{
  TRIP_VIEW = 'grid';
  runSearch();
  viewGridBtn.style.background = '#00b3b3';
  viewListBtn.style.background = '#555';
});
viewListBtn?.addEventListener('click', ()=>{
  TRIP_VIEW = 'list';
  runSearch();
  viewListBtn.style.background = '#00b3b3';
  viewGridBtn.style.background = '#555';
});

// ===================== FLIGHTS (search + render) =====================
const ff = { src:$('ff-source'), dst:$('ff-destination'), date:$('ff-date'), btn:$('ff-search'), out:$('ff-results') };

const renderFlights = (list=[]) => {
  if (!ff.out) return;
  ff.out.innerHTML = !list.length ? '<p>No flights found.</p>' : `
    <div style="display:grid;gap:12px;">
      ${list.map(f=>`
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
              data-date="${ff.date?.value||''}">Book</button>
          </div>
        </div>`).join('')}
    </div>`;
};

const searchFlights = async () => {
  const source = ff.src?.value.trim(), destination = ff.dst?.value.trim(), departureDate = ff.date?.value;
  if (!source || !destination || !departureDate) return toast('Fill source, destination, date');
  try {
    ff.btn.disabled = true; ff.btn.textContent='Searching...';
    const flights = await post(API.flights, { source, destination, departureDate });
    renderFlights(flights); toast('Flights loaded');
  } catch { toast('Flight search failed'); }
  finally { ff.btn.disabled=false; ff.btn.textContent='Search Flights'; }
};

// ===================== BOOKING (panel + submit) =====================
const bk = {
  panel:$('booking-panel'), form:$('booking-form'),
  name:$('bk-name'), email:$('bk-email'), phone:$('bk-phone'), trav:$('bk-travelers'), notes:$('bk-notes'),
  tripId:$('bk-tripId'),
  c:$('bk-flight-carrier'), route:$('bk-flight-route'), d:$('bk-flight-date'),
  dep:$('bk-flight-departure'), dur:$('bk-flight-duration'), price:$('bk-flight-price'),
  cancel:$('bk-cancel')
};
const openBk = ()=>{ if(!bk.panel) return; bk.panel.style.display='block'; window.scrollTo({ top: bk.panel.offsetTop - 80, behavior: 'smooth' }); };
const closeBk = ()=>{ if(!bk.panel) return; bk.panel.style.display='none'; bk.form?.reset(); bk.tripId.value=bk.c.value=bk.route.value=bk.d.value=bk.dep.value=bk.dur.value=bk.price.value=''; };

// from Trips cards
cards?.addEventListener('click', e=>{
  const tBtn = e.target.closest('.book-trip-btn');
  const fBtn = e.target.closest('.flight-btn');
  if (tBtn){ closeBk(); bk.tripId.value = tBtn.dataset.id; openBk(); }
  if (fBtn){ if (ff.dst) { ff.dst.value = fBtn.dataset.name || ''; window.scrollTo({ top: ff.dst.getBoundingClientRect().top + scrollY - 100, behavior:'smooth' }); } }
});

// from Flights results
ff.out?.addEventListener('click', e=>{
  const b = e.target.closest('.book-flight-btn'); if (!b) return;
  closeBk();
  bk.c.value = b.dataset.carrier;
  bk.route.value = `${b.dataset.source} → ${b.dataset.destination}`;
  bk.d.value = b.dataset.date; bk.dep.value = b.dataset.departure; bk.dur.value = b.dataset.duration; bk.price.value = b.dataset.price;
  openBk();
});

// submit booking
bk.form?.addEventListener('submit', async e=>{
  e.preventDefault();
  const payload = {
    name: bk.name.value.trim(), email: bk.email.value.trim(), phone: bk.phone.value.trim(),
    travelers: Number(bk.trav.value||1), notes: bk.notes.value.trim()
  };
  if (!payload.name || !payload.email) return toast('Name & email required');
  if (bk.tripId.value) payload.tripId = bk.tripId.value;
  if (bk.c.value || bk.route.value){
    const [source, destination] = (bk.route.value||'').split('→').map(s => (s||'').trim());
    payload.flight = { carrier: bk.c.value, source, destination, date: bk.d.value, departure: bk.dep.value, duration: bk.dur.value, price: Number(bk.price.value||0) };
  }
  try { await post(API.bookings, payload); toast('✅ Booking submitted'); closeBk(); }
  catch { toast('Booking failed'); }
});
bk.cancel?.addEventListener('click', closeBk);

// ===================== Wire & Boot =====================
$('ff-search')?.addEventListener('click', searchFlights);
qBtn?.addEventListener('click', runSearch);
cat?.addEventListener('change', runSearch);
reset?.addEventListener('click', ()=>{ if(qIn) qIn.value=''; if(cat) cat.value=''; loadTrips(); });
$('popularBtn')?.addEventListener('click', renderPopular);

me();                // auth check
loadSuggestedTrips();// suggested trips strip
loadTrips();         // main trips list
