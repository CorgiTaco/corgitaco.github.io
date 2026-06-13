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