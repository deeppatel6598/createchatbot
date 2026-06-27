/**
 * Append the active clinic slug (`?b=<slug>`) to an API path so every request
 * from a `/c/[slug]` page is scoped to the right tenant. With no slug the path is
 * unchanged and the server falls back to the BUSINESS_SLUG env default. Used by
 * all client components — one place so a fetch can't silently hit another tenant.
 */
export function apiUrl(path: string, slug?: string): string {
  if (!slug) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}b=${encodeURIComponent(slug)}`;
}
