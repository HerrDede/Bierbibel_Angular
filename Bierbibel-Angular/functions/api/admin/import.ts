import {
  errorResponse,
  jsonResponse,
  PagesContext,
  readJson,
  requireAdmin,
  requireSameOrigin,
  validBeer
} from '../../_shared';

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const authError = await requireAdmin(request, env);
  if (authError) {
    return authError;
  }

  const payload = await readJson(request, MAX_IMPORT_BYTES);
  if (payload instanceof Response) {
    return payload;
  }

  if (!Array.isArray(payload) || payload.length === 0 || payload.length > MAX_IMPORT_ROWS
    || !payload.every((beer) => validBeer(beer))) {
    return errorResponse('Die Importliste ist leer oder enthält ungültige Bierdaten.', 400);
  }

  const rows = payload.map((beer) => ({
    Brauerei: beer.Brauerei.trim(),
    Biername: beer.BierName.trim(),
    Sorte: beer.Art.trim(),
    Bewertung: beer.Bewertung
  }));

  try {
    const result = await env.Bierliste.prepare(
      `INSERT INTO "Bierliste" ("Brauerei", "Biername", "Sorte", "Bewertung", "marked")
       SELECT json_extract(value, '$.Brauerei'), json_extract(value, '$.Biername'),
              json_extract(value, '$.Sorte'), json_extract(value, '$.Bewertung'), 0
       FROM json_each(?)
       WHERE NOT EXISTS (SELECT 1 FROM "Bierliste")`
    ).bind(JSON.stringify(rows)).run();

    return result.meta.changes === rows.length
      ? jsonResponse({ ok: true, imported: result.meta.changes }, 201)
      : errorResponse('Der Import ist nur möglich, wenn die Bierliste noch leer ist.', 409);
  } catch (error: unknown) {
    console.error('Could not import the bundled beer list into D1.', error);
    return errorResponse('Die Startliste konnte nicht importiert werden.', 500);
  }
}
