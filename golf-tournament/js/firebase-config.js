// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
// Steps to get your credentials:
//   1. Go to https://console.firebase.google.com
//   2. Create or open a project
//   3. Project Settings (gear icon) > General > Your apps
//   4. Click "Add app", choose Web (</>), register it
//   5. Copy the firebaseConfig object shown and paste it below
//   6. In Firebase Console: Build > Realtime Database > Create database
//      (choose a region, start in test mode)
// ============================================================

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
