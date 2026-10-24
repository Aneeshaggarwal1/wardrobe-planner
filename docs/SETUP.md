# Setting up accounts (Supabase + Claude API)

Demo mode needs none of this. These steps turn on sign-in, your own photos and AI tagging. Everything here runs on free tiers except Claude API usage, which costs cents for a wardrobe.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (any region close to you).
2. **SQL Editor → New query**: paste the whole of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) and press **Run**. It creates the tables, row-level security, the private `wardrobe` photo bucket and the `wp_commit` function. It is safe to run again.
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (later, your Vercel URL)
   - Redirect URLs: `http://localhost:3000/**`, plus `http://<your-computer's-LAN-IP>:3000/**` to sign in from your phone on home Wi-Fi.
4. **Project Settings → API**: copy the **Project URL** and the public key (**anon public**, or **Publishable key** on newer projects).

Email sign-in links work out of the box. Supabase's built-in mailer is rate-limited and meant for testing, which is fine for personal use.

### Optional: Google sign-in

1. In Google Cloud Console create an OAuth client (type *Web application*) with the authorised redirect URI shown in Supabase under **Authentication → Providers → Google**.
2. Paste the client ID and secret into that Supabase page and enable the provider.

## 2. Claude API key

1. At [console.anthropic.com](https://console.anthropic.com): add credits, then set a **monthly spend limit** under Limits.
2. **API Keys → Create key**.

## 3. `.env.local`

Copy `.env.example` to `.env.local` in the project folder and fill in the three values. Then rebuild, because the public Supabase values are baked into the build:

```bash
npm run build && npm run start -- -H 0.0.0.0
```

## How the pieces fit

- The browser signs in with Supabase and uploads resized photos straight to the private bucket, into a folder named after the user's id. Storage policies refuse any other folder.
- Every other change goes through the app's API routes. They run as the signed-in user (no service-role key on the server), apply the same pure TypeScript rules demo mode uses (`lib/ops.ts`), diff the before and after, and commit the difference in one transaction with `wp_commit`.
- The Claude API key only exists on the server. Tagging and re-ranking are capped per user per day (60 photos, 10 generations) and fall back to rules if the model is unavailable.
