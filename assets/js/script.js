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
        var morewidth = $('#nav-main .more').outerWidth(true);
        $('#nav-main > li:not(.more)').each(function() {
            navwidth += $(this).outerWidth(true);
        });
        var availablespace = $('nav').outerWidth(true) - morewidth;

        $('#nav-main').removeClass('measuring');

        if (navwidth > availablespace) {
            var lastItem = $('#nav-main > li:not(.more)').last();
            lastItem.attr('data-width', lastItem.outerWidth(true));
            lastItem.prependTo($('#nav-main .more ul'));
            calcWidth();
        } else {
            var firstMoreElement = $('#nav-main li.more li').first();
            if (navwidth + firstMoreElement.data('width') < availablespace) {
                firstMoreElement.insertBefore($('#nav-main .more'));
            }
        }

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
        links.push({ href: $a.attr('href'), text: $a.text().trim() });
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

    // Build the mobile nav HTML
    var listItems = links.map(function(l) {
        var isActive = (l.text.toLowerCase() === pageLabel.toLowerCase()) ? ' class="active"' : '';
        return '<a href="' + l.href + '"' + isActive + '>' + l.text + '</a>';
    }).join('');

    var mobileNav = $('<div id="mobile-nav">' +
        '<div id="mobile-nav-list">' + listItems + '</div>' +
        '<div id="mobile-nav-trigger">' +
        '<span>' + pageLabel + '</span>' +
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
});