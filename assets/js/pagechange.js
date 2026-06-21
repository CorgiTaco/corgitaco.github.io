// Tracks the AbortController for the currently in-flight navigation so that
// rapid clicks cancel the previous fetch before starting the next one.
// Stored on window so SPA re-execution of this script never hits a let redeclaration error.
window._navController = window._navController || null;

document.addEventListener("DOMContentLoaded", () => {

    // Inject spinner styles
    const style = document.createElement("style");
    style.textContent = `
        #page-loader {
            display: none;
            position: absolute;
            inset: 0;
            justify-content: center;
            align-items: center;
            background: rgb(20 20 20 / 60%);
            z-index: 999;
            border-radius: inherit;
        }
        #page-loader.active {
            display: flex;
        }
        #page-loader .spinner {
            width: 42px;
            height: 42px;
            border: 3px solid rgba(70, 162, 88, 0.2);
            border-top-color: #46a258;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // Inject spinner element into #main
    const main = document.getElementById("main");
    if (main) {
        main.style.position = "relative";
        const loader = document.createElement("div");
        loader.id = "page-loader";
        loader.innerHTML = '<div class="spinner"></div>';
        main.appendChild(loader);
    }

    // Single click listener — script.js must NOT register its own to avoid double-firing.
    document.body.addEventListener("click", (e) => {
        const link = e.target.closest(".nav-link");
        if (link) {
            e.preventDefault();
            const targetUrl = link.getAttribute("href");
            window.history.pushState(null, "", targetUrl);
            handleRoute(targetUrl);
        }
    });

    // Back / Forward buttons
    window.addEventListener("popstate", () => {
        handleRoute(window.location.pathname);
    });

});

function handleRoute(url) {
    // Cancel any previous in-flight fetch so stale responses never overwrite newer ones.
    if (window._navController) window._navController.abort();
    window._navController = new AbortController();
    const signal = window._navController.signal;

    // Always restore body scroll — modals set overflow:hidden and navigation must clear it.
    document.body.style.overflow = '';

    const loader = document.getElementById("page-loader");
    if (loader) loader.classList.add("active");

    // Use explicit /index.html so local dev servers work without GitHub Pages rewriting.
    const fetchUrl = /\.html?$/.test(url) ? url : url.replace(/\/?$/, '/index.html');

    fetch(fetchUrl, { signal })
        .then(response => {
            if (signal.aborted) return null;
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        })
        .then(htmlData => {
            if (!htmlData || signal.aborted) return;

            const parser = new DOMParser();
            const virtualDoc = parser.parseFromString(htmlData, 'text/html');

            if (virtualDoc.title) document.title = virtualDoc.title;

            // Sync any new stylesheets the fetched page needs.
            // Collect load promises so content is injected only after resources apply.
            const stylePromises = [];
            Array.from(virtualDoc.querySelectorAll('head link[rel="stylesheet"]')).forEach(newLink => {
                const href = newLink.getAttribute('href');
                if (!document.querySelector(`head link[href="${href}"]`)) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = href;
                    stylePromises.push(new Promise(resolve => {
                        link.onload  = resolve;
                        link.onerror = resolve;
                    }));
                    document.head.appendChild(link);
                }
            });

            const newMainContent = virtualDoc.getElementById("main");
            const currentMainElement = document.getElementById("main");

            if (newMainContent && currentMainElement) {
                return Promise.all(stylePromises).then(function() {
                if (signal.aborted) return;

                // Sync body-level portals (elements outside #main that scripts depend on,
                // e.g. modal overlays on the resume page that must anchor to <body> for
                // position:fixed to work on mobile). Clean up old portals first, then move
                // any from the incoming page before scripts execute.
                document.querySelectorAll('.body-portal').forEach(function(el) { el.remove(); });
                virtualDoc.querySelectorAll('.body-portal').forEach(function(el) {
                    document.body.appendChild(el);
                });

                // Destroy any Chart.js instances before replacing content so their
                // internal RAF loops and resize observers don't keep running after navigation.
                if (window.Chart) {
                    Object.values(Chart.instances).forEach(c => { try { c.destroy(); } catch {} });
                }

                setInnerHTML(currentMainElement, newMainContent.innerHTML);

                // Re-inject spinner into the freshly replaced #main
                currentMainElement.style.position = "relative";
                const newLoader = document.createElement("div");
                newLoader.id = "page-loader";
                newLoader.innerHTML = '<div class="spinner"></div>';
                currentMainElement.appendChild(newLoader);

                // Rebuild desktop nav + update mobile nav trigger for the new page.
                // _navReady is already resolved at this point so the .then runs immediately
                // as a microtask — no visible delay.
                window._navReady.then(function(items) {
                    if (signal.aborted) return;

                    window._buildNav(items);
                    if (window._calcWidth) window._calcWidth();

                    // Determine the site-relative path so /corgitaco.github.io prefix
                    // (used by IntelliJ's dev server) doesn't break active-tab matching.
                    const basePath = window._navBasePath || '';
                    const rawPath = new URL(url, window.location.href).pathname.replace(/\/$/, '');
                    const p = rawPath.startsWith(basePath) ? rawPath.slice(basePath.length) : rawPath;
                    const currentPath = p || '/';

                    const activeItem = items.find(function(item) {
                        return item.href === '/'
                            ? (currentPath === '' || currentPath === '/')
                            : currentPath === item.href;
                    });
                    const newPageLabel = activeItem ? activeItem.label : 'Home';

                    let newIcon = '';
                    document.querySelectorAll('#mobile-nav-list a').forEach(function(a) {
                        const isMatch = a.textContent.trim() === newPageLabel;
                        a.classList.toggle('active', isMatch);
                        if (isMatch) {
                            const i = a.querySelector('i');
                            if (i) newIcon = i.outerHTML + ' ';
                        }
                    });

                    const trigger = document.querySelector('#mobile-nav-trigger span');
                    if (trigger) trigger.innerHTML = newIcon + newPageLabel;

                    document.getElementById('mobile-nav')?.classList.remove('open');
                });

                window._alertReady.then(function(alertData) {
                    if (signal.aborted) return;
                    window._applyAlert(alertData);
                });

                }); // end Promise.all(stylePromises).then

            } else {
                console.error("Could not find #main in fetched document.");
                const l = document.getElementById("page-loader");
                if (l) l.classList.remove("active");
            }
        })
        .catch(error => {
            if (error.name === 'AbortError') return; // Expected — a newer navigation superseded this one
            console.error('Navigation error:', error);
            const l = document.getElementById("page-loader");
            if (l) l.classList.remove("active");
        });
}

function setInnerHTML(elm, html) {
    elm.innerHTML = html;

    // Re-create <script> elements so their code actually executes after innerHTML assignment.
    Array.from(elm.querySelectorAll("script")).forEach(oldScriptEl => {
        const newScriptEl = document.createElement("script");
        Array.from(oldScriptEl.attributes).forEach(attr => {
            newScriptEl.setAttribute(attr.name, attr.value);
        });
        newScriptEl.appendChild(document.createTextNode(oldScriptEl.innerHTML));
        oldScriptEl.parentNode.replaceChild(newScriptEl, oldScriptEl);
    });
}
