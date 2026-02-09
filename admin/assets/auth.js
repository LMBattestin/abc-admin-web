// admin/assets/auth.js
(function () {
  const CFG = window.ABC_ADMIN_CONFIG;

  function renderFatal(msg) {
    const safe = String(msg || "Erro desconhecido.");
    document.body.innerHTML = `
      <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6f8;font-family:Inter,Roboto,Arial;padding:24px;">
        <div style="max-width:760px;background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.12);padding:22px;">
          <h2 style="margin:0 0 8px;color:#991b1b;font-size:18px;">Erro no Admin</h2>
          <p style="margin:0;color:#334155;line-height:1.45;">${safe}</p>
          <p style="margin:14px 0 0;color:#64748b;font-size:12px;">
            Dica: abra o Console do navegador para detalhes (F12).
          </p>
        </div>
      </div>`;
  }

  function fatal(msg) {
    renderFatal(msg);
    throw new Error(msg);
  }

  if (!CFG || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
    fatal("Config do Supabase ausente em <b>/admin/assets/config.js</b> (ABC_ADMIN_CONFIG).");
  }
  if (!window.supabase || !window.supabase.createClient) {
    fatal("SDK do Supabase não carregou. Verifique se o script CDN do supabase-js está antes do auth.js.");
  }

  const client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  function showLoading(text) {
    const el = document.getElementById("loading");
    const t = document.getElementById("loading-text");
    if (t && text) t.textContent = text;
    if (el) el.classList.remove("hidden");
  }
  function hideLoading() {
    const el = document.getElementById("loading");
    if (el) el.classList.add("hidden");
  }

  function showInlineError(msg) {
    // tenta achar um container de erro padrão
    const err = document.getElementById("err") || document.getElementById("page-error");
    if (err) {
      err.textContent = String(msg || "Erro.");
      err.classList.remove("hidden");
      return;
    }
    // fallback: alerta simples
    alert(String(msg || "Erro."));
  }

  function timeoutPromise(ms, label) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(label || "Timeout")), ms);
    });
  }

  // anti-loop bem direto
  function bumpLoopGuard() {
    const k = "__abc_admin_loop_guard";
    const now = Date.now();
    const v = JSON.parse(localStorage.getItem(k) || "[]").filter((t) => now - t < 5000);
    v.push(now);
    localStorage.setItem(k, JSON.stringify(v));
    return v.length;
  }

  async function safeGetSession() {
    // getSession deveria ser rápido (localStorage), então timeout curto já denuncia travamento.
    const { data } = await Promise.race([
      client.auth.getSession(),
      timeoutPromise(2500, "Timeout ao ler sessão (getSession).")
    ]);
    return data?.session || null;
  }

  window.__ABC = {
    supabase: client,
    cfg: CFG,
    showLoading,
    hideLoading,
    showInlineError,
    timeoutPromise,
    bumpLoopGuard,
    async getSession() {
      return await safeGetSession();
    },
    async clearAuth() {
      try { await client.auth.signOut(); } catch (_) {}
      try {
        // limpa chaves comuns do supabase no storage
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith("sb-") || k.includes("supabase")) localStorage.removeItem(k);
        });
      } catch (_) {}
    }
  };
})();
