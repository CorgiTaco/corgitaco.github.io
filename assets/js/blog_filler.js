(function () {

    // ── Viewed history ────────────────────────────────────────────────────────

    const VIEWED_KEY    = 'blog-viewed-history';
    const FAVORITES_KEY = 'blog-favorites';
    let viewedPosts   = [];
    let favoritePosts = [];

    function loadViewedHistory() {
        try { viewedPosts = JSON.parse(localStorage.getItem(VIEWED_KEY)) || []; }
        catch { viewedPosts = []; }
    }

    function loadFavorites() {
        try { favoritePosts = JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; }
        catch { favoritePosts = []; }
    }

    function markAsViewed(slug) {
        if (!viewedPosts.includes(slug)) {
            viewedPosts.push(slug);
            try { localStorage.setItem(VIEWED_KEY, JSON.stringify(viewedPosts)); } catch {}
            document.querySelectorAll(`.blog-card[data-slug="${slug}"]`).forEach(c => {
                c.dataset.viewed = 'true';
            });
        }
    }

    function unmarkAsViewed(slug) {
        const i = viewedPosts.indexOf(slug);
        if (i > -1) {
            viewedPosts.splice(i, 1);
            try { localStorage.setItem(VIEWED_KEY, JSON.stringify(viewedPosts)); } catch {}
            document.querySelectorAll(`.blog-card[data-slug="${slug}"]`).forEach(c => {
                c.dataset.viewed = 'false';
            });
        }
    }

    function clearViewedHistory() {
        viewedPosts = [];
        try { localStorage.removeItem(VIEWED_KEY); } catch {}
        document.querySelectorAll('.blog-card[data-viewed="true"]').forEach(c => {
            c.dataset.viewed = 'false';
        });
        // Re-apply filter in case hide-viewed is active
        const hideViewedCb = document.getElementById('blog-hide-viewed');
        if (hideViewedCb && hideViewedCb.checked) {
            hideViewedCb.checked = false;
            updateUrlParams({ hideViewed: null });
            applyFilter();
        }
    }

    function isFavorited(slug) { return favoritePosts.includes(slug); }

    function toggleFavorite(slug) {
        const i = favoritePosts.indexOf(slug);
        if (i === -1) favoritePosts.push(slug);
        else          favoritePosts.splice(i, 1);
        try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritePosts)); } catch {}

        document.querySelectorAll(`.blog-card[data-slug="${slug}"]`).forEach(c => {
            c.dataset.favorited = isFavorited(slug) ? 'true' : 'false';
        });

        // Sync open modal star
        const modalStar = document.getElementById('blog-modal-fav-btn');
        if (modalStar && modalStar.dataset.slug === slug) syncModalStar(modalStar, slug);

        sortFavoritesFirst();
    }

    function syncModalStar(btn, slug) {
        const faved = isFavorited(slug);
        btn.classList.toggle('active', faved);
        btn.title = faved ? 'Remove from favorites' : 'Add to favorites';
    }

    function sortFavoritesFirst() {
        const grid = document.getElementById('blog-grid');
        if (!grid) return;
        const cards = [...grid.querySelectorAll('.blog-card')];
        cards.sort((a, b) => {
            const af = a.dataset.favorited === 'true' ? 0 : 1;
            const bf = b.dataset.favorited === 'true' ? 0 : 1;
            return af - bf;
        });
        cards.forEach(c => grid.appendChild(c));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function slugify(str) {
        return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // ── URL params ────────────────────────────────────────────────────────────

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

    // ── Parse frontmatter ─────────────────────────────────────────────────────

    function parseFrontmatter(raw) {
        const fence = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
        if (!fence) return { meta: {}, body: raw };

        const meta = {};
        let currentListKey = null, currentListItem = null;

        for (const rawLine of fence[1].split(/\r?\n/)) {
            const listItemMatch = rawLine.match(/^(\s+)-\s*$/);
            const listItemKV    = rawLine.match(/^(\s+)-\s+(\w[\w-]*):\s*["']?(.*?)["']?\s*$/);
            const listKV        = rawLine.match(/^(\s+)(\w[\w-]*):\s*["']?(.*?)["']?\s*$/);
            const topKV         = rawLine.match(/^(\w[\w-]*):\s*["']?(.*?)["']?\s*$/);
            const topList       = rawLine.match(/^(\w[\w-]*):\s*$/);

            if (listItemMatch) {
                if (currentListKey) {
                    currentListItem = {};
                    if (!Array.isArray(meta[currentListKey])) meta[currentListKey] = [];
                    meta[currentListKey].push(currentListItem);
                }
            } else if (listItemKV) {
                if (currentListKey) {
                    currentListItem = { [listItemKV[2]]: listItemKV[3] };
                    if (!Array.isArray(meta[currentListKey])) meta[currentListKey] = [];
                    meta[currentListKey].push(currentListItem);
                }
            } else if (listKV && currentListKey && currentListItem) {
                currentListItem[listKV[2]] = listKV[3];
            } else if (topList) {
                currentListKey = topList[1]; currentListItem = null;
                meta[currentListKey] = [];
            } else if (topKV) {
                currentListKey = null; currentListItem = null;
                if (topKV[1] === 'tags' && topKV[2]) {
                    meta.tags = topKV[2].split(',').map(t => t.trim()).filter(Boolean);
                } else {
                    meta[topKV[1]] = topKV[2];
                }
            }
        }
        return { meta, body: fence[2] };
    }

    // ── Tag chips ─────────────────────────────────────────────────────────────

    function buildTagChips(tags, maxVisible, clickable) {
        if (!tags || !tags.length) return '';
        maxVisible = maxVisible || 99;
        const visible  = tags.slice(0, maxVisible);
        const overflow = tags.length - visible.length;
        const chips = visible.map(t =>
            `<span class="blog-tag${clickable ? ' blog-tag-btn' : ''}" data-tag="${slugify(t)}">`
            + `<i class="fa fa-tag"></i>${t}</span>`
        ).join('');
        const more = overflow > 0 ? `<span class="blog-tag blog-tag-overflow">+${overflow}</span>` : '';
        return `<div class="blog-tag-row">${chips}${more}</div>`;
    }

    // ── Layout state ──────────────────────────────────────────────────────────

    let currentLayout = 'grid';

    function setLayout(l) {
        currentLayout = l;
        document.getElementById('blog-grid')?.classList.toggle('blog-list-view', l === 'list');
        document.getElementById('layout-btn-grid')?.classList.toggle('active', l === 'grid');
        document.getElementById('layout-btn-list')?.classList.toggle('active', l === 'list');
    }

    // ── Filter ────────────────────────────────────────────────────────────────

    function getCheckedTags() {
        const dd = document.getElementById('blog-filter-dropdown');
        if (!dd) return null; // null = all
        const all = [...dd.querySelectorAll('.blog-tag-cb')];
        if (!all.length) return null;
        const checked = all.filter(cb => cb.checked).map(cb => cb.value);
        return checked.length === all.length ? null : checked; // null means "all checked"
    }

    function getHideViewed() {
        return document.getElementById('blog-hide-viewed')?.checked || false;
    }

    function applyFilter() {
        const checkedTags = getCheckedTags(); // null = all
        const hideViewed  = getHideViewed();
        const tagSet      = checkedTags ? new Set(checkedTags) : null;

        document.querySelectorAll('.blog-card').forEach(card => {
            const cardTags = (card.dataset.tags || '').split(',').filter(Boolean);
            const isViewed = card.dataset.viewed === 'true';

            if (hideViewed && isViewed) { card.style.display = 'none'; return; }

            if (tagSet) {
                // Show if card has no tags (untagged) OR any tag matches
                const matches = cardTags.length === 0 || cardTags.some(t => tagSet.has(t));
                card.style.display = matches ? '' : 'none';
            } else {
                card.style.display = '';
            }
        });

        // Update URL
        const dd = document.getElementById('blog-filter-dropdown');
        const total = dd ? dd.querySelectorAll('.blog-tag-cb').length : 0;
        updateUrlParams({
            tags:       checkedTags && checkedTags.length < total ? checkedTags : null,
            hideViewed: hideViewed ? 'true' : null,
        });

        // Sync select-all checkbox
        const sa = document.getElementById('blog-tag-select-all');
        if (sa) {
            const all = dd ? [...dd.querySelectorAll('.blog-tag-cb')] : [];
            sa.checked = all.length > 0 && all.every(cb => cb.checked);
        }
    }

    function loadFilterFromParams() {
        const params    = new URLSearchParams(window.location.search);
        const tagParam  = params.get('tags');
        const hideParam = params.get('hideViewed');
        if (!tagParam && !hideParam) return;

        const dd = document.getElementById('blog-filter-dropdown');
        if (dd && tagParam) {
            const active = tagParam !== 'none' ? new Set(tagParam.split(',')) : new Set();
            dd.querySelectorAll('.blog-tag-cb').forEach(cb => {
                cb.checked = active.has(cb.value);
            });
        }

        const hideViewedCb = document.getElementById('blog-hide-viewed');
        if (hideViewedCb && hideParam === 'true') hideViewedCb.checked = true;

        applyFilter();
    }

    // ── Build title bar ───────────────────────────────────────────────────────

    function buildTitleBar(posts) {
        // Collect unique tags across all posts
        const tagMap = new Map();
        posts.forEach(p => (p.tags || []).forEach(t => tagMap.set(slugify(t), t)));

        let tagChecks = '';
        tagMap.forEach((name, slug) => {
            tagChecks += `<label class="filter-tag">
                <input type="checkbox" class="blog-tag-cb" value="${slug}" checked>
                <span><i class="fa fa-tag"></i> ${name}</span>
            </label>`;
        });

        const tagsSection = tagMap.size > 0 ? `
            <div class="filter-section-wrap">
                <div class="filter-section-label">Tags</div>
                <label class="filter-tag filter-select-all-tag">
                    <input type="checkbox" id="blog-tag-select-all" checked>
                    <span>Select all</span>
                </label>
                <div class="filter-section">${tagChecks}</div>
            </div>` : '';

        const statusSection = `
            <div class="filter-section-wrap">
                <div class="filter-section-label">Status</div>
                <div class="filter-section">
                    <label class="filter-tag">
                        <input type="checkbox" id="blog-hide-viewed">
                        <span>Hide Viewed</span>
                    </label>
                </div>
            </div>`;

        const filterHtml = `
        <div id="blog-filter-bar">
            <button id="blog-filter-toggle" class="btn-theme">
                <i class="fa fa-filter"></i><span> Filter </span><i class="fa fa-chevron-down" id="blog-filter-chevron"></i>
            </button>
            <div id="blog-filter-dropdown">
                ${tagsSection}
                ${statusSection}
            </div>
        </div>`;

        return `
        <div id="projects-title-bar">
            <h1 class="page-title">Blog</h1>
            <div id="title-actions-group">
                <button id="blog-clear-viewed-btn" class="btn-theme" title="Clear view history">
                    <i class="fa fa-eye"></i> <i class="fa fa-trash"></i>
                </button>
                ${filterHtml}
            </div>
            <div id="layout-pill">
                <button id="layout-btn-grid" class="layout-pill-btn active" title="Grid view"><i class="fa fa-th"></i></button>
                <button id="layout-btn-list" class="layout-pill-btn"        title="List view"><i class="fa fa-list"></i></button>
            </div>
        </div>`;
    }

    // ── Dropdown positioning (same as project_filler) ─────────────────────────

    function positionDropdown(toggle, dropdown) {
        dropdown.style.visibility = 'hidden';
        dropdown.style.display = 'flex';
        const tb  = toggle.getBoundingClientRect();
        const dw  = dropdown.offsetWidth;
        const dh  = dropdown.offsetHeight;
        const main = document.getElementById('main');
        const mb  = main ? main.getBoundingClientRect()
            : { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
        const PAD = 6;
        let top  = tb.bottom + 1;
        if (top + dh > mb.bottom - PAD) top = Math.max(mb.top + PAD, tb.top - dh - 1);
        let left = tb.right - dw;
        if (left < mb.left + PAD)       left = mb.left + PAD;
        if (left + dw > mb.right - PAD) left = mb.right - dw - PAD;
        dropdown.style.top  = top  + 'px';
        dropdown.style.left = left + 'px';
        dropdown.style.display = '';
        dropdown.style.visibility = '';
    }

    function closeAllDropdowns(except) {
        const dd = document.getElementById('blog-filter-dropdown');
        if (dd && dd !== except && dd.classList.contains('open')) {
            dd.classList.remove('open');
            const chev = document.getElementById('blog-filter-chevron');
            if (chev) chev.style.transform = '';
        }
    }

    // ── Build card ────────────────────────────────────────────────────────────

    function buildCard(post) {
        const slug     = post.slug;
        const viewed   = viewedPosts.includes(slug)   ? 'true' : 'false';
        const favorited = isFavorited(slug)            ? 'true' : 'false';
        const tagSlugs = (post.tags || []).map(slugify).join(',');
        const tagHtml  = buildTagChips(post.tags, 4, true);
        const dateStr  = formatDate(post.date);
        const excerpt  = post.excerpt ? `<p class="blog-card-excerpt">${post.excerpt}</p>` : '';

        return `
        <div class="blog-card" data-slug="${slug}" data-viewed="${viewed}" data-favorited="${favorited}" data-tags="${tagSlugs}"
             tabindex="0" role="button" aria-label="Open: ${post.title}">
            <div class="blog-card-thumb">
                <img src="${post.photo || ''}" alt="${post.title}" loading="lazy"
                     style="object-fit:${post.photo_fit || 'cover'}">
                <div class="blog-viewed-overlay">
                    <i class="fa fa-eye blog-eye-icon" title="Mark as unread"></i>
                </div>
                <div class="blog-fav-overlay">
                    <i class="fa fa-star blog-fav-star" title="Favorite"></i>
                </div>
            </div>
            <div class="blog-card-body">
                <div class="blog-card-title">${post.title}</div>
                <div class="blog-card-meta">
                    ${post.author ? `<span><i class="fa fa-user"></i> ${post.author}</span>` : ''}
                    ${dateStr    ? `<span><i class="fa fa-calendar"></i> ${dateStr}</span>` : ''}
                </div>
                ${tagHtml}
                ${excerpt}
            </div>
        </div>`;
    }

    // ── Open / close modal ────────────────────────────────────────────────────

    function openModal(post) {
        markAsViewed(post.slug);

        // If hide-viewed is on, re-apply so card disappears if needed
        const hideViewedCb = document.getElementById('blog-hide-viewed');
        if (hideViewedCb && hideViewedCb.checked) applyFilter();

        const overlay  = document.getElementById('blog-modal-overlay');
        const inner    = document.getElementById('blog-modal-inner');
        const winTitle = document.getElementById('blog-modal-win-title');
        const banner   = document.getElementById('blog-modal-banner');
        const content  = document.getElementById('blog-modal-content');
        const sidebar  = document.getElementById('blog-modal-sidebar');
        const favBtn   = document.getElementById('blog-modal-fav-btn');

        winTitle.textContent = post.title + ' — zsh';

        if (post.photo) {
            banner.src = post.photo; banner.alt = post.title;
            banner.style.objectFit = post.photo_fit || 'cover';
            banner.style.display = 'block';
        } else {
            banner.style.display = 'none';
        }

        // Wire fav button
        if (favBtn) {
            favBtn.dataset.slug = post.slug;
            syncModalStar(favBtn, post.slug);
            favBtn.onclick = (e) => { e.stopPropagation(); toggleFavorite(post.slug); };
        }

        // Sidebar
        const dateHtml = post.date ? `
            <div class="blog-sidebar-section">
                <div class="blog-sidebar-label"><i class="fa fa-calendar"></i> Published</div>
                <div class="blog-sidebar-value">${formatDate(post.date)}</div>
            </div>` : '';

        const authorHtml = post.author ? `
            <div class="blog-sidebar-section">
                <div class="blog-sidebar-label"><i class="fa fa-user"></i> Author</div>
                <div class="blog-sidebar-value">${post.author}</div>
            </div>` : '';

        let downloadsHtml = '';
        if (Array.isArray(post.downloads) && post.downloads.length > 0) {
            const btns = post.downloads.map(dl => `
                <a href="${dl.url}" target="_blank" rel="noopener" class="blog-download-btn">
                    <i class="fa fa-download"></i><span>${dl.name}</span>
                </a>`).join('');
            downloadsHtml = `
            <div class="blog-sidebar-section">
                <div class="blog-sidebar-label"><i class="fa fa-download"></i> Downloads</div>
                <div id="blog-modal-downloads">${btns}</div>
            </div>`;
        }

        const tagsHtml = (post.tags && post.tags.length) ? `
            <div class="blog-sidebar-section">
                <div class="blog-sidebar-label"><i class="fa fa-tag"></i> Tags</div>
                <div class="blog-sidebar-tags">${buildTagChips(post.tags)}</div>
            </div>` : '';

        sidebar.innerHTML = dateHtml + authorHtml + downloadsHtml + tagsHtml;

        // Render markdown
        if (typeof marked !== 'undefined') {
            marked.setOptions({ breaks: true, gfm: true });
            content.innerHTML = marked.parse(post.body || '');
        } else {
            content.textContent = post.body || '';
        }

        inner.scrollTop = 0;
        inner.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        history.pushState(null, '', location.pathname + location.search + '#blog-' + post.slug);
    }

    function closeModal() {
        document.getElementById('blog-modal-overlay').classList.remove('active');
        document.getElementById('blog-modal-inner').classList.remove('active');
        document.body.style.overflow = '';
        if (location.hash.startsWith('#blog-')) {
            history.pushState(null, '', location.pathname + location.search);
        }
    }

    // ── Wire everything ───────────────────────────────────────────────────────

    function wireAll(posts) {
        const grid = document.getElementById('blog-grid');

        // ── Card area clicks ──
        grid.addEventListener('click', (e) => {
            // Eye icon → unmark viewed
            const eye = e.target.closest('.blog-eye-icon');
            if (eye) {
                e.stopPropagation();
                const card = eye.closest('.blog-card');
                if (card) unmarkAsViewed(card.dataset.slug);
                return;
            }
            // Fav star → toggle favorite
            const star = e.target.closest('.blog-fav-star');
            if (star) {
                e.stopPropagation();
                const card = star.closest('.blog-card');
                if (card) toggleFavorite(card.dataset.slug);
                return;
            }
            // Tag chip → filter
            const chip = e.target.closest('.blog-tag-btn');
            if (chip) {
                e.stopPropagation();
                const slug = chip.dataset.tag;
                // Uncheck all, check just this tag
                document.querySelectorAll('.blog-tag-cb').forEach(cb => {
                    cb.checked = cb.value === slug;
                });
                const sa = document.getElementById('blog-tag-select-all');
                if (sa) sa.checked = false;
                applyFilter();
                return;
            }
            // Card → open modal
            const card = e.target.closest('.blog-card');
            if (card) {
                const post = posts.find(p => p.slug === card.dataset.slug);
                if (post) openModal(post);
            }
        });

        grid.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.blog-card');
            if (!card) return;
            const post = posts.find(p => p.slug === card.dataset.slug);
            if (post) openModal(post);
        });

        // ── Layout pill ──
        document.getElementById('layout-btn-grid')?.addEventListener('click', () => setLayout('grid'));
        document.getElementById('layout-btn-list')?.addEventListener('click', () => setLayout('list'));

        // ── Clear viewed ──
        document.getElementById('blog-clear-viewed-btn')?.addEventListener('click', clearViewedHistory);

        // ── Filter dropdown ──
        const filterToggle = document.getElementById('blog-filter-toggle');
        const filterDd     = document.getElementById('blog-filter-dropdown');
        const filterChev   = document.getElementById('blog-filter-chevron');

        if (filterToggle && filterDd) {
            filterToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllDropdowns(filterDd);
                positionDropdown(filterToggle, filterDd);
                const open = filterDd.classList.toggle('open');
                if (filterChev) filterChev.style.transform = open ? 'rotate(180deg)' : '';
            });

            filterDd.addEventListener('click', (e) => e.stopPropagation());

            filterDd.addEventListener('change', (e) => {
                const cb = e.target;
                // Select-all for tags
                if (cb.id === 'blog-tag-select-all') {
                    filterDd.querySelectorAll('.blog-tag-cb').forEach(c => { c.checked = cb.checked; });
                } else if (cb.classList.contains('blog-tag-cb')) {
                    const all = [...filterDd.querySelectorAll('.blog-tag-cb')];
                    const sa  = document.getElementById('blog-tag-select-all');
                    if (sa) sa.checked = all.every(c => c.checked);
                }
                applyFilter();
            });

            document.addEventListener('click', () => {
                if (filterDd.classList.contains('open')) {
                    filterDd.classList.remove('open');
                    if (filterChev) filterChev.style.transform = '';
                }
            });
        }

        // ── Modal controls ──
        document.getElementById('blog-modal-close-btn')?.addEventListener('click', closeModal);
        document.getElementById('blog-modal-back')?.addEventListener('click', closeModal);
        document.getElementById('blog-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('blog-modal-overlay')) closeModal();
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
        window.addEventListener('popstate', () => handleHash(window._blogPosts || []));
    }

    // ── Discover & fetch posts ────────────────────────────────────────────────

    const BLOG_DIR = '../assets/blog/';

    async function discoverPosts() {
        const res = await fetch(BLOG_DIR + 'internal/posts.txt');
        if (!res.ok) throw new Error('Could not load posts.txt');
        return (await res.text())
            .split(/\r?\n/).map(l => l.trim())
            .filter(l => l && !l.startsWith('#'))
            .map(filename => ({ slug: filename.replace(/\.md$/i, ''), file: BLOG_DIR + filename }));
    }

    async function fetchPost(entry) {
        try {
            const res            = await fetch(entry.file);
            if (!res.ok) throw new Error('fetch failed');
            const { meta, body } = parseFrontmatter(await res.text());
            return {
                slug:      entry.slug,
                title:     meta.title     || entry.slug,
                photo:     meta.photo     || '',
                photo_fit: meta.photo_fit || 'cover',
                date:      meta.date      || '',
                author:    meta.author    || '',
                excerpt:   meta.excerpt   || '',
                tags:      Array.isArray(meta.tags) ? meta.tags : [],
                downloads: meta.downloads || [],
                body,
            };
        } catch (err) {
            console.warn('Could not load blog post:', entry.file, err);
            return null;
        }
    }

    function handleHash(posts) {
        const hash = location.hash;
        if (!hash.startsWith('#blog-')) return;
        const post = posts.find(p => p.slug === hash.replace('#blog-', ''));
        if (post) openModal(post);
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    async function bootstrap() {
        const main = document.getElementById('main');

        // Check if blog is already here OR if our sync lock exists
        if (!main || document.getElementById('blog-grid') || document.getElementById('blog-sync-lock')) return;

        // IMMEDIATELY inject a hidden lock element so any duplicate async calls see it instantly and abort
        main.insertAdjacentHTML('beforeend', '<div id="blog-sync-lock" style="display:none;"></div>');

        loadViewedHistory();
        loadFavorites();

        // Discover + fetch
        let entries = [];
        try { entries = await discoverPosts(); } catch (err) { console.warn(err); }

        const results = entries.length ? await Promise.all(entries.map(fetchPost)) : [];
        const posts   = results.filter(Boolean);
        posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        window._blogPosts = posts;

        // Inject title bar
        main.insertAdjacentHTML('beforeend', buildTitleBar(posts));

        // Inject scroll container into #main
        main.insertAdjacentHTML('beforeend', `
            <div id="blog-scroll">
                <div id="blog-grid"></div>
                <div id="blog-empty"><i class="fa fa-pencil"></i><span>No posts yet.</span></div>
            </div>
        `);

        // Inject modal on <body> (outside #main) so position:fixed works correctly
        // on mobile browsers where overflow:hidden on #main would trap fixed children.
        // Remove any stale overlay from a previous navigation first.
        const staleOverlay = document.getElementById('blog-modal-overlay');
        if (staleOverlay) staleOverlay.remove();
        document.body.style.overflow = ''; // clean up any stuck overflow from prior run

        document.body.insertAdjacentHTML('beforeend', `
            <div id="blog-modal-overlay">
                <div id="blog-modal-inner">
                    <div id="blog-modal-titlebar">
                        <div class="blog-modal-win-controls">
                            <span class="blog-modal-win-btn blog-modal-win-close" id="blog-modal-close-btn"></span>
                            <span class="blog-modal-win-btn blog-modal-win-minimize"></span>
                            <span class="blog-modal-win-btn blog-modal-win-maximize"></span>
                        </div>
                        <span id="blog-modal-win-title"></span>
                        <button class="blog-modal-fav-btn btn-theme" id="blog-modal-fav-btn" title="Add to favorites">
                            <i class="fa fa-star"></i>
                        </button>
                    </div>
                    <img id="blog-modal-banner" src="" alt="">
                    <div id="blog-modal-body">
                        <div id="blog-modal-content"></div>
                        <div id="blog-modal-sidebar"></div>
                    </div>
                    <div id="blog-modal-footer">
                        <button id="blog-modal-back"><i class="fa fa-arrow-left"></i> Back</button>
                    </div>
                </div>
            </div>
        `);

        if (!posts.length) {
            document.getElementById('blog-empty').style.display = 'flex';
        } else {
            const grid = document.getElementById('blog-grid');
            posts.forEach(post => grid.insertAdjacentHTML('beforeend', buildCard(post)));
            sortFavoritesFirst();
        }

        wireAll(posts);
        loadFilterFromParams();
        handleHash(posts);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();