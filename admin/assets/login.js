// admin/assets/login.js
(function () {
  const hint = document.getElementById("hint");
  const form = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const togglePass = document.getElementById("togglePass");
  const passwordInput = document.getElementById("password");

  function setHint(msg) {
    hint.textContent = msg || "";
  }

  // Config + Supabase client
  const cfg = window.ABC_ADMIN_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    setHint("Config do Supabase ausente. Confira admin/assets/config.js");
    return;
  }

  const supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // Se já está logado, vai direto
  supabase.auth.getSession().then(({ data }) => {
    if (data && data.session) {
      window.location.href = "./dashboard.html";
    }
  });

  togglePass.addEventListener("click", () => {
    passwordInput.type = passwordInput.type === "password" ? "text" : "password";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setHint("");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    loginBtn.textContent = "Entrando...";

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        setHint(error?.message || "Falha no login.");
        return;
      }
      window.location.href = "./dashboard.html";
    } catch (err) {
      setHint("Erro inesperado no login.");
      console.error(err);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Entrar";
    }
  });
})();
