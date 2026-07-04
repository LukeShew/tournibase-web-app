import { createClient } from "@supabase/supabase-js";

const DEMO_EMAIL = "demo.director@tournibase.test";
const DEMO_PASSWORD = "TourniBaseDemo123!";
const DEMO_DIRECTOR_NAME = "TourniBase Demo Director";
const DEMO_ORGANIZATION_NAME = "TourniBase Demo Events";
const DEMO_TOURNAMENT_NAME = "DMV Summer Tip-Off Classic";
const DEMO_PUBLIC_SLUG = "dmv-summer-tip-off-classic";
const DEMO_TIME_ZONE = "America/New_York";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

const schedule = createDemoSchedule();

if (process.argv.includes("--preview")) {
  printPreview();
  process.exit(0);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();

assertLocalSupabaseUrl(supabaseUrl);

if (!supabaseSecretKey) {
  throw new Error(
    "SUPABASE_SECRET_KEY is missing. Copy the local secret key from `npx supabase status` into .env.local.",
  );
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

const director = await ensureDemoDirector(supabase);
const organization = await ensureDemoOrganization(supabase, director.id);
const tournament = await ensureDemoTournament(supabase, organization.id);
await ensureDemoTickets(supabase, tournament.id);

console.log("TourniBase local demo data is ready.");
console.log(`Director login: ${DEMO_EMAIL}`);
console.log(`Director password: ${DEMO_PASSWORD}`);
console.log(`Tournament: ${DEMO_TOURNAMENT_NAME}`);
console.log(`Dates: ${schedule.startDate} through ${schedule.endDate}`);
console.log(`Public page: http://localhost:3000/e/${DEMO_PUBLIC_SLUG}`);

async function ensureDemoDirector(client) {
  const {
    data: { users },
    error: listError,
  } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`Could not list local Auth users: ${listError.message}`);
  }

  let director = users.find(
    (user) => user.email?.toLowerCase() === DEMO_EMAIL,
  );

  if (!director) {
    const { data, error } = await client.auth.admin.createUser({
      email: DEMO_EMAIL,
      email_confirm: true,
      password: DEMO_PASSWORD,
      user_metadata: {
        name: DEMO_DIRECTOR_NAME,
      },
    });

    if (error || !data.user) {
      throw new Error(
        `Could not create the local demo director: ${
          error?.message ?? "No user returned."
        }`,
      );
    }

    director = data.user;
  }

  const { error: profileError } = await client.from("users").upsert(
    {
      email: DEMO_EMAIL,
      id: director.id,
      name: DEMO_DIRECTOR_NAME,
      role: "director",
    },
    {
      onConflict: "id",
    },
  );

  if (profileError) {
    throw new Error(
      `Could not prepare the local director profile: ${profileError.message}`,
    );
  }

  return director;
}

async function ensureDemoOrganization(client, directorId) {
  const { data: existing, error: lookupError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_user_id", directorId)
    .eq("name", DEMO_ORGANIZATION_NAME)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Could not find the local demo organization: ${lookupError.message}`,
    );
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await client
    .from("organizations")
    .insert({
      name: DEMO_ORGANIZATION_NAME,
      owner_user_id: directorId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create the local demo organization: ${
        error?.message ?? "No organization returned."
      }`,
    );
  }

  return data;
}

async function ensureDemoTournament(client, organizationId) {
  const tournamentValues = {
    contact_email: "admissions@tournibase.test",
    description:
      "A local TourniBase demo event for testing online admission, mobile passes, and gate scanning.",
    end_date: schedule.endDate,
    name: DEMO_TOURNAMENT_NAME,
    organization_id: organizationId,
    organizer_name: "TourniBase Demo Events",
    public_slug: DEMO_PUBLIC_SLUG,
    sport: "youth_basketball",
    start_date: schedule.startDate,
    status: "published",
    time_zone: DEMO_TIME_ZONE,
    venue_address: "123 Tournament Drive, Hyattsville, MD 20781",
    venue_name: "Capital Sports Complex",
  };

  const { data: existing, error: lookupError } = await client
    .from("tournaments")
    .select("id")
    .eq("public_slug", DEMO_PUBLIC_SLUG)
    .maybeSingle();

  if (lookupError) {
    throw new Error(
      `Could not find the local demo tournament: ${lookupError.message}`,
    );
  }

  if (existing) {
    const { data, error } = await client
      .from("tournaments")
      .update(tournamentValues)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(
        `Could not update the local demo tournament: ${
          error?.message ?? "No tournament returned."
        }`,
      );
    }

    return data;
  }

  const { data, error } = await client
    .from("tournaments")
    .insert(tournamentValues)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create the local demo tournament: ${
        error?.message ?? "No tournament returned."
      }`,
    );
  }

  return data;
}

async function ensureDemoTickets(client, tournamentId) {
  const tickets = [
    {
      description: "Admission for Saturday tournament games.",
      name: "Saturday Pass",
      price: "20.00",
      valid_from: schedule.saturdayStart,
      valid_until: schedule.saturdayEnd,
    },
    {
      description: "Admission for Sunday tournament games.",
      name: "Sunday Pass",
      price: "20.00",
      valid_from: schedule.sundayStart,
      valid_until: schedule.sundayEnd,
    },
    {
      description: "Admission for the full Saturday and Sunday tournament.",
      name: "Weekend Pass",
      price: "30.00",
      valid_from: schedule.saturdayStart,
      valid_until: schedule.sundayEnd,
    },
    {
      description: "Discounted admission for a student or child.",
      name: "Student/Child Pass",
      price: "10.00",
      valid_from: schedule.saturdayStart,
      valid_until: schedule.sundayEnd,
    },
  ];

  const { data: existingTickets, error: lookupError } = await client
    .from("ticket_types")
    .select("id, name")
    .eq("tournament_id", tournamentId);

  if (lookupError) {
    throw new Error(
      `Could not find local demo tickets: ${lookupError.message}`,
    );
  }

  const existingByName = new Map(
    (existingTickets ?? []).map((ticket) => [ticket.name, ticket]),
  );

  for (const ticket of tickets) {
    const values = {
      ...ticket,
      quantity_limit: null,
      status: "active",
      tournament_id: tournamentId,
    };
    const existing = existingByName.get(ticket.name);

    if (existing) {
      const { error } = await client
        .from("ticket_types")
        .update(values)
        .eq("id", existing.id);

      if (error) {
        throw new Error(
          `Could not update ${ticket.name}: ${error.message}`,
        );
      }

      continue;
    }

    const { error } = await client.from("ticket_types").insert(values);

    if (error) {
      throw new Error(`Could not create ${ticket.name}: ${error.message}`);
    }
  }
}

function createDemoSchedule(now = new Date()) {
  const currentDate = eventDateFromTimestamp(now, DEMO_TIME_ZONE);
  const [year, month, day] = parseDate(currentDate);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysUntilNextSaturday = (6 - dayOfWeek + 7) % 7 || 7;
  const startDate = addCalendarDays(currentDate, daysUntilNextSaturday);
  const endDate = addCalendarDays(startDate, 1);

  return {
    endDate,
    saturdayEnd: eventDayEnd(startDate, DEMO_TIME_ZONE),
    saturdayStart: eventDayStart(startDate, DEMO_TIME_ZONE),
    startDate,
    sundayEnd: eventDayEnd(endDate, DEMO_TIME_ZONE),
    sundayStart: eventDayStart(endDate, DEMO_TIME_ZONE),
  };
}

function assertLocalSupabaseUrl(value) {
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing. Start local Supabase and copy its API URL into .env.local.",
    );
  }

  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }

  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Demo seed blocked: ${parsed.hostname} is not local. Use the URL from \`npx supabase status\`.`,
    );
  }
}

function printPreview() {
  console.log("TourniBase local demo seed preview");
  console.log(`Tournament: ${DEMO_TOURNAMENT_NAME}`);
  console.log("Venue: Capital Sports Complex");
  console.log(`Dates: ${schedule.startDate} through ${schedule.endDate}`);
  console.log("Tickets: Saturday $20, Sunday $20, Weekend $30, Student/Child $10");
  console.log("No database connection was made.");
}

function eventDayStart(date, timeZone) {
  return zonedMidnightToUtc(date, timeZone).toISOString();
}

function eventDayEnd(date, timeZone) {
  const nextDate = addCalendarDays(date, 1);
  const nextMidnight = zonedMidnightToUtc(nextDate, timeZone);

  return new Date(nextMidnight.getTime() - 1).toISOString();
}

function eventDateFromTimestamp(value, timeZone) {
  const parts = getZonedParts(value, timeZone);

  return [
    parts.year.toString().padStart(4, "0"),
    parts.month.toString().padStart(2, "0"),
    parts.day.toString().padStart(2, "0"),
  ].join("-");
}

function zonedMidnightToUtc(date, timeZone) {
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

function addCalendarDays(date, days) {
  const [year, month, day] = parseDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return shifted.toISOString().slice(0, 10);
}

function parseDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Invalid event date.");
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Invalid event date.");
  }

  return [year, month, day];
}

function getZonedParts(value, timeZone) {
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

  return Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}
