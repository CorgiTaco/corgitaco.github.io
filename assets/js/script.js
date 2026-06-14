// Wait for the DOM to load before targeting the element
document.addEventListener("DOMContentLoaded", () => {
    window.vantaEffect = VANTA.WAVES({
        el: '#vanta-bg', // Vanta can take the ID string directly
        mouseControls: true,
        touchControls: true,
        gyroControls: true,
        minHeight: 200,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x08200c, // Fixed: Added the leading 0 for a valid 6-digit hex
        shininess: 22.00,
        waveHeight: 23.50,
        waveSpeed: 0.65,
        zoom: 0.75
    });

    function calcWidth() {
        // Add measuring class to disable flex-grow during measurement
        $('#nav-main').addClass('measuring');

        var navwidth = 0;
        var more = $('#nav-main .more');

        // Get the exact width of the burger menu (or use the fallback data-width if hidden)
        var morewidth = more.is(':visible') ? more.outerWidth(true) : (more.data('width') || 80);

        $('#nav-main > li:not(.more)').each(function() {
            // Add the physical width PLUS the 4px flexbox gap following the tab
            navwidth += $(this).outerWidth(true) + 4;
        });

        // Calculate available space:
        // $('#nav-main').width() gets the inner content box (automatically excluding the 8px side paddings).
        // We subtract a tiny 2px safety buffer to prevent fractional pixel wrapping.
        var containerWidth = $('#nav-main').width() - 2;
        var availablespace = containerWidth - morewidth;

        $('#nav-main').removeClass('measuring');

        if (navwidth > availablespace) {
            var lastItem = $('#nav-main > li:not(.more)').last();
            if (lastItem.length > 0) {
                // Store the width (including gap) so it restores accurately when expanding
                lastItem.attr('data-width', lastItem.outerWidth(true) + 4);
                lastItem.prependTo($('#nav-main .more ul'));
                calcWidth(); // Recursively trigger to ensure everything fits
            }
        } else {
            var firstMoreElement = $('#nav-main li.more li').first();
            if (firstMoreElement.length > 0) {
                // If popping this tab out empties the dropdown, the burger menu completely hides!
                // This means we instantly gain `morewidth` back to use for tabs.
                var isLastInDropdown = ($('#nav-main li.more li').length === 1);
                var spaceNeeded = navwidth + firstMoreElement.data('width');
                var spaceAvailable = isLastInDropdown ? containerWidth : availablespace;

                if (spaceNeeded <= spaceAvailable) {
                    firstMoreElement.insertBefore($('#nav-main .more'));
                    calcWidth(); // Recursively trigger to restore as many as possible
                }
            }
        }

        // Toggle the visual display of the burger menu
        if ($('.more li').length > 0) {
            $('.more').css('display','inline-block');
        } else {
            $('.more').css('display','none');
        }
    }

    $(window).on('resize load', function() {
        calcWidth();
    });

    // ── Mobile nav ──
    // Build nav links from the desktop nav
    var links = [];
    $('#nav-main > li:not(.more)').each(function() {
        var $a = $(this).find('> a');
        var iconClass = $a.find('i').attr('class') || '';
        var text = $a.clone().children('i').remove().end().text().trim();
        links.push({ href: $a.attr('href'), text: text, iconClass: iconClass });
    });

    // Determine current page label
    var path = window.location.pathname.replace(/\/$/, '');
    var segments = path.split('/');
    var lastSegment = segments[segments.length - 1]
        .replace(/\.html$/i, '')  // strip .html extension
        .replace(/\.htm$/i, '');  // strip .htm extension
    var pageLabel = (!lastSegment || lastSegment.toLowerCase() === 'index')
        ? 'Home'
        : lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);

    // Find the icon for the current page
    var currentIconClass = '';
    links.forEach(function(l) {
        if (l.text.toLowerCase() === pageLabel.toLowerCase()) {
            currentIconClass = l.iconClass;
        }
    });
    var currentIcon = currentIconClass ? '<i class="' + currentIconClass + '"></i> ' : '';

    // Build the mobile nav HTML
    var listItems = links.map(function(l) {
        var isActive = (l.text.toLowerCase() === pageLabel.toLowerCase()) ? ' class="active"' : '';
        var icon = l.iconClass ? '<i class="' + l.iconClass + '"></i> ' : '';
        return '<a href="' + l.href + '"' + isActive + '>' + icon + l.text + '</a>';
    }).join('');

    var mobileNav = $('<div id="mobile-nav">' +
        '<div id="mobile-nav-list">' + listItems + '</div>' +
        '<div id="mobile-nav-trigger">' +
        '<span>' + currentIcon + pageLabel + '</span>' +
        '<i class="nav-arrow">&#9660;</i>' +
        '</div>' +
        '</div>');

    $('body').append(mobileNav);

    // Toggle open/close
    $('#mobile-nav-trigger').on('click', function() {
        $('#mobile-nav').toggleClass('open');
    });

    // Close when a link is tapped
    $('#mobile-nav-list a').on('click', function() {
        $('#mobile-nav').removeClass('open');
    });

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

            // --- NEW: Sync Document Title ---
            if (virtualDoc.title) {
                document.title = virtualDoc.title;
            }

            // --- NEW: Sync Stylesheets ---
            Array.from(virtualDoc.querySelectorAll('head link[rel="stylesheet"]')).forEach(newLink => {
                const href = newLink.getAttribute('href');
                // If the current document doesn't already have this stylesheet, add it
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