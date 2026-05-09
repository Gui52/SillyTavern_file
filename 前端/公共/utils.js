/* ===== 公共工具函数 ===== */

/** 获取 MVU 数据 */
export function getMvuData() {
  try {
    return window.Mvu?.getMvuData() ?? {};
  } catch { return {} }
}

/** 安全获取嵌套值 */
export function get(obj, path, fallback = null) {
  try {
    const keys = String(path).split('.');
    let cur = obj;
    for (const k of keys) {
      if (cur == null || typeof cur !== 'object') return fallback;
      cur = cur[k];
    }
    return cur ?? fallback;
  } catch { return fallback }
}

/** 获取稀有度 class */
export function rarityClass(rarity) {
  if (rarity === 'SSR') return 'rarity-ssr';
  if (rarity === 'SR') return 'rarity-sr';
  return 'rarity-r';
}

/** 切换折叠面板 */
export function togglePanel(headerEl) {
  const content = headerEl.nextElementSibling;
  headerEl.classList.toggle('expanded');
  if (content) {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  }
}

/** 设置面板折叠 */
export function setupCollapsiblePanels(container) {
  container.querySelectorAll('.panel-header').forEach(header => {
    header.addEventListener('click', () => togglePanel(header));
  });
}

/** 主题管理 */
export const ThemeManager = {
  container: null,

  init(containerEl) {
    this.container = containerEl;
    this.restore();
  },

  restore() {
    try {
      const theme = localStorage.getItem('ui_theme') || 'theme-default';
      const dark = localStorage.getItem('ui_dark');
      if (this.container) {
        this.container.className = theme;
        if (dark === '1' || (dark === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          this.container.classList.add('dark');
        }
      }
    } catch {}
  },

  setTheme(name) {
    if (!this.container) return;
    this.container.className = name;
    const isDark = this.container.classList.contains('dark');
    if (!isDark) this.container.classList.remove('dark');
    try { localStorage.setItem('ui_theme', name) } catch {}
  },

  toggleDark() {
    if (!this.container) return;
    this.container.classList.toggle('dark');
    try {
      localStorage.setItem('ui_dark', this.container.classList.contains('dark') ? '1' : '0');
    } catch {}
  }
};

/** 等待 MVU 初始化 */
export function waitMvu() {
  return new Promise(resolve => {
    if (window.Mvu?.getMvuData) return resolve();
    const check = setInterval(() => {
      if (window.Mvu?.getMvuData) {
        clearInterval(check);
        resolve();
      }
    }, 100);
    setTimeout(() => { clearInterval(check); resolve() }, 10000);
  });
}
