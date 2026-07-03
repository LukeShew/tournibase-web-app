import "server-only";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const baseUrl =
    configuredUrl ||
    (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000");

  return baseUrl.replace(/\/+$/, "");
}
