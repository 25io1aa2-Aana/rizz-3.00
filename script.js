/* ============================================================
   RIZZ 3.0 — ESP32 Surveillance Car Dashboard
   script.js
   ============================================================ */

/* ===== GLOBAL STATE ===== */
const state = {
  connected: false,
  ip: '',
  joy: { x: 0, y: 0 },
  controls: {},
  gpsRecording: false,
  gpsPath: [],
  nvMode: 'STANDARD',
  uptime: 0,
  uptimeRunning: false
};

/* ============================================================
   TAB SWITCHING
   ============================================================ */
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.full-tab').forEach(t => {
    t.classList.remove('active');
    t.style.display = 'none';
  });

  const tabs = ['controller', 'gps', 'nightvision', 'advantages'];
  const idx = tabs.indexOf(name);
  document.querySelectorAll('.tab-btn')[idx].classList.add('active');

  const el = document.getElementById('tab-' + name);
  el.style.display = (name === 'advantages') ? 'block' : 'grid';
  el.classList.add('active');

  if (name === 'gps')         initMap();
  if (name === 'nightvision') initNVCanvas();
}

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/* ============================================================
   DEVICE CONNECTION
   ============================================================ */
function connectDevice() {
  const ip = document.getElementById('ip-input').value.trim();
  if (!ip) { toast('Enter an IP address'); return; }

  state.ip = ip;
  state.connected = true;

  document.getElementById('conn-dot').className   = 'status-dot';
  document.getElementById('conn-text').textContent = 'LIVE';
  document.getElementById('hud-ip').textContent    = 'IP: ' + ip;
  document.getElementById('live-badge').style.display = '';
  document.getElementById('g-signal').textContent  = '-62';

  if (!state.uptimeRunning) { state.uptimeRunning = true; startUptime(); }

  toast('Connected to ' + ip);
  simulateGPS();
}

function disconnectDevice() {
  state.connected = false;
  state.ip = '';

  document.getElementById('conn-dot').className    = 'status-dot offline';
  document.getElementById('conn-text').textContent  = 'OFFLINE';
  document.getElementById('live-badge').style.display = 'none';
  document.getElementById('cam-iframe').style.display  = 'none';
  document.getElementById('cam-placeholder').style.display = 'flex';
  document.getElementById('hud-ip').textContent = 'IP: ---';

  toast('Disconnected');
}

function openStream() {
  if (!state.ip) { toast('Connect to a device first'); return; }

  const iframe = document.getElementById('cam-iframe');
  iframe.src = 'http://' + state.ip + ':81/stream';
  iframe.style.display = 'block';
  document.getElementById('cam-placeholder').style.display = 'none';
  document.getElementById('rec-badge').style.display = 'flex';

  toast('Stream opening at ' + state.ip + ':81/stream');
}

/* ============================================================
   UPTIME COUNTER
   ============================================================ */
function startUptime() {
  setInterval(() => {
    state.uptime++;
    const h = Math.floor(state.uptime / 3600).toString().padStart(2, '0');
    const m = Math.floor((state.uptime % 3600) / 60).toString().padStart(2, '0');
    const s = (state.uptime % 60).toString().padStart(2, '0');
    document.getElementById('uptime-display').textContent = h + ':' + m + ':' + s;
  }, 1000);
}

/* ============================================================
   HUD CLOCK
   ============================================================ */
setInterval(() => {
  const n = new Date();
  document.getElementById('hud-time').textContent = n.toTimeString().slice(0, 8);
  document.getElementById('hud-date').textContent = n.toISOString().slice(0, 10);
}, 1000);

/* Fake FPS counter */
setInterval(() => {
  if (state.connected)
    document.getElementById('hud-fps').textContent = 'FPS: ' + Math.round(20 + Math.random() * 10);
}, 2000);

/* ============================================================
   JOYSTICK
   ============================================================ */
const jc     = document.getElementById('joystick-canvas');
const jctx   = jc.getContext('2d');
let jDragging = false;
let jPos      = { x: 80, y: 80 };
const jCenter = { x: 80, y: 80 };
const jMaxR   = 55;

function drawJoystick() {
  jctx.clearRect(0, 0, 160, 160);

  // Outer ring
  jctx.beginPath();
  jctx.arc(80, 80, 72, 0, Math.PI * 2);
  jctx.strokeStyle = 'rgba(0,212,255,0.15)';
  jctx.lineWidth = 1;
  jctx.stroke();

  // Axis guide lines
  jctx.strokeStyle = 'rgba(0,212,255,0.08)';
  jctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    jctx.beginPath();
    jctx.moveTo(80 + Math.cos(a) * 10, 80 + Math.sin(a) * 10);
    jctx.lineTo(80 + Math.cos(a) * 72, 80 + Math.sin(a) * 72);
    jctx.stroke();
  }

  // Concentric rings
  [30, 55, 72].forEach(r => {
    jctx.beginPath();
    jctx.arc(80, 80, r, 0, Math.PI * 2);
    jctx.strokeStyle = 'rgba(0,212,255,0.06)';
    jctx.stroke();
  });

  // Line to knob
  jctx.beginPath();
  jctx.moveTo(80, 80);
  jctx.lineTo(jPos.x, jPos.y);
  jctx.strokeStyle = 'rgba(0,212,255,0.3)';
  jctx.lineWidth = 1;
  jctx.stroke();

  // Knob gradient
  const grad = jctx.createRadialGradient(jPos.x - 4, jPos.y - 4, 2, jPos.x, jPos.y, 24);
  grad.addColorStop(0, 'rgba(0,212,255,0.6)');
  grad.addColorStop(1, 'rgba(0,212,255,0.05)');
  jctx.beginPath();
  jctx.arc(jPos.x, jPos.y, 22, 0, Math.PI * 2);
  jctx.fillStyle = grad;
  jctx.fill();
  jctx.strokeStyle = 'rgba(0,212,255,0.5)';
  jctx.lineWidth = 1.5;
  jctx.stroke();

  // Centre dot
  jctx.beginPath();
  jctx.arc(80, 80, 4, 0, Math.PI * 2);
  jctx.fillStyle = 'rgba(0,212,255,0.3)';
  jctx.fill();
}

function getJoyXY(e) {
  const r      = jc.getBoundingClientRect();
  const scaleX = 160 / r.width;
  const scaleY = 160 / r.height;
  const src    = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - r.left) * scaleX,
    y: (src.clientY - r.top)  * scaleY
  };
}

function setJoyPos(x, y) {
  const dx = x - 80, dy = y - 80;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > jMaxR) { const f = jMaxR / dist; x = 80 + dx * f; y = 80 + dy * f; }
  jPos = { x, y };

  const nx = ((jPos.x - 80) / jMaxR).toFixed(2);
  const ny = (-(jPos.y - 80) / jMaxR).toFixed(2);
  state.joy = { x: parseFloat(nx), y: parseFloat(ny) };

  document.getElementById('jx').textContent = nx;
  document.getElementById('jy').textContent = ny;

  const spd = Math.round(Math.sqrt(nx * nx + ny * ny) * 100);
  document.getElementById('g-speed').textContent = spd;

  let cmd = 'STOP', heading = 0;
  if (Math.abs(ny) > 0.15 || Math.abs(nx) > 0.15) {
    if      (ny >  0.3 && Math.abs(nx) < 0.3) cmd = 'FORWARD';
    else if (ny < -0.3 && Math.abs(nx) < 0.3) cmd = 'REVERSE';
    else if (nx < -0.3 && Math.abs(ny) < 0.3) cmd = 'LEFT';
    else if (nx >  0.3 && Math.abs(ny) < 0.3) cmd = 'RIGHT';
    else if (ny >  0.2 && nx < -0.2)           cmd = 'FWD-LEFT';
    else if (ny >  0.2 && nx >  0.2)           cmd = 'FWD-RIGHT';
    else if (ny < -0.2 && nx < -0.2)           cmd = 'REV-LEFT';
    else if (ny < -0.2 && nx >  0.2)           cmd = 'REV-RIGHT';
    heading = Math.round((Math.atan2(nx, ny) * 180 / Math.PI + 360) % 360);
  }

  document.getElementById('jcmd').textContent        = cmd;
  document.getElementById('hud-dir').textContent     = 'DIR: ' + cmd;
  document.getElementById('hud-speed').textContent   = 'SPEED: ' + spd + '%';
  document.getElementById('g-heading').textContent   = heading + '°';

  drawJoystick();
  if (state.connected) sendCmd(nx, ny, cmd);
}

function resetJoy() {
  jPos = { x: 80, y: 80 };
  document.getElementById('jx').textContent      = '0.00';
  document.getElementById('jy').textContent      = '0.00';
  document.getElementById('jcmd').textContent    = 'STOP';
  document.getElementById('hud-dir').textContent = 'DIR: STOP';
  document.getElementById('hud-speed').textContent = 'SPEED: 0%';
  document.getElementById('g-speed').textContent = '0';
  drawJoystick();
}

/* Pointer events */
jc.addEventListener('mousedown',  e => { jDragging = true;  setJoyPos(getJoyXY(e).x, getJoyXY(e).y); });
jc.addEventListener('touchstart', e => { e.preventDefault(); jDragging = true; const p = getJoyXY(e); setJoyPos(p.x, p.y); }, { passive: false });
document.addEventListener('mousemove',  e => { if (jDragging) setJoyPos(getJoyXY(e).x, getJoyXY(e).y); });
document.addEventListener('touchmove',  e => { if (jDragging) { e.preventDefault(); const p = getJoyXY(e); setJoyPos(p.x, p.y); } }, { passive: false });
document.addEventListener('mouseup',    ()  => { if (jDragging) { jDragging = false; resetJoy(); } });
document.addEventListener('touchend',   ()  => { if (jDragging) { jDragging = false; resetJoy(); } });

/* Keyboard control */
const keys = { w: false, a: false, s: false, d: false };

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) return;
  e.preventDefault();

  if (k === 'w' || k === 'arrowup')    { keys.w = true; document.getElementById('key-w').classList.add('active'); }
  if (k === 'a' || k === 'arrowleft')  { keys.a = true; document.getElementById('key-a').classList.add('active'); }
  if (k === 's' || k === 'arrowdown')  { keys.s = true; document.getElementById('key-s').classList.add('active'); }
  if (k === 'd' || k === 'arrowright') { keys.d = true; document.getElementById('key-d').classList.add('active'); }

  const tx = 80 + (keys.d ? jMaxR : keys.a ? -jMaxR : 0);
  const ty = 80 - (keys.w ? jMaxR : keys.s ? -jMaxR : 0);
  setJoyPos(tx, ty);
});

document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup')    { keys.w = false; document.getElementById('key-w').classList.remove('active'); }
  if (k === 'a' || k === 'arrowleft')  { keys.a = false; document.getElementById('key-a').classList.remove('active'); }
  if (k === 's' || k === 'arrowdown')  { keys.s = false; document.getElementById('key-s').classList.remove('active'); }
  if (k === 'd' || k === 'arrowright') { keys.d = false; document.getElementById('key-d').classList.remove('active'); }

  if (!keys.w && !keys.a && !keys.s && !keys.d) resetJoy();
  else {
    const tx = 80 + (keys.d ? jMaxR : keys.a ? -jMaxR : 0);
    const ty = 80 - (keys.w ? jMaxR : keys.s ? -jMaxR : 0);
    setJoyPos(tx, ty);
  }
});

function sendCmd(x, y, cmd) {
  if (!state.ip) return;
  fetch('http://' + state.ip + '/control?x=' + x + '&y=' + y + '&cmd=' + cmd).catch(() => {});
}

/* Initial draw */
drawJoystick();

/* ============================================================
   SYSTEM TOGGLE CONTROLS
   ============================================================ */
function toggleCtrl(id) {
  const tog  = document.getElementById('tog-'  + id);
  const stat = document.getElementById('stat-' + id);
  const card = document.getElementById('ctrl-' + id);
  if (!tog) return;

  const on = !tog.classList.contains('on');
  tog.classList.toggle('on', on);
  stat.textContent  = on ? 'ON' : 'OFF';
  stat.className    = 'ctrl-status ' + (on ? 'on' : 'off');
  card.classList.toggle('active', on);
  state.controls[id] = on;

  /* Side effects */
  if (id === 'nv') {
    document.getElementById('hud-nv-status').innerHTML =
      'NIGHT VIS: <span class="hud-accent">' + (on ? 'ON' : 'OFF') + '</span>';
    document.getElementById('cam-placeholder').classList.toggle('night-mode', on);
  }
  if (id === 'rec') {
    document.getElementById('rec-badge').style.display  = on ? 'flex' : 'none';
    document.getElementById('live-badge').style.display = on ? ''     : 'none';
  }
  if (id === 'gps') {
    document.getElementById('hud-gps-fix').innerHTML =
      'GPS: <span class="hud-accent">' + (on ? 'ACTIVE' : 'NO FIX') + '</span>';
    document.getElementById('gps-fix-badge').textContent = on ? 'GPS ACTIVE' : 'NO FIX';
  }

  if (state.ip)
    fetch('http://' + state.ip + '/' + id + '?val=' + (on ? 1 : 0)).catch(() => {});

  toast(id.toUpperCase() + ' ' + (on ? 'ENABLED' : 'DISABLED'));
}

/* ============================================================
   GPS MAP
   ============================================================ */
let mapCanvas, mapCtx, mapW = 0, mapH = 0;
let gpsPath = [], gpsCurrent = { x: 0.5, y: 0.5 };
let gpsRecording = false, gpsDuration = 0, gpsDurTimer = null;

function initMap() {
  mapCanvas = document.getElementById('map-canvas');
  const container = document.getElementById('map-container');
  mapW = container.offsetWidth;
  mapH = Math.max(container.offsetHeight, 400);
  mapCanvas.width  = mapW;
  mapCanvas.height = mapH;
  mapCanvas.style.height = mapH + 'px';
  mapCtx = mapCanvas.getContext('2d');
  drawMap();

  mapCanvas.addEventListener('click', e => {
    if (!gpsRecording) return;
    const r = mapCanvas.getBoundingClientRect();
    addWaypoint((e.clientX - r.left) / mapW, (e.clientY - r.top) / mapH);
  });
}

function drawMap() {
  if (!mapCtx) return;

  /* Background */
  mapCtx.fillStyle = '#070d12';
  mapCtx.fillRect(0, 0, mapW, mapH);

  /* Grid */
  mapCtx.strokeStyle = 'rgba(0,212,255,0.05)';
  mapCtx.lineWidth   = 0.5;
  const gs = 40;
  for (let x = 0; x < mapW; x += gs) { mapCtx.beginPath(); mapCtx.moveTo(x, 0); mapCtx.lineTo(x, mapH); mapCtx.stroke(); }
  for (let y = 0; y < mapH; y += gs) { mapCtx.beginPath(); mapCtx.moveTo(0, y); mapCtx.lineTo(mapW, y); mapCtx.stroke(); }

  /* Path line */
  if (gpsPath.length > 1) {
    mapCtx.beginPath();
    mapCtx.moveTo(gpsPath[0].x * mapW, gpsPath[0].y * mapH);
    for (let i = 1; i < gpsPath.length; i++)
      mapCtx.lineTo(gpsPath[i].x * mapW, gpsPath[i].y * mapH);
    mapCtx.strokeStyle = 'rgba(0,255,136,0.7)';
    mapCtx.lineWidth   = 2;
    mapCtx.stroke();

    gpsPath.forEach((p, i) => {
      mapCtx.beginPath();
      mapCtx.arc(p.x * mapW, p.y * mapH, 3, 0, Math.PI * 2);
      mapCtx.fillStyle = i === 0 ? '#ffb830' : 'rgba(0,255,136,0.5)';
      mapCtx.fill();
    });
  }

  /* Current position */
  const cx = gpsCurrent.x * mapW, cy = gpsCurrent.y * mapH;
  mapCtx.beginPath(); mapCtx.arc(cx, cy, 8, 0, Math.PI * 2);
  mapCtx.fillStyle = 'rgba(0,212,255,0.2)'; mapCtx.fill();
  mapCtx.beginPath(); mapCtx.arc(cx, cy, 5, 0, Math.PI * 2);
  mapCtx.fillStyle = '#00d4ff'; mapCtx.fill();
  mapCtx.beginPath(); mapCtx.arc(cx, cy, 12, 0, Math.PI * 2);
  mapCtx.strokeStyle = 'rgba(0,212,255,0.3)'; mapCtx.lineWidth = 1; mapCtx.stroke();

  /* Crosshair lines */
  mapCtx.strokeStyle = 'rgba(0,212,255,0.15)'; mapCtx.lineWidth = 0.5;
  mapCtx.beginPath(); mapCtx.moveTo(cx, 0);    mapCtx.lineTo(cx, mapH); mapCtx.stroke();
  mapCtx.beginPath(); mapCtx.moveTo(0, cy);    mapCtx.lineTo(mapW, cy); mapCtx.stroke();

  document.getElementById('stat-wpts').textContent = gpsPath.length;
  document.getElementById('pts-badge').textContent = gpsPath.length + ' PTS';
}

function addWaypoint(x, y) {
  gpsPath.push({ x, y, t: Date.now() });
  gpsCurrent = { x, y };
  document.getElementById('stat-dist').textContent = (calcDist() * 100).toFixed(1) + ' m';
  renderWaypointList();
  drawMap();
}

function calcDist() {
  let d = 0;
  for (let i = 1; i < gpsPath.length; i++) {
    const dx = gpsPath[i].x - gpsPath[i-1].x, dy = gpsPath[i].y - gpsPath[i-1].y;
    d += Math.sqrt(dx * dx + dy * dy);
  }
  return d;
}

function renderWaypointList() {
  const list = document.getElementById('waypoints-list');
  if (!gpsPath.length) { list.innerHTML = '<div style="opacity:0.5">No waypoints recorded</div>'; return; }
  list.innerHTML = gpsPath.map((p, i) => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border2)">
      <span style="color:var(--accent2)">WP${String(i+1).padStart(3,'0')}</span>
      <span>${(p.x*100).toFixed(1)}, ${(p.y*100).toFixed(1)}</span>
    </div>`).join('');
}

function startGPSRecord() {
  gpsRecording = true; gpsDuration = 0;
  const badge = document.getElementById('gps-fix-badge');
  badge.textContent       = 'RECORDING';
  badge.style.background  = 'rgba(255,59,59,0.15)';
  badge.style.color       = 'var(--red)';

  gpsDurTimer = setInterval(() => {
    gpsDuration++;
    const m = Math.floor(gpsDuration / 60).toString().padStart(2, '0');
    const s = (gpsDuration % 60).toString().padStart(2, '0');
    document.getElementById('stat-dur').textContent = m + ':' + s;
    if (gpsPath.length > 1)
      document.getElementById('stat-spd').textContent = (calcDist() * 100 / gpsDuration).toFixed(1) + ' m/s';

    /* Auto-plot from joystick when connected */
    if (state.connected && (state.joy.x !== 0 || state.joy.y !== 0)) {
      const nx = Math.min(0.95, Math.max(0.05, gpsCurrent.x + state.joy.x * 0.01));
      const ny = Math.min(0.95, Math.max(0.05, gpsCurrent.y - state.joy.y * 0.01));
      addWaypoint(nx, ny);
    }
  }, 1000);
  toast('GPS Recording started — click map or drive to add points');
}

function stopGPSRecord() {
  gpsRecording = false;
  clearInterval(gpsDurTimer);
  const badge = document.getElementById('gps-fix-badge');
  badge.textContent      = 'STOPPED';
  badge.style.background = '';
  badge.style.color      = '';
  toast('Recording stopped — ' + gpsPath.length + ' waypoints saved');
}

function clearPath() {
  gpsPath = []; gpsCurrent = { x: 0.5, y: 0.5 };
  renderWaypointList(); drawMap(); toast('Path cleared');
}

function exportPath() {
  if (!gpsPath.length) { toast('No path to export'); return; }
  const kml = `<?xml version="1.0"?><kml><Document><Placemark><n>RIZZ 3.0 Path</n><LineString><coordinates>${gpsPath.map(p => `${p.x},${p.y},0`).join(' ')}</coordinates></LineString></Placemark></Document></kml>`;
  const a = document.createElement('a');
  a.href = 'data:text/xml,' + encodeURIComponent(kml);
  a.download = 'rizz3-path.kml';
  a.click();
  toast('Path exported as KML');
}

/* ============================================================
   NIGHT VISION CANVAS
   ============================================================ */
let nvCanvas, nvCtx, nvAnimFrame;
let nvTime = 0;

function initNVCanvas() {
  nvCanvas = document.getElementById('nv-canvas');
  const container = document.getElementById('nv-preview');
  nvCanvas.width  = container.offsetWidth  || 340;
  nvCanvas.height = container.offsetHeight || 200;
  nvCanvas.style.width  = '100%';
  nvCanvas.style.height = '100%';
  animateNV();
}

function animateNV() {
  nvAnimFrame = requestAnimationFrame(animateNV);
  nvTime += 0.02;
  if (!nvCtx) { nvCtx = nvCanvas.getContext('2d'); if (!nvCtx) return; }

  const w = nvCanvas.width, h = nvCanvas.height;

  /* Background */
  nvCtx.fillStyle = '#010801';
  nvCtx.fillRect(0, 0, w, h);

  /* Noise */
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const b = Math.floor(Math.random() * 60);
    nvCtx.fillStyle = `rgba(0,${b},0,0.5)`;
    nvCtx.fillRect(x, y, 1, 1);
  }

  /* Simulated IR heat blobs */
  const blobs = [
    { x: w*0.3, y: h*0.4, r: 30 },
    { x: w*0.7, y: h*0.6, r: 20 },
    { x: w*0.5, y: h*0.3, r: 15 }
  ];
  blobs.forEach(b => {
    const g = nvCtx.createRadialGradient(
      b.x + Math.sin(nvTime + b.r) * 5, b.y, 0,
      b.x, b.y, b.r * (0.9 + 0.1 * Math.sin(nvTime * 2))
    );
    g.addColorStop(0,   'rgba(80,255,80,0.6)');
    g.addColorStop(0.4, 'rgba(40,180,40,0.3)');
    g.addColorStop(1,   'rgba(0,60,0,0)');
    nvCtx.beginPath();
    nvCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    nvCtx.fillStyle = g;
    nvCtx.fill();
  });

  /* Scan line sweep */
  const sl = (nvTime * 50) % h;
  nvCtx.fillStyle = 'rgba(0,255,0,0.04)';
  nvCtx.fillRect(0, sl, w, 2);

  /* IR grid overlay */
  nvCtx.strokeStyle = 'rgba(0,100,0,0.1)';
  nvCtx.lineWidth   = 0.5;
  for (let x = 0; x < w; x += 40) { nvCtx.beginPath(); nvCtx.moveTo(x, 0); nvCtx.lineTo(x, h); nvCtx.stroke(); }
  for (let y = 0; y < h; y += 40) { nvCtx.beginPath(); nvCtx.moveTo(0, y); nvCtx.lineTo(w, y); nvCtx.stroke(); }

  /* Crosshair */
  nvCtx.strokeStyle = 'rgba(0,255,136,0.3)'; nvCtx.lineWidth = 1;
  nvCtx.beginPath(); nvCtx.moveTo(w/2 - 20, h/2); nvCtx.lineTo(w/2 + 20, h/2); nvCtx.stroke();
  nvCtx.beginPath(); nvCtx.moveTo(w/2, h/2 - 20); nvCtx.lineTo(w/2, h/2 + 20); nvCtx.stroke();
  nvCtx.beginPath(); nvCtx.arc(w/2, h/2, 15, 0, Math.PI * 2);
  nvCtx.strokeStyle = 'rgba(0,255,136,0.2)'; nvCtx.stroke();
}

function setIRIntensity(v) {
  document.getElementById('ir-int-val').textContent = v + '%';
  document.getElementById('nv-pwr').textContent     = v + '%';
  document.getElementById('nv-vis').textContent     = Math.round(v / 10) + 'm';
}

function setGain(v) {
  const g = v < 10 ? 'Auto' : v < 50 ? 'Low' : v < 80 ? 'Med' : 'High';
  document.getElementById('ir-gain-val').textContent  = g;
  document.getElementById('nv-gain-label').textContent = g.toUpperCase();
}

function setNVMode(mode) {
  document.querySelectorAll('[id^=mode-]').forEach(b => b.style.borderColor = 'var(--border)');
  const key = 'mode-' + mode.toLowerCase().replace('&','').replace('/','').trim();
  document.getElementById(key).style.borderColor = 'var(--accent2)';
  document.getElementById('nv-mode-label').textContent = mode;
  toast('Night vision mode: ' + mode);
}

/* ============================================================
   SIMULATED GPS FEED (when connected)
   ============================================================ */
function simulateGPS() {
  let lat = 21.1702 + Math.random() * 0.01;
  let lng = 72.8311 + Math.random() * 0.01;

  setInterval(() => {
    if (!state.connected) return;
    lat += (Math.random() - 0.5) * 0.0001;
    lng += (Math.random() - 0.5) * 0.0001;

    const ls = lat.toFixed(6), lo = lng.toFixed(6);
    document.getElementById('hud-lat').textContent = 'LAT: ' + ls;
    document.getElementById('hud-lng').textContent = 'LNG: ' + lo;
    document.getElementById('pos-lat').textContent = ls;
    document.getElementById('pos-lng').textContent = lo;
    document.getElementById('pos-alt').textContent = Math.round(12 + Math.random() * 3) + ' m';
    document.getElementById('pos-sat').textContent = Math.round(8  + Math.random() * 4);
    document.getElementById('pos-hdop').textContent = (1.2 + Math.random() * 0.4).toFixed(1);

    if (gpsRecording) {
      const px = 0.1 + (lng - 72.83) * 5000;
      const py = 0.9 - (lat - 21.17) * 5000;
      gpsCurrent = {
        x: Math.min(0.95, Math.max(0.05, px)),
        y: Math.min(0.95, Math.max(0.05, py))
      };
      drawMap();
    }
  }, 1500);
}

/* ============================================================
   RESIZE HANDLER
   ============================================================ */
window.addEventListener('resize', () => {
  if (document.getElementById('tab-gps').classList.contains('active')) initMap();
});
