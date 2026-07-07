"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireDirector } from "@/lib/auth";
import type { CreateTournamentState } from "@/lib/form-states";
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

const updateTournamentSchema = z
  .object({
    tournamentId: z.coerce
      .number()
      .int("Invalid event.")
      .positive("Invalid event."),
    name: z
      .string()
      .trim()
      .min(2, "Enter the tournament name.")
      .max(120, "Keep the tournament name under 120 characters."),
    startDate: isoDate,
    endDate: isoDate,
    venueName: z
      .string()
      .trim()
      .min(2, "Enter the venue name.")
      .max(120, "Keep the venue name under 120 characters."),
    venueAddress: z
      .string()
      .trim()
      .min(5, "Enter the venue address.")
      .max(240, "Keep the venue address under 240 characters."),
    organizerName: z
      .string()
      .trim()
      .min(2, "Enter the organizer or director name.")
      .max(120, "Keep the organizer name under 120 characters."),
    contactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid contact email.")
      .max(254, "The contact email is too long."),
    description: z
      .string()
      .trim()
      .max(800, "Keep the description under 800 characters."),
  })
  .superRefine((values, context) => {
    if (values.endDate < values.startDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The end date cannot be before the start date.",
      });
    }
  });

type UpdateTournamentField = Exclude<
  keyof z.infer<typeof updateTournamentSchema>,
  "tournamentId"
>;

export async function updateTournament(
  _previousState: CreateTournamentState,
  formData: FormData,
): Promise<CreateTournamentState> {
  const director = await requireDirector();
  const result = updateTournamentSchema.safeParse({
    tournamentId: formData.get("tournamentId"),
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    venueName: formData.get("venueName"),
    venueAddress: formData.get("venueAddress"),
    organizerName: formData.get("organizerName"),
    contactEmail: formData.get("contactEmail"),
    description: formData.get("description"),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const errors = Object.fromEntries(
      Object.entries(fieldErrors)
        .filter((entry): entry is [UpdateTournamentField, string[]] =>
          Boolean(entry[1]?.[0]) && entry[0] !== "tournamentId",
        )
        .map(([field, messages]) => [field, messages[0]]),
    ) as Partial<Record<UpdateTournamentField, string>>;

    return {
      message: "Check the highlighted fields and try again.",
      errors,
    };
  }

  const supabase = await createClient();
  const { data: organizationRows, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", director.id);

  if (organizationError) {
    return {
      message: "We could not load your organization. Try again.",
      errors: {},
    };
  }

  const organizationIds = (organizationRows ?? []).map(
    (organization) => organization.id as number,
  );

  if (organizationIds.length === 0) {
    return {
      message: "We could not find an organization for your account.",
      errors: {},
    };
  }

  const { data: updatedTournament, error: updateError } = await supabase
    .from("tournaments")
    .update({
      name: result.data.name,
      start_date: result.data.startDate,
      end_date: result.data.endDate,
      venue_name: result.data.venueName,
      venue_address: result.data.venueAddress,
      organizer_name: result.data.organizerName,
      contact_email: result.data.contactEmail,
      description: result.data.description || null,
    })
    .eq("id", result.data.tournamentId)
    .in("organization_id", organizationIds)
    .select("id")
    .maybeSingle();

  if (updateError || !updatedTournament) {
    return {
      message: "We could not update this event. Try again.",
      errors: {},
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/tournaments/${result.data.tournamentId}`);
  revalidatePath(`/e`);
  redirect(`/dashboard/tournaments/${result.data.tournamentId}`);
}
