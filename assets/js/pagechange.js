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

    // 1. Use Event Delegation on the document body
    document.body.addEventListener("click", (e) => {
        const link = e.target.closest(".nav-link");
        if (link) {
            e.preventDefault();
            const targetUrl = link.getAttribute("href");
            window.history.pushState(null, "", targetUrl);
            handleRoute(targetUrl);
        }
    });

    // 2. Listen for browser Back/Forward button clicks
    window.addEventListener("popstate", () => {
        handleRoute(window.location.pathname);
    });

});

function handleRoute(url) {
    console.log(`URL switched to: ${url}`);

    // Always restore body scroll — any open modal (commission, blog, etc.) sets
    // document.body.style.overflow = 'hidden'. If the user navigates away before
    // closing the modal, that value sticks and clips position:fixed elements like
    // #mobile-nav, making the bottom nav bar disappear on mobile.
    document.body.style.overflow = '';

    // Show spinner
    const loader = document.getElementById("page-loader");
    if (loader) loader.classList.add("active");

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(htmlData => {
            const parser = new DOMParser();
            const virtualDoc = parser.parseFromString(htmlData, 'text/html');

            // Sync Document Title
            if (virtualDoc.title) {
                document.title = virtualDoc.title;
            }

            // Sync Stylesheets
            Array.from(virtualDoc.querySelectorAll('head link[rel="stylesheet"]')).forEach(newLink => {
                const href = newLink.getAttribute('href');
                if (!document.querySelector(`head link[href="${href}"]`)) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = href;
                    document.head.appendChild(link);
                }
            });

            const newMainContent = virtualDoc.getElementById("main");
            const currentMainElement = document.getElementById("main");

            if (newMainContent && currentMainElement) {
                setInnerHTML(currentMainElement, newMainContent.innerHTML);

                // Re-append spinner to new content
                currentMainElement.style.position = "relative";
                const newLoader = document.createElement("div");
                newLoader.id = "page-loader";
                newLoader.innerHTML = '<div class="spinner"></div>';
                currentMainElement.appendChild(newLoader);

                // --- Update mobile nav trigger label to reflect the new page ---
                // #mobile-nav lives on <body> and is built once on first load.
                // After SPA navigation the trigger still shows the old page name,
                // and the active link highlight is wrong — fix both here.
                const navPath = new URL(url, window.location.href).pathname.replace(/\/$/, '');
                const navSegments = navPath.split('/');
                const navLastSegment = navSegments[navSegments.length - 1]
                    .replace(/\.html$/i, '')
                    .replace(/\.htm$/i, '');
                const newPageLabel = (!navLastSegment || navLastSegment.toLowerCase() === 'index')
                    ? 'Home'
                    : navLastSegment.charAt(0).toUpperCase() + navLastSegment.slice(1);

                // Update active state on each link and find the matching icon
                let newIcon = '';
                document.querySelectorAll('#mobile-nav-list a').forEach(a => {
                    const linkText = a.textContent.trim();
                    const isMatch = linkText.toLowerCase().includes(newPageLabel.toLowerCase());
                    a.classList.toggle('active', isMatch);
                    if (isMatch) {
                        const i = a.querySelector('i');
                        if (i) newIcon = i.outerHTML + ' ';
                    }
                });

                const trigger = document.querySelector('#mobile-nav-trigger span');
                if (trigger) trigger.innerHTML = newIcon + newPageLabel;

                // Collapse the nav if it was left open
                document.getElementById('mobile-nav')?.classList.remove('open');

            } else {
                console.error("Could not find #main element in the fetched document or current document.");
                if (loader) loader.classList.remove("active");
            }
        })
        .catch(error => {
            console.error('Error loading the HTML file:', error);
            const l = document.getElementById("page-loader");
            if (l) l.classList.remove("active");
        });
}

function setInnerHTML(elm, html) {
    elm.innerHTML = html;

    Array.from(elm.querySelectorAll("script"))
        .forEach(oldScriptEl => {
            const newScriptEl = document.createElement("script");

            Array.from(oldScriptEl.attributes).forEach(attr => {
                newScriptEl.setAttribute(attr.name, attr.value);
            });

            const scriptText = document.createTextNode(oldScriptEl.innerHTML);
            newScriptEl.appendChild(scriptText);

            oldScriptEl.parentNode.replaceChild(newScriptEl, oldScriptEl);
        });
}