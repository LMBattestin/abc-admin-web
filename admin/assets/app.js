const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout');
const togglePassword = document.getElementById('toggle-password');
const passwordInput = document.getElementById('login-password');

loginBtn.onclick = () => {
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
};

logoutBtn.onclick = () => {
  app.classList.add('hidden');
  loginScreen.classList.remove('hidden');
};

togglePassword.onclick = () => {
  passwordInput.type =
    passwordInput.type === 'password' ? 'text' : 'password';
};
