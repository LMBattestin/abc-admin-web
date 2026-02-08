// admin/assets/app.js

const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout");
const togglePassword = document.getElementById("toggle-password");
const passwordInput = document.getElementById("login-password");
const emailInput = document.getElementById("login-email");

const loginError = document.getElementById("login-error");
const userLabel = document.getElementById("user-label");

const loading = document.getElementById("loading");

// --- UI helpers
function showLoading(msg = "Sincronizando...") {
  loading.querySelector(".loading-text").textContent = msg;
  loading.classList.remove("hidden");
  document.body.classList.add("blurred");
}

function hideLoading() {
  loading.classList.add("hidden");
  document.body.classList.remove("blurred");
}

function showLogin() {
  app.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

function showApp() {
  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");
}

function setError(msg) {
  if (!msg) {
    loginError.classList.add("hidden");
    loginError.textContent = "";
    return;
  }
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}

// --- Supabase init (PRODUÇÃO)
const CFG = window.ABC_ADMIN_CONFIG;

if (!CFG || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
  // Mostra erro VISÍVEL (sem tela preta)
  document.body.innerHTML = `
    <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6f8;font-family:Arial;text-align:center;padding:24px;">
      <div style="max-width:520px;background:#fff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.12);padding:28px;">
        <h2 style="margin:0 0 10px;color:#991b1b;">Config do Supabase ausente</h2>
        <p style="margin:0;color:#334155;line-height:1.4;">
          O arquivo <b>/admin/assets/config.js</b> não está carregando ou está incompleto.
        </p>
      </div>
    </div>
  `;
  throw new Error("Supabase config ausente (ABC_ADMIN_CONFIG)");
}

if (!window.supabase || !window.supabase.createClient) {
  document.body.innerHTML = `
    <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6f8;font-family:Arial;text-align:center;padding:24px;">
      <div style="max-width:520px;background:#fff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.12);padding:28px;">
        <h2 style="margin:0 0 10px;color:#991b1b;">SDK do Supabase não carregou</h2>
        <p style="margin:0;color:#334155;line-height:1.4;">
          Verifique se o script CDN do Supabase está presente antes do <b>app.js</b>.
        </p>
      </div>
    </div>
  `;
  throw new Error("Supabase SDK ausente");
}

const supabaseClient = window.supabase.createClient(
  CFG.SUPABASE_URL,
  CFG.SUPABASE_ANON_KEY
);

// --- Events
togglePassword.onclick = () => {
  passwordInput.type = passwordInput.type === "password" ? "text" : "password";
};

loginBtn.onclick = async () => {
  setError("");
  const email = (emailInput.value || "").trim();
  const password = passwordInput.value || "";

  if (!email || !password) {
    setError("Preencha email e senha.");
    return;
  }

  showLoading("Entrando...");

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Credenciais inválidas.");
      showLogin();
      return;
    }

    const userEmail = data?.user?.email || email;
    userLabel.textContent = userEmail;

    showApp();
  } catch (e) {
    setError("Falha ao conectar. Tente novamente.");
    showLogin();
  } finally {
    hideLoading();
  }
};

logoutBtn.onclick = async () => {
  showLoading("Saindo...");
  try {
    await supabaseClient.auth.signOut();
  } finally {
    hideLoading();
    userLabel.textContent = "—";
    showLogin();
  }
};

// --- Boot: se já estiver logado, entra direto
(async function boot() {
  showLoading("Carregando...");

  try {
    const { data } = await supabaseClient.auth.getSession();
    const session = data?.session;

    if (session?.user?.email) {
      userLabel.textContent = session.user.email;
      showApp();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  } finally {
    hideLoading();
  }
})();
