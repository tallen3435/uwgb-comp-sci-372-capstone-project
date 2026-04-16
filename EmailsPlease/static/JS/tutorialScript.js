// ── Mock emails ───────────────────────────────────────────────────────────────
const mockEmails = [
    {
        from: 'HR Department', address: 'hr@malwareinc.com',
        subject: 'Q1 2005 Benefits Enrollment Now Open',
        body: 'Hello,\n\nThe Q1 2005 open enrollment period is now live. Please visit the HR portal at hr.malwareinc.com by March 21st to review and update your benefit selections.\n\nThank you,\nHR Department\nMalwareInc',
        date: '3/14/2005 9:00 AM', type: 'legit', unread: true
    },
    {
        from: 'PayPal Security', address: 'alert@paypa1-verify.com',
        subject: 'URGENT: Verify Your PayPal Account Now',
        body: 'Dear PayPal Member,\n\nWe have detected suspicious activity on your account. You must verify your identity within 24 hours or your account will be permanently suspended.\n\nClick here immediately: http://paypa1-verify.com/secure-login\n\nPayPal Security Team',
        date: '3/14/2005 9:15 AM', type: 'phish', unread: true
    },
    {
        from: 'Cruise Deals Ltd', address: 'winner@cruisedeals-intl.biz',
        subject: 'YOU WON A FREE 7-DAY CRUISE!!!',
        body: 'CONGRATULATIONS!!!\n\nYou have been RANDOMLY SELECTED to receive a FREE 7-day luxury cruise vacation!\n\nTo claim your prize, reply with your full name, home address, phone number, and credit card details.\n\nThis incredible offer expires TONIGHT at midnight!',
        date: '3/14/2005 9:30 AM', type: 'spam', unread: true
    }
];

// ── Tutorial state ────────────────────────────────────────────────────────────
let tutInbox          = mockEmails.map(e => ({ ...e }));
let tutSent           = [];
let tutDeleted        = [];
let tutJunk           = [];
let tutCurrentFolder  = 'inbox';
let tutSelectedIndex  = null;
let tutCurrentStep    = 0;
let tutScore          = 0;

// ── Folder accessor ───────────────────────────────────────────────────────────
function tutGetFolder() {
    switch (tutCurrentFolder) {
        case 'sent':    return tutSent;
        case 'deleted': return tutDeleted;
        case 'junk':    return tutJunk;
        default:        return tutInbox;
    }
}

// ── Step definitions ──────────────────────────────────────────────────────────
// Each step specifies:
//   title       — callout title bar text (HTML allowed)
//   text        — callout body text (HTML allowed)
//   target      — CSS selector for the spotlight element, or null for centred overlay
//   calloutY    — 'bottom' | 'top' | 'center' — vertical position of the callout box
//   nextLabel   — label for the primary Next button (HTML allowed)
//   interactive — string key describing what user action advances the step, or null
//   autoAction  — function called by "Do It For Me" / Next when step has interactive
//   beforeShow  — setup function called before rendering this step
const STEPS = [
    // ── 0: Welcome ────────────────────────────────────────────────────────────
    {
        title:       '&#128139;&nbsp; Welcome to Emails Please!',
        text:        'You are an office worker at MalwareInc in 2005. Your job: manage your inbox carefully — reply to real emails, delete spam, and report phishing attempts to keep the network safe.<br><br>This tutorial walks you through every control. Click <b>Start Tutorial</b> to begin.',
        target:      null,
        calloutY:    'center',
        nextLabel:   'Start Tutorial &#9654;',
        interactive: null,
        autoAction:  null,
        beforeShow:  null
    },
    // ── 1: Inbox overview ─────────────────────────────────────────────────────
    {
        title:       'Step 1 of 10 &mdash; Your Inbox',
        text:        'Incoming emails appear in this list. <b>Bold rows</b> are unread. You have 3 practice emails to work through.<br><br>Click any row to open the email in the reading pane on the right.',
        target:      '#email-list',
        calloutY:    'bottom',
        nextLabel:   'Next &#9654;',
        interactive: null,
        autoAction:  null,
        beforeShow:  () => {
            tutSwitchFolderSilent('inbox');
            tutClearSelection();
            setActionBtnsEnabled(false);
            showRestoreBtn(false);
        }
    },
    // ── 2: Click an email (interactive) ──────────────────────────────────────
    {
        title:       'Step 2 of 10 &mdash; Open an Email',
        text:        'Click the first email — from <b>HR Department</b> — to open it in the reading pane.<br><br><span class="tut-tip">Or click "Do It For Me" to skip this step.</span>',
        target:      '#email-list',
        calloutY:    'bottom',
        nextLabel:   'Next &#9654;',
        interactive: 'email-click',
        autoAction:  () => { tutSelectEmail(0); nextStep(); },
        beforeShow:  () => {
            tutSwitchFolderSilent('inbox');
            tutClearSelection();
            setActionBtnsEnabled(false);
            showRestoreBtn(false);
        }
    },
    // ── 3: Check the sender address ───────────────────────────────────────────
    {
        title:       'Step 3 of 10 &mdash; Check the Sender Address',
        text:        'Always inspect the <b>From</b> field carefully. Legitimate work emails use <b>@malwareinc.com</b>.<br><br>Phishing emails spoof trusted senders using lookalike domains like <b>paypa<u>1</u>-verify.com</b> — note the "1" disguised as an "l". Easy to miss at a glance!',
        target:      '#email-header',
        calloutY:    'bottom',
        nextLabel:   'Next &#9654;',
        interactive: null,
        autoAction:  null,
        beforeShow:  () => {
            tutSwitchFolderSilent('inbox');
            if (tutSelectedIndex === null) tutSelectEmail(0);
            setActionBtnsEnabled(false);
            showRestoreBtn(false);
        }
    },
    // ── 4: Reply (interactive) ────────────────────────────────────────────────
    {
        title:       'Step 4 of 10 &mdash; Replying to Legitimate Emails',
        text:        'This HR email is real — it is from <b>hr@malwareinc.com</b>. You should respond to it.<br><br>Click <b>&#8617; Reply</b> in the toolbar to send a reply and earn <b>+10 pts</b>.<br><br><span class="tut-tip">Or click "Do It For Me" to skip.</span>',
        target:      '#reply-btn',
        calloutY:    'bottom',
        nextLabel:   'Next &#9654;',
        interactive: 'reply',
        autoAction:  () => { handleTutAction('reply'); nextStep(); },
        beforeShow:  () => {
            tutSwitchFolderSilent('inbox');
            tutSelectEmail(0);
            setActionBtnsEnabled(true);
            showRestoreBtn(false);
        }
    },
    // ── 5: Report phishing (interactive) ─────────────────────────────────────
    {
        title:       'Step 5 of 10 &mdash; Reporting Phishing',
        text:        'This PayPal email looks urgent — but the address is <b>alert@paypa<u>1</u>-verify.com</b>. The "l" is actually a "1"!<br><br>Click <b>&#9888; Report Phish</b> to flag it and earn <b>+15 pts</b>.<br><br><span class="tut-tip">Or click "Do It For Me" to skip.</span>',
        target:      '#report-btn',
        calloutY:    'bottom',
        nextLabel:   'Next &#9654;',
        interactive: 'report',
        autoAction:  () => { handleTutAction('report'); nextStep(); },
        beforeShow:  () => {
            tutSwitchFolderSilent('inbox');
            tutSelectEmail(0);   // HR is gone — PayPal is now index 0
            setActionBtnsEnabled(true);
            showRestoreBtn(false);
        }
    },
    // ── 6: Delete spam (interactive) ─────────────────────────────────────────
    {
        title:       'Step 6 of 10 &mdash; Deleting Spam',
        text:        'A free cruise? Obviously spam — real prizes don\'t ask for your credit card details. This clogs your inbox and wastes your time.<br><br>Click <b>&#128465; Delete</b> to remove it and earn <b>+5 pts</b>.<br><br><span class="tut-tip">Or click "Do It For Me" to skip.</span>',
        target:      '#ignore-btn',
        calloutY:    'bottom',
        nextLabel:   'Next &#9654;',
        interactive: 'delete',
        autoAction:  () => { handleTutAction('delete'); nextStep(); },
        beforeShow:  () => {
            tutSwitchFolderSilent('inbox');
            tutSelectEmail(0);   // PayPal is gone — Cruise spam is now index 0
            setActionBtnsEnabled(true);
            showRestoreBtn(false);
        }
    },
    // ── 7: Deleted & Junk folders (interactive: click folder) ────────────────
    {
        title:       'Step 7 of 10 &mdash; Deleted &amp; Junk Folders',
        text:        'Deleted emails go to <b>Deleted Items</b>. Reported phishing and spam go to <b>Junk Mail</b>.<br><br>Click <b>&#128465; Deleted Items</b> in the folder panel to see the email you just deleted.',
        target:      '#folder-deleted',
        calloutY:    'bottom',
        nextLabel:   'Next &#9654;',
        interactive: 'folder-deleted',
        autoAction:  () => {
            tutSwitchFolderSilent('deleted');
            renderTutEmailList();
            updateFolderCounts();
            nextStep();
        },
        beforeShow:  () => {
            tutSwitchFolderSilent('inbox');
            tutClearSelection();
            setActionBtnsEnabled(false);
            showRestoreBtn(false);
        }
    },
    // ── 8: Restore ────────────────────────────────────────────────────────────
    {
        title:       'Step 8 of 10 &mdash; Restoring Emails',
        text:        'Made a mistake? Select any email in <b>Deleted Items</b> or <b>Junk Mail</b>, then click <b>&#8626; Restore to Inbox</b> to move it back.<br><br>The deleted spam email is selected below — try clicking Restore if you like, then click Next to continue.',
        target:      '#restore-btn',
        calloutY:    'bottom',
        nextLabel:   'Next &#9654;',
        interactive: null,
        autoAction:  null,
        beforeShow:  () => {
            tutSwitchFolderSilent('deleted');
            renderTutEmailList();
            updateFolderCounts();
            showRestoreBtn(true);
            setActionBtnsEnabled(false);
            if (tutDeleted.length > 0) tutSelectEmail(0);
        }
    },
    // ── 9: Malware counter ────────────────────────────────────────────────────
    {
        title:       'Step 9 of 10 &mdash; The Malware Counter',
        text:        'Watch the <b>Malware</b> indicator in the status bar. Two actions trigger an infection:<br>&bull; Replying to a phishing email<br>&bull; Falsely reporting a legitimate email as phishing<br><br><b>3 infections = Game Over!</b> Always double-check sender addresses before acting.',
        target:      '#malware-counter',
        calloutY:    'top',
        nextLabel:   'Next &#9654;',
        interactive: null,
        autoAction:  null,
        beforeShow:  () => {
            tutSwitchFolderSilent('inbox');
            tutClearSelection();
            setActionBtnsEnabled(false);
            showRestoreBtn(false);
        }
    },
    // ── 10: Scoring ───────────────────────────────────────────────────────────
    {
        title:       'Step 10 of 10 &mdash; Your Score',
        text:        'Every correct decision earns points:<br>&bull; Reply to legit email &mdash; <b>+10 pts</b><br>&bull; Delete a phishing email &mdash; <b>+10 pts</b><br>&bull; Delete spam &mdash; <b>+5 pts</b><br>&bull; Report phishing &mdash; <b>+15 pts</b><br>&bull; Report spam &mdash; <b>+10 pts</b><br><br>Your tutorial score: <b id="tut-final-score">0 pts</b>',
        target:      '#score-display',
        calloutY:    'top',
        nextLabel:   'Finish &#9654;',
        interactive: null,
        autoAction:  null,
        beforeShow:  null
    },
    // ── 11: Complete ──────────────────────────────────────────────────────────
    {
        title:       '&#9733;&nbsp; Tutorial Complete!',
        text:        'You\'re ready to play! Each day brings a fresh batch of emails and the volume grows over time.<br><br>Remember:<br>&bull; Always verify sender addresses<br>&bull; Reply to legitimate emails<br>&bull; Report phishing for maximum points<br>&bull; Use Deleted Items / Junk Mail to restore mistakes<br><br>Good luck, employee!',
        target:      null,
        calloutY:    'center',
        nextLabel:   'Main Menu &#9658;',
        interactive: null,
        autoAction:  null,
        beforeShow:  () => {
            tutSwitchFolderSilent('inbox');
            tutClearSelection();
            setActionBtnsEnabled(false);
            showRestoreBtn(false);
        }
    }
];

// ── Initialise ────────────────────────────────────────────────────────────────
window.onload = () => {
    renderTutEmailList();
    showStep(0);

    // Next / Do It For Me buttons
    document.getElementById('tut-next').addEventListener('click', () => {
        const step = STEPS[tutCurrentStep];
        if (step.autoAction) {
            step.autoAction();
        } else {
            nextStep();
        }
    });

    document.getElementById('tut-auto').addEventListener('click', () => {
        const step = STEPS[tutCurrentStep];
        if (step.autoAction) step.autoAction();
    });

    document.getElementById('tut-skip').addEventListener('click', () => {
        location.href = 'index.html';
    });

    // Toolbar action buttons — only fire when the matching step is active
    document.getElementById('reply-btn').addEventListener('click', () => {
        if (STEPS[tutCurrentStep].interactive !== 'reply') return;
        handleTutAction('reply');
        nextStep();
    });

    document.getElementById('report-btn').addEventListener('click', () => {
        if (STEPS[tutCurrentStep].interactive !== 'report') return;
        handleTutAction('report');
        nextStep();
    });

    document.getElementById('ignore-btn').addEventListener('click', () => {
        if (STEPS[tutCurrentStep].interactive !== 'delete') return;
        handleTutAction('delete');
        nextStep();
    });

    // Restore button
    document.getElementById('restore-btn').addEventListener('click', () => {
        if (tutSelectedIndex === null) {
            document.getElementById('status-msg').textContent = 'Select an email to restore first.';
            return;
        }
        const src   = tutCurrentFolder === 'deleted' ? tutDeleted : tutJunk;
        const email = src.splice(tutSelectedIndex, 1)[0];
        tutInbox.push({ ...email, unread: true });
        tutClearSelection();
        tutSwitchFolderSilent('inbox');
        renderTutEmailList();
        updateFolderCounts();
        document.getElementById('status-msg').textContent = 'Email restored to Inbox.';
    });
};

// ── Step display ──────────────────────────────────────────────────────────────
function showStep(n) {
    tutCurrentStep = n;
    const step = STEPS[n];
    const total = STEPS.length - 2;   // exclude welcome (0) and complete (last)

    if (step.beforeShow) step.beforeShow();

    document.getElementById('tut-callout-title').innerHTML = step.title;
    document.getElementById('tut-callout-text').innerHTML  = step.text;

    // Step counter — hidden for welcome and complete
    const isEdge = (n === 0 || n === STEPS.length - 1);
    document.getElementById('tut-step-label').textContent =
        isEdge ? '' : 'Step ' + n + ' of ' + total;

    // Inline score on step 10
    if (n === 10) {
        const el = document.getElementById('tut-final-score');
        if (el) el.textContent = tutScore + ' pts';
    }

    document.getElementById('tut-next').innerHTML = step.nextLabel;

    // "Do It For Me" shown only for interactive steps
    const autoBtn = document.getElementById('tut-auto');
    autoBtn.style.display = (step.interactive && step.autoAction) ? 'inline-block' : 'none';

    // Last step: rename Exit button to "Main Menu"
    document.getElementById('tut-skip').textContent =
        (n === STEPS.length - 1) ? 'Main Menu' : 'Exit Tutorial';

    positionTutorial(step);
}

function nextStep() {
    if (tutCurrentStep >= STEPS.length - 1) {
        location.href = 'index.html';
        return;
    }
    showStep(tutCurrentStep + 1);
}

// ── Overlay positioning ───────────────────────────────────────────────────────
// Arrow half-width offset: the arrow glyph at 22 px is approx 12 px wide.
const ARROW_HALF_W = 12;

function positionTutorial(step) {
    const overlay   = document.getElementById('tut-overlay');
    const spotlight = document.getElementById('tut-spotlight');
    const arrowEl   = document.getElementById('tut-arrow');
    const callout   = document.getElementById('tut-callout');
    const container = document.querySelector('.outlook-window');
    const cRect     = container.getBoundingClientRect();
    const cH        = cRect.height;

    if (!step.target) {
        overlay.style.display   = 'block';
        spotlight.style.display = 'none';
        arrowEl.style.display   = 'none';
        callout.style.top       = '50%';
        callout.style.left      = '50%';
        callout.style.bottom    = '';
        callout.style.transform = 'translate(-50%, -50%)';
        return;
    }

    overlay.style.display = 'none';

    const targetEl = document.querySelector(step.target);
    if (!targetEl) {
        spotlight.style.display = 'none';
        arrowEl.style.display   = 'none';
        return;
    }

    const tRect = targetEl.getBoundingClientRect();
    const pad   = 5;
    const rel   = {
        top:    tRect.top    - cRect.top,
        left:   tRect.left   - cRect.left,
        width:  tRect.width,
        height: tRect.height,
        get bottom() { return this.top  + this.height; },
        get right()  { return this.left + this.width;  }
    };

    // Position spotlight
    spotlight.style.display = 'block';
    spotlight.style.top     = (rel.top    - pad) + 'px';
    spotlight.style.left    = (rel.left   - pad) + 'px';
    spotlight.style.width   = (rel.width  + pad * 2) + 'px';
    spotlight.style.height  = (rel.height + pad * 2) + 'px';

    // Arrow: place below target (pointing ▲) when target is in the upper 42 %
    // of the window; above target (pointing ▼) otherwise.
    const cx = rel.left + rel.width / 2;
    arrowEl.style.display = 'block';
    arrowEl.style.left    = (cx - ARROW_HALF_W) + 'px';

    if (rel.top < cH * 0.42) {
        arrowEl.innerHTML  = '&#9650;';   // ▲
        arrowEl.className  = 'up';
        arrowEl.style.top  = (rel.bottom + pad + 4) + 'px';
        arrowEl.style.bottom = '';
    } else {
        arrowEl.innerHTML  = '&#9660;';   // ▼
        arrowEl.className  = 'down';
        arrowEl.style.top  = (rel.top - pad - 30) + 'px';
        arrowEl.style.bottom = '';
    }

    // Callout: centered horizontally; vertically near top or bottom
    callout.style.transform = 'translateX(-50%)';
    callout.style.left      = '50%';

    if (step.calloutY === 'top') {
        callout.style.top    = '88px';
        callout.style.bottom = '';
    } else {
        callout.style.bottom = '30px';
        callout.style.top    = '';
    }
}

// ── Email list rendering ──────────────────────────────────────────────────────
function renderTutEmailList() {
    const list = document.getElementById('email-list');
    if (!list) return;

    const emails = tutGetFolder();
    list.innerHTML = '';

    if (emails.length === 0) {
        list.innerHTML = '<p class="no-email-msg">This folder is empty.</p>';
        updateUnreadCount();
        return;
    }

    emails.forEach((email, i) => {
        const row = document.createElement('div');
        row.className = 'email-row' +
            (email.unread          ? ' unread'   : '') +
            (tutSelectedIndex === i ? ' selected' : '');

        const shortFrom = email.from.length > 16
            ? email.from.slice(0, 14) + '\u2026'
            : email.from;
        const shortDate = email.date.split(' ')[0];

        row.innerHTML =
            `<span class="email-row-from">${shortFrom}</span>` +
            `<span class="email-row-subject">${email.subject}</span>` +
            `<span class="email-row-date">${shortDate}</span>`;

        row.addEventListener('click', () => {
            tutSelectEmail(i);
            if (STEPS[tutCurrentStep].interactive === 'email-click') {
                nextStep();
            }
        });

        list.appendChild(row);
    });

    updateUnreadCount();
}

function tutSelectEmail(i) {
    const emails = tutGetFolder();
    if (!emails[i]) return;

    tutSelectedIndex = i;
    const email = emails[i];
    if (tutCurrentFolder === 'inbox') email.unread = false;

    const header = document.getElementById('email-header');
    if (header) {
        header.innerHTML =
            `<div class="field-row"><span class="field-label">From:</span>` +
            `<span>${email.from} &lt;${email.address}&gt;</span></div>` +
            `<div class="field-row"><span class="field-label">To:</span>` +
            `<span>you@malwareinc.com</span></div>` +
            `<div class="field-row"><span class="field-label">Subject:</span>` +
            `<span>${email.subject}</span></div>` +
            `<div class="field-row"><span class="field-label">Date:</span>` +
            `<span>${email.date}</span></div>`;
    }

    const body = document.getElementById('email-container');
    if (body) {
        body.innerHTML = email.body
            .split('\n')
            .map(line => line ? `<p>${line}</p>` : '<br>')
            .join('');
    }

    renderTutEmailList();
}

function tutClearSelection() {
    tutSelectedIndex = null;
    const header = document.getElementById('email-header');
    const body   = document.getElementById('email-container');
    if (header) header.innerHTML = '';
    if (body)   body.innerHTML = '<p class="no-email-msg">Select a message from the list to read it.</p>';
    renderTutEmailList();
}

// ── Folder switching ──────────────────────────────────────────────────────────
function tutSwitchFolderSilent(name) {
    tutCurrentFolder = name;
    tutSelectedIndex = null;

    ['inbox', 'sent', 'deleted', 'junk'].forEach(f => {
        const el = document.getElementById('folder-' + f);
        if (el) el.classList.toggle('active', f === name);
    });

    const header = document.getElementById('email-header');
    const body   = document.getElementById('email-container');
    if (header) header.innerHTML = '';
    if (body)   body.innerHTML = '<p class="no-email-msg">Select a message from the list to read it.</p>';
}

function tutSwitchFolder(name) {
    tutSwitchFolderSilent(name);
    renderTutEmailList();
    updateFolderCounts();

    // Advance when the player clicks Deleted Items on step 7
    if (STEPS[tutCurrentStep].interactive === 'folder-deleted' && name === 'deleted') {
        setTimeout(nextStep, 400);
    }
}

// ── Action handling ───────────────────────────────────────────────────────────
function handleTutAction(action) {
    if (tutSelectedIndex === null) return;
    const email = tutInbox[tutSelectedIndex];
    if (!email) return;

    let pts = 0;

    if (action === 'reply') {
        tutSent.push({ ...email, unread: false });
        pts = 10;
        document.getElementById('status-msg').textContent =
            'Reply sent to ' + email.from + '. (+' + pts + ' pts)';

    } else if (action === 'report') {
        tutJunk.push({ ...email, unread: false });
        pts = 15;
        document.getElementById('status-msg').textContent =
            'Phishing reported! (+' + pts + ' pts)';

    } else if (action === 'delete') {
        tutDeleted.push({ ...email, unread: false });
        pts = email.type === 'phish' ? 10 : email.type === 'spam' ? 5 : 0;
        document.getElementById('status-msg').textContent =
            'Email deleted. (+' + pts + ' pts)';
    }

    tutScore += pts;
    document.getElementById('score-display').textContent = 'Score: ' + tutScore;

    tutInbox.splice(tutSelectedIndex, 1);
    tutSelectedIndex = null;

    const header = document.getElementById('email-header');
    const body   = document.getElementById('email-container');
    if (header) header.innerHTML = '';
    if (body)   body.innerHTML = '<p class="no-email-msg">Select a message from the list to read it.</p>';

    renderTutEmailList();
    updateFolderCounts();
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setActionBtnsEnabled(enabled) {
    ['reply-btn', 'ignore-btn', 'report-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !enabled;
    });
}

function showRestoreBtn(visible) {
    const btn = document.getElementById('restore-btn');
    const sep = document.getElementById('restore-sep');
    if (btn) btn.style.display = visible ? 'inline-block' : 'none';
    if (sep) sep.style.display = visible ? 'block'        : 'none';
}

function updateUnreadCount() {
    const el = document.getElementById('unread-count');
    if (!el) return;
    const n = tutInbox.filter(e => e.unread).length;
    el.textContent = n > 0 ? '(' + n + ')' : '';
}

function updateFolderCounts() {
    const map = {
        'sent-count':    tutSent.length,
        'deleted-count': tutDeleted.length,
        'junk-count':    tutJunk.length
    };
    Object.entries(map).forEach(([id, count]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = count > 0 ? '(' + count + ')' : '';
    });
}
