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
  const newBtn = document.getElementById("newBtn");

  function showOverlay(on) {
    overlay.classList.toggle("hidden", !on);
  }

  function maskCNPJ(v) {
    const s = String(v || "").replace(/\D/g, "");
    if (s.length !== 14) return v || "";
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(
      8,
      12
    )}-${s.slice(12, 14)}`;
  }

  function maskPhone(v) {
    const s = String(v || "").replace(/\D/g, "");
    if (!s) return "";
    if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
    if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
    return v || "";
  }

  function safe(v) {
    return String(v ?? "");
  }

  const cfg = window.ABC_ADMIN_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    document.body.innerHTML =
      '<div style="padding:16px;color:#b00020;font-family:Arial">Config do Supabase ausente. Confira admin/assets/config.js</div>';
    return;
  }

  // cria UMA instância só (evita o warning de múltiplos GoTrueClient)
  const supabase = window.__ABC_SB__
    ? window.__ABC_SB__
    : (window.__ABC_SB__ = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY));

  let lastProfiles = [];
  let lastBalancesMap = new Map();

  async function requireAuth() {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn(error);
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

  async function loadUsers() {
    showOverlay(true);
    try {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id,name,email,phone,cnpj,razao_social,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (pErr) throw pErr;

      const ids = (profiles || []).map((p) => p.user_id).filter(Boolean);

      const balancesMap = new Map();
      if (ids.length) {
        const { data: balances, error: bErr } = await supabase
          .from("credits_balance")
          .select("user_id,balance,updated_at")
          .in("user_id", ids);

        if (bErr) throw bErr;

        (balances || []).forEach((b) => balancesMap.set(b.user_id, b.balance ?? 0));
      }

      lastProfiles = profiles || [];
      lastBalancesMap = balancesMap;

      renderUsers(lastProfiles, lastBalancesMap);
    } catch (e) {
      console.error(e);
      usersTbody.innerHTML =
        '<tr><td colspan="8" class="muted">Erro ao carregar. Veja Console (F12).</td></tr>';
    } finally {
      showOverlay(false);
    }
  }

  function renderUsers(rows, balancesMap) {
    const q = (searchInput.value || "").trim().toLowerCase();

    const filtered = rows.filter((r) => {
      const name = safe(r.name).toLowerCase();
      const cnpj = safe(r.cnpj).toLowerCase();
      const razao = safe(r.razao_social).toLowerCase();
      if (!q) return true;
      return name.includes(q) || cnpj.includes(q) || razao.includes(q);
    });

    if (!filtered.length) {
      usersTbody.innerHTML =
        '<tr><td colspan="8" class="muted">Nenhum usuário encontrado.</td></tr>';
      return;
    }

    usersTbody.innerHTML = filtered
      .map((r) => {
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
      })
      .join("");

    usersTbody.querySelectorAll(".action-edit").forEach((btn) => {
      btn.addEventListener("click", () => onEdit(btn.dataset.id));
    });
    usersTbody.querySelectorAll(".action-del").forEach((btn) => {
      btn.addEventListener("click", () => onDelete(btn.dataset.id));
    });
  }

  function findUserById(id) {
    return lastProfiles.find((p) => p.user_id === id) || null;
  }

  async function onEdit(id) {
    const row = findUserById(id);
    if (!row) return alert("Usuário não encontrado.");

    const namePrompt = prompt("Nome:", row.name || "");
    if (namePrompt === null) return;
    const name = namePrompt;

    const cnpjPrompt = prompt("CNPJ:", row.cnpj || "");
    if (cnpjPrompt === null) return;
    const cnpj = cnpjPrompt;

    const razaoPrompt = prompt("Razão Social:", row.razao_social || "");
    if (razaoPrompt === null) return;
    const razao_social = razaoPrompt;

    const phonePrompt = prompt("Telefone:", row.phone || "");
    if (phonePrompt === null) return;
    const phone = phonePrompt;

    const currentCredits = lastBalancesMap.get(id) ?? 0;
    const creditsStr = prompt("Créditos:", String(currentCredits));
    if (creditsStr === null) return;

    const credits = Number(creditsStr);
    if (!Number.isFinite(credits)) return alert("Créditos inválidos.");

    showOverlay(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          name,
          cnpj: cnpj || null,
          razao_social: razao_social || null,
          phone: phone || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", id);

      if (pErr) throw pErr;

      const { error: bErr } = await supabase
        .from("credits_balance")
        .upsert(
          { user_id: id, balance: credits, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      if (bErr) throw bErr;

      await loadUsers();
    } catch (e) {
      console.error(e);
      alert("Falha ao salvar. Veja o Console (F12).");
    } finally {
      showOverlay(false);
    }
  }

  async function onDelete(id) {
    if (!confirm("Excluir este usuário? (Remove do painel, não apaga do Auth ainda)")) return;

    showOverlay(true);
    try {
      const { error: pErr } = await supabase.from("profiles").delete().eq("user_id", id);
      if (pErr) throw pErr;

      const { error: bErr } = await supabase.from("credits_balance").delete().eq("user_id", id);
      if (bErr) throw bErr;

      await loadUsers();
    } catch (e) {
      console.error(e);
      alert("Falha ao excluir. Veja o Console (F12).");
    } finally {
      showOverlay(false);
    }
  }

  async function createUserViaEdgeFunction(session, payload) {
    const url = `${cfg.SUPABASE_URL}/functions/v1/admin-create-user`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: cfg.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    let out = {};
    try {
      out = await res.json();
    } catch {}

    if (!res.ok) {
      const msg = out.error || out.message || "Falha ao criar usuário.";
      throw new Error(msg);
    }
    return out;
  }

  async function onCreate(session) {
    const email = (prompt("Email do novo usuário:") || "").trim();
    if (!email) return;

    const password = prompt("Senha (mínimo 6 caracteres):") || "";
    if (password.length < 6) return alert("Senha curta demais (mínimo 6).");

    const name = prompt("Nome:", "") || "";
    const cnpj = prompt("CNPJ (opcional):", "") || "";
    const razao_social = prompt("Razão Social (opcional):", "") || "";
    const phone = prompt("Telefone (opcional):", "") || "";
    const creditsStr = prompt("Créditos iniciais (opcional):", "0") || "0";
    const credits = Number(creditsStr) || 0;

    showOverlay(true);
    try {
      await createUserViaEdgeFunction(session, {
        email,
        password,
        name,
        cnpj,
        razao_social,
        phone,
        credits,
      });
      alert("Usuário criado! Agora já pode logar no app.");
      await loadUsers();
    } catch (e) {
      console.error(e);
      alert(String(e.message || e));
    } finally {
      showOverlay(false);
    }
  }

  function setupNav(session) {
    document.querySelectorAll(".software-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".software-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const dept = btn.getAttribute("data-department");
        if (dept === "usuarios") {
          showUsersUI();
          await loadUsers();
        } else {
          usersSection.classList.add("hidden");
          placeholderSection.classList.remove("hidden");
          const t = placeholderSection.querySelector(".placeholder-title");
          const p = placeholderSection.querySelector(".placeholder-text");
          if (t) t.textContent = "Em breve";
          if (p) p.textContent = "Essa seção será implementada depois.";
        }
      });
    });

    refreshBtn.addEventListener("click", () => loadUsers());

    searchInput.addEventListener("input", () => {
      renderUsers(lastProfiles, lastBalancesMap);
    });

    newBtn.addEventListener("click", () => onCreate(session));
  }

  async function boot() {
    showOverlay(true);

    const session = await requireAuth();
    if (!session) return;

    userNameEl.textContent = (session.user && session.user.email) ? session.user.email : "admin";

    logoutBtn.addEventListener("click", async () => {
      showOverlay(true);
      try {
        await supabase.auth.signOut();
      } finally {
        window.location.href = "./index.html";
      }
    });

    setupNav(session);

    showUsersUI();
    await loadUsers();

    showOverlay(false);
  }

  boot().catch((err) => {
    console.error(err);
    showOverlay(false);
  });
})();
