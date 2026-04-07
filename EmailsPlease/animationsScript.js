let day = 1;
let malware = 0;
let selectedIndex = null;
let inbox = [];

const emailPool = [
    {
        from: "IT Department",
        address: "it-support@company.com",
        subject: "Mandatory Password Policy Update",
        body: "Dear Employee,\n\nPlease be advised that our password policy has been updated effective immediately. All passwords must be changed within the next 7 business days.\n\nContact the help desk with any questions.\n\nIT Department",
        date: "3/14/2005 9:02 AM",
        type: "legit"
    },
    {
        from: "HR Department",
        address: "hr@company.com",
        subject: "Q1 Invoice Ready for Review",
        body: "Hello,\n\nThe Q1-2005 invoice is now ready for your review. Please contact the accounting department if you have any questions regarding line items.\n\nThank you,\nHR Department",
        date: "3/14/2005 10:15 AM",
        type: "legit"
    },
    {
        from: "Manager - J. Smith",
        address: "j.smith@company.com",
        subject: "Team Meeting - Thursday 2PM",
        body: "Hi all,\n\nReminder that we have our weekly team sync this Thursday at 2:00 PM in Conference Room B. Please bring your project status updates.\n\nSee you there,\nJ. Smith",
        date: "3/14/2005 11:30 AM",
        type: "legit"
    },
    {
        from: "noreply@bankofamerica-secure.net",
        address: "noreply@bankofamerica-secure.net",
        subject: "URGENT: Your Account Has Been Suspended",
        body: "IMPORTANT NOTICE:\n\nYour Bank of America account has been suspended due to suspicious activity. You must verify your identity immediately or your account will be permanently closed.\n\nClick here to restore access: http://bankofamerica-secure.net/verify\n\nBank of America Security Team",
        date: "3/14/2005 9:47 AM",
        type: "phish"
    },
    {
        from: "security@paypa1-accounts.com",
        address: "security@paypa1-accounts.com",
        subject: "Verify Your PayPal Account Now",
        body: "Dear PayPal Customer,\n\nWe have detected unauthorized access to your PayPal account. Your account has been limited until we can verify your information.\n\nPlease confirm your details within 24 hours or your account will be closed permanently.\n\nPayPal Security",
        date: "3/14/2005 12:03 PM",
        type: "phish"
    },
    {
        from: "irs-refunds@gov-irs-tax.com",
        address: "irs-refunds@gov-irs-tax.com",
        subject: "Tax Refund of $1,437.00 Pending",
        body: "IRS NOTICE:\n\nAfter a review of your 2004 tax return, you are eligible for a refund of $1,437.00. To receive your refund, you must submit your banking information through our secure portal within 48 hours.\n\nFailure to respond will forfeit your refund.\n\nInternal Revenue Service",
        date: "3/14/2005 1:22 PM",
        type: "phish"
    },
    {
        from: "Facilities Dept.",
        address: "facilities@company.com",
        subject: "Office Maintenance - Saturday 3/19",
        body: "Hi everyone,\n\nThis is a reminder that routine HVAC maintenance will be performed this Saturday, March 19th. The office will be accessible but may be noisy between 8AM and 2PM.\n\nApologies for any inconvenience.\n\nFacilities Management",
        date: "3/14/2005 2:45 PM",
        type: "legit"
    }
];

window.onload = () => {
    buildInbox();
    renderEmailList();
    updateUI();
};

function buildInbox() {
    const shuffled = [...emailPool].sort(() => Math.random() - 0.5);
    inbox = shuffled.slice(0, 4).map(e => ({ ...e, unread: true }));
}

function renderEmailList() {
    const list = document.getElementById("email-list");
    if (!list) return;

    list.innerHTML = "";
    inbox.forEach((email, i) => {
        const row = document.createElement("div");
        row.className = "email-row" +
            (email.unread ? " unread" : "") +
            (selectedIndex === i ? " selected" : "");

        const shortFrom = email.from.length > 16
            ? email.from.slice(0, 14) + "…"
            : email.from;
        const shortDate = email.date.split(" ")[0];

        row.innerHTML =
            `<span class="email-row-from">${shortFrom}</span>` +
            `<span class="email-row-subject">${email.subject}</span>` +
            `<span class="email-row-date">${shortDate}</span>`;

        row.addEventListener("click", () => selectEmail(i));
        list.appendChild(row);
    });

    updateUnreadCount();
}

function selectEmail(index) {
    selectedIndex = index;
    const email = inbox[index];
    email.unread = false;

    const header = document.getElementById("email-header");
    if (header) {
        header.innerHTML =
            `<div class="field-row"><span class="field-label">From:</span><span>${email.from} &lt;${email.address}&gt;</span></div>` +
            `<div class="field-row"><span class="field-label">To:</span><span>you@company.com</span></div>` +
            `<div class="field-row"><span class="field-label">Subject:</span><span>${email.subject}</span></div>` +
            `<div class="field-row"><span class="field-label">Date:</span><span>${email.date}</span></div>`;
    }

    const body = document.getElementById("email-container");
    if (body) {
        body.innerHTML = email.body
            .split("\n")
            .map(line => line ? `<p>${line}</p>` : `<br>`)
            .join("");
        body.dataset.type = email.type;
    }

    renderEmailList();
}

function handleAction(action) {
    if (selectedIndex === null) {
        setStatus("Please select an email first.");
        return;
    }

    const email = inbox[selectedIndex];

    if (action === "reply") {
        if (email.type === "phish") {
            malware++;
            setStatus("WARNING: You replied to a phishing email! Malware installed. (" + malware + "/3)");
        } else {
            setStatus("Reply sent to " + email.from + ".");
        }
    } else if (action === "ignore") {
        if (email.type === "phish") {
            setStatus("Phishing email deleted — good instinct.");
        } else {
            setStatus("Email deleted.");
        }
    } else if (action === "report") {
        if (email.type === "phish") {
            setStatus("Phishing email reported to IT Security. Nice catch!");
        } else {
            malware++;
            setStatus("WARNING: You reported a legitimate email as phishing. (" + malware + "/3)");
        }
    }

    inbox.splice(selectedIndex, 1);
    selectedIndex = null;

    const header = document.getElementById("email-header");
    const body = document.getElementById("email-container");
    if (header) header.innerHTML = "";
    if (body) body.innerHTML = '<p class="no-email-msg">Select a message from the list to read it.</p>';

    nextDay();
}

function setStatus(msg) {
    const el = document.getElementById("status-msg");
    if (el) el.textContent = msg;
}

function updateUnreadCount() {
    const el = document.getElementById("unread-count");
    if (!el) return;
    const count = inbox.filter(e => e.unread).length;
    el.textContent = count > 0 ? "(" + count + ")" : "";
}

function updateUI() {
    const dayEl = document.getElementById("day-counter");
    const malwareEl = document.getElementById("malware-counter");
    if (dayEl) dayEl.textContent = "Day: " + day;
    if (malwareEl) malwareEl.textContent = "Malware: " + malware + " / 3";
    updateUnreadCount();
}

function nextDay() {
    day++;
    updateUI();

    if (malware >= 3) {
        location.href = "gameOver.html";
        return;
    }

    const newEmail = { ...emailPool[Math.floor(Math.random() * emailPool.length)], unread: true };
    inbox.push(newEmail);
    renderEmailList();
}

document.addEventListener("click", (e) => {
    if (e.target.id === "reply-btn")  handleAction("reply");
    if (e.target.id === "ignore-btn") handleAction("ignore");
    if (e.target.id === "report-btn") handleAction("report");
});
