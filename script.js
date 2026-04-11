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
            await auth.signInWithEmailAndPassword(emailVal, passVal);
            
            // Success State
            submitBtn.classList.remove('loading');
            submitBtn.style.backgroundColor = '#10b981'; // Green success
            btnSpan.style.opacity = '1';
            btnSpan.textContent = 'Sucesso! Redirecionando...';
            
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
});
