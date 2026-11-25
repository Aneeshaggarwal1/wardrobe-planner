# Setting up your own wardrobe

The demo needs nothing. To tag your own clothes with AI you need a Claude API key and a passcode, set on whichever server runs the app: your computer or Vercel.

Your wardrobe itself is never stored online. It lives in your phone's browser (IndexedDB); photos are resized on the phone, sent to the AI once to be tagged, and only a small thumbnail is kept, on the phone.

## 1. Claude API key

At [console.anthropic.com](https://console.anthropic.com): add credits, set a **monthly spend limit** (under Limits), then **API Keys → Create key**. Tagging a 25-item wardrobe costs well under a dollar.

## 2. Run it

**On your computer (same Wi-Fi as your phone):**

```bash
cp .env.example .env.local      # then fill in ANTHROPIC_API_KEY and APP_PASSCODE
npm run build && npm run start -- -H 0.0.0.0
```

Open `http://<your-computer's-IP>:3000` on your phone (`ipconfig getifaddr en0` on a Mac shows the IP).

**On Vercel (works anywhere, and installs as an app):**

1. At [vercel.com](https://vercel.com), sign in with GitHub → **Add New → Project** → import this repository.
2. Under **Environment Variables** add `ANTHROPIC_API_KEY`, `APP_PASSCODE` and optionally `ANTHROPIC_MODEL`.
3. **Deploy**. Every push to `main` redeploys.

## 3. On your phone

1. Open the site and tap **Set up my wardrobe**.
2. iPhone: Share → **Add to Home Screen**. Android: menu → **Install app**. Use the app from the home screen from then on; its storage is separate from the browser tab's.
3. **Add items**: enter your passcode once, then pick 15–25 photos, one garment each.
4. **Wardrobe → Back up** every so often, and keep the file in iCloud Drive or Google Drive. **Restore** puts it back on a new phone or after the browser is cleared.

## Want accounts and sync instead?

The `supabase-backend` branch has a cloud version: sign-in, Postgres with row-level security, and private photo storage, using the same rules (`lib/ops.ts`). It needs a free Supabase project.
