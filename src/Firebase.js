// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getDatabase, ref, set, get, push, onValue, update, remove, onDisconnect }
    from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyByTG8jyUurE6QI_qD2jIkDoiAzf7PLG5k",
    authDomain: "block-wars-b5c62.firebaseapp.com",
    databaseURL: "https://block-wars-b5c62-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "block-wars-b5c62",
    storageBucket: "block-wars-b5c62.firebasestorage.app",
    messagingSenderId: "439739406052",
    appId: "1:439739406052:web:5fee10f75331a6d50ebef1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Generate unique player ID
const playerId = 'player_' + Math.random().toString(36).substr(2, 9);

export { database, ref, set, get, push, onValue, update, remove, onDisconnect, playerId };
