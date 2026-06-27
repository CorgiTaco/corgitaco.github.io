(function () {
    function loadYTApi(cb) {
        if (window.YT && window.YT.Player) { cb(); return; }
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () { if (prev) prev(); cb(); };
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        }
    }

    function destroyYTPlayer(player) {
        if (player) { try { player.destroy(); } catch {} }
        return null;
    }

    // Must be called inside a loadYTApi callback so window.YT is ready.
    function openYTPlayer(slot, fallbackEl, videoId) {
        return new YT.Player(slot, {
            videoId,
            width: '100%',
            height: '100%',
            playerVars: { autoplay: 1, origin: location.origin },
            events: {
                onError: function (e) {
                    if (e.data === 101 || e.data === 150) {
                        slot.style.display = 'none';
                        if (fallbackEl) fallbackEl.style.display = '';
                    }
                }
            }
        });
    }

    window._loadYTApi       = loadYTApi;
    window._destroyYTPlayer = destroyYTPlayer;
    window._openYTPlayer    = openYTPlayer;
})();
