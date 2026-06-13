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
    //
    // Each project gets a category derived from its type:
    //   youtube       → "YouTube Video"
    //   minecraft_mod → "Mod"
    //   project       → "Project"
    //
    // Extra tags come from config.tags[] and are stored separately from the
    // category so filtering logic can treat them independently.
    const TYPE_CATEGORY = {
        youtube:       'YouTube Video',
        minecraft_mod: 'Mod',
        project:       'Project',
    };

    function getCategory(proj) {
        return TYPE_CATEGORY[proj.type] || 'Other';
    }

    function getCustomTags(proj) {
        return Array.isArray(proj.config.tags) ? [...proj.config.tags] : [];
    }

    // ── Card builders ────────────────────────────────────────────────────────

    function cardAttrs(id, category, tags) {
        const catSlug  = slugify(category);
        const tagSlugs = tags.map(t => slugify(t)).join(' ');
        return `data-id="${id}" data-category="${catSlug}" data-tags="${tagSlugs}"`;
    }

    function buildYoutubeCard(cfg, id, category, tags) {
        const vid   = youtubeId(cfg.url);
        const thumb = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
        const fit   = cfg.thumb_fit || 'cover';
        const label = cfg.name || 'Video';
        return `
        <div class="proj-card" ${cardAttrs(id, category, tags)} tabindex="0" role="button" aria-label="Open ${label}">
            <div class="proj-thumb yt-thumb">
                <img src="${thumb}" alt="YouTube video thumbnail" loading="lazy" style="object-fit:${fit}">
                <div class="yt-play"><i class="fa fa-play-circle"></i></div>
            </div>
            <div class="proj-label"><i class="fa fa-youtube-play"></i> ${label}</div>
        </div>`;
    }

    function buildModCard(cfg, id, category, tags) {
        const fit = cfg.thumb_fit || 'cover';
        return `
        <div class="proj-card" ${cardAttrs(id, category, tags)} tabindex="0" role="button" aria-label="Open ${cfg.name}">
            <div class="proj-thumb">
                <img src="${cfg.photo}" alt="${cfg.name}" loading="lazy" style="object-fit:${fit}">
            </div>
            <div class="proj-label"><i class="fa fa-puzzle-piece"></i> ${cfg.name}</div>
        </div>`;
    }

    function buildProjectCard(cfg, id, category, tags) {
        const fit = cfg.thumb_fit || 'cover';
        return `
        <div class="proj-card" ${cardAttrs(id, category, tags)} tabindex="0" role="button" aria-label="Open ${cfg.name}">
            <div class="proj-thumb">
                <img src="${cfg.photo}" alt="${cfg.name}" loading="lazy" style="object-fit:${fit}">
            </div>
            <div class="proj-label"><i class="fa fa-folder-open"></i> ${cfg.name}</div>
        </div>`;
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

    // ── Filter bar ───────────────────────────────────────────────────────────

    function buildFilterBar(categories, tagsByCategory) {
        // Category section
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

        // Tag section — every tag across all categories, each labelled with which
        // categories it belongs to so we can show/hide them dynamically
        const allTagsFlat = [];
        const tagCatMap   = {}; // tagSlug → Set of catSlugs
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

        return `
        <div id="filter-bar">
            <button id="filter-toggle" class="btn-theme">
                <i class="fa fa-filter"></i><span> Filter </span><i class="fa fa-chevron-down" id="filter-chevron"></i>
            </button>
            <div id="filter-dropdown">
                ${catSection}
                ${tagSection}
            </div>
        </div>`;
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

        // Returns slugs of checked categories
        function checkedCats() {
            return [...dropdown.querySelectorAll('.cat-checkbox:checked')].map(cb => cb.value);
        }

        // Returns slugs of checked tags (only among enabled ones)
        function checkedTags() {
            return [...dropdown.querySelectorAll('.tag-checkbox:checked')]
                .filter(cb => !cb.closest('.filter-tag').classList.contains('tag-disabled'))
                .map(cb => cb.value);
        }

        // Gray out + disable tag rows whose categories are all unchecked.
        // Also re-sync the tag "Select all" checkbox.
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

            // Sync select-all for tags (only count enabled rows)
            const enabledCbs = [...tagSection.querySelectorAll('.tag-checkbox')]
                .filter(cb => !cb.disabled);
            const allChecked = enabledCbs.length > 0 && enabledCbs.every(cb => cb.checked);
            const sa = dropdown.querySelector('.section-select-all[data-section="tags"]');
            if (sa) sa.checked = allChecked;
        }

        function applyFilter() {
            const activeCats  = new Set(checkedCats());
            const activeTags  = new Set(checkedTags());

            document.querySelectorAll('.proj-card').forEach(card => {
                const cardCat  = card.dataset.category || '';
                const cardTags = (card.dataset.tags || '').split(' ').filter(Boolean);

                // Must match an active category
                if (!activeCats.has(cardCat)) {
                    card.style.display = 'none';
                    return;
                }

                // If the card has no tags, category match alone is enough
                if (cardTags.length === 0) {
                    card.style.display = '';
                    return;
                }

                // If no tags are checked at all (for this category), show it
                // If some tags are checked, at least one must match
                const relevantTagsChecked = cardTags.some(t => activeTags.has(t));
                const anyTagsVisibleForCat = [...dropdown.querySelectorAll('.filter-tag[data-tag-cats]')]
                    .some(row => {
                        const rowCats = (row.dataset.tagCats || '').split(' ');
                        return rowCats.includes(cardCat) && !row.classList.contains('tag-disabled');
                    });

                card.style.display = (!anyTagsVisibleForCat || relevantTagsChecked) ? '' : 'none';
            });

            pushFilterHash();
        }

        function pushFilterHash() {
            if (location.hash.startsWith('#project-')) return;
            const cats = checkedCats();
            const tags = checkedTags();
            const parts = [];
            if (cats.length) parts.push('cats=' + cats.join(','));
            if (tags.length) parts.push('tags=' + tags.join(','));
            history.replaceState(null, '', parts.length ? '#' + parts.join('&') : '#');
        }

        function loadFromHash() {
            const hash = location.hash;
            const catMatch = hash.match(/cats=([^&]*)/);
            const tagMatch = hash.match(/tags=([^&]*)/);

            if (!catMatch && !tagMatch) return; // no filter hash present — leave defaults

            const activeCats = catMatch && catMatch[1] ? new Set(catMatch[1].split(',')) : new Set();
            const activeTags = tagMatch && tagMatch[1] ? new Set(tagMatch[1].split(',')) : new Set();

            dropdown.querySelectorAll('.cat-checkbox').forEach(cb => {
                cb.checked = activeCats.size === 0 || activeCats.has(cb.value);
            });
            dropdown.querySelectorAll('.tag-checkbox').forEach(cb => {
                cb.checked = activeTags.size === 0 || activeTags.has(cb.value);
            });

            // Sync select-all rows
            ['category', 'tags'].forEach(sec => {
                const section = dropdown.querySelector(`.filter-section[data-section="${sec}"]`);
                if (!section) return;
                const all = [...section.querySelectorAll('input[type=checkbox]')].every(i => i.checked);
                const sa  = dropdown.querySelector(`.section-select-all[data-section="${sec}"]`);
                if (sa) sa.checked = all;
            });

            syncTagVisibility();
            const activeCatsFinal  = new Set(checkedCats());
            const activeTagsFinal  = new Set(checkedTags());
            document.querySelectorAll('.proj-card').forEach(card => {
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
                // For tags section, only toggle visible rows
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

            // If a category changed, update which tag rows are visible
            if (cb.classList.contains('cat-checkbox') || (cb.classList.contains('section-select-all') && cb.dataset.section === 'category')) {
                syncTagVisibility();
            }

            applyFilter();
        });

        // Load filters from URL on init, then apply
        loadFromHash();

        // Re-apply filters when hash changes (e.g. back/forward navigation)
        window.addEventListener('hashchange', () => {
            if (!location.hash.startsWith('#project-')) loadFromHash();
        });
    }

    // ── Main init ────────────────────────────────────────────────────────────

    function init(projects) {
        // Sort by date descending (most recent first)
        projects.sort((a, b) => {
            const da = (a.config && a.config.date) ? new Date(a.config.date) : new Date(0);
            const db = (b.config && b.config.date) ? new Date(b.config.date) : new Date(0);
            return db - da;
        });

        // Collect categories (in TYPE_CATEGORY order, only those present)
        const categoryOrder = Object.values(TYPE_CATEGORY);
        const presentCats   = categoryOrder.filter(cat =>
            projects.some(p => getCategory(p) === cat)
        );

        // Map category → sorted list of custom tags that appear in that category
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

        // Inject filter bar before the scroll area
        const scroll = document.getElementById('projects-scroll');
        scroll.insertAdjacentHTML('beforebegin', buildFilterBar(presentCats, tagsByCategory));

        // Move the toggle button up into the title bar
        const titleBar = document.getElementById('projects-title-bar');
        const toggle   = document.getElementById('filter-toggle');
        if (titleBar && toggle) titleBar.appendChild(toggle);

        // Build grid
        const grid   = document.getElementById('projects-grid');
        if (!grid) return;
        const modals = document.getElementById('projects-modals');

        projects.forEach((proj, i) => {
            const id       = projectId(proj, i);
            const category = getCategory(proj);
            const tags     = getCustomTags(proj);
            let card = '', modal = '';

            if (proj.type === 'youtube') {
                card  = buildYoutubeCard(proj.config, id, category, tags);
                modal = buildYoutubeModal(proj.config, id);
            } else if (proj.type === 'minecraft_mod') {
                card  = buildModCard(proj.config, id, category, tags);
                modal = buildModModal(proj.config, id);
            } else if (proj.type === 'project') {
                card  = buildProjectCard(proj.config, id, category, tags);
                modal = buildProjectModal(proj.config, id);
            }

            grid.insertAdjacentHTML('beforeend', card);
            modals.insertAdjacentHTML('beforeend', modal);
        });

        wireFilter();

        // ── Event wiring ──────────────────────────────────────────────────

        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.proj-card');
            if (!card) return;
            openModal(card.dataset.id);
        });
        grid.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const card = e.target.closest('.proj-card');
                if (card) openModal(card.dataset.id);
            }
        });

        modals.addEventListener('click', (e) => {
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

        overlay.querySelectorAll('iframe[data-src]').forEach(iframe => {
            iframe.src = '';
        });

        if (location.hash.startsWith('#project-')) {
            // Restore filter hash
            history.pushState(null, '', location.pathname);
        }
    }

    function handleHash() {
        const hash = location.hash;
        if (hash.startsWith('#project-')) {
            const id = hash.replace('#project-', '');
            openModal(id);
        }
    }

    // ── Bootstrap ────────────────────────────────────────────────────────────

    function bootstrap() {
        const main = document.getElementById('main');
        if (!main) return;

        if (document.getElementById('projects-grid')) return;

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