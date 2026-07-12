"use server";

import { z } from "zod";
import { getEmailProvider } from "@/lib/email/provider";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.email("Enter a valid email.").trim().toLowerCase(),
  message: z.string().trim().min(10, "Add a little more detail.").max(2000),
  name: z.string().trim().min(2, "Enter your name.").max(120),
});

export type SupportState = { message: string; success?: boolean };

export async function sendSupportRequest(_state: SupportState, formData: FormData): Promise<SupportState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check the form." };
  const allowed = await checkRateLimit({ key: `support:${await getRequestIp()}`, limit: 5, windowSeconds: 3600 });
  if (!allowed) return { message: "Too many messages. Try again later." };
  const provider = getEmailProvider();
  if (!provider.isConfigured) return { message: "Email support is temporarily unavailable. Contact the event organizer." };
  const safeName = escapeHtml(parsed.data.name);
  const safeEmail = escapeHtml(parsed.data.email);
  const safeMessage = escapeHtml(parsed.data.message).replaceAll("\n", "<br />");
  try {
    await provider.send({
      html: `<h1>TourniBase support request</h1><p><strong>From:</strong> ${safeName} (${safeEmail})</p><p>${safeMessage}</p>`,
      idempotencyKey: `support-${Date.now()}-${parsed.data.email}`,
      replyTo: parsed.data.email,
      subject: `TourniBase support request from ${parsed.data.name}`,
      text: `From: ${parsed.data.name} (${parsed.data.email})\n\n${parsed.data.message}`,
      to: process.env.SUPPORT_EMAIL_TO?.trim() || "lsautomates@gmail.com",
    });
    return { message: "Your message was sent. We’ll reply by email.", success: true };
  } catch {
    return { message: "The message could not be sent. Try again in a moment." };
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}
