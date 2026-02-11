// supabase/functions/admin-create-user/index.ts
// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json(401, { error: "Missing bearer token" });

    // 1) valida quem chamou (com anon + bearer do admin)
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: caller, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller?.user) return json(401, { error: "Invalid session" });

    // 2) service client (bypass RLS + create auth user)
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 3) checa se caller é admin
    const { data: adminRow, error: adminCheckErr } = await adminClient
      .from("admins")
      .select("user_id")
      .eq("user_id", caller.user.id)
      .maybeSingle();

    if (adminCheckErr) return json(500, { error: adminCheckErr.message });
    if (!adminRow) return json(403, { error: "Not authorized (admins only)" });

    // 4) payload
    const payload = await req.json();
    const email = (payload?.email || "").toString().trim().toLowerCase();
    const password = (payload?.password || "").toString();
    const credits = Number(payload?.credits ?? 0) || 0;

    const profile = payload?.profile || {};
    const name = (profile?.name || "").toString().trim();
    const phone = (profile?.phone || null);
    const cnpj = (profile?.cnpj || null);
    const razao_social = (profile?.razao_social || null);
    const setor = (profile?.setor || null);

    if (!email) return json(400, { error: "Email is required" });
    if (!password || password.length < 6) return json(400, { error: "Password must be >= 6 chars" });
    if (!name) return json(400, { error: "Name is required" });

    // 5) cria usuário no AUTH (email_confirm true evita depender de confirmação)
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createErr) return json(400, { error: createErr.message });
    const userId = created.user?.id;
    if (!userId) return json(500, { error: "Auth user id missing" });

    // 6) grava/atualiza profile
    const { error: profileErr } = await adminClient
      .from("profiles")
      .upsert({
        user_id: userId,
        name,
        email,
        phone,
        cnpj,
        razao_social,
        setor,
      }, { onConflict: "user_id" });

    if (profileErr) return json(500, { error: profileErr.message });

    // 7) grava/atualiza créditos
    const { error: creditsErr } = await adminClient
      .from("credits_balance")
      .upsert({
        user_id: userId,
        balance: credits,
      }, { onConflict: "user_id" });

    if (creditsErr) return json(500, { error: creditsErr.message });

    return json(200, { ok: true, user_id: userId });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
});
