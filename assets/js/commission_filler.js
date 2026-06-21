(function () {
    const JSON_URL = '../assets/hire/commissions.json';

    // ── Carousel ──────────────────────────────────────────────────────────────

    function smoothScroll(el, dist, dur) {
        var start = el.scrollLeft, startTime = null;
        function ease(t) { return 1 - Math.pow(1 - t, 3); }
        function step(now) {
            if (!startTime) startTime = now;
            var p = Math.min((now - startTime) / dur, 1);
            el.scrollLeft = start + dist * ease(p);
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function buildCarousel(examples) {
        var wrap = document.createElement('div');
        wrap.className = 'comm-carousel-wrap';

        var track = document.createElement('div');
        track.className = 'comm-carousel-track';

        examples.forEach(function (ex) {
            var card = document.createElement('div');
            card.className = 'comm-carousel-card';

            var inner = '';
            if (ex.image) {
                inner += '<img class="comm-card-img" src="' + ex.image + '" alt="' + ex.title + '">';
            } else {
                inner += '<div class="comm-card-img comm-card-img-placeholder"><i class="fa fa-image"></i></div>';
            }
            inner += '<div class="comm-card-body">';
            if (ex.link) {
                inner += '<a class="comm-card-title" href="' + ex.link + '" target="_blank" rel="noopener">' + ex.title + ' <i class="fa fa-external-link" style="font-size:0.7em;opacity:0.6"></i></a>';
            } else {
                inner += '<span class="comm-card-title">' + ex.title + '</span>';
            }
            if (ex.description) {
                inner += '<p class="comm-card-desc">' + ex.description + '</p>';
            }
            inner += '</div>';
            card.innerHTML = inner;
            track.appendChild(card);
        });

        var prevBtn = document.createElement('button');
        prevBtn.className = 'comm-carousel-arrow left';
        prevBtn.type = 'button';
        prevBtn.setAttribute('aria-label', 'Previous');
        prevBtn.innerHTML = '<i class="fa fa-chevron-left"></i>';

        var nextBtn = document.createElement('button');
        nextBtn.className = 'comm-carousel-arrow right';
        nextBtn.type = 'button';
        nextBtn.setAttribute('aria-label', 'Next');
        nextBtn.innerHTML = '<i class="fa fa-chevron-right"></i>';

        function updateArrows() {
            var atStart = track.scrollLeft <= 4;
            var atEnd   = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
            prevBtn.style.opacity       = atStart ? '0' : '1';
            prevBtn.style.pointerEvents = atStart ? 'none' : '';
            nextBtn.style.opacity       = atEnd   ? '0' : '1';
            nextBtn.style.pointerEvents = atEnd   ? 'none' : '';
        }

        prevBtn.addEventListener('click', function () { smoothScroll(track, -track.clientWidth * 0.75, 400); });
        nextBtn.addEventListener('click', function () { smoothScroll(track,  track.clientWidth * 0.75, 400); });
        track.addEventListener('scroll', updateArrows);

        wrap.appendChild(prevBtn);
        wrap.appendChild(track);
        wrap.appendChild(nextBtn);

        requestAnimationFrame(updateArrows);
        return wrap;
    }

    // ── Accordion ─────────────────────────────────────────────────────────────

    function buildAccordion(type) {
        var acc = document.createElement('div');
        acc.className = 'comm-accordion';
        acc.dataset.type = type.key;

        acc.innerHTML =
            '<div class="comm-acc-header">' +
                '<button class="comm-acc-toggle" type="button">' +
                    '<span class="stat-acc-icon-wrap"><i class="fa ' + type.icon + '"></i></span>' +
                    '<span class="stat-acc-label">' + type.label + '</span>' +
                '</button>' +
                '<button class="btn-theme comm-modal-btn" type="button" data-modal-type="' + type.modalType + '">' + type.btnLabel + '</button>' +
                '<button class="comm-acc-caret-btn" type="button" aria-label="Toggle"><i class="fa fa-chevron-down stat-acc-caret"></i></button>' +
            '</div>' +
            '<div class="comm-acc-body">' +
                '<div class="comm-acc-inner"></div>' +
            '</div>';

        var inner = acc.querySelector('.comm-acc-inner');

        if (type.description) {
            var desc = document.createElement('p');
            desc.className = 'comm-acc-desc';
            desc.textContent = type.description;
            inner.appendChild(desc);
        }

        if (type.examples && type.examples.length) {
            var exLabel = document.createElement('h4');
            exLabel.className = 'comm-examples-label';
            exLabel.textContent = 'Examples';
            inner.appendChild(exLabel);
            inner.appendChild(buildCarousel(type.examples));
        }

        var bodyBtn = document.createElement('button');
        bodyBtn.className = 'btn-theme comm-modal-btn comm-body-modal-btn';
        bodyBtn.type = 'button';
        bodyBtn.dataset.modalType = type.modalType;
        bodyBtn.textContent = type.btnLabel;
        inner.appendChild(bodyBtn);

        return acc;
    }

    function openAccordion(key) {
        document.querySelectorAll('.comm-accordion.is-open').forEach(function (a) {
            if (a.dataset.type !== key) a.classList.remove('is-open');
        });
        var acc = document.querySelector('.comm-accordion[data-type="' + key + '"]');
        if (acc) acc.classList.add('is-open');
    }

    function closeAccordion(key) {
        var acc = document.querySelector('.comm-accordion[data-type="' + key + '"]');
        if (acc) acc.classList.remove('is-open');
    }

    function wireAccordion(type) {
        var k   = type.key;
        var acc = document.querySelector('.comm-accordion[data-type="' + k + '"]');
        if (!acc) return;

        acc.querySelectorAll('.comm-modal-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var overlay = document.getElementById('commission-modal-overlay');
                if (overlay) overlay.classList.add('active');
                var sel = document.getElementById('commission-type');
                if (sel) {
                    sel.value = btn.dataset.modalType;
                    sel.dispatchEvent(new Event('change'));
                }
            });
        });

        function toggle() {
            if (acc.classList.contains('is-open')) {
                closeAccordion(k);
            } else {
                openAccordion(k);
            }
        }
        acc.querySelector('.comm-acc-toggle').addEventListener('click', toggle);
        acc.querySelector('.comm-acc-caret-btn').addEventListener('click', toggle);
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    function init() {
        var container = document.getElementById('commission-container');
        if (!container) return;

        fetch(JSON_URL)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                (data.types || []).forEach(function (type) {
                    container.appendChild(buildAccordion(type));
                    wireAccordion(type);
                });
            })
            .catch(function (err) {
                console.error('Failed to load commissions.json', err);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
