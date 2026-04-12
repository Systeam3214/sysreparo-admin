const firebaseConfig = {
    apiKey: "AIzaSyDUbFlJpP894ergBQoxaXJHttFyDfrYYd4",
    authDomain: "sysreparo-admin.firebaseapp.com",
    projectId: "sysreparo-admin",
    storageBucket: "sysreparo-admin.firebasestorage.app",
    messagingSenderId: "675962211650",
    appId: "1:675962211650:web:5f429a4a72d8ad8a6b0cdb",
    measurementId: "G-XGPL9M66VR"
};

// Inicialização Firebase usando o objeto Compativel "firebase" que veio pelo Script HTML
firebase.initializeApp(firebaseConfig);
const analytics = firebase.analytics();
const db = firebase.firestore();

// Estado reativo global
let mockOrders = [];
let mockClients = [];
let mockParts = [];
let currentFilter = 'Todos';
let currentUserTag = 'worker'; // Global para controle de UI dinâmica
let currentUsedParts = []; // Lista temporária para o modal de OS

document.addEventListener('DOMContentLoaded', () => {
    // --- NAVEGAÇÃO DO SIDEBAR ---
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.page-section');

    function navigateTo(targetId) {
        navLinks.forEach(link => link.classList.remove('active'));
        const targetLink = document.querySelector(`.nav-links a[data-target="${targetId}"]`);
        if (targetLink) targetLink.classList.add('active');

        sections.forEach(sec => sec.classList.remove('active'));
        const targetSec = document.getElementById(targetId);
        if (targetSec) {
            targetSec.classList.add('active');
        }

        // Fecha menu mobile se estiver aberto
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('mobileMenuOverlay');
        if (sidebar) sidebar.classList.remove('menu-open');
        if (overlay) overlay.classList.remove('active');
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            if (target) {
                navigateTo(target);
            } else if (link.getAttribute('href') !== '#') {
                window.location.href = link.getAttribute('href');
            }
        });
    });

    // --- ATALHOS DASHBOARD ---
    window.goToOrdersWithFilter = function(filterValue) {
        navigateTo('sec-ordens');
        const filterBtns = document.querySelectorAll('.filter-btn');
        const targetBtn = Array.from(filterBtns).find(btn => btn.getAttribute('data-filter') === filterValue);
        if (targetBtn) targetBtn.click();
    };

    const cardAndamento = document.getElementById('card-andamento');
    const cardEntregues = document.getElementById('card-entregues');
    const btnVerTodas = document.getElementById('btn-ver-todas');

    if (cardAndamento) cardAndamento.addEventListener('click', () => window.goToOrdersWithFilter('Em Reparo'));
    if (cardEntregues) cardEntregues.addEventListener('click', () => window.goToOrdersWithFilter('Entregue'));
    if (btnVerTodas) btnVerTodas.addEventListener('click', (e) => { e.preventDefault(); window.goToOrdersWithFilter('Todos'); });

    // --- TEMA DARK MODE ---
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        });
    }

    // --- MENU MOBILE ---
    const sidebar = document.querySelector('.sidebar');
    const sidebarHeader = document.querySelector('.sidebar-header');
    const overlay = document.getElementById('mobileMenuOverlay');

    function toggleMobileMenu() {
        if (window.innerWidth <= 1024) {
            sidebar.classList.toggle('menu-open');
            overlay.classList.toggle('active');
        }
    }

    if (sidebarHeader) {
        sidebarHeader.addEventListener('click', toggleMobileMenu);
    }

    if (overlay) {
        overlay.addEventListener('click', toggleMobileMenu);
    }

    // Filtros de OS
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            window.renderOrdersTable(currentFilter);
        });
    });

    // --- SETUP FIREBASE LISTENERS ---
    firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            checkPermissions(user);
            setupFirebaseListeners();
        }
    });
});

async function checkPermissions(user) {
    const SUPER_ADMIN = 'rstarkadm@gmail.com';
    let userTag = 'worker';
    let userName = user.displayName || 'Funcionário';

    if (user.email === SUPER_ADMIN) {
        userTag = 'adm';
        userName = 'Renato (Master)';
    } else {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                userTag = userDoc.data().tag || 'worker';
                userName = userDoc.data().name || user.email;
            }
        } catch (e) {
            console.error("Erro ao buscar permissões:", e);
        }
    }

    currentUserTag = userTag;

    // Atualiza Perfil na Sidebar
    const profileName = document.querySelector('.user-profile .name');
    const profileRole = document.querySelector('.user-profile .role');
    const avatar = document.querySelector('.user-profile .avatar');
    
    if (profileName) profileName.innerText = userName;
    if (profileRole) profileRole.innerText = userTag === 'adm' ? 'Administrador' : 'Colaborador';
    if (avatar) avatar.innerText = userName.charAt(0).toUpperCase();

    // Ocultar elementos restritos estáticos
    const restrictedElements = document.querySelectorAll('[data-auth="adm"]');
    restrictedElements.forEach(el => {
        if (userTag !== 'adm') {
            el.style.display = 'none';
        } else {
            el.style.display = ''; 
        }
    });

    // Se for worker e estiver em seção proibida, volta pro dashboard
    const activeSection = document.querySelector('.page-section.active');
    if (userTag !== 'adm' && activeSection && activeSection.hasAttribute('data-auth')) {
        navigateTo('sec-dashboard');
    }

    // Re-renderiza tabelas para aplicar travas nos botões de delete
    window.renderOrdersTable(currentFilter);
    window.renderClientsTable();
    window.renderPartsTable();
}

function getBadgeClass(status) {
    if (status === 'Aguardando Análise') return 'pending';
    if (status === 'Pronto p/ Retirada' || status === 'Entregue') return 'completed';
    if (status === 'Em Reparo') return 'progress';
    return '';
}

function updateDashboardStats() {
    const andamentoCount = mockOrders.filter(o => o.status === 'Em Reparo' || o.status === 'Aguardando Análise').length;
    const pendendoCount = mockOrders.filter(o => o.status === 'Aguardando Análise').length; 
    const entreguesCount = mockOrders.filter(o => o.status === 'Entregue' || o.status === 'Pronto p/ Retirada').length;

    const elAndamento = document.querySelector('#card-andamento .stat-value');
    if (elAndamento) elAndamento.innerText = andamentoCount;

    const elPendendo = document.querySelector('.stat-card.warning .stat-value');
    if (elPendendo) elPendendo.innerText = pendendoCount;

    const elEntregues = document.querySelector('#card-entregues .stat-value');
    if (elEntregues) elEntregues.innerText = entreguesCount;
}

window.updateRecentActivities = function() {
    const list = document.getElementById('recentActivityList');
    if (!list) return;

    list.innerHTML = '';
    
    // Filtra Entradas (Todas as OSs baseadas no createdAt)
    const entries = mockOrders.map(o => ({
        type: 'entrada',
        title: `Nova OS: ${o.displayId}`,
        subtitle: o.title,
        client: o.client,
        dateObj: o.createdAt?.toMillis ? o.createdAt.toMillis() : Date.now()
    }));

    // Filtra Saídas (Apenas OSs entregues que possuem exitDate)
    const exits = mockOrders
        .filter(o => o.status === 'Entregue' && o.exitDate)
        .map(o => ({
            type: 'saida',
            title: `Saída OS: ${o.displayId}`,
            subtitle: o.title,
            client: o.client,
            dateObj: o.exitDate?.toMillis ? o.exitDate.toMillis() : (o.exitDate.toDate ? o.exitDate.toDate().getTime() : Date.now())
        }));

    const mixed = [...entries, ...exits].sort((a,b) => b.dateObj - a.dateObj).slice(0, 4);

    if (mixed.length === 0) {
        list.innerHTML = `<li class="activity-item" style="justify-content: center; color: var(--text-muted);"><span style="font-size:14px;">Sem movimentações recentes</span></li>`;
        return;
    }

    mixed.forEach(item => {
        const iconHtml = item.type === 'entrada' 
            ? `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>`
            : `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`;

        const badgeHtml = item.type === 'entrada'
            ? `<span class="status-badge progress">Entrada</span>`
            : `<span class="status-badge completed">Saída</span>`;

        const li = document.createElement('li');
        li.className = 'activity-item';
        li.innerHTML = `
            <div class="activity-icon" style="background: ${item.type === 'entrada' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color: ${item.type === 'entrada' ? '#3b82f6' : '#10b981'};">
                ${iconHtml}
            </div>
            <div class="activity-details">
                <div class="activity-title" style="font-weight: 600;">${item.title}</div>
                <div class="activity-meta">${item.subtitle}</div>
                <div class="activity-meta" style="font-size: 11px; opacity: 0.8;">Cliente: ${item.client}</div>
            </div>
            ${badgeHtml}
        `;
        list.appendChild(li);
    });
};

window.renderOrdersTable = function(filter = 'Todos') {
    const tableBody = document.getElementById('ordersTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    const filtered = filter === 'Todos' ? mockOrders : mockOrders.filter(o => o.status === filter);

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhuma ordem encontrada no banco de dados.</td></tr>`;
        return;
    }

    filtered.forEach(order => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (!e.target.closest('.table-actions')) editOrder(order.id);
        };

        const exitDateStr = order.exitDate?.toDate ? order.exitDate.toDate().toLocaleDateString('pt-BR') : (order.exitDate instanceof Date ? order.exitDate.toLocaleDateString('pt-BR') : '');

        tr.innerHTML = `
            <td>
                <div style="font-weight: 500; color: var(--text-main);">${order.title}</div>
                <div style="font-size: 13px; color: var(--text-muted);">${order.displayId || 'OS-Cloud'}</div>
                <div class="mobile-date-info" style="display: none; font-size: 11px; color: var(--primary); margin-top: 4px; font-weight: 500;">
                    E: ${order.date} ${exitDateStr ? ` | S: ${exitDateStr}` : ''}
                </div>
            </td>
            <td>${order.client}</td>
            <td><span class="status-badge ${getBadgeClass(order.status)}">${order.status}</span></td>
            <td class="desktop-date-column">
                <div style="font-size: 13px;">${order.date}</div>
                ${exitDateStr ? `<div style="font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border); margin-top: 4px; padding-top: 4px;">S: ${exitDateStr}</div>` : ''}
            </td>
            <td>
                <div class="table-actions">
                    <button class="icon-btn edit" onclick="event.stopPropagation(); editOrder('${order.id}')" title="Editar Status/Detalhes">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    ${currentUserTag === 'adm' ? `
                    <button class="icon-btn delete" onclick="event.stopPropagation(); deleteOrder('${order.id}')" title="Excluir OS">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
};

window.renderClientsTable = function() {
    const clientsTableBody = document.getElementById('clientsTableBody');
    if (!clientsTableBody) return;
    clientsTableBody.innerHTML = '';
    if (mockClients.length === 0) {
        clientsTableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum cliente encontrado no banco de dados.</td></tr>`;
        return;
    }

    mockClients.forEach(client => {
        const badgeClass = client.status === 'Ativo' ? 'completed' : 'pending';
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (!e.target.closest('.table-actions')) editClient(client.id);
        };

        tr.innerHTML = `
            <td style="font-weight: 500; color: var(--text-main);">${client.name}</td>
            <td>
                <div>${client.phone}</div>
                <div style="font-size: 13px; color: var(--text-muted);">${client.email || 'Sem e-mail'}</div>
            </td>
            <td><span class="status-badge ${badgeClass}">${client.status || 'Ativo'}</span></td>
            <td>
                <div class="table-actions">
                    <button class="icon-btn edit" onclick="event.stopPropagation(); editClient('${client.id}')" title="Editar">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    ${currentUserTag === 'adm' ? `
                    <button class="icon-btn delete" onclick="event.stopPropagation(); deleteClient('${client.id}')" title="Excluir">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        clientsTableBody.appendChild(tr);
    });
};

function setupFirebaseListeners() {
    db.collection('clients').onSnapshot((snapshot) => {
        mockClients = [];
        snapshot.forEach(docSnap => {
            mockClients.push({ id: docSnap.id, ...docSnap.data() });
        });
        window.renderClientsTable();
        if (window.updateRecentActivities) window.updateRecentActivities();
    }, (error) => {
        console.error("Erro no listener de clientes:", error);
    });

    db.collection('orders').onSnapshot((snapshot) => {
        mockOrders = [];
        snapshot.forEach(docSnap => {
            mockOrders.push({ id: docSnap.id, ...docSnap.data() });
        });
        // Ordena mais recente primeiro
        mockOrders.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        
        window.renderOrdersTable(currentFilter);
        updateDashboardStats();
        if (window.updateRecentActivities) window.updateRecentActivities();
        // Atualiza a tabela financeira se estiver visível ou se houver dados novos
        window.renderFinancialTable();
    }, (error) => {
        console.error("Erro no listener de Ordens:", error);
    });

    db.collection('parts').onSnapshot((snapshot) => {
        mockParts = [];
        snapshot.forEach(docSnap => {
            mockParts.push({ id: docSnap.id, ...docSnap.data() });
        });
        window.renderPartsTable();
    }, (error) => {
        console.error("Erro no listener de Peças:", error);
    });
}

// --- FUNÇÕES GLOBAIS DE MODAL E CRUD PRINCIPAIS ---

let isCreatingNewClientInsideOrder = false;

window.openOrderModal = function() {
    document.getElementById('orderId').value = '';
    document.getElementById('orderDeviceType').value = 'TV';
    document.getElementById('orderDeviceModel').value = '';
    document.getElementById('orderDeviceSerial').value = '';
    document.getElementById('orderIssue').value = '';
    document.getElementById('orderLaborPrice').value = '';
    document.getElementById('orderPartsTotal').value = '0.00';
    document.getElementById('orderTotalDisplay').innerText = 'R$ 0,00';
    document.getElementById('orderFinalValue').value = '0';
    document.getElementById('orderEstimatedValue').value = '0';
    
    currentUsedParts = [];
    window.renderOrderUsedParts();
    window.updateOrderPartSelector();

    document.getElementById('orderStatusGroup').style.display = 'none';
    document.getElementById('orderModal').querySelector('h2').innerText = 'Nova Ordem de Serviço';

    const clientSelect = document.getElementById('orderClientSelect');
    clientSelect.innerHTML = '<option value="">Selecione um cliente...</option>';
    mockClients.forEach(c => {
        clientSelect.innerHTML += `<option value="${c.name}">${c.name} - ${c.phone}</option>`;
    });

    isCreatingNewClientInsideOrder = false;
    document.getElementById('newClientSection').style.display = 'none';
    const toggleBtn = document.getElementById('toggleNewClientBtn');
    if (toggleBtn) {
        toggleBtn.innerText = '+ Novo Cliente';
        toggleBtn.classList.remove('danger');
        toggleBtn.classList.add('primary');
    }
    document.getElementById('orderClientSelect').disabled = false;

    document.getElementById('newClientName').value = '';
    document.getElementById('newClientPhone').value = '';
    document.getElementById('newClientEmail').value = '';
    document.getElementById('newClientCEP').value = '';
    document.getElementById('newClientAddress').value = '';
    document.getElementById('newClientNumber').value = '';
    document.getElementById('newClientComplement').value = '';

    document.getElementById('orderModal').classList.add('active');
};

window.closeOrderModal = function() {
    document.getElementById('orderModal').classList.remove('active');
};

window.toggleNewClientFields = function() {
    isCreatingNewClientInsideOrder = !isCreatingNewClientInsideOrder;
    const newClientSection = document.getElementById('newClientSection');
    const clientSelect = document.getElementById('orderClientSelect');
    const toggleBtn = document.getElementById('toggleNewClientBtn');

    if (isCreatingNewClientInsideOrder) {
        newClientSection.style.display = 'block';
        clientSelect.disabled = true;
        clientSelect.value = '';
        toggleBtn.innerText = 'Cancelar Novo Cadastro';
        toggleBtn.classList.remove('primary');
        toggleBtn.classList.add('danger');
    } else {
        newClientSection.style.display = 'none';
        clientSelect.disabled = false;
        toggleBtn.innerText = '+ Novo Cliente';
        toggleBtn.classList.remove('danger');
        toggleBtn.classList.add('primary');
    }
};

window.saveOrder = async function() {
    let clientNameFinal = '';

    if (isCreatingNewClientInsideOrder) {
        const name = document.getElementById('newClientName').value;
        const phone = document.getElementById('newClientPhone').value;
        const email = document.getElementById('newClientEmail').value;

        if (!name || !phone) {
            showMessage('Nome e telefone do cliente são obrigatórios!', 'Atenção');
            return;
        }

        clientNameFinal = name;
        
        // Novos campos detalhados
        const cep = document.getElementById('newClientCEP').value;
        const address = document.getElementById('newClientAddress').value;
        const number = document.getElementById('newClientNumber').value;
        const complement = document.getElementById('newClientComplement').value;

        try {
            await db.collection('clients').add({
                name, email, phone, 
                cep, address, number, complement,
                status: 'Ativo', 
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            clientNameFinal = name;
        } catch (error) {
            console.error(error);
            showMessage("Falha de rede salvando cliente. Verifique as regras do Firestore.", "Erro de Conexão");
            return;
        }

    } else {
        const selected = document.getElementById('orderClientSelect').value;
        if (!selected) {
            showMessage('Por favor, selecione um cliente na lista ou inicie um Novo Cadastro.', 'Seleção Necessária');
            return;
        }
        clientNameFinal = selected;
    }

    const deviceType = document.getElementById('orderDeviceType').value;
    const deviceModel = document.getElementById('orderDeviceModel').value;
    let deviceSerial = document.getElementById('orderDeviceSerial').value.trim();
    const issue = document.getElementById('orderIssue').value;
    
    const laborPrice = parseFloat(document.getElementById('orderLaborPrice').value) || 0;
    const partsTotal = parseFloat(document.getElementById('orderPartsTotal').value) || 0;
    const finalTotal = laborPrice + partsTotal;

    if (!deviceModel) {
        showMessage('Por favor, insira a Marca e Modelo do aparelho.', 'Dados Incompletos');
        return;
    }
    
    if (!deviceSerial) {
        deviceSerial = 'S/N';
    }

    const orderId = document.getElementById('orderId').value;
    const statusVal = document.getElementById('orderStatus').value;

    const device = `${deviceType} ${deviceModel} (SN: ${deviceSerial})`;

    const customId = `OS-${Math.floor(Math.random() * 9000) + 1000}`; 

    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')} ${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}`;

    try {
        const emitBtn = document.querySelector('.modal-footer .primary');
        if (emitBtn) emitBtn.innerText = "Salvando...";

        if (orderId) {
            const oldOrder = mockOrders.find(o => o.id === orderId);
            let exitDate = oldOrder.exitDate || null;

            // Se mudou para Entregue agora e não tinha data de saída
            if (statusVal === 'Entregue' && (!exitDate)) {
                exitDate = firebase.firestore.FieldValue.serverTimestamp();
            }

            await db.collection('orders').doc(orderId).update({
                title: device + (issue ? ` - ${issue}` : ''),
                client: clientNameFinal,
                status: statusVal || 'Aguardando Análise',
                deviceType, deviceModel, deviceSerial, issue,
                laborPrice, partsTotal,
                finalValue: finalTotal,
                estimatedValue: finalTotal, // Simplificado para usar o total
                exitDate: exitDate,
                usedParts: currentUsedParts
            });

            // Lógica de baixa de estoque se mudou para entregue
            if (statusVal === 'Entregue' && oldOrder.status !== 'Entregue') {
                for (let up of currentUsedParts) {
                    const partDoc = await db.collection('parts').doc(up.id).get();
                    if (partDoc.exists) {
                        const currentStock = partDoc.data().stock || 0;
                        await db.collection('parts').doc(up.id).update({
                            stock: Math.max(0, currentStock - 1)
                        });
                    }
                }
            }
        } else {
            await db.collection('orders').add({
                displayId: customId,
                title: device + (issue ? ` - ${issue}` : ''),
                client: clientNameFinal,
                status: 'Aguardando Análise',
                date: dateStr,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                deviceType, deviceModel, deviceSerial, issue,
                laborPrice, partsTotal,
                finalValue: finalTotal,
                estimatedValue: finalTotal,
                exitDate: null,
                usedParts: currentUsedParts
            });
        }

        const btnTodos = document.querySelector('.filter-btn[data-filter="Todos"]');
        if (btnTodos) btnTodos.click();
        
        window.closeOrderModal();
        if (emitBtn) emitBtn.innerText = "Emitir Ordem";
    } catch (error) {
        console.error(error);
        showMessage("Erro no servidor ao salvar a emissão. Verifique as permissões de acesso (Firestore rules).", "Erro no Sistema");
        const emitBtn = document.querySelector('.modal-footer .primary');
        if (emitBtn) emitBtn.innerText = "Emitir Ordem";
    }
};

window.editOrder = function(id) {
    const order = mockOrders.find(o => o.id === id);
    if (!order) return;
    
    document.getElementById('orderId').value = order.id;
    
    const clientSelect = document.getElementById('orderClientSelect');
    clientSelect.innerHTML = '<option value="">Selecione um cliente...</option>';
    let clientFound = false;
    mockClients.forEach(c => {
        clientSelect.innerHTML += `<option value="${c.name}">${c.name} - ${c.phone}</option>`;
        if (order.client === c.name) clientFound = true;
    });

    if (!clientFound && order.client) {
        clientSelect.innerHTML += `<option value="${order.client}">${order.client} (Cadastro Avulso)</option>`;
    }
    clientSelect.value = order.client;

    isCreatingNewClientInsideOrder = false;
    document.getElementById('newClientSection').style.display = 'none';

    // Suporte para ordens antigas que tinham apenas o "title"
    let defType = order.deviceType || 'TV';
    let defModel = order.deviceModel || '';
    let defSerial = order.deviceSerial || '';
    let defIssue = order.issue || '';

    if (!order.deviceModel && order.title) {
        let parts = order.title.split(' - ');
        defModel = parts[0].trim();
        if (parts.length > 1) {
            defIssue = parts.slice(1).join(' - ').trim();
        }
    }

    document.getElementById('orderDeviceType').value = defType;
    document.getElementById('orderDeviceModel').value = defModel;
    document.getElementById('orderDeviceSerial').value = defSerial;
    document.getElementById('orderIssue').value = defIssue;
    
    document.getElementById('orderLaborPrice').value = order.laborPrice || 0;
    document.getElementById('orderPartsTotal').value = (order.partsTotal || 0).toFixed(2);
    currentUsedParts = order.usedParts || [];
    window.renderOrderUsedParts();
    window.updateOrderPartSelector();
    window.calculateOrderTotal();
    
    document.getElementById('orderStatus').value = order.status || 'Aguardando Análise';
    document.getElementById('orderStatusGroup').style.display = 'block';
    document.getElementById('orderModal').querySelector('h2').innerText = `Editar Ordem: ${order.displayId}`;
    document.getElementById('orderModal').classList.add('active');
};

window.deleteOrder = async function(id) {
    showConfirm('Atenção: Tem certeza que deseja apagar permanentemente esta Ordem de Serviço?', async () => {
        try {
            await db.collection('orders').doc(id).delete();
        } catch(e) {
            console.error(e);
            showMessage("Falha ao tentar excluir a Ordem de Serviço.", "Erro");
        }
    });
};

// Global Clientes CRUD 
window.openClientModal = function() {
    document.getElementById('clientId').value = '';
    document.getElementById('clientName').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientPhoneResidential').value = '';
    
    // Novo: Reset campos de endereço
    document.getElementById('clientCEP').value = '';
    document.getElementById('clientAddress').value = '';
    document.getElementById('clientNumber').value = '';
    document.getElementById('clientComplement').value = '';
    
    // Novo: Reset Toggle de Telefone
    document.getElementById('residentialPhoneGroup').style.display = 'none';
    document.getElementById('btnAddResidential').innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Adicionar Telefone Residencial`;

    document.getElementById('clientStatus').value = 'Ativo';
    document.getElementById('clientModalTitle').innerText = 'Novo Cliente';
    document.getElementById('clientModal').classList.add('active');
};

window.closeClientModal = function() {
    document.getElementById('clientModal').classList.remove('active');
};

window.saveClient = async function() {
    const id = document.getElementById('clientId').value;
    const name = document.getElementById('clientName').value;
    const email = document.getElementById('clientEmail').value;
    const phone = document.getElementById('clientPhone').value;
    const phoneResidential = document.getElementById('clientPhoneResidential').value;
    const cep = document.getElementById('clientCEP').value;
    const address = document.getElementById('clientAddress').value;
    const number = document.getElementById('clientNumber').value;
    const complement = document.getElementById('clientComplement').value;
    const status = document.getElementById('clientStatus').value;

    if (!name || !phone) {
        showMessage('Nome e Telefone são obrigatórios!', 'Atenção');
        return;
    }

    try {
        if (id) {
            // Edit
            await db.collection('clients').doc(id).update({
                name, email, phone, status,
                phoneResidential, cep, address, number, complement
            });
        } else {
            // Create
            await db.collection('clients').add({
                name, email, phone, status, 
                phoneResidential, cep, address, number, complement,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        window.closeClientModal();
    } catch(e) {
        console.error(e);
        showMessage("Erro configurando dados na nuvem.", "Erro");
    }
};

window.editClient = function(id) {
    const client = mockClients.find(c => c.id === id);
    if (!client) return;
    
    document.getElementById('clientId').value = client.id;
    document.getElementById('clientName').value = client.name || '';
    document.getElementById('clientEmail').value = client.email || '';
    document.getElementById('clientPhone').value = client.phone || '';
    document.getElementById('clientPhoneResidential').value = client.phoneResidential || '';
    
    document.getElementById('clientCEP').value = client.cep || '';
    document.getElementById('clientAddress').value = client.address || '';
    document.getElementById('clientNumber').value = client.number || '';
    document.getElementById('clientComplement').value = client.complement || '';
    
    // Verifica se tem telefone residencial para mostrar o campo
    if (client.phoneResidential) {
        document.getElementById('residentialPhoneGroup').style.display = 'block';
        document.getElementById('btnAddResidential').innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line></svg> Remover Telefone Residencial';
    } else {
        document.getElementById('residentialPhoneGroup').style.display = 'none';
        document.getElementById('btnAddResidential').innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Adicionar Telefone Residencial';
    }

    document.getElementById('clientStatus').value = client.status || 'Ativo';
    
    document.getElementById('clientModalTitle').innerText = 'Editar Cliente';
    document.getElementById('clientModal').classList.add('active');
};

window.deleteClient = async function(id) {
    showConfirm('Tem certeza que deseja excluir este cliente permanente do banco de dados?', async () => {
        try {
            await db.collection('clients').doc(id).delete();
        } catch(e) {
            console.error(e);
            showMessage("Houve um erro para deletar na nuvem.", "Erro");
        }
    });
};

// --- FUNÇÃO GLOBAL DE MENSAGEM CONFIRMAÇÃO ---
window.showConfirm = function(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirmBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');

    msgEl.innerText = message;
    modal.classList.add('active');

    const handleConfirm = () => {
        cleanup();
        onConfirm();
    };

    const handleCancel = () => {
        cleanup();
    };

    const cleanup = () => {
        modal.classList.remove('active');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
};

// --- FUNÇÃO GLOBAL DE MENSAGEM (ALERT CUSTOMIZADO) ---
window.showMessage = function(message, title = 'Aviso', onOk = null) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirmBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');

    titleEl.innerText = title;
    msgEl.innerText = message;
    
    // Configura para modo Alerta
    cancelBtn.style.display = 'none';
    confirmBtn.innerText = 'OK';
    confirmBtn.className = 'action-btn primary';
    
    modal.classList.add('active');

    const handleOk = () => {
        cleanup();
        if (onOk) onOk();
    };

    const cleanup = () => {
        modal.classList.remove('active');
        confirmBtn.removeEventListener('click', handleOk);
        
        // Restaura padrão do confirmModal para o próximo uso
        setTimeout(() => {
            cancelBtn.style.display = 'block';
            confirmBtn.innerText = 'Confirmar';
            confirmBtn.className = 'action-btn danger';
            titleEl.innerText = 'Atenção';
        }, 300);
    };

    confirmBtn.addEventListener('click', handleOk);
};

window.handleStatusChange = function() {
    // Pode ser usado para lógica futura ao mudar status no modal
};

// --- LÓGICA FINANCEIRA ---
window.applyFinancialFilter = function() {
    window.renderFinancialTable();
};

// Declarado como função para hoisting
function renderFinancialTable() {
    const tableBody = document.getElementById('financialTableBody');
    if (!tableBody) return;

    const startDate = document.getElementById('finStartDate').value;
    const endDate = document.getElementById('finEndDate').value;
    const financialTotalEl = document.getElementById('financialTotal');
    const periodLabel = document.getElementById('financialPeriodLabel');

    tableBody.innerHTML = '';
    let totalFaturado = 0;

    // Filtra ordens que possuem data de saída (Entregues) e estão no intervalo
    let filtered = mockOrders.filter(o => o.status === 'Entregue' && o.exitDate);

    if (startDate || endDate) {
        const start = startDate ? new Date(startDate + 'T00:00:00') : null;
        const end = endDate ? new Date(endDate + 'T23:59:59') : null;

        filtered = filtered.filter(o => {
            const exitDate = o.exitDate.toDate ? o.exitDate.toDate() : new Date(o.exitDate);
            if (start && exitDate < start) return false;
            if (end && exitDate > end) return false;
            return true;
        });

        periodLabel.innerText = `Período: ${startDate || '...'} até ${endDate || '...'}`;
    } else {
        periodLabel.innerText = "Mostrando todas as ordens entregues";
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhuma ordem concluída encontrada para este período.</td></tr>`;
        financialTotalEl.innerText = `R$ 0,00`;
        return;
    }

    filtered.forEach(order => {
        const exitDate = order.exitDate.toDate ? order.exitDate.toDate() : new Date(order.exitDate);
        const exitDateStr = exitDate.toLocaleDateString('pt-BR') + ' ' + exitDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
        
        // Lógica de Garantia (3 dias = 72 horas)
        const now = new Date();
        const diffTime = Math.abs(now - exitDate);
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        const inWarranty = diffDays <= 3;
        
        totalFaturado += (order.finalValue || 0);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight: 500;">${order.title}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${order.displayId}</div>
            </td>
            <td>${order.client}</td>
            <td><span class="status-badge completed">${order.status}</span></td>
            <td>${exitDateStr}</td>
            <td style="font-weight: 600; color: var(--success);">R$ ${(order.finalValue || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            <td>
                ${inWarranty 
                    ? '<span class="status-badge progress" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">Válida</span>' 
                    : '<span class="status-badge" style="background: #f3f4f6; color: #9ca3af;">Expirada</span>'}
            </td>
            <td>
                <button class="action-btn" onclick="activateWarranty('${order.id}')" style="padding: 4px 8px; font-size: 12px;">
                    Retorno / Garantia
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    financialTotalEl.innerText = `R$ ${totalFaturado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}
window.renderFinancialTable = renderFinancialTable;

window.activateWarranty = function(id) {
    showConfirm('Deseja acionar o retorno desta OS? O status voltará para "Em Reparo".', async () => {
        try {
            await db.collection('orders').doc(id).update({
                status: 'Em Reparo',
                // Mantemos o valor final como histórico, mas o técnico pode mudar ao finalizar de novo
                warrantyActivated: true,
                returnDate: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch(e) {
            console.error(e);
            showMessage("Erro ao acionar garantia.", "Erro");
        }
    });
};

// --- GESTÃO DE EQUIPE (EXCLUSIVO ADM) ---
window.openStaffModal = function() {
    document.getElementById('staffName').value = '';
    document.getElementById('staffEmail').value = '';
    document.getElementById('staffPassword').value = '';
    document.getElementById('staffTag').value = 'worker';
    document.getElementById('staffModal').classList.add('active');
};

window.closeStaffModal = function() {
    document.getElementById('staffModal').classList.remove('active');
};

window.saveStaff = async function() {
    const name = document.getElementById('staffName').value;
    const email = document.getElementById('staffEmail').value;
    const password = document.getElementById('staffPassword').value;
    const tag = document.getElementById('staffTag').value;

    if (!name || !email || !password) {
        showMessage("Todos os campos são obrigatórios!", "Atenção");
        return;
    }

    const btn = document.getElementById('btnSaveStaff');
    btn.innerText = "Criando...";
    btn.disabled = true;

    try {
        // Técnica de App Secundário para não deslogar o Admin atual
        const secondaryApp = firebase.initializeApp(firebaseConfig, "SecondaryApp");
        const res = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
        const uid = res.user.uid;

        // Salva dados no Firestore
        await db.collection('users').doc(uid).set({
            name,
            email,
            tag,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await secondaryApp.delete();
        showMessage("Funcionário cadastrado com sucesso!", "Sucesso");
        closeStaffModal();
    } catch (e) {
        console.error(e);
        showMessage("Erro ao criar funcionário: " + e.message, "Erro");
    } finally {
        btn.innerText = "Criar Acesso";
        btn.disabled = false;
    }
};

window.renderStaffTable = function() {
    const tableBody = document.getElementById('staffTableBody');
    if (!tableBody) return;

    db.collection('users').onSnapshot((snapshot) => {
        tableBody.innerHTML = '';
        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum funcionário encontrado no banco de dados.</td></tr>`;
            return;
        }
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 500;">${data.name}</td>
                <td>${data.email}</td>
                <td><span class="status-badge ${data.tag === 'adm' ? 'completed' : 'progress'}">${data.tag.toUpperCase()}</span></td>
                <td>
                    <button class="icon-btn delete" onclick="deleteStaff('${id}', '${data.email}')" title="Remover Acesso">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    });
};

window.deleteStaff = function(uid, email) {
    if (email === 'rstarkadm@gmail.com') {
        showMessage("A conta master não pode ser removida!", "Privilégio Negado");
        return;
    }
    showConfirm(`Deseja remover o acesso de ${email}?`, async () => {
        try {
            await db.collection('users').doc(uid).delete();
            showMessage("Acesso revogado!", "Sucesso");
        } catch(e) {
            console.error(e);
            showMessage("Erro ao remover.", "Erro");
        }
    });
};

// Inicia listagem de equipe ao carregar para o Admin
document.addEventListener('DOMContentLoaded', () => {
    // delay pequeno para garantir que o auth carregou
    setTimeout(() => {
        const staffTable = document.getElementById('staffTable');
        if (staffTable) window.renderStaffTable();
    }, 1000);
});

// --- GESTÃO DE PEÇAS ---
// Declarado como função para hoisting
function renderPartsTable() {
    const tableBody = document.getElementById('partsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (mockParts.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma peça cadastrada.</td></tr>`;
        return;
    }

    mockParts.forEach(part => {
        const isOutOfStock = (part.stock || 0) <= 0;
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (!e.target.closest('.table-actions')) editPart(part.id);
        };

        tr.innerHTML = `
            <td>
                <div style="font-weight: 500;">${part.name}</div>
                <div class="mobile-date-info" style="display: none; font-size: 11px; color: var(--text-muted); margin-top: 4px;">
                    ${part.model} | R$ ${(part.price || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </div>
            </td>
            <td>${part.model}</td>
            <td>R$ ${(part.price || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
            <td>
                <span class="status-badge ${isOutOfStock ? 'pending' : 'completed'}">
                    ${part.stock || 0} un.
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="icon-btn edit" onclick="event.stopPropagation(); editPart('${part.id}')"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                    ${currentUserTag === 'adm' ? `
                    <button class="icon-btn delete" onclick="event.stopPropagation(); deletePart('${part.id}')"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    ` : ''}
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}
window.renderPartsTable = renderPartsTable;

window.openPartModal = function() {
    document.getElementById('partId').value = '';
    document.getElementById('partName').value = '';
    document.getElementById('partModel').value = '';
    document.getElementById('partPrice').value = '';
    document.getElementById('partStock').value = '';
    document.getElementById('partModalTitle').innerText = 'Nova Peça';
    document.getElementById('partModal').classList.add('active');
};

window.closePartModal = function() {
    document.getElementById('partModal').classList.remove('active');
};

window.savePart = async function() {
    const id = document.getElementById('partId').value;
    const name = document.getElementById('partName').value;
    const model = document.getElementById('partModel').value;
    const price = parseFloat(document.getElementById('partPrice').value) || 0;
    const stock = parseInt(document.getElementById('partStock').value) || 0;

    if (!name || !model) {
        showMessage("Nome e Modelo são obrigatórios!", "Atenção");
        return;
    }

    try {
        if (id) {
            await db.collection('parts').doc(id).update({ name, model, price, stock });
        } else {
            await db.collection('parts').add({ name, model, price, stock, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
        window.closePartModal();
    } catch(e) {
        console.error(e);
        showMessage("Erro ao salvar peça.", "Erro");
    }
};

window.editPart = function(id) {
    const part = mockParts.find(p => p.id === id);
    if (!part) return;
    document.getElementById('partId').value = part.id;
    document.getElementById('partName').value = part.name;
    document.getElementById('partModel').value = part.model;
    document.getElementById('partPrice').value = part.price;
    document.getElementById('partStock').value = part.stock;
    document.getElementById('partModalTitle').innerText = 'Editar Peça';
    document.getElementById('partModal').classList.add('active');
};

window.deletePart = function(id) {
    showConfirm('Excluir esta peça permanentemente do estoque?', async () => {
        await db.collection('parts').doc(id).delete();
    });
};

// --- LÓGICA DE SELEÇÃO DE PEÇAS NA OS ---
window.updateOrderPartSelector = function() {
    const selector = document.getElementById('orderPartSelector');
    if (!selector) return;
    selector.innerHTML = '<option value="">Escolha uma peça do estoque...</option>';
    mockParts.forEach(p => {
        if (p.stock > 0) {
            selector.innerHTML += `<option value="${p.id}">${p.name} (${p.model}) - R$ ${p.price.toFixed(2)}</option>`;
        }
    });
};

window.addPartToOrder = function() {
    const partId = document.getElementById('orderPartSelector').value;
    if (!partId) return;
    const part = mockParts.find(p => p.id === partId);
    if (!part) return;

    currentUsedParts.push({ id: part.id, name: part.name, price: part.price });
    window.renderOrderUsedParts();
    window.calculateOrderTotal();
    document.getElementById('orderPartSelector').value = '';
};

window.removePartFromOrder = function(index) {
    currentUsedParts.splice(index, 1);
    window.renderOrderUsedParts();
    window.calculateOrderTotal();
};

window.renderOrderUsedParts = function() {
    const list = document.getElementById('orderUsedPartsList');
    if (!list) return;
    list.innerHTML = '';
    let total = 0;

    currentUsedParts.forEach((p, index) => {
        total += p.price;
        const li = document.createElement('li');
        li.style = "display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; border-radius: 6px; font-size: 14px; border: 1px solid var(--border);";
        li.innerHTML = `
            <span>${p.name} - <b>R$ ${p.price.toFixed(2)}</b></span>
            <button onclick="removePartFromOrder(${index})" style="background: none; border: none; color: #ef4444; cursor: pointer;">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        list.appendChild(li);
    });

    document.getElementById('orderPartsTotal').value = total.toFixed(2);
};

window.calculateOrderTotal = function() {
    const labor = parseFloat(document.getElementById('orderLaborPrice').value) || 0;
    const parts = parseFloat(document.getElementById('orderPartsTotal').value) || 0;
    const total = labor + parts;
    document.getElementById('orderTotalDisplay').innerText = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
};

// --- RELATÓRIO PDF TEXTO ---
window.exportDetailedReport = function() {
    let report = `RELATÓRIO DETALHADO RSTARK - ${new Date().toLocaleDateString('pt-BR')}\n`;
    report += "------------------------------------------------------------\n\n";
    
    report += "RESUMO DE ORDENS DE SERVIÇO\n";
    let lucroTotal = 0;
    mockOrders.forEach(o => {
        report += `[${o.displayId}] ${o.client}\n`;
        report += ` - Aparelho: ${o.deviceModel || o.title}\n`;
        report += ` - Mão de Obra: R$ ${(o.laborPrice || 0).toFixed(2)}\n`;
        report += ` - Peças: R$ ${(o.partsTotal || 0).toFixed(2)}\n`;
        report += ` - Total: R$ ${(o.finalValue || 0).toFixed(2)}\n`;
        report += ` - Status: ${o.status}\n\n`;
        if (o.status === "Entregue") lucroTotal += (o.finalValue || 0);
    });
    
    report += `\n>> FATURAMENTO TOTAL CONCLUÍDO: R$ ${lucroTotal.toFixed(2)}\n`;
    report += "------------------------------------------------------------\n\n";
    
    report += "ALERTAS DE ESTOQUE (PRODUTOS ESGOTADOS)\n";
    const outOfStock = mockParts.filter(p => p.stock <= 0);
    if (outOfStock.length === 0) {
        report += "Tudo em dia! Nenhuma peça zerada.\n";
    } else {
        outOfStock.forEach(p => {
            report += `⚠️ PRECISA COMPRAR: ${p.name} (Mod: ${p.model})\n`;
        });
    }
    
    report += "\n\nObrigado por usar o sistema Rstark.";

    // Gera o Download como arquivo de texto detalhado
    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatorio_Detalhado_Rstark_${Date.now()}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    showMessage("Relatório gerado e baixado como arquivo de texto detalhado!", "Relatório Pronto");
};

// Substituir o botão de relatório original para chamar o novo
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const reportBtn = document.querySelector('.action-btn[data-auth="adm"]');
        if (reportBtn) {
            reportBtn.setAttribute('onclick', 'exportDetailedReport()');
        }
    }, 1500);
});

// --- LÓGICA DE CEP E TELEFONE ---
window.lookupCEP = function(cepValue, prefix) {
    const cep = cepValue.replace(/\D/g, '');
    if (cep.length !== 8) return;

    fetch(`https://viacep.com.br/ws/${cep}/json/`)
        .then(res => res.json())
        .then(data => {
            if (!data.erro) {
                const addrField = prefix === 'client' ? 'clientAddress' : 'newClientAddress';
                document.getElementById(addrField).value = data.logradouro;
                
                // Foca no número após preencher rua
                const numField = prefix === 'client' ? 'clientNumber' : 'newClientNumber';
                document.getElementById(numField).focus();
            }
        })
        .catch(err => console.error("Erro ao buscar CEP:", err));
};

window.toggleResidentialPhone = function(prefix) {
    const group = document.getElementById('residentialPhoneGroup');
    const btn = document.getElementById('btnAddResidential');
    const isVisible = group.style.display === 'block';

    if (isVisible) {
        group.style.display = 'none';
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Adicionar Telefone Residencial';
        document.getElementById('clientPhoneResidential').value = '';
    } else {
        group.style.display = 'block';
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><line x1="5" y1="12" x2="19" y2="12"></line></svg> Remover Telefone Residencial';
        document.getElementById('clientPhoneResidential').focus();
    }
};
