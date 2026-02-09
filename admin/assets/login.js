// admin/assets/login.js
(async function () {
  const { supabase, showLoading, hideLoading, getSession } = window.__ABC;

  const form = document.getElementById("loginForm");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");
  const err = document.getElementById("err");

  function setErr(msg) {
    if (!msg) {
      err.classList.add("hidden");
      err.textContent = "";
      return;
    }
    err.textContent = msg;
    err.classList.remove("hidden");
  }

  // Se já estiver logado, vai direto pro dashboard
  showLoading("Carregando…");
  try {
    const session = await getSession();
    if (session) {
      window.location.replace("/admin/dashboard.html");
      return;
    }
  } finally {
    hideLoading();
  }

  togglePassword.addEventListener("click", () => {
    password.type = password.type === "password" ? "text" : "password";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setErr("");

    const em = (email.value || "").trim();
    const pw = password.value || "";
    if (!em || !pw) {
      setErr("Preencha email e senha.");
      return;
    }

    showLoading("Entrando…");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (error || !data?.session) {
        setErr("Credenciais inválidas.");
        return;
      }
      window.location.replace("/admin/dashboard.html");
    } finally {
      hideLoading();
    }
  });
})();
