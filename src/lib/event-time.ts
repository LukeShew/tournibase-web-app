type ZonedParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

export function eventDayStart(date: string, timeZone: string) {
  return zonedMidnightToUtc(date, timeZone).toISOString();
}

export function eventDayEnd(date: string, timeZone: string) {
  const nextDate = addCalendarDays(date, 1);
  const nextMidnight = zonedMidnightToUtc(nextDate, timeZone);

  return new Date(nextMidnight.getTime() - 1).toISOString();
}

export function eventDateFromTimestamp(value: string, timeZone: string) {
  const parts = getZonedParts(new Date(value), timeZone);

  return [
    parts.year.toString().padStart(4, "0"),
    parts.month.toString().padStart(2, "0"),
    parts.day.toString().padStart(2, "0"),
  ].join("-");
}

export function formatEventValidity(
  validFrom: string,
  validUntil: string,
  timeZone: string,
) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
    timeZoneName: "short",
  });

  return `${formatter.format(new Date(validFrom))} – ${formatter.format(
    new Date(validUntil),
  )}`;
}

function zonedMidnightToUtc(date: string, timeZone: string) {
  const [year, month, day] = parseDate(date);
  const desiredTimestamp = Date.UTC(year, month - 1, day);
  let candidateTimestamp = desiredTimestamp;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedParts(new Date(candidateTimestamp), timeZone);
    const representedTimestamp = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const adjustment = desiredTimestamp - representedTimestamp;

    candidateTimestamp += adjustment;

    if (adjustment === 0) {
      break;
    }
  }

  return new Date(candidateTimestamp);
}

function addCalendarDays(date: string, days: number) {
  const [year, month, day] = parseDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}

function parseDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid event date.");
  }

  const parts = date.split("-").map(Number);
  const [year, month, day] = parts;
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid event date.");
  }

  return [year, month, day] as const;
}

function getZonedParts(value: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return values as ZonedParts;
}
