import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CRIAR CLIENTE
window.criarCliente = async function () {
  const nome = document.getElementById("nome").value;
  const telefone = document.getElementById("telefone").value;

  if (!nome || !telefone) {
    alert("Preencha os campos obrigatórios");
    return;
  }

  await addDoc(collection(db, "clientes"), {
    nome,
    telefone,
    criadoEm: new Date()
  });

  alert("Cliente cadastrado!");
  listarClientes();
};

// LISTAR CLIENTES
async function listarClientes() {
  const querySnapshot = await getDocs(collection(db, "clientes"));

  let html = "";

  querySnapshot.forEach((docItem) => {
    const c = docItem.data();

    html += `
      <tr>
        <td>${c.nome}</td>
        <td>${c.telefone}</td>
        <td>
          <button onclick="remover('${docItem.id}')">Excluir</button>
        </td>
      </tr>
    `;
  });

  document.getElementById("tabela").innerHTML = html;
}

window.remover = async function (id) {
  await deleteDoc(doc(db, "clientes", id));
  listarClientes();
};

listarClientes();
