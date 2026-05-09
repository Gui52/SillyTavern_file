(function() {
  'use strict';

  const SEL = '.dmc';
  let renderTimer = null;
  let currentMsgId = null;

  function q(s, ctx) { return (ctx || document).querySelector(s); }
  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function detectTheme() {
    const container = q(SEL);
    if (!container) return;
    try {
      const savedTheme = localStorage.getItem('mvu_theme');
      if (savedTheme) {
        container.classList.remove('theme-glass', 'theme-ink', 'theme-medieval', 'theme-metro', 'theme-neon');
        container.classList.add(savedTheme);
      }
      const savedDark = localStorage.getItem('mvu_dark');
      container.classList.toggle('dark', savedDark === '1');
    } catch (e) {}
  }

  function formatNumber(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    if (n >= 1000) return n.toLocaleString('zh-CN');
    return String(n);
  }

  function render() {
    const container = q(SEL);
    if (!container) return;
    try {
      if (typeof Mvu === 'undefined' || typeof _ === 'undefined') {
        container.innerHTML = '<div class="dmc-loading">加载中</div>';
        return;
      }
      const all = Mvu.getMvuData({ type: 'message', message_id: currentMsgId });
      const s = (all && all.stat_data) || {};
      const dms = Array.isArray(s.直播间?.弹幕) ? s.直播间.弹幕 : [];
      const online = s.直播间?.在线人数 || 0;

      if (dms.length === 0) {
        container.innerHTML =
          '<div class="dmc-header">' +
            '<span class="dmc-live-dot"></span>' +
            '<span class="dmc-title">直播间</span>' +
            '<span class="dmc-count"><span class="dmc-count-num">0</span> 在线</span>' +
          '</div>' +
          '<div class="dmc-body"><div class="dmc-empty"><div class="dmc-empty-icon">💬</div>暂无弹幕</div></div>';
        return;
      }

      let headerHtml =
        '<div class="dmc-header">' +
          '<span class="dmc-live-dot"></span>' +
          '<span class="dmc-title">直播间</span>' +
          '<span class="dmc-count"><span class="dmc-count-num">' + formatNumber(online) + '</span> 在线</span>' +
        '</div>';

      let bodyHtml = '<div class="dmc-body">';
      const latest = dms.slice(-20);
      for (const d of latest) {
        const sender = escHtml(d.发送者 || '观众');
        const content = escHtml(d.内容 || '');
        bodyHtml += '<div class="dmc-msg"><span class="dmc-sender">' + sender + '：</span><span class="dmc-text">' + content + '</span></div>';
      }
      bodyHtml += '</div>';

      container.innerHTML = headerHtml + bodyHtml;
      const body = q('.dmc-body', container);
      if (body) body.scrollTop = body.scrollHeight;
    } catch (e) {
      container.innerHTML = '<div class="dmc-loading">加载失败</div>';
    }
  }

  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(function() { render(); renderTimer = null; }, 50);
  }

  function tryGetCurrentMsgId() {
    try {
      const ctx = SillyTavern.getContext();
      return ctx.getCurrentMessageId();
    } catch(e) {}
    try {
      var el = q(SEL);
      if (el) {
        var mes = el.closest('.mes');
        if (mes) return mes.dataset.messageId;
      }
    } catch(e) {}
    return null;
  }

  async function init() {
    detectTheme();
    try {
      if (typeof waitGlobalInitialized === 'function') {
        await waitGlobalInitialized('Mvu');
      }
      currentMsgId = tryGetCurrentMsgId();
      render();
      try {
        var ctx = SillyTavern.getContext();
        ctx.eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, function() { scheduleRender(); });
      } catch(e) {
        try {
          Mvu.events.on(Mvu.events.VARIABLE_UPDATE_ENDED, function() { scheduleRender(); });
        } catch(e2) {}
      }
    } catch(e) {
      render();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
