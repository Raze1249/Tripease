// server.cjs - Secure backend for Tripease
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const axios = require('axios'); // For Unsplash API

// ---------- ENV CONFIG ----------
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// Unsplash access key (for /api/unsplash-image)
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

// Optional Aviationstack keys
const AVIATIONSTACK_API_KEY = process.env.AVIATIONSTACK_API_KEY;
const AVIATIONSTACK_URL =
  process.env.AVIATIONSTACK_URL || 'http://api.aviationstack.com/v1/airports';

if (!MONGODB_URI) {
  console.warn('⚠ MONGODB_URI is not set. Set it in .env / Render environment.');
}
if (!UNSPLASH_ACCESS_KEY) {
  console.warn('⚠ UNSPLASH_ACCESS_KEY is not set. /api/unsplash-image will not work.');
}

// ---------- INIT APP ----------
const app = express();
app.set('trust proxy', 1);
// Hide Express signature
app.disable('x-powered-by');

// ---------- SECURITY MIDDLEWARE ----------

// Helmet: security headers
// If CSP causes issues in dev, you can disable contentSecurityPolicy
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

// Strict CORS: only allow your frontend(s)
const allowedOrigins = FRONTEND_URL.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow no-origin (Postman, curl) or allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS: ' + origin));
    },
    credentials: true
  })
);

// Parse JSON safely
app.use(express.json({ limit: '1mb' }));
// Parse HTML form submissions (contact form, etc.)
app.use(express.urlencoded({ extended: true }));

// Parse cookies (for JWT auth)
app.use(cookieParser());

// Prevent MongoDB operator injection
app.use(
  mongoSanitize({
    replaceWith: '_'
  })
);

// Basic XSS protection (clean HTML in body/query/params)
app.use(xssClean());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// ---------- RATE LIMITING ----------
// Global limiter for all API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500, // 500 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', apiLimiter);

// Stricter limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { message: 'Too many login/register attempts, try again later.' }
});
app.use('/api/auth', authLimiter);

// ---------- DB CONNECTION ----------
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}
connectDB();

// ---------- STATIC FRONTEND ----------
// Serve your public folder (index.html, app.js, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- SIMPLE HEALTH CHECK ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ---------- ROUTES ----------

// Trips (MongoDB)
const tripRoutes = require('./routes/trips.js');
app.use('/api/trips', tripRoutes);

// Flights (mock search) – uses in-memory airport cache optionally
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// In-memory airport cache (optional)
let airportCache = [];

// Fetch airport data once (optional; safe even if it fails)
async function fetchAirportData() {
  if (!AVIATIONSTACK_API_KEY) {
    console.warn('⚠ AVIATIONSTACK_API_KEY not set, airport cache will stay empty.');
  }

  try {
    console.log('Attempting to fetch airports from Aviationstack...');

    const response = await fetch(
      `${AVIATIONSTACK_URL}?access_key=${AVIATIONSTACK_API_KEY}`
    );

    const data = await response.json();

    console.log('AVIATIONSTACK RESPONSE:', JSON.stringify(data).slice(0, 300));

    if (data.error) {
      console.error('❌ Aviationstack API Error:', data.error);
    } else {
      const validAirports = (data.data || []).filter(
        (a) => a.iata_code && a.airport_name
      );

      airportCache = validAirports.map((a) => ({
        iata: a.iata_code,
        name: a.airport_name,
        city: a.city || a.city_iata_code || 'Unknown',
        country: a.country_name
      }));

      console.log(`✅ Cached ${airportCache.length} airports.`);
    }
  } catch (err) {
    console.error('❌ Fetch failed FULL error:', err);
  }

  // ✅ 🔥 ADD FALLBACK HERE
  if (!airportCache.length) {
    airportCache = [
      { iata: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India' },
      { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India' },
      { iata: 'BLR', name: 'Kempegowda International Airport', city: 'Bangalore', country: 'India' }
    ];

    console.log('⚠ Using fallback airport data');
  }
}
setInterval(fetchAirportData, 1000 * 60 * 10); // every 10 min
fetchAirportData(); // initial call

// Airport autocomplete
app.get('/api/airports', async (req, res) => {
  if (!airportCache.length) {
    console.log('Cache empty, fetching airports...');
    await fetchAirportData();
  }

  res.json(airportCache);
});
// Mock flight generator (deterministic)
function generateMockFlights(source, destination, date) {
  const flights = [];
  const carriers = ['Air Tripease', 'Global Wings', 'Oceanic Air', 'SkyPath'];

  const seed = source.length + destination.length + date.length;
  let random = (s) => {
    s = Math.sin(s++) * 10000;
    return s - Math.floor(s);
  };

  for (let i = 0; i < 5; i++) {
    const departureHour = 6 + Math.floor(random(seed + i) * 16);
    const departureMinute = Math.floor(random(seed + i + 10) * 60);
    const departureTime = `${String(departureHour).padStart(2, '0')}:${String(
      departureMinute
    ).padStart(2, '0')}`;

    const durationHours = 2 + Math.floor(random(seed + i + 20) * 8);
    const durationMinutes = Math.floor(random(seed + i + 30) * 60);
    const duration = `${durationHours}h ${durationMinutes}m`;

    const price = 100 + Math.floor(random(seed + i + 40) * 900);

    flights.push({
      id: `FLT-${Math.floor(random(seed + i + 50) * 99999)}`,
      source,
      destination,
      date,
      departure: departureTime,
      duration,
      carrier: carriers[Math.floor(random(seed + i + 60) * carriers.length)],
      price
    });
  }

  return flights;
}
app.get('/api/buses', (req, res) => {
  try {
    const { source, destination, date } = req.query;

    if (!source || !destination || !date) {
      return res.status(400).json({
        message: 'Missing parameters'
      });
    }
app.get('/api/hotels', (req, res) => {
  try {
    const { location } = req.query;

    const city = location || "Delhi";

    const hotels = [
      {
        id: 'HT001',
        name: 'Taj Palace',
        city,
        rating: 5,
        price: 8500,
        currency: 'INR',
        description: 'Luxury hotel with premium amenities',
        imageUrl: "https://images.unsplash.com/photo-1660145416818-b9a2b1a1f193?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8dGFqJTIwaG90ZWx8ZW58MHx8MHx8fDA%3D"
      },
      {
        id: 'HT002',
        name: 'Hotel Grand Stay',
        city,
        rating: 4,
        price: 4500,
        currency: 'INR',
        description: 'Comfortable stay',
        imageUrl:"https://images.unsplash.com/photo-1620210357906-ebc7c3f18012?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Z3JhbmQlMjBzdGF5fGVufDB8fDB8fHww"
      },
      {
        id: 'HT003',
        name: 'Budget Inn',
        city,
        rating: 3,
        price: 2200,
        currency: 'INR',
        description: 'Affordable rooms',
        imageUrl: "https://media.istockphoto.com/id/2246675945/photo/cozy-clean-minimalistic-and-comfortable-brick-and-wooden-cabin-hostel-bedroom-prepared-for.webp?a=1&b=1&s=612x612&w=0&k=20&c=KcEavx94MElD0vHwvbP5P1vxcCFycH93EiOBkNPTuqY="
      }
    ];

    res.json({ data: hotels }); // ✅ IMPORTANT
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Hotel search failed' });
  }
});

    const buses = [
  {
    id: 'BUS001',
    operator: 'RSRTC',
    source,
    destination,
    departureTime: '06:00',
    arrivalTime: '12:00',
    duration: '6h',
    seatsAvailable: 25,
    price: 500,
    imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvEtE4BU8hmBO3VjiKhhJkiAzUfJ7C09zjQwuH63ny3v_jnsJ6SdBtYOuT-VZzVhY4ozK340rJVP2Kd-nneNF6zHrbaIOI&s&ec=121585077"
  },
  {
    id: 'BUS002',
    operator: 'Volvo Travels',
    source,
    destination,
    departureTime: '09:30',
    arrivalTime: '15:30',
    duration: '6h',
    seatsAvailable: 12,
    price: 850,
    imageUrl:"https://www.shutterstock.com/image-vector/volvo-icon-logo-sign-symbol-260nw-2412641097.jpg"
  },
  {
    id: 'BUS003',
    operator: 'RedBus Express',
    source,
    destination,
    departureTime: '18:00',
    arrivalTime: '00:30',
    duration: '6h 30m',
    seatsAvailable: 8,
    price: 700,
    imageUrl:"https://i.pinimg.com/474x/61/49/06/6149068bc75957cf93f1821004a408be.jpg"
  }
];
    res.json({ data: buses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Bus search failed' });
  }
});

app.get('/api/trains', (req, res) => {
  try {
    const { source, destination, date } = req.query;

    if (!source || !destination || !date) {
      return res.status(400).json({
        message: 'Missing parameters'
      });
    }

    const trains = [
  {
    id: 'TR001',
    name: 'Rajdhani Express',
    number: '12951',
    source,
    destination,
    departureTime: '07:00',
    arrivalTime: '13:00',
    duration: '6h',
    classType: '3AC',
    price: 1500,
    imageUrl:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ4LFkQtUPwQujFKFipahSTg2g12gLqs-Xg8Uv2k0TaGavopzcod_sukCKyd7p5DNqJplt7SUjOiAPkS8chJbRUqa6HdnrC&s&ec=121585077"
  },
  {
    id: 'TR002',
    name: 'Shatabdi Express',
    number: '12002',
    source,
    destination,
    departureTime: '08:30',
    arrivalTime: '14:00',
    duration: '5h 30m',
    classType: 'CC',
    price: 1200,
    imageUrl:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTqeEP7D7elrJWPHc1H6NwStJEf65v_M_4_IptKsFoh8-KBivdyShAFEy1Xk3HdGgS_Uqk6VfZ9SXHurS3LpRTIFMKirGDC&s&ec=121585077"
    //imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRhHISjGXtZ9flnsGmTWvUa-PPWLh8vDnxaWMISd4-oI4YBDC0z_NNhQGXWomXvsq5_3ej1RAKYomIjA7h_o-KpmDZiJtKx&s&ec=121585077"
  },
  {
    id: 'TR003',
    name: 'Duronto Express',
    number: '12245',
    source,
    destination,
    departureTime: '22:00',
    arrivalTime: '05:30',
    duration: '7h 30m',
    classType: 'Sleeper',
    price: 900,
    imageUrl:"https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ1cRhx8M0dnkRlWsguphIYfCLwiBz1FgwB_WOWoH9C1rH8vSu_XqQPlKp_gqHh3lDNc6LLQAUGZwqaLQtX33uq7CIMlKu9&s&ec=121585077"
    //imageUrl: "data:image/webp;base64,UklGRqofAABXRUJQVlA4IJ4fAABQhQCdASosAagAPu1mqU8ppaOprTWcKTAdiUUDYB5dA8IW/chCd/5Py1fl+QXhLjkx/Pf5Hvn/P/u/lv3Z/kvBX+x9uP/H7/fmbqI+098533zGsLvDL+r9HXFOeu9Mr4NP3Px31z5Tn9TG7NvBLSgAX8/w7C5rkO+cah/MBHstw87HKkXywqX+gZ8B3wSmEKqDu9/1/4KVpfeq9LJUofuil8b6wW7f+5fue2BzSf/KshlakM8cNs1/yD2uxy5hwp/yw1iCAzKxPW1gbso4uEkZnGPW4mgysKLCGcB/+kxv0e1RbnxqWepv/t2//8Tv2BNjXCbpizPD/b5IrXee+6qCrKr/+llCv449YKIT9hT8k6p/37hBlstuCxxXwimgdI24c0l+D0gFz33+enHEWj28HAuivJgcV9ZyUO9WPeQ9vx+iJ//zJp/1fd1vEW4f8ed+/gdI+jnCa6RA8GxzFIl6lv4zu90/vi4PiZqqipkXdPFxxnleIYmQeCaUDmlIuV4hPF8g0mqEQMXPvBz4cf8AC4L/ak/SnJL+Bd3+/YuhrEfdmBh5vxfx601vbGTkp8EQyavSW4UhGnS4oMreeHU40um3gZzyiC3+VNBKQr71lZqEOqqDt2gJlSbD/9Ajybq2szISyPWGeReka8NtyU+VDaeP+RnJP/VoubbYG+Av9hkGAvnZ11Yy3s8JLMmZvvkms09Bq49KYAiEMTfgdqjoNJWDWcZjXtiGWTeZ7tDiwvQDdTokV8ljMpck/BSfNGJnUx96MCbjmve+rndydw89LfGi9Ods0Duf6GR0rw4SAlZATs12CD7rC3En3oM/WT8/vQNvXtGGfO10FyigrV03fLDRDuJbgNZInVCvuoWoelWC1N2z+CB051NBWx9mcdEtxv2nfEJFejw3T5bVI7h1nrmohpoMyXv9qAkzLATi/xQWqIhCFC0wjWXiCI3yVPfYdQqYiZycDxPiCvhCjwwsx0H17hKnv/k9L91IyakgnsBH+UKn3qlg0VZF85h++ji39WbXjEqHUjqSvPy97jmzC+zTuMf1J7eY8Usy/ZBuGx5aR3NMcu39NsLkb2JfoBH3YWh4IKHe8ElYkKI8Yug+gzryoPFhmUFvuXcg3VxjsRXGvEHMvnMvVuLYGyPa1rKL/QKAf0zxiSdaiOfvePnrATnwpcZaTkv+HxHi0st0bvYM2bXhtZnELsS5F2/DFxniZrw2tD2NU7RbpyQuAzX8P6eBDES/Zt5ksDeZHVvNPNl0+eKn6/Yk3e71lwoprxfiVBxOof9vuUFNXqUNIrenzNkhKULvJwauAMv84UQCtB6IsKTPaIMHncy8RzpKPs8Yuzm/3zFJQf7aGElSC0JkWwXvUt/ehmrGhJCxMzdgUYa4g2C0DV1eWyt+vwv7FGlsul1aF6CrvkGmgEGp9PnY3y8AAP78ytv9RFCgdv+BOa5auDWYBz+Bdq/CGv9UxGufTGfHk9L9JwRRndB1/XASJmEn/DkAgKEAtJ/z/l74aJc0yMZMdNH+BPlx3XnyllO5zDlHzt7xCmRffxRvsbF2cb2BbOthVR/QcbS1WblPvpAXEcDbOzYKh2YoSidBCzfaJTty5xU23rgMttAItRFUAJCYpmzjca7O0DrcUvtoIgA7hXO9fBuGiG+9WwKXEhjxWUzZh86w5C2oKZ8wTp9waD5CXc7Ba9+m6ljw1srPKdbNmOANZpgHCkCSglpUeZZcWnHKwLmho7VLPfrNWqtalp1LgO31yYWB0iKzTRV3zkOVOFC8khgXfezZqe54JEb09mPVVwkhmOoTjQ76vYDFuC2ooTwaS3cIzFeNbhBYvRtPixy0FLMwOkVnf5IMIrwmMLMMwtDqjSMV7t/8K48aD3EuS3mmd47D46Yt00ZK0a95Jmxca1A7leeFQLXOm3g+wnftV34IXSmm6Kw0yYByBi8g0RyKU3kQFaHSOefIygvB8/JNbEd+RwjgdVNbvYCEkcYYuNdNhDm3n/syfpZb6CcmbsaObSf08t8vV/BWIEN3dDk0CYA3qMxQrsrMQ3N/5yC7K8vkF11BusYXU0JXz7SynFbdP2OH5q5SXLMQlDBsxJQ4pAS0dA2VRDSuMRzy6JiSpp0VzHc0rnAQq+SZCkisuEllaom6e5zRw5rKz1phQM3hCcpTwBOvn5hKN52lsuOwK/XKw+5OciVXYGbLhoMHKZWA6p6oS7cmu0at4tEgW+obbMje/22VenH9tKvZSG14To39wQn1ijCgZqSMO6UubnSD5/ZHYygKGIJrfO/+w7tG8ali8RERakkeQ2kp385yo8NNCSW877rQM59oRPdl5p1YMyu5bIYDdo2miARF5WNBWENMD9TjfSVXuXz1zqLiuK1hSv2HPxvIL8gZf1nIlD91M07Aa//vjhmmhQYOMPbiRP78Djm1QCTKf62tZdJV78IOf+U4tT6yiLRj9/OuHx7w8DZYL2CMINh7Eu8TROspNtqxzE5z0ellBNAKLec7jZz/Qbp+U+Vgk2UkRlwhV1+2K6ZJ1n9/A4h30qvqDGAX0+T9JcuhUtIxfu/+N6ZEL+rXmgWWNOWYyquqELGbWT86Ey/lge9TfKPbcY3dPuOk4dgiVLgJOkiEgGKpBlbLXXzBNgOhPrYwWRfD5Myda1DnirfEbMRK03bELs9HznJIHYYvnNHMj/zw3fUYYwuoUNUZ/qgmdOddGS3J5omv413aRFMMUk1Yp7SROPxLLZxDW26vvNqbGHTwIY1ZyXOv/bO6Ai90BHSO5RXJHq1RmG20Y9myBu+IiLHfXfJc5KqW92U5TBlROOaWo/hb/tw7aqbdOJ/DCF5Ypl6n0bFehhstbDjmcrhV673ZQWaBnyG2wUzXLMw08y9QbcZlFQtJTdUIwtDKryGZ8M/ZTZ/EUcituHFA7ZUQPLvCKHNaLcdGEUuSXuIQKE7jAqYqpevaFnG8Rm+STO7gwKBdqIsEzgIW5MrL7YdSUImgOutp5sVQ2ugjOv6LYBgSdrQ2OjrXZWzwfDeuhewspbzLGwEFd7gabKQmdDcZYXWlb6X2DaDrPBXmi11OMuswyQOSBKmtmSnrms1VKz6+Zgy7u+c+5EIlKOsouhV3Br0DgCkDIda55BBrIaeyoeJEpXdPTegCojT9X9Qq0lXQB0WshEt7I32pmP57COPQAy9WSOYhNgVUDCM5Rmyu+J+p+FGsnh4l54nHEqy5W4VgO/2t/sjqltEyrLHbxYa56eTa3KBID77vmtUJzUe/q2IFIzDjfQRCWqs34Yw7jjyVeWfuxLvhLDUjWPf8xrFhmqR56cMJIBCszcx4bTgLlIPeFPoAeb0r9vlgFSrKKTHfSbtZ3Z2BPKAm1TIXySMBru53nN4d9uRo04XZa7qOprnRgtqGe6J6ahdXPCGGmzZIX+qx2kVR0O/Fqcy7oslbfv8xDiK8r9W/+kjfvFa7j5Ofkoi95nw3ECwZ/EeOjc+J1j3GkmK6fLCZKxWwvMSnB9C9TqNLvaMSbb00XhMza/qq6yLQAQ78DwRkweYFXMf8MPmbr4CTzTuq7QyFPxUrrTaIs5IoNGGCFdNN2S2nHEofY58z4tLNMoHQi+/JeJWldNesyPhiTDemQHa+44P6+jWnDMW4lR4AJT0ta3NR7weLlak9b4yO0WW0bCmoqn7Yey9sXIHjHR8U74yI28SC8QKg1A+DvLH3+QmGHlAbG9+fvoZEMayE0xC3BwBMeWzU8a3j7bX4U/IEd25jYptgcPzoVQrk3XBr8nlE7mwqbUUGofa0S/Z3LPEFbcM6kJ8KNDhiFGAaUtyH/zdOKxxurxP2LgjkRky0H9RHXOVpMCIVFpQ984vLcQ13gv6Av+MegVJhMKOBTlYBdKNbszBCuA2axwRoETMiXLhJ1EV2/+Cvf5zNcJeAfZmM9GHFLr0rmBdfZOxPIuI2gRgkGeErmMl+rY2qb0CXEMy4D4D2baJsttKRno2pR8LI9cTTEkRa6uZtQu/snIC5kU4jzRu8fNJMN0BA59UQCerDwDnttqcHnSZiEttBR4OuI3jGixe1UxQiKru2pkcvJIab7kuzcxSU03kDEXQIk7uuebn0sdleDAEOmF20p4tHZW3kb8OvGSyDXYHp+/dgZV8ebmsMawm0SM+UCDPYSyuarjHvuuevoxF/JQj8LA3fxhTbooTZdPQoKvRt2An9MXRj8Hy9GVddiZzI/wGiS82hbnocIwfzKrChAeteAmxGOjUI/nRarWkJfVZANV2Q0sAzG+byJ2nVlVL8HISSAcO4Xs5n5JZLThZfyMvLxP6MLimyJEPP3oKxOWxJdXoexgk+ZPfjj9lId04YxkTEbvFBNQTlcR3R9Q5LPydtcGLbLBTX42/IhdRGe/QekGxlIDIEkRgPgFMFi0l4KAoBh/f+VSSjP35fCCcQ0cuT3xlDs27Mo/MgFe25CowXxvMeYKuD8Q0tSZRjconaU4fdVuix7LIxMShUQw6euu2vjjtKoMUwOLm387yWlR1Zuu9ZHPnRhgwGb/RrRh3igl3rww10aM3jKEeYtdnbcl49dJfnGzlSkPwUpCNdWy04PmTY40ug7g+b/3jx73Bw3ocBgoLp3EmOZgYCAmbhYmRyOB6HBqqhpaPBFwhVS8OOBaTe9M0CWcieCW21GaO613hQvMhPvcZKiIKMwY9fL1JW7PZLfCiYXeYCA8wZrDd2yOwU/NJU1VWap9FyPDT3kInhPV4S/vrH73cMbxy4elHsme/mnkepBpGOiRj+ePr+z9BTaYMoPsSrkNF3VbuEYQYt8ZXtN0OOrP0DvqB1ygxg4n/w49PEAcyaf+/aZ9/HI8qWkadxPiJIUOf0fPp+MhiAzhdshbI9cR7SlZizV0GnxZmVYylNoK1qM44BFeegPrYprIM41Aj4aMgRyqjapa4XFA7hYW2ZcUCh0c2plO/gNEc+iJGhKE+PX+imKnsFAGQr/b2XkghMMKz3E3el08u5z1GjlWfl5GbxSv4glTtLnsxJWz5mXArjQgEIWeWjFy0hQHgAlFv9snuhecIgb7ySIuDA2mkWQmiyyYcdX5rE8BqNQQX3XfvFa291xeBeQy0U7p2PRinLE+3ctX4qalS0OtuTv32JpleGFK8lEDgB66EnRjK6iIShvKkKNZlQb2kKv6Luh8KN+dsga9409YkHdrMuuIa3Q2fOo5cSlcivMwSX/TS/y4wnF6MO0lFprYL2bNp0gD8QCy6QuUvtmCtRLIhgZTMIb5w6YHQ19h6zC8CCYT+gMAbN1CTWSUB1rq14NmmAoteiHKOAtxeldp3fMrBSmqgkOQ1DXoNE+Qphza+2fISgT+C4ADDisRzPjmdAFiFuHwQRsBNBllFIaV/3n/HnpiWB44jzly8+w1BPFCzlqXfMiVzzp6VT4+mJwTWhv81RvsnJpRmrEezxVooUnKw+OLJsjk+IljauC5o2cdUvsdfbq5bDnPMFDzB+9Y5Wbv8NY9pa/DPh9Mcq+sq9GKmFzyBAAL35UeyIJA8hxh14KA3c9NV8iB7UZBgn5yvtEMZo/kRozDu8cPQSM4oDwRolEG6EqqfYcmvxnF1HWBnF/4MkAKgF/jUpEQg1djivtvACr29a/e7EbW6JK0HAMVV1OcgQSkPuhA3Ym3Ru6by9qvrPe9lqOVpR1FWPstlDlS55pSEkv8rYrCKq2p5kWYFSUfMMq6n0M8eVm9pZkfI587ETnF0IWgByGSmBJtvFPGQYZPqyHxugMI+VIbWEBAH2eRZKZ8DCOCOuYv640GRT7r4GI2zDttoqYhXNLTXZKqqh8k0x9ITi5ra1qSi7AumB+EtE2IK6hrnjrV6e+V20Gzgl+b3dzWqorscyZxWkKhpFPhqgzxCwfuUTZgi6w7MUHMaH0ZTHUuUl0TnHLFSGQ+Rq4s0Bjbn+b2caVB5QiUmoW2bCuUh96iDEli5FmhdT7t5fcdLc+ZJW5PZGOP9GKFYr0YqmgzkC15Ny0wYFmGVdncgcjJRRE0MeKEx1aMDZ8QK/Fk5RNb6exs2xnixDhJk+Sh/jA9CHcEVd2DnyI5XLJjrWIy10Z+85qp9PzcgOCQbwhbyN2E8A6YgIv/vvoQVnlmhQ21A2CoXuWjPKjXnm9yF98x451159aIbNclPMnRy9AU+QGedubt3QBKF9AxA7lPJRfD7GmjCK6GMCzGWBbEtmC9uRc8b3YdLMGYm2Nwh82Z6DETt2vL9pawVwE8uLdNEr2C/r0bEb2IXM3eFYYsEqJ4r9YDZOMpgJvVN/3zD6bEOC3UU2hTybyPgzxSfCuD4+iAcsCKO84SSeL97vb8oL8UFnmPS2hKKR098dVMXx43Ma6hZORnIesYwQxf8Wmv6x6KzApKB1Xb/JbAX8D2n+xeywhZIq5IpPl8Bnhv4RA1JVEYzuCW9y829P29so2dDizQLP1bDuObDXl2awUSPvnRVHXQDEUF7dB5TQzfowHJT2CfQ/u9Z/KeKo1A3lfJ2hqDhTXNKjwYzvNBeQqPsonoXfurgJSYsdp/CNXT/HKDMd8brUG5UF+w5G0eGIhP/V4UCgAJceWjJNmoMxzsLR5RLjNn8G8z3D12d4YdDQt8umOOVBI3anAAXjHu+mVl+CAVYy8JwrvZDEqapgWjG4wv/8Ol7U+1KI2dwYk+o+JpctAaKL/Rfw20kAsGa5SVGpMKOIkm6h1FHY/KeWKCIAx0DguuOJJJQISL5AX+lJGhIjPd23EAwVetVUflmTxNQmyrdK+kwA9DR7Y6izd50e8sCUVIOsgzTWu6ahsn6UMPA8henCs4xdIyjC6je8WCQJJWX0aFWoh/YmvCk9huFOlWEtRZttL2CqrHRaP3TS0qdFo1IDLYCyonWCCMKNCq7JlrY2x087OeLtN8OZdDkbOPsqNAfklN7vxhadA3X1x8setcv3VnY+ua9hhI8FmYGv7DpKRpdg+82IXDK2MbJPqOwFfaT3Mo82+PHIrG6lqnyXytUcnfqgrjQjsj8zVf3gMszSKt4o4nKYgDEa5Q2e5j3XTHtfrNiqG+t8Pb8AwNcHHqCDtQc87UjzKlTseL0T9/UZjmHfSZQrF+zYBu0gW0z4t1KJK1Etyhl2KuDHxSAplUTIonxb2sSSSQzXBWWV38DyuDPLqTTztodC6Tmh5fd7vag13uCl00PYBs3zriX7IbfWABPPfJkrLdUckmxwC5RYIbmIsNagehcBBkJzds1JGJsjVTvDrxSjlo6mpkdN+ss6NG3wrl39za+dvJB/0oOmJbWRlRriLB24iIh8xtNKQ8IzFpzOnQXMIFcVxF8670jMHXVKB5GKaDK/jRgVQpanclaLcE2lGvVmWYo0SSxdnBoW1FG7R3o46WGTuZe8HOrQcNGjEyTn2fJblENFQviQtxOUlPaVQh7iTNjgzSowDWDm0g8wtT5i1ESKynkqz1H+8GDpBHCcKbUUDP6r0k+NnlLjlQo/pW+4XhlFQGMce/uFg+bY60vno/bIp649aiU1ImiHRwxeDv/gCjhdUep5WrPOn4/Bf/mIQDnwmANW+TXsvTkwuYIpEKGTohV4NfGUzlzKEAg9RUIk3hjfKajLPLBy+utJmwsE/iy41Oymtm4fVWduWR8qCPkGufmdnXr9WiNq5+opkGcV4Mf7Tx2SCOAjRlq7Svl1G6oh0OUTc19u2z568W0zWsoJRre7a6dTs3bJdKvK8XZI1q8kgQkOwUestedsyl+7hvpyWNp/sC1s9NsBVQ6/wRlQAuxTt5jVwWnNVRIh+2onYVENRJdLKwExEwz1Uoun1QDotm6hUFzCZbJrIKhJuqthsxCttgrUB5SsG1PrEnxTHCzd1i4NH9Edd1/A/cE8HY01gSNGvtlwGxiALUuPNmRGj3yZdw1LtwZ8e//HPs3CRyyBgaoPHLeUzvLLgVbxcIrQR/pYZqSjReehfkrJOlOuupx/m74rU7v3yHqj+tbNii4LJoZXhWFXpwhO1fb0WuHg2AvQe6H14GVLYpjnex2CanRX9pjACNFs1jdjrIdvkPWV5U7qfjIqWS4NUh4UBFiuMiZ5NvEVSPhn+d0aiKpUopCxT1D4aEIEgnUksJzzGRkYG2splPgJoSHaVX5jBSopJ8OV8fPpTk9v4EYAQIQexGqrcxsxpSGGb5dIHqmec/1tI9Haufl3G4ZMl49rLI1iHdYsPb2gJcghykaF9kqab40ukvXgiXE1Gr4ANzATicg/uLN7d63ihPyFPvfSoxqZp0Lfw8he4ir/2sOp4DSMEbPSoE37OvbkcOl6uAfPXz/ig0+6tIzXTZiQ1vJlO7a0ND9rS9DSfKUAmw2/zr+xmr6VH90xJA2vuqqHXdj7fN3NcXn+OiixDdNNzLr0FUUpufV45dpe9Y7G0eZC5gNvYZrw5e+zQuLjCJJoHAfu03BA5EUdhNu2iRYjGssGwCTq6Ssqkxfmf1Hn/d8kp4Zfgy9+vuPbUqrz6EDazAgaPU8dZlV/1sOL/b/zToiHriCX1Yw/HHCHmXjex5/k2+wqYKWTiOqbanx/zMVHrDzPACy3ky9aGp6p2pdHAuhNKXSnDsWZBNBAMy47pS6cV5nC+54u0Cv7WozPAAIEWZil6agf4HxNOzSTVfbNBlxpK8JPD6zxC40x+ADQAnLOEcRqduyxYPO+rhmnb9nYrT4jXg2dFSU76qxANgfG1GFnEN6xBT4UVL1DzJEKW1qP1VTfqwxqISPg3BABzEUO/eL2QgXK2gw02MBWWPHDsNkBHoFChXr0JtwsyLnB6CGIsxTSV1EZ47L0R0kALUtqX+7CFZS6wnmoF7wrbBEYr6UB0RbUcfuNT/RWLN+SRHsrZErozpNdcMl/a67Vq0hOkA+01arTFbpkWjBi0V7iOKUFkCdOh1+CnWcZoI5FS/3Q42Ntb/5RGu7Coe79Z7r88TM+RTQP+4ZFSGJXqvlCAxASFuY/0NOvCUcskU677Jzzjww6EqzwTDF0FU488fqvTT2ZvnsmmUtu06zWblykdtQ5dcaQIFzAYatcZ+0OejVPLlbi+HZoDTUmR0efemhEYfqFm9Nbd+HTR7APDCqG4IW1MAmMa5BQY17JS4m7/vD8APU+2f9uJNcNpMfVkrEvSBParkSor5G6HnYgLrx17fWjdMW7Fde9Cyv7sNNjm2GwQmXwmI3NE1ad3fIYfZ/Arvlisr6oZMrHW4yb1EFcfQq33T8dKE1rjI/PkmGon+MdH1oX2WJm30fm7YjrNAe7Zay+lkEjt+2g2Z2jzwonM3r+N/HGF0CN3V8j1K9nxSAbJMAu+4LaBywCGLkGDukf2e2gGs0r3AiEDl/7ABo+jW16f+GLMWp0NV9vZ7nAK5Qy7kZTAFz7ejLXu7MpKiLN7cRAj36+9bMd/afRelIGe3lI4VECBmFApbxq9gjuSGISghFLQ0Ygpf9GQsCvxuAvvqG3rkVUF9urBgKIJcUGC2FUcONH16YHjXcL6jSdpHIlC7rziE3gZ9hLfrh3JVUVqnQ+SuIcDNne4vM36A1rIYB4bA80jDzHbOyP82OFc9s3YFrrAVw9t7zUDlouvWazC97I53TRFZbnCEZDNt7Ui9d8CAnRZXLH/UzSHFWlC6PMoeoVvDBvyRIwnv+fRGDr4xXBI4AAbH4qAm74nrmYGde8PUwg/4ywVJLjBu5RXUJ/eWLQ0hj8qPYpB37hzQJYY5/rXgA4Aj2BAHY5PGiR3tNmI8fQkJiT0Ovu+nCbE3vZ3S8ZFAPQRLiAAJH1bfqQYiyZ2AujMpCV2rSaWpeuHgl2cmg99vitgiI4gU2t/FCbwdL2g0IS/5Rl2Ok/k9N4YQL0LoTqvqsSdL0mHD/E+Xx2Hu4hOcKmUDt6bOZSyzzw2WTgyVguEk1bO8pjAXzxuX/ptjpR4rQOShe4hawRFjrAjBz8Z+ZIySKtCo/GaW+s0RULhJEzXwPYlMrBMvyT8QCzi2Z89CNfMBtCuI2A9kdqI9SppJ77ASt2HnHoQseccxpp3OyY0K5DueVyy7pipv5xB0qBYW9o+gN3b1K9VZgEQQaHs0LJvEwfhBE2adV9e6+hy/eJqUPoWd4X+VTivBP1i4QVryau1U5Y+Q9gR34bwpVCzFciXBEVIu5LfiGvX5m/J+UfpzIV2JLpOvNGyIIn/5KEiaPkznCW+g2pDfQuWR4p5DsuGzw6+4XaGNub1tZ9cZPA9mYrdB1xpMHK4N8CPzsjkFj3Gp/dMpsnY+3RCxYG3ykTk3iu2+fwlWbGff2rZajrwqViSgZOSN5RfpAJLLMcPwdhUGWwmwurZGVImKFB+crl9XaHPqjNPlvwepfSQHyYYBL9XXCpVOx1jFc9Qk3X2dkpk7qLF3bn0IiW674tA6P9BW5HCfW6WxvzGb6katZUm1+YeF2/bHdmNH6gHPjPQnPFLJYziD37z3lzsQyvX3qAGae1NfvL1XDO02dFqQ+ZnnN5EliKAZmIrFRJPUucB04JlfnktQCxgtoy0+RiXE+Heg7WtfDv11hfoQkzP3ryMJ5P2p+r9rHGo5ubOJzKOnZvpVDllgEh7TKcsHcAPr0ARfThvxamFnYLLfkissMg/S50FsZOyamkew2ycjrU1YEN0ciE2E33fB82H8MripUiWsmAUWLz+cMRMMkRDhDqhKHHcFqOouCelmKBUQYihD4Mt3x0eOlCItpQA4fOwuzQ+fXhRx0NeWaJ9v4Ta4sMVIvP/14BK9yVYRVusmcjt6WzemA8uBipt/sPOGHaAFJYnZ8AAm7fCZ/9mkbiDcnKFw9NyYxKAUzuaCnFrCxQFN27twpjMb3K4bydT46TAAA="
  }
];
    res.json({ data: trains });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Train search failed' });
  }
});

// Flight search (stable mock)
app.post('/api/search-flights', (req, res) => {
  try {
    const { source, destination, departureDate } = req.body || {};

    if (!source || !destination || !departureDate) {
      return res.status(400).json({
        message: 'Missing required parameters'
      });
    }

    const flights = generateMockFlights(source, destination, departureDate);
  
    res.json(flights); // ✅ FIXED
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Flight search failed' });
  }
});
 
// Destinations (Amadeus + Unsplash inside router)
try {
  const destinationsRouter = require('./routes/destinations.js');
  app.use('/api/destinations', destinationsRouter);
} catch (e) {
  console.warn('Destinations route not loaded:', e.message);
}

// Hotels
try {
  const hotelsRouter = require('./routes/hotels.js');
  app.use('/api/hotels', hotelsRouter);
} catch (e) {
  console.warn('Hotels route not loaded:', e.message);
}

// Buses
try {
  const busesRouter = require('./routes/buses.js');
  app.use('/api/buses', busesRouter);
} catch (e) {
  console.warn('Buses route not loaded:', e.message);
}

// Trains
try {
  const trainsRouter = require('./routes/trains.js');
  app.use('/api/trains', trainsRouter);
} catch (e) {
  console.warn('Trains route not loaded:', e.message);
}

// Auth (login/register/logout)
try {
  const authRouter = require('./routes/auth.js');
  app.use('/api/auth', authRouter);
} catch (e) {
  console.warn('Auth route not loaded:', e.message);
}

// Bookings
try {
  const bookingsRouter = require('./routes/bookings.js');
  app.use('/api/bookings', bookingsRouter);
} catch (e) {
  console.warn('Bookings route not loaded:', e.message);
}

// Contact messages
try {
  const contactRouter = require('./routes/contact.js');
  app.use('/api/contact', contactRouter);
} catch (e) {
  console.warn('Contact route not loaded:', e.message);
}

/* ---------- Unsplash IMAGE PROXY (IMPROVED) ----------
   GET /api/unsplash-image?q=goa beach
   -> { url: "https://images.unsplash.com/..." }

   Uses:
   - Curated static images for specific destinations (Goa, Kolkata, Rajasthan, Himachal, Andaman, etc.)
   - Falls back to Unsplash search if no override matches
*/
const IMAGE_OVERRIDES = {
  kolkata: 'https://images.unsplash.com/photo-1588783216315-f46af9aa2344?auto=format&fit=crop&w=1200&q=80',
  'kolkata cultural walk': 'https://images.unsplash.com/photo-1607860108855-64b2653ef897?auto=format&fit=crop&w=1200&q=80',
  rajasthan: 'https://images.unsplash.com/photo-1524492514791-505dacd0f0a5?auto=format&fit=crop&w=1200&q=80',
  'desert camp': 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?auto=format&fit=crop&w=1200&q=80',
  goa: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80',
  'goa beach escape': 'https://images.unsplash.com/photo-1500534314211-0a24cd03f2c0?auto=format&fit=crop&w=1200&q=80',
  himachal: 'https://images.unsplash.com/photo-1477414348463-c0eb7f1359b6?auto=format&fit=crop&w=1200&q=80',
  trek: 'https://images.unsplash.com/photo-1526481280695-3c687fd543c0?auto=format&fit=crop&w=1200&q=80',
  'himalayan trek': 'https://images.unsplash.com/photo-1601758124321-4667c3c605c9?auto=format&fit=crop&w=1200&q=80',
  andaman: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80',
  'andaman island cruise': 'https://images.unsplash.com/photo-1468413253725-0d5181091126?auto=format&fit=crop&w=1200&q=80'
};

app.get('/api/unsplash-image', async (req, res) => {
  try {
    if (!UNSPLASH_ACCESS_KEY) {
      return res.status(500).json({ error: 'Unsplash key not configured' });
    }

    const qRaw = (req.query.q || 'travel destination').toString();
    const qLower = qRaw.toLowerCase();

    // 1) Check curated overrides first
    for (const key in IMAGE_OVERRIDES) {
      if (qLower.includes(key)) {
        return res.json({ url: IMAGE_OVERRIDES[key], source: 'override' });
      }
    }

    // 2) Fallback to Unsplash search
    const unsplashRes = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: qRaw,
        per_page: 1,
        orientation: 'landscape'
      },
      headers: {
        Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    });

    const results = unsplashRes.data && unsplashRes.data.results;
    if (!results || !results.length) {
      return res.json({ url: null });
    }

    const photo = results[0];
    const url =
      photo.urls && (photo.urls.regular || photo.urls.full || photo.urls.small);

    return res.json({ url, source: 'unsplash' });
  } catch (err) {
    console.error('Unsplash API error:', err.message || err);
    res.status(500).json({ error: 'Failed to fetch from Unsplash' });
  }
});

// ---------- 404 HANDLER ----------
app.use('/api', (req, res, next) => {
  res.status(404).json({ message: 'API route not found' });
});

// ---------- GLOBAL ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong on the server.'
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
