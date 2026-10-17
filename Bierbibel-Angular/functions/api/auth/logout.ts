import {
  clearSessionCookie,
  errorResponse,
  jsonResponse,
  PagesContext,
  requireSameOrigin
} from '../../_shared';

export async function onRequestPost({ request }: PagesContext): Promise<Response> {
  const originError = requireSameOrigin(request);
  if (originError) {
    return originError;
  }

  const headers = new Headers();
  headers.append('Set-Cookie', clearSessionCookie(request));
  return jsonResponse({ authenticated: false }, 200, headers);
}
