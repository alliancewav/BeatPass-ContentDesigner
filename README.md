# Content Designer

A self-contained Instagram carousel generator for Ghost CMS blog articles.

## Setup

```bash
npm install
npm run dev       # Dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

## Configuration

Edit `src/config.js` to customize:

- **Ghost API** — `ghost.apiUrl` and `ghost.contentApiKey`
- **Password** — `auth.passwordHash` (SHA-256 hash of your password)
- **Branding** — `brand.name`, `brand.domain`, logo URLs, favicon

### Changing the password

Open browser console and run:

```js
crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_NEW_PASSWORD'))
  .then(h => Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2,'0')).join(''))
  .then(console.log)
```

Replace the hash in `src/config.js` → `auth.passwordHash`.

## Deployment

**Live URL:** https://blog.beatpass.ca/assets/content-designer/index.html

### Quick deploy (recommended)

```bash
bash deploy.sh
```

This builds and copies `dist/` into the Ghost theme's assets directory, making it publicly accessible at the URL above.

### Alternative deployment targets

- **Netlify / Vercel / Cloudflare Pages** — point to this directory, build command: `npm run build`
- **Standalone** — serve `dist/` with any static file server

## Stack

- Vite + React 18
- Tailwind CSS 3
- html2canvas (PNG export)
- JSZip + file-saver (ZIP export)
- Ghost Content API (article data)
