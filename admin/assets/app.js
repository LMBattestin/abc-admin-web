/* admin/assets/app.js */
(() => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  // ---- config
  const cfg = window.ABC_ADMIN_CONFIG || {};
  const SUPABASE_URL = cfg.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = cfg.SUPABASE_ANON_KEY || "";

  // ---- supabase client (CDN)
  const supabase = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!supabase) {
    console.error("[abc-admin] Supabase client not available. Check CDN import.");
  }

  // ---- UI refs
  const elAuth = $("#auth");
  const elShell = $("#shell");
  const elOverlay = $("#overlay");
  const elErr = $("#authError");
  const elEmail = $("#loginEmail");
  const elPass = $("#loginPass");
  const elPassToggle = $("#togglePass");
  const elLoginBtn = $("#loginBtn");

  const elUserEmail = $("#userEmail");
  const elLogoutBtn = $("#logoutBtn");
  const elProjectPill = $("#projectPill");

  const elProjectBtns = $$(".proj-btn");
  const elTabs = $$(".tab");

  const elSearch = $("#searchInput");
  const elNewBtn = $("#newBtn");
  const elTbody = $("#usersBody");

  const STATE = {
    session: null,
    project: "ORE",
    folder: "USUARIOS",
    users: [],
    filtered: [],
    loading: false,
  };

  // ---- helpers
  function showOverlay(show, text) {
    if (!elOverlay) return;
    elOverlay.classList.toggle("show", !!show);
    if (text) $("#overlayText").textContent = text;
  }

  function setAuthView(isAuthed) {
    elAuth.style.display = isAuthed ? "none" : "block";
    elShell.style.display = isAuthed ? "grid" : "none";
    if (!isAuthed) {
      elEmail.value = elEmail.value || "";
      elPass.value = "";
    }
  }

  function setError(msg) {
    if (!elErr) return;
    if (!msg) {
      elErr.style.display = "none";
      elErr.textContent = "";
      return;
    }
    elErr.style.display = "block";
    elErr.textContent = msg;
  }

  function fmtDateBR(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR");
  }

  function maskEmail(email) {
    if (!email || !email.includes("@")) return "—";
    const [u, d] = email.split("@");
    const u2 = u.length <= 2 ? u[0] + "*" : u.slice(0,2) + "*".repeat(Math.min(6, u.length-2));
    return `${u2}@${d}`;
  }

  function onlyDigits(s){ return String(s || "").replace(/\D+/g, ""); }

  function maskPhone(phone) {
    const d = onlyDigits(phone);
    if (!d) return "—";
    // BR: 11 digits => (XX) XXXXX-XXXX
    if (d.length >= 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7,11)}`;
    if (d.length >= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6,10)}`;
    return d;
  }

  function maskCNPJ(cnpj) {
    const d = onlyDigits(cnpj);
    if (!d) return "—";
    const x = d.padStart(14,"0").slice(0,14);
    return `${x.slice(0,2)}.${x.slice(2,5)}.${x.slice(5,8)}/${x.slice(8,12)}-${x.slice(12,14)}`;
  }

  function safe(s){ return (s ?? "").toString(); }

  function render() {
    // topbar
    elProjectPill.textContent = STATE.project;
    elUserEmail.textContent = STATE.session?.user?.email || "—";

    // tabs
    elTabs.forEach(btn => {
      const key = btn.getAttribute("data-folder");
      btn.classList.toggle("active", key === STATE.folder);
    });

    // projects
    elProjectBtns.forEach(btn => {
      const key = btn.getAttribute("data-project");
      btn.classList.toggle("active", key === STATE.project);
    });

    // content
    if (STATE.project !== "ORE" || STATE.folder !== "USUARIOS") {
      // placeholder
      elTbody.innerHTML = `
        <tr><td class="muted" colspan="9">Em construção para ${STATE.project} / ${STATE.folder}.</td></tr>
      `;
      return;
    }

    const rows = (STATE.filtered.length ? STATE.filtered : STATE.users);
    if (!rows.length) {
      elTbody.innerHTML = `<tr><td class="muted" colspan="9">Nenhum usuário encontrado.</td></tr>`;
      return;
    }

    elTbody.innerHTML = rows.map(u => {
      const name = safe(u.name || u.full_name || u.company_name || "—");
      const cnpj = maskCNPJ(u.cnpj);
      const razao = safe(u.razao_social || u.legal_name || "—");
      const email = maskEmail(u.email || u.owner_email || u.user_email || "");
      const phone = maskPhone(u.phone || u.telefone || "");
      const credits = (u.credits ?? u.creditos ?? u.balance ?? "—");
      const created = fmtDateBR(u.created_at || u.createdAt);
      const last = fmtDateBR(u.last_login || u.lastLogin);
      const id = safe(u.id || u.user_id || "");
      return `
        <tr>
          <td>${name}</td>
          <td>${cnpj}</td>
          <td>${razao}</td>
          <td>${email}</td>
          <td>${phone}</td>
          <td>${credits}</td>
          <td>${created}</td>
          <td>${last}</td>
          <td>
            <div class="t-actions">
              <button class="iconbtn" data-act="edit" data-id="${id}">Editar</button>
              <button class="iconbtn danger" data-act="del" data-id="${id}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function applySearch() {
    const q = safe(elSearch.value).trim().toLowerCase();
    if (!q) {
      STATE.filtered = [];
      render();
      return;
    }
    // filter by name, cnpj, razao social
    STATE.filtered = STATE.users.filter(u => {
      const name = safe(u.name || u.full_name || u.company_name).toLowerCase();
      const cnpj = onlyDigits(u.cnpj);
      const razao = safe(u.razao_social || u.legal_name).toLowerCase();
      const qd = onlyDigits(q);
      return name.includes(q) || razao.includes(q) || (qd && cnpj.includes(qd));
    });
    render();
  }

  async function fetchUsers() {
    try {
      showOverlay(true, "Sincronizando… Aguarde um instante.");
      const token = STATE.session?.access_token;
      if (!token) throw new Error("Sessão inválida. Faça login novamente.");

      const url = `${SUPABASE_URL}/functions/v1/admin`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Falha ao listar usuários (${res.status}). ${t}`);
      }
      const data = await res.json();
      STATE.users = Array.isArray(data) ? data : (data?.users || []);
      STATE.filtered = [];
      render();
    } finally {
      showOverlay(false);
    }
  }

  async function doLogin() {
    try {
      setError("");
      showOverlay(true, "Entrando…");
      const email = safe(elEmail.value).trim();
      const password = safe(elPass.value);
      if (!email || !password) {
        setError("Informe e-mail e senha.");
        return;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      STATE.session = data.session;
      setAuthView(true);
      await fetchUsers();
    } catch (e) {
      console.error(e);
      setError(e?.message || "Falha ao entrar.");
      setAuthView(false);
    } finally {
      showOverlay(false);
    }
  }

  async function doLogout() {
    try {
      showOverlay(true, "Saindo…");
      await supabase.auth.signOut();
    } finally {
      STATE.session = null;
      setAuthView(false);
      showOverlay(false);
    }
  }

  // ---- events
  elPassToggle?.addEventListener("click", () => {
    const isPass = elPass.getAttribute("type") === "password";
    elPass.setAttribute("type", isPass ? "text" : "password");
    elPassToggle.textContent = isPass ? "Ocultar" : "Ver";
  });

  elLoginBtn?.addEventListener("click", doLogin);
  elPass?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
  elEmail?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  elLogoutBtn?.addEventListener("click", doLogout);

  elProjectBtns.forEach(btn => btn.addEventListener("click", async () => {
    STATE.project = btn.getAttribute("data-project");
    // keep folder; only ORE/USUARIOS functional
    render();
    if (STATE.project === "ORE" && STATE.folder === "USUARIOS") await fetchUsers();
  }));

  elTabs.forEach(btn => btn.addEventListener("click", () => {
    STATE.folder = btn.getAttribute("data-folder");
    render();
  }));

  elSearch?.addEventListener("input", applySearch);

  // table actions (delegation)
  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const act = t.getAttribute("data-act");
    if (!act) return;

    const id = t.getAttribute("data-id");
    if (!id) return;

    if (act === "edit") {
      alert("Edição detalhada: próximo passo (drawer lateral). Mantive só a base por enquanto.");
      return;
    }
    if (act === "del") {
      const ok = confirm("Excluir este usuário? Isso não pode ser desfeito.");
      if (!ok) return;
      try{
        showOverlay(true, "Excluindo…");
        const token = STATE.session?.access_token;
        const url = `${SUPABASE_URL}/functions/v1/admin?userId=${encodeURIComponent(id)}`;
        const res = await fetch(url, { method:"DELETE", headers:{ "Authorization": `Bearer ${token}` }});
        if (!res.ok) throw new Error(await res.text());
        // refresh
        await fetchUsers();
      } catch(err){
        alert(err?.message || "Falha ao excluir.");
      } finally {
        showOverlay(false);
      }
      return;
    }
  });

  elNewBtn?.addEventListener("click", () => {
    alert("Criar usuário: próximo passo (drawer lateral).");
  });

  // ---- boot
  async function boot() {
    // light theme, multi-project: no assumption about ORE only
    setAuthView(false);
    showOverlay(true, "Carregando…");
    try {
      const { data } = await supabase.auth.getSession();
      STATE.session = data?.session || null;
      if (!STATE.session) {
        setAuthView(false);
        return;
      }
      setAuthView(true);
      await fetchUsers();
    } catch (e) {
      console.error(e);
      setAuthView(false);
    } finally {
      showOverlay(false);
    }
  }

  boot();
})();
