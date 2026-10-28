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
