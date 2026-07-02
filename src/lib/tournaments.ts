export function slugifyTournamentName(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");

  return slug || "event";
}

export function formatEventDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function formatEventDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return formatEventDate(startDate);
  }

  return `${formatEventDate(startDate)} – ${formatEventDate(endDate)}`;
}
