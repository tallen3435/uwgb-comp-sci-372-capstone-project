// Win98-style window: drag, resize, minimize, maximize.

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.win98-dialog').forEach(initWin98Dialog);
});

function initWin98Dialog(dialog) {
    var rect = dialog.getBoundingClientRect();
    dialog.style.transform = 'none';
    dialog.style.margin    = '0';
    dialog.style.left      = rect.left   + 'px';
    dialog.style.top       = rect.top    + 'px';
    dialog.style.width     = rect.width  + 'px';
    dialog.style.height    = rect.height + 'px';

    var state = { minimized: false, maximized: false, restoreRect: null };

    // ── Title-bar drag ──────────────────────────────────────────────────────
    var titlebar = dialog.querySelector('.dialog-titlebar');
    if (titlebar) {
        titlebar.addEventListener('mousedown', function (e) {
            if (e.target.classList.contains('win-ctrl')) return;
            if (state.maximized) return;
            e.preventDefault();
            var ox = e.clientX - dialog.offsetLeft;
            var oy = e.clientY - dialog.offsetTop;
            function onMove(e) {
                dialog.style.left = (e.clientX - ox) + 'px';
                dialog.style.top  = Math.max(0, e.clientY - oy) + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // ── Minimize ────────────────────────────────────────────────────────────
    var minBtn = dialog.querySelector('[data-ctrl="min"]');
    if (minBtn) {
        minBtn.addEventListener('click', function () {
            var nonTitle = Array.from(dialog.children).filter(function (c) {
                return !c.classList.contains('dialog-titlebar');
            });
            if (!state.minimized) {
                state.minimized = true;
                state.savedHeight = dialog.style.height;
                nonTitle.forEach(function (c) { c.style.display = 'none'; });
                dialog.style.height    = (titlebar ? titlebar.offsetHeight + 4 : 28) + 'px';
                dialog.style.minHeight = '0';
                dialog.style.overflow  = 'hidden';
                dialog.querySelectorAll('.resize-handle').forEach(function (h) { h.style.display = 'none'; });
            } else {
                state.minimized = false;
                nonTitle.forEach(function (c) { c.style.display = ''; });
                dialog.style.height    = state.savedHeight;
                dialog.style.minHeight = '';
                dialog.style.overflow  = 'hidden';
                dialog.querySelectorAll('.resize-handle').forEach(function (h) { h.style.display = ''; });
            }
        });
    }

    // ── Maximize ────────────────────────────────────────────────────────────
    var maxBtn = dialog.querySelector('[data-ctrl="max"]');
    if (maxBtn) {
        maxBtn.addEventListener('click', function () {
            if (state.minimized) return;
            if (!state.maximized) {
                state.maximized  = true;
                state.restoreRect = {
                    left:   dialog.style.left,
                    top:    dialog.style.top,
                    width:  dialog.style.width,
                    height: dialog.style.height
                };
                dialog.style.left      = '0';
                dialog.style.top       = '0';
                dialog.style.width     = window.innerWidth  + 'px';
                dialog.style.height    = window.innerHeight + 'px';
                dialog.style.minHeight = '0';
                maxBtn.textContent     = '❐';
                dialog.querySelectorAll('.resize-handle').forEach(function (h) { h.style.display = 'none'; });
            } else {
                state.maximized        = false;
                dialog.style.left      = state.restoreRect.left;
                dialog.style.top       = state.restoreRect.top;
                dialog.style.width     = state.restoreRect.width;
                dialog.style.height    = state.restoreRect.height;
                dialog.style.minHeight = '';
                maxBtn.textContent     = '□';
                dialog.querySelectorAll('.resize-handle').forEach(function (h) { h.style.display = ''; });
            }
        });
    }

    // ── Resize handles (8 directions) ──────────────────────────────────────
    ['n','ne','e','se','s','sw','w','nw'].forEach(function (dir) {
        var h = document.createElement('div');
        h.className = 'resize-handle rh-' + dir;
        dialog.appendChild(h);
        h.addEventListener('mousedown', function (e) {
            if (state.maximized || state.minimized) return;
            e.preventDefault();
            e.stopPropagation();
            startResize(e, dialog, dir);
        });
    });
}

function startResize(e, dialog, dir) {
    var sx = e.clientX,  sy = e.clientY;
    var sw = dialog.offsetWidth,  sh = dialog.offsetHeight;
    var sl = dialog.offsetLeft,   st = dialog.offsetTop;
    var minW = 360, minH = 260;

    function onMove(e) {
        var dx = e.clientX - sx,  dy = e.clientY - sy;
        var w = sw, h = sh, l = sl, t = st;
        if (dir.indexOf('e') !== -1) w = Math.max(minW, sw + dx);
        if (dir.indexOf('s') !== -1) h = Math.max(minH, sh + dy);
        if (dir.indexOf('w') !== -1) { w = Math.max(minW, sw - dx); l = sl + (sw - w); }
        if (dir.indexOf('n') !== -1) { h = Math.max(minH, sh - dy); t = st + (sh - h); }
        dialog.style.width  = w + 'px';
        dialog.style.height = h + 'px';
        dialog.style.left   = l + 'px';
        dialog.style.top    = Math.max(0, t) + 'px';
    }
    function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}
