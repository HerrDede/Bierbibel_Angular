import {
  errorResponse,
  hasAuthConfiguration,
  hasValidSession,
  jsonResponse,
  PagesContext
} from '../../_shared';

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!hasAuthConfiguration(env)) {
    return errorResponse('Die Admin-Anmeldung ist auf dem Server nicht vollständig konfiguriert.', 503);
  }

  try {
    const authenticated = await hasValidSession(request, env.SESSION_SECRET!);
    return jsonResponse({ authenticated });
  } catch (error: unknown) {
    console.error('Could not verify admin session.', error);
    return errorResponse('Der Anmeldestatus konnte nicht geprüft werden.', 500);
  }
}
