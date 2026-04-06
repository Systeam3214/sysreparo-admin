import { auth } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

window.login = async function () {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    window.location.href = "dashboard.html";
  } catch (e) {
    document.getElementById("erro").innerText = "Login inválido";
  }
};

// PROTEÇÃO DE ROTAS
onAuthStateChanged(auth, (user) => {
  if (!user && !window.location.pathname.includes("index.html")) {
    window.location.href = "index.html";
  }
});
