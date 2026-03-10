let day = 1;
let malware = 0;

const emails = [
    { subject: "Invoice Ready", body: "Please review the attached invoice.", type: "legit" },
    { subject: "URGENT: Password Reset", body: "Click here to reset now.", type: "phish" }
];

window.onload = () => loadEmail();

function loadEmail() {
    const email = emails[Math.floor(Math.random() * emails.length)];
    const container = document.getElementById("email-container");

    if (!container) return; // Not on game screen

    container.innerHTML = `
        <h2>${email.subject}</h2>
        <p>${email.body}</p>
    `;

    container.dataset.type = email.type;
}

document.addEventListener("click", (e) => {
    if (e.target.id === "reply-btn") handleAction("reply");
    if (e.target.id === "ignore-btn") handleAction("ignore");
    if (e.target.id === "report-btn") handleAction("report");
});

function handleAction(action) {
    const emailType = document.getElementById("email-container").dataset.type;

    if (emailType === "phish" && action === "reply") {
        malware++;
        alert("You replied to a phishing email!");
    }

    if (emailType === "legit" && action === "report") {
        alert("Incorrectly reported a legitimate email.");
    }

    updateUI();
    nextDay();
}

function updateUI() {
    document.getElementById("day-counter").textContent = `Day: ${day}`;
    document.getElementById("malware-counter").textContent = `Malware: ${malware}`;
}

function nextDay() {
    day++;
    if (malware >= 3) location.href = "gameOver.html";
    loadEmail();
}
