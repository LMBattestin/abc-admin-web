// admin/assets/dashboard.js
(async function () {
  const ABC = window.__ABC;
  const { showLoading, hideLoading, showInlineError, bumpLoopGuard, getSession, clearAuth, supabase } = ABC;

  const userNameEl = document.getElementById("userName");
  const logoutBtn = document.getElementById("logoutBtn");
  const content = document.getElementById("contentPlaceholder");

  // anti-loop
  const loops = bumpLoopGuard();
  if (loops >= 6) {
    await clearAuth();
    hideLoading();
    showInlineError("Detectei um loop entre login/dashboard. Sessão limpa. Voltando para o login…");
    setTimeout(() => window.location.replace("/admin/"), 700);
    return;
  }

  // IMPORTANTÍSSIMO: não deixa loader infinito aqui.
  hideLoading();

  // Auth gate (sem loader por padrão)
  let session = null;
  try {
    session = await getSession();
  } catch (e) {
    console.error(e);
    showInlineError("Falha ao verificar sessão no dashboard. Pode ser cache/arquivos antigos em produção.");
    return;
  }

  if (!session) {
    window.location.replace("/admin/");
    return;
  }

  userNameEl.textContent = session.user?.email || "Administrador";

  // UI (software/tabs)
  document.querySelectorAll(".software-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".software-btn").forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      updateContent();
    });
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      updateContent();
    });
  });

  logoutBtn?.addEventListener("click", async () => {
    showLoading("Saindo…");
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    } finally {
      window.location.replace("/admin/");
    }
  });

    function updateContent() {
    const software = document.querySelector(".software-btn.active")?.getAttribute("data-software") || "";
    const dept = document.querySelector(".tab-btn.active")?.getAttribute("data-department") || "";

    const usersView = document.getElementById("users-view");
    const placeholder = document.getElementById("placeholder-view");

    // ORE + USUÁRIOS => tabela real
    if (software === "ore" && dept === "usuarios") {
        if (typeof window.ABC_LOAD_USERS_VIEW === "function") {
        window.ABC_LOAD_USERS_VIEW();
        return;
        }
    }

    // fallback placeholder
    usersView.classList.add("hidden");
    placeholder.classList.remove("hidden");

    const softwareLabel = software ? software.toUpperCase() : "—";
    const deptLabel = dept ? dept.toUpperCase() : "—";

    placeholder.innerHTML = `
        <div class="placeholder-icon"><i class="fas fa-folder-open"></i></div>
        <h2 class="placeholder-title">${softwareLabel} - ${deptLabel}</h2>
        <p class="placeholder-text">Conteúdo para <strong>${softwareLabel}</strong> em <strong>${deptLabel}</strong> será carregado aqui.</p>
    `;
    }
})();
