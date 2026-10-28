# BierBibel Angular

The Angular app and its Cloudflare Pages Functions run from the same Pages project. The website is built with `npm run build` into `dist/bierbibel-angular/browser`; Pages Functions live in the repository's `functions/` directory and expose the `/api` endpoints.

## Start

From this folder, run:

```sh
npm install
npm start
```

`npm start` starts only the Angular development server. To test the API locally, use Cloudflare Pages local development (`wrangler pages dev`) with a D1 binding and local secrets, or deploy to a Pages preview environment.

## Pages and features

- `/` — browse all beers, search and sort every column, see the latest entry and total, search beer images from a beer name, and open saved brewery addresses in Apple Maps.
- `/anmeldung` — sign in and mark or unmark beers for review.
- `/admin` — sign in, add, edit, and delete beers; select multiple entries to update their brewery and address from an Open Brewery DB suggestion. Brewery suggestions match brewery names, cities, and addresses. When the database is empty, the admin can import the bundled starting list once.

## Cloudflare Pages setup

The Pages project should use:

- Root directory: `Bierbibel-Angular`
- Build command: `npm run build`
- Build output directory: `dist/bierbibel-angular/browser`
- D1 binding variable name: `Bierliste`, pointing to the `bierbibel-db` database

Add these as **Secrets** in Pages project **Settings → Variables and Secrets** for the production environment (and preview too, if you use previews):

- `ADMIN_PASSWORD` — a unique, randomly generated password of at least 16 characters.
- `SESSION_SECRET` — a separate random secret of at least 32 characters, used to sign sessions. Generate one with `openssl rand -hex 32`.

Do not put either secret in Angular source, Git, or ordinary client-visible variables. Redeploy Pages after changing bindings or secrets so the Functions receive them.

## D1 setup and initial import

The Functions expect the table `Bierliste` to have the columns `Brauerei`, `Biername`, `Sorte`, `Bewertung`, `marked`, and `Adresse`, plus a SQLite `rowid`. The `rowid` is used as a stable API identifier. Apply the migrations in order in the Cloudflare D1 Console against `bierbibel-db` before deploying code that uses them. For the existing database, which already has `marked`, run the new address migration:

```sql
ALTER TABLE "Bierliste"
ADD COLUMN "Adresse" TEXT;
```

After deploying the Functions and configuring the secrets:

1. Open `/admin` and sign in with `ADMIN_PASSWORD`.
2. If the table is empty, click **Startliste importieren**. The server accepts this operation only while the table is empty, so it cannot overwrite an existing list.
3. The public home page reads the list from D1. Adding, editing, deleting, or marking a beer then updates the shared database and is visible to other visitors. Selecting an Open Brewery DB suggestion saves its address; the brewery name then opens Apple Maps. Existing entries have no address until one is selected while adding, editing, or bulk-updating.

The import reads the public bundled file `src/assets/biere.json`. It does not import data that existed only in a browser's old `localStorage`.

## Server-side authentication

The public `GET /api/beers` endpoint does not require a login. Login, logout, initial import, and every create, update, or delete request are handled by Pages Functions. Successful login sets a signed, `HttpOnly`, `SameSite=Strict` session cookie (eight-hour lifetime; `Secure` on HTTPS). The server checks that cookie and the request origin before any write. The password is compared on the server and is not embedded in the Angular bundle.

For production, add a Cloudflare rate-limiting rule for `POST /api/auth/login` to slow password guessing.

Angular's regular `npm start` server does not execute Pages Functions. Use Wrangler Pages local development or a Cloudflare Pages preview to test sign-in and D1-backed changes.
