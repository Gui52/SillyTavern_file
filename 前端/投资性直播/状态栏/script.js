    (() => {
      let renderTimer = null;
      let prevCoins = null;
      let prevFans = null;
      let prevGifts = null;
      let currentMsgId = null;

      let getVariables;

      function q(s) { return document.querySelector(s); }
      function qa(s) { return document.querySelectorAll(s); }

      function switchTab(tabId) {
        qa('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tabId));
        qa('.tab-content').forEach(el => el.classList.toggle('active', el.id === `tab-${tabId}`));
        const body = q('.sbc-body');
        if (body) body.scrollTop = 0;
      }

      function switchTheme(name) {
        document.querySelectorAll('#mvu-status-bar').forEach(bar => {
          bar.classList.remove('theme-glass', 'theme-ink', 'theme-medieval', 'theme-metro', 'theme-neon');
          bar.classList.add(name);
        });
        document.querySelectorAll('.theme-card').forEach(el => el.classList.toggle('active', el.dataset.theme === name));
        try { localStorage.setItem('mvu_theme', name); } catch (e) {}
      }

      function toggleDark() {
        const isDark = !document.querySelector('#mvu-status-bar')?.classList.contains('dark');
        document.querySelectorAll('#mvu-status-bar').forEach(bar => {
          bar.classList.toggle('dark', isDark);
        });
        document.querySelectorAll('#dark-toggle').forEach(el => el.checked = isDark);
        try { localStorage.setItem('mvu_dark', isDark ? '1' : '0'); } catch (e) {}
      }

      function getMvuDataSafe(opts) {
        return Mvu.getMvuData(opts);
      }
      function waitUntil(check, timeout = 12000) {
        const start = Date.now();
        return new Promise((resolve, reject) => {
          const poll = () => {
            try {
              if (check()) return resolve();
            } catch (e) {}
            if (Date.now() - start > timeout) return reject(new Error('Timeout waiting for condition'));
            setTimeout(poll, 200);
          };
          poll();
        });
      }
      function scheduleRender() {
        if (renderTimer) clearTimeout(renderTimer);
        renderTimer = setTimeout(() => { renderData(); renderTimer = null; }, 20);
      }

      /* ═══════════════════════════════════════════════════════════
         Render Logic — deep MVU variable integration
         ═══════════════════════════════════════════════════════════ */

      function renderData() {
        const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
        const s = _.get(all, 'stat_data', {});
        const hostId = _.get(s, '全局.当前主播ID', 'host_0');
        const host = _.get(s, ['主播池', hostId], {});

        renderLiveTab(s);
        renderAnchorTab(host, s);
        renderAccountTab(s, all);
        renderRulesTab(s);
        renderShopTab(s);
        renderHostSwitch(s);
      }

      /* ─── Live Tab ─── */
      function renderLiveTab(s) {
        const online = _.get(s, '直播间.在线人数', 0);
        const time = _.get(s, '直播间.直播时长', '00:00:00');
        const likes = _.get(s, '直播间.点赞数', 0);
        const gifts = _.get(s, '直播间.礼物总额', 0);

        q('#val-online').textContent = formatNumber(online);
        q('#val-time').textContent = time;
        q('#val-likes').textContent = formatNumber(likes);
        q('#val-gifts').textContent = formatNumber(gifts);

        // Animated delta — if gifts changed
        if (prevGifts !== null && gifts > prevGifts) {
          const delta = gifts - prevGifts;
          q('#val-gifts-delta').textContent = `+${formatNumber(delta)}`;
          q('#val-gifts-delta').style.display = 'inline';
          clearTimeout(q('#val-gifts-delta').__timeout);
          q('#val-gifts-delta').__timeout = setTimeout(() => {
            q('#val-gifts-delta').style.display = 'none';
          }, 2000);
        }
        prevGifts = gifts;

        // Super Chats
        const scs = _.values(_.get(s, '直播间.超级留言', {}));
        q('#list-sc').innerHTML = scs.length > 0
          ? scs.slice(-5).map(sc => {
              const timeStr = sc.$time ? `<span class="msg-time">${sc.$time.slice(11,19)}</span>` : '';
              return `<div class="msg msg-sc">
                ${timeStr}
                <span class="msg-sender">${escHtml(sc.发送者||'匿名')}</span>
                <span style="font-weight:700;color:var(--gold);">¥${formatNumber(sc.金额||0)}</span>
                <div style="margin-top:2px;">${escHtml(sc.内容||'')}</div>
              </div>`;
            }).join('')
          : '<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-comment"></i></div>暂无超级留言</div>';

        // Danmaku
        const dms = _.get(s, '直播间.弹幕', []);
        q('#list-dm').innerHTML = dms.length > 0
          ? dms.slice(-10).map(d => {
              const timeStr = d.$time ? `<span class="msg-time">${d.$time.slice(11,19)}</span>` : '';
              return `<div class="msg">${timeStr}<span class="msg-sender">${escHtml(d.发送者||'观众')}:</span>${escHtml(d.内容||'')}</div>`;
            }).join('')
          : '<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-pen-to-square"></i></div>暂无弹幕</div>';

        // Gift log — latest 3
        const giftLog = _.values(_.get(s, '直播间.礼物记录', {}));
        if (giftLog.length > 0) {
          q('#gift-log-section').style.display = 'block';
          q('#list-gifts').innerHTML = giftLog.slice(-3).map(g =>
            `<div class="msg">
              <span class="msg-sender" style="color:var(--gold);">${escHtml(g.发送者||'匿名')}</span>
              送出 ${g.数量||1}x ${escHtml(g.礼物名||'礼物')}
              <span style="float:right;font-weight:700;color:var(--gold);">¥${formatNumber(g.价值||0)}</span>
            </div>`
          ).join('');
        } else {
          q('#gift-log-section').style.display = 'none';
        }
      }

      /* ─── Anchor Tab ─── */
      function renderAnchorTab(host, s) {
        const hostId = _.get(s, '全局.当前主播ID', 'host_0');
        const isEmpty = hostId === 'host_0' || Object.keys(host).length === 0;
        const info = _.get(host, '基本信息', {});
        q('#val-name').textContent = isEmpty ? '待选定' : _.get(info, '名字', '---');
        q('#val-age').textContent = _.get(info, '年龄', '--');
        q('#val-id').textContent = _.get(info, '身份', '--');
        q('#val-loc').textContent = _.get(info, '当前位置', '--');

        const tags = _.get(info, '分区标签', []);
        q('#val-tags').innerHTML = tags.length > 0
          ? tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')
          : '<span style="color:var(--text-muted);font-size:0.78em;">无</span>';

        // 平台认知指示器
        const cog = _.get(s, '运营号.主播认知', {});
        const isKnown = _.get(cog, '是否知情', false);
        const cogTime = _.get(cog, '认知突破时间', '');
        const cogEl = q('#cognition-indicator');
        const cogIcon = q('#cognition-icon');
        const cogText = q('#cognition-text');
        const cogTimeEl = q('#cognition-time');
        if (isKnown) {
          cogEl.classList.add('known');
          cogIcon.textContent = '🔓';
          cogText.textContent = '已认知';
          cogTimeEl.textContent = cogTime ? cogTime.slice(0, 16) : '';
          cogTimeEl.style.display = '';
        } else {
          cogEl.classList.remove('known');
          cogIcon.textContent = '🔒';
          cogText.textContent = '未认知';
          cogTimeEl.style.display = 'none';
        }

        // 三轴状态
        const stick = _.clamp(_.get(host, '核心状态.坚守度', 100), 0, 100);
        const ruin = _.clamp(_.get(host, '核心状态.崩坏度', 0), 0, 100);
        const obey = _.clamp(_.get(host, '核心状态.服从度', 0), 0, 100);

        q('#val-stick').textContent = `${stick}%`;
        q('#val-ruin').textContent = `${ruin}%`;
        q('#val-obey').textContent = `${obey}%`;

        // 坚守度进度条
        const barStick = q('#bar-stick');
        barStick.style.width = `${stick}%`;
        barStick.className = 'pbar-fill';
        if (stick <= 30) barStick.classList.add('danger');
        else if (stick <= 60) barStick.classList.add('gold');
        else barStick.classList.add('accent');

        // 崩坏度进度条
        const barRuin = q('#bar-ruin');
        barRuin.style.width = `${ruin}%`;
        barRuin.className = 'pbar-fill';
        if (ruin >= 70) barRuin.classList.add('danger');
        else if (ruin >= 30) barRuin.classList.add('gold');
        else barRuin.classList.add('accent');

        // 服从度进度条
        const barObey = q('#bar-obey');
        barObey.style.width = `${obey}%`;
        barObey.className = 'pbar-fill';
        if (obey >= 70) barObey.classList.add('danger');
        else if (obey >= 40) barObey.classList.add('gold');
        else barObey.classList.add('accent');

        // Inner thoughts
        q('#val-mind').textContent = _.get(host, '内心想法', '暂无想法');
        if (_.get(host, '内心想法', '') === '') {
          q('#val-mind').textContent = '暂无想法';
          q('#val-mind').style.color = 'var(--text-muted)';
        } else {
          q('#val-mind').style.color = '';
        }

        // Clothing — dynamic iteration
        const clothes = _.get(host, '服装信息', {});
        const entries = Object.entries(clothes);
        q('#list-clothes').innerHTML = entries.length > 0
          ? entries.map(([k, v]) =>
              `<li><span class="dlist-label">${escHtml(k)}</span><span class="dlist-value">${escHtml(String(v))}</span></li>`
            ).join('')
          : '<li style="color:var(--text-muted);justify-content:center;">未穿着任何衣物</li>';

        // Fetishes
        const fetish = _.get(host, '性癖', {});
        const fetishEntries = Object.entries(fetish);
        q('#list-fetish').innerHTML = fetishEntries.length > 0
          ? fetishEntries.map(([k,v]) =>
              `<li><span class="dlist-label">${escHtml(k)}</span><span class="dlist-value">${escHtml(String(v))}</span></li>`
            ).join('')
          : '<li style="color:var(--text-muted);justify-content:center;">无数据</li>';

        drawRadar(host);

        // Sync cheat inputs
        const coins = _.get(s, '运营号.账户资产.性币', 0);
        const fans = _.get(s, '运营号.人气数据.粉丝数量', 0);
        const ci = q('#cheat-coins'); if (ci && document.activeElement !== ci) ci.value = coins;
        const fi = q('#cheat-fans'); if (fi && document.activeElement !== fi) fi.value = fans;
        const cstick = q('#cheat-stick'); if (cstick && document.activeElement !== cstick) cstick.value = stick;
        const cruin = q('#cheat-ruin'); if (cruin && document.activeElement !== cruin) cruin.value = ruin;
        const cobey = q('#cheat-obey'); if (cobey && document.activeElement !== cobey) cobey.value = obey;
      }

      /* ─── Radar Chart — 8 维调教开发 ─── */
      function drawRadar(host) {
        const dev = _.get(host, '调教开发', {});
        const svg = q('#radar-chart');
        if (!svg) return;

        const labels = ['屁眼', '乳头', '口腔', '阴茎', '淫语', '露出', '敏感体质', '身体记忆'];
        const values = [
          _.clamp(dev.屁眼开发度 || 0, 0, 100),
          _.clamp(dev.乳头开发度 || 0, 0, 100),
          _.clamp(dev.口腔开发度 || 0, 0, 100),
          _.clamp(dev.阴茎开发度 || 0, 0, 100),
          _.clamp(dev.淫语开发度 || 0, 0, 100),
          _.clamp(dev.露出开发度 || 0, 0, 100),
          _.clamp(dev.敏感体质 || 0, 0, 100),
          _.clamp(dev.身体记忆 || 0, 0, 100),
        ];
        const cx = 130, cy = 130, R = 95, n = 8, off = -Math.PI / 2;
        let html = '';

        // Grid pentagons
        for (let lv = 1; lv <= 5; lv++) {
          const r = (R / 5) * lv;
          const pts = Array.from({length: n}, (_, i) => {
            const a = off + (2 * Math.PI * i) / n;
            return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
          }).join(' ');
          html += `<polygon points="${pts}" class="radar-grid"/>`;
        }

        // Axes
        for (let i = 0; i < n; i++) {
          const a = off + (2 * Math.PI * i) / n;
          html += `<line x1="${cx}" y1="${cy}" x2="${cx + R * Math.cos(a)}" y2="${cy + R * Math.sin(a)}" class="radar-axis"/>`;
        }

        // Data area
        const dataPts = values.map((v, i) => {
          const a = off + (2 * Math.PI * i) / n;
          const r = (v / 100) * R;
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        });
        html += `<polygon points="${dataPts.join(' ')}" class="radar-area"/>`;

        // Dots
        dataPts.forEach(p => {
          const [x, y] = p.split(',');
          html += `<circle cx="${x}" cy="${y}" r="5" class="radar-dot"/>`;
        });

        // Labels
        values.forEach((v, i) => {
          const a = off + (2 * Math.PI * i) / n;
          const lr = R + 18;
          html += `<text x="${cx + lr * Math.cos(a)}" y="${cy + lr * Math.sin(a)}" class="radar-label">${labels[i]} ${v}%</text>`;
        });

        svg.innerHTML = html;
      }

      /* ─── Account Tab ─── */
      function renderAccountTab(s, all) {
        const coins = _.get(s, '运营号.账户资产.性币', 0);
        const fans = _.get(s, '运营号.人气数据.粉丝数量', 0);

        q('#val-coins').textContent = formatNumber(coins);
        q('#val-fans').textContent = formatNumber(fans);

        // Deltas
        if (prevCoins !== null && coins !== prevCoins) {
          const delta = coins - prevCoins;
          const el = q('#val-coins-delta');
          el.textContent = delta >= 0 ? `+${formatNumber(delta)}` : formatNumber(delta);
          el.className = `stat-delta ${delta >= 0 ? 'up' : 'down'}`;
          el.style.display = 'inline';
          clearTimeout(el.__timeout);
          el.__timeout = setTimeout(() => { el.style.display = 'none'; }, 2000);
        }
        if (prevFans !== null && fans !== prevFans) {
          const delta = fans - prevFans;
          const el = q('#val-fans-delta');
          el.textContent = `+${formatNumber(delta)}`;
          el.className = 'stat-delta up';
          el.style.display = 'inline';
          clearTimeout(el.__timeout);
          el.__timeout = setTimeout(() => { el.style.display = 'none'; }, 2000);
        }
        prevCoins = coins;
        prevFans = fans;

        // Inventory
        const items = _.get(s, '运营号.持有道具', {});
        renderInventory(items, all);

        // Log
        const logs = _.get(s, '系统日志', []);
        renderLog(logs);

        renderDescentPanel(s);
      }

      function renderInventory(items, all) {
        const container = q('#list-items');
        const entries = Object.entries(items);

        if (entries.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-briefcase"></i></div>暂无道具</div>';
          return;
        }

        container.innerHTML = entries.map(([id, item]) => {
          const isCount = item.消耗类型 === '次数';
          const remaining = item.剩余次数 || 0;
          const max = item.最大次数 || 0;
          const isActive = item.是否激活;
          const isExpired = !isCount && item.失效时间 && item.失效时间 < getMvuTime(all);

          let statusHtml = '';
          if (isCount) {
            const pct = max > 0 ? (remaining / max) * 100 : 0;
            statusHtml = `
              <div class="item-progress">剩余 <strong>${remaining}</strong> / ${max} 次</div>
              <div class="item-progress-bar"><div class="item-progress-bar-fill" style="width:${pct}%"></div></div>
            `;
          } else if (isActive) {
            statusHtml = `<span class="item-status-badge active">● 激活中</span>`;
            if (item.失效时间) {
              statusHtml += `<div class="item-progress">至 ${item.失效时间.slice(0,16)}</div>`;
            }
          } else {
            statusHtml = `<span class="item-status-badge idle">○ 未激活</span>`;
          }

          const canUse = isCount ? remaining > 0 : !isActive;

          return `
            <div class="item-card${isExpired ? ' expired' : ''}" data-item-id="${escHtml(id)}">
              <div class="item-info">
                <div class="item-header">
                  <span class="item-name">${escHtml(item.名称 || id)}</span>
                  ${isCount
                    ? `<span class="shop-tag type-consumable">次数型</span>`
                    : `<span class="shop-tag type-timed">时效型</span>`}
                </div>
                ${item.描述 ? `<div style="font-size:0.74em;color:var(--text-muted);margin-top:2px;">${escHtml(item.描述)}</div>` : ''}
                ${statusHtml}
              </div>
              <button class="btn btn-sm ${canUse ? 'btn-primary' : ''}" data-action="use" ${canUse ? '' : 'disabled'}>
                ${canUse ? '使用' : '已用尽'}
              </button>
            </div>`;
        }).join('');
      }

      function renderLog(logs) {
        const container = q('#system-log');
        if (!container) return;
        if (logs.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-clipboard-list"></i></div>暂无系统日志</div>';
          return;
        }
        container.innerHTML = logs.slice(-10).reverse().map(l =>
          `<div class="msg" style="font-size:0.75em;">
            <span style="color:var(--text-muted);">${escHtml(l.时间||'').slice(5,16)}</span>
            <span class="tag" style="margin-left:6px;font-size:0.7em;">${escHtml(l.事件类型||'系统')}</span>
            <div style="margin-top:2px;">${escHtml(l.描述||'')}</div>
          </div>`
        ).join('');
      }

      /* ─── Rules Tab ─── */
      function renderRulesTab(s) {
        const universeRules = _.get(s, '运营号.已部署规则', {});
        const hostId = _.get(s, '全局.当前主播ID', 'host_1');
        // 尝试找当前宇宙的规则（取第一个非空key，或当前主播所在宇宙）
        const universeIds = Object.keys(universeRules);
        let currentUniverse = '';
        // 从主播关联或存档推断当前宇宙ID
        const associations = _.get(s, '全局.主播关联', {});
        const assoc = associations[hostId];
        if (assoc && assoc.length > 0 && assoc[0].目标主播ID) {
          // 尝试从关联关系找世界观ID - 简化处理：取第一个关联的世界观
        }
        // 取第一个有规则的宇宙，或空显示
        const activeUniverse = universeIds[0] || '当前宇宙';
        const rules = universeRules[activeUniverse] || [];
        const count = rules.length;

        const container = q('#rules-list');
        const label = q('#rule-count-label');
        if (label) label.textContent = `${count} / 3`;

        if (!container) return;
        if (count === 0) {
          container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-gavel"></i></div>当前宇宙尚未部署规则</div>';
          return;
        }

        container.innerHTML = rules.map((rule, idx) => {
          const timeStr = rule.购买时间 ? rule.购买时间.slice(0, 16) : '';
          return `<div class="item-card" data-rule-idx="${idx}" data-universe="${escHtml(activeUniverse)}">
            <div class="item-info" style="flex:1;">
              <div class="item-header">
                <span class="item-name" style="font-size:0.95em;">规则 #${idx+1}</span>
                <span class="shop-tag type-timed">宇宙规则</span>
              </div>
              <div style="font-size:0.84em;color:var(--text-primary);margin-top:4px;line-height:1.4;white-space:pre-wrap;">${escHtml(rule.规则内容 || '')}</div>
              ${timeStr ? `<div style="font-size:0.7em;color:var(--text-muted);margin-top:4px;">部署时间: ${escHtml(timeStr)}</div>` : ''}
            </div>
            <button class="btn btn-sm btn-outline" data-action="delete-rule" data-rule-idx="${idx}" data-universe="${escHtml(activeUniverse)}" style="color:var(--danger);border-color:var(--danger);">
              <i class="fa-solid fa-trash-can"></i> 删除
            </button>
          </div>`;
        }).join('');

        // 检查当前宇宙是否已满
        const deployBtn = q('#rule-deploy-btn');
        const statusMsg = q('#rule-status-msg');
        if (deployBtn) {
          if (count >= 3) {
            deployBtn.disabled = true;
            deployBtn.style.opacity = '0.4';
            if (statusMsg) statusMsg.textContent = '该宇宙规则已达上限（3条），请先删除一条';
          } else {
            deployBtn.disabled = false;
            deployBtn.style.opacity = '';
            if (statusMsg) statusMsg.textContent = '';
          }
        }
      }

      /* ─── Shop Tab ─── */
      function renderShopTab(s) {
        const shop = _.get(s, '商店', {});

        if (Object.keys(shop).length === 0) {
          qa('.shop-content').forEach(el => {
            el.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-cart-shopping"></i></div>商店暂无商品</div>';
          });
          return;
        }

        const cats = { toys: '性爱玩具', body: '身体改造', mind: '思维修改', scene: '时停场景' };
        Object.entries(cats).forEach(([key, label]) => {
          const filtered = Object.entries(shop).filter(([, v]) => v.分类 === label);
          const container = q(`#shop-${key}`);
          if (!container) return;

          if (filtered.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div>暂无此类商品</div>';
            return;
          }

          container.innerHTML = filtered.map(([id, item]) => {
            const isFeatured = item.效果强度 >= 8;
            const isNew = item.效果强度 >= 5 && item.效果强度 < 8;
            let badge = '';
            if (isFeatured) badge = '<span class="shop-badge hot">HOT</span>';
            else if (isNew) badge = '<span class="shop-badge new">NEW</span>';

            const effectStars = '★'.repeat(Math.min(5, Math.ceil((item.效果强度 || 1) / 2)));
            const effectColor = item.效果强度 >= 8 ? 'var(--danger)' :
                               item.效果强度 >= 5 ? 'var(--gold)' : 'var(--accent-secondary)';

            const typeTag = item.消耗类型 === '次数'
              ? `<span class="shop-tag type-consumable">${item.初始次数||1}次</span>`
              : `<span class="shop-tag type-timed">${item.有效期小时||24}h</span>`;

            return `
              <div class="shop-card${isFeatured ? ' featured' : ''}" data-item-id="${escHtml(id)}">
                <div class="shop-info">
                  <div class="shop-name">${escHtml(item.名称 || id)} ${badge}</div>
                  <div class="shop-desc">${escHtml(item.描述 || '')}</div>
                  <div class="shop-meta">
                    ${typeTag}
                    <span class="shop-effect" style="color:${effectColor};">${effectStars}</span>
                  </div>
                </div>
                <div class="shop-right">
                  <div class="shop-price">${formatNumber(item.价格 || 0)}</div>
                  <button class="btn btn-sm btn-gold" data-action="buy">购买</button>
                  <button class="btn btn-xs btn-outline" data-action="fav">${item.是否收藏 ? '★' : '☆'}</button>
                </div>
              </div>`;
          }).join('');
        });
        renderFavoritesTab(s);
      }

      /* ═══════════════════════════════════════════════════════════
         Helpers
         ═══════════════════════════════════════════════════════════ */

      function formatNumber(n) {
        if (n >= 10000) return (n / 10000).toFixed(1) + '万';
        if (n >= 1000) return n.toLocaleString('zh-CN');
        return String(n);
      }

      function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      function getMvuTime(vars) {
        return _.get(vars, 'stat_data.世界.当前时间', '');
      }

      function formatNow() {
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }

      function getCurrentHostId(allData) {
        return _.get(allData, 'stat_data.全局.当前主播ID', 'host_1');
      }

      function resolveCheatPath(path, hostId) {
        return path.replace('{id}', hostId);
      }

      /* ═══════════════════════════════════════════════════════════
         Cheat System
         ═══════════════════════════════════════════════════════════ */

      function cheatSet(path, inputId, sanitize) {
        const input = q(`#${inputId}`);
        if (!input) return;
        const val = parseFloat(input.value);
        if (isNaN(val)) { toastr.error('请输入有效数字'); return; }
        const final = sanitize ? sanitize(val) : val;

        try {
          const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
          const hostId = getCurrentHostId(all);
          const resolved = resolveCheatPath(path, hostId);
          _.set(all.stat_data, resolved, final);
          Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });
          scheduleRender();
          toastr.success(`已设置 ${path.split('.').pop()} = ${final}`);
        } catch (e) { console.error('cheatSet error:', e); toastr.error('设置失败'); }
      }

      function cheatDelta(path, inputId, delta) {
        try {
          const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
          const hostId = getCurrentHostId(all);
          const resolved = resolveCheatPath(path, hostId);
          const current = _.get(all.stat_data, resolved, 0);
          const final = Math.max(0, current + delta);
          _.set(all.stat_data, resolved, final);
          Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });
          scheduleRender();
          if (inputId) {
            const input = q(`#${inputId}`);
            if (input) input.value = final;
          }
          toastr.success(`${path.split('.').pop()} ${delta > 0 ? '+' : ''}${delta} = ${final}`);
        } catch (e) { console.error('cheatDelta error:', e); toastr.error('操作失败'); }
      }

      function cheatResetItems() {
        if (!confirm('确认清除所有持有道具？此操作不可撤销。')) return;
        try {
          const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
          all.stat_data.运营号.持有道具 = {};
          const logs = _.get(all.stat_data, '系统日志', []);
          logs.push({ 时间: getMvuTime(all) || formatNow(), 事件类型: '道具管理', 描述: '金手指：清除了所有持有道具' });
          all.stat_data.系统日志 = logs;
          Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });
          scheduleRender();
          toastr.success('已清除所有道具');
        } catch (e) { console.error(e); toastr.error('操作失败'); }
      }

      function cheatResetLog() {
        if (!confirm('确认清除所有系统日志？此操作不可撤销。')) return;
        try {
          const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
          all.stat_data.系统日志 = [];
          Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });
          scheduleRender();
          toastr.success('已清除系统日志');
        } catch (e) { console.error(e); toastr.error('操作失败'); }
      }

      function cheatAddCustomItem() {
        const name = (q('#custom-item-name')?.value || '').trim();
        const desc = (q('#custom-item-desc')?.value || '').trim();
        const cat = q('#custom-item-cat')?.value || '性爱玩具';
        const price = parseInt(q('#custom-item-price')?.value, 10);
        const power = parseInt(q('#custom-item-power')?.value, 10);
        const type = q('#custom-item-type')?.value || '次数';
        const uses = parseInt(q('#custom-item-uses')?.value, 10);
        const hours = parseInt(q('#custom-item-hours')?.value, 10);

        if (!name) { toastr.error('请输入道具名称'); return; }
        if (isNaN(price) || price < 0) { toastr.error('请输入有效价格'); return; }
        if (isNaN(power) || power < 1) { toastr.error('请输入有效强度(1-10)'); return; }

        try {
          const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
          const newId = `custom_${Date.now()}`;
          const shopItem = {
            名称: name,
            描述: desc || '(自定义道具)',
            分类: cat,
            价格: price,
            效果强度: _.clamp(power, 1, 10),
            消耗类型: type,
          };
          if (type === '次数') {
            shopItem.初始次数 = Math.max(1, uses);
          } else {
            shopItem.有效期小时 = Math.max(1, hours);
          }
          all.stat_data.商店[newId] = shopItem;
          Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });

          // Clear form
          q('#custom-item-name').value = '';
          q('#custom-item-desc').value = '';
          q('#custom-item-price').value = '0';
          q('#custom-item-power').value = '1';
          q('#custom-item-uses').value = '1';
          q('#custom-item-hours').value = '24';

          scheduleRender();
          toastr.success(`自定义道具「${name}」已添加至商店`);
        } catch (e) { console.error('cheatAddCustomItem error:', e); toastr.error('添加失败'); }
      }

      /* ═══════════════════════════════════════════════════════════
         Shop Purchase & Item Use
         ═══════════════════════════════════════════════════════════ */

      async function buyItem(itemId) {
        const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
        const s = _.get(all, 'stat_data', {});
        const shop = _.get(s, '商店', {});
        const item = shop[itemId];
        if (!item) { toastr.error('商品不存在或已下架'); return; }

        const coins = _.get(s, '运营号.账户资产.性币', 0);
        const price = item.价格 || 0;
        if (coins < price) {
          toastr.error(`性币不足！需要 <b>${formatNumber(price)}</b>，当前 <b>${formatNumber(coins)}</b>`);
          return;
        }

        const currentTime = getMvuTime(all) || formatNow();
        const isCount = item.消耗类型 === '次数';
        const detailLabel = isCount
          ? `可用 <strong>${item.初始次数||1}</strong> 次`
          : `时效 <strong>${item.有效期小时||24}</strong> 小时`;

        const modalBody = q('#purchase-modal-body');
        const modalOverlay = q('#purchase-modal');
        if (!modalBody || !modalOverlay) {
          // fallback
          const confirmMsg = `确认购买「${item.名称}」？\n价格：${formatNumber(price)} 性币\n${detailLabel}`;
          if (!confirm(confirmMsg)) return;
          executePurchase();
          return;
        }

        modalBody.innerHTML = `
          <div class="detail-row"><span>商品名称</span><span style="font-weight:700;">${escHtml(item.名称)}</span></div>
          <div class="detail-row"><span>分类</span><span>${escHtml(item.分类||'—')}</span></div>
          <div class="detail-row"><span>价格</span><span style="color:var(--gold);font-weight:700;font-family:var(--font-mono);">${formatNumber(price)} 性币</span></div>
          <div class="detail-row"><span>类型</span><span>${detailLabel}</span></div>
          ${item.描述 ? `<div class="detail-row"><span>描述</span><span style="font-size:0.82em;">${escHtml(item.描述)}</span></div>` : ''}
          <div class="detail-row"><span>当前余额</span><span style="font-family:var(--font-mono);">${formatNumber(coins)} → ${formatNumber(coins - price)}</span></div>
        `;

        const cancelBtn = q('#purchase-modal-cancel');
        const confirmBtn = q('#purchase-modal-confirm');

        const onConfirm = async () => {
          cleanup();
          await executePurchase();
        };
        const onCancel = () => cleanup();
        const cleanup = () => {
          modalOverlay.classList.remove('active');
          confirmBtn.removeEventListener('click', onConfirm);
          cancelBtn.removeEventListener('click', onCancel);
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        modalOverlay.addEventListener('click', (e) => {
          if (e.target === modalOverlay) onCancel();
        });
        modalOverlay.classList.add('active');

        async function executePurchase() {
          try {
            const data = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
            const newId = `owned_${Date.now()}`;
            const newItem = {
              名称: item.名称,
              描述: item.描述,
              分类: item.分类,
              效果强度: item.效果强度,
              对剧情的影响: item.对剧情的影响,
              消耗类型: item.消耗类型,
              购买时间: currentTime,
            };

            if (isCount) {
              newItem.剩余次数 = item.初始次数 || 1;
              newItem.最大次数 = item.初始次数 || 1;
            } else {
              newItem.是否激活 = false;
              newItem.有效期小时 = item.有效期小时 || 24;
            }

            data.stat_data.运营号.账户资产.性币 -= price;
            data.stat_data.运营号.持有道具[newId] = newItem;
            const buyLog = _.get(data.stat_data, '系统日志', []);
            buyLog.push({ 时间: currentTime, 事件类型: '道具购买', 描述: `购买了「${item.名称}」，花费 ${price} 性币` });
            data.stat_data.系统日志 = buyLog;
            Mvu.replaceMvuData(data, { type: 'message', message_id: currentMsgId });
            scheduleRender();
            toastr.success(`成功购买「${item.名称}」`);
          } catch (e) {
            console.error('buyItem error:', e);
            toastr.error('购买失败，请查看控制台');
          }
        }
      }

      async function useItem(itemId) {
        const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
        const s = _.get(all, 'stat_data', {});
        const items = _.get(s, '运营号.持有道具', {});
        const item = items[itemId];
        if (!item) { toastr.error('道具不存在'); return; }

        const isCount = item.消耗类型 === '次数';
        const canUse = isCount ? (item.剩余次数 || 0) > 0 : !item.是否激活;
        if (!canUse) {
          if (isCount) toastr.error('该道具已用尽');
          else toastr.warning('该道具已激活，无需重复使用');
          return;
        }

        if (!confirm(`确认使用「${item.名称}」？${item.描述||''}`)) return;

        const currentTime = getMvuTime(all) || formatNow();

        try {
          const data = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
          const target = data.stat_data.运营号.持有道具[itemId];
          if (!target) { toastr.error('道具数据异常'); return; }

          if (isCount) {
            target.剩余次数 -= 1;
          } else {
            target.是否激活 = true;
            target.激活时间 = currentTime;
            target.失效时间 = calculateExpiry(currentTime, target.有效期小时 || 24);
          }

          const useLog = _.get(data.stat_data, '系统日志', []);
          useLog.push({ 时间: currentTime, 事件类型: '道具使用', 描述: `使用了「${target.名称}」` });
          data.stat_data.系统日志 = useLog;

          if (isCount && target.剩余次数 <= 0) {
            delete data.stat_data.运营号.持有道具[itemId];
          }

          Mvu.replaceMvuData(data, { type: 'message', message_id: currentMsgId });
          scheduleRender();
          toastr.success(`已使用「${target.名称}」`);
        } catch (e) {
          console.error('useItem error:', e);
          toastr.error('使用道具失败，请查看控制台');
        }
      }

      function calculateExpiry(startTime, hours) {
        try {
          const d = new Date(startTime.replace(' ', 'T') + '+08:00');
          d.setTime(d.getTime() + hours * 3600000);
          const pad = n => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        } catch {
          return startTime;
        }
      }

      /* ─── Favorites Tab ─── */
      function renderFavoritesTab(s) {
        const shop = _.get(s, '商店', {});
        const favorites = Object.entries(shop).filter(([, v]) => v.是否收藏);
        const container = q('#shop-favorites');
        if (!container) return;
        if (favorites.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><i class="fa-solid fa-star"></i></div>暂无收藏商品</div>';
          return;
        }
        container.innerHTML = favorites.map(([id, item]) => {
          const isFeatured = item.效果强度 >= 8;
          const isNew = item.效果强度 >= 5 && item.效果强度 < 8;
          let badge = '';
          if (isFeatured) badge = '<span class="shop-badge hot">HOT</span>';
          else if (isNew) badge = '<span class="shop-badge new">NEW</span>';
          const effectStars = '★'.repeat(Math.min(5, Math.ceil((item.效果强度 || 1) / 2)));
          const effectColor = item.效果强度 >= 8 ? 'var(--danger)' :
                             item.效果强度 >= 5 ? 'var(--gold)' : 'var(--accent-secondary)';
          const typeTag = item.消耗类型 === '次数'
            ? `<span class="shop-tag type-consumable">${item.初始次数||1}次</span>`
            : `<span class="shop-tag type-timed">${item.有效期小时||24}h</span>`;
          return `
            <div class="shop-card${isFeatured ? ' featured' : ''}" data-item-id="${escHtml(id)}">
              <div class="shop-info">
                <div class="shop-name">${escHtml(item.名称 || id)} ${badge}</div>
                <div class="shop-desc">${escHtml(item.描述 || '')}</div>
                <div class="shop-meta">
                  ${typeTag}
                  <span class="shop-effect" style="color:${effectColor};">${effectStars}</span>
                </div>
              </div>
              <div class="shop-right">
                <div class="shop-price">${formatNumber(item.价格 || 0)}</div>
                <button class="btn btn-sm btn-gold" data-action="buy">购买</button>
                <button class="btn btn-xs btn-outline" data-action="fav">★</button>
              </div>
            </div>`;
        }).join('');
      }

      /* ─── Shop Refresh ─── */
      function refreshShop() {
        const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
        all.stat_data.运营号._商店待刷新 = true;
        const log = _.get(all.stat_data, '系统日志', []);
        log.push({ 时间: getMvuTime(all) || formatNow(), 事件类型:'道具管理', 描述:'前端触发商店刷新，AI将在下一轮生成新道具' });
        all.stat_data.系统日志 = log;
        Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });
        scheduleRender();
        toastr.success('已请求AI刷新商店，请等待下一轮回复');
      }

      /* ─── Toggle Favorite ─── */
      function toggleFavorite(itemId) {
        const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
        const s = _.get(all, 'stat_data', {});
        const shop = _.get(s, '商店', {});
        const item = shop[itemId];
        if (!item) { toastr.error('商品不存在'); return; }

        item.是否收藏 = item.是否收藏 === undefined ? true : !item.是否收藏;

        const favList = _.get(s, '运营号.收藏道具', []);
        if (item.是否收藏) {
          if (!favList.includes(itemId)) favList.push(itemId);
        } else {
          const idx = favList.indexOf(itemId);
          if (idx !== -1) favList.splice(idx, 1);
        }
        all.stat_data.运营号.收藏道具 = favList;

        Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });
        scheduleRender();
        toastr.success(item.是否收藏 ? `已收藏「${item.名称}」` : `已取消收藏「${item.名称}」`);
      }

      /* ─── Descent ─── */
      function doDescent() {
        const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
        const s = _.get(all, 'stat_data', {});
        const coins = _.get(s, '运营号.账户资产.性币', 0);
        const descended = _.get(s, '运营号.降临状态.是否已降临', false);

        if (descended) { toastr.warning('已降临，不可重复降临'); return; }
        if (coins < 10000) {
          toastr.error(`性币不足！需要 10000，当前 ${formatNumber(coins)}`);
          return;
        }

        const modalBody = q('#purchase-modal-body');
        const modalOverlay = q('#purchase-modal');
        if (!modalBody || !modalOverlay) {
          const identity = prompt('请输入你想要的身份（如"投资公司特派员"）：', '{{user}}');
          if (!identity || !identity.trim()) { identity = '{{user}}'; }
          if (!confirm('确定消耗10000性币降临？此操作不可撤销。')) return;
          executeDescent(identity.trim());
          return;
        }

        const cancelBtn = q('#purchase-modal-cancel');
        const confirmBtn = q('#purchase-modal-confirm');

        modalBody.innerHTML = `
          <div class="detail-row"><span>操作</span><span style="font-weight:700;color:var(--gold);">降临</span></div>
          <div class="detail-row"><span>消耗</span><span style="color:var(--danger);font-weight:700;">10000 性币</span></div>
          <div class="detail-row"><span>余额</span><span style="font-family:var(--font-mono);">${formatNumber(coins)} → ${formatNumber(coins-10000)}</span></div>
          <div class="detail-row"><span>提示</span><span style="font-size:0.82em;color:var(--text-muted);">不可撤销。将以物理实体进入当前平行宇宙。</span></div>`;
        confirmBtn.textContent = '确认降临';
        confirmBtn.className = 'btn btn-sm btn-gold';

        const cleanup = () => {
          modalOverlay.classList.remove('active');
          confirmBtn.removeEventListener('click', onStep1);
          confirmBtn.removeEventListener('click', onStep2);
          cancelBtn.removeEventListener('click', onCancel);
          confirmBtn.textContent = '确认购买';
          confirmBtn.className = 'btn btn-sm btn-confirm';
        };

        const onCancel = () => cleanup();

        const onStep1 = () => {
          modalBody.innerHTML = `
            <div style="margin-bottom:0.6em;font-size:0.9em;color:var(--text-secondary);">请输入你想要的降临身份</div>
            <input type="text" id="descent-identity-input" value="{{user}}" placeholder="例如：投资公司特派员、流浪佣兵、魔法学徒..."
              style="width:100%;padding:0.6em 0.8em;border:1px solid var(--border-moderate);border-radius:var(--radius-sm);background:var(--bg-elevated);color:var(--text-primary);font-size:0.92em;box-sizing:border-box;">
            <div style="margin-top:0.5em;font-size:0.78em;color:var(--text-muted);">AI 将基于你的输入进行修正扩写</div>`;
          confirmBtn.textContent = '最终确认';
          confirmBtn.className = 'btn btn-sm btn-gold';
          confirmBtn.removeEventListener('click', onStep1);
          confirmBtn.addEventListener('click', onStep2);
        };

        const onStep2 = () => {
          const input = q('#descent-identity-input');
          const identity = input ? input.value.trim() : '{{user}}';
          if (!identity) { toastr.warning('请输入身份'); return; }
          cleanup();
          executeDescent(identity);
        };

        modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) onCancel(); });
        confirmBtn.addEventListener('click', onStep1);
        cancelBtn.addEventListener('click', onCancel);
        modalOverlay.classList.add('active');

        function executeDescent(identity) {
          try {
            const data = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
            const c = _.get(data.stat_data, '运营号.账户资产.性币', 0);
            if (c < 10000) { toastr.error('性币不足'); return; }
            data.stat_data.运营号.账户资产.性币 -= 10000;
            data.stat_data.运营号.降临状态.是否已降临 = true;
            data.stat_data.运营号.降临状态.降临时间 = getMvuTime(data) || formatNow();
            data.stat_data.运营号.降临状态.降临身份 = identity;
            const log = _.get(data.stat_data, '系统日志', []);
            log.push({ 时间: getMvuTime(data) || formatNow(), 事件类型:'道具管理', 描述:'消耗10000性币进行降临，进入平行宇宙' });
            data.stat_data.系统日志 = log;
            Mvu.replaceMvuData(data, { type: 'message', message_id: currentMsgId });
            scheduleRender();
            toastr.success('降临成功！AI 将在下一轮基于你的身份进行修正扩写。');
          } catch(e) { console.error(e); toastr.error('降临失败'); }
        }
      }

      /* ─── Descent Panel Render ─── */
      function renderDescentPanel(s) {
        const descended = _.get(s, '运营号.降临状态.是否已降临', false);
        const content = q('#descent-content');
        if (!content) return;

        if (descended) {
          const identity = _.get(s, '运营号.降临状态.降临身份', '');
          const desc = _.get(s, '运营号.降临状态.降临描述', '');
          const time = _.get(s, '运营号.降临状态.降临时间', '');
          content.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;">
              <div style="font-weight:700;font-size:0.95em;">${escHtml(identity || '已降临')}</div>
              ${desc ? `<div style="font-size:0.82em;color:var(--text-secondary);line-height:1.5;">${escHtml(desc)}</div>` : ''}
              ${time ? `<div style="font-size:0.72em;color:var(--text-muted);">降临时间: ${escHtml(time)}</div>` : ''}
              <span class="tag gold" style="align-self:flex-start;">已降临</span>
            </div>`;
        } else {
          const coins = _.get(s, '运营号.账户资产.性币', 0);
          const canAfford = coins >= 10000;
          content.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;align-items:center;text-align:center;">
              <div style="font-size:0.85em;color:var(--text-secondary);line-height:1.5;">消耗10000性币，以物理实体进入当前平行宇宙。世界会产生因果扭曲，为你编织合情合理的身份。</div>
              <div style="font-size:0.78em;color:var(--text-muted);">此操作不可撤销</div>
              <button class="btn btn-gold btn-sm" id="descent-btn" ${canAfford ? '' : 'disabled'}>
                ${canAfford ? '<i class="fa-solid fa-meteor"></i> 降临 (10,000性币)' : '性币不足 (10,000)'}
              </button>
            </div>`;
        }
      }

      /* ─── Currency Conversion ─── */
      function convertCurrency() {
        const input = q('#cheat-convert-coins');
        if (!input) return;
        const amount = parseInt(input.value, 10);
        if (!amount || amount <= 0) { toastr.warning('请输入有效数量'); return; }

        const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
        const coins = _.get(all.stat_data, '运营号.账户资产.性币', 0);
        if (coins < amount) { toastr.error('性币不足'); return; }

        all.stat_data.运营号.账户资产.性币 = coins - amount;
        const localCoins = amount * 100;
        // 转换后的本地货币不存储在变量中，而是由 AI 在叙事中自然体现
        // 记录到系统日志中
        const log = _.get(all.stat_data, '系统日志', []);
        log.push({ 时间: getMvuTime(all) || formatNow(), 事件类型:'道具管理', 描述:`转换 ${amount} 性币为 ${localCoins} 本地货币（1:100），注入当前主播所在世界经济系统` });
        all.stat_data.系统日志 = log;

        Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });
        scheduleRender();
        toastr.success(`已转换 ${amount} 性币 → ${localCoins.toLocaleString()} 本地货币`);
      }

      /* ─── Rules Deploy & Delete ─── */
      function deployRule() {
        const input = q('#rule-input');
        if (!input) return;
        const ruleText = input.value.trim();
        if (!ruleText) { toastr.warning('请输入规则内容'); return; }

        const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
        const s = _.get(all, 'stat_data', {});
        const coins = _.get(s, '运营号.账户资产.性币', 0);
        if (coins < 50000) { toastr.error('性币不足，部署规则需要50,000性币'); return; }

        const universeRules = _.get(s, '运营号.已部署规则', {});
        const universeIds = Object.keys(universeRules);
        const currentUniverse = universeIds[0] || 'current';
        const currentRules = universeRules[currentUniverse] || [];
        if (currentRules.length >= 3) { toastr.error('当前宇宙规则已达上限（3条），请先删除一条'); return; }

        all.stat_data.运营号.账户资产.性币 = coins - 50000;
        if (!all.stat_data.运营号.已部署规则) all.stat_data.运营号.已部署规则 = {};
        if (!all.stat_data.运营号.已部署规则[currentUniverse]) all.stat_data.运营号.已部署规则[currentUniverse] = [];
        all.stat_data.运营号.已部署规则[currentUniverse].push({
          规则内容: ruleText,
          购买时间: getMvuTime(all) || formatNow(),
        });

        const log = _.get(all.stat_data, '系统日志', []);
        log.push({ 时间: getMvuTime(all) || formatNow(), 事件类型:'规则部署', 描述:`部署规则: ${ruleText.slice(0,60)}` });
        all.stat_data.系统日志 = log;

        Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });
        input.value = '';
        scheduleRender();
        toastr.success('规则已部署！消耗50,000性币。AI将在下一轮叙事中遵循该规则。');
      }

      function deleteRule(universe, idx) {
        if (!confirm('确认删除此规则？删除后不退款。')) return;
        const all = getMvuDataSafe({ type: 'message', message_id: currentMsgId });
        const universeRules = _.get(all.stat_data, '运营号.已部署规则', {});
        const rules = universeRules[universe];
        if (!rules || idx < 0 || idx >= rules.length) { toastr.error('规则不存在'); return; }

        const deletedText = rules[idx].规则内容 || '';
        rules.splice(idx, 1);
        if (rules.length === 0) delete universeRules[universe];
        all.stat_data.运营号.已部署规则 = universeRules;

        const log = _.get(all.stat_data, '系统日志', []);
        log.push({ 时间: getMvuTime(all) || formatNow(), 事件类型:'规则删除', 描述:`删除规则: ${deletedText.slice(0,60)}` });
        all.stat_data.系统日志 = log;

        Mvu.replaceMvuData(all, { type: 'message', message_id: currentMsgId });
        scheduleRender();
        toastr.info('规则已删除');
      }

      /* ─── Host Switch ─── */
      function renderHostSwitch(s) {
        const archive = _.get(s, '主播存档', {});
        const wrap = q('.host-switch-wrap');
        if (!wrap) return;

        // 【优化】始终显示按钮，即使存档为空
        wrap.style.display = 'flex';

        const archiveEntries = Object.entries(archive);
        const currentHostId = _.get(s, '全局.当前主播ID', 'host_1');
        const currentHost = _.get(s, ['主播池', currentHostId], {});
        const currentName = _.get(currentHost, '基本信息.名字', '待定');
        const currentStick = _.get(currentHost, '核心状态.坚守度', 100);
        const currentRuin = _.get(currentHost, '核心状态.崩坏度', 0);

        const hostDropdown = q('#host-dropdown');
        if (!hostDropdown) return;

        // 按钮文字显示存档数量
        q('#host-switch-btn').innerHTML = `<i class="fa-solid fa-right-left"></i> 切换 (${archiveEntries.length})`;

        // 无存档时显示空状态提示
        if (archiveEntries.length === 0) {
          hostDropdown.innerHTML = `<div class="host-dropdown-item disabled" style="justify-content:center; cursor:default;">
            <div class="host-name" style="text-align:center;">📭 暂无其他主播存档</div>
            <div class="host-meta" style="text-align:center;">新主播将自动存入</div>
          </div>`;
          return;
        }

        let html = `<div class="host-dropdown-item" data-host-id="${currentHostId}">
          <div class="host-name">${escHtml(currentName)} <span class="meta-tag active">当前</span></div>
          <div class="host-meta">坚守: ${currentStick}% · 崩坏: ${currentRuin}%</div>
        </div>`;

        archiveEntries.forEach(([id, archived]) => {
          const name = _.get(archived, '基本信息.名字', '未知');
          const aStick = _.get(archived, '核心状态.坚守度', 0);
          const aRuin = _.get(archived, '核心状态.崩坏度', 0);
          const status = _.get(archived, '毕业状态', '调教中');

          let statusTag = '';
          if (status === '已毕业') statusTag = '<span class="meta-tag graduated">已毕业</span>';
          else if (status === '已死亡') statusTag = '<span class="meta-tag dead">已死亡</span>';
          else statusTag = '<span class="meta-tag active">调教中</span>';

          const isDisabled = status !== '调教中';

          html += `<div class="host-dropdown-item${isDisabled ? ' disabled' : ''}" data-host-id="${escHtml(id)}" data-host-name="${escHtml(name)}">
            <div class="host-name">${escHtml(name)} ${statusTag}</div>
            <div class="host-meta">坚守: ${aStick}% · 崩坏: ${aRuin}%</div>
          </div>`;
        });

        hostDropdown.innerHTML = html;
      }

      /* ═══════════════════════════════════════════════════════════
         Initialization
         ═══════════════════════════════════════════════════════════ */

      async function init() {
        await waitGlobalInitialized('Mvu');
        getVariables = (opts) => Mvu.getMvuData(opts);
        await waitUntil(() => _.has(getVariables({type: 'message'}), 'stat_data'));
        currentMsgId = (() => { try { return SillyTavern.getContext().getCurrentMessageId(); } catch(e) {} try { return document.querySelector('#mvu-status-bar')?.closest('.mes')?.dataset?.messageId; } catch(e) {} return null; })();

        // Restore cached theme & dark mode
        try {
          const savedTheme = localStorage.getItem('mvu_theme');
          if (savedTheme) {
            document.querySelectorAll('#mvu-status-bar').forEach(bar => {
              bar.classList.remove('theme-glass', 'theme-ink', 'theme-medieval', 'theme-metro', 'theme-neon');
              bar.classList.add(savedTheme);
            });
            document.querySelectorAll('.theme-card').forEach(el => el.classList.toggle('active', el.dataset.theme === savedTheme));
          }
          const savedDark = localStorage.getItem('mvu_dark');
          if (savedDark === '1') {
            document.querySelectorAll('#mvu-status-bar').forEach(bar => bar.classList.add('dark'));
            document.querySelectorAll('#dark-toggle').forEach(el => el.checked = true);
          }
        } catch (e) {}

        // ── Global one-time event delegation ──
        if (!window.__mvuEventsSetup) {
          window.__mvuEventsSetup = true;

          document.addEventListener('click', e => {
            // Tab switching
            const navItem = e.target.closest('.nav-item');
            if (navItem) switchTab(navItem.dataset.tab);

            // Shop sub-nav
            const shopItem = e.target.closest('.shop-nav-item');
            if (shopItem) {
              document.querySelectorAll('.shop-nav-item').forEach(el => el.classList.remove('active'));
              shopItem.classList.add('active');
              document.querySelectorAll('.shop-content').forEach(el => el.classList.remove('active'));
              const target = document.querySelector(`#shop-${shopItem.dataset.shop}`);
              if (target) target.classList.add('active');
            }

            // Theme card
            const themeCard = e.target.closest('.theme-card');
            if (themeCard) switchTheme(themeCard.dataset.theme);

            // Dark toggle
            if (e.target.closest('#dark-toggle')) toggleDark();

            // Cheat: coins set
            if (e.target.closest('#cheat-coins-set')) cheatSet('运营号.账户资产.性币', 'cheat-coins', v => Math.max(0, v));
            // Cheat: coins add
            if (e.target.closest('#cheat-coins-add')) cheatDelta('运营号.账户资产.性币', 'cheat-coins', 100);
            // Cheat: coins sub
            if (e.target.closest('#cheat-coins-sub')) cheatDelta('运营号.账户资产.性币', 'cheat-coins', -100);
            // Cheat: fans set
            if (e.target.closest('#cheat-fans-set')) cheatSet('运营号.人气数据.粉丝数量', 'cheat-fans', v => Math.max(0, v));
            // Cheat: 三轴设置
            if (e.target.closest('#cheat-stick-set')) cheatSet('主播池.{id}.核心状态.坚守度', 'cheat-stick', v => _.clamp(v, 0, 100));
            if (e.target.closest('#cheat-ruin-set')) cheatSet('主播池.{id}.核心状态.崩坏度', 'cheat-ruin', v => _.clamp(v, 0, 100));
            if (e.target.closest('#cheat-obey-set')) cheatSet('主播池.{id}.核心状态.服从度', 'cheat-obey', v => _.clamp(v, 0, 100));
            // Currency convert
            if (e.target.closest('#cheat-convert-btn')) convertCurrency();

            // Live update convert result
            const convertInput = e.target.closest('#cheat-convert-coins');
            if (convertInput) {
              const val = parseInt(convertInput.value, 10) || 0;
              const result = q('#convert-result');
              if (result) result.textContent = (val * 100).toLocaleString();
            }

            // Cheat: reset items
            if (e.target.closest('#cheat-reset-items')) cheatResetItems();
            // Cheat: reset log
            if (e.target.closest('#cheat-reset-log')) cheatResetLog();

            // Cheat collapsible
            if (e.target.closest('#cheat-header')) {
              document.querySelectorAll('#cheat-header, #cheat-body').forEach(el => el.classList.toggle('collapsed'));
            }

            // Custom item add
            if (e.target.closest('#custom-item-add')) cheatAddCustomItem();

            // Buy/Use/Fav buttons
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
              const card = actionBtn.closest('[data-item-id]');
              if (card) {
                const itemId = card.dataset.itemId;
                if (actionBtn.dataset.action === 'buy') buyItem(itemId);
                else if (actionBtn.dataset.action === 'use') useItem(itemId);
                else if (actionBtn.dataset.action === 'fav') toggleFavorite(itemId);
              }
            }

            // Shop refresh
            if (e.target.closest('#shop-refresh')) refreshShop();

            // Descent
            if (e.target.closest('#descent-btn')) doDescent();

            // Rule deploy
            if (e.target.closest('#rule-deploy-btn')) deployRule();

            // Rule delete
            if (e.target.closest('[data-action="delete-rule"]')) {
              const btn = e.target.closest('[data-action="delete-rule"]');
              const idx = parseInt(btn.dataset.ruleIdx, 10);
              const universe = btn.dataset.universe;
              if (!isNaN(idx)) deleteRule(universe, idx);
            }

            // Host switch toggle
            if (e.target.closest('#host-switch-btn')) {
              q('#host-dropdown').classList.toggle('show');
              return;
            }

            // Host switch — select host
            const hostItem = e.target.closest('.host-dropdown-item');
            if (hostItem) {
              const hostId = hostItem.dataset.hostId;
              const hostName = hostItem.dataset.hostName;
              if (hostName) {
                q('#host-dropdown').classList.remove('show');
                const textarea = document.getElementById('send_textarea') || document.querySelector('textarea');
                if (textarea) {
                  textarea.value = `切换至主播${hostName}`;
                  textarea.dispatchEvent(new Event('input', { bubbles: true }));
                  textarea.focus();
                }
              }
              return;
            }

            // Close host dropdown when clicking outside
            if (!e.target.closest('.host-switch-wrap')) {
              q('#host-dropdown')?.classList.remove('show');
            }
          });

          // Custom item type toggle: show uses vs hours
          document.addEventListener('change', e => {
            const typeSelect = e.target.closest('#custom-item-type');
            if (typeSelect) {
              const type = typeSelect.value;
              document.querySelectorAll('#custom-uses-row').forEach(el => el.style.display = type === '次数' ? 'flex' : 'none');
              document.querySelectorAll('#custom-hours-row').forEach(el => el.style.display = type === '时间' ? 'flex' : 'none');
            }
          });

          // Ctrl+Shift+K easter egg
          document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.shiftKey && e.key === 'K') {
              e.preventDefault();
              cheatDelta('运营号.账户资产.性币', null, 10000);
            }
          });
        }

        renderData();
        (() => { try { SillyTavern.getContext().eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => scheduleRender()); } catch(e) { try { Mvu?.events?.on?.(Mvu.events.VARIABLE_UPDATE_ENDED, () => scheduleRender()); } catch(e2) { console.warn('StatusBar: cannot subscribe to VARIABLE_UPDATE_ENDED'); } } })();

        // Fallback render for late-arriving variable data
        setTimeout(() => scheduleRender(), 500);
      }

      $(() => { (async () => { try { await init(); } catch(e) { console.error('StatusBar init error:', e); } })(); });
    })();
