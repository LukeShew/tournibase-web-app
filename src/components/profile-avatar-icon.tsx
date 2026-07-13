import type { ProfileAvatarIcon } from "@/lib/profile-avatar-options";

export function ProfileAvatarIcon({
  icon,
  className = "h-5 w-5",
}: {
  className?: string;
  icon: ProfileAvatarIcon;
}) {
  if (icon === "basketball") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 3.75c3 2.1 4.8 5.1 4.8 8.25S15 18.15 12 20.25M12 3.75C9 5.85 7.2 8.9 7.2 12S9 18.15 12 20.25M3.75 12h16.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.6"
        />
      </svg>
    );
  }

  if (icon === "whistle") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M5 12.5a5.5 5.5 0 0 1 5.5-5.5H16l2-2h3v5.5l-2.2 1.1A6.5 6.5 0 0 1 5 12.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <circle cx="10.5" cy="12.5" r="1.9" fill="currentColor" />
        <path d="M4 18h11" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (icon === "trophy") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M8 4h8v3.5a4 4 0 0 1-8 0V4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M8 6H5.5a2.5 2.5 0 0 0 0 5H8M16 6h2.5a2.5 2.5 0 0 1 0 5H16M12 12v4M8.5 20h7M10 16h4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (icon === "bolt") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M13.5 3 6 13h5l-.5 8L18 10h-5l.5-7Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "ticket") {
    return (
      <svg
        aria-hidden="true"
        className={className}
        fill="none"
        viewBox="0 0 24 24"
      >
        <path
          d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v1.25a2.25 2.25 0 0 0 0 4.5v1.25a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5v-1.25a2.25 2.25 0 0 0 0-4.5V8.5Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path d="M9 9h6M9 12h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="8.5" r="3.5" fill="currentColor" opacity="0.9" />
      <path
        d="M5 20a7 7 0 0 1 14 0"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}
