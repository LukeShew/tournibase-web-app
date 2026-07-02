"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireDirector } from "@/lib/auth";
import type { CreateTournamentState } from "@/lib/form-states";
import { createClient } from "@/lib/supabase/server";
import { slugifyTournamentName } from "@/lib/tournaments";

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

const tournamentSchema = z
  .object({
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
    publicSlug: z
      .string()
      .trim()
      .max(72, "Keep the public link under 72 characters."),
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

type TournamentField = keyof z.infer<typeof tournamentSchema>;

export async function createTournament(
  _previousState: CreateTournamentState,
  formData: FormData,
): Promise<CreateTournamentState> {
  const director = await requireDirector();
  const result = tournamentSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    venueName: formData.get("venueName"),
    venueAddress: formData.get("venueAddress"),
    organizerName: formData.get("organizerName"),
    contactEmail: formData.get("contactEmail"),
    description: formData.get("description"),
    publicSlug: formData.get("publicSlug"),
  });

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const errors = Object.fromEntries(
      Object.entries(fieldErrors)
        .filter((entry): entry is [TournamentField, string[]] =>
          Boolean(entry[1]?.[0]),
        )
        .map(([field, messages]) => [field, messages[0]]),
    ) as Partial<Record<TournamentField, string>>;

    return {
      message: "Check the highlighted fields and try again.",
      errors,
    };
  }

  const supabase = await createClient();
  const { data: existingOrganization, error: organizationLookupError } =
    await supabase
      .from("organizations")
      .select("id")
      .eq("owner_user_id", director.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  if (organizationLookupError) {
    return {
      message: "We could not load your organization. Try again.",
      errors: {},
    };
  }

  let organizationId = existingOrganization?.id as number | undefined;

  if (!organizationId) {
    const { data: newOrganization, error: organizationCreateError } =
      await supabase
        .from("organizations")
        .insert({
          name: `${result.data.organizerName} Events`,
          owner_user_id: director.id,
        })
        .select("id")
        .single();

    if (organizationCreateError || !newOrganization) {
      return {
        message: "We could not create your organization. Try again.",
        errors: {},
      };
    }

    organizationId = newOrganization.id as number;
  }

  const baseSlug = slugifyTournamentName(
    result.data.publicSlug || result.data.name,
  );
  let tournamentId: number | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const publicSlug =
      attempt === 0
        ? baseSlug
        : `${baseSlug.slice(0, 65)}-${crypto.randomUUID().slice(0, 6)}`;

    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .insert({
        organization_id: organizationId,
        name: result.data.name,
        sport: "youth_basketball",
        start_date: result.data.startDate,
        end_date: result.data.endDate,
        venue_name: result.data.venueName,
        venue_address: result.data.venueAddress,
        organizer_name: result.data.organizerName,
        contact_email: result.data.contactEmail,
        description: result.data.description || null,
        status: "draft",
        public_slug: publicSlug,
      })
      .select("id")
      .single();

    if (!tournamentError && tournament) {
      tournamentId = tournament.id as number;
      break;
    }

    if (tournamentError?.code !== "23505") {
      return {
        message: "We could not create the event. Try again.",
        errors: {},
      };
    }
  }

  if (!tournamentId) {
    return {
      message: "That public link is already in use. Choose a different one.",
      errors: {
        publicSlug: "Choose a different public link.",
      },
    };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/tournaments/${tournamentId}`);
}
