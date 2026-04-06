import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.criarServico = async function () {
  const cliente = document.getElementById("cliente").value;
  const aparelho = document.getElementById("aparelho").value;
  const problema = document.getElementById("problema").value;

  await addDoc(collection(db, "servicos"), {
    cliente,
    aparelho,
    problema,
    status: "Aguardando",
    data: new Date()
  });

  alert("Serviço cadastrado!");
};
