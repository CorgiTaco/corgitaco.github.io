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

    // ── Tag resolution ────────────────────────────────────────────────────────
    //
    // Each project automatically gets a tag based on its type:
    //   youtube       → "YouTube"
    //   minecraft_mod → "Minecraft Mod"
    //   project       → "Project"
    //
    // You can add any extra tags to a project in projects.json like so:
    //   {
    //     "type": "youtube",
    //     "config": {
    //       "name": "My Video",
    //       "tags": ["Minecraft", "Gameplay", "Checkpoint", "World Generation"]
    //       ...
    //     }
    //   }
    //
    // Any tag string is valid. Tags are deduplicated automatically.
    const TYPE_TAG = {
        youtube:      'YouTube Video',
        minecraft_mod:'Mod',
        project:      'Project',
    };

    function getTags(proj) {
        const tags = new Set();
        if (TYPE_TAG[proj.type]) tags.add(TYPE_TAG[proj.type]);
        if (Array.isArray(proj.config.tags)) {
            proj.config.tags.forEach(t => tags.add(t));
        }
        return [...tags];
    }

    // ── Card builders ────────────────────────────────────────────────────────

    function tagAttrs(tags) {
        return `data-tags="${tags.map(t => slugify(t)).join(' ')}"`;
    }

    function buildYoutubeCard(cfg, id, tags) {
        const vid = youtubeId(cfg.url);
        const thumb = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
        const fit = cfg.thumb_fit || 'cover';
        const label = cfg.name || 'Video';
        return `
        <div class="proj-card" data-id="${id}" ${tagAttrs(tags)} tabindex="0" role="button" aria-label="Open ${label}">
            <div class="proj-thumb yt-thumb">
                <img src="${thumb}" alt="YouTube video thumbnail" loading="lazy" style="object-fit:${fit}">
                <div class="yt-play"><i class="fa fa-play-circle"></i></div>
            </div>
            <div class="proj-label"><i class="fa fa-youtube-play"></i> ${label}</div>
        </div>`;
    }

    function buildModCard(cfg, id, tags) {
        const fit = cfg.thumb_fit || 'cover';
        return `
        <div class="proj-card" data-id="${id}" ${tagAttrs(tags)} tabindex="0" role="button" aria-label="Open ${cfg.name}">
            <div class="proj-thumb">
                <img src="${cfg.photo}" alt="${cfg.name}" loading="lazy" style="object-fit:${fit}">
            </div>
            <div class="proj-label"><i class="fa fa-puzzle-piece"></i> ${cfg.name}</div>
        </div>`;
    }

    function buildProjectCard(cfg, id, tags) {
        const fit = cfg.thumb_fit || 'cover';
        return `
        <div class="proj-card" data-id="${id}" ${tagAttrs(tags)} tabindex="0" role="button" aria-label="Open ${cfg.name}">
            <div class="proj-thumb">
                <img src="${cfg.photo}" alt="${cfg.name}" loading="lazy" style="object-fit:${fit}">
            </div>
            <div class="proj-label"><i class="fa fa-folder-open"></i> ${cfg.name}</div>
        </div>`;
    }

    // ── Modal builders ───────────────────────────────────────────────────────

    function buildYoutubeModal(cfg, id) {
        const vid = youtubeId(cfg.url);
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

    function buildFilterBar(allTags, typeTags) {
        const makeSection = (label, tags) => {
            const id = slugify(label);
            const checks = tags.map(tag => `
                <label class="filter-tag">
                    <input type="checkbox" value="${slugify(tag)}" checked>
                    <span>${tag}</span>
                </label>`).join('');
            return `
            <div class="filter-section-wrap">
                <div class="filter-section-label">${label}</div>
                <label class="filter-tag filter-select-all-tag">
                    <input type="checkbox" class="section-select-all" data-section="${id}" checked>
                    <span>Select all</span>
                </label>
                <div class="filter-section" data-section="${id}">${checks}</div>
            </div>`;
        };

        const typeTagList   = allTags.filter(t => typeTags.has(t));
        const customTagList = allTags.filter(t => !typeTags.has(t));

        const customSection = customTagList.length ? makeSection('Tags', customTagList) : '';

        return `
        <div id="filter-bar">
            <button id="filter-toggle" class="btn-theme">
                <i class="fa fa-filter"></i><span> Filter </span><i class="fa fa-chevron-down" id="filter-chevron"></i>
            </button>
            <div id="filter-dropdown">
                ${makeSection('Type', typeTagList)}
                ${customSection}
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

        function getCheckedValues() {
            return [...dropdown.querySelectorAll('.filter-section input[type=checkbox]:checked')]
                .map(cb => cb.value);
        }

        function applyFilter() {
            const checked = getCheckedValues();
            document.querySelectorAll('.proj-card').forEach(card => {
                const cardTags = (card.dataset.tags || '').split(' ');
                const visible = checked.length > 0 && cardTags.some(t => checked.includes(t));
                card.style.display = visible ? '' : 'none';
            });
            pushFilterHash(checked);
        }

        function pushFilterHash(checked) {
            // Don't clobber a #project- hash
            if (location.hash.startsWith('#project-')) return;
            const hash = checked.length ? '#filters=' + checked.join(',') : '#filters=';
            history.replaceState(null, '', hash);
        }

        function loadFromHash() {
            const match = location.hash.match(/^#filters=(.*)$/);
            if (!match) return;
            const active = match[1] ? match[1].split(',') : [];
            dropdown.querySelectorAll('.filter-section input[type=checkbox]').forEach(cb => {
                cb.checked = active.includes(cb.value);
            });
            // Sync select-all checkboxes
            dropdown.querySelectorAll('.filter-section').forEach(section => {
                const all = [...section.querySelectorAll('input[type=checkbox]')].every(i => i.checked);
                const sa  = dropdown.querySelector(`.section-select-all[data-section="${section.dataset.section}"]`);
                if (sa) sa.checked = all;
            });
            // Apply without pushing hash again
            const checked = getCheckedValues();
            document.querySelectorAll('.proj-card').forEach(card => {
                const cardTags = (card.dataset.tags || '').split(' ');
                card.style.display = checked.length > 0 && cardTags.some(t => checked.includes(t)) ? '' : 'none';
            });
        }

        dropdown.addEventListener('change', (e) => {
            const cb = e.target;
            if (cb.classList.contains('section-select-all')) {
                const section = dropdown.querySelector(`.filter-section[data-section="${cb.dataset.section}"]`);
                section.querySelectorAll('input[type=checkbox]').forEach(item => item.checked = cb.checked);
            } else {
                const section = cb.closest('.filter-section');
                if (section) {
                    const allChecked = [...section.querySelectorAll('input[type=checkbox]')].every(i => i.checked);
                    const selectAll  = dropdown.querySelector(`.section-select-all[data-section="${section.dataset.section}"]`);
                    if (selectAll) selectAll.checked = allChecked;
                }
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

        // Collect all unique tags — type tags first, then custom tags alphabetically
        const typeTags = new Set(Object.values(TYPE_TAG));
        const customTags = new Set();
        projects.forEach(proj => getTags(proj).forEach(t => {
            if (typeTags.has(t)) return;
            customTags.add(t);
        }));
        const allTags = [
            ...Object.values(TYPE_TAG).filter(t => projects.some(p => getTags(p).includes(t))),
            ...[...customTags].sort((a, b) => a.localeCompare(b)),
        ];

        // Inject filter bar before the scroll area
        const scroll = document.getElementById('projects-scroll');
        scroll.insertAdjacentHTML('beforebegin', buildFilterBar(allTags, typeTags));

        // Move the toggle button up into the title bar
        const titleBar = document.getElementById('projects-title-bar');
        const toggle   = document.getElementById('filter-toggle');
        if (titleBar && toggle) titleBar.appendChild(toggle);

        // Build grid
        const grid = document.getElementById('projects-grid');
        if (!grid) return;

        const modals = document.getElementById('projects-modals');

        projects.forEach((proj, i) => {
            const id   = projectId(proj, i);
            const tags = getTags(proj);
            let card = '', modal = '';

            if (proj.type === 'youtube') {
                card  = buildYoutubeCard(proj.config, id, tags);
                modal = buildYoutubeModal(proj.config, id);
            } else if (proj.type === 'minecraft_mod') {
                card  = buildModCard(proj.config, id, tags);
                modal = buildModModal(proj.config, id);
            } else if (proj.type === 'project') {
                card  = buildProjectCard(proj.config, id, tags);
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
            // Restore filter hash if any filters are active
            const checked = [...document.querySelectorAll('#filter-dropdown .filter-section input[type=checkbox]:checked')]
                .map(cb => cb.value);
            history.pushState(null, '', checked.length ? '#filters=' + checked.join(',') : location.pathname);
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