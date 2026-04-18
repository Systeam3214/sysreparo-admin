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
        
        const emailVal = document.getElementById('email').value;
        const passVal = document.getElementById('password').value;
        
        // Add loading state
        submitBtn.classList.add('loading');
        
        try {
            // Lembrar-me: LOCAL mantém logado mesmo fechando o browser
            // SESSION desloga quando fecha o browser
            const persistence = rememberMe.checked 
                ? firebase.auth.Auth.Persistence.LOCAL 
                : firebase.auth.Auth.Persistence.SESSION;
            
            await auth.setPersistence(persistence);
            await auth.signInWithEmailAndPassword(emailVal, passVal);
            
            // Success State
            submitBtn.style.backgroundColor = '#10b981'; // Green success
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);

        } catch (error) {
            console.error("Erro no login:", error);
            // Error State
            submitBtn.classList.remove('loading');
            submitBtn.style.backgroundColor = '#ef4444'; // Red error
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
