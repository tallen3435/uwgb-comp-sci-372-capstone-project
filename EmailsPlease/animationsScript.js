// ── State ─────────────────────────────────────────────────────────────────────
let day           = 1;
let malware       = 0;
let selectedIndex = null;
let currentFolder = 'inbox';
let dayEnded      = false;

let totalScore  = 0;
let dayScore    = 0;
let dayCorrect  = 0;
let dayTotal    = 0;   // emails dealt at day start

let inbox        = [];
let sentItems    = [];
let deletedItems = [];
let junkMail     = [];
let emailPool    = [];

// ── Fallback pool ─────────────────────────────────────────────────────────────
const fallbackPool = [
    {
        from: "IT Department", address: "it-support@malwareinc.com",
        subject: "Mandatory Password Policy Update",
        body: "Dear Employee,\n\nOur password policy has been updated. All passwords must be changed within 7 business days via intranet.malwareinc.com.\n\nContact ext. 4400 with questions.\n\nIT Department",
        date: "3/14/2005 9:02 AM", type: "legit"
    },
    {
        from: "HR Department", address: "hr@malwareinc.com",
        subject: "Q1 Invoice Ready for Review",
        body: "Hello,\n\nThe Q1-2005 invoice is ready for review at finance.malwareinc.com.\n\nThank you,\nHR Department",
        date: "3/14/2005 10:15 AM", type: "legit"
    },
    {
        from: "Facilities Dept.", address: "facilities@malwareinc.com",
        subject: "Office Maintenance - Saturday 3/19",
        body: "Hi everyone,\n\nRoutine HVAC maintenance will be performed this Saturday. The office will be noisy between 8AM and 2PM.\n\nFacilities Management",
        date: "3/14/2005 2:45 PM", type: "legit"
    },
    {
        from: "Bank of America", address: "security@bankofamerica-secure.net",
        subject: "URGENT: Your Account Has Been Suspended",
        body: "Dear Valued Customer,\n\nYour account has been suspended. Verify immediately:\nhttp://bankofamerica-secure.net/verify\n\nBank of America Security Team",
        date: "3/14/2005 9:47 AM", type: "phish"
    },
    {
        from: "PayPal Security", address: "security@paypa1-accounts.com",
        subject: "Verify Your PayPal Account Now",
        body: "Dear PayPal Customer,\n\nUnauthorized access detected. Confirm within 24 hours:\nhttp://paypa1-accounts.com/confirm\n\nPayPal Security",
        date: "3/14/2005 12:03 PM", type: "phish"
    },
    {
        from: "IRS Refund Center", address: "refunds@irs-gov-refunds.com",
        subject: "Tax Refund of $1,437.00 Pending",
        body: "Your 2004 refund of $1,437.00 is pending. Submit banking info within 48 hours:\nhttp://irs-gov-refunds.com/claim\n\nInternal Revenue Service",
        date: "3/14/2005 1:22 PM", type: "phish"
    },
    {
        from: "Mega Lottery Intl", address: "winner@mega-lottery-intl.org",
        subject: "CONGRATULATIONS — You Have Won $850,000!",
        body: "You have been selected as the winner of the MEGA INTERNATIONAL LOTTERY 2005! Send your full name, address, phone, and photo ID to claim your prize.",
        date: "3/14/2005 7:18 AM", type: "spam"
    },
    {
        from: "SlimFast Solutions", address: "offers@slimfast-solutions-deals.biz",
        subject: "Lose 30 Pounds in 30 Days — Guaranteed!",
        body: "DOCTORS HATE HIM! Our SlimBlast formula melts fat OVERNIGHT. Buy 2 get 3 FREE! Offer expires TONIGHT.\n\nOrder: slimfast-solutions-deals.biz/order",
        date: "3/14/2005 6:02 AM", type: "spam"
    }
];

// ── Scoring table ─────────────────────────────────────────────────────────────
function getActionScore(emailType, action) {
    if (action === 'reply') {
        if (emailType === 'legit') return 10;   // correct — replied to real email
        return 0;                                // phish/spam reply — malware handles penalty
    }
    if (action === 'ignore') {
        if (emailType === 'phish') return 10;   // good — deleted a phish
        if (emailType === 'spam')  return 5;    // fine — cleaned up spam
        return 0;                               // deleting legit — no bonus
    }
    if (action === 'report') {
        if (emailType === 'phish') return 15;   // best outcome — reported phish
        if (emailType === 'spam')  return 10;   // good — reported spam
        return 0;                               // reporting legit — malware handles penalty
    }
    return 0;
}

// ── Boot ─────────────────────────────────────────────────────────────────────
window.onload = () => {
    fetch('resources/templates/emailTemplates.json')
        .then(r => r.json())
        .then(data => { emailPool = data.emails; })
        .catch(() => { emailPool = fallbackPool; })
        .finally(() => startDay());
};

// ── Day lifecycle ─────────────────────────────────────────────────────────────
function emailsForDay(d) {
    return Math.min(d + 2, 20);   // day 1=3, day 2=4 … day 18+=20
}

function startDay() {
    dayEnded   = false;
    dayScore   = 0;
    dayCorrect = 0;

    const count = emailsForDay(day);
    dayTotal    = count;

    const shuffled = [...emailPool].sort(() => Math.random() - 0.5);
    inbox = shuffled.slice(0, count).map(e => ({ ...e, unread: true }));

    selectedIndex = null;
    hideSummary();
    switchFolder('inbox');
    updateUI();
    setStatus('Day ' + day + ' started — ' + count + ' email(s) to process.');
}

function endDay() {
    dayEnded    = true;
    totalScore += dayScore;
    updateScoreDisplay();
    showSummary();
}

function checkDayEnd() {
    if (!dayEnded && inbox.length === 0) endDay();
}

// ── Summary dialog ────────────────────────────────────────────────────────────
function showSummary() {
    document.getElementById('summaryDay').textContent       = day;
    document.getElementById('summaryTotal').textContent     = dayTotal;
    document.getElementById('summaryCorrect').textContent   = dayCorrect;
    document.getElementById('summaryMalware').textContent   = malware + ' / 3';
    document.getElementById('summaryDayScore').textContent  = dayScore + ' pts';
    document.getElementById('summaryTotalScore').textContent = totalScore + ' pts';
    document.getElementById('daySummary').style.display = 'flex';
}

function hideSummary() {
    const el = document.getElementById('daySummary');
    if (el) el.style.display = 'none';
}

// ── Folder helpers ────────────────────────────────────────────────────────────
function getActiveEmails() {
    switch (currentFolder) {
        case 'sent':    return sentItems;
        case 'deleted': return deletedItems;
        case 'junk':    return junkMail;
        default:        return inbox;
    }
}

function switchFolder(name) {
    currentFolder = name;
    selectedIndex = null;

    ['inbox', 'sent', 'deleted', 'junk'].forEach(f => {
        const el = document.getElementById('folder-' + f);
        if (el) el.classList.toggle('active', f === name);
    });

    const header = document.getElementById('email-header');
    const body   = document.getElementById('email-container');
    if (header) header.innerHTML = '';
    if (body)   body.innerHTML = '<p class="no-email-msg">Select a message from the list to read it.</p>';

    const inInbox      = name === 'inbox';
    const inRestorable = name === 'deleted' || name === 'junk';

    ['reply-btn', 'ignore-btn', 'report-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.disabled = !inInbox;
    });

    const restoreBtn = document.getElementById('restore-btn');
    const restoreSep = document.getElementById('restore-sep');
    if (restoreBtn) restoreBtn.style.display = inRestorable ? '' : 'none';
    if (restoreSep) restoreSep.style.display = inRestorable ? '' : 'none';

    renderEmailList();
}

function updateFolderCounts() {
    const counts = {
        'sent-count':    sentItems.length,
        'deleted-count': deletedItems.length,
        'junk-count':    junkMail.length
    };
    Object.entries(counts).forEach(([id, n]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = n > 0 ? '(' + n + ')' : '';
    });
}

// ── Email list ────────────────────────────────────────────────────────────────
function renderEmailList() {
    const list = document.getElementById('email-list');
    if (!list) return;

    const emails = getActiveEmails();
    list.innerHTML = '';

    if (emails.length === 0) {
        list.innerHTML = '<p class="no-email-msg">This folder is empty.</p>';
        return;
    }

    emails.forEach((email, i) => {
        const row = document.createElement('div');
        row.className = 'email-row' +
            (email.unread        ? ' unread'   : '') +
            (selectedIndex === i ? ' selected' : '');

        const shortFrom = email.from.length > 16
            ? email.from.slice(0, 14) + '\u2026'
            : email.from;
        const shortDate = email.date.split(' ')[0];

        row.innerHTML =
            `<span class="email-row-from">${shortFrom}</span>` +
            `<span class="email-row-subject">${email.subject}</span>` +
            `<span class="email-row-date">${shortDate}</span>`;

        row.addEventListener('click', () => selectEmail(i));
        list.appendChild(row);
    });

    updateUnreadCount();
}

function selectEmail(index) {
    selectedIndex = index;
    const email = getActiveEmails()[index];
    if (currentFolder === 'inbox') email.unread = false;

    const header = document.getElementById('email-header');
    if (header) {
        header.innerHTML =
            `<div class="field-row"><span class="field-label">From:</span><span>${email.from} &lt;${email.address}&gt;</span></div>` +
            `<div class="field-row"><span class="field-label">To:</span><span>you@malwareinc.com</span></div>` +
            `<div class="field-row"><span class="field-label">Subject:</span><span>${email.subject}</span></div>` +
            `<div class="field-row"><span class="field-label">Date:</span><span>${email.date}</span></div>`;
    }

    const body = document.getElementById('email-container');
    if (body) {
        body.innerHTML = email.body
            .split('\n')
            .map(line => line ? `<p>${line}</p>` : '<br>')
            .join('');
        body.dataset.type = email.type;
    }

    renderEmailList();
}

// ── Restore ───────────────────────────────────────────────────────────────────
function restoreEmail() {
    if (selectedIndex === null) {
        setStatus('Select an email to restore first.');
        return;
    }

    const source = currentFolder === 'deleted' ? deletedItems : junkMail;
    const email  = source.splice(selectedIndex, 1)[0];

    inbox.push({ ...email, unread: true });
    selectedIndex = null;

    updateFolderCounts();

    if (dayEnded) {
        dayEnded = false;
        hideSummary();
        setStatus(email.from + ' restored — day re-opened. Return to Inbox.');
    } else {
        setStatus(email.from + ' restored to Inbox.');
    }

    switchFolder('inbox');
}

// ── Game actions (Inbox only) ─────────────────────────────────────────────────
function handleAction(action) {
    if (currentFolder !== 'inbox') return;
    if (selectedIndex === null) {
        setStatus('Please select an email first.');
        return;
    }

    const email = inbox[selectedIndex];
    const score = getActionScore(email.type, action);
    dayScore   += score;
    if (score > 0) dayCorrect++;

    if (action === 'reply') {
        if (email.type === 'phish') {
            malware++;
            setStatus('WARNING: Phishing reply to ' + email.address + '! Malware installed. (' + malware + '/3)');
        } else if (email.type === 'spam') {
            setStatus('Tip: Spam is best deleted, not replied to — but no harm done. (+0)');
        } else {
            setStatus('Reply sent to ' + email.from + '. (+' + score + ' pts)');
        }
        sentItems.push({ ...email, unread: false });

    } else if (action === 'ignore') {
        if (email.type === 'phish') {
            setStatus('Phishing email deleted — good call. Sender: ' + email.address + ' (+' + score + ' pts)');
        } else if (email.type === 'spam') {
            setStatus('Spam deleted. (+' + score + ' pts)');
        } else {
            setStatus('Email deleted. (+' + score + ' pts)');
        }
        deletedItems.push({ ...email, unread: false });

    } else if (action === 'report') {
        if (email.type === 'phish' || email.type === 'spam') {
            setStatus((email.type === 'phish' ? 'Phishing' : 'Spam') +
                ' reported! Sender: ' + email.address + ' (+' + score + ' pts)');
        } else {
            malware++;
            setStatus('WARNING: ' + email.address + ' is a legitimate address. (' + malware + '/3)');
        }
        junkMail.push({ ...email, unread: false });
    }

    inbox.splice(selectedIndex, 1);
    selectedIndex = null;

    const header = document.getElementById('email-header');
    const body   = document.getElementById('email-container');
    if (header) header.innerHTML = '';
    if (body)   body.innerHTML = '<p class="no-email-msg">Select a message from the list to read it.</p>';

    updateUI();

    if (malware >= 3) {
        location.href = 'gameOver.html';
        return;
    }

    checkDayEnd();
    renderEmailList();
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setStatus(msg) {
    const el = document.getElementById('status-msg');
    if (el) el.textContent = msg;
}

function updateUnreadCount() {
    const el = document.getElementById('unread-count');
    if (!el) return;
    const n = inbox.filter(e => e.unread).length;
    el.textContent = n > 0 ? '(' + n + ')' : '';
}

function updateScoreDisplay() {
    const el = document.getElementById('score-display');
    if (el) el.textContent = 'Score: ' + totalScore;
}

function updateUI() {
    const dayEl     = document.getElementById('day-counter');
    const malwareEl = document.getElementById('malware-counter');
    if (dayEl)     dayEl.textContent     = 'Day: ' + day;
    if (malwareEl) malwareEl.textContent = 'Malware: ' + malware + ' / 3';
    updateScoreDisplay();
    updateUnreadCount();
    updateFolderCounts();
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.addEventListener('click', e => {
    if (e.target.id === 'reply-btn')   handleAction('reply');
    if (e.target.id === 'ignore-btn')  handleAction('ignore');
    if (e.target.id === 'report-btn')  handleAction('report');
    if (e.target.id === 'restore-btn') restoreEmail();
    if (e.target.id === 'next-day-btn') {
        hideSummary();
        day++;
        startDay();
    }
});
