import "server-only";

export type EmailSendRequest = {
  html: string;
  idempotencyKey: string;
  replyTo: string;
  subject: string;
  text: string;
  to: string;
};

export type EmailSendResult = {
  messageId: string;
};

export type EmailProvider = {
  isConfigured: boolean;
  name: string;
  send(request: EmailSendRequest): Promise<EmailSendResult>;
};

export class EmailSendError extends Error {
  code: string;
  retryable: boolean;
  safeMessage: string;

  constructor({
    code,
    message,
    retryable,
    safeMessage,
  }: {
    code: string;
    message: string;
    retryable: boolean;
    safeMessage: string;
  }) {
    super(message);
    this.name = "EmailSendError";
    this.code = code;
    this.retryable = retryable;
    this.safeMessage = safeMessage;
  }
}

const disabledProvider: EmailProvider = {
  isConfigured: false,
  name: "disabled",
  async send() {
    throw new EmailSendError({
      code: "provider_disabled",
      message: "Transactional email is disabled.",
      retryable: false,
      safeMessage: "Transactional email is not configured.",
    });
  },
};

export function getEmailProvider(): EmailProvider {
  const providerName =
    process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "disabled";

  if (providerName === "disabled") {
    return disabledProvider;
  }

  throw new Error(
    `Unsupported EMAIL_PROVIDER "${providerName}". Keep it set to "disabled" until a provider adapter is installed.`,
  );
}

export function normalizeEmailSendError(error: unknown) {
  if (error instanceof EmailSendError) {
    return error;
  }

  return new EmailSendError({
    code: "unexpected_email_error",
    message:
      error instanceof Error ? error.message : "Unknown email delivery error.",
    retryable: true,
    safeMessage:
      "A temporary error prevented the confirmation email from being sent.",
  });
}
