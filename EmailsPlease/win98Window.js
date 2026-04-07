// Win98-style window: drag title bar to move, drag edges/corners to resize.

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.win98-dialog').forEach(initWin98Dialog);
});

function initWin98Dialog(dialog) {
    // Replace the CSS centering transform with explicit pixel coords so JS can move it.
    var rect = dialog.getBoundingClientRect();
    dialog.style.transform = 'none';
    dialog.style.margin   = '0';
    dialog.style.left     = rect.left + 'px';
    dialog.style.top      = rect.top  + 'px';
    dialog.style.width    = rect.width  + 'px';
    dialog.style.height   = rect.height + 'px';

    // ── Title-bar drag ──────────────────────────────────────────────────────
    var titlebar = dialog.querySelector('.dialog-titlebar');
    if (titlebar) {
        titlebar.addEventListener('mousedown', function (e) {
            if (e.target.classList.contains('win-ctrl')) return;
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

    // ── Resize handles (8 directions) ──────────────────────────────────────
    ['n','ne','e','se','s','sw','w','nw'].forEach(function (dir) {
        var h = document.createElement('div');
        h.className = 'resize-handle rh-' + dir;
        dialog.appendChild(h);
        h.addEventListener('mousedown', function (e) {
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
        var dx = e.clientX - sx;
        var dy = e.clientY - sy;
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
