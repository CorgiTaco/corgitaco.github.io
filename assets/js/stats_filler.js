(function () {
    'use strict';

    // ── CSV / JSON helpers ────────────────────────────────────────────────────

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

    async function fetchJSON(url) {
        try { const r = await fetch(url); return r.ok ? r.json() : null; }
        catch { return null; }
    }

    // ── Formatters ────────────────────────────────────────────────────────────

    function fmtNum(n) { return (Number(n) || 0).toLocaleString(); }

    function fmtAbbr(n) {
        n = Number(n) || 0;
        if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        return n.toLocaleString();
    }

    function fmtDate(isoStr) { return (isoStr || '').slice(0, 10); }

    // ── Colour palette ────────────────────────────────────────────────────────

    const PALETTE = [
        '#46a258', '#ff5f57', '#4dc9f6', '#f6a019',
        '#c084fc', '#38bdf8', '#fb923c', '#a3e635',
        '#f472b6', '#34d399', '#fbbf24', '#818cf8',
    ];

    const CF_COLOR  = '#f16436';
    const MR_COLOR  = '#1bd96a';
    const YT_COLOR  = '#ff5f57';
    const TOT_COLOR = '#c084fc';

    function palette(i) { return PALETTE[i % PALETTE.length]; }

    // ── Chart defaults ────────────────────────────────────────────────────────

    function applyDefaults() {
        Chart.defaults.color       = 'rgba(255,255,255,0.55)';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.07)';
        Chart.defaults.font.family = "'Courier New', Courier, monospace";
        Chart.defaults.font.size   = 11;

        Chart.register({
            id: 'datasetGlow',
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
    }

    function hexAlpha(hex, a) {
        return hex + Math.round(a * 255).toString(16).padStart(2, '0');
    }

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
            spanGaps:         false,
        };
    }

    // Thin, point-free lines for high-density delta charts
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

    function mkBarDataset(label, data, col) {
        return {
            label, data,
            backgroundColor:      hexAlpha(col, 0.55),
            borderColor:          col,
            borderWidth:          1,
            borderRadius:         2,
            hoverBackgroundColor: hexAlpha(col, 0.8),
        };
    }

    function baseOptions() {
        return {
            responsive: true, maintainAspectRatio: false,
            animation:   { duration: 300 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled:  false, // replaced by HTML external tooltip
                    external: function() {}, // assigned per-chart in renderChart
                },
            },
            scales: {
                x: { ticks: { color: 'rgba(255,255,255,0.35)', maxTicksLimit: 8, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { beginAtZero: true, ticks: { color: 'rgba(255,255,255,0.35)', callback: v => fmtAbbr(v) }, grid: { color: 'rgba(255,255,255,0.05)' } },
            },
        };
    }

    function deltaOptions() {
        const o = baseOptions();
        o.scales.y.min = 0;  // never let delta y-axis go below 0
        return o;
    }

    function barOptions(showLegend = false, stacked = false) {
        const o = baseOptions();
        o.animation.duration = 200;
        o.scales.y.min = 0;
        if (showLegend) { o.plugins.legend.display = true; o.plugins.legend.labels = { color: 'rgba(255,255,255,0.6)', boxWidth: 10, padding: 14 }; }
        if (stacked)    { o.scales.x.stacked = true; o.scales.y.stacked = true; }
        return o;
    }

    const DEFAULT_EVENTS = ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'];

    function setGlow(chart, dsIdx) {
        // Clear previous glow
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

    function renderChart(canvas, labels, datasets, opts) {
        opts = opts || baseOptions();

        // Tooltip lives as an absolutely-positioned div inside the chart-wrap
        const wrap = canvas.parentNode;
        const tooltipEl = document.createElement('div');
        tooltipEl.className = 'chart-tooltip-ext';
        wrap.appendChild(tooltipEl);

        let locked      = false;
        let lastPoints  = [];
        let lastTitle   = '';
        let lastCaretX  = 0;
        let lastCaretY  = 0;

        function sortedPoints(points) {
            return [...points]
                .filter(p => p.parsed.y != null)
                .sort((a, b) => (b.parsed.y ?? -Infinity) - (a.parsed.y ?? -Infinity));
        }

        function positionTooltip(chart, caretX, caretY) {
            const ca      = chart.chartArea;
            const midX    = (ca.left + ca.right) / 2;
            const onRight = caretX > midX; // cursor on right half → put tooltip to its left
            const OFFSET  = 14;
            tooltipEl.style.display = 'block';
            const ttW = tooltipEl.offsetWidth  || 0;
            const ttH = tooltipEl.offsetHeight || 0;
            const x   = Math.max(ca.left, Math.min(ca.right - ttW,
                            onRight ? caretX - ttW - OFFSET : caretX + OFFSET));
            const y   = Math.max(ca.top, Math.min(ca.bottom - ttH, caretY - ttH / 2));
            tooltipEl.style.left = x + 'px';
            tooltipEl.style.top  = y + 'px';
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

            // Glow on hover (always attached; pointer-events CSS gates firing when not locked)
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

        // Wire the external tooltip callback into the options
        opts.plugins.tooltip.external = function({ chart, tooltip }) {
            if (locked) return;
            if (!tooltip.dataPoints?.length || tooltip.opacity === 0) {
                tooltipEl.style.display = 'none';
                return;
            }
            lastPoints = tooltip.dataPoints;
            lastTitle  = tooltip.title?.[0] || '';
            lastCaretX = tooltip.caretX;
            lastCaretY = tooltip.caretY;
            renderTooltipItems(chart, lastPoints, lastTitle, false);
            positionTooltip(chart, lastCaretX, lastCaretY);
        };

        const chart = new Chart(canvas, { type: 'line', data: { labels, datasets }, options: opts });

        // Canvas click = lock / unlock
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

    // ── Date-aligned multi-series builder ─────────────────────────────────────

    function alignSeries(entities) {
        const allDates = [...new Set(entities.flatMap(e => e.rows.map(r => fmtDate(r.date))))].sort();
        const datasets = entities.map((e, i) => {
            const byDate = {};
            e.rows.forEach(r => { byDate[fmtDate(r.date)] = Number(r[e.valueKey]) || 0; });
            return mkDataset(e.label, allDates.map(d => d in byDate ? byDate[d] : null), e.col || palette(i));
        });
        return { labels: allDates, datasets };
    }

    // ── DOM helpers ───────────────────────────────────────────────────────────

    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls)          e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    // ── Date range control ────────────────────────────────────────────────────
    // Returns a .stat-range-wrap element.
    // onChange(fromStr | null, toStr | null) fires on every preset or Apply click.

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
            if (!days) { btn.classList.add('is-active'); activePreset = btn; }
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

        // Date inputs — pre-filled to the full data range (matching "All")
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
                if (days > 365.25 * 5) {                              // 5-year max
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

    // ── Cumulative chart slice helper ─────────────────────────────────────────

    function sliceChart(chart, origLabels, origData, from, to) {
        let s = 0, e = origLabels.length;
        if (from) { const i = origLabels.findIndex(l => l >= from); if (i >= 0) s = i; }
        if (to)   { const i = origLabels.findIndex(l => l >  to);  if (i >= 0) e = i; }
        chart.data.labels = origLabels.slice(s, e);
        chart.data.datasets.forEach((ds, i) => { ds.data = origData[i].slice(s, e); });
        chart.update('none');
    }

    // ── Delta computation ─────────────────────────────────────────────────────

    // Multi-key delta (for aggregate CF/MR/Total): [{date, key1, key2, ...}]
    function computeDeltas(sortedRows, keys) {
        const result = [];
        for (let i = 1; i < sortedRows.length; i++) {
            const entry = { date: fmtDate(sortedRows[i].date) };
            keys.forEach(k => {
                entry[k] = Math.max(0, (Number(sortedRows[i][k]) || 0) - (Number(sortedRows[i - 1][k]) || 0));
            });
            result.push(entry);
        }
        return result;
    }

    // Single-key delta for one entity: [{date, value}]
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

    // ── Period bucket aggregation ─────────────────────────────────────────────

    function weekKey(dateStr) {
        const d   = new Date(dateStr + 'T00:00:00Z');
        const dow = d.getUTCDay();
        const mon = new Date(d);
        mon.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
        return mon.toISOString().slice(0, 10);
    }

    function periodBuckets(deltas, mode, keys) {
        if (mode === 'day') return deltas.map(r => ({ ...r }));
        const map = new Map();
        deltas.forEach(r => {
            const key = mode === 'week' ? weekKey(r.date) : r.date.slice(0, 7);
            if (!map.has(key)) { const e = { date: key }; keys.forEach(k => { e[k] = 0; }); map.set(key, e); }
            keys.forEach(k => { map.get(key)[k] += r[k] || 0; });
        });
        return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    }

    // ── Shared controls bar ───────────────────────────────────────────────────

    function makeControlBar(parent, onAll, onNone) {
        const bar = el('div', 'stat-controls');
        [['Select All', onAll], ['Deselect All', onNone]].forEach(([txt, fn]) => {
            const b = el('button', 'stat-ctrl-btn', txt);
            b.addEventListener('click', fn);
            bar.appendChild(b);
        });
        parent.appendChild(bar);
        return bar;
    }

    // ── Custom legend chips ───────────────────────────────────────────────────

    function buildLegend(parent, items, onToggle, onHover) {
        const wrap  = el('div', 'stat-legend');
        const chips = items.map((item, i) => {
            const chip = el('button', 'stat-legend-chip active');
            chip.style.setProperty('--chip-col', item.col);

            if (item.imgSrc) {
                const img = document.createElement('img');
                img.className = 'stat-legend-thumb'; img.src = item.imgSrc; img.loading = 'lazy'; img.alt = '';
                chip.appendChild(img);
            } else {
                const dot = el('span', 'stat-legend-dot');
                dot.style.background = item.col;
                chip.appendChild(dot);
            }

            chip.appendChild(el('span', 'stat-legend-label', item.label));
            chip.addEventListener('click', () => { const a = chip.classList.toggle('active'); onToggle(i, a); });
            if (onHover) {
                chip.addEventListener('mouseenter', () => onHover(i, true));
                chip.addEventListener('mouseleave', () => onHover(i, false));
            }
            wrap.appendChild(chip);
            return chip;
        });
        parent.appendChild(wrap);
        return chips;
    }

    function setChipsState(chips, visible) { chips.forEach((c, i) => c.classList.toggle('active', visible[i])); }

    // ── Mod aggregate (CF + MR + Total summed across all mods) ───────────────

    function computeModAggregate(mods, modRows) {
        const allDates = [...new Set(mods.flatMap(m => (modRows[m.id] || []).map(r => fmtDate(r.date))))].sort();
        const cf = {}, mr = {}, tot = {};
        allDates.forEach(d => { cf[d] = 0; mr[d] = 0; tot[d] = 0; });
        mods.forEach(m => {
            (modRows[m.id] || []).forEach(r => {
                const d = fmtDate(r.date);
                if (d in cf) { cf[d] += Number(r.downloads_cf) || 0; mr[d] += Number(r.downloads_mr) || 0; tot[d] += Number(r.downloads_total) || 0; }
            });
        });
        return allDates.map(d => ({ date: d, downloads_cf: cf[d], downloads_mr: mr[d], downloads_total: tot[d] }));
    }

    // ── Section: overview totals chart ────────────────────────────────────────

    function buildOverviewChart(container, title, icon, rows, valueKey, col) {
        const sorted  = [...rows].sort((a, b) => fmtDate(a.date).localeCompare(fmtDate(b.date)));
        const labels  = sorted.map(r => fmtDate(r.date));
        const data    = sorted.map(r => Number(r[valueKey]) || 0);
        const current = data.length ? data[data.length - 1] : 0;

        const section = el('section', 'stat-section');
        section.innerHTML = `
            <div class="stat-section-head">
                <h2 class="stat-section-title"><i class="fa ${icon}"></i> ${title}</h2>
                <span class="stat-big-num">${fmtNum(current)}</span>
            </div>
            <div class="stat-chart-wrap stat-chart-tall"><canvas></canvas></div>`;
        container.appendChild(section);

        const chartDiv = section.querySelector('.stat-chart-wrap');
        if (!labels.length) { chartDiv.innerHTML = '<p class="stat-no-data">No history yet.</p>'; return; }

        let chart = null;
        section.insertBefore(makeRangeEl(labels[0], labels[labels.length - 1], (from, to) => { if (chart) sliceChart(chart, labels, [data], from, to); }), chartDiv);
        chart = renderChart(chartDiv.querySelector('canvas'), labels, [mkDataset(title, data, col, { fill: true })]);
    }

    // ── Section: mod totals overview (CF + MR + Total) ────────────────────────

    function buildModOverviewChart(container, mods, modRows) {
        const agg = computeModAggregate(mods, modRows);
        if (!agg.length) return;

        const labels  = agg.map(r => r.date);
        const cfData  = agg.map(r => r.downloads_cf);
        const mrData  = agg.map(r => r.downloads_mr);
        const totData = agg.map(r => r.downloads_total);
        const current = totData[totData.length - 1] || 0;

        const section = el('section', 'stat-section');
        section.innerHTML = `
            <div class="stat-section-head">
                <h2 class="stat-section-title"><i class="fa fa-download"></i> Total Downloads</h2>
                <span class="stat-big-num">${fmtNum(current)}</span>
            </div>
            <div class="stat-chart-wrap stat-chart-tall"><canvas></canvas></div>`;
        container.appendChild(section);

        const chartDiv = section.querySelector('.stat-chart-wrap');
        let chart = null;
        section.insertBefore(makeRangeEl(labels[0], labels[labels.length - 1], (from, to) => { if (chart) sliceChart(chart, labels, [cfData, mrData, totData], from, to); }), chartDiv);

        const opts = baseOptions();
        opts.plugins.legend.display = true;
        opts.plugins.legend.labels  = { color: 'rgba(255,255,255,0.6)', boxWidth: 10, padding: 14 };
        chart = renderChart(chartDiv.querySelector('canvas'), labels, [
            mkDataset('CurseForge', cfData,  CF_COLOR),
            mkDataset('Modrinth',   mrData,  MR_COLOR),
            mkDataset('Total',      totData, TOT_COLOR, { fill: true }),
        ], opts);
    }

    // ── Per-entity delta line chart (New Downloads / New Views) ──────────────
    // deltaMap:  { id: [{date, value}] }  — pre-computed daily deltas per entity
    // entityMeta: [{id, label, col, imgSrc?}]

    function buildEntityDeltaChart(container, title, icon, deltaMap, entityMeta) {
        if (!entityMeta.length) return;

        // Sort by total delta value (highest first)
        entityMeta = [...entityMeta].sort((a, b) => {
            const sumA = (deltaMap[a.id] || []).reduce((s, r) => s + r.value, 0);
            const sumB = (deltaMap[b.id] || []).reduce((s, r) => s + r.value, 0);
            return sumB - sumA;
        });

        let mode    = 'day';
        let fromStr = null;
        let toStr   = null;
        let chart   = null;
        let chips   = null;
        const visible = new Array(entityMeta.length).fill(true);

        const section = el('section', 'stat-section');
        const head    = el('div', 'stat-section-head');
        head.innerHTML = `<h2 class="stat-section-title"><i class="fa ${icon}"></i> ${title}</h2>`;
        section.appendChild(head);

        // Select / Deselect All
        makeControlBar(head,
            () => { visible.fill(true);  entityMeta.forEach((_, i) => chart && chart.setDatasetVisibility(i, true));  chart && chart.update(); chips && setChipsState(chips, visible); },
            () => { visible.fill(false); entityMeta.forEach((_, i) => chart && chart.setDatasetVisibility(i, false)); chart && chart.update(); chips && setChipsState(chips, visible); },
        );

        // Day / Week / Month mode bar (right-aligned in head)
        const modeBar = el('div', 'stat-range-bar');
        modeBar.style.marginLeft = 'auto';
        let activeModeBtn = null;
        ['Day', 'Week', 'Month'].forEach(label => {
            const m   = label.toLowerCase();
            const btn = el('button', 'stat-ctrl-btn', label);
            btn.addEventListener('click', () => {
                if (activeModeBtn) activeModeBtn.classList.remove('is-active');
                (activeModeBtn = btn).classList.add('is-active');
                mode = m; render();
            });
            if (m === 'day') { btn.classList.add('is-active'); activeModeBtn = btn; }
            modeBar.appendChild(btn);
        });
        head.appendChild(modeBar);

        // Chart + legend layout
        const chartWrap  = el('div', 'stat-chart-wrap stat-chart-overlay');
        chartWrap.innerHTML = '<canvas></canvas>';
        const legendSide = el('div', 'stat-legend-side');
        const body       = el('div', 'stat-chart-and-legend');
        body.appendChild(chartWrap);
        body.appendChild(legendSide);

        // Date range control (between head and chart)
        const allDates = Object.values(deltaMap).flatMap(d => d.map(r => r.date)).sort();
        const lastDate = allDates[allDates.length - 1] || '';
        const firstDate = allDates[0] || '';
        const rangeEl  = makeRangeEl(firstDate, lastDate, (from, to) => { fromStr = from; toStr = to; render(); });
        section.appendChild(rangeEl);
        section.appendChild(body);
        container.appendChild(section);

        function render() {
            const dateBuckets = new Set();
            const bucketedMap = {};

            entityMeta.forEach(e => {
                let d = deltaMap[e.id] || [];
                if (fromStr) d = d.filter(r => r.date >= fromStr);
                if (toStr)   d = d.filter(r => r.date <= toStr);
                const b = periodBuckets(d, mode, ['value']);
                bucketedMap[e.id] = b;
                b.forEach(r => dateBuckets.add(r.date));
            });

            const labels   = [...dateBuckets].sort();
            const datasets = entityMeta.map((e, i) => {
                const byDate = Object.fromEntries((bucketedMap[e.id] || []).map(r => [r.date, r.value]));
                return mkDeltaDataset(e.label, labels.map(d => d in byDate ? byDate[d] : null), e.col || palette(i));
            });

            if (!chart) {
                chart = renderChart(chartWrap.querySelector('canvas'), labels, datasets, deltaOptions());
            } else {
                chart.data.labels = labels;
                chart.data.datasets.forEach((ds, i) => { ds.data = datasets[i].data; });
                entityMeta.forEach((_, i) => chart.setDatasetVisibility(i, visible[i]));
                chart.update('none');
            }
        }

        render();

        chips = buildLegend(legendSide, entityMeta.map((e, i) => ({
            label: e.label, imgSrc: e.imgSrc, col: e.col || palette(i),
        })), (i, active) => { visible[i] = active; chart && (chart.setDatasetVisibility(i, active), chart.update()); },
        (i, entering) => { if (chart) setGlow(chart, entering ? i : null); });
    }

    // ── Section: new downloads per mod (delta) ────────────────────────────────

    function buildDownloadsDeltaChart(container, mods, modRows) {
        const deltaMap   = {};
        const entityMeta = [];
        mods.forEach((m, i) => {
            const sorted = [...(modRows[m.id] || [])].sort((a, b) => fmtDate(a.date).localeCompare(fmtDate(b.date)));
            deltaMap[m.id] = computeEntityDeltas(sorted, 'downloads_total');
            entityMeta.push({ id: m.id, label: m.title, col: palette(i), imgSrc: m.icon });
        });
        buildEntityDeltaChart(container, 'New Downloads', 'fa-bar-chart', deltaMap, entityMeta);
    }

    // ── Section: new views per video (delta) ──────────────────────────────────

    function buildViewsDeltaChart(container, videos, videoRows) {
        const deltaMap   = {};
        const entityMeta = [];
        videos.forEach((v, i) => {
            const sorted = [...(videoRows[v.id] || [])].sort((a, b) => fmtDate(a.date).localeCompare(fmtDate(b.date)));
            deltaMap[v.id] = computeEntityDeltas(sorted, 'views');
            entityMeta.push({ id: v.id, label: v.title, col: palette(i), imgSrc: v.thumbnail });
        });
        buildEntityDeltaChart(container, 'New Views', 'fa-bar-chart', deltaMap, entityMeta);
    }

    // ── Section: YouTube overlay chart (cumulative per video) ─────────────────

    function buildVideoOverlayChart(container, videos, videoRows) {
        // Sort by latest cumulative view count (highest first)
        videos = [...videos].sort((a, b) => {
            const rowsA = [...(videoRows[a.id] || [])].sort((x, y) => fmtDate(x.date).localeCompare(fmtDate(y.date)));
            const rowsB = [...(videoRows[b.id] || [])].sort((x, y) => fmtDate(x.date).localeCompare(fmtDate(y.date)));
            return (Number(rowsB[rowsB.length - 1]?.views) || 0) - (Number(rowsA[rowsA.length - 1]?.views) || 0);
        });

        const section = el('section', 'stat-section');
        const head    = el('div', 'stat-section-head');
        head.innerHTML = `<h2 class="stat-section-title"><i class="fa fa-youtube-play"></i> Views Per Video</h2>`;
        section.appendChild(head);

        const entities = videos.map((v, i) => ({ label: v.title, rows: videoRows[v.id] || [], valueKey: 'views', col: palette(i) }));
        const { labels, datasets } = alignSeries(entities);
        const origData = datasets.map(ds => [...ds.data]);
        const visible  = new Array(videos.length).fill(true);

        let chart = null;
        let chips = null;

        makeControlBar(head,
            () => { visible.fill(true);  datasets.forEach((_, i) => chart && chart.setDatasetVisibility(i, true));  chart && chart.update(); chips && setChipsState(chips, visible); },
            () => { visible.fill(false); datasets.forEach((_, i) => chart && chart.setDatasetVisibility(i, false)); chart && chart.update(); chips && setChipsState(chips, visible); },
        );

        const chartWrap  = el('div', 'stat-chart-wrap stat-chart-overlay');
        chartWrap.innerHTML = '<canvas></canvas>';
        const legendSide = el('div', 'stat-legend-side');
        const body       = el('div', 'stat-chart-and-legend');
        body.appendChild(chartWrap);
        body.appendChild(legendSide);

        section.appendChild(makeRangeEl(labels[0] || '', labels[labels.length - 1] || '', (from, to) => { if (chart) sliceChart(chart, labels, origData, from, to); }));
        section.appendChild(body);
        container.appendChild(section);

        if (labels.length) {
            chart = renderChart(chartWrap.querySelector('canvas'), labels, datasets);
        } else {
            chartWrap.innerHTML = '<p class="stat-no-data">No history yet.</p>';
        }

        chips = buildLegend(legendSide, videos.map((v, i) => ({ label: v.title, imgSrc: v.thumbnail, col: palette(i) })),
            (i, active) => { visible[i] = active; chart && (chart.setDatasetVisibility(i, active), chart.update()); },
            (i, entering) => { if (chart) setGlow(chart, entering ? i : null); });
    }

    // ── Section: merged mod chart (cumulative per mod) ────────────────────────

    function buildModChart(container, mods, modRows) {
        // Sort by latest cumulative download count (highest first)
        mods = [...mods].sort((a, b) => {
            const rowsA = [...(modRows[a.id] || [])].sort((x, y) => fmtDate(x.date).localeCompare(fmtDate(y.date)));
            const rowsB = [...(modRows[b.id] || [])].sort((x, y) => fmtDate(x.date).localeCompare(fmtDate(y.date)));
            return (Number(rowsB[rowsB.length - 1]?.downloads_total) || 0) - (Number(rowsA[rowsA.length - 1]?.downloads_total) || 0);
        });

        const allDates   = [...new Set(mods.flatMap(m => (modRows[m.id] || []).map(r => fmtDate(r.date))))].sort();
        const allDatasets = [];
        const modRanges  = [];

        mods.forEach((m, mi) => {
            const byDate = {};
            (modRows[m.id] || []).forEach(r => { byDate[fmtDate(r.date)] = r; });
            const start = allDatasets.length;
            allDatasets.push(mkDataset(m.title, allDates.map(d => d in byDate ? (Number(byDate[d].downloads_total) || 0) : null), palette(mi)));
            modRanges.push({ start, end: allDatasets.length });
        });

        const visible = new Array(mods.length).fill(true);
        const section = el('section', 'stat-section');
        const head    = el('div', 'stat-section-head');
        head.innerHTML = `<h2 class="stat-section-title"><i class="fa fa-download"></i> Downloads Per Mod</h2>`;
        section.appendChild(head);

        let chart = null;
        let chips = null;

        function toggleMod(idx, active) {
            visible[idx] = active;
            if (!chart) return;
            const { start, end } = modRanges[idx];
            for (let di = start; di < end; di++) chart.setDatasetVisibility(di, active);
            chart.update();
        }

        makeControlBar(head,
            () => { visible.fill(true);  mods.forEach((_, i) => toggleMod(i, true));  chips && setChipsState(chips, visible); },
            () => { visible.fill(false); mods.forEach((_, i) => toggleMod(i, false)); chips && setChipsState(chips, visible); },
        );

        const chartWrap  = el('div', 'stat-chart-wrap stat-chart-overlay');
        chartWrap.innerHTML = '<canvas></canvas>';
        const legendSide = el('div', 'stat-legend-side');
        const body       = el('div', 'stat-chart-and-legend');
        body.appendChild(chartWrap);
        body.appendChild(legendSide);

        const origData = allDatasets.map(ds => [...ds.data]);
        section.appendChild(makeRangeEl(allDates[0] || '', allDates[allDates.length - 1] || '', (from, to) => { if (chart) sliceChart(chart, allDates, origData, from, to); }));
        section.appendChild(body);
        container.appendChild(section);

        if (allDates.length) {
            chart = renderChart(chartWrap.querySelector('canvas'), allDates, allDatasets);
        } else {
            chartWrap.innerHTML = '<p class="stat-no-data">No history yet.</p>';
        }

        chips = buildLegend(legendSide, mods.map((m, i) => ({ label: m.title, imgSrc: m.icon, col: palette(i) })),
            (i, active) => toggleMod(i, active),
            (i, entering) => { if (chart) setGlow(chart, entering ? modRanges[i].start : null); });
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    async function init() {
        applyDefaults();
        const container = document.getElementById('stats-container');
        if (!container) return;

        container.innerHTML = '<div class="stat-loading"><i class="fa fa-spinner fa-spin"></i> Loading statistics…</div>';

        const [statsData, modsData, ytTotals] = await Promise.all([
            fetchJSON('../data/statistics.json'),
            fetchJSON('../data/mods.json'),
            fetchCSV('../data/history/youtube/totals.csv'),
        ]);

        const videos = statsData?.videos ?? [];
        const mods   = modsData?.mods   ?? [];

        const [videoRowsArr, modRowsArr] = await Promise.all([
            Promise.all(videos.map(v => fetchCSV(`../data/history/youtube/videos/${v.id}.csv`))),
            Promise.all(mods.map(m => m.id ? fetchCSV(`../data/history/mods/${m.id}.csv`) : Promise.resolve([]))),
        ]);

        const videoRows = Object.fromEntries(videos.map((v, i) => [v.id, videoRowsArr[i]]));
        const modRows   = {};
        mods.forEach((m, i) => { if (m.id) modRows[m.id] = modRowsArr[i]; });

        container.innerHTML = '';

        // Build each chart in its own task, starting only after the open animation finishes.
        function scheduleBuilds(bodyEl, builders) {
            function runAll() {
                function next(i) {
                    if (i >= builders.length) return;
                    builders[i]();
                    setTimeout(() => next(i + 1), 0);
                }
                next(0);
            }
            // Wait for the CSS grid-template-rows transition to complete
            bodyEl.addEventListener('transitionend', function onEnd(e) {
                if (e.propertyName !== 'grid-template-rows') return;
                bodyEl.removeEventListener('transitionend', onEnd);
                runAll();
            });
        }

        function makeAccordion(label, icon, builders) {
            const acc    = el('div', 'stat-accordion');
            const header = el('button', 'stat-acc-header');
            header.innerHTML = `
                <span class="stat-acc-icon-wrap"><i class="fa ${icon}"></i></span>
                <span class="stat-acc-label">${label}</span>
                <i class="fa fa-chevron-down stat-acc-caret"></i>`;
            const bodyEl = el('div', 'stat-acc-body');
            const inner  = el('div', 'stat-acc-inner');
            bodyEl.appendChild(inner);
            acc.appendChild(header);
            acc.appendChild(bodyEl);
            container.appendChild(acc);

            let built = false;
            const panel = {
                open() {
                    acc.classList.add('is-open');
                    if (!built) { built = true; scheduleBuilds(bodyEl, builders.map(b => () => b(inner))); }
                },
                close() { acc.classList.remove('is-open'); },
                get isOpen() { return acc.classList.contains('is-open'); },
            };
            header.addEventListener('click', () => {
                if (panel.isOpen) { panel.close(); } else { panels.forEach(p => p.close()); panel.open(); }
            });
            return panel;
        }

        const panels = [
            makeAccordion('YouTube', 'fa-youtube-play', [
                inner => buildOverviewChart(inner, 'Total Views', 'fa-eye', ytTotals, 'views', YT_COLOR),
                inner => { if (videos.length) buildVideoOverlayChart(inner, videos, videoRows); },
                inner => { if (videos.length) buildViewsDeltaChart(inner, videos, videoRows); },
            ]),
            makeAccordion('Minecraft Mods', 'fa-puzzle-piece', [
                inner => { if (mods.length) buildModOverviewChart(inner, mods, modRows); },
                inner => { if (mods.length) buildModChart(inner, mods, modRows); },
                inner => { if (mods.length) buildDownloadsDeltaChart(inner, mods, modRows); },
            ]),
        ];

    }

    function boot() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    if (typeof Chart === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4';
        s.onload = boot;
        document.head.appendChild(s);
    } else {
        boot();
    }
})();
