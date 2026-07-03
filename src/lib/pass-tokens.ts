const PASS_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPassToken(token: string) {
  return PASS_TOKEN_PATTERN.test(token);
}

export function extractPassToken(value: string) {
  const candidate = value.trim();

  if (isValidPassToken(candidate)) {
    return candidate.toLowerCase();
  }

  try {
    const url = new URL(candidate);
    const segments = url.pathname.split("/").filter(Boolean);
    const passSegmentIndex = segments.lastIndexOf("p");
    const token = segments[passSegmentIndex + 1];

    if (
      passSegmentIndex < 0 ||
      passSegmentIndex + 2 !== segments.length ||
      !token ||
      !isValidPassToken(token)
    ) {
      return null;
    }

    return token.toLowerCase();
  } catch {
    return null;
  }
}
