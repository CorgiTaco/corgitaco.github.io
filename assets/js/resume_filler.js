(function () {

    // ── Modal helpers ─────────────────────────────────────────────────────────

    function openModal(item, sectionLabel) {
        const overlay = document.getElementById('timeline-modal-overlay');
        const body    = document.getElementById('tm-body');
        const winTitle = document.getElementById('tm-win-title');

        const institution = item.employer || item.school || '';
        const skills = item.skills || [];

        winTitle.textContent = (institution || item.title) + ' — zsh';

        body.innerHTML = `
            <span class="tm-tag">${sectionLabel}</span>
            <h2 class="tm-title">${item.title}</h2>
            ${institution ? `<p class="tm-institution">${institution}</p>` : ''}
            ${item.date    ? `<p class="tm-date">${item.date}</p>` : ''}
            <hr class="tm-divider">
            <p class="tm-desc">${item.longDescription || item.description}</p>
            ${skills.length ? `
                <hr class="tm-divider">
                <div class="tm-skills">
                    ${skills.map(s => `<span class="tm-skill-tag">${s}</span>`).join('')}
                </div>` : ''}
        `;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        const overlay = document.getElementById('timeline-modal-overlay');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function bindModalClose() {
        const overlay = document.getElementById('timeline-modal-overlay');
        const closeX  = document.getElementById('tm-close-x');
        const closeBtn = document.getElementById('tm-close-btn');

        if (closeX)  closeX.addEventListener('click', closeModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // ── Timeline builder ──────────────────────────────────────────────────────

    function populateTimeline(containerId, items, sectionLabel) {
        const container = document.getElementById(containerId);
        if (!container || !items) return;

        const sortedItems = [...items].sort((a, b) => {
            const aPresent = a.date && a.date.toLowerCase().includes('present');
            const bPresent = b.date && b.date.toLowerCase().includes('present');
            if (aPresent && !bPresent) return -1;
            if (!aPresent && bPresent) return 1;
            return 0;
        });

        const html = sortedItems.map(item => {
            const institution = item.employer || item.school || '';
            const institutionHtml = institution ? `<span class="timeline-institution">${institution}</span>` : '';
            const isPresent = item.date && item.date.toLowerCase().includes('present');
            const dotClass = isPresent ? 'timeline-dot glow' : 'timeline-dot';
            const dateHtml = item.date ? `<span class="timeline-date">${item.date}</span>` : '';

            return `
                <div class="timeline-item" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}' data-section="${sectionLabel}" role="button" tabindex="0" aria-label="Open details for ${item.title}">
                    <div class="${dotClass}"></div>
                    <h3 class="timeline-title">${item.title}</h3>
                    ${institutionHtml}
                    ${dateHtml}
                    <p class="timeline-desc">${item.description}</p>
                </div>
            `;
        }).join('');

        container.innerHTML = html;

        // Bind click events
        container.querySelectorAll('.timeline-item').forEach(el => {
            const activate = () => {
                const item = JSON.parse(el.getAttribute('data-item').replace(/&#39;/g, "'"));
                const section = el.getAttribute('data-section');
                openModal(item, section);
            };
            el.addEventListener('click', activate);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
        });
    }

    // ── Testimonials carousel ─────────────────────────────────────────────────

    function buildTestimonials(testimonials) {
        const track = document.getElementById('testimonials-track');
        const wrap = track && track.closest('.testimonials-track-wrap');
        if (!track || !testimonials || !testimonials.length) return;

        // Inject overlay gradient arrows (fa-chevron icons matching projects carousel)
        const prevBtn = document.createElement('button');
        prevBtn.className = 'testimonials-carousel-arrow left';
        prevBtn.setAttribute('aria-label', 'Previous');
        prevBtn.innerHTML = '<i class="fa fa-chevron-left"></i>';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'testimonials-carousel-arrow right';
        nextBtn.setAttribute('aria-label', 'Next');
        nextBtn.innerHTML = '<i class="fa fa-chevron-right"></i>';

        wrap.appendChild(prevBtn);
        wrap.appendChild(nextBtn);

        // Identical smoothScroll to project_filler.js — cubic ease-out, 450ms
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

        // Identical threshold logic to project_filler.js
        function updateArrows() {
            const canScrollLeft  = track.scrollLeft > 2;
            const canScrollRight = track.scrollLeft < (track.scrollWidth - track.clientWidth - 2);
            prevBtn.classList.toggle('visible', canScrollLeft);
            nextBtn.classList.toggle('visible', canScrollRight);
        }

        prevBtn.addEventListener('click', () => smoothScroll(track, -track.clientWidth * 0.75, 450));
        nextBtn.addEventListener('click', () => smoothScroll(track,  track.clientWidth * 0.75, 450));

        track.addEventListener('scroll', updateArrows);
        window.addEventListener('resize', updateArrows);

        function avatarHTML(t, size) {
            const cls = size === 'lg' ? 'tm-testimonial-avatar' : 'testimonial-avatar';
            return t.avatar
                ? `<div class="${cls}"><img src="${t.avatar}" alt="${t.name}" loading="lazy"></div>`
                : `<div class="${cls}"><i class="fa fa-user"></i></div>`;
        }

        track.innerHTML = testimonials.map((t, i) => {
            const hasUrl = t.url && t.url.trim();
            const linkIcon = hasUrl ? '<span class="link-icon"><i class="fa fa-external-link"></i></span>' : '';
            const nameLink = hasUrl
                ? `<a class="testimonial-name-link" href="${t.url}" target="_blank" rel="noopener noreferrer" title="View ${t.name}'s profile" onclick="event.stopPropagation()">
                       ${avatarHTML(t, 'sm')}
                       <p class="testimonial-name">${t.name}${linkIcon}</p>
                   </a>`
                : `${avatarHTML(t, 'sm')}
                   <p class="testimonial-name">${t.name}</p>`;
            const authorHTML = `<div class="testimonial-author">
                ${nameLink}
                <div class="testimonial-author-meta">
                    <p class="testimonial-role">${t.role}${t.company ? ' · ' + t.company : ''}</p>
                    ${t.date ? `<p class="testimonial-date">${t.date}</p>` : ''}
                </div>
            </div>`;
            return `
            <div class="testimonial-card" role="button" tabindex="0" aria-label="Read full testimonial from ${t.name}" data-index="${i}">
                <div class="testimonial-quote-mark">"</div>
                <p class="testimonial-text">${t.quote}</p>
                ${authorHTML}
            </div>`;
        }).join('');

        track.querySelectorAll('.testimonial-card').forEach(card => {
            const activate = () => {
                const idx = parseInt(card.getAttribute('data-index'), 10);
                openTestimonialModal(testimonials[idx]);
            };
            card.addEventListener('click', activate);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
        });

        // Identical initial state check to project_filler.js
        setTimeout(updateArrows, 100);
    }

    // ── Testimonial modal ─────────────────────────────────────────────────────

    function openTestimonialModal(t) {
        const overlay  = document.getElementById('timeline-modal-overlay');
        const body     = document.getElementById('tm-body');
        const winTitle = document.getElementById('tm-win-title');

        winTitle.textContent = t.name + ' — zsh';

        const modalAvatarHTML = t.avatar
            ? `<div class="tm-testimonial-avatar"><img src="${t.avatar}" alt="${t.name}" loading="lazy"></div>`
            : `<div class="tm-testimonial-avatar"><i class="fa fa-user"></i></div>`;
        const hasUrl = t.url && t.url.trim();
        const linkIcon = hasUrl ? '<span class="link-icon"><i class="fa fa-external-link"></i></span>' : '';
        const nameLink = hasUrl
            ? `<a class="tm-testimonial-name-link" href="${t.url}" target="_blank" rel="noopener noreferrer" title="View ${t.name}'s profile">
                   ${modalAvatarHTML}
                   <p class="tm-title" style="font-size:1.1rem;">${t.name}${linkIcon}</p>
               </a>`
            : `${modalAvatarHTML}
               <p class="tm-title" style="font-size:1.1rem;">${t.name}</p>`;
        const authorRowHTML = `<div class="tm-testimonial-author-row">
            ${nameLink}
            <div>
                <p class="tm-institution">${t.role}${t.company ? ' · ' + t.company : ''}</p>
                ${t.date ? `<p class="tm-date">${t.date}</p>` : ''}
            </div>
        </div>`;

        body.innerHTML = `
            <span class="tm-tag">Testimonial</span>
            <div class="tm-testimonial-quote-wrap">
                <span class="tm-big-quote">"</span>
                <p class="tm-desc" style="font-style:italic;">${t.quote}</p>
            </div>
            <hr class="tm-divider">
            ${authorRowHTML}
        `;

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // ── PDF viewer modal ──────────────────────────────────────────────────────

    function bindPdfModal() {
        const PDF_SRC = '../assets/hire/resume.pdf';
        const overlay = document.getElementById('pdf-modal-overlay');
        const iframe  = document.getElementById('pdf-iframe');
        const openBtn = document.getElementById('open-pdf-btn');
        const closeX  = document.getElementById('pdf-close-x');

        if (!overlay || !openBtn) return;

        function openPdf() {
            iframe.src = PDF_SRC;
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closePdf() {
            overlay.classList.remove('active');
            iframe.src = '';
            document.body.style.overflow = '';
        }

        openBtn.addEventListener('click', openPdf);
        closeX.addEventListener('click', closePdf);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePdf(); });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) closePdf();
        });
    }

    // ── Contact card ─────────────────────────────────────────────────────────

    function buildContactCard(info) {
        const el = document.getElementById('resume-contact-card');
        if (!el || !info) return;

        const rows = [];
        if (info.jobTitle) {
            rows.push(`<p class="contact-job-title">${escapeHTML(info.jobTitle)}</p>`);
            rows.push('<hr class="contact-divider">');
        }
        if (info.email) {
            rows.push(`<div class="contact-row"><i class="fa fa-envelope"></i><a href="mailto:${escapeAttr(info.email)}">${escapeHTML(info.email)}</a></div>`);
        }
        if (info.phone) {
            rows.push(`<div class="contact-row"><i class="fa fa-phone"></i><a href="tel:${escapeAttr(info.phone)}">${escapeHTML(info.phone)}</a></div>`);
        }
        if (info.location) {
            rows.push(`<div class="contact-row"><i class="fa fa-map-marker"></i><span>${escapeHTML(info.location)}</span></div>`);
        }

        el.innerHTML = `
            <div class="contact-scroll">
                <div class="contact-header resume-header">
                    <i class="fa fa-address-card"></i> Contact
                </div>
                ${rows.join('')}
            </div>`;
    }

    // ── Highlights card ───────────────────────────────────────────────────────

    function buildHighlightsCard(highlights) {
        const el = document.getElementById('resume-highlights-card');
        if (!el || !highlights || !highlights.length) return;

        const items = highlights.map(h => `<li>${escapeHTML(h)}</li>`).join('');

        el.innerHTML = `
            <div class="highlights-scroll">
                <div class="highlights-header resume-header">
                    <i class="fa fa-star"></i> Highlights
                </div>
                <ul class="highlights-list">${items}</ul>
            </div>`;
    }

    // ── Escape helpers ────────────────────────────────────────────────────────

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/"/g, '&quot;');
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────

    function bootstrap() {
        bindModalClose();
        bindPdfModal();

        fetch('../assets/hire/resume.json')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                buildContactCard(data.contact);
                buildHighlightsCard(data.highlights);
                populateTimeline('experience-timeline', data.experience, 'Experience');
                populateTimeline('education-timeline', data.education, 'Education');
                buildTestimonials(data.testimonials);
            })
            .catch(error => {
                console.error('Error loading the resume JSON file:', error);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();