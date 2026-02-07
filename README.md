# ore-admin-web_v2 (Cloudflare Pages)

Projeto **estático** (HTML/CSS/JS) para o painel Admin do ORE — pensado para rodar direto no **Cloudflare Pages** sem build.

## Deploy (Cloudflare Pages)
1. Crie/abra o projeto no Cloudflare Pages e conecte o repositório.
2. **Framework preset:** None
3. **Build command:** (vazio)
4. **Output directory:** `/` (raiz do repo)

Qualquer `git push` publica automaticamente.

## Rotas
- `/admin/` -> painel
- `/` -> redireciona para `/admin/`

## Supabase
As configurações estão em `admin/assets/config.js` (URL + anon key).  
⚠️ Nunca coloque service-role no browser.

O painel usa:
- `supabase.auth.signInWithPassword`
- Edge Function: `https://<project>.functions.supabase.co/functions/v1/admin`

A Edge Function precisa aceitar:
- GET (lista)
- POST action=create
- POST action=adjust_credits
- DELETE ?userId=

> Observação: edição completa (nome/cnpj/razão/email) depende de endpoint no backend.
