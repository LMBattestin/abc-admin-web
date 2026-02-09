// admin/assets/dashboard.js
(function () {
  const overlay = document.getElementById("overlay");
  const userNameEl = document.getElementById("userName");
  const logoutBtn = document.getElementById("logoutBtn");

  const usersSection = document.getElementById("usersSection");
  const placeholderSection = document.getElementById("placeholderSection");
  const usersTbody = document.getElementById("usersTbody");
  const refreshBtn = document.getElementById("refreshBtn");
  const searchInput = document.getElementById("searchInput");

  function showOverlay(on) {
    overlay.classList.toggle("hidden", !on);
  }

  function maskCNPJ(v) {
    const s = String(v || "").replace(/\D/g, "");
    if (s.length !== 14) return v || "";
    return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12,14)}`;
  }

  function maskPhone(v) {
    const s = String(v || "").replace(/\D/g, "");
    if (!s) return "";
    if (s.length === 11) return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7)}`;
    if (s.length === 10) return `(${s.slice(0,2)}) ${s.slice(2,6)}-${s.slice(6)}`;
    return v || "";
  }

  function safe(v) { return (v ?? "").toString(); }

  // Config + Supabase
  const cfg = window.ABC_ADMIN_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    document.body.innerHTML = `<div style="padding:16px;color:#b00020;font-family:Arial">Config do Supabase ausente. Confira admin/assets/config.js</div>`;
    return;
  }
  const supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  async function requireAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data || !data.session) {
      window.location.href = "./index.html";
      return null;
    }
    return data.session;
  }

  function showUsersUI() {
    placeholderSection.classList.add("hidden");
    usersSection.classList.remove("hidden");
  }

  // Fetch: profiles + credits_balance (merge por user_id)
  async function loadUsers() {
    showOverlay(true);
    try {
      // 1) pega profiles
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id,name,email,phone,cnpj,razao_social,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (pErr) throw pErr;

      const ids = (profiles || []).map(p => p.user_id).filter(Boolean);

      // 2) pega balances
      let balancesMap = new Map();
      if (ids.length) {
        const { data: balances, error: bErr } = await supabase
          .from("credits_balance")
          .select("user_id,balance,updated_at")
          .in("user_id", ids);

        if (bErr) throw bErr;

        (balances || []).forEach(b => balancesMap.set(b.user_id, b.balance ?? 0));
      }

      renderUsers(profiles || [], balancesMap);
    } catch (e) {
      console.error(e);
      usersTbody.innerHTML = `<tr><td colspan="8" class="muted">Erro ao carregar. Provável RLS bloqueando (ou nome de tabela errado). Veja Console (F12).</td></tr>`;
    } finally {
      showOverlay(false);
    }
  }

  function renderUsers(rows, balancesMap) {
    const q = (searchInput.value || "").trim().toLowerCase();

    const filtered = rows.filter(r => {
      const name = safe(r.name).toLowerCase();
      const cnpj = safe(r.cnpj).toLowerCase();
      const razao = safe(r.razao_social).toLowerCase();
      if (!q) return true;
      return name.includes(q) || cnpj.includes(q) || razao.includes(q);
    });

    if (!filtered.length) {
      usersTbody.innerHTML = `<tr><td colspan="8" class="muted">Nenhum usuário encontrado.</td></tr>`;
      return;
    }

    usersTbody.innerHTML = filtered.map(r => {
      const credits = balancesMap.get(r.user_id) ?? 0;
      return `
        <tr>
          <td>${safe(r.name)}</td>
          <td>${maskCNPJ(r.cnpj)}</td>
          <td>${safe(r.razao_social)}</td>
          <td>${safe(r.email)}</td>
          <td>${maskPhone(r.phone)}</td>
          <td><strong>${credits}</strong></td>
          <td>${safe(r.user_id)}</td>
          <td>
            <button class="action-btn action-edit" data-id="${safe(r.user_id)}" title="Editar"><i class="fas fa-pen"></i></button>
            <button class="action-btn action-del" data-id="${safe(r.user_id)}" title="Excluir"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join("");

    // eventos (placeholder)
    usersTbody.querySelectorAll(".action-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        alert("Editar (vamos abrir a meia-janela lateral depois). ID: " + btn.dataset.id);
      });
    });
    usersTbody.querySelectorAll(".action-del").forEach(btn => {
      btn.addEventListener("click", () => {
        alert("Excluir (vamos implementar depois). ID: " + btn.dataset.id);
      });
    });
  }

  // Tabs / softwares (mantém a troca e carrega users quando for “usuarios”)
  function setupNav() {
    document.querySelectorAll(".software-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".software-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        // por enquanto, users é só demo; mais tarde filtramos por software
      });
    });

    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const dept = btn.getAttribute("data-department");
        if (dept === "usuarios") {
          showUsersUI();
          loadUsers();
        } else {
          usersSection.classList.add("hidden");
          placeholderSection.classList.remove("hidden");
          placeholderSection.querySelector(".placeholder-title").textContent = "Em breve";
          placeholderSection.querySelector(".placeholder-text").textContent = "Essa seção será implementada depois.";
        }
      });
    });

    refreshBtn.addEventListener("click", () => loadUsers());
    searchInput.addEventListener("input", () => {
      // re-render sem novo fetch (usa o último HTML já? aqui refazendo com rows exigiria estado;
      // solução simples: recarrega do supabase (ok por enquanto)
      loadUsers();
    });
  }

  async function boot() {
    showOverlay(true);

    const session = await requireAuth();
    if (!session) return;

    // Nome no topo (mostra email do auth)
    userNameEl.textContent = session.user?.email || "admin";

    logoutBtn.addEventListener("click", async () => {
      showOverlay(true);
      try {
        await supabase.auth.signOut();
      } finally {
        window.location.href = "./index.html";
      }
    });

    setupNav();

    // inicia já em usuários
    showUsersUI();
    await loadUsers();

    showOverlay(false);
  }

  boot().catch(err => {
    console.error(err);
    showOverlay(false);
  });
})();
