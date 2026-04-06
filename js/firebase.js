// IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// SUA CONFIG (a que você mandou)
const firebaseConfig = {
  apiKey: "AIzaSyDUbFlJpP894ergBQoxaXJHttFyDfrYYd4",
  authDomain: "sysreparo-admin.firebaseapp.com",
  projectId: "sysreparo-admin",
  storageBucket: "sysreparo-admin.firebasestorage.app",
  messagingSenderId: "675962211650",
  appId: "1:675962211650:web:5f429a4a72d8ad8a6b0cdb",
  measurementId: "G-XGPL9M66VR"
};

// INICIAR FIREBASE
const app = initializeApp(firebaseConfig);

// EXPORTAR SERVIÇOS
export const auth = getAuth(app);
export const db = getFirestore(app);
