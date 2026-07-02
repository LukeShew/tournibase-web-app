export type CreateTournamentState = {
  message: string;
  errors: Partial<
    Record<
      | "name"
      | "startDate"
      | "endDate"
      | "venueName"
      | "venueAddress"
      | "organizerName"
      | "contactEmail"
      | "description"
      | "publicSlug",
      string
    >
  >;
};

export const initialCreateTournamentState: CreateTournamentState = {
  message: "",
  errors: {},
};

export type TicketTypeFormState = {
  errors: Partial<
    Record<
      | "name"
      | "price"
      | "validFrom"
      | "validUntil"
      | "description"
      | "quantityLimit"
      | "status",
      string
    >
  >;
  message: string;
  success: boolean;
  successId?: string;
};

export const initialTicketTypeFormState: TicketTypeFormState = {
  errors: {},
  message: "",
  success: false,
};

export type PublicationState = {
  message: string;
  success: boolean;
};

export const initialPublicationState: PublicationState = {
  message: "",
  success: false,
};
