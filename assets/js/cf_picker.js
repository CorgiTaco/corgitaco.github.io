(function () {
    var overlay = document.getElementById('cf-picker-overlay');
    var modal   = document.getElementById('cf-picker-modal');
    function open()  { overlay.classList.add('active'); modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
    function close() { overlay.classList.remove('active'); modal.classList.remove('active'); document.body.style.overflow = ''; }
    document.getElementById('cf-picker-btn').addEventListener('click', open);
    document.getElementById('cf-picker-close').addEventListener('click', function(e) { e.stopPropagation(); close(); });
    document.getElementById('cf-picker-back').addEventListener('click', close);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay.classList.contains('active')) close(); });
})();
