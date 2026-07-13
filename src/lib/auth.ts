/**
 * Authorize cron / admin requests.
 * Accepts Authorization: Bearer <secret> or ?secret= / x-cron-secret header.
 */
export function authorizeRequest(request: Request): boolean {
  const expected = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (!expected) {
    // In development without a secret, allow local access.
    return process.env.NODE_ENV !== "production";
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7) === expected) {
    return true;
  }

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === expected) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === expected) return true;

  // Vercel Cron sends CRON_SECRET as Bearer when configured.
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    auth?.startsWith("Bearer ") &&
    auth.slice(7) === cronSecret
  ) {
    return true;
  }

  return false;
}
