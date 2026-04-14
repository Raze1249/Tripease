// public/app.js
// Tripease frontend: trips, destinations, flights, hotels, buses, trains, booking, auth

/* ============================
   API Endpoints (server proxies)
   ============================ */
const API = {
  trips: '/api/trips',
  flights: '/api/search-flights',
  bookings: '/api/bookings',
  destinations: '/api/destinations',
  hotels: '/api/hotels',
  buses: '/api/buses',
  trains: '/api/trains',
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
const $ = (id) => document.getElementById(id);
const buildUrl = (u, q = {}) =>
  u + (Object.keys(q).length ? `?${new URLSearchParams(q).toString()}` : '');

const get = (u, q = {}) => fetch(buildUrl(u, q)).then((r) => r.json());

const post = (u, b, cred = false) =>
  fetch(u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
    ...(cred ? { credentials: 'include' } : {})
  }).then(async (r) => {
    if (!r.ok) {
      const t = await r.text().catch(() => null);
      throw new Error(t || `HTTP ${r.status}`);
    }
    return r.json().catch(() => ({}));
  });

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

function toast(message, ms = 1600) {
  const el = $('toast');
  if (!el) {
    console.log('TOAST:', message);
    return;
  }
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, ms);
}

/* ============================
   DOM Ready Initialization
   ============================ */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Tripease app.js loaded');

  /* ---------------------------
     Element references
     --------------------------- */
  // Auth
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

  // Trips & search
  const cards = $('cardsContainer');
  const qIn = $('searchInput');
  const qBtn = $('searchBtn');
  const cat = $('categorySelect');
  const reset = $('resetBtn');
  const viewGridBtn = $('viewGrid');
  const viewListBtn = $('viewList');

  // Flights
  const ff = {
    src: $('ff-source'),
    dst: $('ff-destination'),
    date: $('ff-date'),
    btn: $('ff-search'),
    out: $('ff-results')
  };

  // Hotels
  const hotelLocationInput = $('hotel-location');
  const hotelCheckinInput = $('hotel-checkin');
  const hotelCheckoutInput = $('hotel-checkout');
  const hotelGuestsInput = $('hotel-guests');
  const hotelSearchBtn = $('hotel-search-btn');
  const hotelsResults = $('hotels-results');

  // Buses
  const busFromInput = $('bus-from');
  const busToInput = $('bus-to');
  const busDateInput = $('bus-date');
  const busPassengersInput = $('bus-passengers');
  const busSearchBtn = $('bus-search-btn');
  const busResults = $('bus-results');

  // Trains
  const trainFromInput = $('train-from');
  const trainToInput = $('train-to');
  const trainDateInput = $('train-date');
  const trainClassSelect = $('train-class');
  const trainSearchBtn = $('train-search-btn');
  const trainResults = $('train-results');

  // Booking
  const bk = {
    panel: $('booking-panel'),
    form: $('booking-form'),
    name: $('bk-name'),
    email: $('bk-email'),
    phone: $('bk-phone'),
    trav: $('bk-travelers'),
    notes: $('bk-notes'),
    tripId: $('bk-tripId'),
    c: $('bk-flight-carrier'),
    route: $('bk-flight-route'),
    d: $('bk-flight-date'),
    dep: $('bk-flight-departure'),
    dur: $('bk-flight-duration'),
    price: $('bk-flight-price'),
    cancel: $('bk-cancel')
  };
const studentPlanner = {
    from: $('student-from-city'),
    to: $('student-to-city'),
    minBudget: $('student-budget-min'),
    maxBudget: $('student-budget-max'),
    days: $('student-trip-days'),
    suggestBtn: $('student-ai-plan-btn'),
    result: $('student-ai-result')
  };
   
  const open = (el) => el && (el.style.display = 'block');
  const close = (el) => el && (el.style.display = 'none');
   const hideAuthOverlay = () => {
    const overlay = $('auth-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  /* ============================
     AUTH
     ============================ */
  function setUser(user) {
    if (!A.userEl) return;
    if (user) {
      A.userEl.style.display = 'inline';
      A.userEl.textContent = `Hello, ${user.name}`;
      if (A.btnLogin) A.btnLogin.style.display = 'none';
      if (A.btnRegister) A.btnRegister.style.display = 'none';
      if (A.btnLogout) A.btnLogout.style.display = 'inline-block';
    } else {
      A.userEl.style.display = 'none';
      if (A.btnLogin) A.btnLogin.style.display = 'inline-block';
      if (A.btnRegister) A.btnRegister.style.display = 'inline-block';
      if (A.btnLogout) A.btnLogout.style.display = 'none';
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

  A.btnLogin?.addEventListener('click', () => open(A.mLogin));
  A.loginCancel?.addEventListener('click', () => close(A.mLogin));
  A.loginSubmit?.addEventListener('click', async () => {
    const email = A.loginEmail?.value?.trim();
    const password = A.loginPass?.value?.trim();
    if (!email || !password) return toast('Email & password required');
    try {
      await post(API.auth.login, { email, password }, true);
      close(A.mLogin);
       hideAuthOverlay();
      toast('Logged in');
      me();
    } catch (e) {
      console.error(e);
      toast('Login failed');
    }
  });

  A.btnRegister?.addEventListener('click', () => open(A.mRegister));
  A.regCancel?.addEventListener('click', () => close(A.mRegister));
  A.regSubmit?.addEventListener('click', async () => {
    const name = A.regName?.value?.trim();
    const email = A.regEmail?.value?.trim();
    const password = A.regPass?.value?.trim();
    if (!name || !email || !password) return toast('All fields required');
    try {
      await post(API.auth.register, { name, email, password }, true);
      close(A.mRegister);
      hideAuthOverlay();
      toast('Account created');
      me();
    } catch (e) {
      console.error(e);
      toast('Registration failed');
    }
  });

  A.btnLogout?.addEventListener('click', async () => {
    try {
      await fetch(API.auth.logout, { method: 'POST', credentials: 'include' });
      toast('Logged out');
      setUser(null);
    } catch {
      toast('Logout failed');
    }
  });

  /* ============================
     POPULAR & DESTINATIONS
     ============================ */
  const POPULAR_PLACES = [
    {
      name: 'Bali, Indonesia',
      imageUrl:
        'https://images.unsplash.com/photo-1704253411612-e4deb715dcd8?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YmFsaSUyMGluZG9uZXNpYXxlbnwwfHwwfHx8MA%3D%3D',
      blurb: 'Beaches & temples',
       cityDescription:
        'Bali is known for tropical coastlines, scenic rice terraces, and vibrant Balinese culture.',
      rating: 5
      
    },
    {
      name: 'Swiss Alps',
      imageUrl:
        'https://images.unsplash.com/photo-1586752488885-6ce47fdfd874?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8c3dpc3MlMjBhbHBzfGVufDB8fDB8fHww',
      blurb: 'Snowy peaks',
        cityDescription:
        'The Swiss Alps offer mountain villages, panoramic train routes, and year-round adventure sports.',
      rating: 5
    },
    {
      name: 'Santorini, Greece',
      imageUrl:
        'https://images.unsplash.com/photo-1580502304784-8985b7eb7260?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8U2FudG9yaW5pfGVufDB8fDB8fHww',
      blurb: 'Aegean views',
       cityDescription:
        'Santorini features whitewashed cliffside towns, sunset viewpoints, and iconic volcanic beaches.',
      rating: 5
    }
  ];

    const SCENIC_PLACE_GROUPS = {
    Desert: [
      {
        name: 'Jaisalmer, Rajasthan',
        imageUrl:
          'https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=900&q=80',
        blurb: 'Golden dunes and desert camps',
        cityDescription:
          'Explore Sam Sand Dunes, camel safaris, and historic forts in the Thar desert.',
        rating: 5
      },
      {
        name: 'Dubai Desert, UAE',
        imageUrl:
          'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=80',
        blurb: 'Dune bashing & luxury camps',
        cityDescription:
          'Experience evening safaris, traditional food, and desert sunsets near Dubai.',
        rating: 5
      },
      {
        name: 'Sahara, Morocco',
        imageUrl:
          'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=900&q=80',
        blurb: 'Epic dunes in Merzouga',
        cityDescription:
          'Ride through Erg Chebbi dunes and stay in Berber-style camps under starry skies.',
        rating: 5
      }
    ],
    Mountain: [
      {
        name: 'Manali, Himachal',
        imageUrl:
          'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80',
        blurb: 'Snowy peaks & valleys',
        cityDescription:
          'Perfect for mountain views, adventure sports, and scenic road trips.',
        rating: 5
      },
      {
        name: 'Interlaken, Switzerland',
        imageUrl:
          'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?auto=format&fit=crop&w=900&q=80',
        blurb: 'Alpine lakes and hiking',
        cityDescription:
          'A gateway to the Swiss Alps with train rides, trekking, and panoramic viewpoints.',
        rating: 5
      },
      {
        name: 'Banff, Canada',
        imageUrl:
          'https://images.unsplash.com/photo-1508264165352-258a6f82d0ef?auto=format&fit=crop&w=900&q=80',
        blurb: 'Rocky Mountain escape',
        cityDescription:
          'Discover glacier-fed lakes, wildlife, and beautiful mountain trails.',
        rating: 5
      }
    ],
    Beach: [
      {
        name: 'Goa, India',
        imageUrl:
          'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=900&q=80',
        blurb: 'Beaches, cafes, nightlife',
        cityDescription:
          'Relax by the sea, enjoy water sports, and explore vibrant beach markets.',
        rating: 5
      },
      {
        name: 'Bali, Indonesia',
        imageUrl:
          'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80',
        blurb: 'Tropical paradise',
        cityDescription:
          'Enjoy serene beaches, island temples, and iconic sunset coastlines.',
        rating: 5
      },
      {
        name: 'Maldives',
        imageUrl:
          'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=900&q=80',
        blurb: 'Crystal clear lagoons',
        cityDescription:
          'A luxury island destination with overwater villas and coral reefs.',
        rating: 5
      }
    ],
    Lakes: [
      {
        name: 'Nainital, India',
        imageUrl:
          'https://images.unsplash.com/photo-1589802829985-817e51171b92?auto=format&fit=crop&w=900&q=80',
        blurb: 'Lake town in the hills',
        cityDescription:
          'Boating, hill viewpoints, and cool weather make it ideal for peaceful trips.',
        rating: 5
      },
      {
        name: 'Lake Como, Italy',
        imageUrl:
          'https://images.unsplash.com/photo-1533319417894-6fbb331e5513?auto=format&fit=crop&w=900&q=80',
        blurb: 'Elegant lakeside escapes',
        cityDescription:
          'Known for scenic villas, ferry rides, and mountain-backed lake views.',
        rating: 5
      },
      {
        name: 'Lake Louise, Canada',
        imageUrl:
          'https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=900&q=80',
        blurb: 'Turquoise alpine beauty',
        cityDescription:
          'Visit for postcard-perfect water, hiking trails, and stunning glacier scenery.',
        rating: 5
      }
    ]
  };

  const popularCard = (p) => `
  <div class="card popular-place-card" data-name="${p.name}" style="width:260px; cursor:pointer" role="button" tabindex="0" aria-label="Book ${p.name}">
    <img src="${p.imageUrl || FALLBACK_IMG}" alt="${p.name}"
      onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">

    <div class="card-content">
      <h3>${p.name}</h3>
      <p class="stars">${'★'.repeat(Math.round(p.rating || 5))}</p>
      <p style="font-size:14px;color:#444;margin-top:6px;">
        ${p.blurb || ''}
      </p>
      <p style="font-size:13px;color:#555;margin-top:6px;line-height:1.45;">
        ${p.cityDescription || p.description || ''}
      </p>
    </div>
  </div>
`;

  async function loadExternalDestinations({ limit = 6, keyword = '', subType = 'CITY' } = {}) {
    try {
      const resp = await get(API.destinations, { limit, keyword, subType });
      const list = Array.isArray(resp?.data) ? resp.data : [];
      if (!list.length) return null;
      return list.map((d) => ({
        name: d.name || d.title || 'Unknown',
        imageUrl: d.imageUrl || FALLBACK_IMG,
        blurb: d.description || d.region || '',
          cityDescription: d.address?.countryName
          ? `${d.name || 'This city'} is in ${d.address.countryName}. Explore local highlights, food, and culture.`
          : `Discover ${d.name || 'this destination'} with local attractions and memorable stays.`,
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
     attachPopularCardHandlers();
    popularPanel.style.display = 'block';
    window.scrollTo({ top: popularPanel.offsetTop - 80, behavior: 'smooth' });
  }

  $('popularBtn')?.addEventListener('click', renderPopular);

    const bookingChoiceModal = $('booking-choice-modal');
  const bookingChoiceCityLabel = $('booking-choice-city');
  const bookingChoiceCancel = $('booking-choice-cancel');
  let selectedPopularCity = '';

  function openBookingChoice(city) {
    selectedPopularCity = city || '';
    if (bookingChoiceCityLabel) bookingChoiceCityLabel.textContent = selectedPopularCity || 'this place';
    if (bookingChoiceModal) {
      bookingChoiceModal.classList.add('open');
      bookingChoiceModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeBookingChoice() {
    if (!bookingChoiceModal) return;
    bookingChoiceModal.classList.remove('open');
    bookingChoiceModal.setAttribute('aria-hidden', 'true');
  }

  function onPopularCardChoose(cardEl) {
    const city = cardEl?.dataset?.name || '';
    if (!city) return;
    openBookingChoice(city);
  }

  function attachPopularCardHandlers() {
    popularGrid?.querySelectorAll('.popular-place-card').forEach((card) => {
      card.addEventListener('click', () => onPopularCardChoose(card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPopularCardChoose(card);
        }
      });
    });
  }

   function handleBookingDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const deepLinkedCity = (params.get('bookingCity') || '').trim();
    if (!deepLinkedCity) return;
    openBookingChoice(deepLinkedCity);

    params.delete('bookingCity');
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
  }


  function focusBookingTypePanel(city, bookingType = '') {
    if (!city || !bookingType) return;

    const flashPanel = (panelEl) => {
      if (!panelEl) return;
      panelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      panelEl.classList.add('highlight');
      setTimeout(() => panelEl.classList.remove('highlight'), 1500);
    };

 if (bookingType === 'flight') {
      if (ff.dst) ff.dst.value = city;
      flashPanel(ff.src?.closest('.panel'));
      return;
    }

    if (bookingType === 'hotel') {
      if (hotelLocationInput) hotelLocationInput.value = city;
      flashPanel(hotelLocationInput?.closest('.panel'));
      return;
    }
     if (bookingType === 'bus') {
      if (busToInput) busToInput.value = city;
      flashPanel(busToInput?.closest('.panel'));
      return;
    }

     if (bookingType === 'train') {
      if (trainToInput) trainToInput.value = city;
      flashPanel(trainToInput?.closest('.panel'));
    }
  }
   
     function suggestTransportByBudget(maxBudget) {
    if (maxBudget <= 1500) return 'train';
    if (maxBudget <= 3000) return 'bus';
    return 'flight';
  }

  function buildStudentTripPlan({ fromCity, toCity, minBudget, maxBudget, days }) {
    const safeMin = Number.isFinite(minBudget) ? minBudget : 0;
    const safeMax = Number.isFinite(maxBudget) ? maxBudget : 0;
    const transport = suggestTransportByBudget(safeMax);
    const stayBudget = Math.max(0, Math.round(safeMax * 0.45));
    const foodBudget = Math.max(0, Math.round(safeMax * 0.25));
    const travelBudget = Math.max(0, safeMax - stayBudget - foodBudget);

    return {
      fromCity,
      toCity,
      days,
      minBudget: safeMin,
      maxBudget: safeMax,
      transport,
      suggestion:
        transport === 'train'
          ? `Best value pick: Train travel keeps total cost student-friendly for ${days} days.`
          : transport === 'bus'
            ? `Balanced pick: Bus travel gives a good budget/comfort mix for ${days} days.`
            : `Fast pick: Flight is suitable when your budget can support quicker travel.`,
      budgetSplit: {
        travel: travelBudget,
        stay: stayBudget,
        food: foodBudget
      }
    };
  }

  function renderStudentTripPlan(plan) {
    if (!studentPlanner.result) return;
    const transportEmoji =
      plan.transport === 'train' ? '🚆' : plan.transport === 'bus' ? '🚌' : '✈️';
    studentPlanner.result.classList.add('open');
    studentPlanner.result.innerHTML = `
      <h3 style="margin:0 0 6px;">AI Student Plan for ${plan.toCity}</h3>
      <p style="margin:0 0 8px;">${plan.suggestion}</p>
      <p style="margin:0 0 8px;">
        <strong>Budget:</strong> ₹${plan.minBudget.toLocaleString()} - ₹${plan.maxBudget.toLocaleString()}
        • <strong>Duration:</strong> ${plan.days} days
      </p>
      <p style="margin:0 0 8px;">
        <strong>Suggested transport:</strong> ${transportEmoji} ${plan.transport.toUpperCase()}
      </p>
      <p style="margin:0 0 10px;color:#444;">
        Suggested split → Travel: ₹${plan.budgetSplit.travel.toLocaleString()},
        Stay: ₹${plan.budgetSplit.stay.toLocaleString()},
        Food & local: ₹${plan.budgetSplit.food.toLocaleString()}
      </p>
      <button
        type="button"
        class="btn"
        id="student-proceed-booking"
        data-transport="${plan.transport}"
        data-from="${plan.fromCity}"
        data-to="${plan.toCity}">
        Continue to ${plan.transport} booking
      </button>
    `;
  }


  popularGrid?.addEventListener('click', (e) => {
    const card = e.target.closest('.popular-place-card');
    if (!card) return;
    onPopularCardChoose(card);
  });

  bookingChoiceCancel?.addEventListener('click', closeBookingChoice);
  bookingChoiceModal?.addEventListener('click', (e) => {
    if (e.target === bookingChoiceModal) closeBookingChoice();
  });

  document.querySelectorAll('.booking-choice-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bookingType = btn.dataset.bookingType || '';
      if (!selectedPopularCity) return;
      closeBookingChoice();
     focusBookingTypePanel(selectedPopularCity, bookingType);
    });
  });

    handleBookingDeepLink();

    studentPlanner.suggestBtn?.addEventListener('click', () => {
    const fromCity = (studentPlanner.from?.value || '').trim();
    const toCity = (studentPlanner.to?.value || '').trim();
    const minBudget = Number(studentPlanner.minBudget?.value || 0);
    const maxBudget = Number(studentPlanner.maxBudget?.value || 0);
    const days = Number(studentPlanner.days?.value || 3);

    if (!toCity) return toast('Please enter destination city');
    if (!maxBudget || maxBudget <= 0) return toast('Please enter a valid max budget');
    if (minBudget < 0 || maxBudget < minBudget) return toast('Check budget range');

    const plan = buildStudentTripPlan({ fromCity, toCity, minBudget, maxBudget, days });
    renderStudentTripPlan(plan);
    toast('AI student plan generated');
  });

  studentPlanner.result?.addEventListener('click', (e) => {
    const btn = e.target.closest('#student-proceed-booking');
    if (!btn) return;

    const bookingType = btn.dataset.transport || '';
    const fromCity = (btn.dataset.from || '').trim();
    const toCity = (btn.dataset.to || '').trim();
    if (!bookingType || !toCity) return;

    if (bookingType === 'flight') {
      if (ff.src && fromCity) ff.src.value = fromCity;
      if (ff.dst) ff.dst.value = toCity;
    }
    if (bookingType === 'bus') {
      if (busFromInput && fromCity) busFromInput.value = fromCity;
      if (busToInput) busToInput.value = toCity;
    }
    if (bookingType === 'train') {
      if (trainFromInput && fromCity) trainFromInput.value = fromCity;
      if (trainToInput) trainToInput.value = toCity;
    }
    focusBookingTypePanel(toCity, bookingType);
    toast(`Redirected to ${bookingType} booking panel`);
  });
  /* ============================
     SUGGESTED TRIPS
     ============================ */

  // Names we NEVER want to show as trips
  const BLOCKED_NAMES = [
    'Abhishek Sharma',
    'Abhishek sharma'
    // add more if needed
  ];

  // Filter out empty / irrelevant / blocked-name trips

  const miniTripCard = (t) => `
    <div class="card" style="width:240px">
      <img src="${t.imageUrl || FALLBACK_IMG}" alt="${t.name}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
      <div class="card-content">
        <h3>${t.name}</h3>
        <p class="stars">${'★'.repeat(Math.round(t.rating || 5))}</p>
      </div>
    </div>
  `;

 
  /* ============================
     TRIPS (grid/list + search)
     ============================ */
  let TRIP_VIEW = 'grid';
  const groupBy = (arr, key) =>
    arr.reduce((acc, x) => {
      const k = x[key] || 'Others';
      if (!acc[k]) acc[k] = [];
      acc[k].push(x);
      return acc;
    }, {});

  const tripCard = (t) => `
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

 function renderTripsGrid(list, targetId = "cardsContainer") {
  const container = document.getElementById(targetId);
    container.classList.remove('trip-list');
    container.classList.add('places');
   container.innerHTML = list.map(trip => `
  <div class="trip-card">
    <img src="${trip.imageUrl}" />
    <h3>${trip.name}</h3>

    <button class="btn book-trip-btn" data-id="${trip._id}" data-name="${trip.name || ''}">
      Book Trip
    </button>
  </div>
`).join('');
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
 <button class="btn book-trip-btn" data-id="${t._id}" data-name="${t.name || ''}">Book</button>
        </div>
      </div>
    `;
  }

 function renderTripsList(list, targetId = "cardsContainer") {
  const container = document.getElementById(targetId);
  if (!container) return;
    container.classList.remove('places');
    container.classList.add('trip-list');
    const byCat = groupBy(list, 'category');
    const html = Object.keys(byCat)
      .sort()
      .map(
        (catName) => `
      <div class="cat-block">
        <div class="cat-title">${catName}</div>
        ${byCat[catName].map(listItem).join('')}
      </div>
    `
      )
      .join('');
    container.innerHTML = html;
  }
function filterBadTrips(list) {
  return list.filter(trip => trip && trip.name);
}

function renderTrips(raw, targetId = "cardsContainer") {
  const container = document.getElementById(targetId);
  if (!container) return;
   let list = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
     list = filterBadTrips(list);

    if (!list.length) {
      container.innerHTML = '<p>No trips found.</p>';
      return;
    }
    if (TRIP_VIEW === 'list') renderTripsList(list, targetId);
    else renderTripsGrid(list, targetId);
  }

  const loadTrips = (p = {}) =>
    get(API.trips, p)
      .then(renderTrips)
      .catch((err) => {
        console.error(err);
        toast('Failed to load trips');
      });

  // Combined search: local trips + external destinations
async function runSearch() {
  try {
    console.log('runSearch() called');

    if (!qIn) {
      console.error('searchInput not found');
      toast('Search input missing');
      return;
    }

    const qVal = (qIn.value || '').trim();
    const params = {};

    if (cat && cat.value) params.category = cat.value;
    params.sort = TRIP_VIEW === 'list' ? 'category name' : '-createdAt';

    if (qBtn) {
      qBtn.disabled = true;
      qBtn.textContent = 'Searching...';
    }

    let trips = [];
    let destinations = [];

    try {
      const tripRes = await fetch(
        buildUrl(API.trips, { ...(qVal ? { q: qVal } : {}), ...params })
      );
      const tripJson = await tripRes.json().catch(() => null);
      trips = Array.isArray(tripJson?.data) ? tripJson.data : [];
    } catch (err) {
      console.warn('local trips search failed', err);
    }

    try {
      if (qVal) {
        const destRes = await fetch(
          buildUrl(API.destinations, { keyword: qVal, limit: 8 })
        );
        const destJson = await destRes.json().catch(() => null);
        destinations = Array.isArray(destJson?.data) ? destJson.data : [];
      }
    } catch (err) {
      console.warn('destinations search failed', err);
    }

    const combined = [...destinations, ...trips];

    const topContainer = document.getElementById("searchResults");

    if (!combined.length) {
      if (topContainer) {
        topContainer.innerHTML = `<p>No results found${
          qVal ? ` for "${qVal}"` : ''
        }.</p>`;
      }
      toast('No trips found for your search.');
      return;
    }

    const normalized = combined.map((it, idx) => {
      if (it._id || it.id) return it;
      return {
        _id: it.id || `dest-${idx}-${(it.name || '').replace(/\s+/g, '-')}`,
        name: it.name || it.title || 'Unknown',
        imageUrl: it.imageUrl || it.image || FALLBACK_IMG,
        description: it.description || it.blurb || '',
        rating: it.rating || 5,
        category: it.category || it.subType || 'Destination'
      };
    });

    // ✅ Render at TOP
    renderTrips({ data: normalized }, "searchResults");

    // ✅ Hide bottom section
    document.getElementById("cardsContainer").style.display = "none";

  } catch (err) {
    console.error('runSearch error', err);
    toast('Search failed — see console');
  } finally {
    if (qBtn) {
      qBtn.disabled = false;
      qBtn.textContent = 'Search';
    }
  }
}
  
  qBtn?.addEventListener('click', runSearch);
  qIn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch();
    }
  });

  viewGridBtn?.addEventListener('click', () => {
    TRIP_VIEW = 'grid';
    runSearch();
    if (viewGridBtn) viewGridBtn.style.background = '#00b3b3';
    if (viewListBtn) viewListBtn.style.background = '#555';
  });

  viewListBtn?.addEventListener('click', () => {
    TRIP_VIEW = 'list';
    runSearch();
    if (viewListBtn) viewListBtn.style.background = '#00b3b3';
    if (viewGridBtn) viewGridBtn.style.background = '#555';
  });

  reset?.addEventListener('click', () => {
    if (qIn) qIn.value = '';
    if (cat) cat.value = '';
    loadTrips();
  });

  /* ============================
     FLIGHTS
     ============================ */
 function renderFlights(data) {
  if (!ff.out) return;

  // ✅ Normalize response
  const list = Array.isArray(data) ? data : data?.data || [];

  ff.out.innerHTML = !list.length
    ? '<p>No flights found.</p>'
    : `
      <div style="display:grid;gap:12px;">
        ${list.map((f) => `
          <div style="background:#fff;color:#000;border-radius:12px;padding:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <strong>${f.airline || f.carrier}</strong>
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
                data-date="${ff.date?.value || ''}">
                Book
              </button>
            </div>
          </div>
        `).join('')}
      </div>`;
}
  async function searchFlights() {
    const source = ff.src?.value.trim();
    const destination = ff.dst?.value.trim();
    const departureDate = ff.date?.value;
    if (!source || !destination || !departureDate)
      return toast('Fill source, destination, date');
    try {
      ff.btn.disabled = true;
      ff.btn.textContent = 'Searching...';
      const flights = await post(API.flights, {
        source,
        destination,
        departureDate
      });
      renderFlights(flights);
      toast('Flights loaded');
    } catch (e) {
      console.error(e);
      toast('Flight search failed');
    } finally {
      ff.btn.disabled = false;
      ff.btn.textContent = 'Search Flights';
    }
  }

  ff.btn?.addEventListener('click', searchFlights);

  /* ============================
     HOTELS
     ============================ */
  function hotelCard(h) {
      const hotelName = h.name || h.hotelName || 'Hotel';
    const hotelCity = h.city || h.location?.city || '';
    const hotelCountry = h.country || h.location?.country || '';
    const hotelId = h.id || h._id || hotelName;
    const hotelPrice =
      h.price ??
      h.pricePerNight ??
      h.rate ??
      null;
    const hotelCurrency = h.currency || 'USD';
    const hotelRating = h.rating || h.stars || null;
    const hotelDescription = h.description || h.summary || '';
      const defaultImage = `https://picsum.photos/seed/hotel-${encodeURIComponent(
      hotelName
    )}/800/600`;
    const fallbackImage = 'https://picsum.photos/seed/hotel-fallback/800/600';
     
    return `
      <div class="card" style="background:#fff;color:#000;border-radius:12px;overflow:hidden">
        <img src="${
          h.imageUrl ||
          defaultImage
         }" alt="${hotelName}" style="width:100%;height:160px;object-fit:cover"
         onerror="this.onerror=null;this.src='${fallbackImage}'">
        <div style="padding:12px">
            <h3 style="margin:0 0 6px">${hotelName}</h3>
          <p style="margin:0;font-size:13px;color:#444">${hotelCity || ''}${
      hotelCountry ? ', ' + hotelCountry : ''
    }</p>
         <p style="margin:6px 0;font-size:14px;color:#333">${hotelDescription.slice(
            0,
            120
          )}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
            <div>
              ${
               hotelRating
                  ? `<span style="color:gold">${'★'.repeat(
                      Math.round(hotelRating || 4)
                    )}</span>`
                  : ''
              }
            </div>
            <div style="text-align:right">
              ${
               hotelPrice
                  ? `<div style="font-weight:700">${hotelCurrency} ${
                      hotelPrice
                    }</div>`
                  : ''
              }
              <button class="btn book-hotel-btn" data-id="${
             hotelId
              }" data-name="${hotelName}" style="margin-top:8px">
                Book
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
    const HOTEL_FALLBACK_RESULTS = [
    {
      id: 'fallback-hotel-1',
      name: 'Seaside Bliss Resort',
      city: 'Goa',
      country: 'India',
      price: 6500,
      currency: 'INR',
      rating: 4.5,
      description: 'Beachfront stay with pool and complimentary breakfast.'
    },
    {
      id: 'fallback-hotel-2',
      name: 'Royal Heritage Haveli',
      city: 'Jaipur',
      country: 'India',
      price: 5200,
      currency: 'INR',
      rating: 4.3,
      description: 'Heritage-style rooms in the heart of the old city.'
    },
    {
      id: 'fallback-hotel-3',
      name: 'Urban Nest Hotel',
      city: 'Bengaluru',
      country: 'India',
      price: 4300,
      currency: 'INR',
      rating: 4.1,
      description: 'Modern business hotel near major tech parks.'
    }
  ];

  function fallbackHotelsForLocation(location = '') {
    const requestedCity = String(location || '').trim();
    return HOTEL_FALLBACK_RESULTS.map((hotel, index) => ({
      ...hotel,
      id: `${hotel.id}-${requestedCity || 'demo'}-${index + 1}`,
      city: requestedCity || hotel.city
    }));
  }

  async function searchHotels() {
    const location = hotelLocationInput?.value?.trim();
    if (!location) {
      toast('Enter a location');
      return;
    }
    const checkin = hotelCheckinInput?.value || '';
    const checkout = hotelCheckoutInput?.value || '';
    const guests = hotelGuestsInput?.value || 1;

    hotelSearchBtn.disabled = true;
    hotelSearchBtn.textContent = 'Searching...';

    try {
      const params = { location, checkin, checkout, guests, limit: 12 };
      const res = await fetch(buildUrl(API.hotels, params));
      const json = await res.json().catch(() => null);
 const list =
        Array.isArray(json?.data) ? json.data :
        Array.isArray(json?.results) ? json.results :
        Array.isArray(json?.hotels) ? json.hotels :
        Array.isArray(json) ? json :
        [];
      if (!hotelsResults) {
        toast('Hotels container missing');
        return;
      }
      if (!list.length) {
        const fallbackList = fallbackHotelsForLocation(location);
        hotelsResults.innerHTML = fallbackList.map(hotelCard).join('');
        toast(`No live hotels found for ${location}. Showing suggestions.`);
        return;
      }
      hotelsResults.innerHTML = list.map(hotelCard).join('');
    } catch (err) {
      console.error('searchHotels error', err);
       if (hotelsResults) {
        const fallbackList = fallbackHotelsForLocation(location);
        hotelsResults.innerHTML = fallbackList.map(hotelCard).join('');
      }
      toast('Hotel search failed. Showing suggestions.');
    } finally {
      hotelSearchBtn.disabled = false;
      hotelSearchBtn.textContent = 'Search Hotels';
    }
  }

  hotelSearchBtn?.addEventListener('click', searchHotels);
  hotelLocationInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchHotels();
    }
  });

  /* ============================
     BUSES
     ============================ */
  function busCard(b) {
    const operator = b.operator || b.name || b.company || 'Bus Operator';
    const source = b.source || b.from || b.fromCity || '';
    const destination = b.destination || b.to || b.toCity || '';
    const busId = b.id || b._id || `${operator}-${source}-${destination}`;
    const busPrice = b.price ?? b.fare ?? null;
    const currency = b.currency || 'INR';
    return `
      <div class="card" style="background:#fff;color:#000;border-radius:12px;overflow:hidden">
        <img src="${
          b.imageUrl ||
          `https://source.unsplash.com/800x600/?bus,${encodeURIComponent(
            destination || 'bus'
          )}`
        }"
             alt="${operator}" style="width:100%;height:150px;object-fit:cover"
             onerror="this.onerror=null;this.src='https://source.unsplash.com/800x600/?bus'">
        <div style="padding:12px">
           <h3 style="margin:0 0 6px">${operator}</h3>
          <p style="margin:0;font-size:13px;color:#444">${source} → ${
      destination
    }</p>
          <p style="margin:6px 0;font-size:13px;color:#555">
            Depart: ${b.departureTime || '-'} • Arrive: ${b.arrivalTime || '-'}
          </p>
          <p style="margin:0;font-size:13px;color:#555">
            ${b.duration ? `Duration: ${b.duration}` : ''} ${
      b.seatsAvailable ? `• Seats: ${b.seatsAvailable}` : ''
    }
          </p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
            <div>${
                  busPrice
                ? `<strong>${currency} ${busPrice}</strong>`
                : ''
            }</div>
            <button class="btn book-bus-btn" data-id="${busId}" data-operator="${
      operator
    }" data-route="${source}→${destination}">
              Book
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async function searchBuses() {
    const from = busFromInput?.value?.trim();
    const to = busToInput?.value?.trim();
    const date = busDateInput?.value || '';
    const passengers = busPassengersInput?.value || 1;

    if (!from || !to || !date) return toast('Fill From, To and Date for buses');

    busSearchBtn.disabled = true;
    busSearchBtn.textContent = 'Searching...';

    try {
      const params = { source: from, destination: to, date, passengers, limit: 12 };
      const res = await fetch(buildUrl(API.buses, params));
      const json = await res.json().catch(() => null);
      const list =
        Array.isArray(json?.data) ? json.data :
        Array.isArray(json?.results) ? json.results :
        Array.isArray(json?.buses) ? json.buses :
        Array.isArray(json) ? json :
        [];
      if (!busResults) return;
      if (!list.length) {
        busResults.innerHTML = `<p>No buses found for ${from} → ${to}.</p>`;
        return;
      }
      busResults.innerHTML = list.map(busCard).join('');
    } catch (err) {
      console.error('searchBuses error', err);
      toast('Bus search failed');
    } finally {
      busSearchBtn.disabled = false;
      busSearchBtn.textContent = 'Search Buses';
    }
  }

  busSearchBtn?.addEventListener('click', searchBuses);
  busFromInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBuses();
    }
  });
  busToInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBuses();
    }
  });

  /* ============================
     TRAINS
     ============================ */
  function trainCard(t) {
    return `
      <div class="card" style="background:#fff;color:#000;border-radius:12px;overflow:hidden">
        <img src="${
          t.imageUrl ||
          `https://source.unsplash.com/800x600/?train,${encodeURIComponent(
            t.destination || 'train'
          )}`
        }"
             alt="${t.name}" style="width:100%;height:150px;object-fit:cover"
             onerror="this.onerror=null;this.src='https://source.unsplash.com/800x600/?train'">
        <div style="padding:12px">
          <h3 style="margin:0 0 6px">${t.name || t.number}</h3>
          <p style="margin:0;font-size:13px;color:#444">${t.source} → ${
      t.destination
    }</p>
          <p style="margin:6px 0;font-size:13px;color:#555">
            Train No: ${t.number || '-'} ${
      t.classType ? `• Class: ${t.classType}` : ''
    }
          </p>
          <p style="margin:0;font-size:13px;color:#555">
            Depart: ${t.departureTime || '-'} • Arrive: ${t.arrivalTime || '-'}
          </p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
            <div>${
              t.price
                ? `<strong>${t.currency || 'INR'} ${t.price}</strong>`
                : ''
            }</div>
            <button class="btn book-train-btn" data-id="${t.id}" data-name="${
      t.name || t.number
    }" data-route="${t.source}→${t.destination}">
              Book
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async function searchTrains() {
    const from = trainFromInput?.value?.trim();
    const to = trainToInput?.value?.trim();
    const date = trainDateInput?.value || '';
    const classType = trainClassSelect?.value || '';

    if (!from || !to || !date) return toast('Fill From, To and Date for trains');

    trainSearchBtn.disabled = true;
    trainSearchBtn.textContent = 'Searching...';

    try {
      const params = { source: from, destination: to, date, class: classType, limit: 12 };
      const res = await fetch(buildUrl(API.trains, params));
      const json = await res.json().catch(() => null);
      const list = Array.isArray(json?.data) ? json.data : [];
      if (!trainResults) return;
      if (!list.length) {
        trainResults.innerHTML = `<p>No trains found for ${from} → ${to}.</p>`;
        return;
      }
      trainResults.innerHTML = list.map(trainCard).join('');
    } catch (err) {
      console.error('searchTrains error', err);
      toast('Train search failed');
    } finally {
      trainSearchBtn.disabled = false;
      trainSearchBtn.textContent = 'Search Trains';
    }
  }

  trainSearchBtn?.addEventListener('click', searchTrains);
  trainFromInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchTrains();
    }
  });
  trainToInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchTrains();
    }
  });

  /* ============================
     BOOKING PANEL
     ============================ */
  const openBk = () => {
    if (!bk.panel) return;
    bk.panel.style.display = 'block';
    window.scrollTo({ top: bk.panel.offsetTop - 80, behavior: 'smooth' });
  };

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

    function getSelectedCityFromButton(buttonEl) {
    if (!buttonEl) return '';
    const fromData = (buttonEl.dataset.name || '').trim();
    if (fromData) return fromData;
    const fromCardTitle = (
      buttonEl.closest('.trip-card, .item, .card')?.querySelector('h3, h4')?.textContent || ''
    ).trim();
    if (fromCardTitle) return fromCardTitle;
    return (qIn?.value || '').trim();
  }

  function handleTripBookClick(buttonEl) {
    if (!buttonEl) return;
    const selectedCity = getSelectedCityFromButton(buttonEl);
    if (selectedCity) {
      closeBk();
      openBookingChoice(selectedCity);
      return;
    }
    closeBk();
    if (bk.tripId) bk.tripId.value = buttonEl.dataset.id;
    openBk();
  }

  function handleFlightsShortcutClick(buttonEl) {
    if (!buttonEl || !ff.dst) return;
    ff.dst.value = buttonEl.dataset.name || '';
    window.scrollTo({
      top: ff.dst.getBoundingClientRect().top + scrollY - 100,
      behavior: 'smooth'
    });
  }

   function getSelectedCityFromButton(buttonEl) {
    if (!buttonEl) return '';
    const fromData = (buttonEl.dataset.name || '').trim();
    if (fromData) return fromData;
    const fromCardTitle = (
      buttonEl.closest('.trip-card, .item, .card')?.querySelector('h3, h4')?.textContent || ''
    ).trim();
    if (fromCardTitle) return fromCardTitle;
    return (qIn?.value || '').trim();
  }

  function handleTripBookClick(buttonEl) {
    if (!buttonEl) return;
    const selectedCity = getSelectedCityFromButton(buttonEl);
    if (selectedCity) {
      closeBk();
      openBookingChoice(selectedCity);
      return;
    }
    closeBk();
    if (bk.tripId) bk.tripId.value = buttonEl.dataset.id;
    openBk();
  }

  function handleFlightsShortcutClick(buttonEl) {
    if (!buttonEl || !ff.dst) return;
    ff.dst.value = buttonEl.dataset.name || '';
    window.scrollTo({
      top: ff.dst.getBoundingClientRect().top + scrollY - 100,
      behavior: 'smooth'
    });
  }
  // Trips list: book / flights
  cards?.addEventListener('click', (e) => {
    const tBtn = e.target.closest('.book-trip-btn');
    const fBtn = e.target.closest('.flight-btn');
    if (tBtn) {
        handleTripBookClick(tBtn);
      return;
    }
    if (fBtn) {
      handleFlightsShortcutClick(fBtn);
    }
  });

  // Search results: book / flights
  $('searchResults')?.addEventListener('click', (e) => {
    const tBtn = e.target.closest('.book-trip-btn');
    const fBtn = e.target.closest('.flight-btn');
    if (tBtn) {
      handleTripBookClick(tBtn);
      return;
    }
    if (fBtn) {
      handleFlightsShortcutClick(fBtn);
    }
  });

  // Flights results -> book
  ff.out?.addEventListener('click', (e) => {
    const b = e.target.closest('.book-flight-btn');
    if (!b) return;
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
  hotelsResults?.addEventListener('click', (e) => {
    const b = e.target.closest('.book-hotel-btn');
    if (!b) return;
    const id = b.dataset.id;
    const name = b.dataset.name;
    closeBk();
    if (bk.tripId) bk.tripId.value = `hotel:${id}`;
    if (bk.notes) bk.notes.value = `Hotel booking: ${name}`;
    openBk();
  });

  // Buses results -> book
  busResults?.addEventListener('click', (e) => {
    const b = e.target.closest('.book-bus-btn');
    if (!b) return;
    const id = b.dataset.id;
    const route = b.dataset.route;
    const operator = b.dataset.operator;
    closeBk();
    if (bk.tripId) bk.tripId.value = `bus:${id}`;
    if (bk.notes) bk.notes.value = `Bus booking: ${operator} (${route})`;
    openBk();
  });

  // Trains results -> book
  trainResults?.addEventListener('click', (e) => {
    const b = e.target.closest('.book-train-btn');
    if (!b) return;
    const id = b.dataset.id;
    const name = b.dataset.name;
    const route = b.dataset.route;
    closeBk();
    if (bk.tripId) bk.tripId.value = `train:${id}`;
    if (bk.notes) bk.notes.value = `Train booking: ${name} (${route})`;
    openBk();
  });

  // Booking form submit
  bk.form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: bk.name?.value?.trim(),
      email: bk.email?.value?.trim(),
      phone: bk.phone?.value?.trim(),
      travelers: Number(bk.trav?.value || 1),
      notes: bk.notes?.value?.trim()
    };
    if (!payload.name || !payload.email)
      return toast('Name & email required');
    if (bk.tripId && bk.tripId.value) payload.tripId = bk.tripId.value;
    if (bk.c?.value || bk.route?.value) {
      const [source, destination] = (bk.route?.value || '')
        .split('→')
        .map((s) => (s || '').trim());
      payload.flight = {
        carrier: bk.c?.value || '',
        source,
        destination,
        date: bk.d?.value || '',
        departure: bk.dep?.value || '',
        duration: bk.dur?.value || '',
        price: Number(bk.price?.value || 0)
      };
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

  // Fallback global booking click for trip cards
  document.addEventListener('click', (ev) => {
    const bookTrip = ev.target.closest('.book-trip-btn');
     if (!bookTrip) return;
    const clickedInsideKnownContainers =
      ev.target.closest('#cardsContainer') || ev.target.closest('#searchResults');
    if (clickedInsideKnownContainers) return;
    handleTripBookClick(bookTrip);
  });
  document.querySelectorAll('.image-strip img').forEach((img) => {
    img.addEventListener('click', () => {
      const theme = (img.dataset.name || '').trim();
      if (!theme || !popularGrid || !popularPanel) return;

      const themedPlaces = SCENIC_PLACE_GROUPS[theme];
      if (!themedPlaces?.length) return;

      popularGrid.innerHTML = themedPlaces.map(popularCard).join('');
      attachPopularCardHandlers();
      popularPanel.querySelector('h2').textContent = `${theme} Places`;
      popularPanel.style.display = 'block';
      popularPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast(`Showing ${theme.toLowerCase()} places`);
    });
  });

  /* ============================
     Boot
     ============================ */
  me();
  loadTrips();
});
