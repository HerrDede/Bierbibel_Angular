import {
  errorResponse,
  isRecord,
  jsonResponse,
  PagesContext,
  readJson,
  requireAdmin,
  requireSameOrigin,
  validBeer
} from '../_shared';

export async function onRequestGet({ env }: PagesContext): Promise<Response> {
  try {
    const { results } = await env.Bierliste.prepare(
      'SELECT rowid AS id, "Brauerei", "Biername" AS "BierName", "Sorte" AS "Art", "Bewertung", "Adresse", "marked" FROM "Bierliste" ORDER BY rowid'
    ).all();
    return jsonResponse(results);
  } catch (error: unknown) {
    console.error('Could not load beers from D1.', error);
    return errorResponse('Die Bierliste konnte nicht aus der Datenbank geladen werden.', 500);
  }
}

export async function onRequestPut({ request, env }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const authError = await requireAdmin(request, env);
  if (authError) {
    return authError;
  }

  const payload = await readJson(request);
  if (payload instanceof Response) {
    return payload;
  }

  if (!isRecord(payload)) {
    return errorResponse('Die Brauereiänderung ist ungültig.', 400);
  }

  const ids = payload['ids'];
  const brauerei = payload['brauerei'];
  const adresse = payload['adresse'];
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500
    || !ids.every((id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
    || new Set(ids).size !== ids.length
    || typeof brauerei !== 'string' || brauerei.trim().length === 0 || brauerei.length > 200
    || !(adresse === null || (typeof adresse === 'string' && adresse.trim().length > 0 && adresse.length <= 500))) {
    return errorResponse('Bitte wähle bis zu 500 gültige Einträge und eine gültige Brauerei aus.', 400);
  }

  const idsJson = JSON.stringify(ids);
  try {
    const result = await env.Bierliste.prepare(
      `UPDATE "Bierliste"
       SET "Brauerei" = ?, "Adresse" = ?
       WHERE rowid IN (SELECT value FROM json_each(?))
         AND (SELECT COUNT(*) FROM "Bierliste" WHERE rowid IN (SELECT value FROM json_each(?))) = ?`
    ).bind(brauerei.trim(), adresse?.trim() || null, idsJson, idsJson, ids.length).run();

    return result.meta.changes === ids.length
      ? jsonResponse({ ok: true, updated: result.meta.changes })
      : errorResponse('Mindestens ein ausgewählter Eintrag wurde nicht gefunden. Bitte lade die Liste neu.', 409);
  } catch (error: unknown) {
    console.error('Could not update selected brewery entries in D1.', error);
    return errorResponse('Die ausgewählten Einträge konnten nicht aktualisiert werden.', 500);
  }
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const authError = await requireAdmin(request, env);
  if (authError) {
    return authError;
  }

  const payload = await readJson(request);
  if (payload instanceof Response) {
    return payload;
  }

  if (!isRecord(payload)) {
    return errorResponse('Die Bierdaten sind ungültig.', 400);
  }

  const beer = {
    Brauerei: payload['brauerei'],
    BierName: payload['bierName'],
    Art: payload['art'],
    Bewertung: payload['bewertung'],
    Adresse: payload['adresse']
  };
  if (!validBeer(beer) || typeof beer.Bewertung !== 'number') {
    return errorResponse('Bitte gib eine gültige Brauerei, einen Biernamen, eine Sorte und eine endliche Bewertung ein.', 400);
  }

  try {
    await env.Bierliste.prepare(
      'INSERT INTO "Bierliste" ("Brauerei", "Biername", "Sorte", "Bewertung", "Adresse", "marked") VALUES (?, ?, ?, ?, ?, 0)'
    ).bind(
      beer.Brauerei.trim(),
      beer.BierName.trim(),
      beer.Art.trim(),
      beer.Bewertung,
      beer.Adresse?.trim() || null
    ).run();
    return jsonResponse({ ok: true }, 201);
  } catch (error: unknown) {
    console.error('Could not add a beer to D1.', error);
    return errorResponse('Das Bier konnte nicht in der Datenbank gespeichert werden.', 500);
  }
}
