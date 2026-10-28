import {
  errorResponse,
  isRecord,
  jsonResponse,
  PagesContext,
  readJson,
  requireAdmin,
  requireSameOrigin,
  validBeer
} from '../../_shared';

function parseId(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export async function onRequestPut({ request, env, params }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const authError = await requireAdmin(request, env);
  if (authError) {
    return authError;
  }

  const id = parseId(params['id']);
  if (id === null) {
    return errorResponse('Der Biereintrag wurde nicht gefunden.', 404);
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
    const result = await env.Bierliste.prepare(
      'UPDATE "Bierliste" SET "Brauerei" = ?, "Biername" = ?, "Sorte" = ?, "Bewertung" = ?, "Adresse" = ? WHERE rowid = ?'
    ).bind(
      beer.Brauerei.trim(),
      beer.BierName.trim(),
      beer.Art.trim(),
      beer.Bewertung,
      beer.Adresse?.trim() || null,
      id
    ).run();
    return result.meta.changes === 0
      ? errorResponse('Der Biereintrag wurde nicht gefunden.', 404)
      : jsonResponse({ ok: true });
  } catch (error: unknown) {
    console.error('Could not update beer in D1.', error);
    return errorResponse('Das Bier konnte nicht in der Datenbank aktualisiert werden.', 500);
  }
}

export async function onRequestPatch({ request, env, params }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const authError = await requireAdmin(request, env);
  if (authError) {
    return authError;
  }

  const id = parseId(params['id']);
  if (id === null) {
    return errorResponse('Der Biereintrag wurde nicht gefunden.', 404);
  }

  const payload = await readJson(request);
  if (payload instanceof Response) {
    return payload;
  }

  if (!isRecord(payload) || typeof payload['marked'] !== 'boolean') {
    return errorResponse('Die Markierung ist ungültig.', 400);
  }

  try {
    const result = await env.Bierliste.prepare(
      'UPDATE "Bierliste" SET "marked" = ? WHERE rowid = ?'
    ).bind(payload['marked'] ? 1 : 0, id).run();
    return result.meta.changes === 0
      ? errorResponse('Der Biereintrag wurde nicht gefunden.', 404)
      : jsonResponse({ ok: true });
  } catch (error: unknown) {
    console.error('Could not update beer mark in D1.', error);
    return errorResponse('Die Markierung konnte nicht gespeichert werden.', 500);
  }
}

export async function onRequestDelete({ request, env, params }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const authError = await requireAdmin(request, env);
  if (authError) {
    return authError;
  }

  const id = parseId(params['id']);
  if (id === null) {
    return errorResponse('Der Biereintrag wurde nicht gefunden.', 404);
  }

  try {
    const result = await env.Bierliste.prepare(
      'DELETE FROM "Bierliste" WHERE rowid = ?'
    ).bind(id).run();
    return result.meta.changes === 0
      ? errorResponse('Der Biereintrag wurde nicht gefunden.', 404)
      : jsonResponse({ ok: true });
  } catch (error: unknown) {
    console.error('Could not delete beer from D1.', error);
    return errorResponse('Das Bier konnte nicht aus der Datenbank gelöscht werden.', 500);
  }
}
