# EmailsPlease — UWGB COMP SCI 372 Capstone Project

A phishing email awareness training game. Players read AI-generated emails and decide whether each one is legitimate or a phishing attempt.

**Contributors:** Joel Bowman · Grafton Smith · Thomas Allen · Trevor Janderin

---

## Option 1 — Just Play (No Setup)

Go to **[malwarecrew.win](https://malwarecrew.win)** in any browser.

> **Note:** UWGB campus Wi-Fi blocks this URL. Use your phone's hotspot, a VPN, or home Wi-Fi instead.

---

## Option 2 — Run It Locally

Follow every step in order. Don't skip anything.

### Step 1 — Install Python

Check if you already have it:
```bash
python --version
```
You need **Python 3.10 or newer**. If you don't have it, download it from [python.org/downloads](https://www.python.org/downloads/).

> **Windows users:** During installation, check the box that says **"Add Python to PATH"** or nothing will work.

---

### Step 2 — Get the Code

If you have Git installed:
```bash
git clone https://github.com/tallen3435/uwgb-comp-sci-372-capstone-project.git
cd uwgb-comp-sci-372-capstone-project
```

No Git? Click the green **Code** button on the GitHub page, choose **Download ZIP**, and unzip it somewhere on your computer. Then open a terminal in that folder.

---

### Step 3 — Install Dependencies

From inside the project folder, run:
```bash
pip install -r requirements.txt
```

This installs Flask and all other libraries the app needs. It may take a minute.

> If `pip` isn't recognized, try `pip3` instead.

---

### Step 4 — Get a Gemini API Key

The app uses Google Gemini AI to generate emails. You need a free API key.

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with a Google account
3. Click **Create API Key** and copy it

---

### Step 5 — Create a `.env` File

Inside the `EmailsPlease/` folder, create a plain text file named exactly `.env` (no `.txt` extension) with this content:

```
GEMINI_API_KEY=paste_your_key_here
```

Replace `paste_your_key_here` with the key you copied in Step 4.

> **Windows tip:** File Explorer hides extensions by default. If your file ends up named `.env.txt` it won't work. In Notepad, choose **Save As**, set **Save as type** to **All Files**, and name it `.env`.

---

### Step 6 — Run the App

```bash
cd EmailsPlease
python app.py
```

You should see output like:
```
 * Running on http://0.0.0.0:8000
```

---

### Step 7 — Open in Your Browser

Go to **[http://localhost:5000](http://localhost:5000)**

To stop the app, press `Ctrl + C` in the terminal.
