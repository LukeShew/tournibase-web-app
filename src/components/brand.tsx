import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      aria-label="TourniBase home"
    >
      <Image
        src="/tournibase-app-icon.svg"
        alt=""
        width={38}
        height={38}
        priority
      />
      <span className="text-lg font-semibold tracking-[-0.025em] text-white">
        TourniBase
      </span>
    </Link>
  );
}
