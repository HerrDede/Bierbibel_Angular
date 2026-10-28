export interface D1Result {
  success: boolean;
  meta: {
    changes: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Env {
  Bierliste: D1Database;
  ADMIN_PASSWORD?: string;
  GEOAPIFY_API_KEY?: string;
  SESSION_SECRET?: string;
}

export interface PagesContext {
  request: Request;
  env: Env;
  params: Record<string, string>;
}

const SESSION_COOKIE = 'bierbibel_session';
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  responseHeaders.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

export function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin) {
    return errorResponse('Diese Anfrage ist nicht erlaubt.', 403);
  }

  return null;
}

export function hasAuthConfiguration(env: Env): boolean {
  return Boolean(
    env.ADMIN_PASSWORD
    && env.ADMIN_PASSWORD.length >= 16
    && env.SESSION_SECRET
    && env.SESSION_SECRET.length >= 32
  );
}

export async function passwordMatches(password: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(password)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected))
  ]);
  const provided = new Uint8Array(providedHash);
  const stored = new Uint8Array(expectedHash);
  let difference = 0;

  for (let index = 0; index < provided.length; index += 1) {
    difference |= provided[index] ^ stored[index];
  }

  return difference === 0;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  const binary = String.fromCharCode(...new Uint8Array(signature));
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function createSessionCookie(request: Request, secret: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = String(expiresAt);
  const token = `${payload}.${await sign(payload, secret)}`;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; HttpOnly; SameSite=Strict${secure}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`;
}

export async function hasValidSession(request: Request, secret: string): Promise<boolean> {
  const cookieHeader = request.headers.get('Cookie');
  const token = cookieHeader?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (!token) {
    return false;
  }

  const separator = token.indexOf('.');
  if (separator < 1) {
    return false;
  }

  const payload = token.slice(0, separator);
  const expiresAt = Number(payload);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expectedSignature = await sign(payload, secret);
  const providedSignature = token.slice(separator + 1);
  if (providedSignature.length !== expectedSignature.length) {
    return false;
  }

  let difference = 0;
  for (let index = 0; index < expectedSignature.length; index += 1) {
    difference |= expectedSignature.charCodeAt(index) ^ providedSignature.charCodeAt(index);
  }

  return difference === 0;
}

export async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  if (!hasAuthConfiguration(env)) {
    return errorResponse('Die Admin-Anmeldung ist auf dem Server nicht vollständig konfiguriert.', 503);
  }

  return await hasValidSession(request, env.SESSION_SECRET!)
    ? null
    : errorResponse('Bitte melde dich an, um diese Aktion auszuführen.', 401);
}

export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown | Response> {
  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (contentLength > maxBytes) {
    return errorResponse('Die Anfrage ist zu groß.', 413);
  }

  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > maxBytes) {
      return errorResponse('Die Anfrage ist zu groß.', 413);
    }

    return JSON.parse(body) as unknown;
  } catch {
    return errorResponse('Die Anfrage enthält kein gültiges JSON.', 400);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validBeer(value: unknown): value is {
  Brauerei: string;
  BierName: string;
  Art: string;
  Bewertung: string | number;
} {
  if (!isRecord(value)) {
    return false;
  }

  const rating = value['Bewertung'];
  return typeof value['Brauerei'] === 'string'
    && value['Brauerei'].trim().length > 0
    && value['Brauerei'].length <= 200
    && typeof value['BierName'] === 'string'
    && value['BierName'].trim().length > 0
    && value['BierName'].length <= 200
    && typeof value['Art'] === 'string'
    && value['Art'].trim().length > 0
    && value['Art'].length <= 200
    && (typeof rating === 'string'
      ? rating.trim().length > 0 && rating.length <= 16
      : typeof rating === 'number' && Number.isFinite(rating));
}
