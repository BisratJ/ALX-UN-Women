/**
 * ALX Enterprise × UN Women: Learner Operations & Analytics Dashboard Logic
 * ==========================================================================
 * Dual-Theme Smart UI Engine (Dark Obsidian & Light Slate) with Poppins typography,
 * vibrant KPI cards, theme-aware Chart.js, SheetJS parser, & Motion One animations.
 */

(function () {
  'use strict';

  // State
  let DEFAULT_DATA = null;
  let DATA = null;
  let filteredLearners = [];
  let currentPage = 1;
  const PAGE_SIZE = 25;

  let sortColumn = 'unified_health';
  let sortDirection = 'asc';

  let activeHealthFilter = '';
  let activeTrackFilter = '';
  let activeFunnelTrack = 'all';

  let healthChartInstance = null;

  // Health priority sort order (Risk & Support first)
  const HEALTH_SORT_ORDER = {
    'At Risk': 0,
    'Needs Support': 1,
    'Un-onboarded / Inactive': 2,
    'Healthy / On-Track': 3,
  };

  const HEALTH_MAP_CS = {
    'active': 'Healthy / On-Track',
    'on-track': 'Healthy / On-Track',
    'at-risk': 'At Risk',
  };

  const HEALTH_MAP_DA = {
    'Active state': 'Healthy / On-Track',
    'Graduated': 'Healthy / On-Track',
    'Slow but progressing state': 'Needs Support',
    'Stalled state': 'Needs Support',
    'At risk state': 'At Risk',
    'Disengaged state': 'At Risk',
    'Not activated or no sign of life': 'Un-onboarded / Inactive',
  };

  // SVG Icons Registry (Strictly vector SVGs, no emojis)
  const ICONS = {
    target: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    key: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
    zap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    alert: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    minus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    moon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    sun: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M18.36 5.64l1.41-1.41"/></svg>`,
  };

  // Motion One Animation Helpers
  const Motion = (() => {
    const lib = window.Motion || null;
    const animate = lib ? lib.animate : null;
    const stagger = lib ? lib.stagger : (delay) => delay || 0;

    function fadeUp(els, opts = {}) {
      if (!animate || !els) return;
      const targets = typeof els === 'string' ? document.querySelectorAll(els) : els;
      if (!targets || targets.length === 0) return;
      animate(
        targets,
        { opacity: [0, 1], y: [20, 0] },
        { duration: opts.duration || 0.45, delay: stagger(opts.stagger || 0.06), easing: [0.22, 1, 0.36, 1] }
      );
    }

    function slideDown(els, opts = {}) {
      if (!animate || !els) return;
      const targets = typeof els === 'string' ? document.querySelectorAll(els) : els;
      if (!targets || targets.length === 0) return;
      animate(
        targets,
        { opacity: [0, 1], y: [-16, 0] },
        { duration: opts.duration || 0.4, easing: [0.22, 1, 0.36, 1] }
      );
    }

    function springIn(els, opts = {}) {
      if (!animate || !els) return;
      const targets = typeof els === 'string' ? document.querySelectorAll(els) : els;
      if (!targets || targets.length === 0) return;
      animate(
        targets,
        { opacity: [0, 1], scale: [0.92, 1], y: [10, 0] },
        { duration: opts.duration || 0.4, delay: stagger(opts.stagger || 0.06), easing: [0.22, 1, 0.36, 1] }
      );
    }

    return { fadeUp, slideDown, springIn, available: !!animate };
  })();

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    Motion.slideDown('.top-header');
    loadData();
    setupThemeToggle();
    setupModeSwitch();
    setupDropzone();
  });

  async function loadData() {
    try {
      const response = await fetch('data.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      DEFAULT_DATA = await response.json();

      const cached = localStorage.getItem('alx_unwomen_custom_data');
      if (cached) {
        try {
          DATA = JSON.parse(cached);
        } catch (e) {
          DATA = DEFAULT_DATA;
        }
      } else {
        DATA = DEFAULT_DATA;
      }

      renderDashboard();
      hideLoading();
    } catch (err) {
      console.error('Failed to load data.json:', err);
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) {
        overlay.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon" style="color: var(--text-sub);">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div class="empty-title" style="margin-top: 10px;">Failed to load dashboard data</div>
            <div class="empty-desc">Ensure data.json exists in workspace directory. Run: python3 clean_data.py</div>
          </div>
        `;
      }
    }
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 400);
    }
  }

  function renderDashboard() {
    renderTimestamp();
    renderKPIs();
    renderFunnels();
    renderHealthChart();
    setupTable();
    setTimeout(() => {
      Motion.fadeUp('.section-block', { stagger: 0.1, duration: 0.5 });
    }, 100);
  }

  // Timestamp & Badges
  function renderTimestamp() {
    const ts = DATA.generated_at;
    const date = new Date(ts);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) lastUpdatedEl.textContent = `Sync: ${formatted}`;

    const footerTs = document.getElementById('footerTimestamp');
    if (footerTs) footerTs.textContent = formatted;

    const totalBadge = document.getElementById('totalLearnersBadge');
    if (totalBadge && DATA.kpis) totalBadge.textContent = DATA.kpis.total_registered || 512;
  }

  // KPI Cards Grid
  function renderKPIs() {
    const k = DATA.kpis;
    const onboardingRate = k.total_registered > 0
      ? ((k.total_lms_login / k.total_registered) * 100).toFixed(1)
      : 0;
    const activationRate = k.total_registered > 0
      ? ((k.total_activated / k.total_registered) * 100).toFixed(1)
      : 0;

    const kpis = [
      {
        id: 'kpi-all',
        label: 'UN Sponsored Seats',
        value: k.total_un_seats,
        detail: `${k.total_registered} female scholars registered`,
        color: 'blue',
        icon: ICONS.target,
        filterHealth: '',
      },
      {
        id: 'kpi-onboarded',
        label: 'LMS Onboarded',
        value: k.total_lms_login,
        detail: `${onboardingRate}% onboarding rate`,
        color: 'blue',
        icon: ICONS.key,
        filterHealth: '',
      },
      {
        id: 'kpi-activated',
        label: 'Enrollment Activated',
        value: k.total_activated,
        detail: `${activationRate}% activation rate`,
        color: 'orange',
        icon: ICONS.zap,
        filterHealth: '',
      },
      {
        id: 'kpi-healthy',
        label: 'Healthy / On-Track',
        value: k.total_healthy,
        detail: `${((k.total_healthy / k.total_registered) * 100).toFixed(1)}% of cohort`,
        color: 'green',
        icon: ICONS.check,
        filterHealth: 'Healthy / On-Track',
      },
      {
        id: 'kpi-risk',
        label: 'At Risk',
        value: k.total_at_risk,
        detail: 'Immediate outreach list',
        color: 'red',
        icon: ICONS.alert,
        filterHealth: 'At Risk',
      },
      {
        id: 'kpi-inactive',
        label: 'Un-onboarded / Inactive',
        value: k.total_unonboarded,
        detail: 'Zero platform activity',
        color: 'gray',
        icon: ICONS.minus,
        filterHealth: 'Un-onboarded / Inactive',
      },
    ];

    const grid = document.getElementById('kpiGrid');
    if (!grid) return;

    grid.innerHTML = kpis.map(kpi => `
      <div class="kpi-smart-card kpi-${kpi.color}" id="${kpi.id}" data-health="${kpi.filterHealth}">
        <div class="kpi-header-row">
          <span class="kpi-title-label">${kpi.label}</span>
          <div class="kpi-icon-bubble">${kpi.icon}</div>
        </div>
        <div class="kpi-value-num" data-target="${kpi.value}">0</div>
        <div class="kpi-foot-detail">${kpi.detail}</div>
      </div>
    `).join('');

    kpis.forEach(kpi => {
      const el = document.getElementById(kpi.id);
      if (el) {
        el.addEventListener('click', () => {
          activeHealthFilter = kpi.filterHealth;
          updateHealthChipUI();
          currentPage = 1;
          filterAndRender();
          document.getElementById('tableSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    });

    requestAnimationFrame(() => {
      Motion.springIn('.kpi-smart-card', { stagger: 0.05, duration: 0.4 });
    });
    animateCounters();
  }

  function animateCounters() {
    document.querySelectorAll('.kpi-value-num[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target, 10) || 0;
      const duration = 1000;
      const start = performance.now();

      function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(step);
      }

      requestAnimationFrame(step);
    });
  }

  // Funnel Analytics
  function renderFunnels() {
    const funnelDisplay = document.getElementById('funnelDisplay');
    const trackTabs = document.getElementById('funnelTrackTabs');
    if (!funnelDisplay) return;

    if (trackTabs) {
      trackTabs.querySelectorAll('.pill-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          trackTabs.querySelectorAll('.pill-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          activeFunnelTrack = tab.dataset.track;
          renderFunnelContent();
        });
      });
    }

    renderFunnelContent();
  }

  function renderFunnelContent() {
    const funnelDisplay = document.getElementById('funnelDisplay');
    if (!funnelDisplay) return;

    let funnelData = { registered: 0, logged_into_lms: 0, activated: 0, submitted_first: 0, graduated: 0 };

    if (activeFunnelTrack === 'cs') {
      funnelData = DATA.funnels.cs || funnelData;
    } else if (activeFunnelTrack === 'da') {
      funnelData = DATA.funnels.da || funnelData;
    } else {
      const cs = DATA.funnels.cs || {};
      const da = DATA.funnels.da || {};
      funnelData = {
        registered: (cs.registered || 0) + (da.registered || 0),
        logged_into_lms: (cs.logged_into_lms || 0) + (da.logged_into_lms || 0),
        activated: (cs.activated || 0) + (da.activated || 0),
        submitted_first: (cs.submitted_first || 0) + (da.submitted_first || 0),
        graduated: (cs.graduated || 0) + (da.graduated || 0),
      };
    }

    const maxVal = funnelData.registered || 1;

    const steps = [
      { label: 'Registered Scholars', val: funnelData.registered },
      { label: 'LMS Onboarded', val: funnelData.logged_into_lms },
      { label: 'Enrollment Activated', val: funnelData.activated },
      { label: 'Submitted 1+ Milestone', val: funnelData.submitted_first },
      { label: 'Graduated / Passed', val: funnelData.graduated },
    ];

    funnelDisplay.innerHTML = steps.map(step => {
      const pct = ((step.val / maxVal) * 100).toFixed(1);
      return `
        <div class="funnel-row-item">
          <span class="funnel-label">${step.label}</span>
          <div class="funnel-track-bar-bg">
            <div class="funnel-track-bar-fill" style="width: 0%" data-width="${pct}%"></div>
          </div>
          <div class="funnel-val-box">
            <span class="funnel-count">${step.val}</span>
            <span class="funnel-pct">${pct}%</span>
          </div>
        </div>
      `;
    }).join('');

    requestAnimationFrame(() => {
      Motion.fadeUp(funnelDisplay.querySelectorAll('.funnel-row-item'), { stagger: 0.06, duration: 0.35 });
      setTimeout(() => {
        if (Motion.available) {
          funnelDisplay.querySelectorAll('.funnel-track-bar-fill').forEach((bar, i) => {
            const targetWidth = bar.dataset.width;
            bar.style.width = '0%';
            setTimeout(() => {
              window.Motion.animate(bar, { width: targetWidth }, {
                duration: 0.6,
                delay: i * 0.05,
                easing: [0.22, 1, 0.36, 1],
              });
            }, 50);
          });
        } else {
          funnelDisplay.querySelectorAll('.funnel-track-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width;
          });
        }
      }, 100);
    });
  }

  // Health Chart (Theme-Aware Doughnut)
  function renderHealthChart() {
    const canvas = document.getElementById('healthChartOverall');
    const legendList = document.getElementById('healthLegendList');
    if (!canvas) return;

    const healthObj = {
      'Healthy / On-Track': DATA.kpis.total_healthy || 0,
      'Needs Support': DATA.kpis.total_needs_support || 0,
      'At Risk': DATA.kpis.total_at_risk || 0,
      'Un-onboarded / Inactive': DATA.kpis.total_unonboarded || 0,
    };

    const total = Object.values(healthObj).reduce((a, b) => a + b, 0);
    const centerEl = document.getElementById('chartCenterTotal');
    if (centerEl) centerEl.textContent = total;

    const labels = Object.keys(healthObj);
    const dataValues = Object.values(healthObj);
    
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // ScholarXIV Theme-Aware Health Palette
    const colors = isDark 
      ? ['#4ADE80', '#FACC15', '#F87171', '#94A3B8']
      : ['#047857', '#B45309', '#B91C1C', '#475569'];

    // Render Legend
    if (legendList) {
      legendList.innerHTML = labels.map((label, idx) => {
        const val = dataValues[idx];
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
        return `
          <div class="legend-item-row">
            <div class="legend-left">
              <span class="legend-dot" style="background: ${colors[idx]}"></span>
              <span>${label}</span>
            </div>
            <div class="legend-right">${val} (${pct}%)</div>
          </div>
        `;
      }).join('');
    }

    // Chart.js Doughnut
    if (typeof Chart !== 'undefined') {
      if (healthChartInstance) healthChartInstance.destroy();

      healthChartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: dataValues,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 6,
            cutout: '74%',
            spacing: 2,
            borderRadius: 3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: isDark ? '#212124' : '#FFFFFF',
              titleColor: isDark ? '#FFFFFF' : '#1C1C1E',
              bodyColor: isDark ? '#9E9EA4' : '#636366',
              borderColor: isDark ? '#313135' : '#E3E3E8',
              borderWidth: 1,
              cornerRadius: 6,
              padding: 10,
              titleFont: { family: 'Poppins', size: 12, weight: '600' },
              bodyFont: { family: 'Poppins', size: 11 },
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${((ctx.raw / total) * 100).toFixed(1)}%)`,
              },
            },
          },
          animation: { animateRotate: true, duration: 600 },
        },
      });
    }
  }

  // Table Directory & Filters
  function setupTable() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const filterTrack = document.getElementById('filterTrack');
    const healthChips = document.getElementById('healthChips');
    const exportBtn = document.getElementById('exportCsvBtn');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        if (clearSearchBtn) {
          if (searchInput.value.trim().length > 0) clearSearchBtn.classList.remove('hidden');
          else clearSearchBtn.classList.add('hidden');
        }
        currentPage = 1;
        filterAndRender();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        currentPage = 1;
        filterAndRender();
      });
    }

    if (filterTrack) {
      filterTrack.addEventListener('change', () => {
        activeTrackFilter = filterTrack.value;
        currentPage = 1;
        filterAndRender();
      });
    }

    if (healthChips) {
      healthChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
          activeHealthFilter = chip.dataset.health;
          updateHealthChipUI();
          currentPage = 1;
          filterAndRender();
        });
      });
    }

    // Sortable Headers
    document.querySelectorAll('.smart-table th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'asc';
        }
        document.querySelectorAll('.smart-table th').forEach(h => h.classList.remove('sorted'));
        th.classList.add('sorted');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = sortDirection === 'asc' ? '↑' : '↓';
        filterAndRender();
      });
    });

    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    filterAndRender();
  }

  function updateHealthChipUI() {
    const chips = document.querySelectorAll('#healthChips .chip');
    chips.forEach(chip => {
      if (chip.dataset.health === activeHealthFilter) chip.classList.add('active');
      else chip.classList.remove('active');
    });
  }

  function filterAndRender() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

    filteredLearners = DATA.learners.filter(l => {
      if (activeTrackFilter && l.track !== activeTrackFilter) return false;
      if (activeHealthFilter && l.unified_health !== activeHealthFilter) return false;
      if (search) {
        const text = `${l.full_name} ${l.email} ${l.phone}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    // Sorting
    filteredLearners.sort((a, b) => {
      let va = a[sortColumn];
      let vb = b[sortColumn];

      if (sortColumn === 'unified_health') {
        va = HEALTH_SORT_ORDER[va] ?? 99;
        vb = HEALTH_SORT_ORDER[vb] ?? 99;
      }

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      if (typeof va === 'boolean') {
        va = va ? 1 : 0;
        vb = vb ? 1 : 0;
      }

      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDirection === 'asc' ? va - vb : vb - va;
      }

      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return sortDirection === 'asc' ? -1 : 1;
      if (va > vb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    renderTable();
    renderPagination();
  }

  function renderTable() {
    const tbody = document.getElementById('learnerTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filteredLearners.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);">
              <div style="margin-bottom: 8px; color: var(--text-sub);">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div style="font-weight: 500; color: var(--text-main);">No matching learners found</div>
              <div style="font-size: 12px; margin-top: 4px;">Try searching for a different keyword or reset filters</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = page.map(l => {
      const healthClass = getHealthClass(l.unified_health);
      const trackClass = l.track === 'Cybersecurity' ? 'cs' : 'da';
      const scoreHtml = renderScore(l.lms_overall_score);
      const activatedHtml = l.is_enrollment_activated
        ? '<span style="color: var(--status-healthy); font-weight: 600;">Activated</span>'
        : '<span style="color: var(--text-muted);">Pending</span>';

      return `
        <tr>
          <td style="font-weight: 600;" title="${escapeHtml(l.full_name)}">${escapeHtml(l.full_name)}</td>
          <td><span class="track-tag ${trackClass}">${l.track === 'Cybersecurity' ? 'CS' : 'DA'}</span></td>
          <td>
            <div style="display: flex; flex-direction: column;">
              <a href="mailto:${escapeHtml(l.email)}" style="color: var(--text-accent); text-decoration: none; font-weight: 500;" title="Email learner">${escapeHtml(l.email)}</a>
              <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(l.phone || '-')}</span>
            </div>
          </td>
          <td>${scoreHtml}</td>
          <td>
            <span class="status-pill-badge ${healthClass}">
              <span class="status-badge-dot"></span>${l.unified_health}
            </span>
          </td>
          <td>${activatedHtml}</td>
          <td style="color: var(--text-sub); font-size: 11px;">${l.last_submission_date || '-'}</td>
        </tr>
      `;
    }).join('');

    const rc = document.getElementById('resultCount');
    if (rc) {
      rc.textContent = `Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, filteredLearners.length)} of ${filteredLearners.length} scholars`;
    }

    requestAnimationFrame(() => {
      Motion.fadeUp(tbody.querySelectorAll('tr'), { stagger: 0.025, duration: 0.25 });
    });
  }

  function renderPagination() {
    const totalPages = Math.ceil(filteredLearners.length / PAGE_SIZE);
    const pag = document.getElementById('pagination');
    if (!pag) return;

    if (totalPages <= 1) {
      pag.innerHTML = '';
      return;
    }

    let html = `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">‹</button>`;

    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">›</button>`;

    pag.innerHTML = html;

    pag.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page, 10);
        renderTable();
        renderPagination();
        document.getElementById('tableSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function getHealthClass(health) {
    switch (health) {
      case 'Healthy / On-Track': return 'healthy';
      case 'Needs Support': return 'support';
      case 'At Risk': return 'risk';
      case 'Un-onboarded / Inactive': return 'inactive';
      default: return 'inactive';
    }
  }

  function renderScore(score) {
    if (score == null) return '<span style="color: var(--text-muted);">-</span>';
    const color = score >= 70 ? 'var(--color-healthy)' : score >= 40 ? 'var(--color-support)' : 'var(--color-risk)';
    return `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-weight: 600; width: 36px;">${score}%</span>
        <div style="flex: 1; height: 4px; background: var(--bg-input); border-radius: 2px; overflow: hidden; width: 60px;">
          <div style="height: 100%; width: ${Math.min(score, 100)}%; background: ${color}; border-radius: 2px;"></div>
        </div>
      </div>
    `;
  }

  // CSV Export
  function exportCSV() {
    const headers = ['Name', 'Track', 'Email', 'Phone', 'LMS Score', 'Health Status', 'Activated', 'Last Active', 'Sponsorship'];
    const rows = filteredLearners.map(l => [
      l.full_name,
      l.track,
      l.email,
      l.phone || '',
      l.lms_overall_score != null ? `${l.lms_overall_score}%` : '',
      l.unified_health,
      l.is_enrollment_activated ? 'Yes' : 'No',
      l.last_submission_date || '',
      l.is_un_sponsored ? 'UN Women' : 'Other',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ALX_UN_Women_Learners_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Mode Switching (View vs Admin)
  function setupModeSwitch() {
    const viewBtn = document.getElementById('viewModeBtn');
    const adminBtn = document.getElementById('adminModeBtn');
    const adminBanner = document.getElementById('adminBanner');
    const resetBtn = document.getElementById('resetDataBtn');

    if (viewBtn && adminBtn) {
      viewBtn.addEventListener('click', () => setAdminMode(false));
      adminBtn.addEventListener('click', () => setAdminMode(true));
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset dashboard data to original default source file?')) {
          localStorage.removeItem('alx_unwomen_custom_data');
          DATA = DEFAULT_DATA;
          renderDashboard();
          showStatus('Dashboard reset to default data source', 'info');
        }
      });
    }
  }

  function setAdminMode(isAdmin) {
    const viewBtn = document.getElementById('viewModeBtn');
    const adminBtn = document.getElementById('adminModeBtn');
    const adminBanner = document.getElementById('adminBanner');

    if (isAdmin) {
      viewBtn?.classList.remove('active');
      adminBtn?.classList.add('active');
      adminBanner?.classList.remove('hidden');
      adminBanner?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      adminBtn?.classList.remove('active');
      viewBtn?.classList.add('active');
      adminBanner?.classList.add('hidden');
    }
  }

  // Drag & Drop Excel Processing with SheetJS
  function setupDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, preventDefaults, false);
      document.body.addEventListener(evt, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, () => dropzone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, () => dropzone.classList.remove('dragover'), false);
    });

    dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files), false);
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files), false);
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    if (typeof XLSX === 'undefined') {
      showStatus('SheetJS engine loading, please try again in a moment.', 'error');
      return;
    }

    showStatus(`Reading and normalizing ${files.length} Excel file(s)...`, 'info');

    let count = 0;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          parseExcelWorkbook(workbook, file.name);
          count++;
          if (count === files.length) {
            localStorage.setItem('alx_unwomen_custom_data', JSON.stringify(DATA));
            renderDashboard();
            showStatus(`Successfully parsed and synchronized metrics from ${files.length} file(s)!`, 'success');
          }
        } catch (err) {
          console.error(err);
          showStatus(`Error processing ${file.name}: ${err.message}`, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function parseExcelWorkbook(wb, filename) {
    const isCS = filename.includes('Cyber') || wb.SheetNames.some(s => s.includes('CS'));
    if (isCS) parseCSWorkbook(wb);
    else parseDAWorkbook(wb);
  }

  function parseCSWorkbook(wb) {
    const trackerSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('tracker')) || wb.SheetNames[0];
    const trackerSheet = wb.Sheets[trackerSheetName];
    if (!trackerSheet) return;

    const trackerRows = XLSX.utils.sheet_to_json(trackerSheet);
    if (trackerRows.length > 0) {
      const csLearnerMap = new Map();
      trackerRows.forEach(row => {
        const email = String(row['Email'] || '').trim().toLowerCase();
        if (!email) return;

        const rawHealth = String(row['Learner classification status'] || '').trim();
        const unifiedHealth = HEALTH_MAP_CS[rawHealth] || 'Un-onboarded / Inactive';

        if (!csLearnerMap.has(email)) {
          csLearnerMap.set(email, {
            track: 'Cybersecurity',
            email: email,
            full_name: String(row['Full name'] || '').trim(),
            phone: String(row['Phone number'] || '').trim(),
            country: String(row['Country of residence'] || '').trim(),
            cohort: String(row['Cohort name'] || '').trim(),
            has_lms_login: String(row['Has logged into LMS'] || '').toLowerCase() === 'yes',
            has_ehub_login: String(row['Has logged into ehub'] || '').toLowerCase() === 'yes',
            is_enrollment_activated: String(row['Is enrollment activated'] || '').toLowerCase() === 'yes',
            lms_overall_score: row['LMS overall score'] != null ? Math.round(parseFloat(row['LMS overall score']) * 10) / 10 : null,
            num_assignments_total: parseInt(row['No. of assignments'] || 0, 10),
            num_submissions: parseInt(row['No. of submissions'] || 0, 10),
            num_passed: parseInt(row['No. of assignment passed'] || 0, 10),
            assignments_accessed: 1,
            assignments_submitted: String(row['Is assignment submitted'] || '').toLowerCase() === 'yes' ? 1 : 0,
            assignments_passed: String(row['Is assignment passed'] || '').toLowerCase() === 'yes' ? 1 : 0,
            unified_health: unifiedHealth,
            raw_health: rawHealth,
            payment_status: 'UN Women Sponsored',
            is_un_sponsored: true,
            is_graduated: String(row['Is graduated on savannah'] || '').toLowerCase() === 'yes',
            last_submission_date: null
          });
        }
      });

      const nonCS = DATA.learners.filter(l => l.track !== 'Cybersecurity');
      DATA.learners = [...nonCS, ...Array.from(csLearnerMap.values())];
      recalculateKPIs();
    }
  }

  function parseDAWorkbook(wb) {
    const trackerSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('tracker') || s === 'DA') || wb.SheetNames[0];
    const trackerSheet = wb.Sheets[trackerSheetName];
    if (!trackerSheet) return;

    const trackerRows = XLSX.utils.sheet_to_json(trackerSheet);
    if (trackerRows.length > 0) {
      const daLearnerMap = new Map();
      trackerRows.forEach(row => {
        const email = String(row['Email'] || '').trim().toLowerCase();
        if (!email) return;

        const rawHealth = String(row['Learner health classification'] || '').trim();
        const unifiedHealth = HEALTH_MAP_DA[rawHealth] || 'Un-onboarded / Inactive';

        if (!daLearnerMap.has(email)) {
          daLearnerMap.set(email, {
            track: 'Data Analytics',
            email: email,
            full_name: `${row['First name'] || ''} ${row['Last name'] || ''}`.trim(),
            phone: String(row['Phone number'] || '').trim(),
            country: String(row['Country of residence'] || '').trim(),
            cohort: '',
            has_lms_login: String(row['Has logged into LMS'] || '').toLowerCase() === 'yes',
            has_ehub_login: String(row['Has logged into eHub'] || '').toLowerCase() === 'yes',
            is_enrollment_activated: String(row['Is enrollment activated'] || '').toLowerCase() === 'yes',
            lms_overall_score: null,
            num_assignments_total: 0,
            num_submissions: 0,
            num_passed: 0,
            assignments_accessed: 0,
            assignments_submitted: 0,
            assignments_passed: 0,
            unified_health: unifiedHealth,
            raw_health: rawHealth,
            payment_status: 'UN Women Sponsored',
            is_un_sponsored: true,
            is_graduated: String(row['Is graduated on savannah'] || '').toLowerCase() === 'yes',
            last_submission_date: null
          });
        }
      });

      const nonDA = DATA.learners.filter(l => l.track !== 'Data Analytics');
      DATA.learners = [...nonDA, ...Array.from(daLearnerMap.values())];
      recalculateKPIs();
    }
  }

  function recalculateKPIs() {
    const un = DATA.learners.filter(l => l.is_un_sponsored);
    DATA.kpis = {
      total_un_seats: 500,
      total_registered: un.length,
      cs_registered: un.filter(l => l.track === 'Cybersecurity').length,
      da_registered: un.filter(l => l.track === 'Data Analytics').length,
      total_lms_login: un.filter(l => l.has_lms_login).length,
      total_activated: un.filter(l => l.is_enrollment_activated).length,
      total_submitted: un.filter(l => l.assignments_submitted > 0).length,
      total_graduated: un.filter(l => l.is_graduated).length,
      total_healthy: un.filter(l => l.unified_health === 'Healthy / On-Track').length,
      total_needs_support: un.filter(l => l.unified_health === 'Needs Support').length,
      total_at_risk: un.filter(l => l.unified_health === 'At Risk').length,
      total_unonboarded: un.filter(l => l.unified_health === 'Un-onboarded / Inactive').length,
    };
    DATA.generated_at = new Date().toISOString();
  }

  function showStatus(msg, type) {
    const el = document.getElementById('uploadStatus');
    if (el) {
      el.className = `upload-feedback ${type}`;
      el.textContent = msg;
    }
  }

  // Theme Switcher
  function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    const container = document.getElementById('themeIconContainer');
    const html = document.documentElement;
    if (!toggle || !container) return;

    const saved = localStorage.getItem('dashboard-theme');
    if (saved) {
      html.setAttribute('data-theme', saved);
      container.innerHTML = saved === 'light' ? ICONS.sun : ICONS.moon;
    }

    toggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      container.innerHTML = next === 'light' ? ICONS.sun : ICONS.moon;
      localStorage.setItem('dashboard-theme', next);

      if (DATA) renderHealthChart();
    });
  }

  // Helpers
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

})();
