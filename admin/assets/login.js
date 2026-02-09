// admin/assets/login.js
(async function () {
  const ABC = window.__ABC;
  const { supabase, showLoading, hideLoading, showInlineError, bumpLoopGuard, getSession, clearAuth } = ABC;

  const form = document.getElementById("loginForm");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");

  // quebra loop se estiver voltando e vindo
  const loops = bumpLoopGuard();
  if (loops >= 6) {
    await clearAuth();
    hideLoading();
    showInlineError("Detectei um loop de login. Sessão limpa. Recarregue a página e tente novamente.");
    return;
  }

  togglePassword?.addEventListener("click", () => {
    if (!password) return;
    password.type = password.type === "password" ? "text" : "password";
  });

  // Checa sessão existente
  showLoading("Carregando…");
  try {
    const session = await getSession();
    if (session) {
      // já autenticado -> dashboard
      window.location.replace("/admin/dashboard.html");
      return;
    }
  } catch (e) {
    console.error(e);
    showInlineError("Falha ao verificar sessão. Verifique se os arquivos /admin/assets/*.js estão atualizados.");
  } finally {
    hideLoading();
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const em = (email?.value || "").trim();
    const pw = password?.value || "";

    if (!em || !pw) {
      showInlineError("Preencha email e senha.");
      return;
    }

    showLoading("Entrando…");
    try {
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email: em, password: pw }),
        ABC.timeoutPromise(8000, "Timeout no login (signInWithPassword).")
      ]);

      if (error || !data?.session) {
        showInlineError("Credenciais inválidas ou usuário sem permissão.");
        return;
      }

      window.location.replace("/admin/dashboard.html");
    } catch (e2) {
      console.error(e2);
      showInlineError(e2?.message || "Falha no login.");
    } finally {
      hideLoading();
    }
  });
})();
