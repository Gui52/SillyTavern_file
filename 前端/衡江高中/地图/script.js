import { getMvuData, get, waitMvu } from '../../公共/utils.js';

/* ===== 位置坐标映射 ===== */
const LOCATION_COORDS = {
  '静心湖':    { x: 400, y: 300 },
  '食堂':      { x: 585, y: 320 },
  '图书馆':    { x: 590, y: 128 },
  '小卖部':    { x: 517, y: 200 },
  '行政楼':    { x: 400, y: 120 },
  '理科学院':  { x: 190, y: 132 },
  '文科学院':  { x: 175, y: 380 },
  '体育学院':  { x: 350, y: 500 },
  '音乐学院':  { x: 607, y: 445 },
  '美术学院':  { x: 177, y: 502 },
  '宿舍':      { x: 305, y: 235 },
  '竹林':      { x: 60, y: 210 },
  '森林公园':  { x: 400, y: 45 },
  '操场':      { x: 350, y: 555 },
  '教学楼':    { x: 610, y: 260 },
  '未在校':    null,
};

/* ===== 缩放状态 ===== */
let viewBox = { x: 0, y: 0, w: 800, h: 600 };
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.2;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let svgEl = null;
let markersGroup = null;
let playerMarker = null;
let charMarkerEls = {};
let currentMarkers = {};

/* ===== 初始化 ===== */
export async function initMap() {
  const container = document.getElementById('map-svg-wrapper');
  if (!container) return;

  svgEl = container.querySelector('svg');
  if (!svgEl) return;

  markersGroup = svgEl.querySelector('#map-markers') || svgEl;
  playerMarker = svgEl.querySelector('#marker-player');

  setupZoom();
  setupPan();
  await waitMvu();
  updateMarkers();

  (() => {
    try {
      if (window.Mvu?.events?.VARIABLE_UPDATE_ENDED) {
        SillyTavern.getContext().eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, updateMarkers);
      }
    } catch (e) {
      try {
        Mvu?.events?.on?.(Mvu.events.VARIABLE_UPDATE_ENDED, updateMarkers);
      } catch (e2) {
        console.warn('Map: cannot subscribe to VARIABLE_UPDATE_ENDED');
      }
    }
  })();
}

/* ===== 缩放 ===== */
function setupZoom() {
  const container = document.getElementById('map-svg-wrapper');
  if (!container) return;

  container.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP;
    zoomAt(e.offsetX, e.offsetY, delta, container);
  }, { passive: false });

  document.getElementById('map-zoom-in')?.addEventListener('click', () => {
    zoomAt(400, 300, -ZOOM_STEP, document.getElementById('map-svg-wrapper'));
  });
  document.getElementById('map-zoom-out')?.addEventListener('click', () => {
    zoomAt(400, 300, ZOOM_STEP, document.getElementById('map-svg-wrapper'));
  });
  document.getElementById('map-zoom-reset')?.addEventListener('click', () => {
    resetView();
  });
}

function zoomAt(clientX, clientY, delta, container) {
  if (!svgEl) return;
  const rect = container.getBoundingClientRect();
  const svgX = viewBox.x + (clientX - rect.left) * viewBox.w / rect.width;
  const svgY = viewBox.y + (clientY - rect.top) * viewBox.h / rect.height;

  let newW = viewBox.w * (1 + delta * 0.3);
  newW = Math.max(800 / MAX_ZOOM, Math.min(800 / MIN_ZOOM, newW));
  const ratio = newW / viewBox.w;
  viewBox.x = svgX - (svgX - viewBox.x) * ratio;
  viewBox.y = svgY - (svgY - viewBox.y) * ratio;
  viewBox.w = newW;
  viewBox.h = viewBox.w * 0.75;
  applyViewBox();
}

function resetView() {
  viewBox = { x: 0, y: 0, w: 800, h: 600 };
  applyViewBox();
}

function applyViewBox() {
  if (!svgEl) return;
  svgEl.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
}

/* ===== 平移 ===== */
function setupPan() {
  const container = document.getElementById('map-svg-wrapper');
  if (!container) return;

  container.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    container.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!isDragging || !svgEl) return;
    const dx = (e.clientX - dragStart.x) * viewBox.w / container.getBoundingClientRect().width;
    const dy = (e.clientY - dragStart.y) * viewBox.h / container.getBoundingClientRect().height;
    viewBox.x -= dx;
    viewBox.y -= dy;
    dragStart = { x: e.clientX, y: e.clientY };
    applyViewBox();
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      const container = document.getElementById('map-svg-wrapper');
      if (container) container.style.cursor = 'grab';
    }
  });

  container.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      isDragging = true;
      dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  container.addEventListener('touchmove', e => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = (e.touches[0].clientX - dragStart.x) * viewBox.w / container.getBoundingClientRect().width;
    const dy = (e.touches[0].clientY - dragStart.y) * viewBox.h / container.getBoundingClientRect().height;
    viewBox.x -= dx;
    viewBox.y -= dy;
    dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    applyViewBox();
  }, { passive: true });

  container.addEventListener('touchend', () => { isDragging = false; });
}

/* ===== 标记更新 ===== */
function updateMarkers() {
  const vars = getMvuData();
  const charsData = get(vars, 'stat_data.角色', {});
  const player = get(vars, 'stat_data.主角', {});
  if (!svgEl) return;

  const playerLoc = player.当前位置 || '';
  if (playerLoc && playerLoc !== '未知') {
    const pCoord = LOCATION_COORDS[playerLoc];
    if (pCoord) {
      positionPlayerMarker(pCoord);
    } else {
      hidePlayerMarker();
    }
  }

  Object.keys(charsData).forEach(charName => {
    const charInfo = charsData[charName];
    if (charInfo && charInfo.已相遇 === true) {
      const loc = charInfo.当前位置;
      if (loc && loc !== '未在校') {
        const coord = LOCATION_COORDS[loc];
        if (coord) {
          if (!charMarkerEls[charName]) {
            charMarkerEls[charName] = createCharMarker(charName);
          }
          positionCharMarker(charMarkerEls[charName], coord, charName);
        }
      }
      if (charMarkerEls[charName]) {
        charMarkerEls[charName].style.display = (loc && loc !== '未在校') ? '' : 'none';
      }
    } else {
      if (charMarkerEls[charName]) {
        charMarkerEls[charName].style.display = 'none';
      }
    }
  });
}

function positionPlayerMarker(coord) {
  if (!playerMarker || !svgEl) return;
  playerMarker.setAttribute('transform', `translate(${coord.x}, ${coord.y})`);
  playerMarker.style.visibility = 'visible';
}

function hidePlayerMarker() {
  if (playerMarker) playerMarker.style.visibility = 'hidden';
}

function createCharMarker(charName) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.classList.add('map-marker', 'char-marker');
  g.dataset.char = charName;

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.classList.add('marker-dot');
  circle.setAttribute('r', '6');
  circle.setAttribute('fill', '#ed8936');
  circle.setAttribute('stroke', '#fff');
  circle.setAttribute('stroke-width', '1.5');

  const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  pulse.classList.add('marker-pulse');
  pulse.setAttribute('r', '6');
  pulse.setAttribute('fill', '#ed8936');
  pulse.setAttribute('opacity', '0.3');
  const animR = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
  animR.setAttribute('attributeName', 'r');
  animR.setAttribute('values', '6;10;6');
  animR.setAttribute('dur', '2s');
  animR.setAttribute('repeatCount', 'indefinite');
  const animOp = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
  animOp.setAttribute('attributeName', 'opacity');
  animOp.setAttribute('values', '0.4;0.1;0.4');
  animOp.setAttribute('dur', '2s');
  animOp.setAttribute('repeatCount', 'indefinite');
  pulse.appendChild(animR);
  pulse.appendChild(animOp);

  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.classList.add('marker-label');
  label.setAttribute('dy', '-12');
  label.textContent = charName;

  g.appendChild(pulse);
  g.appendChild(circle);
  g.appendChild(label);

  g.addEventListener('click', () => {
    const vars = getMvuData();
    const charInfo = get(vars, `stat_data.角色.${charName}`, {});
    if (charInfo && charInfo.已相遇 === true) {
      window.dispatchEvent(new CustomEvent('map-marker-click', {
        detail: { charName, affection: charInfo.好感度 || 0, relation: charInfo.关系状态 || '陌生人' }
      }));
    }
  });

  markersGroup.appendChild(g);
  return g;
}

function positionCharMarker(el, coord, charName) {
  el.setAttribute('transform', `translate(${coord.x}, ${coord.y})`);
  const label = el.querySelector('.marker-label');
  if (label) label.textContent = charName;
  el.style.display = '';
}

/* ===== 复用状态栏的角色详情弹窗 ===== */
function showCharModalFromMap(charName, affection, relation) {
  if (typeof showCharModal === 'function') {
    showCharModal(charName, affection, relation);
  } else {
    const modal = document.getElementById('char-modal');
    if (modal) {
      const initial = charName.charAt(0);
      document.getElementById('modal-avatar').textContent = initial;
      document.getElementById('modal-name').textContent = charName;
      document.getElementById('modal-relation').textContent = relation;
      const affVal = document.getElementById('modal-affection-value');
      if (affVal) affVal.innerHTML = `${affection} <span>/ 100</span>`;
      const barFill = document.getElementById('modal-bar-fill');
      if (barFill) barFill.style.width = `${affection}%`;
      const levels = ['陌生人', '已相识', '朋友', '在意', '恋人', '家人'];
      const modalLevels = document.getElementById('modal-levels');
      if (modalLevels) {
        const levelInfo = getAffectionLevel(affection);
        modalLevels.innerHTML = levels.map(lv =>
          `<span class="level-badge ${lv === levelInfo.level ? 'active' : ''}">${lv}</span>`
        ).join('');
      }
      modal.classList.add('active');
    }
  }
}

function getAffectionLevel(affection) {
  if (affection >= 90) return { level: '家人', color: 'var(--danger-color)' };
  if (affection >= 75) return { level: '恋人', color: 'var(--accent-color)' };
  if (affection >= 60) return { level: '在意', color: 'var(--success-color)' };
  if (affection >= 40) return { level: '朋友', color: 'var(--primary-color)' };
  if (affection >= 20) return { level: '已相识', color: 'var(--text-sub)' };
  return { level: '陌生人', color: 'var(--text-muted)' };
}
