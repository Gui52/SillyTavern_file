    var THEME_KEY = 'blast-jianghu-opening-theme';
    var FAVORITE_KEY = 'blast-jianghu-opening-favorites';
    var ITEMS_PER_PAGE = 6;
    var currentPage = 1;
    var activeTags = [];
    var filterExpanded = false;
    var filterMode = 'multi';
    var OPENING_MAP = {
      '1': {
        title: '落难公子线',
        desc: '灭门公子掌握邪功，俘获强敌为己用',
        swipe: 1,
        tags: ['强制', '羞辱', '征服', '强奸', '捆绑'],
      },
      '2': {
        title: '国师收徒线',
        desc: '国师用迷香迷倒三位皇子，准备调教',
        swipe: 2,
        tags: ['师徒', '迷奸', '调教', '控制', '多人'],
      },
      '3': {
        title: '南疆炉鼎线',
        desc: '魔门弟子挑选第一个炉鼎，种下心印控制',
        swipe: 3,
        tags: ['洗脑', '控制', '催眠', '炉鼎', '强上'],
      },
      '4': {
        title: '北疆竹马线',
        desc: '竹马将军酒后被催情药迷倒，准备强上军医',
        swipe: 4,
        tags: ['迷奸', '强迫', '下药', '竹马', '强奸'],
      },
      '5': {
        title: '极乐阁掌门线',
        desc: '极乐阁阁主挑选猎物，享受猎人游戏',
        swipe: 5,
        tags: ['狩猎', '恶堕', '操控', '征服', '调教'],
      },
      '6': {
        title: '西域禅院线',
        desc: '极乐阁弟子传送至西域禅院，发现一群处男',
        swipe: 6,
        tags: ['处男', '开苞', '迷奸', '僧侣', '群欢'],
      },
      '7': {
        title: '宫宴同窗线',
        desc: '富家少爷与大哥、二皇子同赴宫宴，少年情愫暗生',
        swipe: 7,
        tags: ['纯爱', '竹马', '兄长', '宫廷', '暧昧'],
      },
      '8': {
        title: '山野救皇子线',
        desc: '山中采药少年救下逃亡皇子，从此命运交缠',
        swipe: 8,
        tags: ['纯爱', '救助', '皇子', '山野', '相知'],
      },
    };

    function isValidTagLength(tag) {
      return /^[\u4e00-\u9fa5]{2}$/.test(tag) || /^[\u4e00-\u9fa5]{4}$/.test(tag);
    }

    function getTagListFromCard(card) {
      return String(card.getAttribute('data-tags') || '')
        .split(',')
        .map(function (tag) { return tag.trim(); })
        .filter(function (tag, index, list) {
          return tag && list.indexOf(tag) === index && isValidTagLength(tag);
        });
    }

    function getFilteredCards() {
      return getCards().filter(function (card) {
        var tags;
        if (!activeTags.length) {
          return true;
        }
        tags = getTagListFromCard(card);
        return activeTags.every(function (activeTag) {
          return tags.indexOf(activeTag) !== -1;
        });
      });
    }

    function updateFilterCount() {
      var node = document.getElementById('filter-count');
      var count = getFilteredCards().length;
      var label = activeTags.join(' + ');
      if (node) {
        node.textContent = !activeTags.length
          ? '当前显示 ' + count + ' 条'
          : '标签「' + label + '」下共 ' + count + ' 条';
      }
    }

    function updateFilterBarState() {
      var bar = document.getElementById('opening-filter-bar');
      var toggle = document.getElementById('filter-toggle');
      if (bar) {
        bar.classList.toggle('is-collapsed', !filterExpanded);
      }
      if (toggle) {
        toggle.textContent = filterExpanded ? '收起标签' : '展开标签';
        toggle.setAttribute('aria-expanded', filterExpanded ? 'true' : 'false');
      }
    }

    function updateFilterModeState() {
      document.querySelectorAll('[data-filter-mode]').forEach(function (button) {
        var mode = String(button.getAttribute('data-filter-mode') || 'multi');
        button.classList.toggle('active', mode === filterMode);
        button.setAttribute('aria-pressed', mode === filterMode ? 'true' : 'false');
      });
    }

    function setTagSelection(tag) {
      var cleanTag = String(tag || '').trim();
      var index;
      if (!cleanTag || !isValidTagLength(cleanTag)) {
        return;
      }

      if (filterMode === 'single') {
        activeTags = activeTags.length === 1 && activeTags[0] === cleanTag ? [] : [cleanTag];
        return;
      }

      index = activeTags.indexOf(cleanTag);
      if (index === -1) {
        activeTags.push(cleanTag);
      } else {
        activeTags.splice(index, 1);
      }
    }

    function renderTagFilters() {
      var container = document.getElementById('opening-filter-tags');
      var seen = {};
      var tags = [];

      if (!container) {
        return;
      }

      getCards().forEach(function (card) {
        getTagListFromCard(card).forEach(function (tag) {
          if (!seen[tag]) {
            seen[tag] = true;
            tags.push(tag);
          }
        });
      });

      container.innerHTML = tags
        .map(function (tag) {
          var activeClass = activeTags.indexOf(tag) !== -1 ? ' active' : '';
          return '<button class="filter-chip' + activeClass + '" type="button" data-filter-tag="' + tag + '">' + tag + '</button>';
        })
        .join('');

      container.querySelectorAll('[data-filter-tag]').forEach(function (button) {
        button.addEventListener('click', function () {
          var tag = String(button.getAttribute('data-filter-tag') || '').trim();
          if (!tag) {
            return;
          }
          setTagSelection(tag);
          currentPage = 1;
          renderTagFilters();
          renderPage();
        });
      });
    }

    function syncCardTagStates() {
      document.querySelectorAll('.card .tag').forEach(function (tagNode) {
        var tag = String(tagNode.getAttribute('data-card-tag') || '').trim();
        tagNode.classList.toggle('active', activeTags.indexOf(tag) !== -1);
      });
    }

    function toggleTagFilter(tag) {
      var cleanTag = String(tag || '').trim();
      if (!cleanTag || !isValidTagLength(cleanTag)) {
        return;
      }

      setTagSelection(cleanTag);

      filterExpanded = true;
      currentPage = 1;
      updateFilterBarState();
      updateFilterModeState();
      renderTagFilters();
      syncCardTagStates();
      renderPage();
    }

    function applyTheme(theme) {
      if (theme === 'dark') {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
      var button = document.getElementById('theme-toggle');
      if (button) {
        button.textContent = theme === 'dark' ? '切换浅色' : '切换暗色';
      }
    }

    function setStatus(message) {
      var node = document.getElementById('jump-status');
      if (node) {
        node.textContent = message;
      }
    }

    function readFavorites() {
      try {
        return JSON.parse(localStorage.getItem(FAVORITE_KEY) || '[]');
      } catch (_error) {
        return [];
      }
    }

    function writeFavorites(value) {
      try {
        localStorage.setItem(FAVORITE_KEY, JSON.stringify(value));
      } catch (_error) {}
    }

    function renderFavorites() {
      var favorites = readFavorites();
      var buttons = document.querySelectorAll('[data-fav]');
      buttons.forEach(function (button) {
        var id = String(button.getAttribute('data-fav'));
        var active = favorites.indexOf(id) !== -1;
        button.classList.toggle('active', active);
        var card = button.closest('.card');
        if (card) {
          card.classList.toggle('is-favorite', active);
        }
      });

      var list = document.getElementById('favorites-list');
      if (!list) {
        return;
      }

      if (!favorites.length) {
        list.innerHTML = '<div class="favorite-empty">你还没有收藏任何开场。<br>点击开场卡片右上角的五角星即可收录。</div>';
        return;
      }

      list.innerHTML = favorites
        .map(function (id) {
          var item = OPENING_MAP[id];
          if (!item) {
            return '';
          }
          return [
            '<div class="favorite-item">',
            '  <div>',
            '    <h3 class="favorite-item-title">' + item.title + '</h3>',
            '    <p class="favorite-item-desc">' + item.desc + '</p>',
            '  </div>',
            '  <button class="jump-btn" type="button" data-favorite-jump="' + id + '">进入剧情</button>',
            '</div>',
          ].join('');
        })
        .join('');

      list.querySelectorAll('[data-favorite-jump]').forEach(function (button) {
        button.addEventListener('click', function () {
          var id = String(button.getAttribute('data-favorite-jump'));
          var item = OPENING_MAP[id];
          if (item) {
            jumpToOpening(item.swipe, item.title);
            closeFavoritesPanel();
          }
        });
      });
    }

    function toggleFavorite(id) {
      var favorites = readFavorites();
      var stringId = String(id);
      if (favorites.indexOf(stringId) !== -1) {
        favorites = favorites.filter(function (item) { return item !== stringId; });
      } else {
        favorites.push(stringId);
      }
      writeFavorites(favorites);
      renderFavorites();
    }

    function getCards() {
      return Array.prototype.slice.call(document.querySelectorAll('.grid .card'));
    }

    function getTotalPages() {
      return Math.max(1, Math.ceil(getFilteredCards().length / ITEMS_PER_PAGE));
    }

    function updatePager() {
      var totalPages = getTotalPages();
      var bottomBar = document.querySelector('.bottom-bar');
      var pager = document.getElementById('opening-pager');
      var indicator = document.getElementById('page-indicator');
      var prev = document.getElementById('page-prev');
      var next = document.getElementById('page-next');

      currentPage = Math.max(1, Math.min(currentPage, totalPages));

      if (bottomBar) {
        bottomBar.classList.toggle('has-pagination', totalPages > 1);
      }
      if (pager) {
        pager.classList.toggle('is-visible', totalPages > 1);
      }
      if (indicator) {
        indicator.textContent = '第 ' + currentPage + ' / ' + totalPages + ' 页';
      }
      if (prev) {
        prev.disabled = currentPage <= 1;
      }
      if (next) {
        next.disabled = currentPage >= totalPages;
      }
    }

    function renderPage(direction) {
      var cards = getCards();
      var filteredCards = getFilteredCards();
      var totalPages = Math.max(1, Math.ceil(filteredCards.length / ITEMS_PER_PAGE));
      var empty = document.getElementById('opening-empty');
      var start;
      var end;

      currentPage = Math.max(1, Math.min(currentPage, totalPages));
      start = (currentPage - 1) * ITEMS_PER_PAGE;
      end = start + ITEMS_PER_PAGE;

      cards.forEach(function (card) {
        card.classList.remove('page-enter-next', 'page-enter-prev');
        card.classList.add('page-hidden');
      });

      filteredCards.forEach(function (card, index) {
        var visible = index >= start && index < end;
        card.classList.remove('page-enter-next', 'page-enter-prev');
        card.classList.toggle('page-hidden', !visible);

        if (visible) {
          card.style.setProperty('--page-stagger', String(index - start));
          if (direction === 'next') {
            void card.offsetWidth;
            card.classList.add('page-enter-next');
          } else if (direction === 'prev') {
            void card.offsetWidth;
            card.classList.add('page-enter-prev');
          }
        }
      });

      if (empty) {
        empty.classList.toggle('is-visible', filteredCards.length === 0);
      }

      syncCardTagStates();
      updateFilterCount();
      updatePager();
    }

    function goToPage(page) {
      var totalPages = getTotalPages();
      var nextPage = Math.max(1, Math.min(page, totalPages));
      var direction;

      if (nextPage === currentPage) {
        updatePager();
        return;
      }

      direction = nextPage > currentPage ? 'next' : 'prev';
      currentPage = nextPage;
      renderPage(direction);
    }

    function getJumpApi() {
      if (typeof setChatMessages === 'function') {
        return { setChatMessages: setChatMessages };
      }
      if (window.TavernHelper && typeof window.TavernHelper.setChatMessages === 'function') {
        return { setChatMessages: window.TavernHelper.setChatMessages };
      }
      if (window.parent && window.parent !== window && window.parent.TavernHelper && typeof window.parent.TavernHelper.setChatMessages === 'function') {
        return { setChatMessages: window.parent.TavernHelper.setChatMessages };
      }
      return null;
    }

    async function jumpToOpening(swipeId, title) {
      var api = getJumpApi();
      if (!api) {
        setStatus('当前环境未暴露跳转接口，无法自动切换到「' + title + '」。');
        return;
      }

      setStatus('正在切换到「' + title + '」...');

      try {
        await api.setChatMessages([{ message_id: 0, swipe_id: swipeId }], { refresh: 'affected' });
        setStatus('已切换到「' + title + '」。');
      } catch (error) {
        var message = error && error.message ? error.message : String(error);
        setStatus('切换失败：' + message);
      }
    }

    function openFavoritesPanel() {
      var panel = document.getElementById('favorites-panel');
      if (panel) {
        panel.classList.add('open');
      }
      renderFavorites();
    }

    function closeFavoritesPanel() {
      var panel = document.getElementById('favorites-panel');
      if (panel) {
        panel.classList.remove('open');
      }
    }

    (function initTheme() {
      var savedTheme = 'light';
      try {
        savedTheme = localStorage.getItem(THEME_KEY) || 'light';
      } catch (_error) {}

      applyTheme(savedTheme);

      var button = document.getElementById('theme-toggle');
      if (button) {
        button.addEventListener('click', function () {
          var nextTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
          applyTheme(nextTheme);
          try {
            localStorage.setItem(THEME_KEY, nextTheme);
          } catch (_error) {}
        });
      }
    })();

    (function initFavorites() {
      document.querySelectorAll('[data-fav]').forEach(function (button) {
        button.addEventListener('click', function (event) {
          event.stopPropagation();
          toggleFavorite(button.getAttribute('data-fav'));
        });
      });

      document.querySelectorAll('.card .tag').forEach(function (tagNode) {
        var tag = String(tagNode.textContent || '').trim();
        tagNode.setAttribute('data-card-tag', tag);
        tagNode.setAttribute('role', 'button');
        tagNode.setAttribute('tabindex', '0');
        tagNode.addEventListener('click', function (event) {
          event.stopPropagation();
          toggleTagFilter(tag);
        });
        tagNode.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleTagFilter(tag);
          }
        });
      });

      renderFavorites();
    })();

    (function initFavoritesPanel() {
      var open = document.getElementById('favorites-toggle');
      var close = document.getElementById('favorites-close');
      var panel = document.getElementById('favorites-panel');
      if (open) {
        open.addEventListener('click', openFavoritesPanel);
      }
      if (close) {
        close.addEventListener('click', closeFavoritesPanel);
      }
      if (panel) {
        panel.addEventListener('click', function (event) {
          if (event.target === panel) {
            closeFavoritesPanel();
          }
        });
      }
    })();

    (function initPagination() {
      var prev = document.getElementById('page-prev');
      var next = document.getElementById('page-next');
      var filterToggle = document.getElementById('filter-toggle');
      var filterModeButtons = document.querySelectorAll('[data-filter-mode]');

      if (prev) {
        prev.addEventListener('click', function () {
          goToPage(currentPage - 1);
        });
      }

      if (next) {
        next.addEventListener('click', function () {
          goToPage(currentPage + 1);
        });
      }

      if (filterToggle) {
        filterToggle.addEventListener('click', function () {
          filterExpanded = !filterExpanded;
          updateFilterBarState();
        });
      }

      filterModeButtons.forEach(function (button) {
        button.addEventListener('click', function () {
          var nextMode = String(button.getAttribute('data-filter-mode') || 'multi');
          if (nextMode !== 'single' && nextMode !== 'multi') {
            return;
          }
          filterMode = nextMode;
          if (filterMode === 'single' && activeTags.length > 1) {
            activeTags = activeTags.slice(0, 1);
          }
          updateFilterModeState();
          renderTagFilters();
          syncCardTagStates();
          renderPage();
        });
      });

      updateFilterBarState();
      updateFilterModeState();
      renderTagFilters();
      renderPage();
    })();

