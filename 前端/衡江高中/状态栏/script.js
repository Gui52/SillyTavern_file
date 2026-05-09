import { getMvuData, get, waitMvu } from '../../公共/utils.js';

/* ===== 工具函数 ===== */
function pad(num) {
  return num < 10 ? '0' + num : num;
}

/* ===== 天气图标映射 ===== */
const weatherIcons = {
  '晴': 'svg-weather-sunny',
  '晴朗': 'svg-weather-sunny',
  '晴天': 'svg-weather-sunny',
  '阳光': 'svg-weather-sunny',
  '多云': 'svg-weather-cloudy',
  '阴': 'svg-weather-cloudy',
  '阴天': 'svg-weather-cloudy',
  '雨': 'svg-weather-rain',
  '雨天': 'svg-weather-rain',
  '下雨': 'svg-weather-rain',
  '暴雨': 'svg-weather-rain',
  '雪': 'svg-weather-snow',
  '雪天': 'svg-weather-snow',
  '下雪': 'svg-weather-snow',
};

function updateWeatherIcon(weather) {
  const iconEl = document.getElementById('env-weather-icon');
  if (!iconEl) return;
  const iconId = weatherIcons[weather] || 'svg-weather-sunny';
  iconEl.innerHTML = `<use href="#${iconId}"></use>`;
}

/* ===== 数据填充 ===== */
function populateData() {
  const vars = getMvuData();
  const sysTime = get(vars, 'stat_data.系统.时间', {});
  const sysEnv = get(vars, 'stat_data.系统.环境', {});
  const player = get(vars, 'stat_data.主角', {});

  const dateStr = `${sysTime.年 || '---'}年${sysTime.月 || '-'}月${sysTime.日 || '-'}日`;
  const timeStr = `${pad(sysTime.时 || 0)}:${pad(sysTime.分 || 0)}`;
  setText('sys-date', dateStr);
  setText('sys-time', `${sysTime.星期 || '---'} ${timeStr}`);
  setText('env-date', dateStr);
  const season = sysEnv.季节 || '-';
  const weather = sysEnv.天气 || '-';
  setText('sys-env', `${season}季 / ${weather}`);
  updateWeatherIcon(weather);
  setText('sys-festival', sysEnv.特殊节日 && sysEnv.特殊节日 !== '无' ? sysEnv.特殊节日 : '日常');

  setText('player-class', player.当前班级 || '未分班');
  setText('player-loc', player.当前位置 || '未知');
  setText('player-action', player.当前行为 || '无');
  setText('player-money', `¥${player.金钱 || 0}`);
  setText('player-course', player.当前课程或活动 && player.当前课程或活动 !== '无' ? player.当前课程或活动 : '课间/休息');

  const stamina = player.体力 || 0;
  const staminaVal = document.getElementById('player-stamina-val');
  const staminaBar = document.getElementById('player-stamina-bar');
  if (staminaVal) {
    const newText = `${stamina}/100`;
    if (staminaVal.textContent !== newText) {
      animateValueChange(staminaVal);
      staminaVal.textContent = newText;
    }
  }
  if (staminaBar) {
    const newWidth = `${stamina}%`;
    if (staminaBar.style.width !== newWidth) {
      staminaBar.style.animation = 'none';
      staminaBar.offsetHeight;
      staminaBar.style.animation = 'staminaChange 0.8s ease';
      staminaBar.style.width = newWidth;
    }
  }

  if (staminaVal) staminaVal.classList.remove('warning', 'danger');
  if (staminaBar) staminaBar.classList.remove('warning', 'danger');
  if (stamina < 30) {
    if (staminaVal) staminaVal.classList.add('danger');
    if (staminaBar) staminaBar.classList.add('danger');
  } else if (stamina < 50) {
    if (staminaVal) staminaVal.classList.add('warning');
    if (staminaBar) staminaBar.classList.add('warning');
  }

  populateSocialList(vars);
  syncCompactSummary();
  updateGuideData(vars);
}

function populateSocialList(vars) {
  const charsData = get(vars, 'stat_data.角色', {});
  let charHtml = '';
  let metCount = 0;

  Object.keys(charsData).forEach(charName => {
    const charInfo = charsData[charName];
    if (charInfo && charInfo.已相遇 === true) {
      metCount++;
      const affection = charInfo.好感度 || 0;
      const relation = charInfo.关系状态 || '陌生人';
      const initial = charName.charAt(0);
      charHtml += `
        <div class="char-card" data-char="${charName}" data-affection="${affection}" data-relation="${relation}" role="button" tabindex="0" style="animation-delay: ${(metCount - 1) * 0.08}s">
          <div class="char-header">
            <span class="char-name"><span class="char-avatar">${initial}</span>${charName}</span>
            <span class="char-relation">${relation}</span>
          </div>
          <div class="char-affection">
            <span class="char-affection-label">好感度</span>
            <span class="char-affection-value">${affection}/100</span>
          </div>
          <div class="char-bar"><div class="char-bar-fill" style="width: ${affection}%"></div></div>
        </div>`;
    }
  });

  setText('social-count', String(metCount));
  setText('social-desc', metCount > 0 ? '已相遇的角色' : '等待相遇...');

  const socialList = document.getElementById('social-list');
  const socialCountEl = document.getElementById('social-count');
  if (socialCountEl) {
    socialCountEl.style.animation = 'none';
    socialCountEl.offsetHeight;
    socialCountEl.style.animation = 'countPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  }
  if (socialList) {
    socialList.innerHTML = metCount === 0
      ? '<div class="empty-state">茫茫人海中，你还在等待那场注定的相遇...</div>'
      : charHtml;
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    if (el.textContent !== text) {
      el.classList.remove('value-flash');
      void el.offsetWidth;
      el.classList.add('value-flash');
      el.textContent = text;
    }
  }
}

function animateValueChange(el) {
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'valueChange 0.3s ease';
}

function syncCompactSummary() {
  const getText = (id) => document.getElementById(id)?.textContent || '未知';
  setText('summary-loc', getText('player-loc'));
  setText('summary-action', getText('player-action'));
  setText('summary-stamina', getText('player-stamina-val'));
  setText('summary-social', getText('social-count'));
}

/* ===== 人物图鉴 ===== */
const allCharacters = [
  { name: '顾朝阳', identity: '体育学院·体(1)班' },
  { name: '沈清越', identity: '数学老师·班主任' },
  { name: '陈默', identity: '文科学院·文(2)班' },
  { name: '林何', identity: '理科学院·理(3)班' },
  { name: '叶辞', identity: '文科学院' },
  { name: '顾盼', identity: '体育学院' },
  { name: '林宇', identity: '理科学院' },
  { name: '陆屿', identity: '体育学院' },
  { name: '陆时', identity: '文科学院' },
  { name: '江晏', identity: '副校长' },
  { name: '厉渊', identity: '警察' },
  { name: '周野', identity: '体育学院' },
  { name: '凌曜', identity: '体育学院' },
  { name: '秦放', identity: '理科学院' },
  { name: '石磊', identity: '体育学院' },
  { name: '温景辞', identity: '校医院' },
  { name: '萧立', identity: '理科学院' },
  { name: '谢书砚', identity: '文科学院·年级第一' },
  { name: '许知言', identity: '音乐学院' },
  { name: '时年', identity: '美术学院' },
  { name: '苏沐辰', identity: '物理老师' },
  { name: '季川', identity: '图书馆管理员' },
  { name: '方屿', identity: '美术老师' },
  { name: '裴烬', identity: '理科学院·年级第一' },
  { name: '纪淮', identity: '文科学院·班长' },
  { name: '白鹿', identity: '理科学院·跳级新生' },
  { name: '向南', identity: '体育学院·短跑特长生' },
  { name: '王铁柱', identity: '食堂' },
  { name: '杰克', identity: '交换生·橄榄球' },
  { name: '布雷迪', identity: '交换生·摔跤' },
  { name: '迪伦', identity: '交换生' },
  { name: '小野健太', identity: '交换生·棒球' },
  { name: '陆沉', identity: '教导主任' },
  { name: '顾衍', identity: '田径教练' },
  { name: '沈知远', identity: '校长' },
  { name: '柳善宇', identity: '体育学院·游泳' },
];

let guideData = [];
let currentFilter = 'all';
let currentSearch = '';

function updateGuideData(vars) {
  const charsData = get(vars, 'stat_data.角色', {});
  guideData = allCharacters.map(char => {
    const charInfo = charsData[char.name] || {};
    return {
      name: char.name,
      identity: char.identity,
      met: charInfo.已相遇 === true,
      affection: charInfo.好感度 || 0,
      relation: charInfo.关系状态 || '陌生人',
    };
  });
}

function openGuideModal() {
  const modal = document.getElementById('guide-modal');
  if (modal) {
    modal.classList.add('active');
    renderGuideGrid();
    document.getElementById('guide-search')?.focus();
  }
}

function closeGuideModal() {
  document.getElementById('guide-modal')?.classList.remove('active');
  document.getElementById('header-toggle')?.focus();
}

function renderGuideGrid() {
  const grid = document.getElementById('guide-char-grid');
  const empty = document.getElementById('guide-empty');
  if (!grid) return;

  let filtered = guideData;

  if (currentFilter === 'met') {
    filtered = filtered.filter(c => c.met);
  } else if (currentFilter === 'unmet') {
    filtered = filtered.filter(c => !c.met);
  }

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.identity.toLowerCase().includes(q));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  grid.innerHTML = filtered.map((char, idx) => {
    const initial = char.name.charAt(0);
    const metClass = char.met ? 'met' : 'unmet';
    return `
      <div class="guide-char-card ${metClass}" data-name="${char.name}" data-affection="${char.affection}" data-relation="${char.relation}" role="button" tabindex="0" style="animation-delay: ${idx * 0.05}s">
        <div class="guide-char-avatar">${initial}</div>
        <div class="guide-char-name">${char.name}</div>
        <div class="guide-char-identity">${char.identity}</div>
        <div class="guide-char-relation">${char.met ? char.relation : '未相遇'}</div>
      </div>`;
  }).join('');
}

/* ===== 好感度等级 ===== */
function getAffectionLevel(affection) {
  if (affection >= 90) return { level: '家人', color: 'var(--danger-color)' };
  if (affection >= 75) return { level: '恋人', color: 'var(--accent-color)' };
  if (affection >= 60) return { level: '在意', color: 'var(--success-color)' };
  if (affection >= 40) return { level: '朋友', color: 'var(--primary-color)' };
  if (affection >= 20) return { level: '已相识', color: 'var(--text-sub)' };
  return { level: '陌生人', color: 'var(--text-muted)' };
}

/* ===== 角色详情模态框 ===== */
function showCharModal(charName, affection, relation) {
  const initial = charName.charAt(0);
  const levelInfo = getAffectionLevel(affection);

  setText('modal-avatar', initial);
  setText('modal-name', charName);
  setText('modal-relation', relation);
  const affVal = document.getElementById('modal-affection-value');
  if (affVal) {
    affVal.style.animation = 'none';
    affVal.offsetHeight;
    affVal.style.animation = 'valueChange 0.4s ease';
    affVal.innerHTML = `${affection} <span>/ 100</span>`;
  }
  const barFill = document.getElementById('modal-bar-fill');
  if (barFill) {
    barFill.style.animation = 'none';
    barFill.offsetHeight;
    barFill.style.animation = 'staminaChange 0.8s ease';
    barFill.style.width = `${affection}%`;
  }

  const levels = ['陌生人', '已相识', '朋友', '在意', '恋人', '家人'];
  const modalLevels = document.getElementById('modal-levels');
  if (modalLevels) {
    modalLevels.innerHTML = levels.map(lv =>
      `<span class="level-badge ${lv === levelInfo.level ? 'active' : ''}">${lv}</span>`
    ).join('');
  }

  document.getElementById('char-modal')?.classList.add('active');
}

function closeCharModal() {
  document.getElementById('char-modal')?.classList.remove('active');
  document.getElementById('header-toggle')?.focus();
}

/* ===== 主题管理 ===== */
function updateThemeIcon(isDark) {
  const btn = document.getElementById('toggle-theme');
  if (!btn) return;
  const useEl = btn.querySelector('use');
  if (useEl) {
    useEl.setAttribute('href', isDark ? '#svg-moon' : '#svg-sun');
  }
}

function loadTheme() {
  try {
    const saved = localStorage.getItem('hengjiang-theme');
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
      updateThemeIcon(false);
    } else {
      document.documentElement.classList.add('dark');
      updateThemeIcon(true);
    }
  } catch {}
}

function saveTheme(isDark) {
  try { localStorage.setItem('hengjiang-theme', isDark ? 'dark' : 'light') } catch {}
}

/* ===== 折叠管理 ===== */
function toggleCardCollapse(card) {
  const isCollapsed = card.classList.toggle('collapsed');
  const header = card.querySelector('.card-header');
  if (header) header.setAttribute('aria-expanded', String(!isCollapsed));
  saveCollapseState(card.id, isCollapsed);
}

function loadCollapseStates() {
  try {
    const states = JSON.parse(localStorage.getItem('hengjiang-collapse') || '{}');
    Object.keys(states).forEach(id => {
      if (states[id]) document.getElementById(id)?.classList.add('collapsed');
    });
  } catch {}
}

function saveCollapseState(id, isCollapsed) {
  try {
    const states = JSON.parse(localStorage.getItem('hengjiang-collapse') || '{}');
    states[id] = isCollapsed;
    localStorage.setItem('hengjiang-collapse', JSON.stringify(states));
  } catch {}
}

/* ===== 初始化 ===== */
async function init() {
  loadTheme();
  loadCollapseStates();

  await waitMvu();
  populateData();

  (() => {
    try {
      if (window.Mvu?.events?.VARIABLE_UPDATE_ENDED) {
        SillyTavern.getContext().eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => {
          populateData();
          enhanceDynamicCards();
        });
      }
    } catch (e) {
      try {
        Mvu?.events?.on?.(Mvu.events.VARIABLE_UPDATE_ENDED, () => {
          populateData();
          enhanceDynamicCards();
        });
      } catch (e2) {
        console.warn('StatusBar: cannot subscribe to VARIABLE_UPDATE_ENDED');
      }
    }
  })();

  document.querySelectorAll('.card-header').forEach(header => {
    header.addEventListener('click', () => toggleCardCollapse(header.closest('.card')));
  });

  document.getElementById('social-list')?.addEventListener('click', e => {
    const card = e.target.closest('.char-card');
    if (card) {
      showCharModal(card.dataset.char, Number(card.dataset.affection), card.dataset.relation);
    }
  });

  document.getElementById('modal-close')?.addEventListener('click', closeCharModal);
  document.getElementById('char-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCharModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('char-modal')?.classList.contains('active')) closeCharModal();
      if (document.getElementById('guide-modal')?.classList.contains('active')) closeGuideModal();
    }
  });

  document.getElementById('toggle-theme')?.addEventListener('click', function(e) {
    e.stopPropagation();
    const isDark = document.documentElement.classList.toggle('dark');
    this.style.animation = 'none';
    this.offsetHeight;
    this.style.animation = 'themeSwitch 0.5s ease';
    updateThemeIcon(isDark);
    saveTheme(isDark);
  });

  document.getElementById('btn-guide')?.addEventListener('click', function(e) {
    e.stopPropagation();
    this.style.animation = 'none';
    this.offsetHeight;
    this.style.animation = 'btnPulse 0.4s ease';
    openGuideModal();
  });

  document.getElementById('guide-close')?.addEventListener('click', closeGuideModal);
  document.getElementById('guide-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeGuideModal();
  });

  document.querySelectorAll('.guide-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderGuideGrid();
    });
  });

  document.getElementById('guide-search')?.addEventListener('input', e => {
    currentSearch = e.target.value.trim();
    renderGuideGrid();
  });

  document.getElementById('guide-char-grid')?.addEventListener('click', e => {
    const card = e.target.closest('.guide-char-card');
    if (card && card.classList.contains('met')) {
      closeGuideModal();
      setTimeout(() => {
        showCharModal(card.dataset.name, Number(card.dataset.affection), card.dataset.relation);
      }, 150);
    }
  });

  document.getElementById('quick-rest')?.addEventListener('click', function() {
    this.style.animation = 'none';
    this.offsetHeight;
    this.style.animation = 'btnClick 0.3s ease';
    if (window.Mvu) {
      Mvu.setVariable('stat_data.主角.体力', 100);
      Mvu.commit();
    }
  });
}

function enhanceDynamicCards() {
  document.querySelectorAll('.char-card, .guide-char-card').forEach(el => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
  });
  document.querySelectorAll('.guide-char-card').forEach((el, idx) => {
    el.style.animationDelay = `${idx * 0.03}s`;
  });
}

$(() => { init(); });