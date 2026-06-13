(function () {

    // ── Helpers ──────────────────────────────────────────────────────────────

    function slugify(str) {
        return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    function youtubeId(url) {
        const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        return m ? m[1] : null;
    }

    function projectId(project, index) {
        if (project.type === 'youtube') {
            const vid = youtubeId(project.config.url);
            return 'yt-' + (vid || index);
        }
        if (project.config.name) return slugify(project.config.name);
        return 'project-' + index;
    }

    // ── Category / tag resolution ─────────────────────────────────────────────

    function typeToCategory(type) {
        if (!type) return 'Other';
        return type
            .split('_')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    function getCategory(proj) {
        return typeToCategory(proj.type);
    }

    function getCustomTags(proj) {
        return Array.isArray(proj.config.tags) ? [...proj.config.tags] : [];
    }

    // ── Card builders ────────────────────────────────────────────────────────

    function cardAttrs(id, category, tags, date, name) {
        const catSlug  = slugify(category);
        const tagSlugs = tags.map(t => slugify(t)).join(' ');
        const safeName = (name || '').replace(/"/g, '&quot;');
        const safeDate = date || '1970-01-01';
        return `data-id="${id}" data-category="${catSlug}" data-tags="${tagSlugs}" data-date="${safeDate}" data-name="${safeName}"`;
    }

    function buildYoutubeCard(cfg, id, category, tags) {
        const vid   = youtubeId(cfg.url);
        const thumb = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
        const fit   = cfg.thumb_fit || 'cover';
        const label = cfg.name || 'Video';
        return `
        <div class="proj-card" ${cardAttrs(id, category, tags, cfg.date, label)} tabindex="0" role="button" aria-label="Open ${label}">
            <div class="proj-thumb yt-thumb">
                <img src="${thumb}" alt="YouTube video thumbnail" loading="lazy" style="object-fit:${fit}">
                <div class="yt-play">
                    <svg class="yt-play-icon" viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg">
                        <path class="yt-play-bg" d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.8 0 34 0 34 0S12.2 0 7.5 1.7a8.5 8.5 0 0 0-6 6C0 11.4 0 24 0 24s0 12.6 1.5 16.3a8.5 8.5 0 0 0 6 6C12.2 48 34 48 34 48s21.8 0 26.5-1.7a8.5 8.5 0 0 0 6-6C68 36.6 68 24 68 24s0-12.6-1.5-16.3z"/>
                        <path class="yt-play-arrow" d="M27 34l18-10-18-10v20z"/>
                    </svg>
                </div>
            </div>
            <div class="proj-label"><i class="fa fa-youtube-play"></i> ${label}</div>
        </div>`;
    }

    function buildModCard(cfg, id, category, tags) {
        const fit = cfg.thumb_fit || 'cover';
        return `
        <div class="proj-card" ${cardAttrs(id, category, tags, cfg.date, cfg.name)} tabindex="0" role="button" aria-label="Open ${cfg.name}">
            <div class="proj-thumb">
                <img src="${cfg.photo}" alt="${cfg.name}" loading="lazy" style="object-fit:${fit}">
            </div>
            <div class="proj-label"><i class="fa fa-puzzle-piece"></i> ${cfg.name}</div>
        </div>`;
    }

    function buildProjectCard(cfg, id, category, tags) {
        const fit = cfg.thumb_fit || 'cover';
        return `
        <div class="proj-card" ${cardAttrs(id, category, tags, cfg.date, cfg.name)} tabindex="0" role="button" aria-label="Open ${cfg.name}">
            <div class="proj-thumb">
                <img src="${cfg.photo}" alt="${cfg.name}" loading="lazy" style="object-fit:${fit}">
            </div>
            <div class="proj-label"><i class="fa fa-folder-open"></i> ${cfg.name}</div>
        </div>`;
    }

    function buildCard(proj, id, category, tags) {
        if (proj.type === 'youtube')       return buildYoutubeCard(proj.config, id, category, tags);
        if (proj.type === 'minecraft_mod') return buildModCard(proj.config, id, category, tags);
        if (proj.type === 'project')       return buildProjectCard(proj.config, id, category, tags);
        return '';
    }

    // ── Modal builders ───────────────────────────────────────────────────────

    function buildYoutubeModal(cfg, id) {
        const vid      = youtubeId(cfg.url);
        const embedUrl = `https://www.youtube.com/embed/${vid}?autoplay=1`;
        return `
            <div class="modal-inner" id="modal-${id}">
                <div class="modal-video-wrap">
                    <iframe data-src="${embedUrl}" src="" frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen></iframe>
                </div>
                <button class="modal-back btn-theme"><i class="fa fa-arrow-left"></i> Back</button>
            </div>`;
    }

    function buildModModal(cfg, id) {
        const links = [
            cfg.curseforge ? `<a href="${cfg.curseforge}" target="_blank" rel="noopener" class="btn-theme mod-link"><img src="https://www.curseforge.com/favicon.ico" alt=""> CurseForge</a>` : '',
            cfg.modrinth   ? `<a href="${cfg.modrinth}"   target="_blank" rel="noopener" class="btn-theme mod-link"><img src="https://modrinth.com/favicon.ico"   alt=""> Modrinth</a>` : '',
            cfg.github     ? `<a href="${cfg.github}"     target="_blank" rel="noopener" class="btn-theme mod-link"><i class="fa fa-github"></i> GitHub</a>` : '',
        ].filter(Boolean).join('');
        return `
        <div class="modal-inner" id="modal-${id}">
            <img class="modal-banner" src="${cfg.photo}" alt="${cfg.name}">
            <h2 class="modal-title">${cfg.name}</h2>
            <p class="modal-desc">${cfg.description}</p>
            <div class="modal-links">${links}</div>
            <button class="modal-back btn-theme"><i class="fa fa-arrow-left"></i> Back</button>
        </div>`;
    }

    function buildProjectModal(cfg, id) {
        return `
            <div class="modal-inner" id="modal-${id}">
                <img class="modal-banner" src="${cfg.photo}" alt="${cfg.name}">
                <h2 class="modal-title">${cfg.name}</h2>
                <p class="modal-desc">${cfg.description}</p>
                ${cfg.link ? `<a href="${cfg.link}" target="_blank" rel="noopener" class="btn-theme modal-ext-link"><i class="fa fa-external-link"></i> Visit Project</a>` : ''}
                <button class="modal-back btn-theme"><i class="fa fa-arrow-left"></i> Back</button>
            </div>`;
    }

    function buildModal(proj, id) {
        if (proj.type === 'youtube')       return buildYoutubeModal(proj.config, id);
        if (proj.type === 'minecraft_mod') return buildModModal(proj.config, id);
        if (proj.type === 'project')       return buildProjectModal(proj.config, id);
        return '';
    }

    // ── Action Bars (Filter & Sort) ──────────────────────────────────────────

    function buildActionBars(categories, tagsByCategory) {
        const catChecks = categories.map(cat => `
            <label class="filter-tag">
                <input type="checkbox" class="cat-checkbox" value="${slugify(cat)}" checked>
                <span>${cat}</span>
            </label>`).join('');

        const catSection = `
            <div class="filter-section-wrap" id="filter-wrap-category">
                <div class="filter-section-label">Category</div>
                <label class="filter-tag filter-select-all-tag">
                    <input type="checkbox" class="section-select-all" data-section="category" checked>
                    <span>Select all</span>
                </label>
                <div class="filter-section" data-section="category">${catChecks}</div>
            </div>`;

        const allTagsFlat = [];
        const tagCatMap   = {};
        categories.forEach(cat => {
            const catSlug = slugify(cat);
            (tagsByCategory[cat] || []).forEach(tag => {
                const tagSlug = slugify(tag);
                if (!tagCatMap[tagSlug]) {
                    tagCatMap[tagSlug] = new Set();
                    allTagsFlat.push({ tag, tagSlug });
                }
                tagCatMap[tagSlug].add(catSlug);
            });
        });

        let tagSection = '';
        if (allTagsFlat.length) {
            const tagChecks = allTagsFlat.map(({ tag, tagSlug }) => {
                const cats = [...tagCatMap[tagSlug]].join(' ');
                return `
                <label class="filter-tag" data-tag-cats="${cats}">
                    <input type="checkbox" class="tag-checkbox" value="${tagSlug}" checked>
                    <span>${tag}</span>
                </label>`;
            }).join('');

            tagSection = `
            <div class="filter-section-wrap" id="filter-wrap-tags">
                <div class="filter-section-label">Tags</div>
                <label class="filter-tag filter-select-all-tag" id="tag-select-all-row">
                    <input type="checkbox" class="section-select-all" data-section="tags" checked>
                    <span>Select all</span>
                </label>
                <div class="filter-section" data-section="tags">${tagChecks}</div>
            </div>`;
        }

        const filterHtml = `
        <div id="filter-bar">
            <button id="filter-toggle" class="btn-theme">
                <i class="fa fa-filter"></i><span> Filter </span><i class="fa fa-chevron-down" id="filter-chevron"></i>
            </button>
            <div id="filter-dropdown">
                ${catSection}
                ${tagSection}
            </div>
        </div>`;

        const sortHtml = `
        <div id="sort-bar">
            <button id="sort-toggle" class="btn-theme">
                <i class="fa fa-sort"></i><span> Sort </span><i class="fa fa-chevron-down" id="sort-chevron"></i>
            </button>
            <div id="sort-dropdown">
                <label class="filter-tag"><input type="radio" name="sort-by" value="date-desc" checked><span>Date (Newest)</span></label>
                <label class="filter-tag"><input type="radio" name="sort-by" value="date-asc"><span>Date (Oldest)</span></label>
                <label class="filter-tag"><input type="radio" name="sort-by" value="name-asc"><span>Name (A-Z)</span></label>
                <label class="filter-tag"><input type="radio" name="sort-by" value="name-desc"><span>Name (Z-A)</span></label>
                <label class="filter-tag"><input type="radio" name="sort-by" value="tags-asc"><span>Tags (A-Z)</span></label>
            </div>
        </div>`;

        return filterHtml + sortHtml;
    }

    // ── Carousel layout builder ──────────────────────────────────────────────

    function buildCarouselLayout(projects, presentCats, tagsByCategory) {
        const catSlugMap = {};
        presentCats.forEach(cat => { catSlugMap[slugify(cat)] = cat; });

        const byCategory = {};
        presentCats.forEach(cat => { byCategory[cat] = []; });
        projects.forEach((proj, i) => {
            const cat = getCategory(proj);
            if (byCategory[cat]) {
                byCategory[cat].push({ proj, i });
            }
        });

        const rows = presentCats.map(cat => {
            const catSlug = slugify(cat);
            const tags    = tagsByCategory[cat] || [];

            // Per row filter dropdown
            const tagChecks = tags.map(t => `
                <label class="filter-tag">
                    <input type="checkbox" class="carousel-tag-cb" value="${slugify(t)}" checked>
                    <span>${t}</span>
                </label>`).join('');

            const rowDropdown = tags.length ? `
                <div class="carousel-filter-bar">
                    <button class="btn-theme carousel-filter-toggle">
                        <i class="fa fa-filter"></i><span> Filter </span><i class="fa fa-chevron-down carousel-filter-chevron"></i>
                    </button>
                    <div class="carousel-filter-dropdown">
                        <div class="filter-section-wrap" style="padding-left:0">
                            <label class="filter-tag filter-select-all-tag">
                                <input type="checkbox" class="carousel-select-all" checked>
                                <span>Select all</span>
                            </label>
                            <div class="filter-section">${tagChecks}</div>
                        </div>
                    </div>
                </div>` : '';

            // Per row sort dropdown
            const rowSort = `
                <div class="carousel-sort-bar">
                    <button class="btn-theme carousel-sort-toggle">
                        <i class="fa fa-sort"></i><span> Sort </span><i class="fa fa-chevron-down carousel-sort-chevron"></i>
                    </button>
                    <div class="carousel-sort-dropdown">
                        <label class="filter-tag"><input type="radio" name="sort-${catSlug}" value="date-desc" checked><span>Date (Newest)</span></label>
                        <label class="filter-tag"><input type="radio" name="sort-${catSlug}" value="date-asc"><span>Date (Oldest)</span></label>
                        <label class="filter-tag"><input type="radio" name="sort-${catSlug}" value="name-asc"><span>Name (A-Z)</span></label>
                        <label class="filter-tag"><input type="radio" name="sort-${catSlug}" value="name-desc"><span>Name (Z-A)</span></label>
                        <label class="filter-tag"><input type="radio" name="sort-${catSlug}" value="tags-asc"><span>Tags (A-Z)</span></label>
                    </div>
                </div>`;

            const cards = byCategory[cat].map(({ proj, i }) => {
                const id       = projectId(proj, i);
                const category = getCategory(proj);
                const tags     = getCustomTags(proj);
                return buildCard(proj, id, category, tags);
            }).join('');

            return `
            <div class="cat-row" data-cat="${catSlug}">
                <div class="cat-row-header">
                    <h2 class="cat-row-title">${cat}</h2>
                    <div class="cat-row-actions">
                        ${rowSort}
                        ${rowDropdown}
                    </div>
                </div>
                <div class="cat-carousel-wrap">
                    <button class="carousel-arrow left"><i class="fa fa-chevron-left"></i></button>
                    <div class="cat-carousel">${cards}</div>
                    <button class="carousel-arrow right"><i class="fa fa-chevron-right"></i></button>
                </div>
            </div>`;
        }).join('');

        return `<div id="carousel-layout">${rows}</div>`;
    }

    // ── Wire Actions (Filter / Sort / Carousel Filters / Arrows) ─────────────

    function wireCarouselArrows() {
        // Custom animation function to force smooth scrolling in all browsers
        function smoothScroll(element, distance, duration) {
            const start = element.scrollLeft;
            let startTime = null;

            function animation(currentTime) {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;

                // Calculate progress (0 to 1)
                const progress = Math.min(timeElapsed / duration, 1);

                // Ease-out cubic formula for a natural deceleration
                const ease = 1 - Math.pow(1 - progress, 3);

                element.scrollLeft = start + (distance * ease);

                if (timeElapsed < duration) {
                    requestAnimationFrame(animation);
                }
            }
            requestAnimationFrame(animation);
        }

        document.querySelectorAll('.cat-carousel-wrap').forEach(wrap => {
            const track = wrap.querySelector('.cat-carousel');
            const leftBtn = wrap.querySelector('.carousel-arrow.left');
            const rightBtn = wrap.querySelector('.carousel-arrow.right');

            function updateArrows() {
                if (!track) return;
                // Buffer of a few pixels to account for fractional rendering widths
                const canScrollLeft = track.scrollLeft > 2;
                const canScrollRight = track.scrollLeft < (track.scrollWidth - track.clientWidth - 2);

                leftBtn.classList.toggle('visible', canScrollLeft);
                rightBtn.classList.toggle('visible', canScrollRight);
            }

            track.addEventListener('scroll', updateArrows);
            window.addEventListener('resize', updateArrows);

            leftBtn.addEventListener('click', () => {
                // Scroll left by 75% of container width over 450 milliseconds
                smoothScroll(track, -track.clientWidth * 0.75, 450);
            });

            rightBtn.addEventListener('click', () => {
                // Scroll right by 75% of container width over 450 milliseconds
                smoothScroll(track, track.clientWidth * 0.75, 450);
            });

            // Expose the update function on the element for sorting/filtering redraws
            track._updateArrows = updateArrows;

            // Check visibility immediately (with slight delay for paint)
            setTimeout(updateArrows, 100);
        });
    }
    function wireCarouselFilters() {
        document.querySelectorAll('.cat-row').forEach(row => {
            const filterBar = row.querySelector('.carousel-filter-bar');
            if (!filterBar) return;

            const toggleBtn = filterBar.querySelector('.carousel-filter-toggle');
            const dropdown  = filterBar.querySelector('.carousel-filter-dropdown');
            const chevron   = filterBar.querySelector('.carousel-filter-chevron');
            const selectAll = filterBar.querySelector('.carousel-select-all');

            toggleBtn.addEventListener('click', e => {
                e.stopPropagation();
                const open = dropdown.classList.toggle('open');
                chevron.style.transform = open ? 'rotate(180deg)' : '';
            });

            document.addEventListener('click', e => {
                if (!filterBar.contains(e.target)) {
                    dropdown.classList.remove('open');
                    chevron.style.transform = '';
                }
            });

            dropdown.addEventListener('click', e => e.stopPropagation());

            selectAll.addEventListener('change', () => {
                dropdown.querySelectorAll('.carousel-tag-cb').forEach(cb => {
                    cb.checked = selectAll.checked;
                });
                applyCarouselFilter(row, dropdown);
            });

            dropdown.querySelectorAll('.carousel-tag-cb').forEach(cb => {
                cb.addEventListener('change', () => {
                    const all = [...dropdown.querySelectorAll('.carousel-tag-cb')].every(c => c.checked);
                    selectAll.checked = all;
                    applyCarouselFilter(row, dropdown);
                });
            });
        });
    }

    function applyCarouselFilter(row, dropdown) {
        const checked = [...dropdown.querySelectorAll('.carousel-tag-cb:checked')].map(cb => cb.value);
        const selectAllChecked = dropdown.querySelector('.carousel-select-all').checked;

        row.querySelectorAll('.proj-card').forEach(card => {
            const cardTags = (card.dataset.tags || '').split(' ').filter(Boolean);

            if (selectAllChecked) {
                card.style.display = '';
            } else if (cardTags.length === 0) {
                // If filters are active (not Select All), hide items that have zero tags
                card.style.display = 'none';
            } else {
                card.style.display = cardTags.some(t => checked.includes(t)) ? '' : 'none';
            }
        });

        // Update the arrow visibility because flex elements disappeared/reappeared
        const track = row.querySelector('.cat-carousel');
        if (track && track._updateArrows) track._updateArrows();
    }

    function wireCarouselSort() {
        document.querySelectorAll('.cat-row').forEach(row => {
            const sortBar = row.querySelector('.carousel-sort-bar');
            if (!sortBar) return;

            const toggleBtn = sortBar.querySelector('.carousel-sort-toggle');
            const dropdown  = sortBar.querySelector('.carousel-sort-dropdown');
            const chevron   = sortBar.querySelector('.carousel-sort-chevron');
            const track     = row.querySelector('.cat-carousel');

            toggleBtn.addEventListener('click', e => {
                e.stopPropagation();
                const open = dropdown.classList.toggle('open');
                chevron.style.transform = open ? 'rotate(180deg)' : '';
            });

            document.addEventListener('click', e => {
                if (!sortBar.contains(e.target)) {
                    dropdown.classList.remove('open');
                    chevron.style.transform = '';
                }
            });

            dropdown.addEventListener('click', e => e.stopPropagation());

            dropdown.addEventListener('change', e => {
                if (e.target.type === 'radio') {
                    applyLocalSort(track, e.target.value);
                }
            });
        });
    }

    function applyLocalSort(track, sortVal) {
        const safeDate = (d) => {
            const time = new Date(d).getTime();
            return isNaN(time) ? 0 : time;
        };

        const sortFn = (a, b) => {
            if (sortVal === 'date-desc') {
                return safeDate(b.dataset.date) - safeDate(a.dataset.date);
            } else if (sortVal === 'date-asc') {
                return safeDate(a.dataset.date) - safeDate(b.dataset.date);
            } else if (sortVal === 'name-asc') {
                return a.dataset.name.localeCompare(b.dataset.name);
            } else if (sortVal === 'name-desc') {
                return b.dataset.name.localeCompare(a.dataset.name);
            } else if (sortVal === 'tags-asc') {
                const tagCmp = a.dataset.tags.localeCompare(b.dataset.tags);
                return tagCmp !== 0 ? tagCmp : a.dataset.name.localeCompare(b.dataset.name);
            }
            return 0;
        };

        const cards = Array.from(track.querySelectorAll('.proj-card'));
        cards.sort(sortFn).forEach(card => track.appendChild(card));

        if (track._updateArrows) track._updateArrows();
    }

    function wireFilter() {
        const bar = document.getElementById('filter-bar');
        if (!bar) return;

        const toggle   = document.getElementById('filter-toggle');
        const dropdown = document.getElementById('filter-dropdown');
        const chevron  = document.getElementById('filter-chevron');

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = dropdown.classList.toggle('open');
            chevron.style.transform = open ? 'rotate(180deg)' : '';
        });

        document.addEventListener('click', (e) => {
            if (!bar.contains(e.target) && !toggle.contains(e.target)) {
                dropdown.classList.remove('open');
                chevron.style.transform = '';
            }
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());

        function checkedCats() {
            return [...dropdown.querySelectorAll('.cat-checkbox:checked')].map(cb => cb.value);
        }

        function checkedTags() {
            return [...dropdown.querySelectorAll('.tag-checkbox:checked')]
                .filter(cb => !cb.closest('.filter-tag').classList.contains('tag-disabled'))
                .map(cb => cb.value);
        }

        function syncTagVisibility() {
            const activeCats = new Set(checkedCats());
            const tagSection = dropdown.querySelector('.filter-section[data-section="tags"]');
            if (!tagSection) return;

            tagSection.querySelectorAll('.filter-tag').forEach(row => {
                const rowCats = (row.dataset.tagCats || '').split(' ').filter(Boolean);
                const active  = rowCats.some(c => activeCats.has(c));
                row.classList.toggle('tag-disabled', !active);
                row.querySelector('.tag-checkbox').disabled = !active;
            });

            const enabledCbs = [...tagSection.querySelectorAll('.tag-checkbox')]
                .filter(cb => !cb.disabled);
            const allChecked = enabledCbs.length > 0 && enabledCbs.every(cb => cb.checked);
            const sa = dropdown.querySelector('.section-select-all[data-section="tags"]');
            if (sa) sa.checked = allChecked;
        }

        function applyFilter() {
            const activeCats = new Set(checkedCats());
            const activeTags = new Set(checkedTags());

            document.querySelectorAll('#projects-grid .proj-card').forEach(card => {
                const cardCat  = card.dataset.category || '';
                const cardTags = (card.dataset.tags || '').split(' ').filter(Boolean);

                if (!activeCats.has(cardCat)) { card.style.display = 'none'; return; }
                if (cardTags.length === 0)    { card.style.display = '';     return; }

                const relevantTagsChecked = cardTags.some(t => activeTags.has(t));
                const anyTagsEnabledForCat = [...dropdown.querySelectorAll('.filter-tag[data-tag-cats]')]
                    .some(row => {
                        const rowCats = (row.dataset.tagCats || '').split(' ');
                        return rowCats.includes(cardCat) && !row.classList.contains('tag-disabled');
                    });

                card.style.display = (!anyTagsEnabledForCat || relevantTagsChecked) ? '' : 'none';
            });

            pushFilterHash();
        }

        function pushFilterHash() {
            if (location.hash.startsWith('#project-')) return;
            const cats  = checkedCats();
            const tags  = checkedTags();
            const parts = [];
            if (cats.length) parts.push('cats=' + cats.join(','));
            if (tags.length) parts.push('tags=' + tags.join(','));
            history.replaceState(null, '', parts.length ? '#' + parts.join('&') : '#');
        }

        function loadFromHash() {
            const hash     = location.hash;
            const catMatch = hash.match(/cats=([^&]*)/);
            const tagMatch = hash.match(/tags=([^&]*)/);
            if (!catMatch && !tagMatch) return;

            const activeCats = catMatch && catMatch[1] ? new Set(catMatch[1].split(',')) : new Set();
            const activeTags = tagMatch && tagMatch[1] ? new Set(tagMatch[1].split(',')) : new Set();

            dropdown.querySelectorAll('.cat-checkbox').forEach(cb => {
                cb.checked = activeCats.size === 0 || activeCats.has(cb.value);
            });
            dropdown.querySelectorAll('.tag-checkbox').forEach(cb => {
                cb.checked = activeTags.size === 0 || activeTags.has(cb.value);
            });

            ['category', 'tags'].forEach(sec => {
                const section = dropdown.querySelector(`.filter-section[data-section="${sec}"]`);
                if (!section) return;
                const all = [...section.querySelectorAll('input[type=checkbox]')].every(i => i.checked);
                const sa  = dropdown.querySelector(`.section-select-all[data-section="${sec}"]`);
                if (sa) sa.checked = all;
            });

            syncTagVisibility();
            const activeCatsFinal = new Set(checkedCats());
            const activeTagsFinal = new Set(checkedTags());
            document.querySelectorAll('#projects-grid .proj-card').forEach(card => {
                const cardCat  = card.dataset.category || '';
                const cardTags = (card.dataset.tags || '').split(' ').filter(Boolean);
                if (!activeCatsFinal.has(cardCat)) { card.style.display = 'none'; return; }
                if (cardTags.length === 0)          { card.style.display = '';     return; }
                card.style.display = cardTags.some(t => activeTagsFinal.has(t)) ? '' : 'none';
            });
        }

        dropdown.addEventListener('change', (e) => {
            const cb = e.target;

            if (cb.classList.contains('section-select-all')) {
                const secName = cb.dataset.section;
                const section = dropdown.querySelector(`.filter-section[data-section="${secName}"]`);
                section.querySelectorAll('input[type=checkbox]').forEach(item => {
                    if (secName === 'tags' && item.closest('.filter-tag').classList.contains('tag-disabled')) return;
                    item.checked = cb.checked;
                });
            } else {
                const section = cb.closest('.filter-section');
                if (section) {
                    const visibleCbs = [...section.querySelectorAll('input[type=checkbox]')]
                        .filter(i => !i.closest('.filter-tag').classList.contains('tag-disabled'));
                    const allChecked = visibleCbs.every(i => i.checked);
                    const sa = dropdown.querySelector(`.section-select-all[data-section="${section.dataset.section}"]`);
                    if (sa) sa.checked = allChecked;
                }
            }

            if (cb.classList.contains('cat-checkbox') ||
                (cb.classList.contains('section-select-all') && cb.dataset.section === 'category')) {
                syncTagVisibility();
            }

            applyFilter();
        });

        loadFromHash();

        window.addEventListener('hashchange', () => {
            if (!location.hash.startsWith('#project-')) loadFromHash();
        });
    }

    function wireSort() {
        const bar = document.getElementById('sort-bar');
        if (!bar) return;

        const toggle   = document.getElementById('sort-toggle');
        const dropdown = document.getElementById('sort-dropdown');
        const chevron  = document.getElementById('sort-chevron');

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = dropdown.classList.toggle('open');
            chevron.style.transform = open ? 'rotate(180deg)' : '';
        });

        document.addEventListener('click', (e) => {
            if (!bar.contains(e.target) && !toggle.contains(e.target)) {
                dropdown.classList.remove('open');
                chevron.style.transform = '';
            }
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());

        dropdown.addEventListener('change', (e) => {
            if (e.target.name === 'sort-by') {
                applySort(e.target.value);
            }
        });
    }

    function applySort(sortVal) {
        const safeDate = (d) => {
            const time = new Date(d).getTime();
            return isNaN(time) ? 0 : time;
        };

        const sortFn = (a, b) => {
            if (sortVal === 'date-desc') {
                return safeDate(b.dataset.date) - safeDate(a.dataset.date);
            } else if (sortVal === 'date-asc') {
                return safeDate(a.dataset.date) - safeDate(b.dataset.date);
            } else if (sortVal === 'name-asc') {
                return a.dataset.name.localeCompare(b.dataset.name);
            } else if (sortVal === 'name-desc') {
                return b.dataset.name.localeCompare(a.dataset.name);
            } else if (sortVal === 'tags-asc') {
                const tagCmp = a.dataset.tags.localeCompare(b.dataset.tags);
                return tagCmp !== 0 ? tagCmp : a.dataset.name.localeCompare(b.dataset.name);
            }
            return 0;
        };

        const grid = document.getElementById('projects-grid');
        if (grid) {
            const cards = Array.from(grid.querySelectorAll('.proj-card'));
            cards.sort(sortFn).forEach(card => grid.appendChild(card));
        }

        document.querySelectorAll('.cat-row').forEach(row => {
            const track = row.querySelector('.cat-carousel');
            if(track) {
                const cards = Array.from(track.querySelectorAll('.proj-card'));
                cards.sort(sortFn).forEach(card => track.appendChild(card));
                if (track._updateArrows) track._updateArrows();
            }

            const localRadio = row.querySelector(`.carousel-sort-dropdown input[value="${sortVal}"]`);
            if (localRadio) localRadio.checked = true;
        });
    }

    // ── Layout toggle ────────────────────────────────────────────────────────

    const LAYOUT_KEY = 'projects-layout';

    function getLayout() {
        try { return localStorage.getItem(LAYOUT_KEY) || 'carousel'; } catch { return 'carousel'; }
    }

    function setLayout(v) {
        try { localStorage.setItem(LAYOUT_KEY, v); } catch {}
    }

    function applyLayout(layout) {
        const grid     = document.getElementById('projects-scroll');
        const carousel = document.getElementById('carousel-layout');
        const filterBar   = document.getElementById('filter-bar');
        const btnGrid      = document.getElementById('layout-btn-grid');
        const btnCarousel  = document.getElementById('layout-btn-carousel');

        if (layout === 'carousel') {
            if (grid)     grid.style.display     = 'none';
            if (carousel) carousel.style.display = '';

            if (filterBar)   filterBar.style.display   = 'none';

            if (btnGrid)     btnGrid.classList.remove('active');
            if (btnCarousel) btnCarousel.classList.add('active');

            // Redraw arrows when becoming visible
            document.querySelectorAll('.cat-carousel').forEach(track => {
                if (track._updateArrows) track._updateArrows();
            });

        } else {
            if (grid)     grid.style.display     = '';
            if (carousel) carousel.style.display = 'none';

            if (filterBar)   filterBar.style.display   = '';

            if (btnGrid)     btnGrid.classList.add('active');
            if (btnCarousel) btnCarousel.classList.remove('active');
        }
    }

    // ── Main init ────────────────────────────────────────────────────────────

    function init(projects) {
        projects.sort((a, b) => {
            const da = (a.config && a.config.date) ? new Date(a.config.date) : new Date(0);
            const db = (b.config && b.config.date) ? new Date(b.config.date) : new Date(0);
            return db - da;
        });

        const presentCats = [];
        const _seenCats   = new Set();
        projects.forEach(proj => {
            const cat = getCategory(proj);
            if (!_seenCats.has(cat)) { _seenCats.add(cat); presentCats.push(cat); }
        });

        const tagsByCategory = {};
        presentCats.forEach(cat => { tagsByCategory[cat] = new Set(); });
        projects.forEach(proj => {
            const cat = getCategory(proj);
            getCustomTags(proj).forEach(t => {
                if (tagsByCategory[cat]) tagsByCategory[cat].add(t);
            });
        });
        presentCats.forEach(cat => {
            tagsByCategory[cat] = [...tagsByCategory[cat]].sort((a, b) => a.localeCompare(b));
        });

        const scroll = document.getElementById('projects-scroll');

        scroll.insertAdjacentHTML('beforebegin', buildActionBars(presentCats, tagsByCategory));

        scroll.insertAdjacentHTML('afterend', buildCarouselLayout(projects, presentCats, tagsByCategory));

        const titleBar = document.getElementById('projects-title-bar');
        const filterBar = document.getElementById('filter-bar');
        const sortBar = document.getElementById('sort-bar');

        const layoutPill = document.createElement('div');
        layoutPill.id = 'layout-pill';
        layoutPill.innerHTML = `
            <button id="layout-btn-grid"     class="layout-pill-btn" title="Grid layout"><i class="fa fa-th"></i></button>
            <button id="layout-btn-carousel" class="layout-pill-btn" title="Carousel layout"><i class="fa fa-list"></i></button>
        `;

        const actionsGroup = document.createElement('div');
        actionsGroup.id = 'title-actions-group';

        if (sortBar) actionsGroup.appendChild(sortBar);
        if (filterBar) actionsGroup.appendChild(filterBar);

        if (titleBar) {
            titleBar.appendChild(actionsGroup);
            titleBar.appendChild(layoutPill);
        }

        layoutPill.addEventListener('click', (e) => {
            const btn = e.target.closest('.layout-pill-btn');
            if (!btn) return;
            const next = btn.id === 'layout-btn-carousel' ? 'carousel' : 'grid';
            setLayout(next);
            applyLayout(next);
        });

        // ── Build grid cards
        const grid   = document.getElementById('projects-grid');
        const modals = document.getElementById('projects-modals');
        if (!grid) return;

        projects.forEach((proj, i) => {
            const id       = projectId(proj, i);
            const category = getCategory(proj);
            const tags     = getCustomTags(proj);
            grid.insertAdjacentHTML('beforeend', buildCard(proj, id, category, tags));
            modals.insertAdjacentHTML('beforeend', buildModal(proj, id));
        });

        // ── Wire everything
        wireFilter();
        wireSort();
        wireCarouselFilters();
        wireCarouselSort();
        wireCarouselArrows();

        // ── Apply saved layout
        applyLayout(getLayout());

        const main = document.getElementById('main');
        main.addEventListener('click', (e) => {
            const card = e.target.closest('.proj-card');
            if (card) openModal(card.dataset.id);
        });
        main.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const card = e.target.closest('.proj-card');
                if (card) openModal(card.dataset.id);
            }
        });

        document.getElementById('projects-modals').addEventListener('click', (e) => {
            if (e.target.closest('.modal-back')) closeModal();
        });

        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-overlay')) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        window.addEventListener('hashchange', handleHash);
        handleHash();
    }

    // ── Main init ────────────────────────────────────────────────────────────

    function init(projects) {
        projects.sort((a, b) => {
            const da = (a.config && a.config.date) ? new Date(a.config.date) : new Date(0);
            const db = (b.config && b.config.date) ? new Date(b.config.date) : new Date(0);
            return db - da;
        });

        const presentCats = [];
        const _seenCats   = new Set();
        projects.forEach(proj => {
            const cat = getCategory(proj);
            if (!_seenCats.has(cat)) { _seenCats.add(cat); presentCats.push(cat); }
        });

        const tagsByCategory = {};
        presentCats.forEach(cat => { tagsByCategory[cat] = new Set(); });
        projects.forEach(proj => {
            const cat = getCategory(proj);
            getCustomTags(proj).forEach(t => {
                if (tagsByCategory[cat]) tagsByCategory[cat].add(t);
            });
        });
        presentCats.forEach(cat => {
            tagsByCategory[cat] = [...tagsByCategory[cat]].sort((a, b) => a.localeCompare(b));
        });

        const scroll = document.getElementById('projects-scroll');

        scroll.insertAdjacentHTML('beforebegin', buildActionBars(presentCats, tagsByCategory));

        scroll.insertAdjacentHTML('afterend', buildCarouselLayout(projects, presentCats, tagsByCategory));

        const titleBar = document.getElementById('projects-title-bar');
        const filterBar = document.getElementById('filter-bar');
        const sortBar = document.getElementById('sort-bar');

        const layoutPill = document.createElement('div');
        layoutPill.id = 'layout-pill';
        layoutPill.innerHTML = `
            <button id="layout-btn-grid"     class="layout-pill-btn" title="Grid layout"><i class="fa fa-th"></i></button>
            <button id="layout-btn-carousel" class="layout-pill-btn" title="Carousel layout"><i class="fa fa-list"></i></button>
        `;

        const actionsGroup = document.createElement('div');
        actionsGroup.id = 'title-actions-group';

        if (sortBar) actionsGroup.appendChild(sortBar);
        if (filterBar) actionsGroup.appendChild(filterBar);

        if (titleBar) {
            titleBar.appendChild(actionsGroup);
            titleBar.appendChild(layoutPill);
        }

        layoutPill.addEventListener('click', (e) => {
            const btn = e.target.closest('.layout-pill-btn');
            if (!btn) return;
            const next = btn.id === 'layout-btn-carousel' ? 'carousel' : 'grid';
            setLayout(next);
            applyLayout(next);
        });

        // ── Build grid cards
        const grid   = document.getElementById('projects-grid');
        const modals = document.getElementById('projects-modals');
        if (!grid) return;

        projects.forEach((proj, i) => {
            const id       = projectId(proj, i);
            const category = getCategory(proj);
            const tags     = getCustomTags(proj);
            grid.insertAdjacentHTML('beforeend', buildCard(proj, id, category, tags));
            modals.insertAdjacentHTML('beforeend', buildModal(proj, id));
        });

        // ── Wire everything
        wireFilter();
        wireSort();
        wireCarouselFilters();
        wireCarouselSort();
        wireCarouselArrows();

        // ── Apply saved layout
        applyLayout(getLayout());

        const main = document.getElementById('main');
        main.addEventListener('click', (e) => {
            const card = e.target.closest('.proj-card');
            if (card) openModal(card.dataset.id);
        });
        main.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const card = e.target.closest('.proj-card');
                if (card) openModal(card.dataset.id);
            }
        });

        document.getElementById('projects-modals').addEventListener('click', (e) => {
            if (e.target.closest('.modal-back')) closeModal();
        });

        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-overlay')) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        window.addEventListener('hashchange', handleHash);
        handleHash();
    }

    function openModal(id) {
        const overlay  = document.getElementById('modal-overlay');
        const allInner = document.querySelectorAll('.modal-inner');
        allInner.forEach(el => el.classList.remove('active'));

        const target = document.getElementById('modal-' + id);
        if (!target) return;

        target.querySelectorAll('iframe[data-src]').forEach(iframe => {
            iframe.src = iframe.dataset.src;
        });

        target.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        history.pushState(null, '', '#project-' + id);
    }

    function closeModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.remove('active');
        document.querySelectorAll('.modal-inner').forEach(el => el.classList.remove('active'));
        document.body.style.overflow = '';
        overlay.querySelectorAll('iframe[data-src]').forEach(iframe => { iframe.src = ''; });
        if (location.hash.startsWith('#project-')) {
            history.pushState(null, '', location.pathname);
        }
    }

    function handleHash() {
        const hash = location.hash;
        if (hash.startsWith('#project-')) {
            openModal(hash.replace('#project-', ''));
        }
    }

    // ── Bootstrap ────────────────────────────────────────────────────────────

    function bootstrap() {
        const main = document.getElementById('main');
        if (!main || document.getElementById('projects-grid')) return;

        main.insertAdjacentHTML('beforeend', `
            <div id="projects-scroll">
                <div id="projects-grid"></div>
            </div>
            <div id="modal-overlay">
                <div id="projects-modals"></div>
            </div>
        `);

        fetch('../assets/projects/projects.json')
            .then(r => r.json())
            .then(init)
            .catch(err => console.error('Could not load projects.json:', err));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();