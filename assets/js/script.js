// ── Scroll-reveal + section spinner (runs synchronously so fillers can use it) ──
;(function () {
    var SPIN = '<div class="section-spinner"><div class="spinner"></div></div>';
    window._sectionSpinner = function (el) {
        var node = typeof el === 'string' ? document.getElementById(el) : el;
        if (node) node.innerHTML = SPIN;
    };

    if (!window.IntersectionObserver) return;

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -24px 0px' });

    window._revealEl = function (el, delayMs) {
        if (!el) return;
        if (delayMs) el.style.setProperty('--reveal-delay', delayMs + 'ms');
        el.classList.add('reveal');
        io.observe(el);
    };

    window._revealAll = function (list) {
        for (var i = 0, len = list.length; i < len; i++) {
            window._revealEl(list[i], Math.min(i * 55, 220));
        }
    };
}());

// Wait for the DOM to load before targeting the element
document.addEventListener("DOMContentLoaded", async () => {
    window.vantaEffect = VANTA.WAVES({
        el: '#vanta-bg',
        mouseControls: true,
        touchControls: true,
        gyroControls: true,
        minHeight: 200,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x08200c,
        shininess: 22.00,
        waveHeight: 23.50,
        waveSpeed: 0.65,
        zoom: 0.75
    });

    function calcWidth() {
        function measure() {
            $('#nav-main').addClass('measuring');
            var navwidth = 0;
            $('#nav-main > li:not(.more)').each(function() {
                navwidth += $(this).outerWidth(true) + 4;
            });
            var more          = $('#nav-main .more');
            var morewidth     = more.is(':visible') ? more.outerWidth(true) : (more.data('width') || 80);
            var containerWidth  = $('#nav-main').width() - 2;
            var availablespace  = containerWidth - morewidth;
            $('#nav-main').removeClass('measuring');
            return { navwidth: navwidth, containerWidth: containerWidth, availablespace: availablespace };
        }

        // Collapse items into "more" until everything fits
        var m;
        while ((m = measure()).navwidth > m.availablespace) {
            var lastItem = $('#nav-main > li:not(.more)').last();
            if (!lastItem.length) break;
            lastItem.attr('data-width', lastItem.outerWidth(true) + 4);
            lastItem.prependTo($('#nav-main .more ul'));
        }

        // Restore items from "more" as long as there is space
        while (true) {
            m = measure();
            var firstMoreElement = $('#nav-main li.more li').first();
            if (!firstMoreElement.length) break;
            var isLastInDropdown = ($('#nav-main li.more li').length === 1);
            var spaceNeeded      = m.navwidth + (firstMoreElement.data('width') || 0);
            var spaceAvailable   = isLastInDropdown ? m.containerWidth : m.availablespace;
            if (spaceNeeded > spaceAvailable) break;
            firstMoreElement.insertBefore($('#nav-main .more'));
        }

        if ($('.more li').length > 0) {
            $('.more').css('display', 'inline-block');
        } else {
            $('.more').css('display', 'none');
        }
    }

    // Expose calcWidth so pagechange.js can call it after SPA navigation rebuilds the nav.
    window._calcWidth = calcWidth;
    $(window).on('resize load', calcWidth);

    // Wait for nav data, then build the desktop nav and mobile nav together so
    // calcWidth always measures a fully-populated list.
    const navItems = await window._navReady;
    window._buildNav(navItems);
    calcWidth();

    const alertData = await window._alertReady;
    window._applyAlert(alertData);

    var basePath = window._navBasePath || '';
    var rawPath = window.location.pathname.replace(/\/$/, '');
    var currentPath = rawPath.startsWith(basePath) ? rawPath.slice(basePath.length) : rawPath;
    if (!currentPath) currentPath = '/';

    var activeItem = navItems.find(function(item) {
        return item.href === '/'
            ? (currentPath === '' || currentPath === '/')
            : currentPath === item.href;
    });
    var pageLabel = activeItem ? activeItem.label : 'Home';
    var currentIconClass = activeItem ? 'fa ' + activeItem.icon : '';
    var currentIcon = currentIconClass ? '<i class="' + currentIconClass + '"></i> ' : '';

    var listItems = navItems.map(function(item) {
        var iconClass = 'fa ' + item.icon;
        var isActive = item.href === '/'
            ? (currentPath === '' || currentPath === '/')
            : currentPath === item.href;
        var activeAttr = isActive ? ' class="active"' : '';
        return '<a href="' + (basePath + item.href) + '"' + activeAttr + '>'
            + '<i class="' + iconClass + '"></i> ' + item.label + '</a>';
    }).join('');

    var mobileNav = $('<div id="mobile-nav">'
        + '<div id="mobile-nav-list">' + listItems + '</div>'
        + '<div id="mobile-nav-trigger">'
        + '<span>' + currentIcon + pageLabel + '</span>'
        + '<i class="nav-arrow">&#9660;</i>'
        + '</div>'
        + '</div>');

    $('body').append(mobileNav);

    $('#mobile-nav-trigger').on('click', function() {
        $('#mobile-nav').toggleClass('open');
    });

    $('#mobile-nav-list a').on('click', function() {
        $('#mobile-nav').removeClass('open');
    });

    // NOTE: click and popstate listeners live exclusively in pagechange.js.
    // Registering them here too would cause every navigation to fire handleRoute twice.
});
