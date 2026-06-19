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
window._navReady = fetch(_siteOrigin + '/assets/data/nav.json').then(function(r) { return r.json(); });

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
            : currentPath === item.href;

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
