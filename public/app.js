// app.js — frontend logic for Tripease Explorer
const API_BASE = ''; // same-origin requests

const ENDPOINTS = {
  trips: '/api/trips',
  airports: '/api/airports',
  flights: '/api/search-flights'
};

const cardsContainer = document.getElementById('cardsContainer');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const popularBtn = document.getElementById('popularBtn');
const toastEl = document.getElementById('toast');

function toast(msg, ms = 2000) {
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
  setTimeout(() => (toastEl.style.display = 'none'), ms);
}

// Fetch trips
async function getTrips(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}${ENDPOINTS.trips}${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error('Failed to fetch trips');
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : data;
}

// Render trips as cards
function renderTrips(trips) {
  if (!trips.length) {
    cardsContainer.innerHTML = `<p>No trips found.</p>`;
    return;
  }

  cardsContainer.innerHTML = trips
    .map(
      (t) => `
    <div class="card">
      <img src="${t.imageUrl}" alt="${t.name}" />
      <div class="card-content">
        <h3>${t.name}</h3>
        <p class="stars">${'★'.repeat(Math.round(t.rating || 5))}</p>
        <p style="font-size:14px;color:#444;margin-top:8px;">${t.description || ''}</p>
        <div style="margin-top:10px;">
          <button class="action book-btn" data-id="${t._id}">Book</button>
          <button class="action flight-btn" data-name="${t.name}">Flights</button>
        </div>
      </div>
    </div>`
    )
    .join('');
}

// Initial load
async function loadTrips() {
  try {
    const data = await getTrips();
    renderTrips(data);
  } catch (err) {
    console.error(err);
    toast('Error loading trips');
  }
}

// Search trips
searchBtn?.addEventListener('click', async () => {
  const q = searchInput.value.trim();
  try {
    const data = await getTrips({ q });
    renderTrips(data);
  } catch (err) {
    console.error(err);
    toast('Search failed');
  }
});

// Popular trips
popularBtn?.addEventListener('click', async () => {
  try {
    const data = await getTrips({ q: 'popular' });
    renderTrips(data);
  } catch (err) {
    console.error(err);
    toast('Could not load popular places');
  }
});

// Booking & flight actions
cardsContainer?.addEventListener('click', async (e) => {
  const book = e.target.closest('.book-btn');
  const flight = e.target.closest('.flight-btn');

  if (book) {
    const id = book.dataset.id;
    const name = prompt('Your name?');
    const email = prompt('Your email?');
    if (name && email) toast(`Trip booked successfully!`);
  }

  if (flight) {
    const destName = flight.dataset.name;
    findFlights(destName);
  }
});

// Flight search
async function findFlights(destinationName) {
  try {
    const resAir = await fetch(ENDPOINTS.airports);
    const airports = await resAir.json();
    const source = prompt('Enter your departure city or airport:');
    const destination =
      airports.find(
        (a) =>
          a.city?.toLowerCase().includes(destinationName.toLowerCase()) ||
          a.name?.toLowerCase().includes(destinationName.toLowerCase())
      ) || { iata: destinationName, name: destinationName };
    const date = prompt('Enter departure date (YYYY-MM-DD):');

    if (!source || !destination || !date) return;

    const res = await fetch(ENDPOINTS.flights, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        destination: destination.name,
        departureDate: date
      })
    });
    const flights = await res.json();

    if (!flights.length) return toast('No flights found');
    alert(
      flights
        .map(
          (f) =>
            `${f.carrier} | ${f.source} → ${f.destination}\nTime: ${f.departure}\nDuration: ${f.duration}\nPrice: $${f.price}`
        )
        .join('\n\n')
    );
  } catch (err) {
    console.error(err);
    toast('Flight search failed');
  }
}

// Start app
loadTrips();
