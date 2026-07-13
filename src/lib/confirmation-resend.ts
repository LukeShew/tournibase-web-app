export const CONFIRMATION_RESEND_COOLDOWN_SECONDS = 60;

export function getConfirmationResendSecondsRemaining(
  availableAt: number,
  now = Date.now(),
) {
  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}
