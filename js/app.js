// ============================================
// TaskFlow — App Entry Point
// Bootstraps auth state and shows the right screen
// ============================================

let authMode = 'login';

function switchTab(mode) {
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('active',  mode === 'login');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('auth-submit').textContent = mode === 'login' ? 'Sign in' : 'Create account';
  document.getElementById('auth-error').textContent = '';
}

async function submitAuth() {
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl    = document.getElementById('auth-error');
  const btn      = document.getElementById('auth-submit');
  if (!email || !password) { errEl.textContent = 'Please enter email and password.'; return; }
  btn.textContent = 'Please wait…';
  btn.disabled = true;
  errEl.textContent = '';
  try {
    if (authMode === 'login') {
      await Auth.signIn(email, password);
    } else {
      await Auth.signUp(email, password);
      errEl.style.color = 'var(--green)';
      errEl.textContent = 'Account created! Check your email to confirm, then sign in.';
      switchTab('login');
    }
  } catch (e) {
    errEl.style.color = 'var(--red)';
    errEl.textContent = e.message;
  }
  btn.textContent = authMode === 'login' ? 'Sign in' : 'Create account';
  btn.disabled = false;
}

// Allow Enter key in auth form
document.getElementById('auth-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitAuth();
});

// Auth state listener — routes between screens
Auth.onAuthChange(async user => {
  document.getElementById('loading-screen').style.display = 'none';
  if (user) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-shell').style.display   = 'flex';
    await UI.init();
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('app-shell').style.display   = 'none';
  }
});