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
            ${item.date     ? `<p class="tm-date">${item.date}</p>` : ''}
            ${item.location ? `<p class="tm-location">${escapeHTML(item.location)}</p>` : ''}
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
            const location = item.location ? `<span class="timeline-location">${escapeHTML(item.location)}</span>` : '';
            const metaHtml = institution || location
                ? `<span class="timeline-meta">${institution}${institution && location ? ' | ' : ''}${location}</span>`
                : '';
            const isPresent = item.date && item.date.toLowerCase().includes('present');
            const dotClass = isPresent ? 'timeline-dot glow' : 'timeline-dot';
            const dateHtml = item.date ? `<span class="timeline-date">${item.date}</span>` : '';

            return `
                <div class="timeline-item" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}' data-section="${sectionLabel}" role="button" tabindex="0" aria-label="Open details for ${item.title}">
                    <div class="${dotClass}"></div>
                    <h3 class="timeline-title">${item.title}</h3>
                    ${metaHtml}
                    ${dateHtml}
                    <p class="timeline-desc">${item.description}</p>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
        if (window._revealAll) window._revealAll(container.querySelectorAll('.timeline-item'));

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
        const section = track && track.closest('.testimonials-section');
        if (!track || !testimonials || !testimonials.length) {
            if (section) section.style.display = 'none';
            return;
        }

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

        function updateArrows() { window._updateCarouselArrows(track, prevBtn, nextBtn); }

        prevBtn.addEventListener('click', () => window._smoothScroll(track, -track.clientWidth * 0.75, 450));
        nextBtn.addEventListener('click', () => window._smoothScroll(track,  track.clientWidth * 0.75, 450));

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

        setTimeout(updateArrows, 100);
        if (window._revealEl && wrap) window._revealEl(wrap);
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

        const sorted = [...statsData.videos].sort((a, b) => (b.stats && b.stats.views || 0) - (a.stats && a.stats.views || 0));

        const rowsHtml = sorted.map(v => {
            const thumb = v.thumbnail ? `<img class="yt-video-thumb" src="${escapeAttr(v.thumbnail)}" alt="" loading="lazy">` : '';
            return `
                <div class="yt-video-row" role="button" tabindex="0" data-video-id="${escapeAttr(v.id)}" data-title="${escapeAttr(v.title)}">
                    ${thumb}
                    <span class="yt-video-title">${escapeHTML(v.title)}</span>
                    <span class="yt-video-views">${formatNumber(v.stats && v.stats.views || 0)}</span>
                </div>
            `;
        }).join('');

        const asOf = statsData.fetchedAt
            ? makeAsOf(statsData.fetchedAt, 'yt-modal-asof')
            : '';

        body.innerHTML = `
            <span class="tm-tag">YouTube</span>
            <div class="yt-modal-total">
                <span class="yt-modal-total-num">${formatNumber(statsData.totals && statsData.totals.views || 0)}</span>
                <span class="yt-modal-total-label">total views across ${statsData.totals && statsData.totals.video_count || 0} videos</span>
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

    // ── YouTube IFrame API helpers ────────────────────────────────────────────

    let _resumeYtPlayer = null;

    // ── YouTube video embed modal ─────────────────────────────────────────────

    function openYoutubeVideoModal(videoId, title) {
        const overlay   = document.getElementById('yt-video-overlay');
        const modal     = document.getElementById('yt-video-modal');
        const winTitle  = document.getElementById('yt-video-win-title');
        const slot      = document.getElementById('yt-video-player-slot');
        const fallback  = document.getElementById('yt-video-fallback');
        const fbLink    = document.getElementById('yt-video-fallback-link');
        const statsBtn  = document.getElementById('yt-video-stats-btn');

        winTitle.textContent = title + ' — zsh';
        overlay.classList.add('active');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (statsBtn) {
            statsBtn.dataset.videoId    = videoId;
            statsBtn.dataset.videoTitle = title;
            statsBtn.style.display      = '';
        }

        _resumeYtPlayer = window._destroyYTPlayer(_resumeYtPlayer);
        slot.innerHTML = '';
        slot.style.display = '';
        if (fallback) fallback.style.display = 'none';
        if (fbLink) fbLink.href = 'https://youtu.be/' + videoId;

        window._loadYTApi(function () {
            _resumeYtPlayer = window._openYTPlayer(slot, fallback, videoId);
        });
    }

    function bindYoutubeVideoModal() {
        const overlay  = document.getElementById('yt-video-overlay');
        const modal    = document.getElementById('yt-video-modal');
        const statsBtn = document.getElementById('yt-video-stats-btn');
        if (!overlay) return;

        function close() {
            if (window.closeProjectStats) window.closeProjectStats();
            _resumeYtPlayer = window._destroyYTPlayer(_resumeYtPlayer);
            overlay.classList.remove('active');
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }

        document.getElementById('yt-video-close-x').addEventListener('click', close);
        document.getElementById('yt-video-back').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active') && !window._projStatsOpen) close();
        });

        if (statsBtn) {
            statsBtn.addEventListener('click', () => {
                if (window.openProjectStats) {
                    window.openProjectStats('youtube', statsBtn.dataset.videoId, statsBtn.dataset.videoTitle);
                }
            });
        }
    }

    // ── Downloads breakdown modal ─────────────────────────────────────────────

    function openDownloadsModal(modrinthStats, curseforgeStats) {
        const overlay  = document.getElementById('timeline-modal-overlay');
        const body     = document.getElementById('tm-body');
        const winTitle = document.getElementById('tm-win-title');

        winTitle.textContent = 'downloads — zsh';

        const cfHtml = curseforgeStats ? `
                <div class="downloads-platform">
                    <img src="https://www.curseforge.com/favicon.ico" alt="CurseForge" class="downloads-platform-icon">
                    <span class="downloads-platform-stat">${formatNumber(curseforgeStats.downloads)}</span>
                    <span class="downloads-platform-label">CurseForge</span>
                    ${curseforgeStats.date ? makeAsOf(curseforgeStats.date, 'downloads-asof') : ''}
                </div>` : '';

        const mrHtml = modrinthStats ? `
                <div class="downloads-platform">
                    <img src="https://modrinth.com/favicon.ico" alt="Modrinth" class="downloads-platform-icon">
                    <span class="downloads-platform-stat">${formatNumber(modrinthStats.downloads)}</span>
                    <span class="downloads-platform-label">Modrinth</span>
                    ${modrinthStats.date ? makeAsOf(modrinthStats.date, 'downloads-asof') : ''}
                </div>` : '';

        body.innerHTML = `
            <span class="tm-tag">Downloads</span>
            <h2 class="tm-title">Minecraft Mod Downloads</h2>
            <hr class="tm-divider">
            <div class="downloads-breakdown">${cfHtml}${mrHtml}</div>
        `;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function showModalLoading(winTitleText) {
        var overlay  = document.getElementById('timeline-modal-overlay');
        var body     = document.getElementById('tm-body');
        document.getElementById('tm-win-title').textContent = winTitleText;
        body.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.5)"><i class="fa fa-spinner fa-spin"></i> Loading…</div>';
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function loadAndOpenDownloadsDelta(hoursBack, modsData, timestamp) {
        showModalLoading('downloads — zsh');
        var mods = (modsData && modsData.mods) || [];
        var fetches = mods.map(function(m) {
            return fetch('../data/history/mods/' + m.id + '.csv')
                .then(function(r) { return r.ok ? r.text() : null; }).catch(function() { return null; })
                .then(function(text) {
                    if (!text) return { cf: 0, mr: 0 };
                    var rows = parseCSVRows(text).filter(function(r) { return !isNaN(Number(r[1])); });
                    return {
                        cf: deltaFromRows(rows, 1, hoursBack) || 0,
                        mr: deltaFromRows(rows, 2, hoursBack) || 0,
                    };
                });
        });
        Promise.all(fetches).then(function(results) {
            var cfDelta = 0, mrDelta = 0;
            results.forEach(function(r) { cfDelta += r.cf; mrDelta += r.mr; });
            openDownloadsModal(
                mrDelta !== 0 ? { downloads: mrDelta, date: timestamp } : null,
                cfDelta !== 0 ? { downloads: cfDelta, date: timestamp } : null
            );
        });
    }

    function loadAndOpenYoutubeDelta(hoursBack, statsData, timestamp) {
        showModalLoading('youtube — zsh');
        var videos = (statsData && statsData.videos) || [];
        var fetches = videos.map(function(v) {
            return fetch('../data/history/youtube/videos/' + v.id + '.csv')
                .then(function(r) { return r.ok ? r.text() : null; }).catch(function() { return null; })
                .then(function(text) {
                    var delta = 0;
                    if (text) {
                        var rows = parseCSVRows(text).filter(function(r) { return !isNaN(Number(r[1])); });
                        delta = deltaFromRows(rows, 1, hoursBack) || 0;
                    }
                    return { id: v.id, title: v.title, channel: v.channel, thumbnail: v.thumbnail, stats: { views: delta } };
                });
        });
        Promise.all(fetches).then(function(deltaVideos) {
            var active = deltaVideos.filter(function(v) { return v.stats.views !== 0; });
            var totalViews = active.reduce(function(s, v) { return s + v.stats.views; }, 0);
            openYoutubeModal({
                fetchedAt: timestamp,
                totals: { views: totalViews, video_count: active.length },
                videos: active,
            });
        });
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
        if (info.discord) {
            const discordSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 127.14 96.36" style="width:1em;height:1em;vertical-align:middle;fill:currentColor;flex-shrink:0"><path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"/></svg>`;
            rows.push(`<div class="contact-row">${discordSvg}<a href="https://discord.com/users/715346528964968530" target="_blank" rel="noopener noreferrer">${escapeHTML(info.discord)}</a></div>`);
        }
        if (info.location) {
            rows.push(`<div class="contact-row"><i class="fa fa-map-marker"></i><a href="https://maps.app.goo.gl/7hDwy2MYbWrcAJkk9" target="_blank" rel="noopener noreferrer">${escapeHTML(info.location)}</a></div>`);
        }

        const pfpHtml = info.pfp
            ? `<div class="contact-pfp"><img class="contact-pfp-img" src="${escapeAttr(info.pfp)}" alt="Profile picture"></div>`
            : '';

        el.innerHTML = `
            <div class="contact-scroll">
                <div class="contact-header resume-header">
                    <i class="fa fa-address-card"></i> Contact
                </div>
                <div class="contact-inner">
                    ${pfpHtml}
                    <div class="contact-details">${rows.join('')}</div>
                </div>
            </div>`;
        var inner = el.querySelector('.contact-scroll');
        if (window._revealEl && inner) window._revealEl(inner);
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
        var inner = el.querySelector('.highlights-scroll');
        if (window._revealEl && inner) window._revealEl(inner);
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

    // ── History CSV helpers ───────────────────────────────────────────────────

    function parseCSVRows(text) {
        return text.trim().split(/\r?\n/).map(function (line) { return line.split(','); });
    }

    function deltaFromRows(rows, valueColIndex, hoursBack) {
        // Skip header row (first row has non-numeric values)
        var data = rows.filter(function(r) { return !isNaN(Number(r[valueColIndex])); });
        if (!data || data.length < 2) return null;
        var now    = new Date(data[data.length - 1][0]);
        var cutoff = new Date(now.getTime() - hoursBack * 3600 * 1000);
        var latest = Number(data[data.length - 1][valueColIndex]);
        var baseline = null;
        for (var i = data.length - 2; i >= 0; i--) {
            if (new Date(data[i][0]) <= cutoff) { baseline = Number(data[i][valueColIndex]); break; }
        }
        // Fall back to oldest row if history doesn't reach the cutoff
        if (baseline === null) baseline = Number(data[0][valueColIndex]);
        return latest - baseline;
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

    function buildHighlightsSection(cards, youtubeStats, modrinthStats, statsData, curseforgeStats, historyDeltas) {
        const el = document.getElementById('highlights-section');
        if (!el || !cards || !cards.length) return;

        var d = historyDeltas || {};

        function deltaCard(icon, val, label, asOfIso, source) {
            if (val === null || val === undefined) return '';
            var asOf  = asOfIso ? makeAsOf(asOfIso, 'highlight-card-asof') : '';
            var extra = source ? ` data-source="${source}"` : '';
            return `<div class="highlight-card highlight-card-link" role="button" tabindex="0"${extra}>
                <i class="fa ${icon} highlight-card-icon"></i>
                <span class="highlight-card-stat">${formatViews(Math.abs(val))}</span>
                <span class="highlight-card-label">${label}</span>
                ${asOf}
            </div>`;
        }

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
                ` + deltaCard('fa-download', d.mods24h, 'Last 24h Mod Downloads', d.modsTs, 'mods_delta_24h')
                  + deltaCard('fa-download', d.mods7d,  'Last 7d Mod Downloads',  d.modsTs, 'mods_delta_7d');
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
                ` + deltaCard('fa-eye', d.views24h, 'Last 24h YouTube Views', d.ytTs, 'youtube_delta_24h')
                  + deltaCard('fa-eye', d.views7d,  'Last 7d YouTube Views',  d.ytTs, 'youtube_delta_7d');
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

        if (historyDeltas) {
            var hd = historyDeltas;
            [
                { sel: 'mods_delta_24h',    fn: function() { loadAndOpenDownloadsDelta(24,  _cache.modsData, hd.modsTs); } },
                { sel: 'mods_delta_7d',     fn: function() { loadAndOpenDownloadsDelta(168, _cache.modsData, hd.modsTs); } },
                { sel: 'youtube_delta_24h', fn: function() { loadAndOpenYoutubeDelta(24,  _cache.statsData, hd.ytTs); } },
                { sel: 'youtube_delta_7d',  fn: function() { loadAndOpenYoutubeDelta(168, _cache.statsData, hd.ytTs); } },
            ].forEach(function(entry) {
                el.querySelectorAll('[data-source="' + entry.sel + '"]').forEach(function(card) {
                    card.addEventListener('click', entry.fn);
                    card.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entry.fn(); }
                    });
                });
            });
        }

        if (window._revealAll) window._revealAll(el.querySelectorAll('.highlight-card'));
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

        if (window._revealAll) {
            var visRows = Array.from(el.querySelectorAll('.skills-category-row'))
                .filter(function (r) { return !r.classList.contains('skill-hidden'); });
            window._revealAll(visRows);
        }

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

        // Spinners for data-filled sections; reveal static sections on scroll
        if (window._sectionSpinner) {
            ['resume-contact-card', 'resume-highlights-card', 'highlights-section',
             'experience-timeline', 'education-timeline', 'skills-section'].forEach(window._sectionSpinner);
        }
        if (window._revealAll) {
            var panels = document.querySelectorAll('.work-with-me-section .wwm-panel');
            if (panels.length) window._revealAll(panels);
        }

        Promise.all([
            fetch('../assets/hire/resume.json').then(r => { if (!r.ok) throw new Error('resume.json load failed'); return r.json(); }),
            fetch('../data/statistics.json').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('../data/mods.json').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('../assets/hire/skills.json').then(r => r.ok ? r.json() : null).catch(() => null),
            fetch('../data/history/mods/totals.csv').then(r => r.ok ? r.text() : null).catch(() => null),
            fetch('../data/history/youtube/totals.csv').then(r => r.ok ? r.text() : null).catch(() => null)
        ]).then(function(results) {
            var data        = results[0];
            var statsData   = results[1];
            var modsData    = results[2];
            var skillsData  = results[3];
            var modsCsv     = results[4];
            var ytCsv       = results[5];

            var youtubeStats = statsData && statsData.totals ? {
                views:  statsData.totals.views,
                videos: statsData.totals.video_count,
                date:   statsData.fetchedAt || null,
            } : null;

            var modrinthStats   = null;
            var curseforgeStats = null;
            if (modsData && modsData.mods) {
                var dlCF = 0, dlMR = 0;
                modsData.mods.forEach(function(m) {
                    dlCF += (m.stats && m.stats.downloads_cf) || 0;
                    dlMR += (m.stats && m.stats.downloads_mr) || 0;
                });
                curseforgeStats = { downloads: dlCF, date: modsData.fetchedAt || null };
                modrinthStats   = { downloads: dlMR, date: modsData.fetchedAt || null };
            }
            var historyDeltas = null;
            if (modsCsv || ytCsv) {
                var modsRows = modsCsv ? parseCSVRows(modsCsv) : null;
                var ytRows   = ytCsv   ? parseCSVRows(ytCsv)   : null;
                historyDeltas = {
                    mods24h:  modsRows ? deltaFromRows(modsRows, 1, 24)  : null,
                    mods7d:   modsRows ? deltaFromRows(modsRows, 1, 168) : null,
                    views24h: ytRows   ? deltaFromRows(ytRows,   2, 24)  : null,
                    views7d:  ytRows   ? deltaFromRows(ytRows,   2, 168) : null,
                    modsTs:   modsRows ? modsRows[modsRows.length - 1][0] : null,
                    ytTs:     ytRows   ? ytRows[ytRows.length - 1][0]     : null,
                };
            }

            buildContactCard(data.contact);
            buildLookingForCard(data.looking_for);
            buildHighlightsSection(data.highlight_cards, youtubeStats, modrinthStats, statsData, curseforgeStats, historyDeltas);
            buildSkillsSection(skillsData);
            populateTimeline('experience-timeline', data.experience, 'Experience');
            populateTimeline('education-timeline', data.education, 'Education');
            buildTestimonials(data.testimonials);

            // Populate cache for hash router
            _cache.statsData       = statsData;
            _cache.modsData        = modsData;
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

    // carousel-utils.js and yt-utils.js normally come from this page's <head>, but
    // SPA navigation (pagechange.js) only re-executes scripts inside #main — so when
    // arriving from a page whose <head> doesn't include them, load them here first
    // (same pattern stats_filler.js uses for Chart.js).
    function ensureHeadUtils(cb) {
        const base = window._navBasePath || '';
        const missing = [];
        if (!window._updateCarouselArrows) missing.push(base + '/assets/js/carousel-utils.js');
        if (!window._loadYTApi)            missing.push(base + '/assets/js/yt-utils.js');
        if (!missing.length) { cb(); return; }

        let pending = missing.length;
        missing.forEach(src => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = s.onerror = () => { if (--pending === 0) cb(); };
            document.head.appendChild(s);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ensureHeadUtils(bootstrap));
    } else {
        ensureHeadUtils(bootstrap);
    }
})();