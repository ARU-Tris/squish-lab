import './style.css';
import { PhysicsRoom, STEP, MAX_OBJECTS, MATERIALS, centerOf } from './physics.js';
import { RoomRenderer } from './render.js';
import { icon, toyIcon } from './icons.js';
import logoUrl from '../favicon.svg';

const $ = (s) => document.querySelector(s);
const groups = [
  { title: 'BALLS & BLOBS', items: ['jelly', 'rubber', 'water', 'bouncy', 'steel'] },
  { title: 'THE SOLID STUFF', items: ['crate', 'plank', 'ramp'] },
  { title: 'MAKE IT INTERESTING', items: ['trampoline', 'bumper', 'fan', 'magnet'] },
];
const sceneNames = { sandbox: 'The play room', bowling: 'Knock ’em down', marbles: 'Marble mischief', zero: 'Zero-G daydream' };
const toolNames = { grab: 'Grab & squish', blast: 'Make a blast', erase: 'Remove objects' };
const toolHints = { grab: 'Push into a wall to squish. Push harder, then release to launch!', blast: 'Click anywhere to send things flying.', erase: 'Click an object to remove it. Undo brings it back.' };

$('#app').innerHTML = `
  <header class="app-header">
    <a class="brand" href="./" aria-label="Squish Lab home"><img src="${logoUrl}" width="36" height="36" alt=""/><span>Squish<span class="brand-lab">Lab</span></span><span class="beta-tag">PLAY & EXPERIMENT</span></a>
    <div class="header-actions">
      <span class="local-label"><span></span> A happy little physics sandbox</span>
      <button id="save" class="button quiet" title="Save this room on this device">${icon('save', 17)}<span>Save room</span></button>
      <button id="help" class="icon-button" aria-label="How to play" title="How to play (?)">${icon('help')}</button>
      <a class="icon-button github-link" href="https://github.com/ARU-Tris/squish-lab" target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub" title="Source code">${icon('github')}</a>
    </div>
  </header>
  <main class="workspace">
    <aside class="shelf" aria-label="Toy shelf">
      <div class="shelf-heading"><div><span class="eyebrow">YOUR TOY BOX</span><h1>Good things<br>to mess with.</h1></div><span class="shelf-decoration">↘</span></div>
      <p class="shelf-note">Click to add. Drag to place.</p>
      <div class="toy-groups">${groups.map(group => `<section class="toy-group"><h2>${group.title}</h2><div class="toy-grid">${group.items.map(kind => `<button class="toy" data-kind="${kind}" draggable="true" title="Add ${MATERIALS[kind].name} — ${MATERIALS[kind].firmness}. Push into a wall to squish." aria-label="Add ${MATERIALS[kind].name}"><span class="toy-image">${toyIcon(kind)}</span><span>${MATERIALS[kind].name}</span>${MATERIALS[kind].soft ? '<i class="soft-dot" title="Extra squishy"></i>' : ''}</button>`).join('')}</div></section>`).join('')}</div>
      <button id="surprise" class="surprise-button">${icon('plus', 15)} A little surprise</button>
      <div class="shelf-foot"><span class="soft-dot"></span> All toys squish. These squish more.</div>
    </aside>
    <section class="lab" aria-label="Physics playground">
      <div class="room-heading">
        <div class="room-title"><span class="live-dot"></span><span id="scene-label">THE PLAY ROOM</span><span class="room-number">/ 01</span></div>
        <div class="room-actions"><div class="scene-select-wrap"><select id="scene" aria-label="Choose a scene">${Object.entries(sceneNames).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select>${icon('down', 13)}</div><button id="reset" class="icon-button" aria-label="Reset scene" title="Reset scene (R)">${icon('reset', 18)}</button></div>
      </div>
      <div class="arena" id="arena">
        <div class="room-intro"><span class="handwritten">permission to play.</span><p>A little room.<br><em>Endless possibilities.</em></p><span class="intro-caption">SQUISH IT. STACK IT. SEE WHAT HAPPENS.</span></div>
        <div class="room-label">EXPERIMENT NO. <span id="experiment-number">001</span><span class="corner-plus">+</span></div>
        <canvas id="room" aria-label="Interactive physics room. Grab any toy and push it into a wall, floor, or another object to squish. Let go to spring back." tabindex="0"></canvas>
        <div id="pause-overlay" class="pause-badge" hidden>${icon('pause', 14)} TAKING A BREATHER</div>
        <div id="object-info" class="object-info" hidden></div>
        <div class="arena-bottom-label"><span>GO ON, MAKE A MESS.</span><span>THERE ARE NO WRONG ANSWERS ↗</span></div>
        <div id="toast" class="toast" role="status" aria-live="polite"></div>
      </div>
      <div class="play-controls">
        <div class="tool-switch" role="group" aria-label="Interaction tools">${[['grab','Grab & squish'],['blast','Blast'],['erase','Erase']].map(([key, label], i) => `<button class="tool ${i === 0 ? 'active' : ''}" data-tool="${key}" aria-label="${toolNames[key]}" aria-pressed="${i === 0}" title="${toolNames[key]} (${i + 1})">${icon(key, 19)}<span>${label}</span><kbd>${i + 1}</kbd></button>`).join('')}</div>
        <div class="transport"><button id="undo" class="icon-button" aria-label="Undo last edit" title="Undo last edit (Ctrl+Z)" disabled>${icon('undo', 18)}</button><span class="divider"></span><button id="pause" class="icon-button" aria-label="Pause simulation" title="Pause / resume (Space)">${icon('pause', 20)}</button><button id="step" class="icon-button" aria-label="Advance one physics frame" title="Advance one frame">${icon('step', 18)}</button><div class="settings-wrap"><button id="settings-button" class="icon-button" aria-label="Physics settings" aria-expanded="false" title="Physics settings">${icon('settings', 19)}</button><div id="settings" class="settings-panel" hidden>
          <div class="panel-title">A few laws of nature <button class="close-settings icon-button" aria-label="Close settings">${icon('close', 15)}</button></div>
          <label class="setting-label" for="gravity">Gravity <span id="gravity-value">Earth · 1 g</span></label><div class="gravity-buttons" role="group" aria-label="Gravity">${[['earth','Earth'],['moon','Moon'],['zero','Zero G'],['reverse','Reverse']].map(([k,v])=>`<button data-gravity="${k}" class="${k === 'earth' ? 'active' : ''}">${v}</button>`).join('')}</div>
          <label class="setting-label" for="speed">Time <span id="speed-value">Normal · 1×</span></label><input id="speed" type="range" min="0.1" max="1.5" step="0.05" value="1"/><div class="range-captions"><span>Slow & satisfying</span><span>A little chaos</span></div>
          <label class="setting-label" for="size">New toy size <span id="size-value">100%</span></label><input id="size" type="range" min="0.5" max="1.65" step="0.05" value="1"/>
          <label class="toggle-row">Motion trails <input id="trails" type="checkbox" role="switch"/></label>
          <div class="settings-operations"><button id="load" class="button quiet">${icon('load',15)} Load saved</button><button id="export" class="button quiet">${icon('download',15)} Export</button><button id="import" class="button quiet">${icon('upload',15)} Import</button><button id="clear" class="button quiet danger">${icon('trash',15)} Empty room</button></div>
          <p class="settings-footnote">Saved on this device. Your room, your experiments.</p>
        </div></div><button id="sound" class="icon-button" aria-label="Enable sound" aria-pressed="false" title="Enable sound">${icon('muted', 19)}</button><button id="fullscreen" class="icon-button" aria-label="Toggle fullscreen" title="Fullscreen">${icon('full', 18)}</button></div>
      </div>
      <div class="statusbar"><span id="hint">${toolHints.grab}</span><span class="status-metrics"><span id="object-count">10 objects</span><span class="status-dot">·</span><span id="gravity-status">EARTH GRAVITY</span><span class="status-dot">·</span><span id="fps">60 FPS</span></span></div>
    </section>
  </main>
  <footer class="app-footer"><span>A tiny playground for your curious side.</span><span>Built with physics. Best enjoyed without a plan. <span class="footer-flower">✳</span></span></footer>
  <dialog id="help-dialog"><button id="close-help" class="dialog-close icon-button" aria-label="Close how to play">${icon('close')}</button><div class="help-mark">${toyIcon('jelly')}</div><span class="eyebrow">WELCOME TO YOUR LITTLE LAB</span><h2>Serious physics.<br>Unserious experiments.</h2><p>There’s nothing to win. Just a room full of things that are really fun to mess with.</p><div class="help-grid"><div>${icon('hand',24)}<h3>Grab, push & squish</h3><p>Grab any toy and push it into a wall, the floor, or another toy. Push harder to compress more; release to launch away from the surface.</p></div><div>${icon('squeeze',24)}<h3>Feel the difference</h3><p>Everything is elastic. Jelly squishes easily; rubber resists more; wood and metal need much more force. A faster fling still throws.</p></div><div>${icon('plus',24)}<h3>Make it yours</h3><p>Add toys from the shelf. Try a trampoline, or use a magnet to attract the steel balls.</p></div><div>${icon('settings',24)}<h3>Bend the rules</h3><p>Try Moon gravity, slow time, motion trails, or a ready-made scene. Save your favorite mess.</p></div></div><div class="shortcut-row"><span><kbd>1</kbd>–<kbd>3</kbd> Tools</span><span><kbd>Space</kbd> Pause</span><span><kbd>R</kbd> Reset</span><span><kbd>B</kbd> Ball rain</span></div><button id="start-playing" class="button primary">Let’s make a mess ${icon('plus',17)}</button><small>Mass, friction, springs and pressure bring every toy to life. Compression and rebound come from contact with the room and other toys.</small></dialog>
  <input id="import-file" type="file" accept="application/json,.json" hidden/>
`;

const arena = $('#arena');
const room = new PhysicsRoom(arena.clientWidth, arena.clientHeight);
const renderer = new RoomRenderer($('#room'), room);
let currentScene = 'sandbox', tool = 'grab', paused = false, timeScale = 1, newSize = 1;
let pointerDown = false, activePointer = null, selected = null, hover = null, soundEnabled = false, audio = null;
let experiment = 1, lastFrame = performance.now(), accumulator = 0, lastUI = 0, fps = 60;
let history = [], toastTimer, impactTime = 0;

function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message; $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3000);
}

function remember() {
  history.push({ data: room.serialize(), scene: currentScene });
  if (history.length > 20) history.shift();
  $('#undo').disabled = false;
}

function undo() {
  const prev = history.pop();
  if (!prev) return;
  releasePointer(false);
  room.restore(prev.data); currentScene = prev.scene; $('#scene').value = currentScene;
  $('#scene-label').textContent = sceneNames[currentScene].toUpperCase();
  selected = null; syncGravity(); syncInfo();
  $('#undo').disabled = !history.length;
  notify('One little experiment undone.');
}

function chooseTool(next) {
  releasePointer(false); tool = next; renderer.tool = tool;
  document.querySelectorAll('[data-tool]').forEach(el => { const isActive = el.dataset.tool === tool; el.classList.toggle('active', isActive); el.setAttribute('aria-pressed', isActive); });
  $('#hint').textContent = toolHints[tool]; $('#room').dataset.tool = tool;
}

function setPause(value) {
  releasePointer(false); paused = value; accumulator = 0;
  $('#pause').innerHTML = icon(paused ? 'play' : 'pause');
  $('#pause').setAttribute('aria-label', paused ? 'Resume simulation' : 'Pause simulation');
  $('#pause-overlay').hidden = !paused;
}

function syncGravity() {
  const names = { earth: 'Earth · 1 g', moon: 'Moon · 0.17 g', zero: 'Weightless · 0 g', reverse: 'Reverse · −0.65 g' };
  $('#gravity-value').textContent = names[room.gravity];
  $('#gravity-status').textContent = `${room.gravity === 'zero' ? 'ZERO G' : room.gravity.toUpperCase() + ' GRAVITY'}`;
  document.querySelectorAll('[data-gravity]').forEach(b => b.classList.toggle('active', b.dataset.gravity === room.gravity));
}

function syncInfo() {
  const el = $('#object-info');
  if (selected && room.entities.includes(selected)) {
    el.hidden = false;
    el.innerHTML = `<span class="info-dot" style="background:${selected.mat.color}"></span><strong>${selected.mat.name}</strong><span>${selected.mat.firmness}</span><button class="rotate-selected icon-button" aria-label="Rotate selected object" title="Rotate object by 15 degrees">↻</button><button class="delete-selected icon-button" aria-label="Remove selected object" title="Remove selected object">${icon('trash',14)}</button>`;
    $('.delete-selected').onclick = () => { remember(); room.remove(selected); selected = null; syncInfo(); };
    $('.rotate-selected').onclick = () => {
      remember();
      room.rotate(selected, Math.PI / 12);
    };
  } else { el.hidden = true; selected = null; }
}

function addToy(kind, x, y) {
  remember();
  const e = room.add(kind, x ?? room.width * (0.25 + Math.random() * 0.5), y ?? 85, { size: newSize });
  if (!e) { history.pop(); $('#undo').disabled = !history.length; notify(`The toy box is full! Remove a few things (${MAX_OBJECTS} max).`); return; }
  selected = e; syncInfo();
  renderer.burst(centerOf(e), e.mat.color, 9);
  $('.room-intro').classList.add('faded');
  tone(350 + Math.random() * 100, 0.06, 0.035);
}

function switchScene(name, saveHistory = true) {
  if (saveHistory) remember();
  releasePointer(false);
  currentScene = name; room.scene(name); $('#scene').value = name;
  $('#scene-label').textContent = sceneNames[name].toUpperCase();
  experiment++; $('#experiment-number').textContent = String(experiment).padStart(3, '0');
  selected = null; syncGravity(); syncInfo();
  $('.room-intro').classList.toggle('faded', name !== 'sandbox');
  if (name === 'bowling') notify('Fling a ball into the pins. Or squish your way to a strike.');
  if (name === 'marbles') notify('Follow the bounce. Move the ramps and make your own route.');
  if (name === 'zero') notify('Weightless daydreams. Give a blob a gentle push.');
}

function tone(freq, duration, volume = 0.025) {
  if (!soundEnabled || !audio || audio.state !== 'running') return;
  const osc = audio.createOscillator(), gain = audio.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(freq, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(freq * 0.55, audio.currentTime + duration);
  gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration);
}

room.onImpact = (p, strength) => {
  const now = performance.now();
  if (now - impactTime > 85) { tone(100 + strength * 170, 0.10, strength * 0.05); impactTime = now; }
};
room.onBurst = (point, color, count) => { renderer.burst(point, color, count); tone(210, 0.23, 0.05); };

function coords(event) {
  const rect = $('#room').getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function releasePointer(launch = false) {
  room.endGrab(launch && !paused);
  pointerDown = false;
  if (activePointer != null && $('#room').hasPointerCapture(activePointer)) $('#room').releasePointerCapture(activePointer);
  activePointer = null; $('#room').classList.remove('dragging');
}

$('#room').addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  e.preventDefault(); $('#room').focus({ preventScroll: true });
  const p = coords(e), target = room.pick(p.x, p.y);
  if (tool === 'blast') { remember(); room.blast(p.x, p.y); return; }
  if (!target) { selected = null; syncInfo(); return; }
  selected = target; syncInfo();
  if (tool === 'erase') { remember(); room.remove(target); selected = null; syncInfo(); return; }
  remember();
  pointerDown = true; activePointer = e.pointerId; $('#room').setPointerCapture(e.pointerId); $('#room').classList.add('dragging');
  room.startGrab(target, p);
  if (paused) notify('Time is paused. Move toys, then resume to squish.');
  $('.room-intro').classList.add('faded');
});
$('#room').addEventListener('pointermove', e => {
  const p = coords(e); renderer.pointer = p;
  if (pointerDown && e.pointerId === activePointer) {
    if (paused && selected) { const c = centerOf(selected); room.translate(selected, p.x - c.x, p.y - c.y); }
    else room.moveGrab(p);
  }
  hover = room.pick(p.x, p.y); renderer.hover = hover;
  $('#room').classList.toggle('over-object', !!hover);
});
$('#room').addEventListener('pointerup', e => { if (e.pointerId === activePointer) releasePointer(true); });
$('#room').addEventListener('pointercancel', () => releasePointer(false));
$('#room').addEventListener('lostpointercapture', () => { if (pointerDown) releasePointer(false); });
$('#room').addEventListener('pointerleave', () => { renderer.hover = null; hover = null; if (!pointerDown) renderer.pointer = null; });
window.addEventListener('blur', () => releasePointer(false));
document.addEventListener('visibilitychange', () => { if (document.hidden) { releasePointer(false); accumulator = 0; } lastFrame = performance.now(); });

document.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => chooseTool(b.dataset.tool));
document.querySelectorAll('[data-kind]').forEach(b => {
  b.onclick = () => addToy(b.dataset.kind);
  b.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', b.dataset.kind); e.dataTransfer.effectAllowed = 'copy'; });
});
arena.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; arena.classList.add('drop-ready'); });
arena.addEventListener('dragleave', () => arena.classList.remove('drop-ready'));
arena.addEventListener('drop', e => {
  e.preventDefault(); arena.classList.remove('drop-ready');
  const kind = e.dataTransfer.getData('text/plain');
  if (MATERIALS[kind]) { const p = coords(e); addToy(kind, p.x, p.y); }
});

$('#scene').onchange = e => switchScene(e.target.value);
$('#reset').onclick = () => { switchScene(currentScene); notify('A fresh start. Same possibilities.'); };
$('#undo').onclick = undo;
$('#pause').onclick = () => setPause(!paused);
$('#step').onclick = () => { if (!paused) setPause(true); room.step(); };
$('#surprise').onclick = () => { const pool = ['jelly','rubber','water','bouncy','crate','bumper','fan']; addToy(pool[Math.floor(Math.random() * pool.length)]); notify('A new friend has entered the room.'); };

const settingsPanel = $('#settings');
function showSettings(show) { settingsPanel.hidden = !show; $('#settings-button').setAttribute('aria-expanded', show); }
$('#settings-button').onclick = () => showSettings(settingsPanel.hidden);
$('.close-settings').onclick = () => showSettings(false);
document.addEventListener('pointerdown', e => { if (!e.target.closest('.settings-wrap')) showSettings(false); });
document.querySelectorAll('[data-gravity]').forEach(b => b.onclick = () => { remember(); room.setGravity(b.dataset.gravity); syncGravity(); });
$('#speed').oninput = e => { timeScale = Number(e.target.value); $('#speed-value').textContent = `${timeScale < 0.8 ? 'Slow motion' : timeScale > 1.15 ? 'Speedy' : 'Normal'} · ${timeScale.toFixed(2).replace(/0$/, '')}×`; };
$('#size').oninput = e => { newSize = Number(e.target.value); $('#size-value').textContent = `${Math.round(newSize * 100)}%`; };
$('#trails').onchange = e => renderer.trails = e.target.checked;
$('#sound').onclick = async () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) { audio ??= new (window.AudioContext || window.webkitAudioContext)(); await audio.resume(); }
  $('#sound').innerHTML = icon(soundEnabled ? 'sound' : 'muted', 19);
  $('#sound').setAttribute('aria-pressed', soundEnabled);
  $('#sound').setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound');
  $('#sound').title = soundEnabled ? 'Mute sound' : 'Enable sound';
  if (soundEnabled) tone(420, 0.12);
};
$('#fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else notify('Tip: add this page to your home screen for a bigger playground.');
  } catch { notify('Your browser couldn’t enter fullscreen.'); }
};

$('#save').onclick = () => {
  try { localStorage.setItem('squish-lab-room-v1', JSON.stringify({ scene: currentScene, room: room.serialize() })); notify('Room saved on this device. Your beautiful mess is safe.'); }
  catch { notify('Browser storage is unavailable. Use Export in settings instead.'); }
};
$('#load').onclick = () => {
  try {
    const raw = localStorage.getItem('squish-lab-room-v1');
    if (!raw) { notify('No saved room yet. Hit Save room to keep one.'); return; }
    const data = JSON.parse(raw); remember(); releasePointer(false); room.restore(data.room);
    currentScene = sceneNames[data.scene] ? data.scene : 'sandbox'; $('#scene').value = currentScene;
    $('#scene-label').textContent = sceneNames[currentScene].toUpperCase();
    selected = null; syncInfo(); syncGravity(); showSettings(false); notify('Welcome back to your beautiful mess.');
  } catch { notify('That saved room couldn’t be opened. Your current room is still here.'); }
};
$('#export').onclick = () => {
  const blob = new Blob([JSON.stringify(room.serialize(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'my-squish-lab.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('One portable little universe, exported.');
};
$('#import').onclick = () => $('#import-file').click();
$('#import-file').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('Too large');
    const data = JSON.parse(await file.text()); remember(); releasePointer(false); room.restore(data);
    selected = null; syncInfo(); syncGravity(); showSettings(false); notify('A new little universe, imported.');
  } catch { notify('That file isn’t a valid Squish Lab room. Your room is unchanged.'); }
  e.target.value = '';
};
$('#clear').onclick = () => { remember(); releasePointer(false); room.clear(); selected = null; syncInfo(); showSettings(false); notify('A blank canvas. Undo is here if you need it.'); };

$('#help').onclick = () => { releasePointer(false); $('#help-dialog').showModal(); };
$('#close-help').onclick = $('#start-playing').onclick = () => $('#help-dialog').close();
$('#help-dialog').addEventListener('click', e => { if (e.target === $('#help-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });

function ballRain() {
  remember();
  for (let i = 0; i < 12; i++) room.add(i % 4 === 0 ? 'rubber' : 'bouncy', 35 + Math.random() * (room.width - 70), 30 + Math.random() * 90, { size: 0.5 + Math.random() * 0.25 });
  notify('The forecast? A 100% chance of bounce.'); renderer.burst({ x: room.width / 2, y: 35 }, '#e3bf55', 24);
}

document.addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea') || $('#help-dialog').open) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.code === 'Space') { e.preventDefault(); setPause(!paused); }
  if (['1','2','3'].includes(e.key)) { e.preventDefault(); chooseTool(['grab','blast','erase'][Number(e.key) - 1]); }
  if (e.key.toLowerCase() === 'r') $('#reset').click();
  if (e.key.toLowerCase() === 'b') ballRain();
  if (e.key.toLowerCase() === 'g') { remember(); const modes = ['earth','moon','zero','reverse']; room.setGravity(modes[(modes.indexOf(room.gravity) + 1) % 4]); syncGravity(); notify(`Gravity: ${room.gravity}`); }
  if (e.key === '?' || e.key.toLowerCase() === 'h') $('#help').click();
  if (e.key === 'Escape') { releasePointer(false); showSettings(false); selected = null; syncInfo(); chooseTool('grab'); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); remember(); room.remove(selected); selected = null; syncInfo(); }
});

let resizeTimer;
new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const w = arena.clientWidth, h = arena.clientHeight;
    if (w < 100 || h < 100) return;
    if (w !== room.width || h !== room.height) room.resize(w, h);
    renderer.resize(w, h);
  }, 50);
}).observe(arena);

renderer.resize(room.width, room.height);
room.scene('sandbox');
syncGravity();
function frame(now) {
  const delta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000)); lastFrame = now;
  if (!paused && !document.hidden) {
    accumulator += delta * 1000 * timeScale;
    let steps = 0;
    while (accumulator >= STEP && steps++ < 12) { room.step(); accumulator -= STEP; }
    if (steps >= 12) accumulator = 0;
  }
  renderer.selected = pointerDown ? selected : null;
  renderer.draw(now, delta);
  fps = fps * 0.95 + (delta > 0 ? 1 / delta : 60) * 0.05;
  if (now - lastUI > 450) {
    $('#object-count').textContent = `${room.entities.length} object${room.entities.length === 1 ? '' : 's'}`;
    $('#fps').textContent = `${Math.min(240, Math.round(fps))} FPS`;
    if (selected && !room.entities.includes(selected)) syncInfo();
    lastUI = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Dev-only inspection lets browser tests verify the actual simulation, not a parallel mock.
if (import.meta.env.DEV) window.__lab = { room, renderer, chooseTool, setPause, ballRain, get selected() { return selected; }, get paused() { return paused; } };
