import { eventDateFromTimestamp } from "./event-time";
import { formatEventDateRange } from "./tournaments";

export function getOfflinePassPath(token: string) {
  return `/p/${encodeURIComponent(token)}/offline-pass.png`;
}

export function getOfflinePassUrl(siteUrl: string, token: string) {
  return `${siteUrl.replace(/\/+$/, "")}${getOfflinePassPath(token)}`;
}

export function getOfflinePassFilename({
  orderNumber,
  passId,
}: {
  orderNumber: string;
  passId: number;
}) {
  return `tournibase-${orderNumber.toLowerCase()}-pass-${passId}.png`;
}

export function formatPassValidity(
  validFrom: string,
  validUntil: string,
  timeZone: string,
) {
  return formatEventDateRange(
    eventDateFromTimestamp(validFrom, timeZone),
    eventDateFromTimestamp(validUntil, timeZone),
  );
}
