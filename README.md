# Golf Tournament Scorer

A two-page web app for running scramble-format golf tournaments. Admins manage teams and settings; players enter scores hole-by-hole and watch the live leaderboard.

---

## Project Structure

```
golf-score/
├── index.html          ← Player app (landing, scorecard, leaderboard)
├── admin/
│   └── index.html      ← Admin portal (password-protected)
├── css/
│   └── styles.css      ← Shared stylesheet
├── js/
│   ├── firebase-config.js  ← ⚠️ Paste your Firebase credentials here
│   ├── app.js              ← Player app logic
│   └── admin.js            ← Admin portal logic
└── README.md
```

---

## Setup

### 1. Create a Firebase Project

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click **Add project** and follow the steps
3. In the left sidebar, click **Build → Realtime Database**
4. Click **Create Database** → choose a region → start in **test mode** (you can add security rules later)

### 2. Register a Web App

1. In Firebase Console, click the **gear icon → Project settings**
2. Scroll to **Your apps** and click the **</>** (Web) icon
3. Give it a nickname (e.g. "Golf Scorer") and click **Register app**
4. Copy the `firebaseConfig` object shown on screen

### 3. Paste Firebase Config

Open **`js/firebase-config.js`** and replace the placeholder values with your copied config:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "my-project.firebaseapp.com",
  databaseURL:       "https://my-project-default-rtdb.firebaseio.com",
  projectId:         "my-project",
  storageBucket:     "my-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

> **Important:** Make sure the `databaseURL` field is included — it's required for Realtime Database but sometimes omitted in the Firebase console snippet. The format is `https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com`.

### 4. Set Firebase Database Rules (optional but recommended)

In the Firebase Console → Realtime Database → **Rules** tab, paste:

```json
{
  "rules": {
    "tournament": {
      "settings": {
        ".read": true,
        ".write": false
      },
      "teams": {
        ".read": true,
        "$teamId": {
          ".write": true
        }
      }
    }
  }
}
```

This allows anyone to read team/settings data and write scores, but only the app can write settings. For full security, integrate Firebase Authentication.

### 5. Open the App

**Option A — Local file (simplest for testing):**
- Open `index.html` directly in your browser (player app)
- Open `admin/index.html` directly in your browser (admin)

> Note: Some browsers block Firebase requests from `file://` URLs. Use Option B if you see errors.

**Option B — Local dev server (recommended):**

If you have Node.js installed:
```bash
npx serve .
```
Then open the URL shown (e.g. `http://localhost:3000`).

Or with Python:
```bash
python -m http.server 8080
```

**Option C — Deploy to Firebase Hosting:**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## Admin Portal

- URL: `admin/index.html`
- Default password: **`golf2024`**
- To change the password, edit the `ADMIN_PASSWORD` constant at the top of `js/admin.js`

**Admin can:**
- Set tournament name, date, and player instructions
- Add teams with: name, 4 player names, PIN, starting hole, and tee time
- Edit or delete any team
- See each team's current score progress

---

## Player App

- URL: `index.html`
- Players select their team and enter their PIN to access the scorecard
- Scores are saved to Firebase in real-time on each input
- The leaderboard is live and updates automatically as teams enter scores
- The starting hole is highlighted on the scorecard

---

## Customization

| What | Where |
|------|-------|
| Admin password | `ADMIN_PASSWORD` in `js/admin.js` |
| Color scheme | CSS variables at top of `css/styles.css` |
| Max score per hole | `max="20"` on score inputs in `js/app.js` |
| Number of holes | Change `18` to any value in `js/app.js` → `renderHoleRows()` |
