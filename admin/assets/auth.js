// admin/assets/auth.js
(function () {
  const CFG = window.ABC_ADMIN_CONFIG;

  function fatal(msg) {
    document.body.innerHTML = `
      <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f6f8;font-family:Arial;padding:24px;">
        <div style="max-width:680px;background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.12);padding:22px;">
          <h2 style="margin:0 0 8px;color:#991b1b;">Falha de configuração</h2>
          <p style="margin:0;color:#334155;line-height:1.45;">${msg}</p>
        </div>
      </div>`;
    throw new Error(msg);
  }

  if (!CFG || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
    fatal("Config do Supabase ausente em <b>/admin/assets/config.js</b> (ABC_ADMIN_CONFIG).");
  }
  if (!window.supabase || !window.supabase.createClient) {
    fatal("SDK do Supabase não carregou. Verifique o script CDN antes do JS da página.");
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

  window.__ABC = {
    supabase: client,
    cfg: CFG,
    showLoading,
    hideLoading,
    async getSession() {
      const { data } = await client.auth.getSession();
      return data?.session || null;
    },
    async requireSessionOrRedirect(toLoginUrl) {
      const s = await this.getSession();
      if (!s) {
        window.location.replace(toLoginUrl);
        return null;
      }
      return s;
    }
  };
})();
