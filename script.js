/* ════════════════════════════════════════════
   ASTROWEATHER · script.js v3.0
   Photo BG · Autocomplete · Global city search
   ════════════════════════════════════════════ */

const API_KEY  = '48bb6120793b160a2925318aa3d63fee';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_URL  = 'https://api.openweathermap.org/geo/1.0';

/* ─── STATE ─── */
let tempC_current = 0;
let isCelsius     = true;
let leafletMap    = null;
let cityMarker    = null;
let rainAnim      = null;
let snowAnim      = null;
let hourlyData    = [];
let acTimer       = null;
let acHighlight   = -1;
let acResults     = [];

/* ════════════════════════════════════════════
   1. STAR FIELD
   ════════════════════════════════════════════ */
const sCvs = document.getElementById('starsCanvas');
const sCtx = sCvs.getContext('2d');
function resizeStar() { sCvs.width = window.innerWidth; sCvs.height = window.innerHeight; }
resizeStar();
window.addEventListener('resize', resizeStar);

class Star {
  constructor(init) { this.reset(init); }
  reset(init) {
    this.x = Math.random() * sCvs.width;
    this.y = init ? Math.random() * sCvs.height : -2;
    this.r = Math.random() * 1.4 + 0.2;
    this.spd = Math.random() * 0.12 + 0.015;
    this.a = Math.random() * 0.5 + 0.2;
    this.da = (Math.random() * 0.003 + 0.001) * (Math.random() > 0.5 ? 1 : -1);
    this.aMin = this.a * 0.4;
    this.aMax = Math.min(this.a * 1.6, 1);
    this.col = ['#ffffff','#cce8ff','#ffe8c8','#ddd6fe'][Math.floor(Math.random()*4)];
  }
  tick() {
    this.y += this.spd;
    this.a += this.da;
    if (this.a > this.aMax || this.a < this.aMin) this.da *= -1;
    if (this.y > sCvs.height + 2) this.reset(false);
  }
  draw() {
    sCtx.save();
    sCtx.globalAlpha = this.a;
    sCtx.fillStyle = this.col;
    sCtx.beginPath();
    sCtx.arc(this.x, this.y, this.r, 0, Math.PI*2);
    sCtx.fill();
    sCtx.restore();
  }
}

const STARS = Array.from({ length: 250 }, () => new Star(true));
function drawStars() {
  sCtx.clearRect(0, 0, sCvs.width, sCvs.height);
  STARS.forEach(s => { s.tick(); s.draw(); });
  requestAnimationFrame(drawStars);
}
drawStars();

/* ════════════════════════════════════════════
   2. RAIN CANVAS
   ════════════════════════════════════════════ */
const rCvs = document.getElementById('rainCanvas');
const rCtx = rCvs.getContext('2d');
function resizeRain() { rCvs.width = window.innerWidth; rCvs.height = window.innerHeight; }
resizeRain();
window.addEventListener('resize', resizeRain);

const DROPS = Array.from({ length: 200 }, () => ({
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
  len: Math.random() * 18 + 8,
  spd: Math.random() * 10 + 8,
  a: Math.random() * 0.3 + 0.1,
}));

function drawRain() {
  rCtx.clearRect(0, 0, rCvs.width, rCvs.height);
  rCtx.strokeStyle = 'rgba(174,214,241,0.5)';
  rCtx.lineWidth = 1;
  DROPS.forEach(d => {
    rCtx.globalAlpha = d.a;
    rCtx.beginPath();
    rCtx.moveTo(d.x, d.y);
    rCtx.lineTo(d.x - 2, d.y + d.len);
    rCtx.stroke();
    d.y += d.spd;
    d.x -= 1.5;
    if (d.y > rCvs.height + 20) { d.y = -20; d.x = Math.random() * rCvs.width; }
  });
  rainAnim = requestAnimationFrame(drawRain);
}

/* ════════════════════════════════════════════
   3. SNOW CANVAS
   ════════════════════════════════════════════ */
const snCvs = document.getElementById('snowCanvas');
const snCtx = snCvs.getContext('2d');
function resizeSnow() { snCvs.width = window.innerWidth; snCvs.height = window.innerHeight; }
resizeSnow();
window.addEventListener('resize', resizeSnow);

const FLAKES = Array.from({ length: 150 }, () => ({
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
  r: Math.random() * 3 + 1,
  spd: Math.random() * 1.5 + 0.5,
  drift: (Math.random() - 0.5) * 0.8,
  a: Math.random() * 0.5 + 0.2,
}));

function drawSnow() {
  snCtx.clearRect(0, 0, snCvs.width, snCvs.height);
  FLAKES.forEach(f => {
    snCtx.save();
    snCtx.globalAlpha = f.a;
    snCtx.fillStyle = '#e2e8f0';
    snCtx.beginPath();
    snCtx.arc(f.x, f.y, f.r, 0, Math.PI*2);
    snCtx.fill();
    snCtx.restore();
    f.y += f.spd;
    f.x += f.drift;
    if (f.y > snCvs.height + 5) { f.y = -5; f.x = Math.random() * snCvs.width; }
  });
  snowAnim = requestAnimationFrame(drawSnow);
}

function stopRain() { if (rainAnim) cancelAnimationFrame(rainAnim); rCvs.classList.add('hidden'); }
function stopSnow() { if (snowAnim) cancelAnimationFrame(snowAnim); snCvs.classList.add('hidden'); }
function startRain() { rCvs.classList.remove('hidden'); drawRain(); }
function startSnow() { snCvs.classList.remove('hidden'); drawSnow(); }

/* ════════════════════════════════════════════
   4. LIVE CLOCK
   ════════════════════════════════════════════ */
function tickClock() {
  const n = new Date();
  const h = n.getHours(), m = n.getMinutes(), s = n.getSeconds();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = String(h % 12 || 12).padStart(2,'0');
  const mm = String(m).padStart(2,'0');
  const ss = String(s).padStart(2,'0');
  document.getElementById('navClock').textContent = `${hh}:${mm}:${ss} ${ampm}`;
}
setInterval(tickClock, 1000);
tickClock();

/* ════════════════════════════════════════════
   5. BACKGROUND THEME
   ════════════════════════════════════════════ */
function applyTheme(weatherId) {
  document.body.classList.remove(
    'theme-clear','theme-rain','theme-storm','theme-snow',
    'theme-clouds','theme-night','show-stars','clouds-moving'
  );

  if (weatherId === 800) {
    // Clear sky — show stars over photo
    document.body.classList.add('theme-clear', 'show-stars');
  } else if (weatherId === 801 || weatherId === 802) {
    // Few/scattered clouds — show animated cloud photo strips
    document.body.classList.add('theme-clouds', 'clouds-moving');
  } else if (weatherId >= 803) {
    // Overcast clouds — heavy cloud drift
    document.body.classList.add('theme-clouds', 'clouds-moving');
  } else if (weatherId < 300) {
    // Thunderstorm
    document.body.classList.add('theme-storm', 'clouds-moving');
  } else if (weatherId < 600) {
    // Rain / drizzle
    document.body.classList.add('theme-rain', 'clouds-moving');
  } else if (weatherId < 700) {
    // Snow
    document.body.classList.add('theme-snow', 'clouds-moving');
  } else {
    // Fog / mist / haze
    document.body.classList.add('theme-clouds', 'clouds-moving');
  }
}

/* ════════════════════════════════════════════
   6. AUTOCOMPLETE — using OWM Geocoding API
   Supports every city, village, state worldwide
   ════════════════════════════════════════════ */
const cityInput     = document.getElementById('cityInput');
const acBox         = document.getElementById('autocompleteBox');
const searchBtn     = document.getElementById('searchBtn');

// Country code → flag emoji
function countryFlag(code) {
  if (!code) return '🌐';
  try {
    return code.toUpperCase().replace(/./g, c =>
      String.fromCodePoint(c.charCodeAt(0) + 127397)
    );
  } catch { return '🌐'; }
}

async function fetchAutocomplete(query) {
  if (query.length < 2) { closeAC(); return; }
  try {
    // OWM geocoding: limit=8 gives up to 8 results worldwide
    const res = await fetch(
      `${GEO_URL}/direct?q=${encodeURIComponent(query)}&limit=8&appid=${API_KEY}`
    );
    if (!res.ok) { closeAC(); return; }
    const data = await res.json();
    acResults = data;
    renderAC(data);
  } catch { closeAC(); }
}

function renderAC(items) {
  acHighlight = -1;
  if (!items || items.length === 0) { closeAC(); return; }

  acBox.innerHTML = '';
  items.forEach((place, i) => {
    const div = document.createElement('div');
    div.className = 'ac-item';
    const flag = countryFlag(place.country);
    const statePart = place.state ? `<br><span class="ac-sub">${place.state}</span>` : '';
    div.innerHTML = `
      <span class="ac-flag">${flag}</span>
      <span class="ac-name">${place.local_names?.en || place.name}${statePart}</span>
      <span class="ac-country-code">${place.country || ''}</span>
    `;
    div.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectAC(i);
    });
    acBox.appendChild(div);
  });

  acBox.classList.add('open');
}

function closeAC() {
  acBox.classList.remove('open');
  acBox.innerHTML = '';
  acHighlight = -1;
}

function selectAC(idx) {
  const place = acResults[idx];
  if (!place) return;
  const name = place.local_names?.en || place.name;
  cityInput.value = name;
  closeAC();
  fetchWeatherByCoords(place.lat, place.lon, name, place.country);
}

// Keyboard navigation
cityInput.addEventListener('keydown', (e) => {
  const items = acBox.querySelectorAll('.ac-item');
  if (!acBox.classList.contains('open') || items.length === 0) {
    if (e.key === 'Enter') doSearch();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    acHighlight = Math.min(acHighlight + 1, items.length - 1);
    highlightAC(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    acHighlight = Math.max(acHighlight - 1, -1);
    highlightAC(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (acHighlight >= 0) selectAC(acHighlight);
    else { closeAC(); doSearch(); }
  } else if (e.key === 'Escape') {
    closeAC();
  }
});

function highlightAC(items) {
  items.forEach((el, i) => el.classList.toggle('highlighted', i === acHighlight));
}

cityInput.addEventListener('input', () => {
  const v = cityInput.value.trim();
  clearTimeout(acTimer);
  if (v.length < 2) { closeAC(); return; }
  acTimer = setTimeout(() => fetchAutocomplete(v), 220);
});

cityInput.addEventListener('blur', () => {
  setTimeout(closeAC, 150);
});

/* ════════════════════════════════════════════
   7. WEATHER API — by coords (precise) & by name
   ════════════════════════════════════════════ */
async function fetchWeather(query) {
  setState('loading');
  closeAC();
  try {
    // Step 1: geocode query → get precise coordinates
    const geoRes = await fetch(
      `${GEO_URL}/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`
    );
    const geoData = geoRes.ok ? await geoRes.json() : [];

    if (!geoData || geoData.length === 0) {
      // Fallback: try OWM weather by name directly
      await fetchWeatherByName(query);
      return;
    }

    const top = geoData[0];
    const displayName = top.local_names?.en || top.name;
    await fetchWeatherByCoords(top.lat, top.lon, displayName, top.country);
  } catch (e) {
    setState('error');
  }
}

async function fetchWeatherByName(city) {
  try {
    const [curRes, fcRes] = await Promise.all([
      fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`),
      fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=metric&cnt=40&appid=${API_KEY}`)
    ]);
    if (!curRes.ok) { setState('error'); return; }
    const cur = await curRes.json();
    const fc  = fcRes.ok ? await fcRes.json() : null;
    renderWeather(cur, fc);
  } catch { setState('error'); }
}

async function fetchWeatherByCoords(lat, lon, displayName, country) {
  try {
    const [curRes, fcRes] = await Promise.all([
      fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
      fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=40&appid=${API_KEY}`)
    ]);
    if (!curRes.ok) { setState('error'); return; }
    const cur = await curRes.json();
    const fc  = fcRes.ok ? await fcRes.json() : null;
    // Override displayed name with geocoded name
    cur._displayName = displayName;
    cur._displayCountry = country;
    renderWeather(cur, fc);
  } catch { setState('error'); }
}

/* ════════════════════════════════════════════
   8. RENDER WEATHER
   ════════════════════════════════════════════ */
function renderWeather(d, fc) {
  const name    = d._displayName || d.name;
  const country = d._displayCountry || d.sys.country;
  const desc    = d.weather[0].description;
  const icon    = d.weather[0].icon;
  const id      = d.weather[0].id;
  const temp    = Math.round(d.main.temp);
  const feels   = Math.round(d.main.feels_like);
  const hi      = Math.round(d.main.temp_max);
  const lo      = Math.round(d.main.temp_min);
  const hum     = d.main.humidity;
  const press   = d.main.pressure;
  const wSpd    = Math.round(d.wind.speed * 3.6);
  const wDeg    = d.wind.deg || 0;
  const vis     = d.visibility ? (d.visibility/1000).toFixed(1) : '--';
  const cloud   = d.clouds.all;
  const sr      = new Date(d.sys.sunrise * 1000);
  const ss      = new Date(d.sys.sunset  * 1000);
  const lat     = d.coord.lat;
  const lon     = d.coord.lon;
  const tzOff   = d.timezone;

  tempC_current = temp;

  document.getElementById('cwCity').textContent    = name;
  document.getElementById('cwCountry').textContent = country;
  document.getElementById('cwDesc').textContent    = desc;
  document.getElementById('cwFeels').textContent   = isCelsius ? `${feels}°C` : `${toF(feels)}°F`;
  document.getElementById('cwHigh').textContent    = isCelsius ? `${hi}°C`    : `${toF(hi)}°F`;
  document.getElementById('cwLow').textContent     = isCelsius ? `${lo}°C`    : `${toF(lo)}°F`;
  document.getElementById('cwTemp').textContent    = isCelsius ? `${temp}°C`  : `${toF(temp)}°F`;
  document.getElementById('cwIcon').src            = `https://openweathermap.org/img/wn/${icon}@2x.png`;
  document.getElementById('sHumidity').textContent = `${hum}%`;
  document.getElementById('sHumFill').style.width  = `${hum}%`;
  document.getElementById('sWind').textContent     = `${wSpd} km/h`;
  document.getElementById('sVis').textContent      = `${vis} km`;
  document.getElementById('sPress').textContent    = `${press} hPa`;
  document.getElementById('sCloud').textContent    = `${cloud}%`;
  document.getElementById('sSun').textContent      = `${fmt12(sr)} / ${fmt12(ss)}`;
  document.getElementById('wcArr').style.transform = `rotate(${wDeg}deg)`;
  document.getElementById('wcDir').textContent     = degToDir(wDeg);

  const localNow = new Date(Date.now() + tzOff*1000 + new Date().getTimezoneOffset()*60000);
  document.getElementById('cwLocalTime').textContent = fmt12(localNow);

  /* Weather FX */
  stopRain(); stopSnow();
  if (id >= 300 && id < 600) startRain();
  else if (id >= 600 && id < 700) startSnow();

  /* Background theme */
  applyTheme(id);

  /* Forecast */
  if (fc) {
    renderForecastBar(fc);
    hourlyData = fc.list.slice(0, 10);
    renderHourlyChart(hourlyData);
  }

  /* Map */
  initMap(lat, lon, name);

  setState('weather');
}

/* ════════════════════════════════════════════
   9. FORECAST BAR
   ════════════════════════════════════════════ */
function renderForecastBar(fc) {
  const days = {};
  fc.list.forEach(item => {
    const d   = new Date(item.dt * 1000);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!days[key]) days[key] = { items: [], date: d };
    days[key].items.push(item);
  });

  const dayKeys = Object.keys(days).slice(0, 7);
  const bar = document.getElementById('forecastBar');
  bar.innerHTML = '';

  dayKeys.forEach((key, i) => {
    const { date, items } = days[key];
    const avgTemp = Math.round(items.reduce((s, x) => s + x.main.temp, 0) / items.length);
    const icon    = items[Math.floor(items.length/2)].weather[0].icon;
    const dayName = i === 0 ? 'Today'
                  : i === 1 ? 'Tomorrow'
                  : date.toLocaleDateString('en-US', { weekday: 'short' });

    const div = document.createElement('div');
    div.className = 'fc-day' + (i === 0 ? ' active' : '');
    div.innerHTML = `
      <span class="fc-day-name">${dayName}</span>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="">
      <span class="fc-day-temp">${isCelsius ? avgTemp+'°C' : toF(avgTemp)+'°F'}</span>
    `;
    div.addEventListener('click', () => {
      document.querySelectorAll('.fc-day').forEach(d => d.classList.remove('active'));
      div.classList.add('active');
    });
    bar.appendChild(div);
  });
}

/* ════════════════════════════════════════════
   10. HOURLY CHART
   ════════════════════════════════════════════ */
function renderHourlyChart(list) {
  const cvs = document.getElementById('hourlyCanvas');
  const ctx = cvs.getContext('2d');
  const W = cvs.offsetWidth || 800;
  cvs.width  = W;
  cvs.height = 140;

  const temps = list.map(i => Math.round(i.main.temp));
  const rains = list.map(i => (i.rain ? i.rain['3h'] || 0 : 0));
  const tMin  = Math.min(...temps) - 3;
  const tMax  = Math.max(...temps) + 3;

  const PAD = { l: 10, r: 10, t: 20, b: 10 };
  const pH  = cvs.height - PAD.t - PAD.b;
  const PW  = W - PAD.l - PAD.r;
  const stepX = PW / (list.length - 1);

  const tY = t => PAD.t + pH - ((t - tMin) / (tMax - tMin)) * pH;
  const maxRain = Math.max(...rains, 1);
  const rainH   = t => (t / maxRain) * (pH * 0.6);

  ctx.clearRect(0, 0, W, cvs.height);

  rains.forEach((r, i) => {
    if (r === 0) return;
    const x = PAD.l + i * stepX;
    const bH = rainH(r);
    ctx.fillStyle = 'rgba(96,165,250,0.25)';
    ctx.fillRect(x - stepX*0.35, cvs.height - PAD.b - bH, stepX*0.7, bH);
  });

  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0,   '#00d4ff');
  grad.addColorStop(0.5, '#a78bfa');
  grad.addColorStop(1,   '#f97316');

  ctx.beginPath();
  list.forEach((item, i) => {
    const x = PAD.l + i * stepX;
    const y = tY(temps[i]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = grad;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  const fillGrad = ctx.createLinearGradient(0, PAD.t, 0, cvs.height);
  fillGrad.addColorStop(0, 'rgba(0,212,255,0.18)');
  fillGrad.addColorStop(1, 'rgba(0,212,255,0)');
  ctx.lineTo(PAD.l + (list.length-1)*stepX, cvs.height - PAD.b);
  ctx.lineTo(PAD.l, cvs.height - PAD.b);
  ctx.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill();

  ctx.fillStyle = '#f1f5f9';
  ctx.font = `bold 11px 'Space Grotesk', sans-serif`;
  ctx.textAlign = 'center';
  list.forEach((item, i) => {
    const x = PAD.l + i * stepX;
    const y = tY(temps[i]);
    ctx.fillText(`${isCelsius ? temps[i]+'°' : toF(temps[i])+'°'}`, x, y - 7);
  });

  list.forEach((item, i) => {
    const x = PAD.l + i * stepX;
    const y = tY(temps[i]);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI*2);
    ctx.fillStyle = '#00d4ff';
    ctx.fill();
    ctx.strokeStyle = '#020710';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  const timesDiv = document.getElementById('hourlyTimes');
  timesDiv.innerHTML = '';
  list.forEach(item => {
    const d   = new Date(item.dt * 1000);
    const lbl = document.createElement('div');
    lbl.className = 'ht-item';
    lbl.textContent = d.toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit', hour12:true });
    timesDiv.appendChild(lbl);
  });
}

/* ════════════════════════════════════════════
   11. LEAFLET MAP
   ════════════════════════════════════════════ */
function initMap(lat, lon, city) {
  if (!leafletMap) {
    leafletMap = L.map('leafMap', { center: [lat, lon], zoom: 7, zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18,
    }).addTo(leafletMap);
    L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
      { opacity: 0.65, maxZoom: 18 }
    ).addTo(leafletMap);
    L.tileLayer(
      `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
      { opacity: 0.4, maxZoom: 18 }
    ).addTo(leafletMap);
  } else {
    leafletMap.setView([lat, lon], 7);
  }

  if (cityMarker) leafletMap.removeLayer(cityMarker);
  const customIcon = L.divIcon({
    className: '',
    html: `<div style="background:linear-gradient(135deg,#00d4ff,#7c3aed);width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 16px rgba(0,212,255,0.8);"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });
  cityMarker = L.marker([lat, lon], { icon: customIcon })
    .addTo(leafletMap)
    .bindPopup(`<b style="color:#00d4ff">${city}</b><br>Lat: ${lat.toFixed(2)} · Lon: ${lon.toFixed(2)}`)
    .openPopup();

  setTimeout(() => leafletMap.invalidateSize(), 200);
}

/* ════════════════════════════════════════════
   12. HELPERS
   ════════════════════════════════════════════ */
function toF(c)     { return Math.round(c * 9/5 + 32); }
function fmt12(d)   { return d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }); }
function degToDir(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg/22.5) % 16];
}

/* ════════════════════════════════════════════
   13. UI STATES
   ════════════════════════════════════════════ */
function setState(s) {
  document.getElementById('stateLoading').classList.add('hidden');
  document.getElementById('stateError').classList.add('hidden');
  document.getElementById('weatherContent').classList.add('hidden');
  document.querySelector('.hero-section').style.paddingBottom = '24px';
  if (s === 'loading') document.getElementById('stateLoading').classList.remove('hidden');
  else if (s === 'error')   document.getElementById('stateError').classList.remove('hidden');
  else if (s === 'weather') document.getElementById('weatherContent').classList.remove('hidden');
}

/* ════════════════════════════════════════════
   14. TEMP TOGGLE
   ════════════════════════════════════════════ */
document.getElementById('btnC').addEventListener('click', () => {
  isCelsius = true;
  document.getElementById('btnC').classList.add('active');
  document.getElementById('btnF').classList.remove('active');
  document.getElementById('cwTemp').textContent = `${tempC_current}°C`;
});
document.getElementById('btnF').addEventListener('click', () => {
  isCelsius = false;
  document.getElementById('btnF').classList.add('active');
  document.getElementById('btnC').classList.remove('active');
  document.getElementById('cwTemp').textContent = `${toF(tempC_current)}°F`;
});

/* ════════════════════════════════════════════
   15. SEARCH
   ════════════════════════════════════════════ */
function doSearch() {
  const v = cityInput.value.trim();
  if (v) fetchWeather(v);
}
searchBtn.addEventListener('click', doSearch);

document.querySelectorAll('.qpill').forEach(b => {
  b.addEventListener('click', () => {
    cityInput.value = b.dataset.city;
    closeAC();
    fetchWeather(b.dataset.city);
  });
});

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
fetchWeather('Lahore');
