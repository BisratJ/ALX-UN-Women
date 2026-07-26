/**
 * ALX Enterprise x UN Women: Learner Operations & Analytics Dashboard Logic (v2.1)
 * ==========================================================================
 * - Content-Based Excel Program Detection (CS / DA auto-identification)
 * - Snapshot-based Dataset Versioning & Historical Version Control
 * - 2-Axis Learner Classification (Activation x Performance)
 * - Refined Learner Journey Funnel & Full-Width Methodology Layout
 * - Optimized DOM rendering (DocumentFragment, instant cache load, debouncing)
 */

(function () {
  'use strict';

  // State
  let DEFAULT_DATA = null;
  let DATA = null;
  let filteredLearners = [];
  let currentPage = 1;
  const PAGE_SIZE = 25;

  let sortColumn = 'activation_status';
  let sortDirection = 'asc';

  let activeActivationFilter = '';
  let activePerformanceFilter = '';
  let activeTrackFilter = '';
  let activeTimeFilter = '';
  let activeFunnelTrack = 'all';

  let healthChartInstance = null;
  let searchDebounceTimer = null;

  // Activation & Performance Sort Priority
  const ACTIVATION_SORT_ORDER = {
    'Not Activated': 0,
    'Activated': 1,
  };

  const PERFORMANCE_SORT_ORDER = {
    'Lagging Behind': 0,
    'On Track': 1,
    'N/A': 2,
  };

  // Static Admin Credentials
  const ADMIN_CREDS = {
    user: 'admin',
    pass: 'alx-unwomen@2026',
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
        { opacity: [0, 1], y: [16, 0] },
        { duration: opts.duration || 0.35, delay: stagger(opts.stagger || 0.04), easing: [0.22, 1, 0.36, 1] }
      );
    }

    function slideDown(els, opts = {}) {
      if (!animate || !els) return;
      const targets = typeof els === 'string' ? document.querySelectorAll(els) : els;
      if (!targets || targets.length === 0) return;
      animate(
        targets,
        { opacity: [0, 1], y: [-16, 0] },
        { duration: opts.duration || 0.35, easing: [0.22, 1, 0.36, 1] }
      );
    }

    function springIn(els, opts = {}) {
      if (!animate || !els) return;
      const targets = typeof els === 'string' ? document.querySelectorAll(els) : els;
      if (!targets || targets.length === 0) return;
      animate(
        targets,
        { opacity: [0, 1], scale: [0.95, 1], y: [8, 0] },
        { duration: opts.duration || 0.35, delay: stagger(opts.stagger || 0.04), easing: [0.22, 1, 0.36, 1] }
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
    setupMobileNav();
    setupDropzone();
    setupAdminLoginModal();
    setupVersionHistoryModal();
  });

  async function loadData() {
    try {
      const response = await fetch(`data.json?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      DEFAULT_DATA = await response.json();

      const cached = localStorage.getItem('alx_unwomen_custom_data');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // If cached data exists and is valid, use it; otherwise fallback to DEFAULT_DATA
          DATA = parsed && parsed.learners ? parsed : DEFAULT_DATA;
        } catch (e) {
          DATA = DEFAULT_DATA;
        }
      } else {
        DATA = DEFAULT_DATA;
      }

      ensureInitialSnapshot();
      renderDashboard();
      hideLoading();
    } catch (err) {
      console.error('Failed to load data.json:', err);
      if (!DATA) {
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
  }

  function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 300);
    }
  }

  function renderDashboard() {
    renderTimestamp();
    renderKPIs();
    renderFunnels();
    renderHealthChart();
    setupTable();
    setTimeout(() => {
      Motion.fadeUp('.section-block', { stagger: 0.08, duration: 0.4 });
    }, 50);
  }

  // Timestamp, Version Labels & Badges
  function renderTimestamp() {
    const ts = DATA.generated_at || new Date().toISOString();
    const date = new Date(ts);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) lastUpdatedEl.textContent = `Sync: ${formatted}`;

    const footerTs = document.getElementById('footerTimestamp');
    if (footerTs) footerTs.textContent = formatted;

    const versionTag = DATA.version || 'v1.0';
    const versionLabel = document.getElementById('versionLabel');
    if (versionLabel) versionLabel.textContent = `${versionTag} · Live Dataset`;

    const mobileVersionLabel = document.getElementById('mobileVersionLabel');
    if (mobileVersionLabel) mobileVersionLabel.textContent = `${versionTag} · Live Dataset`;

    const curVerTag = document.getElementById('currentVersionTag');
    if (curVerTag) curVerTag.textContent = `${versionTag} · Live Dataset`;

    const curVerTime = document.getElementById('currentVersionTime');
    if (curVerTime) curVerTime.textContent = formatted;

    const totalBadge = document.getElementById('totalLearnersBadge');
    if (totalBadge && DATA.kpis) totalBadge.textContent = DATA.kpis.total_registered || 511;
  }

  // KPI Cards Grid (Revised 6 KPIs)
  function renderKPIs() {
    const k = DATA.kpis;
    const reg = k.total_registered || 1;

    const onboardingRate = ((k.total_lms_onboarded / reg) * 100).toFixed(1);
    const activationRate = ((k.total_activated / reg) * 100).toFixed(1);
    const onTrackRate = ((k.total_on_track / reg) * 100).toFixed(1);
    const notActivatedRate = ((k.total_not_activated / reg) * 100).toFixed(1);
    const laggingRate = ((k.total_lagging_behind / reg) * 100).toFixed(1);

    const kpis = [
      {
        id: 'kpi-seats',
        label: 'UN Sponsored Seats',
        value: k.total_un_seats,
        detail: `${k.total_registered} scholars registered`,
        color: 'blue',
        icon: ICONS.target,
        filterActivation: '',
        filterPerformance: '',
      },
      {
        id: 'kpi-onboarded',
        label: 'LMS Onboarded',
        value: k.total_lms_onboarded,
        detail: `${onboardingRate}% onboarding rate`,
        color: 'blue',
        icon: ICONS.key,
        filterActivation: '',
        filterPerformance: '',
      },
      {
        id: 'kpi-activated',
        label: 'Activated',
        value: k.total_activated,
        detail: `${activationRate}% activation rate`,
        color: 'green',
        icon: ICONS.zap,
        filterActivation: 'Activated',
        filterPerformance: '',
      },
      {
        id: 'kpi-ontrack',
        label: 'On Track',
        value: k.total_on_track,
        detail: `${onTrackRate}% meeting targets`,
        color: 'blue',
        icon: ICONS.check,
        filterActivation: '',
        filterPerformance: 'On Track',
      },
      {
        id: 'kpi-not-activated',
        label: 'Not Activated',
        value: k.total_not_activated,
        detail: `${notActivatedRate}% pending activation`,
        color: 'red',
        icon: ICONS.minus,
        filterActivation: 'Not Activated',
        filterPerformance: '',
      },
      {
        id: 'kpi-lagging',
        label: 'Lagging Behind',
        value: k.total_lagging_behind,
        detail: `${laggingRate}% outreach targets`,
        color: 'orange',
        icon: ICONS.alert,
        filterActivation: '',
        filterPerformance: 'Lagging Behind',
      },
    ];

    const grid = document.getElementById('kpiGrid');
    if (!grid) return;

    grid.innerHTML = kpis.map(kpi => `
      <div class="kpi-smart-card kpi-${kpi.color}" id="${kpi.id}" data-act="${kpi.filterActivation}" data-perf="${kpi.filterPerformance}">
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
          activeActivationFilter = kpi.filterActivation;
          activePerformanceFilter = kpi.filterPerformance;
          updateChipUI();
          currentPage = 1;
          filterAndRender();
          document.getElementById('tableSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    });

    requestAnimationFrame(() => {
      Motion.springIn('.kpi-smart-card', { stagger: 0.04, duration: 0.35 });
    });
    animateCounters();
  }

  function animateCounters() {
    document.querySelectorAll('.kpi-value-num[data-target]').forEach(el => {
      const target = parseInt(el.dataset.target, 10) || 0;
      const duration = 800;
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

  // Refined Funnel Analytics (Generous Spacing & Conversion Rates)
  function renderFunnels() {
    const funnelDisplay = document.getElementById('funnelDisplay');
    const trackTabs = document.getElementById('funnelTrackTabs');
    if (!funnelDisplay) return;

    if (trackTabs) {
      trackTabs.querySelectorAll('.pill-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          trackTabs.querySelectorAll('.pill-tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
          });
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
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

    let funnelData = { un_sponsored_seats: 0, lms_onboarded: 0, activated: 0, on_track: 0, not_activated: 0, lagging_behind: 0 };

    if (activeFunnelTrack === 'cs') {
      funnelData = DATA.funnels.cs || funnelData;
    } else if (activeFunnelTrack === 'da') {
      funnelData = DATA.funnels.da || funnelData;
    } else {
      const cs = DATA.funnels.cs || {};
      const da = DATA.funnels.da || {};
      funnelData = {
        un_sponsored_seats: (cs.un_sponsored_seats || 0) + (da.un_sponsored_seats || 0),
        lms_onboarded: (cs.lms_onboarded || 0) + (da.lms_onboarded || 0),
        activated: (cs.activated || 0) + (da.activated || 0),
        on_track: (cs.on_track || 0) + (da.on_track || 0),
        not_activated: (cs.not_activated || 0) + (da.not_activated || 0),
        lagging_behind: (cs.lagging_behind || 0) + (da.lagging_behind || 0),
      };
    }

    const maxVal = funnelData.un_sponsored_seats || 1;

    const steps = [
      { label: 'UN Sponsored Seats', val: funnelData.un_sponsored_seats },
      { label: 'LMS Onboarded', val: funnelData.lms_onboarded },
      { label: 'Activated Scholars', val: funnelData.activated },
      { label: 'On Track Scholars', val: funnelData.on_track },
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
      Motion.fadeUp(funnelDisplay.querySelectorAll('.funnel-row-item'), { stagger: 0.05, duration: 0.3 });
      setTimeout(() => {
        if (Motion.available) {
          funnelDisplay.querySelectorAll('.funnel-track-bar-fill').forEach((bar, i) => {
            const targetWidth = bar.dataset.width;
            bar.style.width = '0%';
            setTimeout(() => {
              window.Motion.animate(bar, { width: targetWidth }, {
                duration: 0.5,
                delay: i * 0.04,
                easing: [0.22, 1, 0.36, 1],
              });
            }, 40);
          });
        } else {
          funnelDisplay.querySelectorAll('.funnel-track-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width;
          });
        }
      }, 80);
    });
  }

  // Classification Chart (Theme-Aware Doughnut for Activation + Performance)
  function renderHealthChart() {
    const canvas = document.getElementById('healthChartOverall');
    const legendList = document.getElementById('healthLegendList');
    if (!canvas) return;

    const classObj = {
      'Activated': DATA.kpis.total_activated || 0,
      'Not Activated': DATA.kpis.total_not_activated || 0,
      'On Track': DATA.kpis.total_on_track || 0,
      'Lagging Behind': DATA.kpis.total_lagging_behind || 0,
    };

    const total = DATA.kpis.total_registered || 511;
    const centerEl = document.getElementById('chartCenterTotal');
    if (centerEl) centerEl.textContent = total;

    const labels = Object.keys(classObj);
    const dataValues = Object.values(classObj);
    
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    // Theme-Aware Classification Palette
    const colors = isDark 
      ? ['#4ADE80', '#94A3B8', '#60A5FA', '#FACC15']
      : ['#047857', '#475569', '#2563EB', '#B45309'];

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
          animation: { animateRotate: true, duration: 500 },
        },
      });
    }
  }

  // Table Directory & Filters (Optimized Debounce & Fast DOM Render)
  function setupTable() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const filterTrack = document.getElementById('filterTrack');
    const filterTime = document.getElementById('filterTime');
    const activationChips = document.getElementById('activationChips');
    const performanceChips = document.getElementById('performanceChips');
    const exportBtn = document.getElementById('exportCsvBtn');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        if (clearSearchBtn) {
          if (searchInput.value.trim().length > 0) clearSearchBtn.classList.remove('hidden');
          else clearSearchBtn.classList.add('hidden');
        }
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          currentPage = 1;
          filterAndRender();
        }, 120);
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

    if (filterTime) {
      filterTime.addEventListener('change', () => {
        activeTimeFilter = filterTime.value;
        currentPage = 1;
        filterAndRender();
      });
    }

    if (activationChips) {
      activationChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
          activeActivationFilter = chip.dataset.activation;
          updateChipUI();
          currentPage = 1;
          filterAndRender();
        });
      });
    }

    if (performanceChips) {
      performanceChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
          activePerformanceFilter = chip.dataset.performance;
          updateChipUI();
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
        document.querySelectorAll('.smart-table th').forEach(h => {
          h.classList.remove('sorted');
          h.setAttribute('aria-sort', 'none');
        });
        th.classList.add('sorted');
        th.setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.innerHTML = sortDirection === 'asc' ? '&#8593;' : '&#8595;';
        filterAndRender();
      });
    });

    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    filterAndRender();
  }

  function updateChipUI() {
    const actChips = document.querySelectorAll('#activationChips .chip');
    actChips.forEach(chip => {
      const match = chip.dataset.activation === activeActivationFilter;
      chip.classList.toggle('active', match);
      chip.setAttribute('aria-checked', match ? 'true' : 'false');
    });

    const perfChips = document.querySelectorAll('#performanceChips .chip');
    perfChips.forEach(chip => {
      const match = chip.dataset.performance === activePerformanceFilter;
      chip.classList.toggle('active', match);
      chip.setAttribute('aria-checked', match ? 'true' : 'false');
    });
  }

  function filterAndRender() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

    // Determine max submission timestamp in dataset for relative time window calculations
    let maxTimestamp = 0;
    if (activeTimeFilter && activeTimeFilter !== 'inactive' && DATA && DATA.learners) {
      DATA.learners.forEach(l => {
        if (l.last_submission_date && l.last_submission_date !== '-') {
          const t = new Date(l.last_submission_date).getTime();
          if (!isNaN(t) && t > maxTimestamp) maxTimestamp = t;
        }
      });
      if (maxTimestamp === 0) maxTimestamp = Date.now();
    }

    filteredLearners = DATA.learners.filter(l => {
      if (activeTrackFilter && l.track !== activeTrackFilter) return false;
      if (activeActivationFilter && l.activation_status !== activeActivationFilter) return false;
      if (activePerformanceFilter && l.performance_status !== activePerformanceFilter) return false;

      if (activeTimeFilter) {
        if (activeTimeFilter === 'inactive') {
          if (l.last_submission_date && l.last_submission_date !== '-' && (l.num_submissions || 0) > 0) return false;
        } else {
          const daysLimit = parseInt(activeTimeFilter, 10);
          if (!l.last_submission_date || l.last_submission_date === '-') return false;
          const subTime = new Date(l.last_submission_date).getTime();
          if (isNaN(subTime)) return false;
          const diffDays = (maxTimestamp - subTime) / (1000 * 60 * 60 * 24);
          if (diffDays > daysLimit) return false;
        }
      }

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

      if (sortColumn === 'activation_status') {
        va = ACTIVATION_SORT_ORDER[va] ?? 99;
        vb = ACTIVATION_SORT_ORDER[vb] ?? 99;
      } else if (sortColumn === 'performance_status') {
        va = PERFORMANCE_SORT_ORDER[va] ?? 99;
        vb = PERFORMANCE_SORT_ORDER[vb] ?? 99;
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

  // Fast Table Render using DocumentFragment
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

    const fragment = document.createDocumentFragment();
    const tempContainer = document.createElement('tbody');

    tempContainer.innerHTML = page.map(l => {
      const actBadgeClass = l.activation_status === 'Activated' ? 'activated' : 'not-activated';
      const perfBadgeClass = l.performance_status === 'On Track' ? 'on-track' : l.performance_status === 'Lagging Behind' ? 'lagging' : 'na';
      const trackClass = l.track === 'Cybersecurity' ? 'cs' : 'da';
      const scoreHtml = renderScore(l.lms_overall_score);

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
            <span class="status-pill-badge ${actBadgeClass}">
              <span class="status-badge-dot"></span>${l.activation_status}
            </span>
          </td>
          <td>
            <span class="status-pill-badge ${perfBadgeClass}">
              <span class="status-badge-dot"></span>${l.performance_status}
            </span>
          </td>
          <td style="color: var(--text-sub); font-size: 11px;">${l.last_submission_date || '-'}</td>
        </tr>
      `;
    }).join('');

    while (tempContainer.firstChild) {
      fragment.appendChild(tempContainer.firstChild);
    }

    tbody.innerHTML = '';
    tbody.appendChild(fragment);

    const rc = document.getElementById('resultCount');
    if (rc) {
      rc.textContent = `Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, filteredLearners.length)} of ${filteredLearners.length} scholars`;
    }

    requestAnimationFrame(() => {
      Motion.fadeUp(tbody.querySelectorAll('tr'), { stagger: 0.02, duration: 0.2 });
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

    let html = `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" aria-label="Previous page">‹</button>`;

    const maxButtons = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" aria-label="Next page">›</button>`;

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

  function renderScore(score) {
    if (score == null) return '<span style="color: var(--text-muted);">-</span>';
    const color = score >= 70 ? 'var(--status-activated)' : score >= 40 ? 'var(--status-lagging)' : 'var(--status-not-activated)';
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
    const headers = ['Name', 'Track', 'Email', 'Phone', 'LMS Score', 'Activation Status', 'Performance Status', 'Last Active', 'Sponsorship'];
    const rows = filteredLearners.map(l => [
      l.full_name,
      l.track,
      l.email,
      l.phone || '',
      l.lms_overall_score != null ? `${l.lms_overall_score}%` : '',
      l.activation_status,
      l.performance_status,
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

  // Mode Switching & Mobile Navigation
  function setupModeSwitch() {
    const viewBtn = document.getElementById('viewModeBtn');
    const adminBtn = document.getElementById('adminModeBtn');
    const mobileViewBtn = document.getElementById('mobileViewModeBtn');
    const mobileAdminBtn = document.getElementById('mobileAdminModeBtn');
    const resetBtn = document.getElementById('resetDataBtn');
    const openVerBtn = document.getElementById('openVersionModalBtn');

    function handleViewClick() {
      setAdminMode(false);
      closeMobileNav();
    }

    function handleAdminClick() {
      if (sessionStorage.getItem('admin_authenticated') === 'true') {
        setAdminMode(true);
      } else {
        showAdminLoginModal();
      }
      closeMobileNav();
    }

    if (viewBtn) viewBtn.addEventListener('click', handleViewClick);
    if (adminBtn) adminBtn.addEventListener('click', handleAdminClick);
    if (mobileViewBtn) mobileViewBtn.addEventListener('click', handleViewClick);
    if (mobileAdminBtn) mobileAdminBtn.addEventListener('click', handleAdminClick);

    if (openVerBtn) {
      openVerBtn.addEventListener('click', () => showVersionHistoryModal());
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset dashboard data to original default source file?')) {
          localStorage.removeItem('alx_unwomen_custom_data');
          DATA = DEFAULT_DATA;
          saveSnapshot('v1.0 Baseline', 'Default System Restore');
          renderDashboard();
          showStatus('Dashboard reset to default baseline data', 'info');
        }
      });
    }
  }

  function closeMobileNav() {
    const menu = document.getElementById('mobileNavMenu');
    const toggleBtn = document.getElementById('hamburgerToggleBtn');
    if (!menu) return;
    menu.classList.add('hidden');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.querySelector('.hamburger-icon-open')?.classList.remove('hidden');
      toggleBtn.querySelector('.hamburger-icon-close')?.classList.add('hidden');
    }
  }

  function setupMobileNav() {
    const toggleBtn = document.getElementById('hamburgerToggleBtn');
    const menu = document.getElementById('mobileNavMenu');
    const mobileVersionPill = document.getElementById('mobileHeaderVersionPill');
    if (!toggleBtn || !menu) return;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = menu.classList.contains('hidden');
      if (isHidden) {
        menu.classList.remove('hidden');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.querySelector('.hamburger-icon-open')?.classList.add('hidden');
        toggleBtn.querySelector('.hamburger-icon-close')?.classList.remove('hidden');
      } else {
        closeMobileNav();
      }
    });

    if (mobileVersionPill) {
      mobileVersionPill.addEventListener('click', () => {
        showVersionHistoryModal();
        closeMobileNav();
      });
    }

    document.addEventListener('click', (e) => {
      if (!menu.classList.contains('hidden')) {
        const header = document.querySelector('.top-header');
        if (header && !header.contains(e.target)) {
          closeMobileNav();
        }
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        closeMobileNav();
      }
    });
  }

  function setupAdminLoginModal() {
    const modal = document.getElementById('adminLoginModal');
    const closeBtn = document.getElementById('loginModalClose');
    const cancelBtn = document.getElementById('loginCancelBtn');
    const submitBtn = document.getElementById('loginSubmitBtn');
    const usernameInput = document.getElementById('adminUsername');
    const passwordInput = document.getElementById('adminPassword');
    const errorEl = document.getElementById('loginError');

    if (!modal) return;

    function hideModal() {
      modal.classList.add('hidden');
      if (errorEl) errorEl.classList.add('hidden');
      if (usernameInput) usernameInput.value = '';
      if (passwordInput) passwordInput.value = '';
    }

    function attemptLogin() {
      const u = (usernameInput?.value || '').trim();
      const p = (passwordInput?.value || '').trim();

      if (u === ADMIN_CREDS.user && p === ADMIN_CREDS.pass) {
        sessionStorage.setItem('admin_authenticated', 'true');
        hideModal();
        setAdminMode(true);
      } else {
        if (errorEl) {
          errorEl.textContent = 'Invalid username or password.';
          errorEl.classList.remove('hidden');
        }
      }
    }

    if (closeBtn) closeBtn.addEventListener('click', hideModal);
    if (cancelBtn) cancelBtn.addEventListener('click', hideModal);
    if (submitBtn) submitBtn.addEventListener('click', attemptLogin);

    [usernameInput, passwordInput].forEach(input => {
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') attemptLogin();
        });
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) hideModal();
    });
  }

  function showAdminLoginModal() {
    const modal = document.getElementById('adminLoginModal');
    const usernameInput = document.getElementById('adminUsername');
    if (modal) {
      modal.classList.remove('hidden');
      setTimeout(() => usernameInput?.focus(), 100);
    }
  }

  function setAdminMode(isAdmin) {
    const viewBtn = document.getElementById('viewModeBtn');
    const adminBtn = document.getElementById('adminModeBtn');
    const mobileViewBtn = document.getElementById('mobileViewModeBtn');
    const mobileAdminBtn = document.getElementById('mobileAdminModeBtn');
    const adminBanner = document.getElementById('adminBanner');

    if (isAdmin) {
      viewBtn?.classList.remove('active');
      mobileViewBtn?.classList.remove('active');
      adminBtn?.classList.add('active');
      mobileAdminBtn?.classList.add('active');
      adminBanner?.classList.remove('hidden');
      adminBanner?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      adminBtn?.classList.remove('active');
      mobileAdminBtn?.classList.remove('active');
      viewBtn?.classList.add('active');
      mobileViewBtn?.classList.add('active');
      adminBanner?.classList.add('hidden');
    }
  }

  // =========================================================================
  // DATA VERSIONING & HISTORICAL SNAPSHOT SYSTEM
  // =========================================================================

  function getSnapshots() {
    try {
      const raw = localStorage.getItem('alx_unwomen_snapshots');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSnapshot(label = 'Manual Snapshot', source = 'Admin System') {
    if (!DATA) return;
    const snapshots = getSnapshots();
    
    // Auto-increment version tag
    const versionNum = (snapshots.length + 1.0).toFixed(1);
    const versionTag = `v${versionNum}`;
    DATA.version = versionTag;

    const snap = {
      id: `snap_${Date.now()}`,
      version: versionTag,
      timestamp: new Date().toISOString(),
      label: label,
      source: source,
      kpis: { ...DATA.kpis },
      data: typeof structuredClone === 'function' ? structuredClone(DATA) : JSON.parse(JSON.stringify(DATA)),
    };

    snapshots.unshift(snap);
    // Keep last 15 snapshots
    if (snapshots.length > 15) snapshots.pop();

    try {
      localStorage.setItem('alx_unwomen_snapshots', JSON.stringify(snapshots));
      localStorage.setItem('alx_unwomen_custom_data', JSON.stringify(DATA));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for snapshot save.');
    }
  }

  function ensureInitialSnapshot() {
    const snapshots = getSnapshots();
    if (snapshots.length === 0 && DATA) {
      saveSnapshot('v1.0 Baseline', 'Default System Import');
    }
  }

  function setupVersionHistoryModal() {
    const modal = document.getElementById('versionHistoryModal');
    const closeBtn = document.getElementById('versionModalClose');
    const doneBtn = document.getElementById('closeVersionModalBtn');
    const createBtn = document.getElementById('createSnapshotBtn');

    if (!modal) return;

    function hide() {
      modal.classList.add('hidden');
    }

    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (doneBtn) doneBtn.addEventListener('click', hide);
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        saveSnapshot('Admin Manual Snapshot', 'User Action');
        renderSnapshotTable();
        renderTimestamp();
        showStatus('New data snapshot created successfully!', 'success');
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) hide();
    });
  }

  function showVersionHistoryModal() {
    const modal = document.getElementById('versionHistoryModal');
    if (!modal) return;

    renderSnapshotTable();
    modal.classList.remove('hidden');
  }

  function renderSnapshotTable() {
    const tbody = document.getElementById('snapshotsTableBody');
    if (!tbody) return;

    const snapshots = getSnapshots();

    if (snapshots.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No historical snapshots saved.</td></tr>`;
      return;
    }

    tbody.innerHTML = snapshots.map(snap => {
      const isCurrent = (DATA && DATA.version === snap.version);
      const dateStr = new Date(snap.timestamp).toLocaleString();
      const scholars = snap.kpis.total_registered || 0;
      const act = snap.kpis.total_activated || 0;

      return `
        <tr style="${isCurrent ? 'background: var(--bg-card-hover); font-weight: 600;' : ''}">
          <td>
            <span class="version-tag-pill">${snap.version} ${isCurrent ? '✓ Active' : ''}</span>
          </td>
          <td>${escapeHtml(snap.label)} <span style="font-size: 10px; color: var(--text-muted);">(${escapeHtml(snap.source)})</span></td>
          <td style="font-size: 11px; color: var(--text-sub);">${dateStr}</td>
          <td>${scholars}</td>
          <td><span style="color: var(--status-activated);">${act}</span></td>
          <td>
            <div style="display: flex; gap: 4px;">
              ${!isCurrent ? `<button class="btn btn-outline" onclick="window.restoreSnapshot('${snap.id}')" style="padding: 2px 6px; font-size: 10px;">Restore</button>` : ''}
              <button class="btn btn-outline" onclick="window.compareSnapshot('${snap.id}')" style="padding: 2px 6px; font-size: 10px;">Compare</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Global helper functions attached to window for table onclick handlers
  window.restoreSnapshot = function (snapId) {
    const snapshots = getSnapshots();
    const snap = snapshots.find(s => s.id === snapId);
    if (!snap) return;

    if (confirm(`Restore snapshot version ${snap.version} (${snap.label})?`)) {
      DATA = JSON.parse(JSON.stringify(snap.data));
      localStorage.setItem('alx_unwomen_custom_data', JSON.stringify(DATA));
      renderDashboard();
      showVersionHistoryModal();
      showStatus(`Restored data snapshot to ${snap.version}!`, 'success');
    }
  };

  window.compareSnapshot = function (snapId) {
    const snapshots = getSnapshots();
    const snap = snapshots.find(s => s.id === snapId);
    const drawer = document.getElementById('compareDrawer');
    const grid = document.getElementById('compareGrid');
    if (!snap || !drawer || !grid) return;

    const curK = DATA.kpis;
    const oldK = snap.kpis;

    const diffReg = curK.total_registered - oldK.total_registered;
    const diffAct = curK.total_activated - oldK.total_activated;
    const diffOnTrack = curK.total_on_track - oldK.total_on_track;

    grid.innerHTML = `
      <div class="compare-stat-card">
        <div class="compare-stat-label">Version Target</div>
        <div class="compare-stat-val">${snap.version} <span style="font-size: 10px; font-weight: normal;">vs ${DATA.version || 'v1.0'}</span></div>
      </div>
      <div class="compare-stat-card">
        <div class="compare-stat-label">Scholars Delta</div>
        <div class="compare-stat-val">${curK.total_registered} <span class="compare-delta ${diffReg >= 0 ? 'delta-pos' : 'delta-neg'}">${diffReg >= 0 ? '+' : ''}${diffReg}</span></div>
      </div>
      <div class="compare-stat-card">
        <div class="compare-stat-label">Activated Delta</div>
        <div class="compare-stat-val">${curK.total_activated} <span class="compare-delta ${diffAct >= 0 ? 'delta-pos' : 'delta-neg'}">${diffAct >= 0 ? '+' : ''}${diffAct}</span></div>
      </div>
      <div class="compare-stat-card">
        <div class="compare-stat-label">On Track Delta</div>
        <div class="compare-stat-val">${curK.total_on_track} <span class="compare-delta ${diffOnTrack >= 0 ? 'delta-pos' : 'delta-neg'}">${diffOnTrack >= 0 ? '+' : ''}${diffOnTrack}</span></div>
      </div>
    `;

    drawer.classList.remove('hidden');
  };

  // =========================================================================
  // CONTENT-BASED FILE UPLOAD & PARTIAL UPDATE SYSTEM
  // =========================================================================

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

    showStatus(`Analyzing and parsing ${files.length} file(s)...`, 'info');

    let processedCount = 0;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Content-based program auto-detection
          const programType = detectProgramType(workbook);
          if (programType === 'UNKNOWN') {
            showStatus(`Error processing ${file.name}: Unable to recognize CS or DA sheet structure. Check file columns.`, 'error');
            return;
          }

          if (programType === 'CS') {
            parseCSWorkbook(workbook);
            showStatus(`Successfully parsed Cybersecurity data from ${file.name}!`, 'success');
          } else if (programType === 'DA') {
            parseDAWorkbook(workbook);
            showStatus(`Successfully parsed Data Analytics data from ${file.name}!`, 'success');
          }

          processedCount++;
          if (processedCount === files.length) {
            saveSnapshot(`Upload: ${programType} Update`, `File Upload (${files.length} file)`);
            renderDashboard();
          }
        } catch (err) {
          console.error(err);
          showStatus(`Error processing ${file.name}: ${err.message}`, 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  // Content-Based Detection (Filename-Agnostic)
  function detectProgramType(wb) {
    const sheets = wb.SheetNames.map(s => s.toLowerCase());

    // Check Sheet Names
    if (sheets.some(s => s.includes('cyber') || s.includes('cs'))) return 'CS';
    if (sheets.some(s => s.includes('data analytic') || s === 'da')) return 'DA';

    // Fallback: Inspect headers of first sheet
    try {
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      if (json && json.length > 0) {
        const headers = (json[0] || []).map(h => String(h).toLowerCase());
        if (headers.includes('lms overall score') || headers.includes('cohort name')) return 'CS';
        if (headers.includes('ehub class name') || headers.includes('course status (lms)')) return 'DA';
      }
    } catch (e) {
      // ignore
    }

    return 'UNKNOWN';
  }

  function parseCSWorkbook(wb) {
    const trackerSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('tracker') || s.toLowerCase().includes('cs')) || wb.SheetNames[0];
    const trackerSheet = wb.Sheets[trackerSheetName];
    if (!trackerSheet) return;

    const trackerRows = XLSX.utils.sheet_to_json(trackerSheet);
    if (trackerRows.length > 0) {
      const csLearnerMap = new Map();
      trackerRows.forEach(row => {
        const email = String(row['Email'] || '').trim().toLowerCase();
        if (!email) return;

        const lmsScore = row['LMS overall score'] != null ? Math.round(parseFloat(row['LMS overall score']) * 10) / 10 : null;
        const activationStatus = (lmsScore != null && lmsScore > 0) ? 'Activated' : 'Not Activated';
        let performanceStatus = 'N/A';
        if (activationStatus === 'Activated' && lmsScore != null) {
          performanceStatus = lmsScore > 50 ? 'On Track' : 'Lagging Behind';
        }

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
            lms_overall_score: lmsScore,
            num_assignments_total: parseInt(row['No. of assignments'] || 0, 10),
            num_submissions: parseInt(row['No. of submissions'] || 0, 10),
            num_passed: parseInt(row['No. of assignment passed'] || 0, 10),
            assignments_accessed: 1,
            assignments_submitted: String(row['Is assignment submitted'] || '').toLowerCase() === 'yes' ? 1 : 0,
            assignments_passed: String(row['Is assignment passed'] || '').toLowerCase() === 'yes' ? 1 : 0,
            activation_status: activationStatus,
            performance_status: performanceStatus,
            raw_health: String(row['Learner classification status'] || '').trim(),
            payment_status: 'UN Women Sponsored',
            is_un_sponsored: true,
            is_graduated: String(row['Is graduated on savannah'] || '').toLowerCase() === 'yes',
            last_submission_date: null
          });
        }
      });

      // Partial Update: Replace CS learners, preserve DA learners!
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

        const isEA = String(row['Is enrollment activated'] || '').toLowerCase() === 'yes';
        const courseStatus = String(row['Course status (LMS)'] || '').trim().toLowerCase();
        const ehubClass = String(row['eHub class name'] || '').trim();
        const numSubmissions = parseInt(row['No. of submissions'] || 0, 10);

        const activationStatus = (isEA && courseStatus === 'validated') ? 'Activated' : isEA ? 'Activated' : 'Not Activated';
        let performanceStatus = 'N/A';
        if (activationStatus === 'Activated') {
          if (numSubmissions >= 3 && ehubClass === 'DA-3_rolling') performanceStatus = 'On Track';
          else if (numSubmissions >= 3) performanceStatus = 'On Track';
          else performanceStatus = 'Lagging Behind';
        }

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
            is_enrollment_activated: isEA,
            lms_overall_score: null,
            num_assignments_total: 0,
            num_submissions: numSubmissions,
            num_passed: 0,
            assignments_accessed: 0,
            assignments_submitted: numSubmissions,
            assignments_passed: 0,
            activation_status: activationStatus,
            performance_status: performanceStatus,
            raw_health: String(row['Learner health classification'] || '').trim(),
            payment_status: 'UN Women Sponsored',
            is_un_sponsored: true,
            is_graduated: String(row['Is graduated on savannah'] || '').toLowerCase() === 'yes',
            last_submission_date: null
          });
        }
      });

      // Partial Update: Replace DA learners, preserve CS learners!
      const nonDA = DATA.learners.filter(l => l.track !== 'Data Analytics');
      DATA.learners = [...nonDA, ...Array.from(daLearnerMap.values())];
      recalculateKPIs();
    }
  }

  function recalculateKPIs() {
    const un = DATA.learners.filter(l => l.is_un_sponsored);
    const cs = un.filter(l => l.track === 'Cybersecurity');
    const da = un.filter(l => l.track === 'Data Analytics');

    DATA.kpis = {
      total_un_seats: 500,
      total_registered: un.length,
      cs_registered: cs.length,
      da_registered: da.length,
      total_lms_onboarded: un.filter(l => l.has_lms_login).length,
      total_activated: un.filter(l => l.activation_status === 'Activated').length,
      total_not_activated: un.filter(l => l.activation_status === 'Not Activated').length,
      total_on_track: un.filter(l => l.performance_status === 'On Track').length,
      total_lagging_behind: un.filter(l => l.performance_status === 'Lagging Behind').length,
      total_performance_na: un.filter(l => l.performance_status === 'N/A').length,
      total_graduated: un.filter(l => l.is_graduated).length,
    };

    DATA.funnels = {
      cs: {
        un_sponsored_seats: cs.length,
        lms_onboarded: cs.filter(l => l.has_lms_login).length,
        activated: cs.filter(l => l.activation_status === 'Activated').length,
        on_track: cs.filter(l => l.performance_status === 'On Track').length,
        not_activated: cs.filter(l => l.activation_status === 'Not Activated').length,
        lagging_behind: cs.filter(l => l.performance_status === 'Lagging Behind').length,
      },
      da: {
        un_sponsored_seats: da.length,
        lms_onboarded: da.filter(l => l.has_lms_login).length,
        activated: da.filter(l => l.activation_status === 'Activated').length,
        on_track: da.filter(l => l.performance_status === 'On Track').length,
        not_activated: da.filter(l => l.activation_status === 'Not Activated').length,
        lagging_behind: da.filter(l => l.performance_status === 'Lagging Behind').length,
      },
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

  // Helpers — fast string-based escapeHtml (no DOM allocation per call)
  const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const _escapeRe = /[&<>"']/g;
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(_escapeRe, ch => _escapeMap[ch]);
  }

})();
