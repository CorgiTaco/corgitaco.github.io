document.addEventListener("DOMContentLoaded", () => {

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

            // Safeguard: Make sure the target page actually has a #main element
            const newMainContent = virtualDoc.getElementById("main");
            const currentMainElement = document.getElementById("main");

            if (newMainContent && currentMainElement) {
                setInnerHTML(currentMainElement, newMainContent.innerHTML);
            } else {
                console.error("Could not find #main element in the fetched document or current document.");
            }
        })
        .catch(error => {
            console.error('Error loading the HTML file:', error);
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