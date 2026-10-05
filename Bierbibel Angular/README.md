# BierBibel Angular

The Angular app runs on its own. It includes a snapshot of the full beer list at `src/assets/biere.json`; no PHP server, network API, or external data service is required to use it.

## Start

From this folder, run:

```sh
npm install
npm start
```

Open the local URL printed by Angular CLI. `npm run build` creates the deployable website in `dist/bierbibel-angular/browser`.

## Pages and features

- `/` — browse all bundled beers, search and sort every column, see the latest entry and total, refresh the browser-saved collection, and open brewery image search.
- `/anmeldung` — sign in and mark or unmark beers for review.
- `/admin` — sign in, add beers, and delete entries.
- The old `index.html`, `anmeldung.html`, `admin.html`, `backup.html`, and `test.html` paths redirect to their Angular pages if served through Angular's route fallback.

## Local data and access-code limitations

The first launch imports the bundled JSON list into this browser's `localStorage`. Changes to ratings/review marks and new/deleted entries persist in that browser, including after restarting Angular. They do not sync across browsers/devices and are not written back into the bundled JSON. Clear this site's local storage to restore the bundled starting list.

The old login flow is reproduced as a browser-only convenience gate using the existing access code. A frontend-only app cannot securely protect admin features: the code and list are downloadable and users can bypass the gate. Use a server-side API with authentication if the app will be public or shared.
