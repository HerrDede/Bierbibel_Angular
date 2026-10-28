import { geocodeMissingBreweries, GeocodingError } from '../../_geocoding';
import {
  errorResponse,
  jsonResponse,
  PagesContext,
  requireAdmin,
  requireSameOrigin
} from '../../_shared';

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const authError = await requireAdmin(request, env);
  if (authError) {
    return authError;
  }

  try {
    return jsonResponse(await geocodeMissingBreweries(env));
  } catch (error: unknown) {
    console.error('Could not geocode missing breweries.', error);
    if (error instanceof GeocodingError) {
      return errorResponse(error.message, error.status);
    }

    return errorResponse('Die Brauereistandorte konnten nicht aktualisiert werden.', 500);
  }
}
