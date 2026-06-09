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
        var $nav = $('#nav-main');
        var $more = $nav.find('.more');

        // 1. Temporarily disable flex-grow so we can measure the *true* minimum widths
        $nav.addClass('measuring');

        // Reserve space for the "More" button (using its inline data-width fallback if hidden)
        var morewidth = $more.outerWidth(true) || $more.data('width') || 80;
        // REPLACE IT WITH THESE 3 LINES:
        var headerWidth = $('.header').innerWidth();
        var titleWidth = $('.page-title').outerWidth(true);
        var availablespace = headerWidth - titleWidth - morewidth - 30; // 30px safety buffer prevents overlap
        var navwidth = 0;
        $nav.children('li:not(.more)').each(function() {
            navwidth += $(this).outerWidth(true);
        });

        // 2. Move overflowing items to the dropdown
        while (navwidth > availablespace && $nav.children('li:not(.more)').length > 0) {
            var lastItem = $nav.children('li:not(.more)').last();
            lastItem.attr('data-width', lastItem.outerWidth(true)); // Store intrinsic width
            lastItem.prependTo($more.find('ul'));

            // Recalculate navwidth by subtracting the removed item
            navwidth -= lastItem.data('width');
        }

        // 3. Bring items back if there is enough available space
        while ($more.find('li').length > 0) {
            var firstMoreElement = $more.find('li').first();
            if (navwidth + firstMoreElement.data('width') < availablespace) {
                firstMoreElement.insertBefore($more);
                navwidth += firstMoreElement.data('width');
            } else {
                break; // Stop loop if the next item doesn't fit
            }
        }

        // 4. Toggle the "More" button visibility
        if ($('.more li').length > 0) {
            $('.more').css('display', 'block'); // Block aligns better with flex items
        } else {
            $('.more').css('display', 'none');
        }

        // 5. Re-enable flex-grow so the visible items dynamically stretch to fill all empty space
        $nav.removeClass('measuring');
    }

    $(window).on('resize load',function(){
        calcWidth();
    });
});
