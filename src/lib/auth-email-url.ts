export function getAuthEmailRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const isHostedUrl =
    configuredUrl &&
    !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(configuredUrl);
  const baseUrl = isHostedUrl ? configuredUrl : "https://tournibase.com";

  return `${baseUrl.replace(/\/+$/, "")}/login`;
}
