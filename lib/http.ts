/**
 * CSRF guard for JSON route handlers that use the session cookie (RULES.md §7): the request must
 * be JSON (a cross-site page can't send that without a CORS preflight, which we never allow) and,
 * when the browser sends an Origin, it must be this site.
 */
export function isSameOriginJson(request: Request): boolean {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(type)) return false;
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
