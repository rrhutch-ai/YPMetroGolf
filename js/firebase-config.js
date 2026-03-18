// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
// To connect this app to your Firebase project:
//
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or open an existing one)
// 3. In the left sidebar, click "Build" > "Realtime Database"
// 4. Create a database (start in test mode for now)
// 5. Go to Project Settings (gear icon) > Your apps > Web app
// 6. Register a web app if you haven't already
// 7. Copy the firebaseConfig object below and replace the
//    placeholder values with your actual credentials
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAZKiEuV8X4nmaILKOficfMOX1ZLUACzB4",
  authDomain: "golf-scorer-2026.firebaseapp.com",
  databaseURL: "https://golf-scorer-2026-default-rtdb.firebaseio.com",
  projectId: "golf-scorer-2026",
  storageBucket: "golf-scorer-2026.firebasestorage.app",
  messagingSenderId: "516909768092",
  appId: "1:516909768092:web:74ff06f4f6e6cc4c0a3c59",
  measurementId: "G-GEK42HT58D"
};

// Initialize Firebase (do not edit below this line)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
