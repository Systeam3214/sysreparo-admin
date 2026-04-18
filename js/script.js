// Configuração do Firebase (Deve ser a mesma do dashboard.js)
const firebaseConfig = {
    apiKey: "AIzaSyDUbFlJpP894ergBQoxaXJHttFyDfrYYd4",
    authDomain: "sysreparo-admin.firebaseapp.com",
    projectId: "sysreparo-admin",
    storageBucket: "sysreparo-admin.firebasestorage.app",
    messagingSenderId: "675962211650",
    appId: "1:675962211650:web:5f429a4a72d8ad8a6b0cdb",
    measurementId: "G-XGPL9M66VR"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Hashing para segurança offline
async function hashCredentials(email, password) {
    const msgUint8 = new TextEncoder().encode(email.toLowerCase().trim() + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const loginForm = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnSpan = submitBtn.querySelector('span');
    const rememberMe = document.getElementById('rememberMe');

    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
        
        if (isPassword) {
            togglePasswordBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>`;
        } else {
            togglePasswordBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>`;
        }
    });

    // Form Submission Real Firebase Auth
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const emailVal = document.getElementById('email').value.toLowerCase().trim();
        const passVal = document.getElementById('password').value;
        const isOnline = navigator.onLine;
        
        submitBtn.classList.add('loading');
        
        // --- FLUXO OFFLINE ---
        if (!isOnline) {
            console.log("Tentando login offline...");
            const hash = await hashCredentials(emailVal, passVal);
            const savedCreds = JSON.parse(localStorage.getItem('rstark_offline_creds') || '{}');
            
            if (savedCreds[hash]) {
                // Sucesso Offline: Salva sessão temporária e redireciona
                localStorage.setItem('rstark_current_offline_session', JSON.stringify(savedCreds[hash]));
                submitBtn.style.backgroundColor = '#10b981';
                setTimeout(() => window.location.href = 'dashboard.html', 800);
                return;
            } else {
                // Falha Offline
                submitBtn.classList.remove('loading');
                submitBtn.style.backgroundColor = '#ef4444';
                btnSpan.textContent = 'Credenciais offline não encontradas';
                setTimeout(() => {
                    submitBtn.style.backgroundColor = '';
                    btnSpan.textContent = 'Entrar no Sistema';
                }, 2500);
                return;
            }
        }

        // --- FLUXO ONLINE ---
        try {
            const persistence = rememberMe.checked 
                ? firebase.auth.Auth.Persistence.LOCAL 
                : firebase.auth.Auth.Persistence.SESSION;
            
            await auth.setPersistence(persistence);
            const userCredential = await auth.signInWithEmailAndPassword(emailVal, passVal);
            const user = userCredential.user;

            // Se logou com sucesso e "rememberMe" está ativo, salva hash para uso offline
            if (rememberMe.checked) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const profileData = userDoc.exists ? userDoc.data() : { name: user.displayName || 'Técnico', tag: 'worker' };
                    
                    const hash = await hashCredentials(emailVal, passVal);
                    const savedCreds = JSON.parse(localStorage.getItem('rstark_offline_creds') || '{}');
                    
                    // Salva o "combustível" para o dashboard offline
                    savedCreds[hash] = {
                        uid: user.uid,
                        email: emailVal,
                        name: profileData.name || user.email,
                        tag: profileData.tag || 'worker'
                    };
                    
                    localStorage.setItem('rstark_offline_creds', JSON.stringify(savedCreds));
                    localStorage.removeItem('rstark_current_offline_session'); // Limpa bypass antigo
                } catch (err) {
                    console.warn("Erro ao salvar credenciais offline:", err);
                }
            }
            
            submitBtn.style.backgroundColor = '#10b981';
            setTimeout(() => window.location.href = 'dashboard.html', 800);

        } catch (error) {
            console.error("Erro no login:", error);
            submitBtn.classList.remove('loading');
            submitBtn.style.backgroundColor = '#ef4444';
            btnSpan.style.opacity = '1';
            
            let errorMsg = 'Erro ao acessar!';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials') {
                errorMsg = 'E-mail ou senha incorretos';
            } else if (error.code === 'auth/invalid-email') {
                errorMsg = 'E-mail inválido';
            }
            
            btnSpan.textContent = errorMsg;
            setTimeout(() => {
                submitBtn.style.backgroundColor = '';
                btnSpan.textContent = 'Entrar no Sistema';
                document.getElementById('password').value = '';
            }, 2500);
        }
    });

    // --- ESQUECEU A SENHA ---
    const forgotModal = document.getElementById('forgotModal');
    const forgotLink = document.getElementById('forgotPasswordLink');
    const closeForgotBtn = document.getElementById('closeForgotModal');
    const sendResetBtn = document.getElementById('sendResetBtn');
    const forgotEmail = document.getElementById('forgotEmail');
    const forgotFeedback = document.getElementById('forgotFeedback');

    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Preenche automaticamente com o e-mail já digitado no login
        const emailInput = document.getElementById('email').value;
        if (emailInput) forgotEmail.value = emailInput;
        
        forgotFeedback.className = 'forgot-feedback';
        forgotFeedback.textContent = '';
        forgotModal.classList.add('active');
    });

    closeForgotBtn.addEventListener('click', () => {
        forgotModal.classList.remove('active');
    });

    // Fechar ao clicar fora do modal
    forgotModal.addEventListener('click', (e) => {
        if (e.target === forgotModal) {
            forgotModal.classList.remove('active');
        }
    });

    sendResetBtn.addEventListener('click', async () => {
        const email = forgotEmail.value.trim();
        
        if (!email) {
            forgotFeedback.className = 'forgot-feedback error';
            forgotFeedback.textContent = 'Por favor, digite seu e-mail.';
            return;
        }

        sendResetBtn.classList.add('loading');

        try {
            await auth.sendPasswordResetEmail(email);
            
            sendResetBtn.classList.remove('loading');
            forgotFeedback.className = 'forgot-feedback success';
            forgotFeedback.textContent = '✓ E-mail de recuperação enviado! Verifique sua caixa de entrada e spam.';
            
            // Fecha o modal após 4 segundos
            setTimeout(() => {
                forgotModal.classList.remove('active');
            }, 4000);

        } catch (error) {
            console.error("Erro ao enviar reset:", error);
            sendResetBtn.classList.remove('loading');
            
            let msg = 'Erro ao enviar e-mail de recuperação.';
            if (error.code === 'auth/user-not-found') {
                msg = 'Nenhuma conta encontrada com este e-mail.';
            } else if (error.code === 'auth/invalid-email') {
                msg = 'E-mail inválido. Verifique e tente novamente.';
            } else if (error.code === 'auth/too-many-requests') {
                msg = 'Muitas tentativas. Aguarde alguns minutos.';
            }
            
            forgotFeedback.className = 'forgot-feedback error';
            forgotFeedback.textContent = msg;
        }
    });

    // Enter no input do modal dispara o envio
    forgotEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendResetBtn.click();
        }
    });

    // --- COOKIE CONSENT ---
    const cookieBanner = document.getElementById('cookieBanner');
    const acceptCookiesBtn = document.getElementById('acceptCookies');

    if (cookieBanner && acceptCookiesBtn) {
        const cookiesAccepted = localStorage.getItem('cookiesAccepted');
        
        if (!cookiesAccepted) {
            cookieBanner.style.display = 'block';
        }

        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem('cookiesAccepted', 'true');
            cookieBanner.style.opacity = '0';
            setTimeout(() => {
                cookieBanner.style.display = 'none';
            }, 500);
        });
    }
});
