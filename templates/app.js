(function () {
  const app = document.getElementById('app');
  const toolbar = document.getElementById('toolbar');
  const backBtn = document.getElementById('back-btn');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const downloadBtn = document.getElementById('download-btn');
  const shareBtn = document.getElementById('share-btn');
  const shareModal = document.getElementById('share-modal');
  const shareText = document.getElementById('share-text');
  const shareModalCopy = document.getElementById('share-modal-copy');
  const shareModalClose = document.getElementById('share-modal-close');

  function getSlug() {
    return decodeURIComponent(location.hash.replace(/^#/, ''));
  }

  function getCurrentIndex() {
    const slug = getSlug();
    return window.LESSONS.findIndex(x => String(x.day) === String(slug));
  }

  function padDay(day) {
    return String(day).padStart(3, '0');
  }

  /* ---------- 目录页 ---------- */
  function renderIndex() {
    toolbar.style.display = 'none';

    const PAGE_SIZE = 12;       // 每次加载的卡片数

    const state = {
      loadedCount: PAGE_SIZE,
      keyword: '',
      stage: 'all'
    };

    const allStages = [...new Set(window.LESSONS.map(l => l.stage).filter(Boolean))];

    function filterLessons() {
      return window.LESSONS.filter(l => {
        if (state.stage !== 'all' && l.stage !== state.stage) return false;
        if (state.keyword) {
          const q = state.keyword.toLowerCase();
          const hay = [
            l.title, l.subtitle, l.stage,
            (l.tags || []).join(' '),
            l.problem_id
          ].filter(Boolean).join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
    }

    function render() {
      const filtered = filterLessons();
      const visible = filtered.slice(0, state.loadedCount);
      const remaining = filtered.length - state.loadedCount;

      const cards = visible.length
        ? visible.map(l => `
          <a class="card" href="#${l.day}">
            <div class="card-day">DAY ${l.day}</div>
            <div class="card-title">${l.title}</div>
            <div class="card-sub">${l.subtitle || ''}</div>
            <div class="card-tags">${(l.tags || []).map(t => '#' + t).join(' ')}</div>
          </a>
        `).join('')
        : '<div class="empty">没有匹配的题目</div>';

      const sidebarBtns = [
        `<button class="stage-btn ${state.stage === 'all' ? 'active' : ''}" data-stage="all">
          <span>全部</span><span class="cnt">${window.LESSONS.length}</span>
        </button>`,
        ...allStages.map(s => {
          const cnt = window.LESSONS.filter(l => l.stage === s).length;
          return `<button class="stage-btn ${state.stage === s ? 'active' : ''}" data-stage="${s}">
            <span>${s}</span><span class="cnt">${cnt}</span>
          </button>`;
        })
      ].join('');

      // 加载更多区域
      let footer = '';
      if (filtered.length === 0) {
        footer = '';
      } else if (remaining > 0) {
        footer = `
          <div class="load-more-wrap">
            <button class="load-more-btn" id="load-more-btn">
              加载更多（还有 ${remaining} 题）
            </button>
            <div class="load-more-hint">已显示 ${state.loadedCount} / ${filtered.length} 题</div>
          </div>
        `;
      } else {
        footer = `
          <div class="load-more-wrap">
            <div class="all-loaded">— 已全部加载（共 ${filtered.length} 题）—</div>
          </div>
        `;
      }

      app.innerHTML = `
        <div class="index-page">
          <div class="index-hero">
            <div class="index-hero-left">
              <h1>数学思维学编程 · 每日一题</h1>
              <p>零基础 → 算法思维 · 用数学引入，用编程落地</p>
            </div>
            <div class="index-hero-right">
              <div class="search-bar">
                <span class="search-icon">🔍</span>
                <input id="search-input" type="search"
                  placeholder="搜索题目、标签、知识点..."
                  value="${state.keyword}">
              </div>
            </div>
          </div>

          <div class="index-body">
            <aside class="stage-sidebar">
              <div class="sidebar-title">阶段</div>
              ${sidebarBtns}
            </aside>
            <main class="index-content">
              <div class="grid">${cards}</div>
              ${footer}
            </main>
          </div>
        </div>
      `;

      // 搜索
      const searchInput = document.getElementById('search-input');
      searchInput.addEventListener('input', e => {
        state.keyword = e.target.value.trim();
        state.loadedCount = PAGE_SIZE;   // 重置
        render();
        const newInput = document.getElementById('search-input');
        newInput.focus();
        newInput.setSelectionRange(newInput.value.length, newInput.value.length);
      });

      // 阶段筛选
      app.querySelectorAll('.stage-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.stage = btn.dataset.stage;
          state.loadedCount = PAGE_SIZE;   // 重置
          render();
        });
      });

      // 加载更多
      const loadMoreBtn = document.getElementById('load-more-btn');
      if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
          state.loadedCount += PAGE_SIZE;
          render();
        });
      }
    }

    render();
  }

  /* ---------- 海报页 ---------- */
  function renderPoster(slug) {
    hideShareModal();
    const idx = window.LESSONS.findIndex(x => String(x.day) === String(slug));
    if (idx < 0) { renderIndex(); return; }

    const l = window.LESSONS[idx];
    const prev = idx > 0 ? window.LESSONS[idx - 1] : null;
    const next = idx < window.LESSONS.length - 1 ? window.LESSONS[idx + 1] : null;

    toolbar.style.display = 'flex';

    // 翻页按钮状态
    if (prev) {
      prevBtn.style.display = 'inline-block';
      prevBtn.href = '#' + prev.day;
      prevBtn.textContent = '← ' + padDay(prev.day);
    } else {
      prevBtn.style.display = 'none';
    }
    if (next) {
      nextBtn.style.display = 'inline-block';
      nextBtn.href = '#' + next.day;
      nextBtn.textContent = padDay(next.day) + ' →';
    } else {
      nextBtn.style.display = 'none';
    }

    const problemLink = (l.platform && l.problem_id)
      ? (l.url
          ? `<a class="p-problem-link" href="${l.url}" target="_blank" rel="noopener">【${l.platform} · ${l.problem_id}】</a>`
          : `<span class="p-problem-link p-problem-link-plain">【${l.platform} · ${l.problem_id}】</span>`)
      : "";
    // 文案按钮状态
    if (l.share) {
      shareBtn.style.display = 'inline-block';
      shareBtn.disabled = false;
      shareBtn.textContent = '📋 文案';
    } else {
      shareBtn.style.display = 'none';
    }

    const foreBlock = l.fore
      ? `<div class="p-fore"><span class="p-fore-label">下期</span><span>${l.fore}</span></div>`
      : "";

    const tags = (l.tags || []).map(t => "#" + t).join("  ");

    app.innerHTML = `
      <div class="poster" data-theme="${l.theme || 'warm'}">
        <div class="poster-content">

          <div class="p-head">
            <div class="p-brand">
              <span class="p-brand-mark">∑</span>
              <span class="p-brand-name">数学思维学编程</span>
            </div>
            <div class="p-head-right">
              ${l.stage ? `<span class="p-head-stage">${l.stage}</span>` : ""}
              ${problemLink}
            </div>
          </div>

          <div class="p-title-block">
            <h1 class="p-title">${l.title}</h1>
            <div class="p-subtitle">${l.subtitle || ""}</div>
          </div>

          ${l.html}

          <div class="p-foot">
            <div class="p-tags">${tags}</div>
            ${foreBlock}
          </div>

        </div>
      </div>
    `;

    if (window.hljs) {
      app.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }
  }

  /* ---------- 路由 ---------- */
  function route() {
    const slug = getSlug();
    if (slug) renderPoster(slug);
    else renderIndex();
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', route);

  backBtn.addEventListener('click', e => {
    e.preventDefault();
    location.hash = '';
  });

  /* ---------- 键盘翻页 ---------- */
  document.addEventListener('keydown', e => {
    const slug = getSlug();
    if (!slug) return;

    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      const idx = getCurrentIndex();
      if (idx > 0) location.hash = '#' + window.LESSONS[idx - 1].day;
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      const idx = getCurrentIndex();
      if (idx >= 0 && idx < window.LESSONS.length - 1)
        location.hash = '#' + window.LESSONS[idx + 1].day;
    } else if (e.key === 'Escape') {
      location.hash = '';
    }
  });

    /* ---------- 复制文案 ---------- */
  function showShareModal(text) {
    shareText.value = text;
    shareModal.style.display = 'flex';
    shareText.focus();
    shareText.select();
  }

  function hideShareModal() {
    shareModal.style.display = 'none';
  }

  async function copyToClipboard(text) {
    // 优先用现代 API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        // 降级
      }
    }
    // 降级：用隐藏 textarea + execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  shareBtn.addEventListener('click', async () => {
    const idx = getCurrentIndex();
    if (idx < 0) return;
    const l = window.LESSONS[idx];
    if (!l.share) return;

    const oldText = shareBtn.textContent;
    shareBtn.textContent = '复制中...';
    shareBtn.disabled = true;

    const ok = await copyToClipboard(l.share);

    if (ok) {
      shareBtn.textContent = '✓ 已复制';
      setTimeout(() => {
        shareBtn.textContent = oldText;
        shareBtn.disabled = false;
      }, 1500);
    } else {
      // 复制失败 → 弹出 modal 让用户手动复制
      showShareModal(l.share);
      shareBtn.textContent = oldText;
      shareBtn.disabled = false;
    }
  });

  shareModalCopy.addEventListener('click', async () => {
    const ok = await copyToClipboard(shareText.value);
    if (ok) {
      shareModalCopy.textContent = '✓ 已复制';
      setTimeout(() => { shareModalCopy.textContent = '再复制一次'; }, 1500);
    }
  });

  shareModalClose.addEventListener('click', hideShareModal);

  shareModal.addEventListener('click', e => {
    if (e.target === shareModal) hideShareModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && shareModal.style.display === 'flex') {
      hideShareModal();
    }
  });

  /* ---------- 下载 ---------- */
  downloadBtn.addEventListener('click', async () => {
    const poster = document.querySelector('.poster');
    if (!poster) return;

    const oldText = downloadBtn.textContent;
    downloadBtn.textContent = '导出中...';
    downloadBtn.disabled = true;

    try {
      const canvas = await html2canvas(poster, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false
      });
      const idx = getCurrentIndex();
      const current = idx >= 0 ? window.LESSONS[idx] : null;
      const filename = current
        ? `day-${padDay(current.day)}-${current.title}.png`
        : 'poster.png';
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      link.click();
      downloadBtn.textContent = '✓ 已下载';
      setTimeout(() => { downloadBtn.textContent = oldText; downloadBtn.disabled = false; }, 1500);
    } catch (e) {
      console.error(e);
      downloadBtn.textContent = '导出失败';
      setTimeout(() => { downloadBtn.textContent = oldText; downloadBtn.disabled = false; }, 1500);
    }
  });

  route();
})();