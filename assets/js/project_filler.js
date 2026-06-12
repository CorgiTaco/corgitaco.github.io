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

    // ── Card builders ────────────────────────────────────────────────────────

    function buildYoutubeCard(cfg, id) {
        const vid = youtubeId(cfg.url);
        const thumb = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
        const fit = cfg.thumb_fit || 'cover';
        const label = cfg.name || 'Video';
        return `
        <div class="proj-card" data-id="${id}" tabindex="0" role="button" aria-label="Open ${label}">
            <div class="proj-thumb yt-thumb">
                <img src="${thumb}" alt="YouTube video thumbnail" loading="lazy" style="object-fit:${fit}">
                <div class="yt-play"><i class="fa fa-play-circle"></i></div>
            </div>
            <div class="proj-label"><i class="fa fa-youtube-play"></i> ${label}</div>
        </div>`;
    }

    function buildModCard(cfg, id) {
        const fit = cfg.thumb_fit || 'cover';
        return `
        <div class="proj-card" data-id="${id}" tabindex="0" role="button" aria-label="Open ${cfg.name}">
            <div class="proj-thumb">
                <img src="${cfg.photo}" alt="${cfg.name}" loading="lazy" style="object-fit:${fit}">
            </div>
            <div class="proj-label"><i class="fa fa-puzzle-piece"></i> ${cfg.name}</div>
        </div>`;
    }

    function buildProjectCard(cfg, id) {
        const fit = cfg.thumb_fit || 'cover';
        return `
        <div class="proj-card" data-id="${id}" tabindex="0" role="button" aria-label="Open ${cfg.name}">
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

    // ── Main init ────────────────────────────────────────────────────────────

    function init(projects) {
        // Sort by date descending (most recent first)
        projects.sort((a, b) => {
            const da = (a.config && a.config.date) ? new Date(a.config.date) : new Date(0);
            const db = (b.config && b.config.date) ? new Date(b.config.date) : new Date(0);
            return db - da;
        });

        // Build grid
        const grid = document.getElementById('projects-grid');
        if (!grid) return;

        const modals = document.getElementById('projects-modals');

        projects.forEach((proj, i) => {
            const id = projectId(proj, i);
            let card = '', modal = '';

            if (proj.type === 'youtube') {
                card  = buildYoutubeCard(proj.config, id);
                modal = buildYoutubeModal(proj.config, id);
            } else if (proj.type === 'minecraft_mod') {
                card  = buildModCard(proj.config, id);
                modal = buildModModal(proj.config, id);
            } else if (proj.type === 'project') {
                card  = buildProjectCard(proj.config, id);
                modal = buildProjectModal(proj.config, id);
            }

            grid.insertAdjacentHTML('beforeend', card);
            modals.insertAdjacentHTML('beforeend', modal);
        });

        // ── Event wiring ──────────────────────────────────────────────────

        // Open modal via card click
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

        // Back buttons
        modals.addEventListener('click', (e) => {
            if (e.target.closest('.modal-back')) closeModal();
        });

        // Click outside modal-inner to close
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-overlay')) closeModal();
        });

        // Keyboard close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        // Hash routing
        window.addEventListener('hashchange', handleHash);
        handleHash();
    }

    function openModal(id) {
        const overlay  = document.getElementById('modal-overlay');
        const allInner = document.querySelectorAll('.modal-inner');
        allInner.forEach(el => el.classList.remove('active'));

        const target = document.getElementById('modal-' + id);
        if (!target) return;

        // Start YouTube video by loading src from data-src
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

        // Truly stop YouTube by blanking the src
        overlay.querySelectorAll('iframe[data-src]').forEach(iframe => {
            iframe.src = '';
        });

        if (location.hash.startsWith('#project-')) {
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
        // Inject grid + modal overlay into #main
        const main = document.getElementById('main');
        if (!main) return;

        // Only inject once
        if (document.getElementById('projects-grid')) return;

        main.insertAdjacentHTML('beforeend', `
            <div id="projects-grid"></div>
            <div id="modal-overlay">
                <div id="projects-modals"></div>
            </div>
        `);

        // Load projects.json relative to current page
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