export type ProfileAvatarIcon =
  | "anonymous"
  | "basketball"
  | "whistle"
  | "trophy"
  | "bolt"
  | "ticket";

export type ProfileAvatarOption = {
  bgClass: string;
  icon: ProfileAvatarIcon;
  id: string;
  label: string;
  textClass: string;
};

export const PROFILE_AVATAR_OPTIONS: ProfileAvatarOption[] = [
  {
    bgClass: "bg-slate-900",
    icon: "anonymous",
    id: "anonymous-slate",
    label: "Anonymous",
    textClass: "text-white",
  },
  {
    bgClass: "bg-slate-100",
    icon: "basketball",
    id: "basketball-blue",
    label: "Basketball",
    textClass: "text-slate-950",
  },
  {
    bgClass: "bg-emerald-600",
    icon: "whistle",
    id: "whistle-green",
    label: "Whistle",
    textClass: "text-white",
  },
  {
    bgClass: "bg-amber-400",
    icon: "trophy",
    id: "trophy-gold",
    label: "Trophy",
    textClass: "text-slate-950",
  },
  {
    bgClass: "bg-violet-600",
    icon: "bolt",
    id: "bolt-violet",
    label: "Lightning",
    textClass: "text-white",
  },
  {
    bgClass: "bg-sky-100",
    icon: "ticket",
    id: "ticket-sky",
    label: "Ticket",
    textClass: "text-blue-700",
  },
];

export function getProfileAvatarOption(id: string | null | undefined) {
  return (
    PROFILE_AVATAR_OPTIONS.find((option) => option.id === id) ??
    PROFILE_AVATAR_OPTIONS[0]
  );
}
