(function () {
    const JSON_URL = '../assets/hire/commissions.json';

    // ── Helpers ───────────────────────────────────────────────────────────────

    function youtubeId(url) {
        var m = (url || '').match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        return m ? m[1] : null;
    }

    function slugify(str) {
        return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    function formatNum(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        return String(n);
    }

    // ── Tag chips (identical to project_filler.js) ───────────────────────────

    function buildProjTagChips(tags, maxVisible) {
        if (!tags || !tags.length) return '';
        var visible  = tags.slice(0, maxVisible || 99);
        var overflow = tags.length - visible.length;
        var chips    = visible.map(function (t) {
            return '<span class="proj-tag"><i class="fa fa-tag"></i>' + t + '</span>';
        }).join('');
        var more = overflow > 0 ? '<span class="proj-tag proj-tag-overflow">+' + overflow + '</span>' : '';
        return '<div class="proj-tag-row">' + chips + more + '</div>';
    }

    // ── Modal builders (identical HTML to project_filler.js) ─────────────────

    var _ytPlayer = null;

    function buildYoutubeModal(proj, id) {
        var vid     = youtubeId(proj.url);
        var title   = proj.title || 'Video';
        var tagHtml = buildProjTagChips(proj.tags || []);
        return (
            '<div class="modal-inner" id="comm-modal-' + id + '" data-yt-vid="' + (vid || '') + '" data-yt-url="' + (proj.url || '') + '">' +
                '<div class="modal-titlebar">' +
                    '<div class="modal-win-controls">' +
                        '<span class="modal-win-btn modal-win-close comm-proj-modal-close"></span>' +
                        '<span class="modal-win-btn modal-win-minimize"></span>' +
                        '<span class="modal-win-btn modal-win-maximize"></span>' +
                    '</div>' +
                    '<span class="modal-win-title">' + title + ' — zsh</span>' +
                    '<button class="modal-fav-btn btn-theme" title="Add to favorites"><i class="fa fa-star"></i></button>' +
                '</div>' +
                '<div class="modal-video-wrap">' +
                    '<div class="yt-player-slot"></div>' +
                    '<div class="yt-embed-fallback" style="display:none">' +
                        '<p>Embedding is disabled for this video.</p>' +
                        '<a href="' + (proj.url || '#') + '" target="_blank" rel="noopener" class="btn-theme"><i class="fa fa-youtube-play"></i> Watch on YouTube</a>' +
                    '</div>' +
                '</div>' +
                tagHtml +
                (proj.views > 0 ? '<div class="modal-downloads"><i class="fa fa-eye"></i> ' + formatNum(proj.views) + ' views</div>' : '') +
                (vid ? '<button class="modal-stats-btn btn-theme" data-stats-type="youtube" data-stats-id="' + vid + '" data-stats-title="' + title.replace(/"/g, '&quot;') + '"><i class="fa fa-bar-chart"></i> Statistics</button>' : '') +
                '<button class="modal-back btn-theme comm-proj-modal-close"><i class="fa fa-arrow-left"></i> Back</button>' +
            '</div>'
        );
    }

    function buildModModal(proj, id) {
        var links = [
            proj.curseforge ? '<a href="' + proj.curseforge + '" target="_blank" rel="noopener" class="btn-theme mod-link"><img src="https://www.curseforge.com/favicon.ico" alt=""> CurseForge</a>' : '',
            proj.modrinth   ? '<a href="' + proj.modrinth   + '" target="_blank" rel="noopener" class="btn-theme mod-link"><img src="https://modrinth.com/favicon.ico"   alt=""> Modrinth</a>'   : '',
            proj.github     ? '<a href="' + proj.github     + '" target="_blank" rel="noopener" class="btn-theme mod-link"><i class="fa fa-github"></i> GitHub</a>'                               : '',
        ].filter(Boolean).join('');
        var tagHtml = buildProjTagChips(proj.tags || []);
        var totalDl = (proj.downloads_cf || 0) + (proj.downloads_mr || 0);
        return (
            '<div class="modal-inner" id="comm-modal-' + id + '">' +
                '<div class="modal-titlebar">' +
                    '<div class="modal-win-controls">' +
                        '<span class="modal-win-btn modal-win-close comm-proj-modal-close"></span>' +
                        '<span class="modal-win-btn modal-win-minimize"></span>' +
                        '<span class="modal-win-btn modal-win-maximize"></span>' +
                    '</div>' +
                    '<span class="modal-win-title">' + proj.title + ' — zsh</span>' +
                    '<button class="modal-fav-btn btn-theme" title="Add to favorites"><i class="fa fa-star"></i></button>' +
                '</div>' +
                '<img class="modal-banner" src="' + (proj.photo || '') + '" alt="' + proj.title.replace(/"/g, '&quot;') + '">' +
                '<h2 class="modal-title">' + proj.title + '</h2>' +
                '<p class="modal-desc">' + (proj.excerpt || '') + '</p>' +
                tagHtml +
                (totalDl > 0 ? '<div class="modal-downloads"><i class="fa fa-download"></i> ' + formatNum(totalDl) + ' downloads</div>' : '') +
                (links ? '<div class="modal-links">' + links + '</div>' : '') +
                (proj.mod_id ? '<button class="modal-stats-btn btn-theme" data-stats-type="mod" data-stats-id="' + proj.mod_id + '" data-stats-title="' + proj.title.replace(/"/g, '&quot;') + '"><i class="fa fa-bar-chart"></i> Statistics</button>' : '') +
                '<button class="modal-back btn-theme comm-proj-modal-close"><i class="fa fa-arrow-left"></i> Back</button>' +
            '</div>'
        );
    }

    function openProjModal(id, proj) {
        var container = document.getElementById('projects-modals');
        var overlay   = document.getElementById('modal-overlay');
        if (!container || !overlay) return;

        var existing = document.getElementById('comm-modal-' + id);
        if (!existing) {
            var html = proj.type === 'youtube' ? buildYoutubeModal(proj, id) : buildModModal(proj, id);
            container.insertAdjacentHTML('beforeend', html);
            existing = document.getElementById('comm-modal-' + id);
        }

        container.querySelectorAll('.modal-inner').forEach(function (el) { el.classList.remove('active'); });
        existing.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Launch YouTube player
        if (proj.type === 'youtube') {
            var vid      = youtubeId(proj.url);
            var slot     = existing.querySelector('.yt-player-slot');
            var fallback = existing.querySelector('.yt-embed-fallback');
            if (vid && slot && window._loadYTApi) {
                _ytPlayer = window._destroyYTPlayer(_ytPlayer);
                window._loadYTApi(function () {
                    _ytPlayer = window._openYTPlayer(slot, fallback, vid);
                });
            }
        }

        // Close buttons
        existing.querySelectorAll('.comm-proj-modal-close').forEach(function (btn) {
            btn.style.cursor = 'pointer';
            btn.onclick = closeProjModal;
        });

        // Statistics button
        existing.querySelectorAll('.modal-stats-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (window.openProjectStats) {
                    window.openProjectStats(btn.dataset.statsType, btn.dataset.statsId, btn.dataset.statsTitle);
                }
            });
        });
    }

    function closeProjModal() {
        _ytPlayer = window._destroyYTPlayer ? window._destroyYTPlayer(_ytPlayer) : null;
        var overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('active');
        var container = document.getElementById('projects-modals');
        if (container) container.querySelectorAll('.modal-inner').forEach(function (el) { el.classList.remove('active'); });
        document.body.style.overflow = '';
    }

    // ── Project-style carousel cards (identical HTML to project_filler.js) ───

    function buildYoutubeProjectCard(proj) {
        var vid     = youtubeId(proj.url);
        var thumb   = 'https://img.youtube.com/vi/' + vid + '/hqdefault.jpg';
        var id      = 'yt-' + vid;
        var tagHtml = buildProjTagChips(proj.tags || [], 4);
        var viewsHtml = proj.views > 0
            ? '<div class="proj-downloads"><i class="fa fa-eye"></i> ' + formatNum(proj.views) + '</div>'
            : '';

        var card = document.createElement('div');
        card.className = 'proj-card';
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Open ' + proj.title);
        card.innerHTML =
            '<div class="proj-thumb yt-thumb">' +
                '<img src="' + thumb + '" alt="YouTube video thumbnail" loading="lazy" style="object-fit:cover">' +
                '<div class="yt-play">' +
                    '<svg class="yt-play-icon" viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg">' +
                        '<path class="yt-play-bg" d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.8 0 34 0 34 0S12.2 0 7.5 1.7a8.5 8.5 0 0 0-6 6C0 11.4 0 24 0 24s0 12.6 1.5 16.3a8.5 8.5 0 0 0 6 6C12.2 48 34 48 34 48s21.8 0 26.5-1.7a8.5 8.5 0 0 0 6-6C68 36.6 68 24 68 24s0-12.6-1.5-16.3z"/>' +
                        '<path class="yt-play-arrow" d="M27 34l18-10-18-10v20z"/>' +
                    '</svg>' +
                '</div>' +
            '</div>' +
            '<div class="proj-card-body">' +
                '<div class="proj-label"><i class="fa fa-youtube-play"></i> ' + proj.title + '</div>' +
                viewsHtml +
                tagHtml +
                (proj.excerpt ? '<p class="proj-card-excerpt">' + proj.excerpt + '</p>' : '') +
            '</div>';

        card.addEventListener('click', function () { openProjModal(id, proj); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') openProjModal(id, proj); });
        return card;
    }

    function buildModProjectCard(proj) {
        var id      = slugify(proj.title);
        var tagHtml = buildProjTagChips(proj.tags || [], 4);
        var totalDl = (proj.downloads_cf || 0) + (proj.downloads_mr || 0);
        var dlHtml  = totalDl > 0
            ? '<div class="proj-downloads"><i class="fa fa-download"></i> ' + formatNum(totalDl) + '</div>'
            : '';

        var card = document.createElement('div');
        card.className = 'proj-card';
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Open ' + proj.title);
        card.innerHTML =
            '<div class="proj-thumb">' +
                '<img src="' + (proj.photo || '') + '" alt="' + proj.title.replace(/"/g, '&quot;') + '" loading="lazy" style="object-fit:contain">' +
            '</div>' +
            '<div class="proj-card-body">' +
                '<div class="proj-label"><i class="fa fa-puzzle-piece"></i> ' + proj.title + '</div>' +
                dlHtml +
                tagHtml +
                (proj.excerpt ? '<p class="proj-card-excerpt">' + proj.excerpt + '</p>' : '') +
            '</div>';

        card.addEventListener('click', function () { openProjModal(id, proj); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') openProjModal(id, proj); });
        return card;
    }

    function buildProjectsCarousel(cards) {
        var wrap  = document.createElement('div');
        wrap.className = 'comm-carousel-wrap';

        var track = document.createElement('div');
        track.className = 'comm-carousel-track';

        cards.forEach(function (card) { track.appendChild(card); });

        var prevBtn = document.createElement('button');
        prevBtn.className = 'comm-carousel-arrow left';
        prevBtn.type = 'button';
        prevBtn.setAttribute('aria-label', 'Previous');
        prevBtn.innerHTML = '<i class="fa fa-chevron-left"></i>';

        var nextBtn = document.createElement('button');
        nextBtn.className = 'comm-carousel-arrow right';
        nextBtn.type = 'button';
        nextBtn.setAttribute('aria-label', 'Next');
        nextBtn.innerHTML = '<i class="fa fa-chevron-right"></i>';

        function updateArrows() {
            var atStart = track.scrollLeft <= 4;
            var atEnd   = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
            prevBtn.style.opacity       = atStart ? '0' : '1';
            prevBtn.style.pointerEvents = atStart ? 'none' : '';
            nextBtn.style.opacity       = atEnd   ? '0' : '1';
            nextBtn.style.pointerEvents = atEnd   ? 'none' : '';
        }

        prevBtn.addEventListener('click', function () { smoothScroll(track, -track.clientWidth * 0.75, 400); });
        nextBtn.addEventListener('click', function () { smoothScroll(track,  track.clientWidth * 0.75, 400); });
        track.addEventListener('scroll', updateArrows);

        wrap.appendChild(prevBtn);
        wrap.appendChild(track);
        wrap.appendChild(nextBtn);

        requestAnimationFrame(updateArrows);
        return wrap;
    }

    // ── Data fetching ─────────────────────────────────────────────────────────

    var _projectsData = null;

    function loadProjectsData() {
        if (_projectsData) return _projectsData;
        _projectsData = Promise.all([
            fetch('../data/statistics.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
            fetch('../data/mods.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
            fetch('../assets/projects/projects.json').then(function (r) { return r.json(); }).catch(function () { return []; })
        ]).then(function (results) {
            return { statsData: results[0], modsData: results[1], projectsJson: results[2] };
        });
        return _projectsData;
    }

    function injectProjectsCarousel(acc, type) {
        if (type !== 'youtube' && type !== 'mod') return;
        loadProjectsData().then(function (data) {
            var inner = acc.querySelector('.comm-acc-inner');
            if (!inner) return;

            var exLabel = document.createElement('h4');
            exLabel.className = 'comm-examples-label';
            exLabel.textContent = 'Examples';

            var cards = [];

            if (type === 'youtube') {
                var videos = (data.statsData && Array.isArray(data.statsData.videos))
                    ? data.statsData.videos
                    : data.projectsJson.filter(function (p) { return p.type === 'youtube'; });

                videos.slice(0, 20).forEach(function (v) {
                    var proj = v.url
                        ? v  // already a project object from projects.json
                        : { type: 'youtube', url: 'https://youtu.be/' + v.id, title: v.title, views: (v.stats && v.stats.views) || 0 };
                    if (youtubeId(proj.url)) cards.push(buildYoutubeProjectCard(proj));
                });
            } else if (type === 'mod') {
                var mods = (data.modsData && Array.isArray(data.modsData.mods))
                    ? data.modsData.mods.map(function (m) {
                        var stats    = m.stats || {};
                        var loaders  = Array.isArray(m.loaders)       ? m.loaders       : [];
                        var versions = Array.isArray(m.game_versions) ? m.game_versions : [];
                        return {
                            type:         'minecraft_mod',
                            mod_id:       m.id || null,
                            title:        m.title,
                            excerpt:      m.description,
                            photo:        m.icon,
                            curseforge:   m.curseforge_url || '',
                            modrinth:     m.modrinth_url   || '',
                            github:       m.github_url     || '',
                            downloads_cf: stats.downloads_cf || 0,
                            downloads_mr: stats.downloads_mr || 0,
                            tags:         [...loaders, ...versions]
                        };
                    })
                    : data.projectsJson.filter(function (p) { return p.type === 'minecraft_mod'; });

                mods.slice(0, 20).forEach(function (m) {
                    cards.push(buildModProjectCard(m));
                });
            }

            if (!cards.length) return;

            // Insert before the action button at the bottom
            var bodyBtn = inner.querySelector('.comm-body-modal-btn');
            inner.insertBefore(exLabel, bodyBtn);
            inner.insertBefore(buildProjectsCarousel(cards), bodyBtn);
        });
    }

    // ── Carousel ──────────────────────────────────────────────────────────────

    function smoothScroll(el, dist, dur) {
        var start = el.scrollLeft, startTime = null;
        function ease(t) { return 1 - Math.pow(1 - t, 3); }
        function step(now) {
            if (!startTime) startTime = now;
            var p = Math.min((now - startTime) / dur, 1);
            el.scrollLeft = start + dist * ease(p);
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function buildCarousel(examples) {
        var wrap = document.createElement('div');
        wrap.className = 'comm-carousel-wrap';

        var track = document.createElement('div');
        track.className = 'comm-carousel-track';

        examples.forEach(function (ex) {
            var card = document.createElement('div');
            card.className = 'comm-carousel-card';

            var inner = '';
            if (ex.image) {
                inner += '<div class="comm-card-img-wrap"><img class="comm-card-img" src="' + ex.image + '" alt="' + ex.title + '"></div>';
            } else {
                inner += '<div class="comm-card-img-placeholder"><i class="fa fa-image"></i></div>';
            }
            inner += '<div class="comm-card-body">';
            if (ex.link) {
                inner += '<a class="comm-card-title" href="' + ex.link + '" target="_blank" rel="noopener">' + ex.title + ' <i class="fa fa-external-link" style="font-size:0.7em;opacity:0.6"></i></a>';
            } else {
                inner += '<span class="comm-card-title">' + ex.title + '</span>';
            }
            if (ex.description) {
                inner += '<p class="comm-card-desc">' + ex.description + '</p>';
            }
            inner += '</div>';
            card.innerHTML = inner;
            track.appendChild(card);
        });

        var prevBtn = document.createElement('button');
        prevBtn.className = 'comm-carousel-arrow left';
        prevBtn.type = 'button';
        prevBtn.setAttribute('aria-label', 'Previous');
        prevBtn.innerHTML = '<i class="fa fa-chevron-left"></i>';

        var nextBtn = document.createElement('button');
        nextBtn.className = 'comm-carousel-arrow right';
        nextBtn.type = 'button';
        nextBtn.setAttribute('aria-label', 'Next');
        nextBtn.innerHTML = '<i class="fa fa-chevron-right"></i>';

        function updateArrows() {
            var atStart = track.scrollLeft <= 4;
            var atEnd   = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
            prevBtn.style.opacity       = atStart ? '0' : '1';
            prevBtn.style.pointerEvents = atStart ? 'none' : '';
            nextBtn.style.opacity       = atEnd   ? '0' : '1';
            nextBtn.style.pointerEvents = atEnd   ? 'none' : '';
        }

        prevBtn.addEventListener('click', function () { smoothScroll(track, -track.clientWidth * 0.75, 400); });
        nextBtn.addEventListener('click', function () { smoothScroll(track,  track.clientWidth * 0.75, 400); });
        track.addEventListener('scroll', updateArrows);

        wrap.appendChild(prevBtn);
        wrap.appendChild(track);
        wrap.appendChild(nextBtn);

        requestAnimationFrame(updateArrows);
        return wrap;
    }

    // ── Accordion ─────────────────────────────────────────────────────────────

    function buildAccordion(type) {
        var acc = document.createElement('div');
        acc.className = 'comm-accordion';
        acc.dataset.type = type.key;

        acc.innerHTML =
            '<div class="comm-acc-header">' +
                '<button class="comm-acc-toggle" type="button">' +
                    '<span class="stat-acc-icon-wrap"><i class="fa ' + type.icon + '"></i></span>' +
                    '<span class="stat-acc-label">' + type.label + '</span>' +
                '</button>' +
                '<button class="btn-theme comm-modal-btn" type="button" data-modal-type="' + type.modalType + '">' + type.btnLabel + '</button>' +
                '<button class="comm-acc-caret-btn" type="button" aria-label="Toggle"><i class="fa fa-chevron-down stat-acc-caret"></i></button>' +
            '</div>' +
            '<div class="comm-acc-body">' +
                '<div class="comm-acc-inner"></div>' +
            '</div>';

        var inner = acc.querySelector('.comm-acc-inner');

        if (type.description) {
            var desc = document.createElement('p');
            desc.className = 'comm-acc-desc';
            desc.textContent = type.description;
            inner.appendChild(desc);
        }

        // Static examples from JSON (used for plugin/port/other types)
        var usesProjectCarousel = (type.key === 'youtube' || type.key === 'mod');
        if (!usesProjectCarousel && type.examples && type.examples.length) {
            var exLabel = document.createElement('h4');
            exLabel.className = 'comm-examples-label';
            exLabel.textContent = 'Examples';
            inner.appendChild(exLabel);
            inner.appendChild(buildCarousel(type.examples));
        }

        var bodyBtn = document.createElement('button');
        bodyBtn.className = 'btn-theme comm-modal-btn comm-body-modal-btn';
        bodyBtn.type = 'button';
        bodyBtn.dataset.modalType = type.modalType;
        bodyBtn.textContent = type.btnLabel;
        inner.appendChild(bodyBtn);

        return acc;
    }

    function openAccordion(key) {
        document.querySelectorAll('.comm-accordion.is-open').forEach(function (a) {
            if (a.dataset.type !== key) a.classList.remove('is-open');
        });
        var acc = document.querySelector('.comm-accordion[data-type="' + key + '"]');
        if (acc) acc.classList.add('is-open');
    }

    function closeAccordion(key) {
        var acc = document.querySelector('.comm-accordion[data-type="' + key + '"]');
        if (acc) acc.classList.remove('is-open');
    }

    function wireAccordion(type) {
        var k   = type.key;
        var acc = document.querySelector('.comm-accordion[data-type="' + k + '"]');
        if (!acc) return;

        // Inject the live project carousel for youtube/mod types
        injectProjectsCarousel(acc, k);

        acc.querySelectorAll('.comm-modal-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var overlay = document.getElementById('commission-modal-overlay');
                if (overlay) overlay.classList.add('active');
                var sel = document.getElementById('commission-type');
                if (sel) {
                    sel.value = btn.dataset.modalType;
                    sel.dispatchEvent(new Event('change'));
                }
            });
        });

        function toggle() {
            if (acc.classList.contains('is-open')) {
                closeAccordion(k);
            } else {
                openAccordion(k);
            }
        }
        acc.querySelector('.comm-acc-toggle').addEventListener('click', toggle);
        acc.querySelector('.comm-acc-caret-btn').addEventListener('click', toggle);
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    function init() {
        var container = document.getElementById('commission-container');
        if (!container) return;

        // Close project modal on backdrop click or Escape
        var overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeProjModal();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeProjModal();
        });

        fetch(JSON_URL)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                (data.types || []).forEach(function (type) {
                    container.appendChild(buildAccordion(type));
                    wireAccordion(type);
                });
            })
            .catch(function (err) {
                console.error('Failed to load commissions.json', err);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
