export type RefundActionResponse =
  | { ok: true; status: "completed" }
  | {
      ok: false;
      status: "pending" | "requires_action";
      message: string;
    };

export function getRefundActionResponse(
  refundStatus: string | null | undefined,
  synchronized: boolean,
): RefundActionResponse {
  if (refundStatus === "failed" || refundStatus === "canceled") {
    throw new Error("The refund needs review in Stripe before retrying.");
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
        "Stripe is processing this refund. It has not completed yet. You can check again safely; a second refund will not be created.",
    };
  }

  if (!synchronized) {
    return {
      ok: false,
      status: "pending",
      message:
        "Stripe accepted the refund. TourniBase is still updating the order. No new refund is needed; you can check again safely.",
    };
  }

  return { ok: true, status: "completed" };
}
