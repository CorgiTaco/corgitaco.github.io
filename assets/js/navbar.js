// Detect the site's base path from this script's own URL.
// On GitHub Pages:  https://corgitaco.dev/assets/js/navbar.js  → basePath = ''
// On IntelliJ dev:  http://localhost:63342/corgitaco.github.io/assets/js/navbar.js → basePath = '/corgitaco.github.io'
const _scriptSrc = (document.currentScript || {}).src || '';
const _siteOrigin = _scriptSrc.replace(/\/assets\/js\/navbar\.js(\?.*)?$/, '');
const _basePath = (() => {
    try { return new URL(_siteOrigin).pathname.replace(/\/$/, ''); }
    catch (e) { return ''; }
})();

window._navBasePath = _basePath;
window._navReady   = fetch(_siteOrigin + '/assets/data/nav.json').then(function(r) { return r.json(); });
window._alertReady = fetch(_siteOrigin + '/assets/data/alert.json', { cache: 'no-store' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(config) {
        if (!config || !config.source) return null;
        return fetch(config.source, { cache: 'no-store' })
            .then(function(r) { return r.ok ? r.json() : null; })
            .catch(function() { return null; });
    })
    .catch(function() { return null; });

window._applyAlert = function(alertData) {
    var existing = document.getElementById('alert-banner');
    if (existing) existing.remove();

    if (!alertData || !alertData.active) return;

    var banner = document.createElement('div');
    banner.id = 'alert-banner';
    banner.setAttribute('role', 'alert');

    var wrap = document.createElement('div');
    wrap.className = 'alert-ticker-wrap';

    var ticker = document.createElement('span');
    ticker.className = 'alert-ticker-text';
    ticker.textContent = alertData.text || '';
    wrap.appendChild(ticker);
    banner.appendChild(wrap);

    if (alertData.url) {
        banner.addEventListener('click', function() {
            window.open(alertData.url, '_blank', 'noopener,noreferrer');
        });
    }

    var pageTitleBar = document.getElementById('page-title-bar');
    if (pageTitleBar) {
        pageTitleBar.parentNode.insertBefore(banner, pageTitleBar);
    } else {
        var stickyHeader = document.getElementById('sticky-header');
        if (stickyHeader) stickyHeader.appendChild(banner);
    }

    // After paint: only scroll if the text doesn't fit.
    requestAnimationFrame(function() {
        var wrapWidth = wrap.offsetWidth || window.innerWidth;
        var textWidth = ticker.scrollWidth || 0;
        if (textWidth > wrapWidth) {
            wrap.classList.add('is-scrolling');
            ticker.classList.add('is-scrolling');
            banner.style.setProperty('--ticker-start', wrapWidth + 'px');
            ticker.style.animationDuration = ((wrapWidth + textWidth + 24) / 120).toFixed(1) + 's';
        }
    });
};

window._buildNav = function(items) {
    var ul = document.getElementById('nav-main');
    if (!ul) return;

    // Strip the base path prefix to get the site-relative path for active detection
    var rawPath = window.location.pathname.replace(/\/$/, '');
    var currentPath = rawPath.startsWith(_basePath)
        ? rawPath.slice(_basePath.length)
        : rawPath;
    if (!currentPath) currentPath = '/';

    var moreItem = ul.querySelector('li.more');
    ul.querySelectorAll('li:not(.more)').forEach(function(li) { li.remove(); });

    items.forEach(function(item) {
        var isActive = item.href === '/'
            ? (currentPath === '' || currentPath === '/')
            : currentPath === item.href || currentPath.startsWith(item.href + '/');

        var li = document.createElement('li');
        if (isActive) li.id = 'nav-tab-active';

        var a = document.createElement('a');
        a.className = 'nav-link';
        a.href = _basePath + item.href;
        if (item.linkId) a.id = item.linkId;
        a.innerHTML = '<i class="fa ' + item.icon + '"></i>' + item.label;

        li.appendChild(a);

        if (moreItem) {
            ul.insertBefore(li, moreItem);
        } else {
            ul.appendChild(li);
        }
    });
};
