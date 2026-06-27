(function () {
    'use strict';

    // ── CSV helper ───────────────────────────────────────────────────────────────
    function parseCSV(text) {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const vals = line.split(',');
            const obj  = {};
            headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
            return obj;
        });
    }

    async function fetchCSV(url) {
        try { const r = await fetch(url); return r.ok ? parseCSV(await r.text()) : []; }
        catch { return []; }
    }

    // ── Formatters ───────────────────────────────────────────────────────────────
    function fmtNum(n)  { return (Number(n) || 0).toLocaleString(); }
    function fmtDate(s) { return (s || '').slice(0, 10); }

    function fmtAbbr(n) {
        n = Number(n) || 0;
        if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        return n.toLocaleString();
    }

    // ── Colors ───────────────────────────────────────────────────────────────────
    const YT_COLOR  = '#ff5f57';
    const MOD_COLOR = '#46a258';

    function hexAlpha(hex, a) {
        return hex + Math.round(a * 255).toString(16).padStart(2, '0');
    }

    // ── DOM helper ───────────────────────────────────────────────────────────────
    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls)          e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    // ── Chart.js defaults ────────────────────────────────────────────────────────
    let _defaultsApplied = false;
    function applyDefaults() {
        if (_defaultsApplied || !window.Chart) return;
        _defaultsApplied = true;
        Chart.defaults.color       = 'rgba(255,255,255,0.55)';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
        Chart.defaults.font.family = "'Courier New', Courier, monospace";
        Chart.defaults.font.size   = 11;
        try {
            Chart.register({
                id: 'psGlow',
                beforeDatasetDraw(chart, args) {
                    const idx = chart._glowDatasetIdx;
                    if (idx == null || args.index !== idx) return;
                    const col = chart.data.datasets[idx].borderColor || '#ffffff';
                    chart.ctx.save();
                    chart.ctx.shadowBlur  = 22;
                    chart.ctx.shadowColor = col;
                },
                afterDatasetDraw(chart, args) {
                    if (chart._glowDatasetIdx == null || args.index !== chart._glowDatasetIdx) return;
                    chart.ctx.restore();
                },
            });
        } catch {}
    }

    // ── Dataset builders ─────────────────────────────────────────────────────────
    function mkDataset(label, data, col, { fill = false } = {}) {
        const n = data.filter(v => v != null).length;
        return {
            label, data,
            borderColor:      col,
            backgroundColor:  fill ? hexAlpha(col, 0.12) : 'transparent',
            borderWidth:      2,
            pointRadius:      n <= 10 ? 3 : n <= 40 ? 1 : 0,
            pointHoverRadius: 5,
            tension:          0,
            fill,
            spanGaps: false,
        };
    }

    function mkDeltaDataset(label, data, col) {
        return {
            label, data,
            borderColor:      col,
            backgroundColor:  'transparent',
            borderWidth:      1.5,
            pointRadius:      0,
            pointHoverRadius: 4,
            tension:          0,
            spanGaps:         false,
        };
    }

    // ── Chart options ────────────────────────────────────────────────────────────
    function baseOptions() {
        return {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 300 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend:  { display: false },
                tooltip: { enabled: false, external: function () {} },
            },
            scales: {
                x: { ticks: { color: 'rgba(255,255,255,0.35)', maxTicksLimit: 8, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { beginAtZero: true, ticks: { color: 'rgba(255,255,255,0.35)', callback: v => fmtAbbr(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        };
    }

    function deltaOptions() {
        const o = baseOptions();
        o.scales.y.min = 0;
        return o;
    }

    // ── renderChart (HTML tooltip) ───────────────────────────────────────────────
    const DEFAULT_EVENTS = ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'];

    function renderChart(canvas, labels, datasets, opts) {
        opts = opts || baseOptions();
        const wrap = canvas.parentNode;
        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'chart-tooltip-ext';
        wrap.appendChild(tooltipEl);

        let locked = false, lastPoints = [], lastTitle = '', lastCaretX = 0, lastCaretY = 0;

        function sortedPoints(points) {
            return [...points].filter(p => p.parsed.y != null).sort((a, b) => (b.parsed.y ?? -Infinity) - (a.parsed.y ?? -Infinity));
        }

        function positionTooltip(chart, caretX, caretY) {
            const ca    = chart.chartArea;
            const midX  = (ca.left + ca.right) / 2;
            const OFFSET = 14;
            tooltipEl.style.display = 'block';
            const ttW = tooltipEl.offsetWidth  || 0;
            const ttH = tooltipEl.offsetHeight || 0;
            const x = Math.max(ca.left, Math.min(ca.right - ttW, caretX > midX ? caretX - ttW - OFFSET : caretX + OFFSET));
            const y = Math.max(ca.top,  Math.min(ca.bottom - ttH, caretY - ttH / 2));
            tooltipEl.style.left = x + 'px';
            tooltipEl.style.top  = y + 'px';
        }

        function setGlow(chart, dsIdx) {
            if (chart._glowDatasetIdx != null) {
                const prev = chart.data.datasets[chart._glowDatasetIdx];
                if (prev && prev._origBW !== undefined) { prev.borderWidth = prev._origBW; delete prev._origBW; }
            }
            chart._glowDatasetIdx = dsIdx ?? null;
            if (dsIdx != null) {
                const ds = chart.data.datasets[dsIdx];
                if (ds) { ds._origBW = ds.borderWidth; ds.borderWidth = (ds.borderWidth || 2) * 3; }
            }
            chart.update('none');
        }

        function renderTooltipItems(chart, points, title, interactive) {
            const sorted = sortedPoints(points);
            let html = `<div class="cte-title">${title}</div><div class="cte-items">`;
            sorted.forEach(p => {
                const hidden = !chart.isDatasetVisible(p.datasetIndex);
                const col    = p.dataset.borderColor || '#fff';
                html += `<div class="cte-item${hidden ? ' cte-hidden' : ''}" data-ds="${p.datasetIndex}"${interactive ? ' role="button" tabindex="0"' : ''}>
                    <span class="cte-dot" style="background:${col}"></span>
                    <span class="cte-label">${p.dataset.label}</span>
                    <span class="cte-val">${fmtNum(p.parsed.y)}</span>
                </div>`;
            });
            html += '</div>';
            tooltipEl.innerHTML = html;
            tooltipEl.querySelectorAll('.cte-item').forEach(row => {
                const dsIdx = Number(row.dataset.ds);
                row.addEventListener('mouseenter', () => setGlow(chart, dsIdx));
                row.addEventListener('mouseleave', () => setGlow(chart, null));
            });
            if (interactive) {
                tooltipEl.querySelectorAll('.cte-item').forEach(row => {
                    row.addEventListener('click', e => {
                        e.stopPropagation();
                        const dsIdx  = Number(row.dataset.ds);
                        const nowVis = !chart.isDatasetVisible(dsIdx);
                        chart.setDatasetVisibility(dsIdx, nowVis);
                        chart.update('none');
                        row.classList.toggle('cte-hidden', !nowVis);
                    });
                });
            }
        }

        opts.plugins.tooltip.external = function ({ chart, tooltip }) {
            if (locked) return;
            if (!tooltip.dataPoints?.length || tooltip.opacity === 0) { tooltipEl.style.display = 'none'; return; }
            lastPoints = tooltip.dataPoints;
            lastTitle  = tooltip.title?.[0] || '';
            lastCaretX = tooltip.caretX;
            lastCaretY = tooltip.caretY;
            renderTooltipItems(chart, lastPoints, lastTitle, false);
            positionTooltip(chart, lastCaretX, lastCaretY);
        };

        const chart = new Chart(canvas, { type: 'line', data: { labels, datasets }, options: opts });

        canvas.addEventListener('click', () => {
            if (locked) {
                locked = false;
                canvas.classList.remove('chart-locked');
                tooltipEl.style.display = 'none';
                tooltipEl.classList.remove('is-locked');
                chart.options.events = DEFAULT_EVENTS;
                chart.update('none');
            } else {
                if (!lastPoints.length) return;
                locked = true;
                canvas.classList.add('chart-locked');
                chart.options.events = [];
                tooltipEl.classList.add('is-locked');
                renderTooltipItems(chart, lastPoints, lastTitle, true);
                positionTooltip(chart, lastCaretX, lastCaretY);
            }
        });

        return chart;
    }

    // ── Date range control ───────────────────────────────────────────────────────
    const PRESETS = [
        { label: '1W',  days: 7   },
        { label: '1M',  days: 30  },
        { label: '3M',  days: 91  },
        { label: '6M',  days: 182 },
        { label: '1Y',  days: 365 },
        { label: '2Y',  days: 730 },
        { label: 'All', days: null },
    ];

    function makeRangeEl(firstDate, lastDate, onChange) {
        const wrap      = el('div', 'stat-range-wrap');
        const bar       = el('div', 'stat-range-bar');
        const customRow = el('div', 'stat-custom-range');
        customRow.hidden = true;

        let activePreset = null;
        let customBtn;

        function activatePreset(btn) {
            if (activePreset) activePreset.classList.remove('is-active');
            (activePreset = btn).classList.add('is-active');
            if (customBtn) customBtn.classList.remove('is-active');
            customRow.hidden = true;
        }

        PRESETS.forEach(({ label, days }) => {
            const btn = el('button', 'stat-ctrl-btn', label);
            if (days === 30) { btn.classList.add('is-active'); activePreset = btn; }
            btn.addEventListener('click', () => {
                activatePreset(btn);
                if (!days) {
                    fromIn.value = firstDate || '';
                    toIn.value   = lastDate  || '';
                    onChange(null, null);
                    return;
                }
                const last    = new Date((lastDate || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
                const from    = new Date(last);
                from.setUTCDate(from.getUTCDate() - days + 1);
                const fromStr = from.toISOString().slice(0, 10);
                fromIn.value  = fromStr;
                toIn.value    = lastDate || new Date().toISOString().slice(0, 10);
                onChange(fromStr, null);
            });
            bar.appendChild(btn);
        });

        customBtn = el('button', 'stat-ctrl-btn', 'Custom');
        customBtn.addEventListener('click', () => {
            const nowHidden = customRow.hidden;
            customRow.hidden = !nowHidden;
            customBtn.classList.toggle('is-active', nowHidden);
        });
        bar.appendChild(customBtn);

        const fromIn = document.createElement('input');
        fromIn.type = 'date'; fromIn.className = 'stat-date-input';
        fromIn.value = firstDate || '';
        const toIn = document.createElement('input');
        toIn.type = 'date'; toIn.className = 'stat-date-input';
        toIn.value = lastDate || '';
        const applyBtn = el('button', 'stat-ctrl-btn', 'Apply');

        applyBtn.addEventListener('click', () => {
            const from = fromIn.value || null;
            const to   = toIn.value   || null;
            if (from && to) {
                const days = (new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000;
                if (days < 0) return;
                if (days > 365.25 * 5) {
                    const newFrom = new Date(to + 'T00:00:00Z');
                    newFrom.setUTCFullYear(newFrom.getUTCFullYear() - 5);
                    fromIn.value = newFrom.toISOString().slice(0, 10);
                    return;
                }
            }
            if (activePreset) activePreset.classList.remove('is-active');
            activePreset = null;
            onChange(from, to);
        });

        customRow.appendChild(fromIn);
        customRow.appendChild(el('span', 'stat-range-sep', '→'));
        customRow.appendChild(toIn);
        customRow.appendChild(applyBtn);
        wrap.appendChild(bar);
        wrap.appendChild(customRow);
        return wrap;
    }

    // ── Slice a cumulative chart to a date window ────────────────────────────────
    function sliceChart(chart, origLabels, origData, from, to) {
        let s = 0, e = origLabels.length;
        if (from) { const i = origLabels.findIndex(l => l >= from); if (i >= 0) s = i; }
        if (to)   { const i = origLabels.findIndex(l => l >  to);  if (i >= 0) e = i; }
        chart.data.labels = origLabels.slice(s, e);
        chart.data.datasets.forEach((ds, i) => { ds.data = origData[i].slice(s, e); });
        chart.update('none');
    }

    // ── Delta computation ────────────────────────────────────────────────────────
    function computeEntityDeltas(sortedRows, key) {
        const result = [];
        for (let i = 1; i < sortedRows.length; i++) {
            result.push({
                date:  fmtDate(sortedRows[i].date),
                value: Math.max(0, (Number(sortedRows[i][key]) || 0) - (Number(sortedRows[i - 1][key]) || 0)),
            });
        }
        return result;
    }

    function weekKey(dateStr) {
        const d   = new Date(dateStr + 'T00:00:00Z');
        const dow = d.getUTCDay();
        const mon = new Date(d);
        mon.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
        return mon.toISOString().slice(0, 10);
    }

    function periodBuckets(deltas, mode) {
        if (mode === 'day') return deltas.map(r => ({ ...r }));
        const map = new Map();
        deltas.forEach(r => {
            const key = mode === 'week' ? weekKey(r.date) : r.date.slice(0, 7);
            if (!map.has(key)) map.set(key, { date: key, value: 0 });
            map.get(key).value += r.value || 0;
        });
        return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    }

    // ── Active chart registry ────────────────────────────────────────────────────
    let _activeCharts = [];

    function destroyActiveCharts() {
        _activeCharts.forEach(c => { try { c.destroy(); } catch {} });
        _activeCharts = [];
    }

    // ── Build stats content: 2 charts ────────────────────────────────────────────
    function buildStatsContent(container, rows, valueKey, label, color, isYoutube) {
        if (!rows.length) {
            container.innerHTML = '<p style="padding:40px;text-align:center;opacity:0.5;font-family:var(--font-mono)">No history data available.</p>';
            return;
        }

        const sorted  = [...rows].sort((a, b) => fmtDate(a.date).localeCompare(fmtDate(b.date)));
        const labels  = sorted.map(r => fmtDate(r.date));
        const data    = sorted.map(r => Number(r[valueKey]) || 0);
        const current = data.length ? data[data.length - 1] : 0;
        const icon       = isYoutube ? 'fa-eye' : 'fa-download';
        const deltaLabel = isYoutube ? 'New Views' : 'New Downloads';

        // ── Chart 1: Cumulative ──────────────────────────────────────────────────
        const sec1 = el('section', 'stat-section');
        sec1.innerHTML = `
            <div class="stat-section-head">
                <h2 class="stat-section-title"><i class="fa ${icon}"></i> Total ${label}</h2>
                <span class="stat-big-num">${fmtNum(current)}</span>
            </div>
            <div class="stat-chart-wrap stat-chart-tall"><canvas></canvas></div>`;
        container.appendChild(sec1);

        const chartDiv1 = sec1.querySelector('.stat-chart-wrap');
        if (labels.length) {
            // Create chart FIRST so makeRangeEl's initial 1M fire slices it correctly
            const chart1 = renderChart(chartDiv1.querySelector('canvas'), labels.slice(), [mkDataset(label, data.slice(), color, { fill: true })]);
            _activeCharts.push(chart1);
            const rangeEl1 = makeRangeEl(labels[0], labels[labels.length - 1], (from, to) => sliceChart(chart1, labels, [data], from, to));
            sec1.insertBefore(rangeEl1, chartDiv1);
            // Apply default 1M slice
            if (labels.length) {
                const last = new Date(labels[labels.length - 1] + 'T00:00:00Z');
                const from = new Date(last);
                from.setUTCDate(from.getUTCDate() - 29);
                sliceChart(chart1, labels, [data], from.toISOString().slice(0, 10), null);
            }
        } else {
            chartDiv1.innerHTML = '<p class="stat-no-data">No history yet.</p>';
        }

        // ── Chart 2: Daily delta ─────────────────────────────────────────────────
        const deltas = computeEntityDeltas(sorted, valueKey);

        const sec2 = el('section', 'stat-section');
        sec2.style.marginBottom = '4px';
        const head2 = el('div', 'stat-section-head');
        head2.innerHTML = `<h2 class="stat-section-title"><i class="fa fa-bar-chart"></i> ${deltaLabel}</h2>`;
        sec2.appendChild(head2);
        container.appendChild(sec2);

        if (!deltas.length) {
            const msg = el('p', 'stat-no-data');
            msg.style.cssText = 'position:static;padding:40px 0;opacity:0.45;text-align:center';
            msg.textContent = 'Not enough history yet — check back after the next data update.';
            sec2.appendChild(msg);
            return;
        }

        const allDeltaDates = deltas.map(r => r.date);
        const firstDelta    = allDeltaDates[0] || '';
        const lastDelta     = allDeltaDates[allDeltaDates.length - 1] || '';

        const modeBar = el('div', 'stat-range-bar');
        modeBar.style.marginLeft = 'auto';
        let mode = 'day', chart2 = null, fromStr2 = null, toStr2 = null, activeModeBtn = null;

        ['Day', 'Week', 'Month'].forEach(lbl => {
            const m   = lbl.toLowerCase();
            const btn = el('button', 'stat-ctrl-btn', lbl);
            btn.addEventListener('click', () => {
                if (activeModeBtn) activeModeBtn.classList.remove('is-active');
                (activeModeBtn = btn).classList.add('is-active');
                mode = m; renderDelta();
            });
            if (m === 'day') { btn.classList.add('is-active'); activeModeBtn = btn; }
            modeBar.appendChild(btn);
        });
        head2.appendChild(modeBar);

        const chartWrap2 = el('div', 'stat-chart-wrap stat-chart-tall');
        chartWrap2.innerHTML = '<canvas></canvas>';

        function renderDelta() {
            let d = deltas;
            if (fromStr2) d = d.filter(r => r.date >= fromStr2);
            if (toStr2)   d = d.filter(r => r.date <= toStr2);
            const bucketed = periodBuckets(d, mode);
            const dlabels  = bucketed.map(r => r.date);
            const ddata    = bucketed.map(r => r.value);

            if (!chart2) {
                chart2 = renderChart(chartWrap2.querySelector('canvas'), dlabels, [mkDeltaDataset(deltaLabel, ddata, color)], deltaOptions());
                _activeCharts.push(chart2);
            } else {
                chart2.data.labels = dlabels;
                chart2.data.datasets[0].data = ddata;
                chart2.update('none');
            }
        }

        // Apply default 1M range for delta chart
        if (lastDelta) {
            const last = new Date(lastDelta + 'T00:00:00Z');
            const from = new Date(last);
            from.setUTCDate(from.getUTCDate() - 29);
            fromStr2 = from.toISOString().slice(0, 10);
        }

        const rangeEl2 = makeRangeEl(firstDelta, lastDelta, (from, to) => { fromStr2 = from; toStr2 = to; renderDelta(); });
        sec2.appendChild(rangeEl2);
        sec2.appendChild(chartWrap2);

        renderDelta();
    }

    // ── Dynamic Chart.js loader ──────────────────────────────────────────────────
    function ensureChartJS(cb) {
        if (window.Chart) { applyDefaults(); return cb(); }
        const s  = document.createElement('script');
        s.src    = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
        s.onload = () => { applyDefaults(); cb(); };
        document.head.appendChild(s);
    }

    // ── Public API ───────────────────────────────────────────────────────────────
    window._projStatsOpen = false;

    async function openProjectStats(type, entityId, title) {
        const overlay = document.getElementById('proj-stats-overlay');
        const body    = document.getElementById('proj-stats-body');
        const titleEl = document.getElementById('proj-stats-title');
        if (!overlay || !body) return;

        destroyActiveCharts();
        window._projStatsOpen = true;

        if (titleEl) titleEl.textContent = (title || 'Statistics') + ' — zsh';
        body.innerHTML = '<div class="stat-loading"><i class="fa fa-spinner fa-spin"></i> Loading statistics…</div>';
        overlay.classList.add('active');

        const isYoutube = type === 'youtube';
        const csvPath   = isYoutube
            ? `../data/history/youtube/videos/${entityId}.csv`
            : `../data/history/mods/${entityId}.csv`;
        const valueKey  = isYoutube ? 'views' : 'downloads_total';
        const label     = isYoutube ? 'Views' : 'Downloads';
        const color     = isYoutube ? YT_COLOR : MOD_COLOR;

        let rows = [];
        await new Promise(resolve => {
            ensureChartJS(async () => {
                rows = await fetchCSV(csvPath);
                resolve();
            });
        });

        body.innerHTML = '';
        buildStatsContent(body, rows, valueKey, label, color, isYoutube);
    }

    function closeProjectStats() {
        window._projStatsOpen = false;
        destroyActiveCharts();
        const overlay = document.getElementById('proj-stats-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    window.openProjectStats  = openProjectStats;
    window.closeProjectStats = closeProjectStats;

    // ── Wire overlay controls ────────────────────────────────────────────────────
    function ensureOverlay() {
        if (document.getElementById('proj-stats-overlay')) return;
        const div = document.createElement('div');
        div.id = 'proj-stats-overlay';
        div.className = 'body-portal';
        div.innerHTML = `
            <div class="proj-stats-modal">
                <div class="modal-titlebar">
                    <div class="modal-win-controls">
                        <span class="modal-win-btn modal-win-close" id="proj-stats-close"></span>
                        <span class="modal-win-btn modal-win-minimize"></span>
                        <span class="modal-win-btn modal-win-maximize"></span>
                    </div>
                    <span class="modal-win-title" id="proj-stats-title">Statistics — zsh</span>
                </div>
                <div id="proj-stats-body" class="proj-stats-body"></div>
                <button class="modal-back btn-theme" id="proj-stats-back" style="margin:12px 24px;align-self:stretch;padding:16px 20px;font-size:var(--fs-body);"><i class="fa fa-arrow-left"></i> Back</button>
            </div>`;
        document.body.appendChild(div);
    }

    function wireOverlay() {
        ensureOverlay();
        const overlay  = document.getElementById('proj-stats-overlay');
        const backBtn  = document.getElementById('proj-stats-back');
        const closeBtn = document.getElementById('proj-stats-close');
        if (!overlay) return;
        if (backBtn)  backBtn.addEventListener('click',  closeProjectStats);
        if (closeBtn) closeBtn.addEventListener('click', closeProjectStats);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeProjectStats(); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && window._projStatsOpen) {
                e.stopImmediatePropagation();
                closeProjectStats();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireOverlay);
    } else {
        wireOverlay();
    }
})();
