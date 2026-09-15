# Parkour Reborn Admin

Next.js admin dashboard for the Parkour Reborn Hub. The public website in `../parkourreborn` is used as the Firestore schema reference and is not imported at runtime.

## Local setup

1. Add the Firebase client/Admin, Discord OAuth, R2, and Guessr map environment variables.
2. Create an active `guessrMaps/{mapVersionId}` document.
3. Run `npm run dev` and open `http://localhost:3000`.

## Owner access

The protected owner identity is defined server-side as:

- Discord ID: `1020704620722528256`
- Firebase UID: `discord-1020704620722528256`

No manual Firestore record is required. The first successful Discord sign-in creates or repairs `admins/discord-1020704620722528256` with every permission. Owner status is never read from Firestore and cannot be granted through the dashboard.

Other admins use documents in `admins/{firebaseUid}` with `displayName`, `permissions`, and `disabled`. All Firestore access from the browser is denied; admin data is accessed through authenticated server routes.
