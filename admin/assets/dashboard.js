// admin/assets/dashboard.js
(async function () {
  const { supabase, cfg, showLoading, hideLoading, requireSessionOrRedirect } = window.__ABC;

  const userName = document.getElementById("user-name");
  const logout = document.getElementById("logout");

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const projects = Array.from(document.querySelectorAll(".side-project"));

  const tbody = document.getElementById("users-body");
  const q = document.getElementById("q");
  const empty = document.getElementById("empty");
  const fatal = document.getElementById("fatal");
  const panelTitle = document.getElementById("panel-title");

  function setFatal(msg) {
    if (!msg) {
      fatal.classList.add("hidden");
      fatal.textContent = "";
      return;
    }
    fatal.textContent = msg;
    fatal.classList.remove("hidden");
  }

  function fmtCNPJ(v) {
    const s = String(v || "").replace(/\D/g, "").slice(0, 14);
    if (s.length !== 14) return v || "";
    return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`;
  }
  function maskEmail(v) {
    const s = String(v || "");
    const [a, b] = s.split("@");
    if (!a || !b) return s;
    if (a.length <= 2) return `**@${b}`;
    return `${a.slice(0,2)}***@${b}`;
  }
  function maskPhone(v) {
    const s = String(v || "").replace(/\D/g, "");
    if (s.length < 10) return v || "";
    const ddd = s.slice(0,2);
    const mid = s.length === 11 ? s.slice(2,7) : s.slice(2,6);
    const end = s.length === 11 ? s.slice(7,11) : s.slice(6,10);
    return `(${ddd}) ${mid}-${end}`;
  }
  function fmtDate(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  }

  function row(u) {
    // Ajuste os campos aqui conforme sua tabela real
    const name = u.name ?? u.nome ?? "";
    const cnpj = u.cnpj ?? "";
    const razao = u.company_name ?? u.razao_social ?? u.razaoSocial ?? "";
    const email = u.email ?? "";
    const phone = u.phone ?? u.telefone ?? "";
    const credits = u.credits ?? u.creditos ?? 0;
    const created = u.created_at ?? u.createdAt ?? "";
    const lastLogin = u.last_login ?? u.lastLogin ?? "";

    return `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(fmtCNPJ(cnpj))}</td>
        <td>${escapeHtml(razao)}</td>
        <td>${escapeHtml(maskEmail(email))}</td>
        <td>${escapeHtml(maskPhone(phone))}</td>
        <td>${escapeHtml(String(credits))}</td>
        <td>${escapeHtml(fmtDate(created))}</td>
        <td>${escapeHtml(fmtDate(lastLogin))}</td>
        <td class="actions">
          <button class="btn-ghost small" data-act="edit" data-id="${u.id ?? ""}">Editar</button>
          <button class="btn-ghost danger small" data-act="del" data-id="${u.id ?? ""}">Excluir</button>
        </td>
      </tr>`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  let allUsers = [];
  let activeProject = "ore";
  let activeArea = "users";

  function renderUsers(list) {
    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="muted">Sem dados.</td></tr>`;
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    tbody.innerHTML = list.map(row).join("");
  }

  function applyFilter() {
    const term = (q.value || "").trim().toLowerCase();
    if (!term) {
      renderUsers(allUsers);
      return;
    }
    const filtered = allUsers.filter(u => {
      const name = String(u.name ?? u.nome ?? "").toLowerCase();
      const cnpj = String(u.cnpj ?? "").toLowerCase();
      const razao = String(u.company_name ?? u.razao_social ?? u.razaoSocial ?? "").toLowerCase();
      return name.includes(term) || cnpj.includes(term) || razao.includes(term);
    });
    renderUsers(filtered);
  }

  async function loadUsers() {
    setFatal("");
    tbody.innerHTML = `<tr><td colspan="9" class="muted">Carregando…</td></tr>`;
    showLoading("Sincronizando…");

    try {
      // ⚠️ Aqui está o único ponto que depende do nome da tua tabela/admin view.
      // Se você já tem uma tabela/view pronta, coloque o nome dela no config:
      // window.ABC_ADMIN_CONFIG.ADMIN_USERS_TABLE = "nome_da_tabela";
      const table = cfg.ADMIN_USERS_TABLE || "admin_users";

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .limit(500);

      if (error) {
        setFatal(`Não consegui carregar dados (${table}). Verifique RLS/permissões/tabela.`);
        allUsers = [];
        renderUsers([]);
        return;
      }

      allUsers = data || [];
      renderUsers(allUsers);
      applyFilter();
    } finally {
      hideLoading();
    }
  }

  // --- AUTH GATE: se não tiver sessão, não entra.
  showLoading("Carregando…");
  const session = await requireSessionOrRedirect("/admin/");
  if (!session) return;

  userName.textContent = session.user?.email || "—";
  hideLoading();

  logout.addEventListener("click", async () => {
    showLoading("Saindo…");
    try { await supabase.auth.signOut(); }
    finally { window.location.replace("/admin/"); }
  });

  q.addEventListener("input", applyFilter);

  tabs.forEach(btn => btn.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    activeArea = btn.dataset.area;

    // Só "Usuários" carrega dados por enquanto; resto é placeholder
    if (activeArea === "users") {
      panelTitle.textContent = "Usuários";
      loadUsers();
    } else if (activeArea === "reports") {
      panelTitle.textContent = "Relatórios";
      tbody.innerHTML = `<tr><td colspan="9" class="muted">Em construção…</td></tr>`;
    } else if (activeArea === "finance") {
      panelTitle.textContent = "Finanças";
      tbody.innerHTML = `<tr><td colspan="9" class="muted">Em construção…</td></tr>`;
    } else {
      panelTitle.textContent = "Gestão";
      tbody.innerHTML = `<tr><td colspan="9" class="muted">Em construção…</td></tr>`;
    }
  }));

  projects.forEach(p => p.addEventListener("click", () => {
    projects.forEach(x => x.classList.remove("active"));
    p.classList.add("active");
    activeProject = p.dataset.project;

    // Por enquanto, só ORE/Usuários puxa dados; outros projetos ficam placeholder
    if (activeProject !== "ore") {
      setFatal("");
      tbody.innerHTML = `<tr><td colspan="9" class="muted">Projeto "${activeProject.toUpperCase()}" em construção…</td></tr>`;
      return;
    }
    if (activeArea === "users") loadUsers();
  }));

  // Boot inicial: ORE + Usuários
  await loadUsers();
})();
