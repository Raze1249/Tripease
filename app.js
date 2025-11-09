/******** CONFIG: point to your API ********/
const API_BASE = ''; // same origin (recommended). If API is elsewhere: 'http://localhost:5000'
const ENDPOINTS = {
  list: '/api/trips',      // GET list with ?q=&category=
  book: '/api/trips/book'  // POST booking
};

// If your backend fields differ, map them here.
const mapTrip = (raw) => ({
  id: raw._id || raw.id,
  name: raw.name || raw.title || 'Trip',
  imageUrl: raw.imageUrl || raw.image || raw.photoUrl || 'https://via.placeholder.com/800x600?text=No+Image',
  rating: Number(raw.rating ?? 5),
  description: raw.description || raw.summary || '',
  category: raw.category || raw.type || ''
});

function authHeaders(){
  // Example if you use JWT:
  // const token = localStorage.getItem('token');
  // return token ? { Authorization: `Bearer ${token}` } : {};
  return {};
}

/******** Elements ********/
const cardsContainer = document.getElementById('cardsContainer');
const searchInput    = document.getElementById('searchInput');
const searchBtn      = document.getElementById('searchBtn');
const categorySelect = document.getElementById('categorySelect');
const popularBtn     = document.getElementById('popularBtn');
const resetBtn       = document.getElementById('resetBtn');
const toastEl        = document.getElementById('toast');

function toast(msg, ms = 2200){
  if (!toastEl) return alert(msg);
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
  setTimeout(()=> toastEl.style.display = 'none', ms);
}

/******** API helpers ********/
async function apiGet(path, params = {}){
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Accept: 'application/json', ...authHeaders() },
    credentials: 'include' // keep if using cookies/sessions
  });
  if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
  return res.json();
}

async function apiPost(path, body){
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    let msg = '';
    try { const j = await res.json(); msg = j.error || j.message || ''; } catch {}
    throw new Error(`POST ${path} ${res.status} ${msg}`);
  }
  return res.json();
}

/******** Render ********/
function stars(n){ return `<span class="stars">${'★'.repeat(Math.round(n||5))}</span>`; }

function cardTemplate(t){
  return `
    <div class="card">
      <img src="${t.imageUrl}" alt="${t.name}">
      <div class="card-content">
        <h3>${t.name}</h3>
        ${stars(t.rating)}
        <p style="margin-top:6px;color:#333;">${t.description}</p>
        <button class="book-btn" data-id="${t.id}">Book</button>
      </div>
    </div>
  `;
}

function render(rawList){
  const list = rawList.map(mapTrip);
  cardsContainer.innerHTML = list.length ? list.map(cardTemplate).join('') : '<p>No results found.</p>';
}

/******** Controllers ********/
async function loadInitial(){
  try {
    const data = await apiGet(ENDPOINTS.list, {});
    render(data);
  } catch (e) {
    console.error(e);
    toast('Could not load trips');
  }
}

async function runSearch(){
  const q = (searchInput?.value || '').trim();
  const category = categorySelect?.value || '';
  const params = {};
  if (q) params.q = q;
  if (category) params.category = category;
  try {
    const data = await apiGet(ENDPOINTS.list, params);
    render(data);
  } catch (e) {
    console.error(e);
    toast('Search failed');
  }
}

async function createBooking(id){
  const name = prompt('Your name?');
  if (!name) return;
  const email = prompt('Your email?');
  if (!email) return;
  const startDate = prompt('Start date (YYYY-MM-DD)?');
  const endDate = prompt('End date (YYYY-MM-DD)?');
  const travelers = Number(prompt('Number of travelers?', '1') || '1');

  try{
    await apiPost(ENDPOINTS.book, { destinationId: id, name, email, startDate, endDate, travelers });
    toast('✅ Booking submitted!');
  }catch(e){
    console.error(e);
    toast('Booking failed');
  }
}

/******** Events ********/
searchBtn?.addEventListener('click', runSearch);
categorySelect?.addEventListener('change', runSearch);
popularBtn?.addEventListener('click', async ()=>{
  try { render(await apiGet(ENDPOINTS.list, { q: 'popular' })); }
  catch(e){ console.error(e); toast('Could not load popular'); }
});
resetBtn?.addEventListener('click', loadInitial);

cardsContainer?.addEventListener('click', (e)=>{
  const btn = e.target.closest('.book-btn');
  if (!btn) return;
  createBooking(btn.getAttribute('data-id'));
});

/******** Boot ********/
loadInitial();
