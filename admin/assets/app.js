// admin/assets/app.js
(() => {
  const cfg = window.ORE_ADMIN_CONFIG || {};
  const SUPABASE_URL = cfg.SUPABASE_URL;
  const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    document.body.innerHTML = "<pre style='color:#ff6b6b'>Config do Supabase ausente. Confira admin/assets/config.js</pre>";
    return;
  }

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const setText = (id, txt) => ($(id).textContent = txt || "");
  const setErr = (id, txt) => setText(id, txt);
  const setOk = (id, txt) => setText(id, txt);

  const onlyDigits = (v) => String(v || "").replace(/\D/g, "");

  const maskCnpj = (v) => {
    const d = onlyDigits(v).slice(0, 14);
    if (!d) return "";
    const p = d.padEnd(14, "_");
    return `${p.slice(0, 2)}.${p.slice(2, 5)}.${p.slice(5, 8)}/${p.slice(8, 12)}-${p.slice(12, 14)}`.replace(/_/g, "");
  };

  const maskPhoneBR = (v) => {
    const d = onlyDigits(v).slice(0, 11);
    if (!d) return "";
    if (d.length <= 10) {
      const a = d.slice(0, 2);
      const b = d.slice(2, 6);
      const c = d.slice(6, 10);
      return `(${a}) ${b}${c ? "-" + c : ""}`.trim();
    }
    const a = d.slice(0, 2);
    const b = d.slice(2, 7);
    const c = d.slice(7, 11);
    return `(${a}) ${b}${c ? "-" + c : ""}`.trim();
  };

  const fmtBR = (iso) => {
    try {
      return iso ? new Date(iso).toLocaleString("pt-BR") : "";
    } catch {
      return "";
    }
  };

  const fnUrl = () => {
    const functionsBase = SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co");
    return `${functionsBase}/functions/v1/admin`;
  };

  async function callAdmin(method, path = "", body) {
    const { data: sessData } = await sb.auth.getSession();
    const accessToken = sessData?.session?.access_token;
    if (!accessToken) throw new Error("Sem sessão");

    const endpoint = fnUrl() + path;
    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      throw new Error(json?.message || `Erro ${res.status}`);
    }
    return json;
  }

  // ---------- state ----------
  let users = [];
  let editing = null; // user object or {id:""} for new

  // ---------- routing ----------
  function setRoute(route) {
    const map = {
      home: "routeHome",
      reports: "routeReports",
      finance: "routeFinance",
      settings: "routeSettings",
    };
    Object.keys(map).forEach((k) => {
      $(map[k]).style.display = k === route ? "block" : "none";
    });

    document.querySelectorAll(".nav a[data-route]").forEach((a) => {
      a.classList.toggle("active", a.getAttribute("data-route") === route);
    });
  }

  function syncRouteFromHash() {
    const h = (location.hash || "#/").replace("#/", "");
    const route = h || "home";
    setRoute(route);
  }

  window.addEventListener("hashchange", syncRouteFromHash);

  // ---------- UI switching ----------
  function showLogin() {
    $("loginView").style.display = "flex";
    $("appView").style.display = "none";
  }

  function showApp(email) {
    $("loginView").style.display = "none";
    $("appView").style.display = "flex";
    $("sessionInfo").textContent = email || "—";
    syncRouteFromHash();
  }

  // ---------- drawer ----------
  function openDrawer(mode, user) {
    // mode: "new" | "edit"
    editing = user || null;

    setErr("drawerError", "");
    setOk("drawerOk", "");

    $("drawerTitle").textContent = mode === "new" ? "Novo usuário" : "Editar usuário";
    $("drawerSubtitle").textContent = mode === "new" ? "Preencha os dados e crie o usuário." : (user?.id || "—");

    // populate
    $("fName").value = user?.name || "";
    $("fCnpj").value = user?.cnpj || "";
    $("fRazao").value = user?.razaoSocial || "";
    $("fEmail").value = user?.email || "";
    $("fPhone").value = user?.phone || "";
    $("fCredits").value = String(user?.balance ?? user?.credits ?? 0);
    $("fPass").value = "";

    $("drawerDeleteBtn").style.display = mode === "edit" ? "inline-block" : "none";

    $("drawerBackdrop").classList.add("open");
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    $("drawerBackdrop").classList.remove("open");
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    editing = null;
  }

  // ---------- users rendering ----------
  function applyFilters(list) {
    const q = ($("searchInput").value || "").trim().toLowerCase();
    const minCreditsStr = ($("filterMinCredits").value || "").trim();
    const minCredits = minCreditsStr ? Number(minCreditsStr) : null;

    return list.filter((u) => {
      const name = String(u.name || "").toLowerCase();
      const razao = String(u.razaoSocial || "").toLowerCase();
      const cnpj = onlyDigits(u.cnpj || "");
      const email = String(u.email || "").toLowerCase();

      const hit =
        !q ||
        name.includes(q) ||
        razao.includes(q) ||
        cnpj.includes(onlyDigits(q)) ||
        email.includes(q);

      const credits = Number(u.balance ?? u.credits ?? 0) || 0;
      const hitCredits = minCredits == null ? true : credits >= minCredits;

      return hit && hitCredits;
    });
  }

  function renderUsers() {
    const tbody = $("usersTbody");
    const list = applyFilters(users);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="muted">Nenhum usuário encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    for (const u of list) {
      const tr = document.createElement("tr");
      const createdStr = fmtBR(u.createdAt);
      const lastStr = fmtBR(u.lastSignInAt);

      const credits = Number(u.balance ?? u.credits ?? 0) || 0;

      tr.innerHTML = `
        <td>${escapeHtml(u.name || "")}</td>
        <td>${escapeHtml(maskCnpj(u.cnpj || ""))}</td>
        <td>${escapeHtml(u.razaoSocial || "")}</td>
        <td>${escapeHtml(u.email || "")}</td>
        <td>${escapeHtml(maskPhoneBR(u.phone || "")) || "-"}</td>
        <td><span class="pill">${credits}</span></td>
        <td>${createdStr || "-"}</td>
        <td class="muted">${lastStr || "-"}</td>
        <td class="muted small">${escapeHtml(u.id || "")}</td>
        <td>
          <div class="actions">
            <button class="btn secondary" data-edit="${u.id}">Editar</button>
            <button class="btn secondary" data-add="${u.id}">+10</button>
            <button class="btn secondary" data-sub="${u.id}">-10</button>
            <button class="btn danger" data-del="${u.id}">Excluir</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- data loading ----------
  async function loadUsers() {
    setErr("errorText", "");
    setOk("okText", "");
    $("refreshBtn").disabled = true;
    $("usersTbody").innerHTML = `<tr><td colspan="10" class="muted">Carregando…</td></tr>`;

    try {
      const data = await callAdmin("GET");
      users = Array.isArray(data.users) ? data.users : [];
      renderUsers();
      setText(
        "statusText",
        "Última atualização: " + new Date().toLocaleTimeString("pt-BR", { hour12: false })
      );
    } catch (e) {
      setErr("errorText", e.message || String(e));
      $("usersTbody").innerHTML = `<tr><td colspan="10" class="muted">Falha ao carregar.</td></tr>`;
    } finally {
      $("refreshBtn").disabled = false;
    }
  }

  // ---------- actions ----------
  async function login() {
    setErr("authError", "");
    setOk("authOk", "");

    const email = ($("adminEmail").value || "").trim();
    const password = $("adminPass").value || "";

    if (!email || !password) {
      setErr("authError", "Informe e-mail e senha do admin");
      return;
    }

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new Error(error?.message || "Falha no login");

      localStorage.setItem("ORE_ADMIN_EMAIL_LAST", email);
      showApp(email);
      setOk("authOk", "Logado.");

      await loadUsers();
    } catch (e) {
      setErr("authError", e.message || String(e));
    }
  }

  async function logout() {
    try {
      await sb.auth.signOut();
    } catch {}
    users = [];
    showLogin();
  }

  async function adjustCredits(userId, delta) {
    setErr("errorText", "");
    setOk("okText", "");
    try {
      const data = await callAdmin("POST", "", {
        action: "adjust_credits",
        userId,
        delta,
        reason: "admin_web_v2",
      });
      setOk("okText", `Saldo atualizado: ${data.balance ?? "ok"}`);
      await loadUsers();
    } catch (e) {
      setErr("errorText", e.message || String(e));
    }
  }

  async function deleteUser(userId) {
    if (!confirm("Excluir este usuário?")) return;
    setErr("errorText", "");
    setOk("okText", "");
    try {
      await callAdmin("DELETE", `?userId=${encodeURIComponent(userId)}`);
      setOk("okText", "Usuário excluído.");
      await loadUsers();
    } catch (e) {
      setErr("errorText", e.message || String(e));
    }
  }

  function findUserById(id) {
    return users.find((u) => String(u.id) === String(id)) || null;
  }

  async function saveDrawer() {
    setErr("drawerError", "");
    setOk("drawerOk", "");
    $("drawerSaveBtn").disabled = true;

    try {
      const name = ($("fName").value || "").trim();
      const cnpj = ($("fCnpj").value || "").trim();
      const razaoSocial = ($("fRazao").value || "").trim();
      const email = ($("fEmail").value || "").trim();
      const phone = ($("fPhone").value || "").trim();
      const creditsNew = Number(($("fCredits").value || "0").trim() || 0) || 0;
      const pass = $("fPass").value || "";

      if (!name || !email) throw new Error("Preencha ao menos Nome e E-mail.");

      // CREATE
      if (!editing || !editing.id) {
        if (!pass || pass.length < 6) throw new Error("Senha para novo usuário: mínimo 6 caracteres.");
        const data = await callAdmin("POST", "", {
          action: "create",
          name,
          email,
          password: pass,
          phone,
          cnpj,
          razaoSocial,
        });

        // Se backend já criar com crédito 0, ajusta para o valor desejado:
        const newId = data?.user?.id || data?.userId || null;
        if (newId && creditsNew > 0) {
          await callAdmin("POST", "", {
            action: "adjust_credits",
            userId: newId,
            delta: creditsNew,
            reason: "admin_web_v2_init",
          });
        }

        setOk("drawerOk", `Usuário criado: ${data.user?.email || email}`);
        closeDrawer();
        await loadUsers();
        return;
      }

      // EDIT
      const cur = findUserById(editing.id);
      const curCredits = Number(cur?.balance ?? cur?.credits ?? 0) || 0;
      const delta = creditsNew - curCredits;

      // Créditos (funcional)
      if (delta !== 0) {
        await callAdmin("POST", "", {
          action: "adjust_credits",
          userId: editing.id,
          delta,
          reason: "admin_web_v2_set",
        });
      }

      // Outros campos: tenta, mas depende do backend
      let profileUpdated = false;
      try {
        await callAdmin("POST", "", {
          action: "update_profile",
          userId: editing.id,
          name,
          email,
          phone,
          cnpj,
          razaoSocial,
        });
        profileUpdated = true;
      } catch (e) {
        // se o backend não suportar, não quebra o fluxo
        setOk(
          "drawerOk",
          "Créditos atualizados. Edição de dados pessoais depende do backend (action=update_profile não disponível)."
        );
      }

      if (profileUpdated) {
        setOk("drawerOk", "Usuário atualizado.");
      }

      closeDrawer();
      await loadUsers();
    } catch (e) {
      setErr("drawerError", e.message || String(e));
    } finally {
      $("drawerSaveBtn").disabled = false;
    }
  }

  async function deleteDrawerUser() {
    if (!editing?.id) return;
    if (!confirm("Excluir este usuário?")) return;
    $("drawerDeleteBtn").disabled = true;
    try {
      await deleteUser(editing.id);
      closeDrawer();
    } finally {
      $("drawerDeleteBtn").disabled = false;
    }
  }

  // ---------- init ----------
  async function init() {
    // prefill
    const last = localStorage.getItem("ORE_ADMIN_EMAIL_LAST") || "";
    if (last) $("adminEmail").value = last;

    // auto session
    const { data } = await sb.auth.getSession();
    const session = data?.session;

    if (session?.user?.email) {
      showApp(session.user.email);
      await loadUsers();
    } else {
      showLogin();
    }

    // events
    $("loginBtn").addEventListener("click", login);
    $("logoutBtn").addEventListener("click", logout);

    $("refreshBtn").addEventListener("click", loadUsers);
    $("searchInput").addEventListener("input", renderUsers);
    $("filterMinCredits").addEventListener("input", renderUsers);

    $("newUserBtn").addEventListener("click", () => openDrawer("new", { id: "" }));

    $("drawerCloseBtn").addEventListener("click", closeDrawer);
    $("drawerBackdrop").addEventListener("click", closeDrawer);
    $("drawerSaveBtn").addEventListener("click", saveDrawer);
    $("drawerDeleteBtn").addEventListener("click", deleteDrawerUser);

    document.addEventListener("click", (ev) => {
      const t = ev.target;
      if (!(t instanceof HTMLElement)) return;

      const add = t.getAttribute("data-add");
      const sub = t.getAttribute("data-sub");
      const del = t.getAttribute("data-del");
      const edit = t.getAttribute("data-edit");

      if (add) adjustCredits(add, 10);
      if (sub) adjustCredits(sub, -10);
      if (del) deleteUser(del);
      if (edit) {
        const u = findUserById(edit);
        if (u) openDrawer("edit", u);
      }
    });

    sb.auth.onAuthStateChange((_event, sess) => {
      if (sess?.user?.email) {
        showApp(sess.user.email);
      } else {
        showLogin();
      }
    });

    syncRouteFromHash();
  }

  init();
})();
