// supabase/functions/admin-create-user/index.ts
// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function withCors(res: Response) {
  const h = new Headers(res.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => h.set(k, v));
  return new Response(res.body, { status: res.status, headers: h });
}

function json(status: number, body: any) {
  return withCors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

serve(async (req) => {
  // ✅ SEMPRE responder preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
      return json(500, { error: "Missing function secrets" });
    }

    const authHeader = req.headers.get("authorization") || "";

    const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: callerErr } = await caller.auth.getUser();
    if (callerErr || !callerData?.user) return json(401, { error: "Not authenticated" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: adminRow, error: adminErr } = await admin
      .from("admins")
      .select("user_id")
      .eq("user_id", callerData.user.id)
      .maybeSingle();

    if (adminErr) return json(500, { error: adminErr.message });
    if (!adminRow) return json(403, { error: "Forbidden (not admin)" });

    const body = await req.json().catch(() => null);

    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const credits = Number(body?.credits ?? 0) || 0;

    const profile = body?.profile || {};
    const name = String(profile?.name || "").trim();
    const phone = profile?.phone ?? null;
    const cnpj = profile?.cnpj ?? null;
    const razao_social = profile?.razao_social ?? null;
    const setor = profile?.setor ?? null;

    if (!email) return json(400, { error: "Email is required" });
    if (!password || password.length < 6) return json(400, { error: "Password must be >= 6 chars" });
    if (!name) return json(400, { error: "Name is required" });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createErr || !created?.user) return json(400, { error: createErr?.message || "Create user failed" });

    const user_id = created.user.id;

    const { error: pErr } = await admin.from("profiles").upsert(
      {
        user_id,
        name,
        email,
        phone,
        cnpj,
        razao_social,
        setor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (pErr) return json(500, { error: pErr.message });

    const { error: cErr } = await admin.from("credits_balance").upsert(
      { user_id, balance: credits, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (cErr) return json(500, { error: cErr.message });

    return json(200, { ok: true, user_id });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
});
