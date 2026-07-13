type SignupErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

export function getSignupFailureMessage({
  error,
  identityCreated,
}: {
  error?: SignupErrorLike | null;
  identityCreated: boolean;
}) {
  const code = error?.code?.toLowerCase() ?? "";
  const message = error?.message?.toLowerCase() ?? "";

  if (
    code.includes("rate_limit") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("after 60 seconds")
  ) {
    return "Please wait a minute before trying again. Confirmation emails have a short sending cooldown.";
  }

  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("already in use")
  ) {
    return "An account with that email already exists. Try signing in.";
  }

  if (
    code === "signup_disabled" ||
    (message.includes("signup") &&
      (message.includes("disabled") || message.includes("not allowed")))
  ) {
    return "New account creation is not enabled right now. Contact TourniBase support.";
  }

  if (message.includes("password")) {
    return "Use a stronger password, then try again.";
  }

  if (
    (code.includes("email") || message.includes("email")) &&
    (message.includes("invalid") || message.includes("valid email"))
  ) {
    return "Enter a valid email address, then try again.";
  }

  if (message.includes("email")) {
    return "We could not send a confirmation email right now. Please wait a minute and try again.";
  }

  if (!error && !identityCreated) {
    return "An account with that email already exists. Try signing in.";
  }

  return "The account could not be created. Try again.";
}
