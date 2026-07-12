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

  if (message.includes("already registered")) {
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

  if (message.includes("email")) {
    return "Check the email address, then try again.";
  }

  if (!error && !identityCreated) {
    return "An account with that email already exists. Try signing in.";
  }

  return "The account could not be created. Try again.";
}
