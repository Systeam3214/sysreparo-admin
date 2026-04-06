import { auth } from "./firebase.js";
import { createUserWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

window.criarUsuario = async function () {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  await createUserWithEmailAndPassword(auth, email, senha);

  alert("Usuário criado!");
};
