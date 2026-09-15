# Parkour Reborn Admin

Separate Next.js admin dashboard for the Parkour Reborn Hub. The public website in `../parkourreborn` is reference-only and is not imported at runtime.

## Local setup

1. Copy `.env.example` to `.env.local` and fill the required values.
2. Create an active `guessrMaps/{mapVersionId}` Firestore document.
3. Run `npm run dev` and open `http://localhost:3000`.
4. Follow [docs/SETUP.md](docs/SETUP.md) for Firebase, Discord, R2, super-admin, Vercel, and DNS setup.

The dashboard intentionally shows setup status and disables live uploads when services are missing.
