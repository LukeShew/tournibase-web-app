export class RefundReviewRequiredError extends Error {
  constructor() {
    super("A refund attempt failed or was canceled. Resolve it directly in Stripe; TourniBase will not automatically submit another refund. Contact support before restoring a blocked pass.");
  }
}

export type RefundActionResponse =
  | { ok: true; status: "completed" }
  | {
      ok: false;
      status: "pending" | "requires_action" | "synchronizing";
      message: string;
    };

export function getRefundActionResponse(
  refundStatus: string | null | undefined,
  synchronized: boolean,
): RefundActionResponse {
  if (refundStatus === "failed" || refundStatus === "canceled") {
    throw new RefundReviewRequiredError();
  }

  if (refundStatus === "requires_action") {
    return {
      ok: false,
      status: "requires_action",
      message:
        "Stripe needs additional action before this refund can finish. Open the payment in Stripe to review it. The refund has not completed.",
    };
  }

  if (refundStatus !== "succeeded") {
    return {
      ok: false,
      status: "pending",
      message:
        "Stripe is processing this refund. It has not completed yet. No new refund is needed; refresh the order or open Stripe to check its status.",
    };
  }

  if (!synchronized) {
    return {
      ok: false,
      status: "synchronizing",
      message:
        "Stripe accepted the refund. TourniBase is still updating the order. Do not submit another refund; refresh the order or open Stripe to check its status.",
    };
  }

  return { ok: true, status: "completed" };
}
