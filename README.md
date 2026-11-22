# Parkour Reborn Admin

Next.js admin dashboard for the Parkour Reborn Hub. The public website in `../parkourreborn` is used as the Firestore schema reference and is not imported at runtime.

## Local setup

1. Add the Firebase client/Admin, Discord OAuth, and R2 environment variables.
2. Create exactly one active `guessrMaps` document with `url`, `width`, `height`, and `active: true`.
3. Run `npm run dev` and open `http://localhost:3000`.

## Owner access

The protected owner identity is defined server-side as:

- Discord ID: `1020704620722528256`
- Firebase UID: `discord-1020704620722528256`

No manual Firestore record is required. The first successful Discord sign-in creates or repairs `admins/discord-1020704620722528256` with every permission. Owner status is never read from Firestore and cannot be granted through the dashboard.

Other admins are added on the Admins page by their Discord user ID. That creates `admins/discord-{id}` with `permissions` and `disabled`; their name shows as the ID until their first sign-in, when the Discord callback stores their Discord name. All Firestore access from the browser is denied; admin data is accessed through authenticated server routes.

## Tech list fields

Each `movement` doc has `Kind`, `Aliases`, `Steps`, `Ending`, `VideoUrl`, `EndingVideos`, `TutorialUrl` and `active`. A tech that ends in coyote time stops its steps at `Coyote Time` and sets `Ending` to its usual ending (`Powerslide`, `Jump` or `Slide Jump`, the one its clip shows). `VideoUrl` is that clip; `EndingVideos` holds optional clips for the other endings (`Powerslide`, `Jump`, `Slide Jump`, `None`), which the tech list shows when a player swaps the ending. Picking an ending in the editor removes old `Powerslide*` / `Jump*` steps, and changing it swaps the clips so `VideoUrl` keeps showing the usual one. `scripts/migrate-tech-list.mjs` in the website repo exports, converts and reimports the whole collection.

## Access levels

Each section has a level: None, View, Contribute and Admin (or View and Manage for shared content like the tech list). Contributors act on their own items; admins act on everyone's. The rules live in `src/lib/policy.ts` and are used by both the API routes and the UI.

Parkour Guessr:

| Action | Your own image | Someone else's |
|---|---|---|
| Edit | Contribute. Moving a published image sends it back to review unless you can publish it | Admin |
| Publish | Contribute + "Publish own images" | Admin |
| Disable | Contribute | Admin |
| Restore | Contribute, only if you disabled it | Admin |
| Delete permanently | Contribute, only if it was never published | Admin |

Uploading, editing, publishing or restoring an image within 50 m (in-game metres, same formula as the game) of another image in the same map, mode and difficulty asks for confirmation first. The server checks this too and answers `409` with `code: "nearby"` until the images are confirmed.

Permission names from before access levels (`guessr.images.*`, `announcements.manage`, `media.upload`, `media.delete`) are translated when an admin loads and rewritten the next time their access is saved.
