import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAcgZqQoxeZLs6O8JbC5nW3gw8y6z4kybI",
  authDomain: "estoque-4a453.firebaseapp.com",
  projectId: "estoque-4a453",
  storageBucket: "estoque-4a453.firebasestorage.app",
  messagingSenderId: "1068944169403",
  appId: "1:1068944169403:web:5667d8e7ee5b7d22238c9e",
  measurementId: "G-LH0FH3WT2X"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider, signInWithPopup, signOut };
