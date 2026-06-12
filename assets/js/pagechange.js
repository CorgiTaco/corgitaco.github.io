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
        // e.target.closest ensures this works even if the user clicks
        // an icon or span *inside* the <a> tag.
        const link = e.target.closest(".nav-link");

        // If a nav-link was clicked, intercept it
        if (link) {
            e.preventDefault();
            const targetUrl = link.getAttribute("href");

            // Update the URL
            window.history.pushState(null, "", targetUrl);

            // Fetch new content
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

            const newMainContent = virtualDoc.getElementById("main");
            const currentMainElement = document.getElementById("main");

            if (newMainContent && currentMainElement) {
                setInnerHTML(currentMainElement, newMainContent.innerHTML);
                // Re-append spinner to new content and hide it
                currentMainElement.style.position = "relative";
                const newLoader = document.createElement("div");
                newLoader.id = "page-loader";
                newLoader.innerHTML = '<div class="spinner"></div>';
                currentMainElement.appendChild(newLoader);
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

// Your setInnerHTML function is actually great! It perfectly handles
// the classic issue of inline scripts not executing when using .innerHTML.
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