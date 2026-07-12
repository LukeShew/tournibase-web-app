"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type OrderLogItem = {
  id: number;
  quantity: number;
  ticket_name: string;
  unit_amount_cents: number;
  valid_from: string;
  valid_until: string;
};

export type OrderLogPass = {
  id: number;
  order_item_id: number;
  public_token: string;
  sequence_number: number | null;
  status: "active" | "checked_in" | "expired" | "refunded" | "voided";
  ticket_types: {
    name: string;
  } | null;
};

export type OrderLogOrder = {
  amount_refunded: number | string;
  amount_total: number | string;
  buyer_email: string;
  buyer_name: string;
  buyer_phone: string | null;
  created_at: string;
  id: number;
  order_items: OrderLogItem[];
  passes: OrderLogPass[];
  payment_status: "pending" | "paid" | "failed" | "refunded" | "partial_refund";
  stripe_checkout_id: string | null;
};

const ORDERS_PER_PAGE = 15;

export function OrderLogClient({
  orders,
  tournamentId,
}: {
  orders: OrderLogOrder[];
  tournamentId: number;
}) {
  const [activeOrder, setActiveOrder] = useState<OrderLogOrder | null>(null);
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * ORDERS_PER_PAGE;
  const visibleOrders = orders.slice(pageStart, pageStart + ORDERS_PER_PAGE);

  if (orders.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <h2 className="text-lg font-semibold text-slate-950">
          No matching orders
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Try another buyer name, email, phone number, or order number.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-border">
        {visibleOrders.map((order) => (
          <article
            key={order.id}
            className="relative flex flex-col gap-4 bg-card px-5 py-5 transition hover:bg-blue-50/40 lg:flex-row lg:items-center lg:justify-between"
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setActiveOrder(order)}
            >
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-sm font-semibold text-blue-700">
                  {getOrderNumber(order.id)}
                </p>
                <OrderStatusBadge status={order.payment_status} />
                <p className="font-mono text-xs text-slate-500">
                  {formatOrderDate(order.created_at)}
                </p>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                <div>
                  <p className="font-semibold text-slate-950">
                    {order.buyer_name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {order.buyer_email}
                  </p>
                </div>
                <div className="text-sm text-slate-500">
                  <p>
                    {order.order_items.length}{" "}
                    {order.order_items.length === 1 ? "ticket type" : "ticket types"}
                  </p>
                  <p className="mt-1">
                    {order.passes.length}{" "}
                    {order.passes.length === 1 ? "pass" : "passes"}
                  </p>
                </div>
                <p className="font-mono text-xl font-semibold text-slate-950">
                  {formatCurrency(Number(order.amount_total))}
                </p>
              </div>
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-white text-xl leading-none text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-950"
                aria-label={`Open actions for ${getOrderNumber(order.id)}`}
                onClick={() =>
                  setOpenActionsId((current) =>
                    current === order.id ? null : order.id,
                  )
                }
              >
                ⋯
              </button>
              {openActionsId === order.id ? (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => {
                      setActiveOrder(order);
                      setOpenActionsId(null);
                    }}
                  >
                    View full order details
                  </button>
                  <Link
                    href={`/dashboard/tournaments/${tournamentId}/gate`}
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => setOpenActionsId(null)}
                  >
                    Manual check-in lookup
                  </Link>
                  {order.stripe_checkout_id ? (
                    <a
                      href={getStripePaymentUrl(order.stripe_checkout_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => setOpenActionsId(null)}
                    >
                      View payment in Stripe
                    </a>
                  ) : (
                    <span className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-300">
                      No Stripe checkout ID
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {orders.length > ORDERS_PER_PAGE ? (
        <div className="flex flex-col gap-3 border-t border-border bg-card-strong px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Showing {pageStart + 1}–
            {Math.min(pageStart + ORDERS_PER_PAGE, orders.length)} of{" "}
            {orders.length} orders
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={safePage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              Previous
            </button>
            <span className="min-w-24 text-center text-sm font-semibold text-slate-500">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={safePage === totalPages}
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {activeOrder ? (
        <OrderDetailsModal
          order={activeOrder}
          onClose={() => setActiveOrder(null)}
        />
      ) : null}
    </>
  );
}

function OrderDetailsModal({
  onClose,
  order,
}: {
  onClose: () => void;
  order: OrderLogOrder;
}) {
  const router = useRouter();
  const [refundingPassId, setRefundingPassId] = useState<number | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

  async function refundPass(passId: number) {
    if (!window.confirm("Refund this pass and block it from future entry?")) {
      return;
    }

    setRefundError(null);
    setRefundingPassId(passId);

    try {
      const response = await fetch("/api/stripe/refund-pass", {
        body: JSON.stringify({ orderId: order.id, passId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "The pass could not be refunded.");
      }

      onClose();
      router.refresh();
    } catch (error) {
      setRefundError(error instanceof Error ? error.message : "The pass could not be refunded.");
    } finally {
      setRefundingPassId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${getOrderNumber(order.id)} order details`}
    >
      <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-card-strong px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              {getOrderNumber(order.id)}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              {order.buyer_name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatOrderDate(order.created_at)}
            </p>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-2xl leading-none text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-950"
            aria-label="Close order details"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="max-h-[calc(86vh-104px)] overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoBox label="Buyer email" value={order.buyer_email} />
            <InfoBox
              label="Buyer phone"
              value={order.buyer_phone || "Not provided"}
            />
            <InfoBox
              label="Amount paid"
              value={formatCurrency(
                Math.max(0, Number(order.amount_total) - Number(order.amount_refunded)),
              )}
            />
            <InfoBox
              label="Amount refunded"
              value={formatCurrency(Number(order.amount_refunded))}
            />
            <InfoBox
              label="Payment method"
              value={
                order.stripe_checkout_id
                  ? "Stripe Checkout"
                  : "Unavailable"
              }
            />
          </div>

          <section className="mt-6 rounded-[1.5rem] border border-border">
            <div className="border-b border-border bg-card-strong px-5 py-4">
              <h3 className="font-semibold text-slate-950">Tickets bought</h3>
            </div>
            <div className="divide-y divide-border">
              {order.order_items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-950">
                      {item.ticket_name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Valid {formatOrderDate(item.valid_from)} –{" "}
                      {formatOrderDate(item.valid_until)}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">
                    Qty {item.quantity}
                  </p>
                  <p className="font-mono text-sm font-semibold text-slate-950">
                    {formatCurrency(item.unit_amount_cents / 100)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-[1.5rem] border border-border">
            <div className="border-b border-border bg-card-strong px-5 py-4">
              <h3 className="font-semibold text-slate-950">Passes</h3>
            </div>
            {order.passes.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-500">
                No passes have been generated for this order yet.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {order.passes.map((pass) => (
                  <div
                    key={pass.id}
                    className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">
                        {pass.ticket_types?.name ?? "Admission pass"}
                        {pass.sequence_number ? ` · Pass ${pass.sequence_number}` : ""}
                      </p>
                      <p className="mt-1 text-sm capitalize text-slate-500">
                        {pass.status.replace("_", " ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/p/${pass.public_token}`}
                        className="inline-flex h-10 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        Open pass
                      </Link>
                      {order.payment_status !== "refunded" &&
                      pass.status !== "refunded" &&
                      pass.status !== "voided" &&
                      Number(order.amount_total) > 0 ? (
                        <button
                          type="button"
                          className="inline-flex h-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                          disabled={refundingPassId === pass.id}
                          onClick={() => refundPass(pass.id)}
                        >
                          {refundingPassId === pass.id ? "Refunding…" : "Refund this pass"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {refundError ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {refundError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            {order.stripe_checkout_id ? (
              <a
                href={getStripePaymentUrl(order.stripe_checkout_id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                View payment in Stripe
              </a>
            ) : null}
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-card-strong p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function OrderStatusBadge({
  status,
}: {
  status: OrderLogOrder["payment_status"];
}) {
  const className =
    status === "paid"
      ? "bg-emerald-50 text-emerald-700"
      : status === "refunded" || status === "partial_refund"
        ? "bg-amber-50 text-amber-700"
        : status === "failed"
          ? "bg-rose-50 text-rose-700"
          : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${className}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(value);
}

function getOrderNumber(orderId: number) {
  return `TB-${orderId.toString().padStart(6, "0")}`;
}

function getStripePaymentUrl(checkoutId: string) {
  return `/api/stripe/dashboard-payment?session_id=${encodeURIComponent(checkoutId)}`;
}
