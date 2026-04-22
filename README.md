# ROI Manifold

Vercel-ready React + Vite app created from the provided artifact.

## Local run

```bash
npm install
npm run dev
```

## Production build

```bash
npm install
npm run build
```

## Deploy to Vercel

### Option 1: GitHub + Vercel dashboard
1. Push this folder to a GitHub repo.
2. In Vercel, choose **Add New Project**.
3. Import the GitHub repo.
4. Keep the default framework/build settings. Vercel should detect **Vite** automatically.
5. Deploy.

### Option 2: Vercel CLI
```bash
npm install -g vercel
vercel
```

When prompted:
- Set up and deploy: **yes**
- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

## Notes
- This app is static and does not require Railway or a backend.
- Tailwind is included because the original artifact uses Tailwind utility classes extensively.
- Three.js, Recharts, and lucide-react are included as dependencies required by the provided component.
