(function () {
    function smoothScroll(element, distance, duration) {
        const start = element.scrollLeft;
        let startTime = null;
        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const progress = Math.min(timeElapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            element.scrollLeft = start + (distance * ease);
            if (timeElapsed < duration) requestAnimationFrame(animation);
        }
        requestAnimationFrame(animation);
    }

    function updateCarouselArrows(track, leftBtn, rightBtn) {
        if (!track || !leftBtn || !rightBtn) return;
        const canScrollLeft  = track.scrollLeft > 2;
        const canScrollRight = track.scrollLeft < (track.scrollWidth - track.clientWidth - 2);
        leftBtn.classList.toggle('visible', canScrollLeft);
        rightBtn.classList.toggle('visible', canScrollRight);
    }

    window._smoothScroll         = smoothScroll;
    window._updateCarouselArrows = updateCarouselArrows;
})();
