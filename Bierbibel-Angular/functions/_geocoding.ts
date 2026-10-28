import { Env, isRecord } from './_shared';

export type BreweryGeocodeStatus = 'found' | 'not_found' | 'unavailable';

interface BreweryNameRow {
  name: string;
}

interface StoredBreweryLocation {
  name_key: string;
  status: 'found' | 'not_found';
}

interface GeoapifyResult {
  lat?: unknown;
  lon?: unknown;
  formatted?: unknown;
}

export interface BreweryMapEntry {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationStatus: 'found' | 'not_found' | 'pending';
  beerCount: number;
}

export interface GeocodeBatchResult {
  processed: number;
  remaining: number;
  found: number;
  notFound: number;
}

export class GeocodingError extends Error {
  constructor(message: string, readonly status: 502 | 503) {
    super(message);
  }
}

const GEOCODE_BATCH_SIZE = 5;

export function breweryKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
}

export async function ensureBreweryLocation(
  env: Env,
  breweryName: string
): Promise<BreweryGeocodeStatus> {
  const key = breweryKey(breweryName);
  if (!key || !env.GEOAPIFY_API_KEY) {
    return 'unavailable';
  }

  const existing = await env.Bierliste.prepare(
    'SELECT "status" FROM "BrauereiStandorte" WHERE "name_key" = ?'
  ).bind(key).first<{ status: string }>();
  if (existing?.status === 'found' || existing?.status === 'not_found') {
    return existing.status;
  }

  const url = new URL('https://api.geoapify.com/v1/geocode/search');
  url.searchParams.set('text', `${breweryName} Brauerei`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('apiKey', env.GEOAPIFY_API_KEY);

  let result: GeoapifyResult | undefined;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      console.error(`Geoapify geocoding failed with HTTP ${response.status}.`);
      return 'unavailable';
    }

    const payload: unknown = await response.json();
    if (isRecord(payload) && Array.isArray(payload['results']) && isRecord(payload['results'][0])) {
      const firstResult = payload['results'][0];
      result = {
        lat: firstResult['lat'],
        lon: firstResult['lon'],
        formatted: firstResult['formatted']
      };
    }
  } catch (error: unknown) {
    console.error('Geoapify geocoding request failed.', error);
    return 'unavailable';
  }

  const latitude = result?.lat;
  const longitude = result?.lon;
  const found = typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  const status = found ? 'found' : 'not_found';
  const address = found && typeof result?.formatted === 'string' ? result.formatted : null;

  await env.Bierliste.prepare(
    `INSERT INTO "BrauereiStandorte" ("name_key", "name", "formatted_address", "latitude", "longitude", "status")
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT("name_key") DO UPDATE SET
       "name" = excluded."name",
       "formatted_address" = excluded."formatted_address",
       "latitude" = excluded."latitude",
       "longitude" = excluded."longitude",
       "status" = excluded."status",
       "updated_at" = CURRENT_TIMESTAMP`
  ).bind(
    key,
    breweryName.trim(),
    address,
    found ? latitude : null,
    found ? longitude : null,
    status
  ).run();

  return status;
}

export async function loadBreweryMapEntries(env: Env): Promise<BreweryMapEntry[]> {
  const [{ results: beerRows }, { results: locations }] = await Promise.all([
    env.Bierliste.prepare(
      'SELECT "Brauerei" AS name FROM "Bierliste" WHERE trim("Brauerei") != ""'
    ).all<BreweryNameRow>(),
    env.Bierliste.prepare(
      'SELECT "name_key", "name", "formatted_address", "latitude", "longitude", "status" FROM "BrauereiStandorte"'
    ).all<StoredBreweryLocation & {
      name: string;
      formatted_address: string | null;
      latitude: number | null;
      longitude: number | null;
    }>()
  ]);

  const groups = new Map<string, { name: string; beerCount: number }>();
  for (const beer of beerRows) {
    const key = breweryKey(beer.name);
    if (!key) {
      continue;
    }

    const group = groups.get(key) ?? { name: beer.name.trim(), beerCount: 0 };
    group.beerCount += 1;
    groups.set(key, group);
  }

  const locationByKey = new Map(locations.map((location) => [location.name_key, location]));
  return Array.from(groups, ([key, group]) => {
    const location = locationByKey.get(key);
    const status: BreweryMapEntry['locationStatus'] = location?.status === 'found'
      ? 'found'
      : location?.status === 'not_found'
        ? 'not_found'
        : 'pending';
    const isLocated = status === 'found';
    return {
      name: group.name,
      address: isLocated && location ? location.formatted_address : null,
      latitude: isLocated && location ? location.latitude : null,
      longitude: isLocated && location ? location.longitude : null,
      locationStatus: status,
      beerCount: group.beerCount
    };
  }).sort((first, second) =>
    first.name.localeCompare(second.name, 'de') || second.beerCount - first.beerCount
  );
}

export async function geocodeMissingBreweries(env: Env): Promise<GeocodeBatchResult> {
  if (!env.GEOAPIFY_API_KEY) {
    throw new GeocodingError('Der Geoapify-API-Schlüssel ist auf dem Server nicht konfiguriert.', 503);
  }

  const [{ results: beerRows }, { results: locations }] = await Promise.all([
    env.Bierliste.prepare(
      'SELECT "Brauerei" AS name FROM "Bierliste" WHERE trim("Brauerei") != ""'
    ).all<BreweryNameRow>(),
    env.Bierliste.prepare(
      'SELECT "name_key", "status" FROM "BrauereiStandorte"'
    ).all<StoredBreweryLocation>()
  ]);

  const uniqueBreweries = new Map<string, string>();
  for (const beer of beerRows) {
    const name = beer.name.trim();
    const key = breweryKey(name);
    if (key && !uniqueBreweries.has(key)) {
      uniqueBreweries.set(key, name);
    }
  }

  const resolvedKeys = new Set(locations.map((location) => location.name_key));
  const missing = Array.from(uniqueBreweries)
    .filter(([key]) => !resolvedKeys.has(key))
    .slice(0, GEOCODE_BATCH_SIZE);
  let found = 0;
  let notFound = 0;

  for (const [index, [key, name]] of missing.entries()) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const status = await ensureBreweryLocation(env, name);
    if (status === 'unavailable') {
      throw new GeocodingError(
        `Der Standort von „${name}“ konnte derzeit nicht gesucht werden. Bitte später erneut versuchen.`,
        502
      );
    }
    if (status === 'found') {
      found += 1;
    } else {
      notFound += 1;
    }
    resolvedKeys.add(key);
  }

  return {
    processed: missing.length,
    remaining: Array.from(uniqueBreweries.keys()).filter((key) => !resolvedKeys.has(key)).length,
    found,
    notFound
  };
}
