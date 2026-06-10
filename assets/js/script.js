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
        var navwidth = 0;
        var morewidth = $('#nav-main .more').outerWidth(true);
        $('#nav-main > li:not(.more)').each(function() {
            navwidth += $(this).outerWidth( true );
        });
        var availablespace = $('nav').outerWidth(true) - morewidth;

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
    $(window).on('resize load',function(){
        calcWidth();
    });
});
