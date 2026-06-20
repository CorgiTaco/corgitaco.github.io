(function () {

    // ── Storage & Tracking Helpers ───────────────────────────────────────────

    const VIEWED_KEY = 'projects-viewed-history';
    let viewedProjects = [];

    function loadViewedHistory() {
        try { viewedProjects = JSON.parse(localStorage.getItem(VIEWED_KEY)) || []; }
        catch { viewedProjects = []; }
    }

    function markAsViewed(id) {
        if (!viewedProjects.includes(id)) {
            viewedProjects.push(id);
            localStorage.setItem(VIEWED_KEY, JSON.stringify(viewedProjects));

            document.querySelectorAll(`.proj-card[data-id="${id}"]`).forEach(card => {
                card.dataset.viewed = 'true';
            });
        }
    }

    // NEW: Function to remove a specific item from viewed storage
    function unmarkAsViewed(id) {
        const index = viewedProjects.indexOf(id);
        if (index > -1) {
            viewedProjects.splice(index, 1);
            localStorage.setItem(VIEWED_KEY, JSON.stringify(viewedProjects));

            // Visually un-mark all instances of this card
            document.querySelectorAll(`.proj-card[data-id="${id}"]`).forEach(card => {
                card.dataset.viewed = 'false';
            });
        }
    }

    function clearViewedHistory() {
        viewedProjects = [];
        localStorage.removeItem(VIEWED_KEY);

        document.querySelectorAll('.proj-card[data-viewed="true"]').forEach(card => {
            card.dataset.viewed = 'false';
        });

        const globalDropdown = document.getElementById('filter-dropdown');
        if (globalDropdown) {
            const globalHideBtn = document.getElementById('hide-viewed-global');
            if(globalHideBtn) globalHideBtn.checked = false;
        }

        document.querySelectorAll('.cat-row').forEach(row => {
            const rowDropdown = row.querySelector('.carousel-filter-dropdown');
            if (rowDropdown) {
                const rowHideBtn = rowDropdown.querySelector('.carousel-hide-viewed');
                if(rowHideBtn) rowHideBtn.checked = false;
                applyCarouselFilter(row, rowDropdown);
            }
        });

        const globalFilterToggle = document.getElementById('hide-viewed-global');
        if(globalFilterToggle) {
            globalFilterToggle.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }


    // ── Favorites Storage & Tracking ──────────────────────────────────────

    const FAVORITES_KEY = 'projects-favorites';
    let favoriteProjects = [];

    // Loaded from category_order.json
    let categoryOrder = [];

    function loadFavorites() {
        try { favoriteProjects = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; }
        catch { favoriteProjects = []; }
    }

    function isFavorited(id) {
        return favoriteProjects.includes(id);
    }

    function toggleFavorite(id) {
        const idx = favoriteProjects.indexOf(id);
        if (idx === -1) {
            favoriteProjects.push(id);
        } else {
            favoriteProjects.splice(idx, 1);
        }
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteProjects)); } catch {}

        // Sync all card star overlays
        document.querySelectorAll(`.proj-card[data-id="${id}"]`).forEach(card => {
            card.dataset.favorited = isFavorited(id) ? 'true' : 'false';
        });

        // Sync open modal star button if visible
        const modalStar = document.querySelector(`#modal-${id} .modal-fav-btn`);
        if (modalStar) syncModalStar(modalStar, id);

        // Refresh favorites carousel row
        refreshFavoritesRow();

        // Re-sort grid if in grid mode so favorites bubble to top
        const gridScroll = document.getElementById('projects-scroll');
        if (gridScroll && gridScroll.style.display !== 'none') {
            sortGridFavoritesFirst();
        }
    }

    function syncModalStar(btn, id) {
        const faved = isFavorited(id);
        btn.classList.toggle('active', faved);
        btn.title = faved ? 'Remove from favorites' : 'Add to favorites';
    }

    function refreshFavoritesRow() {
        const carouselLayout = document.getElementById('carousel-layout');
        if (!carouselLayout) return;

        let favRow = document.getElementById('cat-row-favorites');

        if (favoriteProjects.length === 0) {
            if (favRow) favRow.remove();
            return;
        }

        // Build card HTML for all favorited projects (in favorites order)
        const allCards = Array.from(document.querySelectorAll('.proj-card[data-id]'));
        const idToCard = {};
        allCards.forEach(c => { idToCard[c.dataset.id] = c; });

        const cardClones = favoriteProjects
            .map(id => idToCard[id])
            .filter(Boolean)
            .map(card => {
                const clone = card.cloneNode(true);
                // Keep fav overlay visible on clone
                clone.dataset.favorited = 'true';
                return clone.outerHTML;
            })
            .join('');

        if (!favRow) {
            // Create the row and prepend it
            const rowHtml = `
            <div class="cat-row" id="cat-row-favorites" data-cat="favorites">
                <div class="cat-row-header">
                    <h2 class="cat-row-title"><i class="fa fa-star"></i> Favorites</h2>
                </div>
                <div class="cat-carousel-wrap">
                    <button class="carousel-arrow left"><i class="fa fa-chevron-left"></i></button>
                    <div class="cat-carousel" id="favorites-carousel">${cardClones}</div>
                    <button class="carousel-arrow right"><i class="fa fa-chevron-right"></i></button>
                </div>
            </div>`;
            carouselLayout.insertAdjacentHTML('afterbegin', rowHtml);
            favRow = document.getElementById('cat-row-favorites');
            // Wire arrows for the new row
            wireSingleCarouselArrows(favRow);
        } else {
            const track = favRow.querySelector('.cat-carousel');
            track.innerHTML = cardClones;
            const wrap = favRow.querySelector('.cat-carousel-wrap');
            const leftBtn = wrap.querySelector('.carousel-arrow.left');
            const rightBtn = wrap.querySelector('.carousel-arrow.right');
            updateCarouselArrows(track, leftBtn, rightBtn);
        }
    }

    function sortGridFavoritesFirst() {
        const grid = document.getElementById('projects-grid');
        if (!grid) return;
        const cards = Array.from(grid.querySelectorAll('.proj-card'));
        cards.sort((a, b) => {
            const aFav = a.dataset.favorited === 'true' ? 0 : 1;
            const bFav = b.dataset.favorited === 'true' ? 0 : 1;
            return aFav - bFav;
        });
        cards.forEach(card => grid.appendChild(card));
    }

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
            const vid = youtubeId(project.url);
            return 'yt-' + (vid || index);
        }
        if (project.title) return slugify(project.title);
        return 'project-' + index;
    }

    // ── URL Parameter Manager ────────────────────────────────────────────────

    function updateUrlParams(updates) {
        const url = new URL(window.location);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === false) {
                url.searchParams.delete(key);
            } else if (Array.isArray(value)) {
                if (value.length === 0) url.searchParams.set(key, 'none');
                else url.searchParams.set(key, value.join(','));
            } else {
                url.searchParams.set(key, value);
            }
        });

        history.replaceState(null, '', url.toString());
    }

    function cleanUrlForView(view) {
        const url = new URL(window.location);
        const keysToDelete = [];

        for (const key of url.searchParams.keys()) {
            if (view === 'grid' || view === 'list') {
                if (key.startsWith('sort-') || key.startsWith('tags-') || key.startsWith('hideViewed-')) keysToDelete.push(key);
            } else if (view === 'carousel') {
                if (key === 'cats' || key === 'tags' || key === 'sort' || key === 'hideViewed') keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(k => url.searchParams.delete(k));
        if (view === 'carousel') {
            url.searchParams.delete('view'); // carousel is the default — no param needed
        } else {
            url.searchParams.set('view', view);
        }
        history.replaceState(null, '', url.toString());
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
        return Array.isArray(proj.tags) ? [...proj.tags] : [];
    }

    // ── Tag chips ─────────────────────────────────────────────────────────────

    function buildProjTagChips(tags, maxVisible) {
        if (!tags || !tags.length) return '';
        const visible  = tags.slice(0, maxVisible || 99);
        const overflow = tags.length - visible.length;
        const chips    = visible.map(t =>
            `<span class="proj-tag"><i class="fa fa-tag"></i>${t}</span>`
        ).join('');
        const more = overflow > 0 ? `<span class="proj-tag proj-tag-overflow">+${overflow}</span>` : '';
        return `<div class="proj-tag-row">${chips}${more}</div>`;
    }

    // ── Card builders ────────────────────────────────────────────────────────

    function cardAttrs(id, category, tags, date, name) {
        const catSlug  = slugify(category);
        const tagSlugs = tags.map(t => slugify(t)).join(' ');
        const safeName = (name || '').replace(/"/g, '&quot;');
        const safeDate = date || '1970-01-01';
        const isViewed = viewedProjects.includes(id) ? 'true' : 'false';

        const isFav = favoriteProjects.includes(id) ? 'true' : 'false';
        return `data-id="${id}" data-category="${catSlug}" data-tags="${tagSlugs}" data-date="${safeDate}" data-name="${safeName}" data-viewed="${isViewed}" data-favorited="${isFav}"`;
    }

    function buildYoutubeCard(cfg, id, category, tags) {
        const vid   = youtubeId(cfg.url);
        const thumb = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
        const fit   = cfg.photo_fit || 'cover';
        const label = cfg.title || 'Video';
        const tagHtml = buildProjTagChips(tags, 4);
        const excerpt = cfg.excerpt ? `<p class="proj-card-excerpt">${cfg.excerpt}</p>` : '';
        return `
        <div class="proj-card" ${cardAttrs(id, category, tags, cfg.date, label)} tabindex="0" role="button" aria-label="Open ${label}">
            <div class="proj-thumb yt-thumb">
                <img src="${thumb}" alt="YouTube video thumbnail" loading="lazy" style="object-fit:${fit}">
                <div class="viewed-overlay"><i class="fa fa-eye" title="Mark as unread"></i></div>
                <div class="fav-overlay"><i class="fa fa-star fav-star" title="Favorite"></i></div>
                <div class="yt-play">
                    <svg class="yt-play-icon" viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg">
                        <path class="yt-play-bg" d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.8 0 34 0 34 0S12.2 0 7.5 1.7a8.5 8.5 0 0 0-6 6C0 11.4 0 24 0 24s0 12.6 1.5 16.3a8.5 8.5 0 0 0 6 6C12.2 48 34 48 34 48s21.8 0 26.5-1.7a8.5 8.5 0 0 0 6-6C68 36.6 68 24 68 24s0-12.6-1.5-16.3z"/>
                        <path class="yt-play-arrow" d="M27 34l18-10-18-10v20z"/>
                    </svg>
                </div>
            </div>
            <div class="proj-card-body">
                <div class="proj-label"><i class="fa fa-youtube-play" title="${category}"></i> ${label}</div>
                ${tagHtml}
                ${excerpt}
            </div>
        </div>`;
    }

    function buildModCard(cfg, id, category, tags) {
        const fit = cfg.photo_fit || 'cover';
        const tagHtml = buildProjTagChips(tags, 4);
        const excerpt = cfg.excerpt ? `<p class="proj-card-excerpt">${cfg.excerpt}</p>` : '';
        return `
        <div class="proj-card" ${cardAttrs(id, category, tags, cfg.date, cfg.title)} tabindex="0" role="button" aria-label="Open ${cfg.title}">
            <div class="proj-thumb">
                <img src="${cfg.photo}" alt="${cfg.title}" loading="lazy" style="object-fit:${fit}">
                <div class="viewed-overlay"><i class="fa fa-eye" title="Mark as unread"></i></div>
                <div class="fav-overlay"><i class="fa fa-star fav-star" title="Favorite"></i></div>
            </div>
            <div class="proj-card-body">
                <div class="proj-label"><i class="fa fa-puzzle-piece" title="${category}"></i> ${cfg.title}</div>
                ${tagHtml}
                ${excerpt}
            </div>
        </div>`;
    }

    function buildProjectCard(cfg, id, category, tags) {
        const fit = cfg.photo_fit || 'cover';
        const tagHtml = buildProjTagChips(tags, 4);
        const excerpt = cfg.excerpt ? `<p class="proj-card-excerpt">${cfg.excerpt}</p>` : '';
        return `
        <div class="proj-card" ${cardAttrs(id, category, tags, cfg.date, cfg.title)} tabindex="0" role="button" aria-label="Open ${cfg.title}">
            <div class="proj-thumb">
                <img src="${cfg.photo}" alt="${cfg.title}" loading="lazy" style="object-fit:${fit}">
                <div class="viewed-overlay"><i class="fa fa-eye" title="Mark as unread"></i></div>
                <div class="fav-overlay"><i class="fa fa-star fav-star" title="Favorite"></i></div>
            </div>
            <div class="proj-card-body">
                <div class="proj-label"><i class="fa fa-folder-open" title="${category}"></i> ${cfg.title}</div>
                ${tagHtml}
                ${excerpt}
            </div>
        </div>`;
    }

    function buildCard(proj, id, category, tags) {
        if (proj.type === 'youtube')       return buildYoutubeCard(proj, id, category, tags);
        if (proj.type === 'minecraft_mod') return buildModCard(proj, id, category, tags);
        if (proj.type === 'project')       return buildProjectCard(proj, id, category, tags);
        return '';
    }

    // ── Modal builders ───────────────────────────────────────────────────────

    function buildYoutubeModal(cfg, id) {
        const vid      = youtubeId(cfg.url);
        const embedUrl = `https://www.youtube.com/embed/${vid}?autoplay=1`;
        const title    = cfg.title || 'Video';
        return `
            <div class="modal-inner" id="modal-${id}">
                <div class="modal-titlebar">
                    <div class="modal-win-controls">
                        <span class="modal-win-btn modal-win-close"></span>
                        <span class="modal-win-btn modal-win-minimize"></span>
                        <span class="modal-win-btn modal-win-maximize"></span>
                    </div>
                    <span class="modal-win-title">${title} — zsh</span>
                    <button class="modal-fav-btn btn-theme" title="Add to favorites"><i class="fa fa-star"></i></button>
                </div>
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
            <div class="modal-titlebar">
                <div class="modal-win-controls">
                    <span class="modal-win-btn modal-win-close"></span>
                    <span class="modal-win-btn modal-win-minimize"></span>
                    <span class="modal-win-btn modal-win-maximize"></span>
                </div>
                <span class="modal-win-title">${cfg.title} — zsh</span>
                <button class="modal-fav-btn btn-theme" title="Add to favorites"><i class="fa fa-star"></i></button>
            </div>
            <img class="modal-banner" src="${cfg.photo}" alt="${cfg.title}">
            <h2 class="modal-title">${cfg.title}</h2>
            <p class="modal-desc">${cfg.excerpt}</p>
            <div class="modal-links">${links}</div>
            <button class="modal-back btn-theme"><i class="fa fa-arrow-left"></i> Back</button>
        </div>`;
    }

    function buildProjectModal(cfg, id) {
        return `
            <div class="modal-inner" id="modal-${id}">
                <div class="modal-titlebar">
                    <div class="modal-win-controls">
                        <span class="modal-win-btn modal-win-close"></span>
                        <span class="modal-win-btn modal-win-minimize"></span>
                        <span class="modal-win-btn modal-win-maximize"></span>
                    </div>
                    <span class="modal-win-title">${cfg.title} — zsh</span>
                    <button class="modal-fav-btn btn-theme" title="Add to favorites"><i class="fa fa-star"></i></button>
                </div>
                <img class="modal-banner" src="${cfg.photo}" alt="${cfg.title}">
                <h2 class="modal-title">${cfg.title}</h2>
                <p class="modal-desc">${cfg.excerpt}</p>
                ${cfg.link ? `<a href="${cfg.link}" target="_blank" rel="noopener" class="btn-theme modal-ext-link"><i class="fa fa-external-link"></i> Visit Project</a>` : ''}
                <button class="modal-back btn-theme"><i class="fa fa-arrow-left"></i> Back</button>
            </div>`;
    }

    function buildModal(proj, id) {
        if (proj.type === 'youtube')       return buildYoutubeModal(proj, id);
        if (proj.type === 'minecraft_mod') return buildModModal(proj, id);
        if (proj.type === 'project')       return buildProjectModal(proj, id);
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

        const statusSection = `
            <div class="filter-section-wrap" id="filter-wrap-status">
                <div class="filter-section-label">Status</div>
                <div class="filter-section" data-section="status">
                    <label class="filter-tag">
                        <input type="checkbox" id="hide-viewed-global" value="hide-viewed">
                        <span>Hide Viewed</span>
                    </label>
                </div>
            </div>`;

        const filterHtml = `
        <div id="filter-bar">
            <button id="filter-toggle" class="btn-theme">
                <i class="fa fa-filter"></i><span> Filter </span><i class="fa fa-chevron-down" id="filter-chevron"></i>
            </button>
            <div id="filter-dropdown">
                ${catSection}
                ${tagSection}
                ${statusSection}
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
                <label class="filter-tag"><input type="radio" name="sort-by" value="cat-asc"><span>Category (A-Z)</span></label>
                <label class="filter-tag"><input type="radio" name="sort-by" value="cat-desc"><span>Category (Z-A)</span></label>
                <label class="filter-tag"><input type="radio" name="sort-by" value="cat-default"><span>Category (Default)</span></label>
            </div>
        </div>`;

        const rowOrderHtml = `
        <div id="row-order-bar">
            <button id="row-order-toggle" class="btn-theme">
                <i class="fa fa-th-list"></i><span> Rows </span><i class="fa fa-chevron-down" id="row-order-chevron"></i>
            </button>
            <div id="row-order-dropdown">
                <div class="sort-section-label">Category Row Order</div>
                <label class="filter-tag"><input type="radio" name="row-order" value="cat-asc"><span>Category (A-Z)</span></label>
                <label class="filter-tag"><input type="radio" name="row-order" value="cat-desc"><span>Category (Z-A)</span></label>
                <label class="filter-tag"><input type="radio" name="row-order" value="cat-default" checked><span>Category (Default)</span></label>
            </div>
        </div>`;

        return filterHtml + sortHtml + rowOrderHtml;
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

            const tagChecks = tags.map(t => `
                <label class="filter-tag">
                    <input type="checkbox" class="carousel-tag-cb" value="${slugify(t)}" checked>
                    <span>${t}</span>
                </label>`).join('');

            const rowStatusSection = `
                <div class="filter-section-wrap" style="padding-left:0; border-top: 1px solid rgba(70, 162, 88, 0.3); margin-top: 6px; padding-top: 6px;">
                    <label class="filter-tag">
                        <input type="checkbox" class="carousel-hide-viewed" value="hide-viewed">
                        <span>Hide Viewed</span>
                    </label>
                </div>`;

            const rowDropdown = `
                <div class="carousel-filter-bar">
                    <button class="btn-theme carousel-filter-toggle">
                        <i class="fa fa-filter"></i><span> Filter </span><i class="fa fa-chevron-down carousel-filter-chevron"></i>
                    </button>
                    <div class="carousel-filter-dropdown">
                        ${tags.length ? `
                        <div class="filter-section-wrap" style="padding-left:0">
                            <label class="filter-tag filter-select-all-tag">
                                <input type="checkbox" class="carousel-select-all" checked>
                                <span>Select all</span>
                            </label>
                            <div class="filter-section">${tagChecks}</div>
                        </div>` : ''}
                        ${rowStatusSection}
                    </div>
                </div>`;

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

    // ── Wire Actions ─────────────────────────────────────────────────────────

    function closeAllDropdowns(exceptMenu = null) {
        document.querySelectorAll('#filter-dropdown.open, #sort-dropdown.open, #row-order-dropdown.open, .carousel-filter-dropdown.open, .carousel-sort-dropdown.open').forEach(menu => {
            if (menu === exceptMenu) return;

            menu.classList.remove('open');

            if (menu.id === 'filter-dropdown') {
                const chev = document.getElementById('filter-chevron');
                if (chev) chev.style.transform = '';
            } else if (menu.id === 'sort-dropdown') {
                const chev = document.getElementById('sort-chevron');
                if (chev) chev.style.transform = '';
            } else if (menu.id === 'row-order-dropdown') {
                const chev = document.getElementById('row-order-chevron');
                if (chev) chev.style.transform = '';
            } else if (menu.classList.contains('carousel-filter-dropdown')) {
                const chev = menu.closest('.carousel-filter-bar').querySelector('.carousel-filter-chevron');
                if (chev) chev.style.transform = '';
            } else if (menu.classList.contains('carousel-sort-dropdown')) {
                const chev = menu.closest('.carousel-sort-bar').querySelector('.carousel-sort-chevron');
                if (chev) chev.style.transform = '';
            }
        });
    }


    /**
     * Positions a fixed-position dropdown so it never overflows the viewport.
     * Call this right before adding the 'open' class.
     * @param {HTMLElement} toggle   – the button that was clicked
     * @param {HTMLElement} dropdown – the dropdown to position
     */
    function positionDropdown(toggle, dropdown) {
        // Temporarily show so we can measure the dropdown dimensions
        dropdown.style.visibility = 'hidden';
        dropdown.style.display = 'flex';

        const tb   = toggle.getBoundingClientRect();
        const dw   = dropdown.offsetWidth;
        const dh   = dropdown.offsetHeight;

        // Use #main as the clamping boundary (falls back to viewport)
        const main = document.getElementById('main');
        const mb   = main ? main.getBoundingClientRect() : { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
        const PAD  = 6;

        // Vertical: prefer below the toggle; flip above if it would overflow #main
        let top = tb.bottom + 1;
        if (top + dh > mb.bottom - PAD) {
            top = Math.max(mb.top + PAD, tb.top - dh - 1);
        }

        // Horizontal: try to right-align with toggle, then clamp inside #main
        let left = tb.right - dw;
        if (left < mb.left + PAD)       left = mb.left + PAD;
        if (left + dw > mb.right - PAD) left = mb.right - dw - PAD;

        dropdown.style.top  = top  + 'px';
        dropdown.style.left = left + 'px';

        // Restore
        dropdown.style.display = '';
        dropdown.style.visibility = '';
    }

    function updateCarouselArrows(track, leftBtn, rightBtn) {
        if (!track || !leftBtn || !rightBtn) return;
        const canScrollLeft  = track.scrollLeft > 2;
        const canScrollRight = track.scrollLeft < (track.scrollWidth - track.clientWidth - 2);
        leftBtn.classList.toggle('visible', canScrollLeft);
        rightBtn.classList.toggle('visible', canScrollRight);
    }

    function wireSingleCarouselArrows(rowEl) {
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

        const wrap     = rowEl.querySelector('.cat-carousel-wrap');
        const track    = wrap.querySelector('.cat-carousel');
        const leftBtn  = wrap.querySelector('.carousel-arrow.left');
        const rightBtn = wrap.querySelector('.carousel-arrow.right');

        function doUpdate() { updateCarouselArrows(track, leftBtn, rightBtn); }

        track.addEventListener('scroll', doUpdate);
        window.addEventListener('resize', doUpdate);
        leftBtn.addEventListener('click',  () => smoothScroll(track, -track.clientWidth * 0.75, 450));
        rightBtn.addEventListener('click', () => smoothScroll(track,  track.clientWidth * 0.75, 450));
        track._updateArrows = doUpdate;
        setTimeout(doUpdate, 100);
    }

    function wireCarouselArrows() {
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

        document.querySelectorAll('.cat-carousel-wrap').forEach(wrap => {
            const track = wrap.querySelector('.cat-carousel');
            const leftBtn = wrap.querySelector('.carousel-arrow.left');
            const rightBtn = wrap.querySelector('.carousel-arrow.right');

            function updateArrows() {
                if (!track) return;
                const canScrollLeft = track.scrollLeft > 2;
                const canScrollRight = track.scrollLeft < (track.scrollWidth - track.clientWidth - 2);

                leftBtn.classList.toggle('visible', canScrollLeft);
                rightBtn.classList.toggle('visible', canScrollRight);
            }

            track.addEventListener('scroll', updateArrows);
            window.addEventListener('resize', updateArrows);

            leftBtn.addEventListener('click', () => {
                smoothScroll(track, -track.clientWidth * 0.75, 450);
            });

            rightBtn.addEventListener('click', () => {
                smoothScroll(track, track.clientWidth * 0.75, 450);
            });

            track._updateArrows = updateArrows;
            setTimeout(updateArrows, 100);
        });
    }

    function wireCarouselFilters() {
        const params = new URLSearchParams(window.location.search);

        document.querySelectorAll('.cat-row').forEach(row => {
            const catSlug = row.dataset.cat;
            const filterBar = row.querySelector('.carousel-filter-bar');
            if (!filterBar) return;

            const toggleBtn = filterBar.querySelector('.carousel-filter-toggle');
            const dropdown  = filterBar.querySelector('.carousel-filter-dropdown');
            const chevron   = filterBar.querySelector('.carousel-filter-chevron');
            const selectAll = filterBar.querySelector('.carousel-select-all');
            const hideViewedCb = filterBar.querySelector('.carousel-hide-viewed');

            toggleBtn.addEventListener('click', e => {
                e.stopPropagation();
                closeAllDropdowns(dropdown);
                positionDropdown(toggleBtn, dropdown);
                const open = dropdown.classList.toggle('open');
                chevron.style.transform = open ? 'rotate(180deg)' : '';
            });

            dropdown.addEventListener('click', e => e.stopPropagation());

            function syncUrlAndFilter() {
                let allChecked = true;
                let checkedTags = [];
                if (selectAll) {
                    checkedTags = [...dropdown.querySelectorAll('.carousel-tag-cb:checked')].map(cb => cb.value);
                    allChecked = checkedTags.length === dropdown.querySelectorAll('.carousel-tag-cb').length;
                }

                const isHidingViewed = hideViewedCb ? hideViewedCb.checked : false;

                updateUrlParams({
                    [`tags-${catSlug}`]: allChecked ? null : checkedTags,
                    [`hideViewed-${catSlug}`]: isHidingViewed ? 'true' : null
                });

                applyCarouselFilter(row, dropdown);
            }

            if (selectAll) {
                selectAll.addEventListener('change', () => {
                    dropdown.querySelectorAll('.carousel-tag-cb').forEach(cb => {
                        cb.checked = selectAll.checked;
                    });
                    syncUrlAndFilter();
                });

                dropdown.querySelectorAll('.carousel-tag-cb').forEach(cb => {
                    cb.addEventListener('change', () => {
                        const all = [...dropdown.querySelectorAll('.carousel-tag-cb')].every(c => c.checked);
                        selectAll.checked = all;
                        syncUrlAndFilter();
                    });
                });
            }

            if (hideViewedCb) {
                hideViewedCb.addEventListener('change', syncUrlAndFilter);
            }

            const tagParam = params.get(`tags-${catSlug}`);
            if (tagParam && selectAll) {
                const activeTags = tagParam !== 'none' ? new Set(tagParam.split(',')) : new Set();

                dropdown.querySelectorAll('.carousel-tag-cb').forEach(cb => {
                    cb.checked = activeTags.has(cb.value);
                });

                const all = [...dropdown.querySelectorAll('.carousel-tag-cb')].every(c => c.checked);
                selectAll.checked = all;
            }

            const hideParam = params.get(`hideViewed-${catSlug}`);
            if (hideParam === 'true' && hideViewedCb) {
                hideViewedCb.checked = true;
            }

            applyCarouselFilter(row, dropdown);
        });
    }

    function applyCarouselFilter(row, dropdown) {
        const checkedTags = [...dropdown.querySelectorAll('.carousel-tag-cb:checked')].map(cb => cb.value);
        const selectAllChecked = dropdown.querySelector('.carousel-select-all') ? dropdown.querySelector('.carousel-select-all').checked : true;
        const hideViewed = dropdown.querySelector('.carousel-hide-viewed') ? dropdown.querySelector('.carousel-hide-viewed').checked : false;

        row.querySelectorAll('.proj-card').forEach(card => {
            const cardTags = (card.dataset.tags || '').split(' ').filter(Boolean);
            const isViewed = card.dataset.viewed === 'true';

            if (hideViewed && isViewed) {
                card.style.display = 'none';
                return;
            }

            if (selectAllChecked) {
                card.style.display = '';
            } else if (cardTags.length === 0) {
                card.style.display = 'none';
            } else {
                card.style.display = cardTags.some(t => checkedTags.includes(t)) ? '' : 'none';
            }
        });

        const track = row.querySelector('.cat-carousel');
        if (track && track._updateArrows) track._updateArrows();
    }

    function wireCarouselSort() {
        const params = new URLSearchParams(window.location.search);

        document.querySelectorAll('.cat-row').forEach(row => {
            const catSlug = row.dataset.cat;
            const sortBar = row.querySelector('.carousel-sort-bar');
            if (!sortBar) return;

            const toggleBtn = sortBar.querySelector('.carousel-sort-toggle');
            const dropdown  = sortBar.querySelector('.carousel-sort-dropdown');
            const chevron   = sortBar.querySelector('.carousel-sort-chevron');
            const track     = row.querySelector('.cat-carousel');

            toggleBtn.addEventListener('click', e => {
                e.stopPropagation();
                closeAllDropdowns(dropdown);
                positionDropdown(toggleBtn, dropdown);
                const open = dropdown.classList.toggle('open');
                chevron.style.transform = open ? 'rotate(180deg)' : '';
            });

            dropdown.addEventListener('click', e => e.stopPropagation());

            dropdown.addEventListener('change', e => {
                if (e.target.type === 'radio') {
                    updateUrlParams({ [`sort-${catSlug}`]: e.target.value === 'date-desc' ? null : e.target.value });
                    applyLocalSort(track, e.target.value);
                }
            });

            const sortVal = params.get(`sort-${catSlug}`);
            if (sortVal) {
                const radio = dropdown.querySelector(`input[name="sort-${catSlug}"][value="${sortVal}"]`);
                if (radio) {
                    radio.checked = true;
                    applyLocalSort(track, sortVal);
                }
            }
        });
    }

    function applyLocalSort(track, sortVal) {
        const sortFn = makeSortFn(sortVal);
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
        const hideViewedCb = document.getElementById('hide-viewed-global');

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns(dropdown);
            positionDropdown(toggle, dropdown);
            const open = dropdown.classList.toggle('open');
            chevron.style.transform = open ? 'rotate(180deg)' : '';
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
            const hideViewed = hideViewedCb ? hideViewedCb.checked : false;

            document.querySelectorAll('#projects-grid .proj-card').forEach(card => {
                const cardCat  = card.dataset.category || '';
                const cardTags = (card.dataset.tags || '').split(' ').filter(Boolean);
                const isViewed = card.dataset.viewed === 'true';

                if (hideViewed && isViewed) { card.style.display = 'none'; return; }
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

            const totalCats = dropdown.querySelectorAll('.cat-checkbox').length;
            const validTags = [...dropdown.querySelectorAll('.tag-checkbox')].filter(cb => !cb.disabled).length;

            updateUrlParams({
                cats: checkedCats().length === totalCats ? null : checkedCats(),
                tags: checkedTags().length === validTags ? null : checkedTags(),
                hideViewed: hideViewed ? 'true' : null
            });
        }

        function loadFromParams() {
            const params = new URLSearchParams(window.location.search);
            const catParam = params.get('cats');
            const tagParam = params.get('tags');
            const hideParam = params.get('hideViewed');

            if (!catParam && !tagParam && !hideParam) return;

            const activeCats = (catParam && catParam !== 'none') ? new Set(catParam.split(',')) : new Set();
            const activeTags = (tagParam && tagParam !== 'none') ? new Set(tagParam.split(',')) : new Set();

            dropdown.querySelectorAll('.cat-checkbox').forEach(cb => {
                cb.checked = catParam ? activeCats.has(cb.value) : true;
            });
            dropdown.querySelectorAll('.tag-checkbox').forEach(cb => {
                cb.checked = tagParam ? activeTags.has(cb.value) : true;
            });
            if (hideViewedCb) {
                hideViewedCb.checked = (hideParam === 'true');
            }

            ['category', 'tags'].forEach(sec => {
                const section = dropdown.querySelector(`.filter-section[data-section="${sec}"]`);
                if (!section) return;
                const all = [...section.querySelectorAll('input[type=checkbox]')].every(i => i.checked);
                const sa  = dropdown.querySelector(`.section-select-all[data-section="${sec}"]`);
                if (sa) sa.checked = all;
            });

            syncTagVisibility();
            applyFilter();
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
            } else if (cb.id !== 'hide-viewed-global') {
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

        loadFromParams();
    }

    function wireSort() {
        const bar = document.getElementById('sort-bar');
        if (!bar) return;

        const toggle   = document.getElementById('sort-toggle');
        const dropdown = document.getElementById('sort-dropdown');
        const chevron  = document.getElementById('sort-chevron');

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllDropdowns(dropdown); // Close others before toggling
            positionDropdown(toggle, dropdown);
            const open = dropdown.classList.toggle('open');
            chevron.style.transform = open ? 'rotate(180deg)' : '';
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());

        dropdown.addEventListener('change', (e) => {
            if (e.target.name === 'sort-by') {
                updateUrlParams({ sort: e.target.value === 'date-desc' ? null : e.target.value });
                applySort(e.target.value);
            }
        });

        // ── Wire the row-order bar (carousel row reordering)
        const rowOrderBar   = document.getElementById('row-order-bar');
        const rowOrderToggle = document.getElementById('row-order-toggle');
        const rowOrderDd     = document.getElementById('row-order-dropdown');
        const rowOrderChev   = document.getElementById('row-order-chevron');

        if (rowOrderToggle && rowOrderDd) {
            rowOrderToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllDropdowns(rowOrderDd);
                positionDropdown(rowOrderToggle, rowOrderDd);
                const open = rowOrderDd.classList.toggle('open');
                if (rowOrderChev) rowOrderChev.style.transform = open ? 'rotate(180deg)' : '';
            });

            rowOrderDd.addEventListener('click', (e) => e.stopPropagation());

            rowOrderDd.addEventListener('change', (e) => {
                if (e.target.name === 'row-order') {
                    updateUrlParams({ rowOrder: e.target.value === 'cat-default' ? null : e.target.value });
                    applyCarouselRowOrder(e.target.value);
                }
            });

            // Restore from URL
            const rowOrderParam = new URLSearchParams(window.location.search).get('rowOrder');
            if (rowOrderParam) {
                const r = rowOrderDd.querySelector(`input[value="${rowOrderParam}"]`);
                if (r) { r.checked = true; applyCarouselRowOrder(rowOrderParam); }
            }
        }

        const params = new URLSearchParams(window.location.search);
        const sortVal = params.get('sort');
        if (sortVal) {
            const radio = dropdown.querySelector(`input[name="sort-by"][value="${sortVal}"]`);
            if (radio) {
                radio.checked = true;
                applySort(sortVal);
            }
        }
    }

    // Returns the custom-order index for a category name (unlisted = large number)
    function catOrderIndex(catName) {
        const idx = categoryOrder.findIndex(c => c.toLowerCase() === (catName || '').toLowerCase());
        return idx === -1 ? 9999 : idx;
    }

    function makeSortFn(sortVal) {
        const safeDate = (d) => {
            const time = new Date(d).getTime();
            return isNaN(time) ? 0 : time;
        };
        return (a, b) => {
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
            } else if (sortVal === 'cat-asc') {
                const catCmp = (a.dataset.category || '').localeCompare(b.dataset.category || '');
                return catCmp !== 0 ? catCmp : a.dataset.name.localeCompare(b.dataset.name);
            } else if (sortVal === 'cat-desc') {
                const catCmp = (b.dataset.category || '').localeCompare(a.dataset.category || '');
                return catCmp !== 0 ? catCmp : a.dataset.name.localeCompare(b.dataset.name);
            } else if (sortVal === 'cat-default') {
                const aCat = (a.dataset.category || '').replace(/-/g, ' ');
                const bCat = (b.dataset.category || '').replace(/-/g, ' ');
                const catCmp = catOrderIndex(aCat) - catOrderIndex(bCat);
                return catCmp !== 0 ? catCmp : a.dataset.name.localeCompare(b.dataset.name);
            }
            return 0;
        };
    }

    function applyCarouselRowOrder(orderVal) {
        const carouselLayout = document.getElementById('carousel-layout');
        if (!carouselLayout) return;

        // Collect all non-favorites rows
        const rows = Array.from(carouselLayout.querySelectorAll('.cat-row:not(#cat-row-favorites)'));

        rows.sort((a, b) => {
            const aName = a.querySelector('.cat-row-title') ? a.querySelector('.cat-row-title').textContent.trim() : '';
            const bName = b.querySelector('.cat-row-title') ? b.querySelector('.cat-row-title').textContent.trim() : '';
            if (orderVal === 'cat-asc')    return aName.localeCompare(bName);
            if (orderVal === 'cat-desc')   return bName.localeCompare(aName);
            if (orderVal === 'cat-default') return catOrderIndex(aName) - catOrderIndex(bName);
            return 0;
        });

        // Re-append in sorted order (favorites row stays first, pinned)
        rows.forEach(row => carouselLayout.appendChild(row));
    }

    function applySort(sortVal) {
        const sortFn = makeSortFn(sortVal);

        const grid = document.getElementById('projects-grid');
        if (grid) {
            const cards = Array.from(grid.querySelectorAll('.proj-card'));
            cards.sort(sortFn).forEach(card => grid.appendChild(card));
            // After category sort, always re-apply favorites-first within each bucket
            if (sortVal.startsWith('cat-')) sortGridFavoritesFirst();
        }

        document.querySelectorAll('.cat-row').forEach(row => {
            const track = row.querySelector('.cat-carousel');
            if (track) {
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
        const params = new URLSearchParams(window.location.search);
        const viewParam = params.get('view');

        const view = (viewParam === 'grid' || viewParam === 'list' || viewParam === 'carousel')
            ? viewParam
            : 'carousel';

        cleanUrlForView(view);
        setLayout(view);
        return view;
    }

    function setLayout(v) {
        try { localStorage.setItem(LAYOUT_KEY, v); } catch {}
    }

    function applyLayout(layout) {
        const grid         = document.getElementById('projects-scroll');
        const projectsGrid = document.getElementById('projects-grid');
        const carousel     = document.getElementById('carousel-layout');
        const filterBar    = document.getElementById('filter-bar');
        const rowOrderBar  = document.getElementById('row-order-bar');
        const btnGrid      = document.getElementById('layout-btn-grid');
        const btnList      = document.getElementById('layout-btn-list');
        const btnCarousel  = document.getElementById('layout-btn-carousel');

        if (layout === 'carousel') {
            if (grid)         grid.style.display        = 'none';
            if (carousel)     carousel.style.display    = '';
            if (filterBar)    filterBar.style.display   = 'none';
            if (rowOrderBar)  rowOrderBar.style.display = '';
            if (projectsGrid) projectsGrid.classList.remove('proj-list-view');

            if (btnGrid)     btnGrid.classList.remove('active');
            if (btnList)     btnList.classList.remove('active');
            if (btnCarousel) btnCarousel.classList.add('active');

            document.querySelectorAll('.cat-carousel').forEach(track => {
                if (track._updateArrows) track._updateArrows();
            });

        } else {
            if (grid)        grid.style.display        = '';
            if (carousel)    carousel.style.display    = 'none';
            if (filterBar)   filterBar.style.display   = '';
            if (rowOrderBar) rowOrderBar.style.display = 'none';

            if (projectsGrid) projectsGrid.classList.toggle('proj-list-view', layout === 'list');

            if (btnGrid)     btnGrid.classList.toggle('active',     layout === 'grid');
            if (btnList)     btnList.classList.toggle('active',     layout === 'list');
            if (btnCarousel) btnCarousel.classList.remove('active');
        }
    }

    // ── Main init ────────────────────────────────────────────────────────────

    function init(projects) {
        loadViewedHistory();
        loadFavorites();

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

        // Sort presentCats by custom order initially
        presentCats.sort((a, b) => {
            const ai = categoryOrder.findIndex(c => c.toLowerCase() === a.toLowerCase());
            const bi = categoryOrder.findIndex(c => c.toLowerCase() === b.toLowerCase());
            return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
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

        const titleBar = document.getElementById('page-title-bar');
        const filterBar = document.getElementById('filter-bar');
        const sortBar = document.getElementById('sort-bar');

        const layoutPill = document.createElement('div');
        layoutPill.id = 'layout-pill';
        layoutPill.innerHTML = `
            <button id="layout-btn-grid"     class="layout-pill-btn" title="Grid layout"><i class="fa fa-fw fa-th"></i></button>
            <button id="layout-btn-list"     class="layout-pill-btn" title="List layout"><i class="fa fa-fw fa-list"></i></button>
            <button id="layout-btn-carousel" class="layout-pill-btn" title="Carousel layout"><i class="fa fa-fw fa-th-list"></i></button>
        `;

        const actionsGroup = document.createElement('div');
        actionsGroup.id = 'title-actions-group';

        const clearBtn = document.createElement('button');
        clearBtn.id = 'clear-viewed-btn';
        clearBtn.className = 'btn-theme';
        clearBtn.title = 'Clear History';
        clearBtn.innerHTML = '<i class="fa fa-eye"></i> <i class="fa fa-trash"></i>';
        clearBtn.addEventListener('click', clearViewedHistory);

        actionsGroup.appendChild(clearBtn);
        if (sortBar) actionsGroup.appendChild(sortBar);
        const rowOrderBar = document.getElementById('row-order-bar');
        if (rowOrderBar) actionsGroup.appendChild(rowOrderBar);
        if (filterBar) actionsGroup.appendChild(filterBar);

        if (titleBar) {
            titleBar.appendChild(actionsGroup);
            titleBar.appendChild(layoutPill);
        }

        layoutPill.addEventListener('click', (e) => {
            const btn = e.target.closest('.layout-pill-btn');
            if (!btn) return;
            const next = btn.id === 'layout-btn-carousel' ? 'carousel'
                       : btn.id === 'layout-btn-list'     ? 'list'
                       : 'grid';

            setLayout(next);
            cleanUrlForView(next);
            applyLayout(next);
        });

        // ── Build grid cards
        const grid   = document.getElementById('projects-grid');
        const modals = document.getElementById('projects-modals');
        if (!grid) return;

        grid.innerHTML = '';

        projects.forEach((proj, i) => {
            const id       = projectId(proj, i);
            const category = getCategory(proj);
            const tags     = getCustomTags(proj);
            grid.insertAdjacentHTML('beforeend', buildCard(proj, id, category, tags));
            modals.insertAdjacentHTML('beforeend', buildModal(proj, id));
        });

        // ── Sort favorites to top in grid
        sortGridFavoritesFirst();

        // ── Show favorites carousel row if any exist
        refreshFavoritesRow();

        // ── Wire everything
        wireFilter();
        wireSort();
        wireCarouselFilters();
        wireCarouselSort();
        wireCarouselArrows();

        // ── Apply saved layout
        applyLayout(getLayout());

        // Reveal cards and carousel rows as they come into view
        if (window._revealAll) {
            window._revealAll(grid.querySelectorAll('.proj-card'));
            var catRows = document.querySelectorAll('.cat-row');
            if (catRows.length) window._revealAll(catRows);
        }

        // ── Global Document Click Listener
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#filter-bar, #sort-bar, #row-order-bar, .carousel-filter-bar, .carousel-sort-bar')) {
                closeAllDropdowns();
            }
        });

        const main = document.getElementById('main');

        // Intercept overlay icon clicks before opening the modal
        main.addEventListener('click', (e) => {
            const eyeIcon  = e.target.closest('.viewed-overlay .fa-eye');
            const starIcon = e.target.closest('.fav-overlay .fav-star');
            const card     = e.target.closest('.proj-card');

            if (eyeIcon && card) {
                e.preventDefault();
                e.stopPropagation();
                unmarkAsViewed(card.dataset.id);
                return;
            }

            if (starIcon && card) {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(card.dataset.id);
                return;
            }

            if (card) {
                openModal(card.dataset.id);
            }
        });

        main.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const card = e.target.closest('.proj-card');
                if (card) {
                    openModal(card.dataset.id);
                }
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
        markAsViewed(id);

        const view = getLayout();
        if (view === 'grid') {
            const globalToggle = document.getElementById('hide-viewed-global');
            if(globalToggle && globalToggle.checked) globalToggle.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            document.querySelectorAll('.cat-row').forEach(row => {
                const dropdown = row.querySelector('.carousel-filter-dropdown');
                if (dropdown) {
                    const rowHideCb = dropdown.querySelector('.carousel-hide-viewed');
                    if(rowHideCb && rowHideCb.checked) rowHideCb.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
        }

        const overlay  = document.getElementById('modal-overlay');
        const allInner = document.querySelectorAll('.modal-inner');
        allInner.forEach(el => el.classList.remove('active'));

        const target = document.getElementById('modal-' + id);
        if (!target) return;

        target.querySelectorAll('iframe[data-src]').forEach(iframe => {
            iframe.src = iframe.dataset.src;
        });

        // Sync the favorites star in this modal
        const favBtn = target.querySelector('.modal-fav-btn');
        if (favBtn) {
            syncModalStar(favBtn, id);
            favBtn.onclick = (e) => {
                e.stopPropagation();
                toggleFavorite(id);
            };
        }

        // Wire the red close button in this modal
        const closeBtn = target.querySelector('.modal-win-close');
        if (closeBtn) {
            closeBtn.style.cursor = 'pointer';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                closeModal();
            };
        }

        target.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';

        history.pushState(null, '', location.pathname + location.search + '#project-' + id);
    }

    function closeModal() {
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.remove('active');
        document.querySelectorAll('.modal-inner').forEach(el => el.classList.remove('active'));
        document.body.style.overflow = '';
        overlay.querySelectorAll('iframe[data-src]').forEach(iframe => { iframe.src = ''; });

        if (location.hash.startsWith('#project-')) {
            history.pushState(null, '', location.pathname + location.search);
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

        // Show spinner while data loads
        var loadGrid = document.getElementById('projects-grid');
        if (loadGrid && window._sectionSpinner) window._sectionSpinner(loadGrid);

        // Fetch both data files in parallel; category order is optional
        Promise.all([
            fetch('../assets/projects/projects.json').then(r => r.json()),
            fetch('../assets/projects/category_order.json')
                .then(r => r.json())
                .catch(() => ({ order: [] }))
        ])
            .then(([projects, orderData]) => {
                categoryOrder = Array.isArray(orderData.order) ? orderData.order : [];
                init(projects);
            })
            .catch(err => console.error('Could not load project data:', err));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();