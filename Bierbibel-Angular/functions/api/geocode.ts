import { errorResponse, isRecord, jsonResponse, PagesContext, readJson, requireSameOrigin } from '../_shared';

interface GeocodeRequest {
  id: string;
  address: string;
}

interface GeocodeResult {
  id: string;
  latitude: number | null;
  longitude: number | null;
  error?: string;
}

function isGeocodeRequest(value: unknown): value is GeocodeRequest {
  return isRecord(value)
    && typeof value['id'] === 'string'
    && value['id'].trim().length > 0
    && value['id'].length <= 200
    && typeof value['address'] === 'string'
    && value['address'].trim().length > 0
    && value['address'].length <= 500;
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const payload = await readJson(request);
  if (payload instanceof Response) {
    return payload;
  }

  if (!isRecord(payload) || !Array.isArray(payload['locations'])
    || payload['locations'].length === 0 || payload['locations'].length > 100
    || !payload['locations'].every(isGeocodeRequest)
    || new Set(payload['locations'].map((location) => location.id)).size !== payload['locations'].length) {
    return errorResponse('Die Adressliste ist ungültig oder enthält mehr als 100 Einträge.', 400);
  }

  const apiKey = env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    return errorResponse('Die Brauereikarte ist noch nicht konfiguriert. Bitte hinterlege GEOAPIFY_API_KEY in Cloudflare Pages.', 503);
  }

  const locations = payload['locations'];
  const results: GeocodeResult[] = new Array(locations.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(5, locations.length) }, async () => {
    while (nextIndex < locations.length) {
      const index = nextIndex++;
      const location = locations[index];
      const params = new URLSearchParams({
        text: location.address.trim(),
        format: 'json',
        limit: '1',
        apiKey
      });

      try {
        const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`, {
          signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) {
          results[index] = {
            id: location.id,
            latitude: null,
            longitude: null,
            error: 'Der Geocoding-Dienst konnte diese Adresse nicht verarbeiten.'
          };
          continue;
        }

        const responseBody: unknown = await response.json();
        if (!isRecord(responseBody) || !Array.isArray(responseBody['results'])) {
          results[index] = {
            id: location.id,
            latitude: null,
            longitude: null,
            error: 'Der Geocoding-Dienst hat ein ungültiges Ergebnis geliefert.'
          };
          continue;
        }

        const firstResult: unknown = responseBody['results'][0];
        if (!isRecord(firstResult)
          || typeof firstResult['lat'] !== 'number'
          || !Number.isFinite(firstResult['lat'])
          || typeof firstResult['lon'] !== 'number'
          || !Number.isFinite(firstResult['lon'])) {
          results[index] = {
            id: location.id,
            latitude: null,
            longitude: null,
            error: 'Für diese Adresse wurden keine Koordinaten gefunden.'
          };
          continue;
        }

        results[index] = {
          id: location.id,
          latitude: firstResult['lat'],
          longitude: firstResult['lon']
        };
      } catch (error: unknown) {
        console.error('Could not geocode a brewery address.', error);
        results[index] = {
          id: location.id,
          latitude: null,
          longitude: null,
          error: 'Der Geocoding-Dienst ist momentan nicht erreichbar.'
        };
      }
    }
  });

  await Promise.all(workers);
  return jsonResponse({ results });
}
