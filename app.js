/**
 * ALX Enterprise x UN Women: Learner Operations & Analytics Dashboard (v4.0)
 * ==========================================================================
 * - Dual CSV upload workflow (CS & DA summary ingestion)
 * - File validation with strict schema checks
 * - Dataset version snapshots and restore (localStorage)
 * - Program filtering (Combined / CS / DA views)
 * - Accessible, fast UI (DocumentFragment rendering, Chart.js, Motion One)
 */

(function () {
  'use strict';

  // Storage Keys
  const STORAGE_CUSTOM_DATA = 'alx_unwomen_custom_data_v3';
  const STORAGE_SNAPSHOTS = 'alx_unwomen_snapshots_v3';
  const STORAGE_ACTIVE = 'alx_unwomen_active_snapshot_v3';

  // Id of the snapshot currently loaded as the active dataset
  let activeSnapshotId = null;

  // Registered cohort sizes (fixed enrolment totals per program)
  const REGISTERED_TOTALS = { cs: 185, da: 325, combined: 510 };

  // Global Dashboard State
  let DATA = null; // Active dataset object
  let filteredLearners = [];
  let currentPage = 1;
  const PAGE_SIZE = 25;

  let activeProgramView = 'all'; // 'all', 'cs', 'da'
  let activeActivationFilter = '';
  let activePerformanceFilter = '';
  let activeTrackFilter = '';

  let sortColumn = 'email';
  let sortDirection = 'asc';

  let healthChartInstance = null;
  let searchDebounceTimer = null;

  // Staged Upload Slots State
  let stagedCS = null; // { filename, rows }
  let stagedDA = null; // { filename, rows }

  // Admin Authentication State
  const ADMIN_CREDS = {
    user: 'admin',
    pass: 'alx-unwomen@2026',
  };

  // SVG Icons Registry
  const ICONS = {
    target: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    zap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    alert: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    minus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    moon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    sun: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M18.36 5.64l1.41-1.41"/></svg>`,
  };

  // Motion Animation Helper Wrappers
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

  // DOM Initialization
  document.addEventListener('DOMContentLoaded', () => {
    Motion.slideDown('.top-header');
    setupThemeToggle();
    setupModeSwitch();
    setupMobileNav();
    setupDualUpload();
    setupProgramTabs();
    setupAdminLoginModal();
    setupVersionHistoryModal();

    // Load active data from localStorage or show initial state
    loadActiveDataset();
  });

  // =========================================================================
  // DATA LOADING & PERSISTENCE
  // =========================================================================

  function loadActiveDataset() {
    try {
      const cached = localStorage.getItem(STORAGE_CUSTOM_DATA);
      if (cached) {
        DATA = JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached dataset from localStorage', e);
    }

    activeSnapshotId = localStorage.getItem(STORAGE_ACTIVE) || null;

    // Auto-create initial baseline dataset & snapshot if empty
    ensureBaselineSnapshot();

    // If we have snapshots but no known active id, default to the newest
    if (!activeSnapshotId) {
      const snaps = getSnapshots();
      if (snaps.length) setActiveSnapshot(snaps[0].id);
    }

    // Auto-fill Week Label input default if blank
    const weekInput = document.getElementById('weekLabelInput');
    if (weekInput && !weekInput.value) {
      const today = new Date().toISOString().slice(0, 10);
      const snaps = getSnapshots();
      weekInput.value = `Week ${snaps.length + 1} - ${today}`;
    }

    renderDashboard();
    hideLoading();
  }

  function ensureBaselineSnapshot() {
    const snapshots = getSnapshots();
    if (snapshots.length === 0 || !DATA) {
      const baselineData = {
        week_label: 'Week 1 - Baseline',
        generated_at: new Date().toISOString(),
        kpis: {
          combined: {
            total_registered: 510,
            total_activated: 193,
            total_not_activated: 317,
            total_on_track: 41,
            total_off_track: 276,
            activation_rate: '37.8',
            on_track_rate: '8.0',
          },
          cs: {
            total_registered: 185,
            total_activated: 22,
            total_not_activated: 163,
            total_on_track: 9,
            total_off_track: 66,
            activation_rate: '11.9',
            on_track_rate: '4.9',
          },
          da: {
            total_registered: 325,
            total_activated: 171,
            total_not_activated: 154,
            total_on_track: 32,
            total_off_track: 210,
            activation_rate: '52.6',
            on_track_rate: '9.8',
          }
        },
        learners: []
      };

      if (!DATA) DATA = baselineData;
      saveSnapshot('Week 1 - Baseline', 'System Initial Baseline', baselineData);
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

  function renderTimestamp() {
    if (!DATA) {
      const versionLabel = document.getElementById('versionLabel');
      if (versionLabel) versionLabel.textContent = 'No Data Loaded';
      const mobileVersionLabel = document.getElementById('mobileVersionLabel');
      if (mobileVersionLabel) mobileVersionLabel.textContent = 'No Data Loaded';
      return;
    }

    const ts = DATA.generated_at || new Date().toISOString();
    const date = new Date(ts);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) lastUpdatedEl.textContent = `Last Updated: ${formatted}`;

    const footerTs = document.getElementById('footerTimestamp');
    if (footerTs) footerTs.textContent = formatted;

    const versionTag = DATA.week_label || DATA.version || 'v1.0';
    const versionLabel = document.getElementById('versionLabel');
    if (versionLabel) versionLabel.textContent = `${versionTag}`;

    const mobileVersionLabel = document.getElementById('mobileVersionLabel');
    if (mobileVersionLabel) mobileVersionLabel.textContent = `${versionTag}`;

    const curVerTag = document.getElementById('currentVersionTag');
    if (curVerTag) curVerTag.textContent = `${versionTag}`;

    const curVerTime = document.getElementById('currentVersionTime');
    if (curVerTime) curVerTime.textContent = formatted;

    const kpiData = getActiveKpiData();
    const totalBadge = document.getElementById('totalLearnersBadge');
    if (totalBadge) totalBadge.textContent = kpiData.total_registered || 510;
  }

  // Get KPIs based on currently selected Program View ('all', 'cs', 'da')
  function getActiveKpiData() {
    if (!DATA || !DATA.kpis) {
      return {
        total_registered: 510,
        total_activated: 0,
        total_not_activated: 510,
        total_on_track: 0,
        total_off_track: 0,
        activation_rate: 0,
        on_track_rate: 0
      };
    }

    if (activeProgramView === 'cs' && DATA.kpis.cs) return DATA.kpis.cs;
    if (activeProgramView === 'da' && DATA.kpis.da) return DATA.kpis.da;
    return DATA.kpis.combined || DATA.kpis;
  }

  // =========================================================================
  // DYNAMIC DASHBOARD RENDERERS
  // =========================================================================

  function renderKPIs() {
    const k = getActiveKpiData();
    const reg = k.total_registered || 0;

    const activationRate = reg > 0 ? ((k.total_activated / reg) * 100).toFixed(1) : '0.0';
    const onTrackRate = reg > 0 ? ((k.total_on_track / reg) * 100).toFixed(1) : '0.0';
    const notActivatedRate = reg > 0 ? ((k.total_not_activated / reg) * 100).toFixed(1) : '0.0';
    const offTrackRate = reg > 0 ? ((k.total_off_track / reg) * 100).toFixed(1) : '0.0';

    const cohortLabel = activeProgramView === 'cs' ? 'Cybersecurity'
      : activeProgramView === 'da' ? 'Data Analytics'
      : 'all programs';

    const kpis = [
      {
        id: 'kpi-registered',
        label: 'Total Learners',
        value: k.total_registered,
        detail: `Enrolled across ${cohortLabel}`,
        color: 'blue',
        icon: ICONS.target,
        filterActivation: '',
        filterPerformance: '',
      },
      {
        id: 'kpi-activated',
        label: 'Activated Learners',
        value: k.total_activated,
        detail: `${activationRate}% of learners have started`,
        color: 'green',
        icon: ICONS.zap,
        filterActivation: 'Activated',
        filterPerformance: '',
      },
      {
        id: 'kpi-ontrack',
        label: 'On Track Learners',
        value: k.total_on_track,
        detail: `${onTrackRate}% meeting their milestones`,
        color: 'blue',
        icon: ICONS.check,
        filterActivation: '',
        filterPerformance: 'On Track',
      },
      {
        id: 'kpi-not-activated',
        label: 'Pending Activation',
        value: k.total_not_activated,
        detail: `${notActivatedRate}% yet to begin`,
        color: 'red',
        icon: ICONS.minus,
        filterActivation: 'Not Activated',
        filterPerformance: '',
      },
      {
        id: 'kpi-offtrack',
        label: 'Needs Attention',
        value: k.total_off_track,
        detail: `${offTrackRate}% need support to catch up`,
        color: 'orange',
        icon: ICONS.alert,
        filterActivation: '',
        filterPerformance: 'Off Track',
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
        <div class="kpi-value-num" data-target="${kpi.value}">${kpi.value}</div>
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
      const duration = 600;
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

  function renderFunnels() {
    const funnelDisplay = document.getElementById('funnelDisplay');
    if (!funnelDisplay) return;

    const k = getActiveKpiData();
    const maxVal = k.total_registered || 1;

    const steps = [
      { label: 'Registered Learners', val: k.total_registered },
      { label: 'Activated Learners', val: k.total_activated },
      { label: 'On Track Learners', val: k.total_on_track },
    ];

    funnelDisplay.innerHTML = steps.map(step => {
      const pct = maxVal > 0 ? ((step.val / maxVal) * 100).toFixed(1) : '0.0';
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
        funnelDisplay.querySelectorAll('.funnel-track-bar-fill').forEach((bar, i) => {
          const targetWidth = bar.dataset.width;
          if (Motion.available) {
            window.Motion.animate(bar, { width: targetWidth }, {
              duration: 0.5,
              delay: i * 0.04,
              easing: [0.22, 1, 0.36, 1],
            });
          } else {
            bar.style.width = targetWidth;
          }
        });
      }, 50);
    });
  }

  function renderHealthChart() {
    const canvas = document.getElementById('healthChartOverall');
    const legendList = document.getElementById('healthLegendList');
    if (!canvas) return;

    const k = getActiveKpiData();
    const classObj = {
      'Activated': k.total_activated || 0,
      'Not Activated': k.total_not_activated || 0,
      'On Track': k.total_on_track || 0,
      'Off Track': k.total_off_track || 0,
    };

    const total = k.total_registered || 0;
    const centerEl = document.getElementById('chartCenterTotal');
    if (centerEl) centerEl.textContent = total;

    const labels = Object.keys(classObj);
    const dataValues = Object.values(classObj);
    
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const colors = isDark 
      ? ['#4ADE80', '#94A3B8', '#60A5FA', '#F59E0B']
      : ['#047857', '#475569', '#2563EB', '#D97706'];

    if (legendList) {
      legendList.innerHTML = labels.map((label, idx) => {
        const val = dataValues[idx];
        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
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
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.raw} (${total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0}%)`,
              },
            },
          },
          animation: { animateRotate: true, duration: 400 },
        },
      });
    }
  }

  // =========================================================================
  // PROGRAM VIEW FILTERING
  // =========================================================================

  function setupProgramTabs() {
    const tabsContainer = document.getElementById('programFilterTabs');
    if (!tabsContainer) return;

    tabsContainer.querySelectorAll('.pill-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tabsContainer.querySelectorAll('.pill-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        activeProgramView = tab.dataset.program;
        renderDashboard();
      });
    });
  }

  // =========================================================================
  // DUAL CSV UPLOAD & STRICT VALIDATION ENGINE
  // =========================================================================

  function setupDualUpload() {
    const csFileInput = document.getElementById('csFileInput');
    const daFileInput = document.getElementById('daFileInput');
    const csDropzone = document.getElementById('csDropzone');
    const daDropzone = document.getElementById('daDropzone');
    const processBtn = document.getElementById('processCsvBtn');

    if (csFileInput && csDropzone) {
      setupSlotDropzone(csDropzone, csFileInput, (file) => handleSlotFile('CS', file));
    }

    if (daFileInput && daDropzone) {
      setupSlotDropzone(daDropzone, daFileInput, (file) => handleSlotFile('DA', file));
    }

    if (processBtn) {
      processBtn.addEventListener('click', executeDualCsvProcess);
    }
  }

  function setupSlotDropzone(dropzoneEl, fileInputEl, onFileSelected) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
      dropzoneEl.addEventListener(evt, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(evt => {
      dropzoneEl.addEventListener(evt, () => dropzoneEl.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropzoneEl.addEventListener(evt, () => dropzoneEl.classList.remove('dragover'), false);
    });

    dropzoneEl.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) onFileSelected(files[0]);
    }, false);

    fileInputEl.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        onFileSelected(e.target.files[0]);
      }
    }, false);
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleSlotFile(programType, file) {
    // 1. Strict File Extension Rejection
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv') {
      showSlotError(programType, `Invalid file format (${ext.toUpperCase()}). Please upload a valid .csv file.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedRows = parseCSV(text);

        if (parsedRows.length === 0) {
          showSlotError(programType, 'File is empty or unreadable.');
          return;
        }

        // 2. Schema Validation
        const validationErr = validateCsvSchema(programType, parsedRows[0]);
        if (validationErr) {
          showSlotError(programType, validationErr);
          return;
        }

        // Successfully parsed & validated slot
        if (programType === 'CS') {
          stagedCS = { filename: file.name, rows: parsedRows };
          setSlotValid('CS', file.name, `${parsedRows.length} CS rows validated`);
        } else if (programType === 'DA') {
          stagedDA = { filename: file.name, rows: parsedRows };
          setSlotValid('DA', file.name, `${parsedRows.length} DA rows validated`);
        }

        checkAtomicProcessState();
      } catch (err) {
        showSlotError(programType, `Error parsing CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  function validateCsvSchema(programType, firstRow) {
    if (!firstRow) return 'No header or row data detected.';
    const keys = Object.keys(firstRow).map(k => k.trim());

    const hasEmail = keys.some(k => k.toLowerCase() === 'email');
    const hasStatus = keys.some(k => k.toLowerCase() === 'status');
    const hasActivation = keys.some(k => k.toLowerCase().includes('activation'));

    if (!hasEmail) return 'Missing required "Email" column.';
    if (!hasStatus) return 'Missing required "Status" column.';
    if (!hasActivation) return 'Missing required "Activation Status" column.';

    if (programType === 'CS') {
      const hasScore = keys.some(k => k.toLowerCase().includes('lms overall score') || k.toLowerCase().includes('score'));
      if (!hasScore) return 'Missing required CS "LMS Overall Score" column.';
    }

    if (programType === 'DA') {
      const hasClass = keys.some(k => k.toLowerCase().includes('latest class') || k.toLowerCase().includes('class') || k.toLowerCase().includes('level'));
      if (!hasClass) return 'Missing required DA "Latest Class" or "Level" column.';
    }

    return null;
  }

  function setSlotValid(programType, filename, msg) {
    const slotEl = document.getElementById(programType === 'CS' ? 'csDropzone' : 'daDropzone');
    const nameEl = document.getElementById(programType === 'CS' ? 'csFileName' : 'daFileName');
    const statusEl = document.getElementById(programType === 'CS' ? 'csFileStatus' : 'daFileStatus');

    if (slotEl) {
      slotEl.classList.remove('invalid-error');
      slotEl.classList.add('valid-loaded');
    }
    if (nameEl) nameEl.textContent = `✓ ${filename}`;
    if (statusEl) statusEl.textContent = msg;
  }

  function showSlotError(programType, errMessage) {
    if (programType === 'CS') stagedCS = null;
    if (programType === 'DA') stagedDA = null;

    const slotEl = document.getElementById(programType === 'CS' ? 'csDropzone' : 'daDropzone');
    const statusEl = document.getElementById(programType === 'CS' ? 'csFileStatus' : 'daFileStatus');

    if (slotEl) {
      slotEl.classList.remove('valid-loaded');
      slotEl.classList.add('invalid-error');
    }
    if (statusEl) statusEl.textContent = `❌ ${errMessage}`;

    checkAtomicProcessState();
    showStatus(`Validation error in ${programType} CSV: ${errMessage}`, 'error');
  }

  function checkAtomicProcessState() {
    const processBtn = document.getElementById('processCsvBtn');
    const statusEl = document.getElementById('uploadStatus');

    if (stagedCS && stagedDA) {
      if (processBtn) processBtn.disabled = false;
      if (statusEl) {
        statusEl.className = 'upload-feedback success';
        statusEl.textContent = `Both CS (${stagedCS.rows.length} rows) and DA (${stagedDA.rows.length} rows) ready to process!`;
      }
    } else {
      if (processBtn) processBtn.disabled = true;
      if (statusEl) {
        statusEl.className = 'upload-feedback info';
        if (!stagedCS && !stagedDA) {
          statusEl.textContent = 'Both CSV files required to process dashboard update.';
        } else if (!stagedCS) {
          statusEl.textContent = 'Awaiting Cybersecurity (CS) CSV file...';
        } else {
          statusEl.textContent = 'Awaiting Data Analytics (DA) CSV file...';
        }
      }
    }
  }

  function executeDualCsvProcess() {
    if (!stagedCS || !stagedDA) {
      showStatus('Both the CS and DA summary CSV files are required to continue.', 'error');
      return;
    }

    const weekLabelInput = document.getElementById('weekLabelInput');
    const weekLabel = (weekLabelInput?.value || '').trim() || `Week Snapshot - ${new Date().toISOString().slice(0, 10)}`;

    const csLearners = stagedCS.rows.map(r => parseCsRow(r)).filter(Boolean);
    const daLearners = stagedDA.rows.map(r => parseDaRow(r)).filter(Boolean);

    const allLearners = [...csLearners, ...daLearners];

    // Build KPIs
    const csKpis = computeCohortKpis(csLearners, 'cs');
    const daKpis = computeCohortKpis(daLearners, 'da');
    const combinedKpis = computeCohortKpis(allLearners, 'combined');

    const newDataset = {
      week_label: weekLabel,
      generated_at: new Date().toISOString(),
      kpis: {
        combined: combinedKpis,
        cs: csKpis,
        da: daKpis,
      },
      learners: allLearners,
    };

    DATA = newDataset;

    // Save snapshot to history
    saveSnapshot(weekLabel, 'Dual CSV Upload', newDataset);

    // Render dashboard
    renderDashboard();
    showStatus(`Loaded ${allLearners.length} learners (${csLearners.length} CS, ${daLearners.length} DA) for ${weekLabel}.`, 'success');
  }

  function parseCsRow(row) {
    const emailKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'email');
    const scoreKey = Object.keys(row).find(k => k.trim().toLowerCase().includes('score'));
    const statusKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'status');
    const actKey = Object.keys(row).find(k => k.trim().toLowerCase().includes('activation'));

    const email = String(row[emailKey] || '').trim();
    if (!email) return null;

    const rawScore = parseFloat(row[scoreKey]);
    const score = !isNaN(rawScore) ? Math.round(rawScore * 100) / 100 : null;

    const rawStatus = stripEmoji(row[statusKey]);
    const rawActivation = stripEmoji(row[actKey]);

    const status = rawStatus.toLowerCase().includes('on track') ? 'On Track' : 'Off Track';
    const activation_status = rawActivation.toLowerCase().includes('activated') && !rawActivation.toLowerCase().includes('not') ? 'Activated' : 'Not Activated';

    return {
      track: 'Cybersecurity',
      email: email,
      lms_overall_score: score,
      latest_class: null,
      level: null,
      detail: score != null ? `LMS Score: ${score}%` : '-',
      status: status,
      activation_status: activation_status,
      performance_status: status,
    };
  }

  function parseDaRow(row) {
    const emailKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'email');
    const classKey = Object.keys(row).find(k => k.trim().toLowerCase().includes('class'));
    const levelKey = Object.keys(row).find(k => k.trim().toLowerCase().includes('level'));
    const statusKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'status');
    const actKey = Object.keys(row).find(k => k.trim().toLowerCase().includes('activation'));

    const email = String(row[emailKey] || '').trim();
    if (!email) return null;

    const latestClass = classKey ? String(row[classKey] || '').trim() : '';
    const level = levelKey ? String(row[levelKey] || '').trim() : '';

    const rawStatus = stripEmoji(row[statusKey]);
    const rawActivation = stripEmoji(row[actKey]);

    const status = rawStatus.toLowerCase().includes('on track') ? 'On Track' : 'Off Track';
    const activation_status = rawActivation.toLowerCase().includes('activated') && !rawActivation.toLowerCase().includes('not') ? 'Activated' : 'Not Activated';

    let detail = latestClass || (level ? `Level ${level}` : '-');
    if (latestClass && level) detail = `${latestClass} (L${level})`;

    return {
      track: 'Data Analytics',
      email: email,
      lms_overall_score: null,
      latest_class: latestClass,
      level: level,
      detail: detail,
      status: status,
      activation_status: activation_status,
      performance_status: status,
    };
  }

  function computeCohortKpis(learners, cohort) {
    // Registered total is the fixed enrolment size for the cohort, so
    // "Pending Activation" reflects everyone who has not yet activated.
    const total = REGISTERED_TOTALS[cohort] || learners.length;
    const activated = learners.filter(l => l.activation_status === 'Activated').length;
    const notActivated = Math.max(0, total - activated);
    const onTrack = learners.filter(l => l.status === 'On Track').length;
    const offTrack = learners.filter(l => l.status === 'Off Track').length;

    return {
      total_registered: total,
      total_activated: activated,
      total_not_activated: notActivated,
      total_on_track: onTrack,
      total_off_track: offTrack,
      activation_rate: total > 0 ? ((activated / total) * 100).toFixed(1) : '0.0',
      on_track_rate: total > 0 ? ((onTrack / total) * 100).toFixed(1) : '0.0',
    };
  }

  function stripEmoji(str) {
    if (!str) return '';
    return String(str).replace(/[^\w\s-]/gi, '').trim();
  }

  // Native Robust CSV Parser
  function parseCSV(text) {
    const lines = text.split(/\r\n|\n/);
    if (lines.length === 0) return [];

    const headers = parseCsvLine(lines[0]);
    if (!headers || headers.length === 0) return [];

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = parseCsvLine(line);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] != null ? values[idx] : '';
      });
      result.push(row);
    }
    return result;
  }

  function parseCsvLine(line) {
    const values = [];
    let insideQuote = false;
    let currentVal = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        values.push(currentVal.trim());
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim());
    return values;
  }

  // =========================================================================
  // HISTORICAL SNAPSHOTS ENGINE (localStorage)
  // =========================================================================

  function getSnapshots() {
    try {
      const raw = localStorage.getItem(STORAGE_SNAPSHOTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function persistSnapshots(snapshots) {
    try {
      localStorage.setItem(STORAGE_SNAPSHOTS, JSON.stringify(snapshots));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for snapshot save.', e);
    }
  }

  function setActiveSnapshot(id) {
    activeSnapshotId = id;
    if (id) localStorage.setItem(STORAGE_ACTIVE, id);
    else localStorage.removeItem(STORAGE_ACTIVE);
  }

  function deepClone(obj) {
    return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));
  }

  function saveSnapshot(weekLabel, source, datasetToSave) {
    const dataset = datasetToSave || DATA;
    if (!dataset) return null;

    const now = new Date().toISOString();
    const snapshots = getSnapshots();
    const snap = {
      id: `snap_${Date.now()}`,
      week_label: weekLabel,
      created_at: now,
      updated_at: now,
      timestamp: now, // retained for backward compatibility
      source: source,
      kpis: deepClone(dataset.kpis),
      data: deepClone(dataset),
    };

    snapshots.unshift(snap);

    // Keep max 20 snapshots
    if (snapshots.length > 20) snapshots.pop();

    persistSnapshots(snapshots);
    try {
      localStorage.setItem(STORAGE_CUSTOM_DATA, JSON.stringify(dataset));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for dataset save.', e);
    }
    setActiveSnapshot(snap.id);
    return snap;
  }

  function setupVersionHistoryModal() {
    const modal = document.getElementById('versionHistoryModal');
    const closeBtn = document.getElementById('versionModalClose');
    const doneBtn = document.getElementById('closeVersionModalBtn');
    const createBtn = document.getElementById('createSnapshotBtn');
    const tbody = document.getElementById('snapshotsTableBody');

    if (!modal) return;

    function hide() { modal.classList.add('hidden'); }

    if (closeBtn) closeBtn.addEventListener('click', hide);
    if (doneBtn) doneBtn.addEventListener('click', hide);
    if (createBtn) createBtn.addEventListener('click', createManualSnapshot);

    // Contextual (kebab) action menus: open/close via delegation
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const kebab = e.target.closest('.row-menu-btn');
        if (kebab) {
          e.stopPropagation();
          const menu = kebab.closest('.row-menu');
          const wasOpen = menu.classList.contains('open');
          closeAllRowMenus();
          if (!wasOpen) openRowMenu(menu, kebab);
          return;
        }
        const action = e.target.closest('[data-menu-action]');
        if (action) {
          const { menuAction, snapId } = action.dataset;
          closeAllRowMenus();
          if (menuAction === 'rename') renameSnapshot(snapId);
          else if (menuAction === 'restore') restoreSnapshot(snapId);
          else if (menuAction === 'delete') deleteSnapshot(snapId);
        }
      });
    }

    document.addEventListener('click', closeAllRowMenus);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) hide();
    });
  }

  // Position the dropdown with fixed coordinates so it is never clipped by the
  // modal's overflow, and flip it upward when close to the viewport bottom.
  function openRowMenu(menu, btn) {
    const dd = menu.querySelector('.row-menu-dropdown');
    if (!dd) return;
    menu.classList.add('open');
    const r = btn.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.right = 'auto';
    const width = dd.offsetWidth || 168;
    const height = dd.offsetHeight || 132;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    let left = Math.max(8, r.right - width);
    let top = r.bottom + 4;
    // Flip upward only when we know the viewport height and there isn't room below
    if (vh && top + height > vh - 8) top = Math.max(8, r.top - height - 4);
    dd.style.left = `${left}px`;
    dd.style.top = `${top}px`;
  }

  function closeAllRowMenus() {
    document.querySelectorAll('.row-menu.open').forEach(m => {
      m.classList.remove('open');
      const dd = m.querySelector('.row-menu-dropdown');
      if (dd) { dd.style.position = ''; dd.style.left = ''; dd.style.top = ''; dd.style.right = ''; }
    });
  }

  function createManualSnapshot() {
    if (!DATA) {
      showStatus('There is no active dataset to save yet.', 'error');
      return;
    }
    const label = prompt('Name this version:', DATA.week_label || 'Manual Snapshot');
    if (label && label.trim()) {
      saveSnapshot(label.trim(), 'Manual Save', DATA);
      renderSnapshotTable();
      renderTimestamp();
      showStatus(`Saved version "${label.trim()}".`, 'success');
    }
  }

  function showVersionHistoryModal() {
    const modal = document.getElementById('versionHistoryModal');
    if (!modal) return;
    renderSnapshotTable();
    modal.classList.remove('hidden');
  }

  function formatSnapDate(iso) {
    if (!iso) return '<span class="snap-date-day">-</span>';
    const d = new Date(iso);
    const day = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `<span class="snap-date-day">${day}</span><span class="snap-date-time">${time}</span>`;
  }

  function renderSnapshotTable() {
    const tbody = document.getElementById('snapshotsTableBody');
    if (!tbody) return;

    const snapshots = getSnapshots();

    if (snapshots.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="snapshot-empty-state">
              <div class="empty-icon">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              </div>
              <div class="empty-title">No saved versions yet</div>
              <div class="empty-sub">Save the current dashboard as a version to track changes over time and restore it whenever you need to.</div>
              <button class="btn btn-brand" id="emptyStateSaveBtn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>Save Current Snapshot</span>
              </button>
            </div>
          </td>
        </tr>`;
      const emptyBtn = document.getElementById('emptyStateSaveBtn');
      if (emptyBtn) emptyBtn.addEventListener('click', createManualSnapshot);
      return;
    }

    tbody.innerHTML = snapshots.map(snap => {
      const isActive = snap.id === activeSnapshotId;
      const created = formatSnapDate(snap.created_at || snap.timestamp);
      const updated = formatSnapDate(snap.updated_at || snap.timestamp);
      const learners = snap.kpis && snap.kpis.combined ? snap.kpis.combined.total_registered : 0;

      return `
        <tr class="${isActive ? 'snapshot-row-active' : ''}">
          <td>
            <div class="snap-name">${escapeHtml(snap.week_label)}</div>
            <div class="snap-source">${escapeHtml(snap.source || 'Upload')}</div>
          </td>
          <td class="snap-date">${created}</td>
          <td class="snap-date">${updated}</td>
          <td class="snap-count">${learners}</td>
          <td>
            ${isActive
              ? '<span class="status-chip status-chip-active"><span class="status-badge-dot"></span>Active</span>'
              : '<span class="status-chip status-chip-idle">Saved</span>'}
          </td>
          <td class="td-actions">
            <div class="row-menu">
              <button class="row-menu-btn" aria-label="Version actions" aria-haspopup="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
              </button>
              <div class="row-menu-dropdown" role="menu">
                <button class="row-menu-item" data-menu-action="rename" data-snap-id="${snap.id}" role="menuitem">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                  Rename
                </button>
                <button class="row-menu-item" data-menu-action="restore" data-snap-id="${snap.id}" role="menuitem" ${isActive ? 'disabled' : ''}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
                  Restore
                </button>
                <button class="row-menu-item row-menu-item-danger" data-menu-action="delete" data-snap-id="${snap.id}" role="menuitem">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function restoreSnapshot(snapId) {
    const snapshots = getSnapshots();
    const snap = snapshots.find(s => s.id === snapId);
    if (!snap) return;

    if (confirm(`Restore version "${snap.week_label}" as the active dataset?`)) {
      DATA = deepClone(snap.data);
      localStorage.setItem(STORAGE_CUSTOM_DATA, JSON.stringify(DATA));
      setActiveSnapshot(snap.id);
      renderDashboard();
      renderSnapshotTable();
      showStatus(`Restored version "${snap.week_label}".`, 'success');
    }
  }

  function renameSnapshot(snapId) {
    const snapshots = getSnapshots();
    const snap = snapshots.find(s => s.id === snapId);
    if (!snap) return;

    const next = prompt('Rename this version:', snap.week_label);
    if (next === null) return;
    const name = next.trim();
    if (!name) {
      showStatus('Version name cannot be empty.', 'error');
      return;
    }

    snap.week_label = name;
    snap.updated_at = new Date().toISOString();
    if (snap.data) snap.data.week_label = name;
    persistSnapshots(snapshots);

    // Keep the active dataset label in sync when renaming the active version
    if (snap.id === activeSnapshotId && DATA) {
      DATA.week_label = name;
      localStorage.setItem(STORAGE_CUSTOM_DATA, JSON.stringify(DATA));
      renderTimestamp();
    }

    renderSnapshotTable();
    showStatus(`Renamed version to "${name}".`, 'success');
  }

  function deleteSnapshot(snapId) {
    const snapshots = getSnapshots();
    const idx = snapshots.findIndex(s => s.id === snapId);
    if (idx === -1) return;
    const snap = snapshots[idx];

    if (!confirm(`Delete version "${snap.week_label}"? This cannot be undone.`)) return;

    const wasActive = snap.id === activeSnapshotId;
    snapshots.splice(idx, 1);
    persistSnapshots(snapshots);

    if (wasActive) {
      if (snapshots.length) {
        // Fall back to the most recent remaining version
        const next = snapshots[0];
        DATA = deepClone(next.data);
        localStorage.setItem(STORAGE_CUSTOM_DATA, JSON.stringify(DATA));
        setActiveSnapshot(next.id);
      } else {
        DATA = null;
        localStorage.removeItem(STORAGE_CUSTOM_DATA);
        setActiveSnapshot(null);
      }
      renderDashboard();
    }

    renderSnapshotTable();
    showStatus(`Deleted version "${snap.week_label}".`, 'success');
  }

  // =========================================================================
  // LEARNER DIRECTORY TABLE
  // =========================================================================

  function setupTable() {
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const filterTrack = document.getElementById('filterTrack');
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
    document.querySelectorAll('#activationChips .chip').forEach(chip => {
      const match = chip.dataset.activation === activeActivationFilter;
      chip.classList.toggle('active', match);
      chip.setAttribute('aria-checked', match ? 'true' : 'false');
    });

    document.querySelectorAll('#performanceChips .chip').forEach(chip => {
      const match = chip.dataset.performance === activePerformanceFilter;
      chip.classList.toggle('active', match);
      chip.setAttribute('aria-checked', match ? 'true' : 'false');
    });
  }

  function filterAndRender() {
    if (!DATA || !DATA.learners) {
      filteredLearners = [];
      renderTable();
      renderPagination();
      return;
    }

    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

    filteredLearners = DATA.learners.filter(l => {
      if (activeProgramView === 'cs' && l.track !== 'Cybersecurity') return false;
      if (activeProgramView === 'da' && l.track !== 'Data Analytics') return false;

      if (activeTrackFilter && l.track !== activeTrackFilter) return false;
      if (activeActivationFilter && l.activation_status !== activeActivationFilter) return false;
      if (activePerformanceFilter && l.status !== activePerformanceFilter) return false;

      if (search) {
        const text = `${l.email} ${l.track} ${l.detail}`.toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    });

    filteredLearners.sort((a, b) => {
      let va = a[sortColumn];
      let vb = b[sortColumn];

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

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

    if (filteredLearners.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-muted);">
              <div style="margin-bottom: 8px; color: var(--text-sub);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div style="font-weight: 600; color: var(--text-main); font-size: 14px;">${DATA ? 'No matching learners found' : 'No Dashboard Data Loaded'}</div>
              <div style="font-size: 12px; margin-top: 4px;">${DATA ? 'Try clearing search filters or selecting a different view' : 'Switch to Admin Data Ops to upload weekly CS and DA summary CSV files'}</div>
            </div>
          </td>
        </tr>
      `;
      const rc = document.getElementById('resultCount');
      if (rc) rc.textContent = 'Showing 0 learners';
      return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filteredLearners.slice(start, start + PAGE_SIZE);

    const fragment = document.createDocumentFragment();
    const tempContainer = document.createElement('tbody');

    tempContainer.innerHTML = page.map(l => {
      const actBadgeClass = l.activation_status === 'Activated' ? 'activated' : 'not-activated';
      const perfBadgeClass = l.status === 'On Track' ? 'on-track' : 'off-track';
      const trackClass = l.track === 'Cybersecurity' ? 'cs' : 'da';

      return `
        <tr>
          <td>
            <a href="mailto:${escapeHtml(l.email)}" style="color: var(--text-accent); text-decoration: none; font-weight: 500;">${escapeHtml(l.email)}</a>
          </td>
          <td><span class="track-tag ${trackClass}">${l.track === 'Cybersecurity' ? 'CS' : 'DA'}</span></td>
          <td style="font-size: 12px; color: var(--text-sub);">${escapeHtml(l.detail)}</td>
          <td>
            <span class="status-pill-badge ${actBadgeClass}">
              <span class="status-badge-dot"></span>${l.activation_status}
            </span>
          </td>
          <td>
            <span class="status-pill-badge ${perfBadgeClass}">
              <span class="status-badge-dot"></span>${l.status}
            </span>
          </td>
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
      rc.textContent = `Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, filteredLearners.length)} of ${filteredLearners.length} learners`;
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

  function exportCSV() {
    if (!filteredLearners || filteredLearners.length === 0) {
      showStatus('No learners available to export.', 'error');
      return;
    }

    const headers = ['Email', 'Track', 'Program Detail', 'Activation Status', 'Performance Status'];
    const rows = filteredLearners.map(l => [
      l.email,
      l.track,
      l.detail,
      l.activation_status,
      l.status,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ALX_UN_Women_Learners_${DATA ? DATA.week_label : 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // =========================================================================
  // ADMIN AUTH & MODE SWITCHING
  // =========================================================================

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

    if (openVerBtn) openVerBtn.addEventListener('click', () => showVersionHistoryModal());

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Clear all dashboard data and every saved version? This cannot be undone.')) {
          localStorage.removeItem(STORAGE_CUSTOM_DATA);
          localStorage.removeItem(STORAGE_SNAPSHOTS);
          setActiveSnapshot(null);
          DATA = null;
          stagedCS = null;
          stagedDA = null;
          renderDashboard();
          showStatus('All dashboard data and saved versions cleared.', 'info');
        }
      });
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

  // =========================================================================
  // MOBILE NAVIGATION & THEME TOGGLE
  // =========================================================================

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
        if (header && !header.contains(e.target)) closeMobileNav();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeMobileNav();
    });
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

      renderHealthChart();
    });
  }

  function showStatus(msg, type) {
    const el = document.getElementById('uploadStatus');
    if (el) {
      el.className = `upload-feedback ${type}`;
      el.textContent = msg;
    }
  }

  const _escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const _escapeRe = /[&<>"']/g;
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(_escapeRe, ch => _escapeMap[ch]);
  }

})();
