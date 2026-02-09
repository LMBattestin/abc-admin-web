// admin/assets/users.js
(function () {
  const ABC = window.__ABC;
  const supabase = ABC.supabase;

  function fmtDateBR(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
  }

  function onlyDigits(s) {
    return String(s || "").replace(/\D+/g, "");
  }

  function maskCNPJ(v) {
    const d = onlyDigits(v).slice(0, 14);
    if (d.length !== 14) return v || "-";
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");
  }

  function maskPhone(v) {
    const d = onlyDigits(v);
    if (d.length < 10) return v || "-";
    const dd = d.slice(0, 2);
    const mid = d.length === 11 ? d.slice(2, 7) : d.slice(2, 6);
    const end = d.length === 11 ? d.slice(7, 11) : d.slice(6, 10);
    return `(${dd}) ${mid}-${end}`;
  }

  function safe(v) {
    const s = String(v ?? "");
    return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  async function fetchUsers() {
    // IMPORTANTE:
    // aqui eu assumo uma tabela "users".
    // Se a sua tabela tiver outro nome (ex: profiles, clients, app_users),
    // você só troca o from("users") pelo nome certo e ajusta colunas.
    const { data, error } = await supabase
      .from("users")
      .select("id,name,company,cnpj,email,phone,credits,created_at,last_login")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    return data || [];
  }

  function renderRows(rows, filterText) {
    const tbody = document.getElementById("users-tbody");
    const q = (filterText || "").trim().toLowerCase();

    const filtered = q
      ? rows.filter((r) => {
          const name = String(r.name || "").toLowerCase();
          const company = String(r.company || "").toLowerCase();
          const cnpj = String(r.cnpj || "").toLowerCase();
          return name.includes(q) || company.includes(q) || cnpj.includes(q);
        })
      : rows;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="td-muted">Nenhum usuário encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered
      .map((u) => {
        return `
          <tr data-id="${safe(u.id)}">
            <td>${safe(u.name || "-")}</td>
            <td>${safe(u.company || "-")}</td>
            <td>${safe(maskCNPJ(u.cnpj))}</td>
            <td>${safe(u.email || "-")}</td>
            <td>${safe(maskPhone(u.phone))}</td>
            <td>${safe(u.credits ?? 0)}</td>
            <td>${safe(fmtDateBR(u.created_at))}</td>
            <td>${safe(fmtDateBR(u.last_login))}</td>
            <td>
              <div class="actions-cell">
                <button class="action-btn btn-edit">Editar</button>
                <button class="action-btn action-danger btn-del">Excluir</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadUsersView() {
    const err = document.getElementById("page-error");
    const view = document.getElementById("users-view");
    const placeholder = document.getElementById("placeholder-view");

    err.classList.add("hidden");
    placeholder.classList.add("hidden");
    view.classList.remove("hidden");

    const tbody = document.getElementById("users-tbody");
    tbody.innerHTML = `<tr><td colspan="9" class="td-muted">Carregando...</td></tr>`;

    let rows = [];
    try {
      rows = await fetchUsers();
      renderRows(rows, "");
    } catch (e) {
      console.error(e);
      err.textContent =
        "Falha ao carregar usuários do Supabase. Verifique o nome da tabela e permissões (RLS).";
      err.classList.remove("hidden");
      tbody.innerHTML = `<tr><td colspan="9" class="td-muted">Erro ao carregar.</td></tr>`;
      return;
    }

    // busca instantânea
    const search = document.getElementById("users-search");
    search.addEventListener("input", () => renderRows(rows, search.value));

    // botões (por enquanto só placeholder sem quebrar)
    document.getElementById("users-tbody").addEventListener("click", (ev) => {
      const tr = ev.target.closest("tr[data-id]");
      if (!tr) return;
      const id = tr.getAttribute("data-id");

      if (ev.target.classList.contains("btn-edit")) {
        alert(`Editar usuário: ${id} (vamos implementar a tela/modal depois)`);
      }

      if (ev.target.classList.contains("btn-del")) {
        if (confirm("Excluir este usuário?")) {
          alert(`Excluir usuário: ${id} (vamos implementar o delete depois)`);
        }
      }
    });
  }

  // expõe para o dashboard.js chamar quando ORE+USUARIOS
  window.ABC_LOAD_USERS_VIEW = loadUsersView;
})();
