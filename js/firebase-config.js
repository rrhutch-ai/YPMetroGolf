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
  apiKey: "AIzaSyBzWnAcd0S2HdUFTcnuw-qZ7uJGo_siOjI",
  authDomain: "ypmetrogolf.firebaseapp.com",
  databaseURL: "https://ypmetrogolf-default-rtdb.firebaseio.com",
  projectId: "ypmetrogolf",
  storageBucket: "ypmetrogolf.firebasestorage.app",
  messagingSenderId: "793589397451",
  appId: "1:793589397451:web:a921785c8d8c106e11a84e"
};

// Initialize Firebase (do not edit below this line)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
