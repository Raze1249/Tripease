// ===== Endpoints =====
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

// ===== Shorthand helpers =====
const $ = id => document.getElementById(id);
const get = (u, q={}) => fetch(u + (Object.keys(q).length ? `?${new URLSearchParams(q)}` : '')).then(r=>r.json());
const post = (u, b, cred=false) =>
  fetch(u, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(b), ...(cred?{credentials:'include'}:{}) })
    .then(r=>{ if(!r.ok) throw new Error(`${r.status}`); return r.json(); });

const toastEl = $('toast');
const toast = (m, ms=1800) => { toastEl.textContent=m; toastEl.style.display='block'; setTimeout(()=>toastEl.style.display='none',ms); };

// ===== Auth (minimal JWT cookie) =====
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
  try{
    const r = await fetch(API.auth.me, { credentials:'include' });
    const j = await r.json(); setUser(j.user);
  }catch{ setUser(null); }
}
// auth events
A.btnLogin?.addEventListener('click', ()=> open(A.mLogin));
A.loginCancel?.addEventListener('click', ()=> close(A.mLogin));
A.loginSubmit?.addEventListener('click', async ()=>{
  const email = A.loginEmail.value.trim(), password = A.loginPass.value.trim();
  if (!email || !password) return toast('Email & password required');
  try{
    await post(API.auth.login, { email, password }, true);
    close(A.mLogin); toast('Logged in'); me();
  }catch{ toast('Login failed'); }
});
A.btnRegister?.addEventListener('click', ()=> open(A.mRegister));
A.regCancel?.addEventListener('click', ()=> close(A.mRegister));
A.regSubmit?.addEventListener('click', async ()=>{
  const name = A.regName.value.trim(), email = A.regEmail.value.trim(), password = A.regPass.value.trim();
  if (!name || !email || !password) return toast('All fields required');
  try{
    await post(API.auth.register, { name, email, password }, true);
    close(A.mRegister); toast('Account created'); me();
  }catch{ toast('Registration failed'); }
});
A.btnLogout?.addEventListener('click', async ()=>{
  await fetch(API.auth.logout, { method:'POST', credentials:'include' });
  toast('Logged out'); setUser(null);
});

// ===== Trips =====
const cards = $('cardsContainer'), qIn = $('searchInput'), qBtn = $('searchBtn'), cat = $('categorySelect'), reset = $('resetBtn'), popular = $('popularBtn');

const tripCard = t => `
  <div class="card">
    <img src="${t.imageUrl}" alt="${t.name}">
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
const renderTrips = raw => {
  const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
  cards.innerHTML = list.length ? list.map(tripCard).join('') : '<p>No trips found.</p>';
};
const loadTrips = (p={}) => get(API.trips, p).then(renderTrips).catch(()=>toast('Failed to load trips'));
const runSearch = () => { const p={}; if(qIn.value.trim()) p.q=qIn.value.trim(); if(cat.value) p.category=cat.value; loadTrips(p); };

// ===== Flights =====
const ff = { src:$('ff-source'), dst:$('ff-destination'), date:$('ff-date'), btn:$('ff-search'), out:$('ff-results') };
const renderFlights = (list=[]) => {
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
              data-date="${ff.date.value}">Book</button>
          </div>
        </div>`).join('')}
    </div>`;
};
const searchFlights = async () => {
  const source = ff.src.value.trim(), destination = ff.dst.value.trim(), departureDate = ff.date.value;
  if (!source || !destination || !departureDate) return toast('Fill source, destination, date');
  try{
    ff.btn.disabled = true; ff.btn.textContent='Searching...';
    const flights = await post(API.flights, { source, destination, departureDate });
    renderFlights(flights); toast('Flights loaded');
  }catch{ toast('Flight search failed'); }
  finally{ ff.btn.disabled=false; ff.btn.textContent='Search Flights'; }
};

// ===== Booking panel =====
const bk = {
  panel:$('booking-panel'), form:$('booking-form'),
  name:$('bk-name'), email:$('bk-email'), phone:$('bk-phone'), trav:$('bk-travelers'), notes:$('bk-notes'),
  tripId:$('bk-tripId'),
  c:$('bk-flight-carrier'), route:$('bk-flight-route'), d:$('bk-flight-date'), dep:$('bk-flight-departure'), dur:$('bk-flight-duration'), price:$('bk-flight-price'),
  cancel:$('bk-cancel')
};
const openBk = ()=>{ bk.panel.style.display='block'; window.scrollTo({top:bk.panel.offsetTop-80,behavior:'smooth'}); };
const closeBk = ()=>{ bk.panel.style.display='none'; bk.form.reset(); bk.tripId.value=bk.c.value=bk.route.value=bk.d.value=bk.dep.value=bk.dur.value=bk.price.value=''; };

// open from trip card / flight result
cards.addEventListener('click', e=>{
  const tBtn = e.target.closest('.book-trip-btn');
  const fBtn = e.target.closest('.flight-btn');
  if (tBtn){ closeBk(); bk.tripId.value = tBtn.dataset.id; openBk(); }
  if (fBtn){ ff.dst.value = fBtn.dataset.name || ''; window.scrollTo({top:ff.dst.getBoundingClientRect().top + scrollY - 100, behavior:'smooth'}); }
});
ff.out.addEventListener('click', e=>{
  const b = e.target.closest('.book-flight-btn'); if (!b) return;
  closeBk();
  bk.c.value = b.dataset.carrier;
  bk.route.value = `${b.dataset.source} → ${b.dataset.destination}`;
  bk.d.value = b.dataset.date; bk.dep.value = b.dataset.departure; bk.dur.value = b.dataset.duration; bk.price.value = b.dataset.price;
  openBk();
});

// submit booking (requires name+email)
bk.form.addEventListener('submit', async e=>{
  e.preventDefault();
  const payload = {
    name: bk.name.value.trim(), email: bk.email.value.trim(), phone: bk.phone.value.trim(),
    travelers: Number(bk.trav.value||1), notes: bk.notes.value.trim()
  };
  if (!payload.name || !payload.email) return toast('Name & email required');
  if (bk.tripId.value) payload.tripId = bk.tripId.value;
  if (bk.c.value || bk.route.value){
    const [source,destination] = (bk.route.value||'').split('→').map(s=>(s||'').trim());
    payload.flight = { carrier:bk.c.value, source, destination, date:bk.d.value, departure:bk.dep.value, duration:bk.dur.value, price:Number(bk.price.value||0) };
  }
  try{ await post(API.bookings, payload); toast('✅ Booking submitted'); closeBk(); }
  catch{ toast('Booking failed'); }
});
bk.cancel.addEventListener('click', closeBk);

// ===== Wire & boot =====
$('ff-search').addEventListener('click', searchFlights);
qBtn.addEventListener('click', runSearch);
$('categorySelect').addEventListener('change', runSearch);
$('resetBtn').addEventListener('click', ()=>{ $('searchInput').value=''; $('categorySelect').value=''; loadTrips(); });
$('popularBtn').addEventListener('click', ()=>loadTrips({ q:'popular' }));

me();         // check auth
loadTrips();  // load trips
