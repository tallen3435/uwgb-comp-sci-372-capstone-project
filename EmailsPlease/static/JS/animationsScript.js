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

let username = '';

let adInterval = null;
let adActive = false;

let gameDifficulty = localStorage.getItem('difficulty') || 'medium';

// Integrated from bugFixes: Scalable difficulty limits
const malwareLimit = gameDifficulty === 'hard' ? 10 : gameDifficulty === 'medium' ? 6 : 3;

// ── Scoring table ─────────────────────────────────────────────────────────────
function getActionScore(emailType, action) {
    if (action === 'reply') {
        if (emailType === 'legit') return 10;
        return 0;
    }
    if (action === 'ignore') {
        if (emailType === 'phish') return 10;
        if (emailType === 'spam')  return 5;
        return 0;
    }
    if (action === 'report') {
        if (emailType === 'phish') return 15;
        if (emailType === 'spam')  return 10;
        return 0;
    }
    return 0;
}

// ── Boot ─────────────────────────────────────────────────────────────────────
window.onload = () => {
    username = prompt("Enter your corporate ID (username):") || "Anonymous";
    username = username.toLowerCase().trim(); 
    startDay();
};

// ── Day lifecycle ─────────────────────────────────────────────────────────────
function emailsForDay(d) {
    return Math.min(d + 2, 20);
}

async function startDay() {
    dayEnded   = false;
    dayScore   = 0;
    dayCorrect = 0;

    const count = emailsForDay(day);
    dayTotal    = count;

    inbox = [];
    selectedIndex = null;
    hideSummary();
    switchFolder('inbox');
    updateUI();

    setStatus('Day ' + day + ' started — Fetching secure communications...');

    const list = document.getElementById('email-list');
    if (list) list.innerHTML = '<p class="no-email-msg">Connecting to mail server... downloading emails.</p>';

        // Create an array that strictly alternates phishing/legitimate
        let dailyTypes = [];
        for (let i = 0; i < count; i++) {
            dailyTypes.push(i % 2 === 0 ? 'phishing' : 'legitimate');
        }
        // Shuffle the deck so the player can't predict the order
        dailyTypes = dailyTypes.sort(() => Math.random() - 0.5);


        // FETCH SEQUENTIALLY TO PREVENT DATABASE RACE CONDITIONS
        const results = [];
        for (let i = 0; i < count; i++) {
            const targetType = dailyTypes[i]; // Pull from our shuffled deck!

            try {
                const response = await fetch('/api/generate-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: targetType,
                        difficulty: gameDifficulty,
                        user_id: username
                    })
                });

                if (response.ok) {
                    results.push(await response.json());
                }
            } catch (err) {
                console.error("API Error:", err);
            }
        }

    results.forEach(aiEmail => {
        if (aiEmail) {
            const cls = aiEmail.classification;
            if (cls !== 'phishing' && cls !== 'legitimate') {
                console.warn('Skipping email with unknown classification:', cls);
                return;
            }

            let fromName = aiEmail.sender;
            let address = aiEmail.sender;
            if (aiEmail.sender.includes('<')) {
                fromName = aiEmail.sender.split('<')[0].trim();
                address = aiEmail.sender.split('<')[1].replace('>', '').trim();
            }

            inbox.push({
                id: aiEmail.id,
                from: fromName,
                address: address,
                subject: aiEmail.subject,
                body: aiEmail.body,
                date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                type: cls === 'phishing' ? 'phish' : 'legit',
                difficulty: aiEmail.difficulty,
                unread: true
            });
        }
    });

    inbox = inbox.sort(() => Math.random() - 0.5);

    if (inbox.length === 0) {
        setStatus('CRITICAL: Mail server offline.');
        if (list) list.innerHTML = '<p class="no-email-msg" style="color:red;">Cannot connect to backend API.</p>';
        return;
    }

    setStatus('Day ' + day + ' ready — ' + inbox.length + ' email(s) to process.');
    renderEmailList();
    updateUI();
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

async function submitScore() {
    try {
        await fetch('/api/submit-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                score: totalScore
            })
        });
    } catch (err) {
        console.error('Failed to submit score:', err);
    }
}

// ── Summary dialog ────────────────────────────────────────────────────────────
function showSummary() {
    document.getElementById('summaryDay').textContent       = day;
    document.getElementById('summaryTotal').textContent     = dayTotal;
    document.getElementById('summaryCorrect').textContent   = dayCorrect;
    document.getElementById('summaryMalware').textContent   = malware + ' / ' + malwareLimit;
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
    if (restoreBtn) restoreBtn.style.display = inRestorable ? 'inline-block' : 'none';
    if (restoreSep) restoreSep.style.display = inRestorable ? 'block' : 'none';

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

        const fromSpan = document.createElement('span');
        fromSpan.className = 'email-row-from';
        fromSpan.textContent = shortFrom;
        const subjectSpan = document.createElement('span');
        subjectSpan.className = 'email-row-subject';
        subjectSpan.textContent = email.subject;
        const dateSpan = document.createElement('span');
        dateSpan.className = 'email-row-date';
        dateSpan.textContent = shortDate;
        row.appendChild(fromSpan);
        row.appendChild(subjectSpan);
        row.appendChild(dateSpan);

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
        header.innerHTML = '';
        [
            ['From:', email.from + ' <' + email.address + '>'],
            ['To:', 'you@malwareinc.com'],
            ['Subject:', email.subject],
            ['Date:', email.date]
        ].forEach(([label, value]) => {
            const row = document.createElement('div');
            row.className = 'field-row';
            const lbl = document.createElement('span');
            lbl.className = 'field-label';
            lbl.textContent = label;
            const val = document.createElement('span');
            val.textContent = value;
            row.appendChild(lbl);
            row.appendChild(val);
            header.appendChild(row);
        });
    }

    const body = document.getElementById('email-container');
    if (body) {
        body.innerHTML = '';
        email.body.split('\n').forEach(line => {
            const el = line ? document.createElement('p') : document.createElement('br');
            if (line) el.textContent = line;
            body.appendChild(el);
        });
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
            updateAdSystem();
            setStatus('WARNING: Phishing reply to ' + email.address + '! Malware installed. (' + malware + '/' + malwareLimit + ')');
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
            updateAdSystem();
            setStatus('WARNING: ' + email.address + ' is a legitimate address. (' + malware + '/' + malwareLimit + ')');
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

    if (malware >= malwareLimit) {
        submitScore().finally(() => {
            if (adInterval) clearInterval(adInterval);
            location.href = 'gameOver.html';
        });
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
    const dayEl        = document.getElementById('day-counter');
    const malwareEl    = document.getElementById('malware-counter');
    const difficultyEl = document.getElementById('difficulty-display');
    if (dayEl)        dayEl.textContent        = 'Day: ' + day;
    if (malwareEl)    malwareEl.textContent    = 'Malware: ' + malware + ' / ' + malwareLimit;
    if (difficultyEl) difficultyEl.textContent = 'Difficulty: ' + gameDifficulty.charAt(0).toUpperCase() + gameDifficulty.slice(1);
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

// ── Pop up ads & Jumpscares ───────────────────────────────────────────────────
function showFakeAd() {
    const roll = Math.random();
    if (roll < 0.04) {
        showJumpscare();
        return;
    }
    if (roll < 0.08) {
        showKayneJumpscare();
        return;
    }
    if (roll < 0.12) {
        showUnderwaterJumpscare();
        return;
    }
    if (roll < 0.16) {
        showBalkanGuyJumpscare();
        return;
    }
    if (roll < 0.20) {
        showElonJumpscare();
        return;
    }
    if (roll < 0.24) {
        showBillGatesJumpscare();
        return;
    }
    if (roll < 0.28) {
        showCharlieJumpscare();
        return;
    }

    adActive = true;

    const ad = document.createElement('div');
    ad.className = 'fake-ad';

    const box = document.createElement('div');
    box.className = 'ad-box';

    const minSize = 150;
    const maxSize = 600;

    const size = Math.random() * (maxSize - minSize) + minSize;

    const imgSrc = getRandomAdImage();

    box.innerHTML = `
        <img src="${imgSrc}" style="width:${size}px">
        <br>
    `;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';

    closeBtn.addEventListener('click', closeFakeAd);

    box.appendChild(closeBtn);

    box.style.visibility = 'hidden';
    ad.appendChild(box);
    document.body.appendChild(ad);

    const padding = 20;

    const applyPosition = () => {
        const w = box.offsetWidth;
        const h = box.offsetHeight;
        const safeW = Math.max(0, window.innerWidth  - w - padding * 2);
        const safeH = Math.max(0, window.innerHeight - h - padding * 2);
        box.style.left = `${padding + Math.random() * safeW}px`;
        box.style.top  = `${padding + Math.random() * safeH}px`;
        box.style.visibility = 'visible';
    };

    const img = box.querySelector('img');
    if (img && !img.complete) {
        img.addEventListener('load',  applyPosition);
        img.addEventListener('error', applyPosition);
    } else {
        requestAnimationFrame(applyPosition);
    }
}

function showJumpscare() {
    adActive = true;
    const overlay = document.createElement('div');
    overlay.id = 'jumpscare-overlay';
    const img = document.createElement('img');
    img.src = '../resources/images/Blue_Lobster.png';
    img.id = 'jumpscare-img';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.id = 'jumpscare-close';
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        audio.pause();
        audio.currentTime = 0;
        adActive = false;
    });
    const audio = new Audio('../resources/audio/BlueLobster.mp3');
    audio.volume = 1.0;
    if (localStorage.getItem('soundEnabled') !== 'false') audio.play().catch(() => {});
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
}

function showKayneJumpscare() {
    adActive = true;
    const overlay = document.createElement('div');
    overlay.id = 'kayne-overlay';
    const img = document.createElement('img');
    img.src = '../resources/images/Kayne.png';
    img.id = 'kayne-img';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.id = 'jumpscare-close';
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        audio.pause();
        audio.currentTime = 0;
        adActive = false;
    });
    const audio = new Audio('../resources/audio/marimba-ringtone.wav');
    audio.volume = 1.0;
    if (localStorage.getItem('soundEnabled') !== 'false') audio.play().catch(() => {});
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
}

function showUnderwaterJumpscare() {
    adActive = true;
    const overlay = document.createElement('div');
    overlay.id = 'underwater-overlay';
    const img = document.createElement('img');
    img.src = '../resources/images/Under_water.png';
    img.id = 'underwater-img';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.id = 'jumpscare-close';
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        audio.pause();
        audio.currentTime = 0;
        adActive = false;
    });
    const audio = new Audio('../resources/audio/hello-im-under-the-water.mp3');
    audio.volume = 1.0;
    if (localStorage.getItem('soundEnabled') !== 'false') audio.play().catch(() => {});
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
}

function showCharlieJumpscare() {
    adActive = true;
    const overlay = document.createElement('div');
    overlay.id = 'charlie-overlay';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'overflow: hidden; line-height: 0;';

    const video = document.createElement('video');
    video.src = '../resources/videos/charile.mp4';
    video.id = 'charlie-video';
    video.autoplay = true;
    video.loop = true;
    video.muted = localStorage.getItem('soundEnabled') === 'false';
    video.style.cssText = 'display: block; max-width: 90vw; max-height: 82vh;';

    // Crop bottom 12% to hide the Vlipsy watermark
    video.addEventListener('loadedmetadata', () => {
        requestAnimationFrame(() => {
            const h = video.getBoundingClientRect().height;
            if (h > 0) wrapper.style.height = (h * 0.88) + 'px';
        });
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.id = 'jumpscare-close';
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        video.pause();
        adActive = false;
    });

    wrapper.appendChild(video);
    overlay.appendChild(wrapper);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
}

function showBillGatesJumpscare() {
    adActive = true;
    const overlay = document.createElement('div');
    overlay.id = 'billgates-overlay';
    const img = document.createElement('img');
    img.src = '../resources/images/Bill_Gates.png';
    img.id = 'billgates-img';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.id = 'jumpscare-close';
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        audio.pause();
        audio.currentTime = 0;
        adActive = false;
    });
    const audio = new Audio('../resources/audio/marimba-ringtone.wav');
    audio.volume = 1.0;
    if (localStorage.getItem('soundEnabled') !== 'false') audio.play().catch(() => {});
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
}

function showElonJumpscare() {
    adActive = true;
    const overlay = document.createElement('div');
    overlay.id = 'elon-overlay';
    const img = document.createElement('img');
    img.src = '../resources/images/Elon.png';
    img.id = 'elon-img';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.id = 'jumpscare-close';
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        audio.pause();
        audio.currentTime = 0;
        adActive = false;
    });
    const audio = new Audio('../resources/audio/mixkit-siren-song-1155.mp3');
    audio.volume = 1.0;
    if (localStorage.getItem('soundEnabled') !== 'false') audio.play().catch(() => {});
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
}

function showBalkanGuyJumpscare() {
    adActive = true;
    const overlay = document.createElement('div');
    overlay.id = 'balkanguy-overlay';
    const img = document.createElement('img');
    img.src = '../resources/images/balkanguyv2.gif';
    img.id = 'balkanguy-img';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.id = 'jumpscare-close';
    closeBtn.addEventListener('click', () => {
        overlay.remove();
        audio.pause();
        audio.currentTime = 0;
        adActive = false;
    });
    const audio = new Audio('../resources/audio/mixkit-love-is-eternal-37.mp3');
    audio.volume = 1.0;
    if (localStorage.getItem('soundEnabled') !== 'false') audio.play().catch(() => {});
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
}

function closeFakeAd(e) {
    const ad = e.target.closest('.fake-ad');
    if (ad) ad.remove();
    adActive = false;
}

function updateAdSystem() {
    if (adInterval) clearInterval(adInterval);
    let intervalTime = null;

    if (malware === 1) {
        intervalTime = 25000;
    } else if (malware === 2) {
        intervalTime = 18000;
    } else if (malware === 3) {
        intervalTime = 13000;
    } else if (malware === 4) {
        intervalTime = 10000; 
    } else if (malware === 5) {
        intervalTime = 8000;
    } else if (malware <= malwareLimit) {
        intervalTime = 5000; 
    }

    if (!intervalTime) return;
    adInterval = setInterval(() => {
        showFakeAd();
    }, intervalTime);
}

const adImages = [
    "popupad1.png", "popupad2.png", "popupad3.png", "popupad4.png",
    "popupad5.gif", "popupad6.png", "popupad7.png", "popupad8.png"
];

function getRandomAdImage() {
    const choice = adImages[Math.floor(Math.random() * adImages.length)];
    return `../resources/images/${choice}`;
}