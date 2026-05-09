import { getMvuData, get, rarityClass, setupCollapsiblePanels, ThemeManager, waitMvu } from '../../公共/utils.js';

/* ===== 数据填充 ===== */
function populateData() {
  const data = get(getMvuData(), 'stat_data', {});

  /* 系统与世界状态 */
  const system = get(data, '系统', {});
  const points = get(system, '积分', 0);
  document.getElementById('points-display').textContent = `${points} P`;
  document.getElementById('ten-pull-notice').style.display = points >= 1000 ? 'inline' : 'none';

  const world = get(system, '世界状态', {});
  document.getElementById('world-time').textContent = `时间: ${get(world, '时间', '未知')} / ${get(world, '日期', '未知')} / ${get(world, '星期', '未知')}`;
  document.getElementById('world-location').textContent = `地点: ${get(world, '地点', '未知')} | 天气: ${get(world, '天气', '未知')}`;

  /* 卡池 */
  const pool = get(system, '卡池', {});
  const cur = get(pool, '当前卡池信息', {});
  const pityCount = 80 - (get(pool, '主题抽卡数', 0) % 80);
  setText('pool-theme', get(pool, '当前主题', '待选择'));
  setText('pool-pulls', String(get(pool, '主题抽卡数', 0)));
  setText('pool-ssr-pity', `${pityCount} 抽`);
  setText('pool-desc', get(cur, '主题描述', '...'));
  setHtml('pool-rates', `<span class="rarity-ssr">SSR: ${get(cur, 'SSR概率', '?')}%</span> / <span class="rarity-sr">SR: ${get(cur, 'SR概率', '?')}%</span> / <span class="rarity-r">R: ${get(cur, 'R概率', '?')}%</span>`);
  setText('pool-rules', get(cur, '保底机制', '...'));
  setText('pool-pity-status', `首次十连: ${get(cur, '首次十连', '否')} | 十连计数: ${get(cur, '十连计数', 0)}`);
  setText('pool-characters', get(cur, '角色列表', []).join(', ') || '无');

  /* 角色卡 */
  const characters = get(data, '角色卡', {});
  const charList = document.getElementById('character-list');
  charList.innerHTML = '';
  if (Object.keys(characters).length === 0) {
    charList.innerHTML = '<div class="placeholder">暂无角色卡</div>';
  } else {
    Object.entries(characters).forEach(([name, ch]) => {
      const r = get(ch, '基础信息.稀有度', 'SR');
      const div = document.createElement('div');
      div.className = 'character-card';
      div.innerHTML = `
        <div class="grid-display">
          <div class="data-item"><span class="data-label">姓名</span><span class="data-value">${name}</span></div>
          <div class="data-item"><span class="data-label">稀有度</span><span class="data-value ${rarityClass(r)}">${r}</span></div>
          <div class="data-item"><span class="data-label">年龄</span><span class="data-value">${get(ch, '基础信息.年龄', '?')}</span></div>
          <div class="data-item"><span class="data-label">职业</span><span class="data-value">${get(ch, '基础信息.职业', '?')}</span></div>
          <div class="data-item"><span class="data-label">好感度</span><span class="data-value">${get(ch, '状态.好感度', 0)}</span></div>
          <div class="data-item"><span class="data-label">当前动作</span><span class="data-value">${get(ch, '状态.当前动作', '...')}</span></div>
          <div class="data-item"><span class="data-label">表情</span><span class="data-value">${get(ch, '状态.表情', '...')}</span></div>
          <div class="data-item"><span class="data-label">想法</span><span class="data-value">${get(ch, '状态.想法', '...')}</span></div>
          <div class="data-item"><span class="data-label">服装</span><span class="data-value highlight-pink">${get(ch, '状态.服装', '...')}</span></div>
        </div>`;
      charList.appendChild(div);
    });
  }

  /* 背包 */
  const inventory = get(system, '库存.道具卡', {});
  const invList = document.getElementById('inventory-list');
  invList.innerHTML = '';
  if (Object.keys(inventory).length === 0) {
    invList.innerHTML = '<div class="placeholder">背包空空如也</div>';
  } else {
    const grid = document.createElement('div');
    grid.className = 'grid-display';
    Object.entries(inventory).forEach(([name, item]) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'data-item';
      itemDiv.innerHTML = `<span class="data-label">${name} (x${item.数量})</span><span class="data-value ${rarityClass(item.稀有度)}">${item.稀有度} - ${item.类型}</span>`;
      grid.appendChild(itemDiv);
    });
    invList.appendChild(grid);
  }

  /* 任务 */
  const user = get(data, '用户', {});
  const tasks = get(system, '任务', {});
  const taskConfig = get(system, '任务配置', {});
  const minTasks = taskConfig.最小活跃任务数 || 3;
  const tracking = get(user, '任务追踪', {});
  setText('task-completion-stats', `${get(tracking, '今日任务完成数', 0)} / ${get(tracking, '累计任务完成数', 0)}`);

  const countActive = (obj, statusKey, activeVal) => Object.values(obj || {}).filter(t => t[statusKey] === activeVal).length;
  const sysA = countActive(tasks.系统任务, '状态', '未完成');
  const favA = countActive(tasks.好感任务, '状态', '进行中');
  const wrlA = countActive(tasks.世界任务, '状态', '进行中');

  updateTaskCount('task-count-system', sysA, minTasks);
  updateTaskCount('task-count-favor', favA, minTasks);
  updateTaskCount('task-count-world', wrlA, minTasks);

  const activeList = document.getElementById('task-list-active');
  activeList.innerHTML = '';
  const allTasks = { ...get(tasks, '系统任务', {}), ...get(tasks, '好感任务', {}), ...get(tasks, '世界任务', {}) };
  let hasActive = false;

  Object.entries(allTasks).forEach(([id, t]) => {
    let type, cls, active;
    if (tasks.系统任务?.[id]) { type = '系统'; cls = 'system'; active = t.状态 === '未完成'; }
    else if (tasks.好感任务?.[id]) { type = '好感'; cls = 'favor'; active = t.状态 === '进行中'; }
    else if (tasks.世界任务?.[id]) { type = '世界'; cls = 'world'; active = t.状态 === '进行中'; }

    if (active) {
      hasActive = true;
      const el = document.createElement('div');
      el.className = 'task-item';
      el.dataset.taskId = id;
      el.dataset.taskType = cls;
      el.innerHTML = `<span class="task-tag task-tag-${cls}">${type}</span><span class="task-desc">${t.描述}</span><span class="task-progress">${t.进度 || 0}%</span><span class="task-reward">+${t.奖励积分}P</span>`;
      activeList.appendChild(el);
    }
  });

  if (!hasActive) activeList.innerHTML = '<div class="placeholder">没有正在进行的任务</div>';

  /* 技能 */
  const equipped = get(user, '装备技能', {});
  const skillPro = get(user, '技能熟练度', {});

  const eqDiv = document.getElementById('equipped-skills-list');
  eqDiv.innerHTML = '';
  if (Object.keys(equipped).length === 0) {
    eqDiv.innerHTML = '<div class="placeholder">未装备任何技能</div>';
  } else {
    const g = document.createElement('div'); g.className = 'grid-display';
    Object.entries(equipped).forEach(([n, s]) => {
      const d = document.createElement('div'); d.className = 'data-item';
      d.innerHTML = `<span class="data-label">${n}</span><span class="data-value">Lv.${s.等级} (EXP: ${s.经验值})</span>`;
      g.appendChild(d);
    });
    eqDiv.appendChild(g);
  }

  const spDiv = document.getElementById('skill-proficiency-list');
  spDiv.innerHTML = '';
  if (Object.keys(skillPro).length === 0) {
    spDiv.innerHTML = '<div class="placeholder">无技能熟练度信息</div>';
  } else {
    const g = document.createElement('div'); g.className = 'grid-display';
    Object.entries(skillPro).forEach(([n, v]) => {
      const d = document.createElement('div'); d.className = 'data-item';
      d.innerHTML = `<span class="data-label">${n}</span><span class="data-value">${v}</span>`;
      g.appendChild(d);
    });
    spDiv.appendChild(g);
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function updateTaskCount(id, active, min) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = `${active} / ${min}`;
  el.className = 'data-value ' + (active >= min ? 'green' : 'red');
}

/* ===== 模态框 ===== */
function showTaskModal(taskId, taskType) {
  const data = get(getMvuData(), 'stat_data', {});
  const tasks = get(data, '系统.任务', {});
  const groupMap = { system: '系统任务', favor: '好感任务', world: '世界任务' };
  const task = tasks?.[groupMap[taskType]]?.[taskId];
  if (!task) return;

  const info = [
    { label: '任务描述', value: task.描述 },
    { label: '状态', value: task.状态 },
  ];
  if (taskType === 'favor') {
    info.push({ label: '关联角色', value: task.角色 });
    info.push({ label: '触发好感度', value: task.触发好感度 });
  }
  if (taskType === 'world') {
    info.push({ label: '关联主题', value: task.主题 });
    info.push({ label: '触发条件', value: task.触发条件 });
  }
  info.push({ label: '奖励积分', value: task.奖励积分 });
  info.push({ label: '创建时间', value: new Date(task.创建时间).toLocaleString() });
  if (task.完成时间) info.push({ label: '完成时间', value: new Date(task.完成时间).toLocaleString() });

  const body = document.getElementById('modal-body-content');
  body.innerHTML = info.map(i =>
    `<div class="data-item"><span class="data-label">${i.label}</span><span class="data-value">${i.value}</span></div>`
  ).join('');

  if (task.进度 !== undefined) {
    body.innerHTML += `<div class="progress-bar-container"><div class="progress-bar" style="width:${task.进度}%"></div></div>`;
  }

  document.getElementById('modal-overlay').style.display = 'flex';
}

function hideModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

/* ===== 初始化 ===== */
async function init() {
  await waitMvu();

  ThemeManager.init(document.documentElement);
  populateData();
  setupCollapsiblePanels(document.querySelector('.content-area'));

  /* 任务点击 */
  document.getElementById('task-list-active').addEventListener('click', e => {
    const item = e.target.closest('.task-item');
    if (item) showTaskModal(item.dataset.taskId, item.dataset.taskType);
  });

  /* 模态框 */
  document.getElementById('modal-close').addEventListener('click', hideModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) hideModal();
  });

  /* MVU 更新监听 */
  if (window.Mvu?.events?.VARIABLE_UPDATE_ENDED) {
    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, populateData);
  }
}

document.addEventListener('DOMContentLoaded', init);
