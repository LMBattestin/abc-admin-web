// admin/assets/dashboard.js
(function () {
  'use strict';

  // ===== Helpers DOM =====
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ===== Overlay =====
  const overlay = $('overlay');
  function showOverlay() {
    overlay?.classList.remove('hidden');
    overlay?.setAttribute('aria-hidden', 'false');
  }
  function hideOverlay() {
    overlay?.classList.add('hidden');
    overlay?.setAttribute('aria-hidden', 'true');
  }

  // ===== Config / Supabase =====
  const cfg = window.ABC_ADMIN_CONFIG || null;
  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error('Config do Supabase ausente. Confira admin/assets/config.js');
    return;
  }

  // Evita criar múltiplos clients (aquele warning chato)
  const sb = window.__ABC_SB__ || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  window.__ABC_SB__ = sb;

  // ===== UI refs =====
  const usersSection = $('usersSection');
  const placeholderSection = $('placeholderSection');
  const newBtn = $('newBtn');
  const refreshBtn = $('refreshBtn');
  const searchInput = $('searchInput');
  const usersTbody = $('usersTbody');

  // Drawer
  const drawer = $('userDrawer');
  const drawerBackdrop = $('drawerBackdrop');
  const drawerCloseBtn = $('drawerCloseBtn');
  const cancelBtn = $('cancelBtn');
  const userForm = $('userForm');
  const formError = $('formError');

  const f_name = $('f_name');
  const f_email = $('f_email');
  const f_password = $('f_password');
  const f_togglePw = $('f_togglePw');
  const f_phone = $('f_phone');
  const f_cnpj = $('f_cnpj');
  const f_razao = $('f_razao');
  const f_setor = $('f_setor');
  const f_credits = $('f_credits');

  const logoutBtn = $('logoutBtn');
  const userNameEl = $('userName');

  // ===== Mask utils =====
  function onlyDigits(v) { return (v || '').replace(/\D+/g, ''); }

  function maskCNPJ(v) {
    const d = onlyDigits(v).slice(0, 14);
    // 00.000.000/0000-00
    const p1 = d.slice(0, 2);
    const p2 = d.slice(2, 5);
    const p3 = d.slice(5, 8);
    const p4 = d.slice(8, 12);
    const p5 = d.slice(12, 14);
    let out = p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '/' + p4;
    if (p5) out += '-' + p5;
    return out;
  }

  function maskPhoneBR(v) {
    const d = onlyDigits(v).slice(0, 11);
    // (11) 99999-9999 ou (11) 9999-9999
    const ddd = d.slice(0, 2);
    const rest = d.slice(2);
    if (!ddd) return '';
    if (rest.length <= 4) return `(${ddd}) ${rest}`;
    if (rest.length <= 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }

  function maskInt(v) {
    const d = onlyDigits(v);
    return d ? String(parseInt(d, 10)) : '0';
  }

  // ===== Drawer control =====
  function openDrawer() {
    clearFormError();
    drawer?.classList.remove('hidden');
    drawerBackdrop?.classList.remove('hidden');
    drawer?.setAttribute('aria-hidden', 'false');
    drawerBackdrop?.setAttribute('aria-hidden', 'false');

    // reset (mas mantém créditos default)
    if (userForm) userForm.reset();
    if (f_credits) f_credits.value = '0';
    setTimeout(() => f_name?.focus(), 50);
  }

  function closeDrawer() {
    drawer?.classList.add('hidden');
    drawerBackdrop?.classList.add('hidden');
    drawer?.setAttribute('aria-hidden', 'true');
    drawerBackdrop?.setAttribute('aria-hidden', 'true');
  }

  function setFormError(msg) {
    if (!formError) return;
    formError.textContent = msg || '';
    formError.classList.remove('hidden');
  }

  function clearFormError() {
    if (!formError) return;
    formError.textContent = '';
    formError.classList.add('hidden');
  }

  // ===== Tabs / sections =====
  function showUsersPanel() {
    usersSection?.classList.remove('hidden');
    placeholderSection?.classList.add('hidden');
  }

  function showPlaceholder() {
    usersSection?.classList.add('hidden');
    placeholderSection?.classList.remove('hidden');
  }

  // ===== Load session / auth guard =====
  async function initAuth() {
    showOverlay();
    try {
      const { data: { session }, error } = await sb.auth.getSession();
      if (error) console.warn('getSession error:', error);

      if (!session) {
        // Se não tem sessão, manda pra login (mantém teu fluxo atual)
        window.location.href = './index.html';
        return;
      }

      // Puxa nome do perfil do admin (se tiver)
      userNameEl.textContent = session.user?.email || 'Admin';
      showUsersPanel();
      await loadUsers();
    } finally {
      hideOverlay();
    }
  }

  // ===== Data load (profiles + credits_balance) =====
  let _usersCache = [];
  async function loadUsers() {
    clearFormError();
    showOverlay();

    try {
      // 1) Busca profiles
      const { data: profiles, error: pErr } = await sb
        .from('profiles')
        .select('user_id,name,email,phone,cnpj,razao_social,setor,created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (pErr) {
        console.error(pErr);
        renderUsersError(pErr);
        return;
      }

      const list = profiles || [];

      if (list.length === 0) {
        _usersCache = [];
        renderUsers(_usersCache);
        return;
      }

      // 2) Busca credits_balance pros ids retornados
      const ids = list.map((r) => r.user_id).filter(Boolean);

      const { data: creditsRows, error: cErr } = await sb
        .from('credits_balance')
        .select('user_id,balance')
        .in('user_id', ids);

      if (cErr) {
        // Se credits_balance estiver com RLS ou algo, ainda renderiza com 0
        console.warn('credits_balance error:', cErr);
      }

      const creditsMap = new Map((creditsRows || []).map((r) => [r.user_id, r.balance ?? 0]));

      // 3) Mescla no front
      _usersCache = list.map((r) => ({
        user_id: r.user_id,
        name: r.name || '',
        email: r.email || '',
        phone: r.phone || '',
        cnpj: r.cnpj || '',
        razao_social: r.razao_social || '',
        setor: r.setor || '',
        credits: creditsMap.get(r.user_id) ?? 0,
      }));

      renderUsers(_usersCache);
    } catch (e) {
      console.error(e);
      renderUsersError({ message: String(e?.message || e) });
    } finally {
      hideOverlay();
    }
  }

  function renderUsersError(err) {
    if (!usersTbody) return;
    const msg = (err && err.message) ? err.message : 'Erro ao carregar';
    usersTbody.innerHTML = `<tr><td colspan="8" class="muted">Erro ao carregar: ${escapeHtml(msg)}</td></tr>`;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderUsers(list) {
    if (!usersTbody) return;

    if (!list || list.length === 0) {
      usersTbody.innerHTML = `<tr><td colspan="8" class="muted">Nenhum usuário encontrado.</td></tr>`;
      return;
    }

    usersTbody.innerHTML = list.map((u) => {
      return `
        <tr>
          <td>${escapeHtml(u.name)}</td>
          <td>${escapeHtml(u.cnpj)}</td>
          <td>${escapeHtml(u.razao_social)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td>${escapeHtml(u.phone)}</td>
          <td>${escapeHtml(String(u.credits ?? 0))}</td>
          <td class="muted">${escapeHtml(u.user_id)}</td>
          <td class="muted">—</td>
        </tr>
      `;
    }).join('');
  }

  function applyFilter() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) {
      renderUsers(_usersCache);
      return;
    }
    const filtered = _usersCache.filter((u) => {
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.cnpj || '').toLowerCase().includes(q) ||
        (u.razao_social || '').toLowerCase().includes(q)
      );
    });
    renderUsers(filtered);
  }

  // ===== Create user (Auth + DB) via Edge Function =====
  async function createUserViaEdge(payload) {
    const { data: { session } } = await sb.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Sessão inválida. Faça login novamente.');

    const url = `${cfg.SUPABASE_URL}/functions/v1/admin-create-user`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': cfg.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    const txt = await res.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : null; } catch {}

    if (!res.ok) {
      const msg = (json && (json.error || json.message)) ? (json.error || json.message) : (txt || `HTTP ${res.status}`);
      throw new Error(msg);
    }
    return json;
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
  }

  // ===== Bindings =====
  newBtn?.addEventListener('click', () => openDrawer());
  drawerCloseBtn?.addEventListener('click', () => closeDrawer());
  cancelBtn?.addEventListener('click', () => closeDrawer());
  drawerBackdrop?.addEventListener('click', () => closeDrawer());

  refreshBtn?.addEventListener('click', () => loadUsers());
  searchInput?.addEventListener('input', () => applyFilter());

  f_togglePw?.addEventListener('click', () => {
    if (!f_password) return;
    f_password.type = (f_password.type === 'password') ? 'text' : 'password';
    const icon = qs('i', f_togglePw);
    if (icon) icon.className = (f_password.type === 'password') ? 'fas fa-eye' : 'fas fa-eye-slash';
  });

  f_cnpj?.addEventListener('input', () => { f_cnpj.value = maskCNPJ(f_cnpj.value); });
  f_phone?.addEventListener('input', () => { f_phone.value = maskPhoneBR(f_phone.value); });
  f_credits?.addEventListener('input', () => { f_credits.value = maskInt(f_credits.value); });

  // Logout (mantém simples)
  logoutBtn?.addEventListener('click', async () => {
    if (!confirm('Desconectar?')) return;
    showOverlay();
    try {
      await sb.auth.signOut();
      window.location.href = './index.html';
    } finally {
      hideOverlay();
    }
  });

  // Submit
  userForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFormError();

    const name = (f_name?.value || '').trim();
    const email = (f_email?.value || '').trim().toLowerCase();
    const password = (f_password?.value || '').trim();

    const phone = (f_phone?.value || '').trim();
    const cnpj = (f_cnpj?.value || '').trim();
    const razao_social = (f_razao?.value || '').trim();
    const setor = (f_setor?.value || '').trim();
    const credits = parseInt(maskInt(f_credits?.value || '0'), 10) || 0;

    if (!name) return setFormError('Nome é obrigatório.');
    if (!email || !validateEmail(email)) return setFormError('E-mail inválido.');
    if (!password || password.length < 6) return setFormError('Senha deve ter pelo menos 6 caracteres.');

    showOverlay();
    try {
      await createUserViaEdge({
        email,
        password,
        profile: { name, email, phone, cnpj, razao_social, setor },
        credits,
      });

      closeDrawer();
      await loadUsers();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'Erro ao salvar.');
    } finally {
      hideOverlay();
    }
  });

  // Init UI for department tabs (mantém tua navegação simples)
  qsa('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      qsa('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const dep = btn.getAttribute('data-department');
      if (dep === 'usuarios') {
        showUsersPanel();
      } else {
        showPlaceholder();
      }
    });
  });

  // Init
  initAuth();
})();
