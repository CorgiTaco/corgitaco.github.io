(function () {
    function showcaseVideoId(url) {
        const m = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
        return m ? m[1] : null;
    }

    function renderShowcaseSection(elId, videos) {
        const el = document.getElementById(elId);
        if (!el) return;
        const ids = (videos || []).map(showcaseVideoId).filter(Boolean);
        if (!ids.length) { el.style.display = 'none'; return; }

        const cardsHtml = ids.map(id => `
                <div class="showcase-video">
                    <iframe
                        src="https://www.youtube.com/embed/${id}"
                        title="YouTube video player"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerpolicy="strict-origin-when-cross-origin"
                        allowfullscreen
                        loading="lazy"></iframe>
                </div>`).join('');

        el.innerHTML = `
            <div class="showcase-header">
                <i class="fa fa-youtube-play"></i> Showcase
            </div>
            <div class="showcase-track-wrap">
                <div class="showcase-row${ids.length < 3 ? ' centered' : ''}">${cardsHtml}</div>
            </div>
        `;

        const wrap  = el.querySelector('.showcase-track-wrap');
        const track = el.querySelector('.showcase-row');

        const prevBtn = document.createElement('button');
        prevBtn.className = 'showcase-carousel-arrow left';
        prevBtn.setAttribute('aria-label', 'Previous');
        prevBtn.innerHTML = '<i class="fa fa-chevron-left"></i>';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'showcase-carousel-arrow right';
        nextBtn.setAttribute('aria-label', 'Next');
        nextBtn.innerHTML = '<i class="fa fa-chevron-right"></i>';

        wrap.appendChild(prevBtn);
        wrap.appendChild(nextBtn);

        function updateArrows() {
            if (window._updateCarouselArrows) window._updateCarouselArrows(track, prevBtn, nextBtn);
        }

        prevBtn.addEventListener('click', () => {
            if (window._smoothScroll) window._smoothScroll(track, -track.clientWidth * 0.75, 450);
        });
        nextBtn.addEventListener('click', () => {
            if (window._smoothScroll) window._smoothScroll(track, track.clientWidth * 0.75, 450);
        });

        track.addEventListener('scroll', updateArrows);
        window.addEventListener('resize', updateArrows);
        setTimeout(updateArrows, 100);

        if (window._revealAll) window._revealAll(el.querySelectorAll('.showcase-video'));
    }

    window._renderShowcaseSection = renderShowcaseSection;
})();
