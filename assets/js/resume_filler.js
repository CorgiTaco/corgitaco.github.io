(function () {

    // ── Hash router ───────────────────────────────────────────────────────────

    var _cache = {};  // populated after bootstrap; used by hashchange handler

    function pushHash(hash) {
        history.pushState(null, '', location.pathname + location.search + '#' + hash);
    }

    function clearHash() {
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    }

    function routeHash(hash) {
        switch (hash) {
            case 'youtube':
                if (_cache.statsData) openYoutubeModal(_cache.statsData);
                break;
            case 'downloads':
                openDownloadsModal(_cache.modrinthStats, _cache.curseforgeStats);
                break;
            case 'pdf':
                if (_cache._openPdfUI) _cache._openPdfUI();
                break;
        }
    }

    // ── Modal helpers ─────────────────────────────────────────────────────────

    function openModal(item, sectionLabel) {
        const overlay = document.getElementById('timeline-modal-overlay');
        const body    = document.getElementById('tm-body');
        const winTitle = document.getElementById('tm-win-title');

        const institution = item.employer || item.school || '';
        const skills = item.skills || [];

        winTitle.textContent = (institution || item.title) + ' — zsh';

        body.innerHTML = `
            <span class="tm-tag">${sectionLabel}</span>
            <h2 class="tm-title">${item.title}</h2>
            ${institution ? `<p class="tm-institution">${institution}</p>` : ''}
            ${item.date    ? `<p class="tm-date">${item.date}</p>` : ''}
            <hr class="tm-divider">
            <p class="tm-desc">${item.longDescription || item.description}</p>
            ${skills.length ? `
                <hr class="tm-divider">
                <div class="tm-skills">
                    ${skills.map(s => `<span class="tm-skill-tag">${s}</span>`).join('')}
                </div>` : ''}
        `;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModalUI() {
        const overlay = document.getElementById('timeline-modal-overlay');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function closeModal() {
        closeModalUI();
        clearHash();
    }

    function bindModalClose() {
        const overlay = document.getElementById('timeline-modal-overlay');
        const closeX  = document.getElementById('tm-close-x');
        const closeBtn = document.getElementById('tm-close-btn');

        if (closeX)  closeX.addEventListener('click', closeModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // ── Timeline builder ──────────────────────────────────────────────────────

    function populateTimeline(containerId, items, sectionLabel) {
        const container = document.getElementById(containerId);
        if (!container || !items) return;

        const sortedItems = [...items].sort((a, b) => {
            const aPresent = a.date && a.date.toLowerCase().includes('present');
            const bPresent = b.date && b.date.toLowerCase().includes('present');
            if (aPresent && !bPresent) return -1;
            if (!aPresent && bPresent) return 1;
            return 0;
        });

        const html = sortedItems.map(item => {
            const institution = item.employer || item.school || '';
            const institutionHtml = institution ? `<span class="timeline-institution">${institution}</span>` : '';
            const isPresent = item.date && item.date.toLowerCase().includes('present');
            const dotClass = isPresent ? 'timeline-dot glow' : 'timeline-dot';
            const dateHtml = item.date ? `<span class="timeline-date">${item.date}</span>` : '';

            return `
                <div class="timeline-item" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}' data-section="${sectionLabel}" role="button" tabindex="0" aria-label="Open details for ${item.title}">
                    <div class="${dotClass}"></div>
                    <h3 class="timeline-title">${item.title}</h3>
                    ${institutionHtml}
                    ${dateHtml}
                    <p class="timeline-desc">${item.description}</p>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

        // Bind click events
        container.querySelectorAll('.timeline-item').forEach(el => {
            const activate = () => {
                const item = JSON.parse(el.getAttribute('data-item').replace(/&#39;/g, "'"));
                const section = el.getAttribute('data-section');
                openModal(item, section);
            };
            el.addEventListener('click', activate);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
        });
    }

    // ── Testimonials carousel ─────────────────────────────────────────────────

    function buildTestimonials(testimonials) {
        const track = document.getElementById('testimonials-track');
        const wrap = track && track.closest('.testimonials-track-wrap');
        if (!track || !testimonials || !testimonials.length) return;

        // Inject overlay gradient arrows (fa-chevron icons matching projects carousel)
        const prevBtn = document.createElement('button');
        prevBtn.className = 'testimonials-carousel-arrow left';
        prevBtn.setAttribute('aria-label', 'Previous');
        prevBtn.innerHTML = '<i class="fa fa-chevron-left"></i>';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'testimonials-carousel-arrow right';
        nextBtn.setAttribute('aria-label', 'Next');
        nextBtn.innerHTML = '<i class="fa fa-chevron-right"></i>';

        wrap.appendChild(prevBtn);
        wrap.appendChild(nextBtn);

        // Identical smoothScroll to project_filler.js — cubic ease-out, 450ms
        function smoothScroll(element, distance, duration) {
            const start = element.scrollLeft;
            let startTime = null;
            function animation(currentTime) {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;
                const progress = Math.min(timeElapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);
                element.scrollLeft = start + (distance * ease);
                if (timeElapsed < duration) requestAnimationFrame(animation);
            }
            requestAnimationFrame(animation);
        }

        // Identical threshold logic to project_filler.js
        function updateArrows() {
            const canScrollLeft  = track.scrollLeft > 2;
            const canScrollRight = track.scrollLeft < (track.scrollWidth - track.clientWidth - 2);
            prevBtn.classList.toggle('visible', canScrollLeft);
            nextBtn.classList.toggle('visible', canScrollRight);
        }

        prevBtn.addEventListener('click', () => smoothScroll(track, -track.clientWidth * 0.75, 450));
        nextBtn.addEventListener('click', () => smoothScroll(track,  track.clientWidth * 0.75, 450));

        track.addEventListener('scroll', updateArrows);
        window.addEventListener('resize', updateArrows);

        function avatarHTML(t, size) {
            const cls = size === 'lg' ? 'tm-testimonial-avatar' : 'testimonial-avatar';
            return t.avatar
                ? `<div class="${cls}"><img src="${t.avatar}" alt="${t.name}" loading="lazy"></div>`
                : `<div class="${cls}"><i class="fa fa-user"></i></div>`;
        }

        track.innerHTML = testimonials.map((t, i) => {
            const hasUrl = t.url && t.url.trim();
            const linkIcon = hasUrl ? '<span class="link-icon"><i class="fa fa-external-link"></i></span>' : '';
            const nameLink = hasUrl
                ? `<a class="testimonial-name-link" href="${t.url}" target="_blank" rel="noopener noreferrer" title="View ${t.name}'s profile" onclick="event.stopPropagation()">
                       ${avatarHTML(t, 'sm')}
                       <p class="testimonial-name">${t.name}${linkIcon}</p>
                   </a>`
                : `${avatarHTML(t, 'sm')}
                   <p class="testimonial-name">${t.name}</p>`;
            const authorHTML = `<div class="testimonial-author">
                ${nameLink}
                <div class="testimonial-author-meta">
                    <p class="testimonial-role">${t.role}${t.company ? ' · ' + t.company : ''}</p>
                    ${t.date ? `<p class="testimonial-date">${t.date}</p>` : ''}
                </div>
            </div>`;
            return `
            <div class="testimonial-card" role="button" tabindex="0" aria-label="Read full testimonial from ${t.name}" data-index="${i}">
                <div class="testimonial-quote-mark">"</div>
                <p class="testimonial-text">${t.quote}</p>
                ${authorHTML}
            </div>`;
        }).join('');

        track.querySelectorAll('.testimonial-card').forEach(card => {
            const activate = () => {
                const idx = parseInt(card.getAttribute('data-index'), 10);
                openTestimonialModal(testimonials[idx]);
            };
            card.addEventListener('click', activate);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
        });

        // Identical initial state check to project_filler.js
        setTimeout(updateArrows, 100);
    }

    // ── Testimonial modal ─────────────────────────────────────────────────────

    function openTestimonialModal(t) {
        const overlay  = document.getElementById('timeline-modal-overlay');
        const body     = document.getElementById('tm-body');
        const winTitle = document.getElementById('tm-win-title');

        winTitle.textContent = t.name + ' — zsh';

        const modalAvatarHTML = t.avatar
            ? `<div class="tm-testimonial-avatar"><img src="${t.avatar}" alt="${t.name}" loading="lazy"></div>`
            : `<div class="tm-testimonial-avatar"><i class="fa fa-user"></i></div>`;
        const hasUrl = t.url && t.url.trim();
        const linkIcon = hasUrl ? '<span class="link-icon"><i class="fa fa-external-link"></i></span>' : '';
        const nameLink = hasUrl
            ? `<a class="tm-testimonial-name-link" href="${t.url}" target="_blank" rel="noopener noreferrer" title="View ${t.name}'s profile">
                   ${modalAvatarHTML}
                   <p class="tm-title" style="font-size:1.1rem;">${t.name}${linkIcon}</p>
               </a>`
            : `${modalAvatarHTML}
               <p class="tm-title" style="font-size:1.1rem;">${t.name}</p>`;
        const authorRowHTML = `<div class="tm-testimonial-author-row">
            ${nameLink}
            <div>
                <p class="tm-institution">${t.role}${t.company ? ' · ' + t.company : ''}</p>
                ${t.date ? `<p class="tm-date">${t.date}</p>` : ''}
            </div>
        </div>`;

        body.innerHTML = `
            <span class="tm-tag">Testimonial</span>
            <div class="tm-testimonial-quote-wrap">
                <span class="tm-big-quote">"</span>
                <p class="tm-desc" style="font-style:italic;">${t.quote}</p>
            </div>
            <hr class="tm-divider">
            ${authorRowHTML}
        `;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // ── YouTube videos modal ──────────────────────────────────────────────────

    function openYoutubeModal(statsData) {
        const overlay  = document.getElementById('timeline-modal-overlay');
        const body     = document.getElementById('tm-body');
        const winTitle = document.getElementById('tm-win-title');

        winTitle.textContent = 'youtube — zsh';

        const sorted = [...statsData.videos].sort((a, b) => b.viewCount - a.viewCount);

        const rowsHtml = sorted.map(v => {
            const thumb = v.thumbnail ? `<img class="yt-video-thumb" src="${escapeAttr(v.thumbnail)}" alt="" loading="lazy">` : '';
            return `
                <div class="yt-video-row" role="button" tabindex="0" data-video-id="${escapeAttr(v.videoId)}" data-title="${escapeAttr(v.title)}">
                    ${thumb}
                    <span class="yt-video-title">${escapeHTML(v.title)}</span>
                    <span class="yt-video-views">${formatNumber(v.viewCount)}</span>
                </div>
            `;
        }).join('');

        const asOf = statsData.fetchedAt
            ? makeAsOf(statsData.fetchedAt, 'yt-modal-asof')
            : '';

        body.innerHTML = `
            <span class="tm-tag">YouTube</span>
            <div class="yt-modal-total">
                <span class="yt-modal-total-num">${formatNumber(statsData.totalViews)}</span>
                <span class="yt-modal-total-label">total views across ${statsData.videoCount} videos</span>
                ${asOf}
            </div>
            <hr class="tm-divider">
            <div class="yt-video-list">${rowsHtml}</div>
        `;

        body.querySelectorAll('.yt-video-row').forEach(row => {
            const activate = () => openYoutubeVideoModal(row.dataset.videoId, row.dataset.title);
            row.addEventListener('click', activate);
            row.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
        });

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // ── YouTube video embed modal ─────────────────────────────────────────────

    function openYoutubeVideoModal(videoId, title) {
        const overlay  = document.getElementById('yt-video-overlay');
        const modal    = document.getElementById('yt-video-modal');
        const iframe   = document.getElementById('yt-video-iframe');
        const winTitle = document.getElementById('yt-video-win-title');

        winTitle.textContent = title + ' — zsh';
        iframe.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1';
        overlay.classList.add('active');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function bindYoutubeVideoModal() {
        const overlay = document.getElementById('yt-video-overlay');
        const modal   = document.getElementById('yt-video-modal');
        const iframe  = document.getElementById('yt-video-iframe');
        if (!overlay) return;

        function close() {
            overlay.classList.remove('active');
            modal.classList.remove('active');
            iframe.src = '';
            document.body.style.overflow = '';
        }

        document.getElementById('yt-video-close-x').addEventListener('click', close);
        document.getElementById('yt-video-back').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) close();
        });
    }

    // ── Downloads breakdown modal ─────────────────────────────────────────────

    function openDownloadsModal(modrinthStats, curseforgeStats) {
        const overlay  = document.getElementById('timeline-modal-overlay');
        const body     = document.getElementById('tm-body');
        const winTitle = document.getElementById('tm-win-title');

        winTitle.textContent = 'downloads — zsh';

        const cfVal  = curseforgeStats ? formatNumber(curseforgeStats.downloads) : '—';
        const cfAsOf = curseforgeStats && curseforgeStats.date
            ? makeAsOf(curseforgeStats.date, 'downloads-asof') : '';

        const mrVal  = modrinthStats ? formatNumber(modrinthStats.downloads) : '—';
        const mrAsOf = modrinthStats && modrinthStats.date
            ? makeAsOf(modrinthStats.date, 'downloads-asof') : '';

        body.innerHTML = `
            <span class="tm-tag">Downloads</span>
            <h2 class="tm-title">Minecraft Mod Downloads</h2>
            <hr class="tm-divider">
            <div class="downloads-breakdown">
                <div class="downloads-platform">
                    <img src="https://www.curseforge.com/favicon.ico" alt="CurseForge" class="downloads-platform-icon">
                    <span class="downloads-platform-stat">${cfVal}</span>
                    <span class="downloads-platform-label">CurseForge</span>
                    ${cfAsOf}
                </div>
                <div class="downloads-platform">
                    <img src="https://modrinth.com/favicon.ico" alt="Modrinth" class="downloads-platform-icon">
                    <span class="downloads-platform-stat">${mrVal}</span>
                    <span class="downloads-platform-label">Modrinth</span>
                    ${mrAsOf}
                </div>
            </div>
        `;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // ── PDF viewer modal ──────────────────────────────────────────────────────

    function bindPdfModal() {
        const PDF_SRC = '../assets/hire/resume.pdf';
        const overlay = document.getElementById('pdf-modal-overlay');
        const iframe  = document.getElementById('pdf-iframe');
        const openBtn = document.getElementById('open-pdf-btn');
        const closeX  = document.getElementById('pdf-close-x');

        if (!overlay || !openBtn) return;

        function openPdfUI() {
            iframe.src = PDF_SRC;
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closePdfUI() {
            overlay.classList.remove('active');
            iframe.src = '';
            document.body.style.overflow = '';
        }

        function openPdf() { pushHash('pdf'); openPdfUI(); }
        function closePdf() { closePdfUI(); clearHash(); }

        // Expose openPdfUI for the hashchange handler
        _cache._openPdfUI = openPdfUI;
        _cache._closePdfUI = closePdfUI;

        openBtn.addEventListener('click', openPdf);
        closeX.addEventListener('click', closePdf);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePdf(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) closePdf();
        });
        _cache._closePdfUI = closePdfUI;
    }

    // ── Contact card ─────────────────────────────────────────────────────────

    function buildContactCard(info) {
        const el = document.getElementById('resume-contact-card');
        if (!el || !info) return;

        const rows = [];
        if (info.jobTitle) {
            rows.push(`<p class="contact-job-title">${escapeHTML(info.jobTitle)}</p>`);
            rows.push('<hr class="contact-divider">');
        }
        if (info.email) {
            rows.push(`<div class="contact-row"><i class="fa fa-envelope"></i><a href="mailto:${escapeAttr(info.email)}">${escapeHTML(info.email)}</a></div>`);
        }
        if (info.phone) {
            rows.push(`<div class="contact-row"><i class="fa fa-phone"></i><a href="tel:${escapeAttr(info.phone)}">${escapeHTML(info.phone)}</a></div>`);
        }
        if (info.location) {
            rows.push(`<div class="contact-row"><i class="fa fa-map-marker"></i><span>${escapeHTML(info.location)}</span></div>`);
        }

        el.innerHTML = `
            <div class="contact-scroll">
                <div class="contact-header resume-header">
                    <i class="fa fa-address-card"></i> Contact
                </div>
                ${rows.join('')}
            </div>`;
    }

    // ── Looking For card ──────────────────────────────────────────────────────

    function buildLookingForCard(items) {
        const el = document.getElementById('resume-highlights-card');
        if (!el || !items || !items.length) return;

        const listHtml = items.map(h => `<li>${escapeHTML(h)}</li>`).join('');

        el.innerHTML = `
            <div class="highlights-scroll">
                <div class="highlights-header resume-header">
                    <i class="fa fa-search"></i> What I Am Looking For
                </div>
                <ul class="highlights-list">${listHtml}</ul>
            </div>`;
    }

    // ── Modrinth totals CSV parser ────────────────────────────────────────────

    function parseModrinthTotalsCsv(text) {
        const lines = text.trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
        if (lines.length < 2) return null;
        const headers = lines[0].split(',').map(h => h.trim());
        const values  = lines[lines.length - 1].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i]; });
        const downloads = parseInt(row.downloads, 10);
        if (isNaN(downloads)) return null;
        return { downloads, date: row.date || null };
    }

    // ── YouTube stats CSV parser ──────────────────────────────────────────────

    function parseYoutubeCsv(text) {
        const lines = text.trim().split('\n').filter(l => l.trim());
        if (lines.length < 2) return null;
        const headers = lines[0].split(',').map(h => h.trim());
        // Find the last row whose first column looks like a date/datetime
        let dataLine = null;
        for (let i = lines.length - 1; i >= 1; i--) {
            if (/^\d{4}/.test(lines[i].trim())) { dataLine = lines[i]; break; }
        }
        if (!dataLine) return null;
        const values = dataLine.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, i) => { row[h] = values[i]; });
        const views = parseInt(row.totalViews, 10);
        const count = parseInt(row.videoCount, 10);
        if (isNaN(views) || isNaN(count)) return null;
        return { views, videos: count, date: row.date || null };
    }

    function makeAsOf(isoStr, cssClass) {
        if (!isoStr) return '';
        var d = new Date(isoStr);
        if (isNaN(d)) return '';
        var short = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        var full  = d.toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
        return `<span class="${escapeAttr(cssClass)}" title="${escapeAttr(full)}">As of ${escapeHTML(short)}</span>`;
    }

    function calcYearsSince(yyyyMm) {
        var parts = yyyyMm.split('-');
        var start = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
        var years = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        var rounded = Math.round(years * 2) / 2;
        return (rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1)) + '+';
    }

    function formatNumber(n) {
        return Number(n).toLocaleString();
    }

    function formatViews(n) {
        n = Number(n);
        if (!isFinite(n) || n < 0) return '—';
        if (n >= 1e12) return (n / 1e12).toFixed(1).replace(/\.0$/, '') + 'T+';
        if (n >= 1e9)  return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B+';
        if (n >= 1e6)  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M+';
        if (n >= 1e3)  return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K+';
        return n + '+';
    }

    // ── Highlights cards section ──────────────────────────────────────────────

    function buildHighlightsSection(cards, youtubeStats, modrinthStats, statsData, curseforgeStats) {
        const el = document.getElementById('highlights-section');
        if (!el || !cards || !cards.length) return;

        const cardsHtml = cards.map(c => {
            var tag     = c.url ? 'a' : 'div';
            var attrs   = c.url ? ` href="${escapeAttr(c.url)}" target="_blank" rel="noopener noreferrer"` : '';
            var classes = 'highlight-card' + (c.url ? ' highlight-card-link' : '');

            if (c.dynamic === 'years_since' && c.since) {
                const sinceLabel = 'Since ' + (c.since_label || c.since);
                return `
                    <${tag} class="${classes}"${attrs}>
                        <i class="fa ${escapeAttr(c.icon)} highlight-card-icon"></i>
                        <span class="highlight-card-stat">${calcYearsSince(c.since)}</span>
                        <span class="highlight-card-label">${escapeHTML(c.label)}</span>
                        <span class="highlight-card-asof">${escapeHTML(sinceLabel)}</span>
                    </${tag}>
                `;
            }
            if (c.source === 'modrinth_stats' && (modrinthStats || curseforgeStats)) {
                const totalDl = (modrinthStats ? modrinthStats.downloads : 0) + (curseforgeStats ? curseforgeStats.downloads : 0);
                const dates = [modrinthStats && modrinthStats.date, curseforgeStats && curseforgeStats.date].filter(Boolean);
                const latestDate = dates.sort().pop();
                const asOf = latestDate ? makeAsOf(latestDate, 'highlight-card-asof') : '';
                return `
                    <div class="highlight-card highlight-card-link" role="button" tabindex="0" data-source="modrinth_stats" aria-label="View download breakdown">
                        <i class="fa fa-download highlight-card-icon"></i>
                        <span class="highlight-card-stat">${formatViews(totalDl)}</span>
                        <span class="highlight-card-label">Minecraft Mod Downloads</span>
                        ${asOf}
                    </div>
                `;
            }
            if (c.source === 'youtube_stats' && youtubeStats) {
                const asOf = youtubeStats.date ? makeAsOf(youtubeStats.date, 'highlight-card-asof') : '';
                return `
                    <div class="highlight-card highlight-card-link" role="button" tabindex="0" data-source="youtube_stats" aria-label="View YouTube video stats">
                        <i class="fa fa-youtube-play highlight-card-icon"></i>
                        <span class="highlight-card-stat">${formatViews(youtubeStats.views)}</span>
                        <span class="highlight-card-label">Views across ${youtubeStats.videos} Videos</span>
                        ${asOf}
                    </div>
                `;
            }
            return `
                <${tag} class="${classes}"${attrs}>
                    <i class="fa ${escapeAttr(c.icon)} highlight-card-icon"></i>
                    <span class="highlight-card-stat">${escapeHTML(c.stat)}</span>
                    <span class="highlight-card-label">${escapeHTML(c.label)}</span>
                </${tag}>
            `;
        }).join('');

        el.innerHTML = `
            <div class="highlights-cards-header resume-header">
                <i class="fa fa-star"></i> Highlights
            </div>
            <div class="highlights-cards-row">${cardsHtml}</div>
        `;

        el.querySelectorAll('[data-source="modrinth_stats"]').forEach(card => {
            const activate = () => { pushHash('downloads'); openDownloadsModal(_cache.modrinthStats, _cache.curseforgeStats); };
            card.addEventListener('click', activate);
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
        });

        if (statsData) {
            el.querySelectorAll('[data-source="youtube_stats"]').forEach(card => {
                const activate = () => { pushHash('youtube'); openYoutubeModal(_cache.statsData); };
                card.addEventListener('click', activate);
                card.addEventListener('keydown', e => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
                });
            });
        }
    }

    // ── Skills section ────────────────────────────────────────────────────────

    function collapseSkillRows(container, moreBtn) {
        const rows = Array.from(container.querySelectorAll('.skills-category-row'));
        if (rows.length <= 6) { moreBtn.hidden = true; return; }
        const hidden = rows.slice(6);
        hidden.forEach(r => r.classList.add('skill-hidden'));
        moreBtn.textContent = `+${hidden.length} more`;
        moreBtn.hidden = false;
        moreBtn.addEventListener('click', () => {
            hidden.forEach(r => r.classList.remove('skill-hidden'));
            moreBtn.hidden = true;
        }, { once: true });
    }

    function collapseOverflowPills(container) {
        const pills = Array.from(container.querySelectorAll('.skill-pill:not(.skill-pill-more)'));
        if (pills.length < 2) return;
        const firstTop = pills[0].offsetTop;
        const overflow = pills.filter(p => p.offsetTop > firstTop);
        if (!overflow.length) return;

        overflow.forEach(p => p.classList.add('skill-hidden'));

        const color = container.dataset.catColor || 'rgba(70,162,88,0.8)';
        const badge = document.createElement('div');
        badge.className = 'skill-pill skill-pill-more';
        badge.style.setProperty('--cat-color', color);
        badge.textContent = `+${overflow.length}`;
        container.appendChild(badge);

        // If the badge itself wraps, keep hiding visible pills until it sits on row 1
        const visible = pills.filter(p => !p.classList.contains('skill-hidden'));
        let extra = 0;
        while (badge.offsetTop > firstTop && visible.length > 0) {
            visible.pop().classList.add('skill-hidden');
            extra++;
            badge.textContent = `+${overflow.length + extra}`;
        }

        badge.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('skill-hidden'));
            badge.remove();
        }, { once: true });
    }

    function buildSkillsSection(skillsData) {
        const el = document.getElementById('skills-section');
        if (!el || !skillsData) return;

        const catMap = {};
        (skillsData.categories || []).forEach(c => { catMap[c.id] = c; });

        // Group skills by category in order they first appear
        const grouped = [];
        const buckets = {};
        skillsData.skills.forEach(s => {
            if (!buckets[s.category]) {
                const cat = catMap[s.category] || { id: s.category, label: s.category, color: '#888' };
                buckets[s.category] = [];
                grouped.push({ cat, skills: buckets[s.category] });
            }
            buckets[s.category].push(s);
        });

        const categoriesHtml = grouped.map(({ cat, skills }) => {
            const color = cat.color || 'rgba(70,162,88,0.8)';
            const pillsHtml = skills.map(s => {
                const tierClass = s.tier >= 1 && s.tier <= 3 ? `tier-${s.tier}` : '';
                return `<div class="skill-pill ${tierClass}" style="--cat-color:${escapeAttr(color)}">
                    <span class="skill-name">${escapeHTML(s.name)}</span>
                </div>`;
            }).join('');
            const icon = cat.icon || 'fa-circle';
            return `<div class="skills-category-row">
                <span class="skills-cat-label" style="color:${escapeAttr(color)}"><i class="fa fa-fw ${escapeAttr(icon)}"></i> ${escapeHTML(cat.label)}</span>
                <div class="skills-cat-pills" data-cat-color="${escapeAttr(color)}">${pillsHtml}</div>
            </div>`;
        }).join('');

        el.innerHTML = `
            <div class="skills-header resume-header">
                <i class="fa fa-bolt"></i> Skills
            </div>
            <div class="skills-categories">${categoriesHtml}</div>
            <button class="skills-more-btn" id="skills-more-btn" hidden></button>
        `;

        const labels = Array.from(el.querySelectorAll('.skills-cat-label'));
        const maxW = Math.max(...labels.map(l => l.scrollWidth));
        labels.forEach(l => l.style.width = maxW + 'px');

        collapseSkillRows(el.querySelector('.skills-categories'), el.querySelector('#skills-more-btn'));

        requestAnimationFrame(() => {
            el.querySelectorAll('.skills-cat-pills').forEach(collapseOverflowPills);
        });
    }

    // ── Escape helpers ────────────────────────────────────────────────────────

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/"/g, '&quot;');
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    function bootstrap() {
        bindModalClose();
        bindPdfModal();
        bindYoutubeVideoModal();

        // Prefix the commissions nav-link with the site base path so it works
        // on both GitHub Pages (basePath='') and IDE dev servers (basePath='/repo-name').
        var commLink = document.querySelector('#open-commission-link');
        if (commLink) commLink.setAttribute('href', (window._navBasePath || '') + '/commission');

        Promise.all([
            fetch('../assets/hire/resume.json').then(r => { if (!r.ok) throw new Error('resume.json load failed'); return r.json(); }),
            fetch('../data/youtube_stats.csv').then(r => r.ok ? r.text() : null).catch(() => null),
            fetch('../data/modrinth/project_totals.csv').then(r => r.ok ? r.text() : null).catch(() => null),
            fetch('../data/statistics.json').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('../data/curseforge/project_totals.csv').then(r => r.ok ? r.text() : null).catch(() => null),
            fetch('../assets/hire/skills.json').then(r => r.ok ? r.json() : null).catch(() => null)
        ]).then(function(results) {
            var data             = results[0];
            var csvText          = results[1];
            var modrinthText     = results[2];
            var statsData        = results[3];
            var curseforgeText   = results[4];
            var skillsData       = results[5];
            var youtubeStats     = csvText ? parseYoutubeCsv(csvText) : null;
            var modrinthStats    = modrinthText ? parseModrinthTotalsCsv(modrinthText) : null;
            var curseforgeStats  = curseforgeText ? parseModrinthTotalsCsv(curseforgeText) : null;
            buildContactCard(data.contact);
            buildLookingForCard(data.looking_for);
            buildHighlightsSection(data.highlight_cards, youtubeStats, modrinthStats, statsData, curseforgeStats);
            buildSkillsSection(skillsData);
            populateTimeline('experience-timeline', data.experience, 'Experience');
            populateTimeline('education-timeline', data.education, 'Education');
            buildTestimonials(data.testimonials);

            // Populate cache for hash router
            _cache.statsData       = statsData;
            _cache.modrinthStats   = modrinthStats;
            _cache.curseforgeStats = curseforgeStats;

            // Register hashchange listener (replace any previous from SPA re-run)
            if (window._resumeHashHandler) window.removeEventListener('hashchange', window._resumeHashHandler);
            window._resumeHashHandler = function () {
                var hash = location.hash.slice(1);
                if (!hash) {
                    // Back-button closed a modal — close whichever overlay is open
                    var overlay = document.getElementById('timeline-modal-overlay');
                    if (overlay && overlay.classList.contains('active')) closeModalUI();
                    var pdfOverlay = document.getElementById('pdf-modal-overlay');
                    if (pdfOverlay && pdfOverlay.classList.contains('active') && _cache._closePdfUI) _cache._closePdfUI();
                } else {
                    routeHash(hash);
                }
            };
            window.addEventListener('hashchange', window._resumeHashHandler);

            // Handle hash already present on page load
            if (location.hash) routeHash(location.hash.slice(1));
        }).catch(function(error) {
            console.error('Error loading resume data:', error);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();