import { loadBreweryMapEntries } from '../../_geocoding';
import { errorResponse, jsonResponse, PagesContext } from '../../_shared';

export async function onRequestGet({ env }: PagesContext): Promise<Response> {
  try {
    const breweries = await loadBreweryMapEntries(env);
    return jsonResponse({
      breweries,
      locatedCount: breweries.filter((brewery) => brewery.latitude !== null).length,
      missingCount: breweries.filter((brewery) => brewery.latitude === null).length
    });
  } catch (error: unknown) {
    console.error('Could not load brewery locations from D1.', error);
    return errorResponse('Die Brauereistandorte konnten nicht geladen werden. Bitte prüfe, ob die Datenbankmigration ausgeführt wurde.', 500);
  }
}
