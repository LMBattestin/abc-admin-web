// supabase/functions/admin-create-user/index.ts
// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing function secrets" }), { status: 500 });
  }

  const authHeader = req.headers.get("authorization") || "";

  // client com token do caller
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: callerData, error: callerErr } = await caller.auth.getUser();
  if (callerErr || !callerData?.user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
  }

  // service role
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // valida admin
  const { data: adminRow, error: adminErr } = await admin
    .from("admins")
    .select("user_id")
    .eq("user_id", callerData.user.id)
    .maybeSingle();

  if (adminErr) return new Response(JSON.stringify({ error: adminErr.message }), { status: 500 });
  if (!adminRow) return new Response(JSON.stringify({ error: "Forbidden (not admin)" }), { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return new Response(JSON.stringify({ error: "email e password são obrigatórios" }), { status: 400 });
  }

  const email = String(body.email).trim().toLowerCase();
  const password = String(body.password);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr || !created?.user) {
    return new Response(JSON.stringify({ error: createErr?.message || "Falha ao criar user" }), { status: 400 });
  }

  const user_id = created.user.id;

  const { error: pErr } = await admin.from("profiles").upsert(
    {
      user_id,
      name: body.name ?? "",
      email,
      phone: body.phone ?? null,
      cnpj: body.cnpj ?? null,
      razao_social: body.razao_social ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (pErr) return new Response(JSON.stringify({ error: pErr.message }), { status: 500 });

  const credits = Number(body.credits) || 0;
  const { error: cErr } = await admin.from("credits_balance").upsert(
    { user_id, balance: credits, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (cErr) return new Response(JSON.stringify({ error: cErr.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true, user_id }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
