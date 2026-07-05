import "server-only";

import { Resend, type ErrorResponse } from "resend";

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

type ResendSend = Resend["emails"]["send"];

type ResendEmailProviderOptions = {
  apiKey?: string;
  from?: string;
  send?: ResendSend;
};

const retryableResendErrors = new Set<ErrorResponse["name"]>([
  "application_error",
  "concurrent_idempotent_requests",
  "daily_quota_exceeded",
  "internal_server_error",
  "monthly_quota_exceeded",
  "rate_limit_exceeded",
]);

export function createResendEmailProvider({
  apiKey = process.env.RESEND_API_KEY?.trim(),
  from = process.env.EMAIL_FROM?.trim(),
  send,
}: ResendEmailProviderOptions = {}): EmailProvider {
  if (!apiKey) {
    throw new Error(
      'EMAIL_PROVIDER is "resend", but RESEND_API_KEY is not configured.',
    );
  }

  if (!from) {
    throw new Error(
      'EMAIL_PROVIDER is "resend", but EMAIL_FROM is not configured.',
    );
  }

  const resend = send
    ? null
    : new Resend(apiKey, {
        userAgent: "tournibase-web-app/0.1.0",
      });
  const sendEmail = send ?? resend!.emails.send.bind(resend!.emails);

  return {
    isConfigured: true,
    name: "resend",
    async send(request) {
      const { data, error } = await sendEmail(
        {
          from,
          html: request.html,
          replyTo: request.replyTo,
          subject: request.subject,
          text: request.text,
          to: request.to,
        },
        {
          idempotencyKey: request.idempotencyKey,
        },
      );

      if (error) {
        const retryable = retryableResendErrors.has(error.name);

        throw new EmailSendError({
          code: `resend_${error.name}`,
          message: `Resend ${error.name}: ${error.message}`,
          retryable,
          safeMessage: retryable
            ? "Resend temporarily could not accept the confirmation email."
            : "Resend rejected the confirmation email request.",
        });
      }

      if (!data?.id) {
        throw new EmailSendError({
          code: "resend_missing_message_id",
          message: "Resend accepted the request without returning a message ID.",
          retryable: true,
          safeMessage:
            "Resend temporarily could not confirm the email delivery request.",
        });
      }

      return { messageId: data.id };
    },
  };
}

export function getEmailProvider(): EmailProvider {
  const providerName =
    process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "disabled";

  if (providerName === "disabled") {
    return disabledProvider;
  }

  if (providerName === "resend") {
    return createResendEmailProvider();
  }

  throw new Error(
    `Unsupported EMAIL_PROVIDER "${providerName}". Use "disabled" or "resend".`,
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
