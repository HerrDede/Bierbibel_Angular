import {
  createSessionCookie,
  errorResponse,
  hasAuthConfiguration,
  isRecord,
  jsonResponse,
  PagesContext,
  passwordMatches,
  readJson,
  requireSameOrigin
} from '../../_shared';

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  if (!hasAuthConfiguration(env)) {
    return errorResponse('Die Admin-Anmeldung ist auf dem Server nicht vollständig konfiguriert.', 503);
  }

  const payload = await readJson(request);
  if (payload instanceof Response) {
    return payload;
  }

  if (!isRecord(payload) || typeof payload['password'] !== 'string' || payload['password'].length > 256) {
    return errorResponse('Bitte gib ein gültiges Passwort ein.', 400);
  }

  try {
    if (!await passwordMatches(payload['password'], env.ADMIN_PASSWORD!)) {
      return errorResponse('Das Passwort ist nicht korrekt.', 401);
    }

    const headers = new Headers();
    headers.append('Set-Cookie', await createSessionCookie(request, env.SESSION_SECRET!));
    return jsonResponse({ authenticated: true }, 200, headers);
  } catch (error: unknown) {
    console.error('Could not create admin session.', error);
    return errorResponse('Die Anmeldung konnte nicht abgeschlossen werden.', 500);
  }
}
