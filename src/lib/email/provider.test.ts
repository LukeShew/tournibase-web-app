import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createResendEmailProvider,
  EmailSendError,
  getEmailProvider,
} from "./provider";

const request = {
  html: "<p>Your passes are ready.</p>",
  idempotencyKey: "order-confirmation-123",
  replyTo: "director@example.com",
  subject: "Your passes are ready",
  text: "Your passes are ready.",
  to: "buyer@example.com",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Resend email provider", () => {
  it("sends the rendered email with its sender and idempotency key", async () => {
    const send = vi.fn().mockResolvedValue({
      data: { id: "email_123" },
      error: null,
      headers: null,
    });
    const provider = createResendEmailProvider({
      apiKey: "re_test",
      from: "TourniBase <passes@tournibase.com>",
      send,
    });

    await expect(provider.send(request)).resolves.toEqual({
      messageId: "email_123",
    });
    expect(send).toHaveBeenCalledWith(
      {
        from: "TourniBase <passes@tournibase.com>",
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
  });

  it("marks temporary Resend failures as retryable", async () => {
    const provider = createResendEmailProvider({
      apiKey: "re_test",
      from: "TourniBase <passes@tournibase.com>",
      send: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "Too many requests.",
          name: "rate_limit_exceeded",
          statusCode: 429,
        },
        headers: null,
      }),
    });

    await expect(provider.send(request)).rejects.toMatchObject({
      code: "resend_rate_limit_exceeded",
      retryable: true,
    } satisfies Partial<EmailSendError>);
  });

  it("marks invalid sender configuration as permanent", async () => {
    const provider = createResendEmailProvider({
      apiKey: "re_test",
      from: "TourniBase <passes@tournibase.com>",
      send: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "Invalid from field.",
          name: "invalid_from_address",
          statusCode: 422,
        },
        headers: null,
      }),
    });

    await expect(provider.send(request)).rejects.toMatchObject({
      code: "resend_invalid_from_address",
      retryable: false,
    } satisfies Partial<EmailSendError>);
  });

  it("requires both Resend environment variables", () => {
    expect(() =>
      createResendEmailProvider({
        apiKey: "",
        from: "TourniBase <passes@tournibase.com>",
      }),
    ).toThrow("RESEND_API_KEY");
    expect(() =>
      createResendEmailProvider({
        apiKey: "re_test",
        from: "",
      }),
    ).toThrow("EMAIL_FROM");
  });

  it("selects Resend from the provider environment", () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "TourniBase <passes@tournibase.com>");

    expect(getEmailProvider()).toMatchObject({
      isConfigured: true,
      name: "resend",
    });
  });
});
