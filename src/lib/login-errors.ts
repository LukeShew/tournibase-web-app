type LoginErrorLike = {
  code?: string;
  message?: string;
};

export function isEmailConfirmationRequired(error?: LoginErrorLike | null) {
  const code = error?.code?.toLowerCase() ?? "";
  const message = error?.message?.toLowerCase() ?? "";

  return (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    message.includes("email is not confirmed")
  );
}

export function getLoginFailureMessage({
  accountExists,
}: {
  accountExists: boolean | null;
}) {
  if (accountExists === false) {
    return "No account exists with that email. Create an account first.";
  }

  if (accountExists === true) {
    return "The password is incorrect.";
  }

  return "Email or password is incorrect.";
}
