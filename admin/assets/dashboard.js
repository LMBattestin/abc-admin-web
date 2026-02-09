// admin/assets/dashboard.js
(async function () {
  const { supabase, showLoading, hideLoading, requireSessionOrRedirect } = window.__ABC;

  const userNameEl = document.getElementById("userName");
  const logoutBtn = document.getElementById("logoutBtn");
  const content = document.getElementById("contentPlaceholder");

  // Auth gate
  showLoading("Carregando…");
  const session = await requireSessionOrRedirect("/admin/");
  if (!session) return;
  hideLoading();

  userNameEl.textContent = session.user?.email || "Administrador";

  // UI interactions (igual seu base)
  document.querySelectorAll('.software-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.software-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      updateContent();
    });
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      updateContent();
    });
  });

  logoutBtn.addEventListener("click", async () => {
    showLoading("Saindo…");
    try { await supabase.auth.signOut(); }
    finally { window.location.replace("/admin/"); }
  });

  function updateContent() {
    const software = document.querySelector('.software-btn.active')?.getAttribute('data-software')?.toUpperCase() || "—";
    const dept = document.querySelector('.tab-btn.active')?.getAttribute('data-department')?.toUpperCase() || "—";

    content.innerHTML = `
      <div class="placeholder-icon"><i class="fas fa-folder-open"></i></div>
      <h2 class="placeholder-title">${software} - ${dept}</h2>
      <p class="placeholder-text">Conteúdo para <strong>${software}</strong> em <strong>${dept}</strong> será carregado aqui.</p>
    `;
  }
})();
