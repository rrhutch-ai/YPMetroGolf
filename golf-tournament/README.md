# Golf Tournament Scoring App

A real-time golf tournament scoring app — no frameworks, no build step. Vanilla HTML/CSS/JS with Firebase Realtime Database for live data sync.

## Features

| | |
|---|---|
| **Admin portal** (`admin/index.html`) | Password-protected. Set tournament details, add/edit/delete teams with names, players, PIN, starting hole, and tee time. |
| **Player scorecard** (`index.html`) | Team login via dropdown + PIN. 18-hole scramble scorecard with color-coded scores, auto-save, and running totals. |
| **Live leaderboard** | Updates in real time as teams enter scores. Sorted by total strokes. |

---

## Quick Setup

### Step 1 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in.
2. Click **Add project** and follow the prompts.
3. In your project, go to **Build → Realtime Database → Create database**.
   - Choose a region near you.
   - Start in **test mode** for now (you'll add rules in Step 3).
4. Go to **Project Settings** (⚙ gear icon) → **General** → scroll to **Your apps**.
5. Click **Add app**, choose **Web** (`</>`), give it a nickname, and click **Register app**.
6. Copy the entire `firebaseConfig = { … }` block that appears.

### Step 2 — Paste your credentials

Open `js/firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "paste-your-api-key",
  authDomain:        "your-project-id.firebaseapp.com",
  databaseURL:       "https://your-project-id-default-rtdb.firebaseio.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId:             "your-app-id"
};
```

> The `databaseURL` is the most important field — without it Firebase won't connect. Find it in Firebase Console → Realtime Database → the URL shown at the top (e.g. `https://your-project-default-rtdb.firebaseio.com`).

### Step 3 — Set database security rules

In Firebase Console → Realtime Database → **Rules**, paste:

```json
{
  "rules": {
    "tournament": {
      ".read": true,
      ".write": false
    },
    "teams": {
      ".read": true,
      ".write": false
    },
    "scores": {
      ".read": true,
      ".write": true
    }
  }
}
```

Click **Publish**. This allows players to read everything and write only scores, while tournament/team data can only be written from the admin portal (which uses your full Firebase config in test mode — see note below).

> **Note:** For a casual tournament, test mode (all read/write allowed) is fine. The rules above add a layer of protection. For fully secure production use, add Firebase Authentication.

### Step 4 — Change the admin password

Open `js/admin.js` and update line 4:

```js
const ADMIN_PASSWORD = 'golf2024'; // ← change this!
```

### Step 5 — (Optional) Adjust par values

Both `js/admin.js` and `js/player.js` contain a `PAR` array at the top. Update it to match your actual course:

```js
// Index 0 = Hole 1 … Index 17 = Hole 18
const PAR = [4,4,3,4,5,3,4,4,5, 4,3,4,5,4,3,5,4,4]; // par 72
```

### Step 6 — Deploy

This is a fully static site — upload the folder as-is to any host:

| Host | How |
|---|---|
| **Firebase Hosting** | `npm i -g firebase-tools` → `firebase login` → `firebase init hosting` → `firebase deploy` |
| **Netlify** | Drag-and-drop the `golf-tournament` folder at netlify.com/drop |
| **GitHub Pages** | Push repo → Settings → Pages → Deploy from branch `main` / `root` |
| **Any web server** | Copy all files to your server's public directory |

---

## File Structure

```
golf-tournament/
├── index.html              ← Player scoring app
├── admin/
│   └── index.html          ← Admin portal
├── css/
│   └── style.css           ← Shared styles
├── js/
│   ├── firebase-config.js  ← ✏ Edit this with your Firebase credentials
│   ├── player.js           ← Player app logic
│   └── admin.js            ← Admin portal logic (password lives here)
└── README.md
```

---

## Day-of Workflow

### Admin (before the round)
1. Open `admin/index.html` and log in.
2. Fill in tournament name, date, format, and instructions → **Save Tournament Info**.
3. Add each team: name, 4 player names, PIN, starting hole, tee time → **Save Team**.
4. Share the player app URL and each team's PIN with players.

### Players (during the round)
1. Open `index.html` on any phone or device — no app install needed.
2. Select team from the dropdown and enter PIN → **View Scorecard**.
3. Enter the score for each hole after it's completed. Scores save automatically.
4. Tap **Leaderboard** at any time to see live standings.

---

## Score Color Coding

| Color | Meaning |
|---|---|
| Purple | Eagle or better (−2+) |
| Red | Birdie (−1) |
| Black | Par (E) |
| Blue | Bogey (+1) |
| Teal | Double bogey or worse (+2+) |

---

## Troubleshooting

**Scores aren't saving / "Save failed"**
- Check that `databaseURL` in `firebase-config.js` is correct.
- Verify your Realtime Database rules allow writes to `/scores`.
- Open browser DevTools → Console for error details.

**"Permission denied" errors**
- Your database rules are blocking writes. Switch to test mode temporarily, or review the rules in Step 3.

**Admin changes not showing up for players**
- Make sure you clicked **Save** in the admin portal.
- Hard refresh the player page (Ctrl+Shift+R / Cmd+Shift+R).

**Team dropdown is empty**
- No teams have been added yet. Log into the admin portal and add teams first.
