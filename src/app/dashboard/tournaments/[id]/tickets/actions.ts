"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDirector } from "@/lib/auth";
import { eventDayEnd, eventDayStart } from "@/lib/event-time";
import type { TicketTypeFormState } from "@/lib/form-states";
import { isOrganizationStripeAccountReady } from "@/lib/stripe-connect";
import { getStripeConfigurationIssues } from "@/lib/stripe";
import {
  getSupabaseAdmin,
  getSupabaseAdminConfigurationIssues,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const isoDate = z
  .string()
  .trim()
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Choose a valid date.");

const ticketTypeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter a ticket name.")
      .max(80, "Keep the ticket name under 80 characters."),
    price: z
      .string()
      .trim()
      .regex(
        /^\d{1,4}(?:\.\d{1,2})?$/,
        "Enter a price such as 12 or 12.50.",
      ),
    validFrom: isoDate,
    validUntil: isoDate,
    description: z
      .string()
      .trim()
      .max(400, "Keep the description under 400 characters."),
    quantityLimit: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^\d+$/.test(value),
        "Enter a whole-number quantity or leave it blank.",
      )
      .refine(
        (value) =>
          value === "" || (Number(value) >= 1 && Number(value) <= 100000),
        "Quantity must be between 1 and 100,000.",
      ),
    status: z.enum(["active", "inactive"], {
      message: "Choose active or inactive.",
    }),
  })
  .superRefine((values, context) => {
    if (values.validUntil < values.validFrom) {
      context.addIssue({
        code: "custom",
        path: ["validUntil"],
        message: "The end date cannot be before the start date.",
      });
    }
  });

type TicketTypeField = keyof z.input<typeof ticketTypeSchema>;

type OwnedTournament = {
  end_date: string;
  id: number;
  organization_id: number;
  public_slug: string;
  start_date: string;
  status: "draft" | "published" | "closed" | "archived";
  time_zone: string;
};

export async function createTicketType(
  tournamentId: number,
  _previousState: TicketTypeFormState,
  formData: FormData,
): Promise<TicketTypeFormState> {
  const director = await requireDirector();
  const parsed = parseTicketTypeForm(formData);

  if (!parsed.success) {
    return parsed.state;
  }

  const supabase = await createClient();
  const tournament = await getOwnedTournament(
    supabase,
    director.id,
    tournamentId,
  );

  if (!tournament) {
    return {
      errors: {},
      message: "This event could not be found.",
      success: false,
    };
  }

  const dateErrors = validateTicketDates(parsed.data, tournament);

  if (dateErrors) {
    return dateErrors;
  }

  const paymentError = await validatePaidTicketActivation(
    parsed.data,
    tournament,
  );

  if (paymentError) {
    return paymentError;
  }

  const { error } = await getSupabaseAdmin().from("ticket_types").insert({
    tournament_id: tournamentId,
    name: parsed.data.name,
    price: centsToDatabasePrice(dollarsToCents(parsed.data.price)),
    valid_from: eventDayStart(
      parsed.data.validFrom,
      tournament.time_zone,
    ),
    valid_until: eventDayEnd(
      parsed.data.validUntil,
      tournament.time_zone,
    ),
    description: parsed.data.description || null,
    quantity_limit: parsed.data.quantityLimit
      ? Number(parsed.data.quantityLimit)
      : null,
    status: parsed.data.status,
  });

  if (error) {
    return {
      errors: {},
      message: "We could not create this ticket type. Try again.",
      success: false,
    };
  }

  revalidateTicketPaths(tournamentId, tournament.public_slug);

  return {
    errors: {},
    message: "Ticket type created.",
    success: true,
    successId: crypto.randomUUID(),
  };
}

export async function updateTicketType(
  ticketTypeId: number,
  _previousState: TicketTypeFormState,
  formData: FormData,
): Promise<TicketTypeFormState> {
  const director = await requireDirector();
  const parsed = parseTicketTypeForm(formData);

  if (!parsed.success) {
    return parsed.state;
  }

  const supabase = await createClient();
  const { data: ticketType, error: ticketLookupError } = await supabase
    .from("ticket_types")
    .select("id, price, status, tournament_id")
    .eq("id", ticketTypeId)
    .maybeSingle();

  if (ticketLookupError) {
    return {
      errors: {},
      message: "We could not load this ticket type. Try again.",
      success: false,
    };
  }

  if (!ticketType) {
    return {
      errors: {},
      message: "This ticket type could not be found.",
      success: false,
    };
  }

  const tournamentId = ticketType.tournament_id as number;
  const tournament = await getOwnedTournament(
    supabase,
    director.id,
    tournamentId,
  );

  if (!tournament) {
    return {
      errors: {},
      message: "You do not have access to edit this ticket type.",
      success: false,
    };
  }

  const dateErrors = validateTicketDates(parsed.data, tournament);

  if (dateErrors) {
    return dateErrors;
  }

  const introducesPaidActivation =
    parsed.data.status === "active" &&
    dollarsToCents(parsed.data.price) > 0 &&
    (ticketType.status !== "active" || Number(ticketType.price) <= 0);
  const paymentError = introducesPaidActivation
    ? await validatePaidTicketActivation(parsed.data, tournament)
    : null;

  if (paymentError) {
    return paymentError;
  }

  const { data: updatedTicketType, error: updateError } =
    await getSupabaseAdmin()
    .from("ticket_types")
    .update({
      name: parsed.data.name,
      price: centsToDatabasePrice(dollarsToCents(parsed.data.price)),
      valid_from: eventDayStart(
        parsed.data.validFrom,
        tournament.time_zone,
      ),
      valid_until: eventDayEnd(
        parsed.data.validUntil,
        tournament.time_zone,
      ),
      description: parsed.data.description || null,
      quantity_limit: parsed.data.quantityLimit
        ? Number(parsed.data.quantityLimit)
        : null,
      status: parsed.data.status,
    })
    .eq("id", ticketTypeId)
    .eq("tournament_id", tournamentId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedTicketType) {
    return {
      errors: {},
      message: "We could not save this ticket type. Try again.",
      success: false,
    };
  }

  revalidateTicketPaths(tournamentId, tournament.public_slug);

  return {
    errors: {},
    message: "Ticket type updated.",
    success: true,
    successId: crypto.randomUUID(),
  };
}

export async function setTicketTypeStatus(
  ticketTypeId: number,
  nextStatus: "active" | "inactive",
  _formData: FormData,
) {
  void _formData;
  const director = await requireDirector();
  const supabase = await createClient();
  const { data: ticketType, error: ticketLookupError } = await supabase
    .from("ticket_types")
    .select("id, price, tournament_id")
    .eq("id", ticketTypeId)
    .maybeSingle();

  if (ticketLookupError || !ticketType) {
    throw new Error("Ticket type not found.");
  }

  const tournamentId = ticketType.tournament_id as number;
  const tournament = await getOwnedTournament(
    supabase,
    director.id,
    tournamentId,
  );

  if (!tournament) {
    throw new Error("You do not have access to this ticket type.");
  }

  if (
    nextStatus === "active" &&
    tournament.status === "published" &&
    Number(ticketType.price) > 0
  ) {
    if (
      !(await isOrganizationStripeAccountReady(tournament.organization_id))
    ) {
      throw new Error(
        "Connect a ready Stripe account in Settings before activating paid tickets on a published event.",
      );
    }

    if (!paidCheckoutConfigurationReady()) {
      throw new Error(
        "Finish the Stripe and server configuration before activating paid tickets on a published event.",
      );
    }
  }

  const { data: updatedTicketType, error: updateError } =
    await getSupabaseAdmin()
    .from("ticket_types")
    .update({ status: nextStatus })
    .eq("id", ticketTypeId)
    .eq("tournament_id", tournamentId)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedTicketType) {
    throw new Error("The ticket status could not be updated.");
  }

  revalidateTicketPaths(tournamentId, tournament.public_slug);
}

function parseTicketTypeForm(formData: FormData):
  | {
      success: true;
      data: z.output<typeof ticketTypeSchema>;
    }
  | {
      success: false;
      state: TicketTypeFormState;
    } {
  const result = ticketTypeSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    validFrom: formData.get("validFrom"),
    validUntil: formData.get("validUntil"),
    description: formData.get("description"),
    quantityLimit: formData.get("quantityLimit"),
    status: formData.get("status"),
  });

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  const fieldErrors = result.error.flatten().fieldErrors;
  const errors = Object.fromEntries(
    Object.entries(fieldErrors)
      .filter((entry): entry is [TicketTypeField, string[]] =>
        Boolean(entry[1]?.[0]),
      )
      .map(([field, messages]) => [field, messages[0]]),
  ) as Partial<Record<TicketTypeField, string>>;

  return {
    success: false,
    state: {
      errors,
      message: "Check the highlighted fields and try again.",
      success: false,
    },
  };
}

async function getOwnedTournament(
  supabase: Awaited<ReturnType<typeof createClient>>,
  directorId: string,
  tournamentId: number,
): Promise<OwnedTournament | null> {
  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", directorId);

  if (organizationError) {
    throw organizationError;
  }

  const organizationIds = (organizationRows ?? []).map(
    (organization) => organization.id as number,
  );

  if (organizationIds.length === 0) {
    return null;
  }

  const { data: tournament, error: tournamentError } = await supabase
    .from("tournaments")
    .select(
      "id, organization_id, public_slug, start_date, end_date, status, time_zone",
    )
    .eq("id", tournamentId)
    .in("organization_id", organizationIds)
    .maybeSingle();

  if (tournamentError) {
    throw tournamentError;
  }

  return tournament as OwnedTournament | null;
}

async function validatePaidTicketActivation(
  data: z.output<typeof ticketTypeSchema>,
  tournament: OwnedTournament,
): Promise<TicketTypeFormState | null> {
  if (
    data.status !== "active" ||
    tournament.status !== "published" ||
    dollarsToCents(data.price) === 0
  ) {
    return null;
  }

  if (await isOrganizationStripeAccountReady(tournament.organization_id)) {
    if (paidCheckoutConfigurationReady()) {
      return null;
    }

    return {
      errors: {
        status:
          "Finish the Stripe and server configuration before activating a paid ticket on a published event.",
      },
      message:
        "Paid tickets cannot be activated while paid checkout setup is incomplete.",
      success: false,
    };
  }

  return {
    errors: {
      status:
        "Connect a ready Stripe account before activating a paid ticket on a published event.",
    },
    message:
      "Paid tickets cannot be activated while the organization’s Stripe account is not ready.",
    success: false,
  };
}

function paidCheckoutConfigurationReady() {
  return (
    getStripeConfigurationIssues({
      includeConnectedPaymentsWebhookSecret: true,
      includePublishableKey: true,
    }).length === 0 &&
    getSupabaseAdminConfigurationIssues().length === 0
  );
}

function validateTicketDates(
  data: z.output<typeof ticketTypeSchema>,
  tournament: OwnedTournament,
): TicketTypeFormState | null {
  const errors: TicketTypeFormState["errors"] = {};

  if (data.validFrom < tournament.start_date) {
    errors.validFrom = "Ticket validity cannot start before the event.";
  }

  if (data.validUntil > tournament.end_date) {
    errors.validUntil = "Ticket validity cannot end after the event.";
  }

  if (Object.keys(errors).length === 0) {
    return null;
  }

  return {
    errors,
    message: "Ticket dates must stay within the tournament dates.",
    success: false,
  };
}

function dollarsToCents(value: string) {
  const [wholeDollars, fractionalDollars = ""] = value.split(".");

  return (
    Number(wholeDollars) * 100 +
    Number(fractionalDollars.padEnd(2, "0").slice(0, 2))
  );
}

function centsToDatabasePrice(cents: number) {
  return (cents / 100).toFixed(2);
}

function revalidateTicketPaths(tournamentId: number, publicSlug: string) {
  revalidatePath(`/dashboard/tournaments/${tournamentId}`);
  revalidatePath(`/dashboard/tournaments/${tournamentId}/tickets`);
  revalidatePath(`/e/${publicSlug}`);
}
