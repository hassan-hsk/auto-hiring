// firebase/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAI } from "firebase/ai";
// Remove App Check imports for now
// import {
//     initializeAppCheck,
//     ReCaptchaV3Provider,
// } from "firebase/app-check";

// ✅ Your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBNyyu5QNhA6WLshAvkdk08DuWulR7yaoo",
    authDomain: "aihiringapp.firebaseapp.com",
    databaseURL: "https://aihiringapp-default-rtdb.firebaseio.com",
    projectId: "aihiringapp",
    storageBucket: "aihiringapp.appspot.com",
    messagingSenderId: "709915698489",
    appId: "1:709915698489:web:100944667a0e4ac706b4e8",
    measurementId: "G-3C567X408C",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ❌ Comment out App Check for now
// const appCheck = initializeAppCheck(app, {
//     provider: new ReCaptchaV3Provider("hello"), // This was causing the issue
//     isTokenAutoRefreshEnabled: true,
// });

// ✅ Firestore with persistence
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
    }),
    experimentalForceLongPolling: true,
});

// ✅ Auth, Storage, and AI Logic
const auth = getAuth(app);
const storage = getStorage(app);
const ai = getAI(app);

// ✅ Export for use in app
export { app, auth, db, storage, ai };
