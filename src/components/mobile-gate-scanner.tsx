"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { IScannerControls } from "@zxing/browser";
import type {
  OverridePassInput,
  PassValidationResult,
  ScanSource,
  UndoCheckInInput,
  UndoCheckInResult,
  ValidatePassInput,
} from "@/lib/pass-validation-types";
import { formatEventValidity } from "@/lib/event-time";
import { GATE_STAFF_PROMISE } from "@/lib/product-copy";

type ScannerView =
  | { mode: "idle" }
  | { mode: "starting" }
  | { mode: "scanning" }
  | {
      mode: "validating";
    }
  | {
      candidate: string;
      mode: "result";
      result: PassValidationResult;
      source: ScanSource;
    }
  | {
      message: string;
      mode: "camera_error";
    }
  | {
      message: string;
      mode: "notice";
      title: string;
      tone: "green" | "red";
    };

export function MobileGateScanner({
  eventName,
  eventTimeZone,
  expiresAt,
  gateName,
  overridePass,
  permissions,
  staffLabel,
  undoCheckIn,
  validatePass,
  venueName,
}: {
  eventName: string;
  eventTimeZone: string;
  expiresAt: string;
  gateName: string;
  overridePass: (input: OverridePassInput) => Promise<PassValidationResult>;
  permissions: string[];
  staffLabel: string;
  undoCheckIn: (input: UndoCheckInInput) => Promise<UndoCheckInResult>;
  validatePass: (input: ValidatePassInput) => Promise<PassValidationResult>;
  venueName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanLockedRef = useRef(false);
  const mountedRef = useRef(true);
  const [view, setView] = useState<ScannerView>({ mode: "idle" });
  const [showResultDetails, setShowResultDetails] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [resultActionNotice, setResultActionNotice] = useState<string | null>(
    null,
  );
  const [resultActionPending, setResultActionPending] = useState(false);

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    const stream = videoRef.current?.srcObject;

    if (
      stream &&
      typeof MediaStream !== "undefined" &&
      stream instanceof MediaStream
    ) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  async function startCamera() {
    if (!videoRef.current) {
      return;
    }

    stopCamera();
    scanLockedRef.current = false;
    setShowOverrideForm(false);
    setShowResultDetails(false);
    setOverrideReason("");
    setResultActionNotice(null);
    setView({ mode: "starting" });

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setView({
        message:
          "Camera scanning requires a secure connection and a supported browser. Use manual pass entry below.",
        mode: "camera_error",
      });
      return;
    }

    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 120,
      });
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            height: { ideal: 720 },
            width: { ideal: 1280 },
          },
        },
        videoRef.current,
        (result, _error, activeControls) => {
          if (!result || scanLockedRef.current) {
            return;
          }

          scanLockedRef.current = true;
          activeControls.stop();
          void validateCandidate(result.getText(), "camera");
        },
      );

      if (!mountedRef.current || scanLockedRef.current) {
        controls.stop();
        return;
      }

      scannerControlsRef.current = controls;
      setView({ mode: "scanning" });
    } catch (error) {
      stopCamera();

      if (!mountedRef.current) {
        return;
      }

      setView({
        message: getCameraErrorMessage(error),
        mode: "camera_error",
      });
    }
  }

  async function validateCandidate(value: string, source: ScanSource) {
    stopCamera();
    const candidate = value.trim();

    setShowOverrideForm(false);
    setShowResultDetails(false);
    setOverrideReason("");
    setResultActionNotice(null);
    setView({ mode: "validating" });

    let result: PassValidationResult;

    try {
      result = await validatePass({ candidate, source });
    } catch {
      result = {
        message:
          "TourniBase could not validate this pass. Check the connection and try again.",
        status: "service_error",
      };
    }

    if (!mountedRef.current) {
      return;
    }

    setView({ candidate, mode: "result", result, source });
  }

  function submitManualPass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const value = formData.get("passValue");

    void validateCandidate(
      typeof value === "string" ? value : "",
      "manual",
    );
  }

  async function handleUndo(checkInId: number) {
    setResultActionPending(true);
    setResultActionNotice(null);
    let result: UndoCheckInResult;

    try {
      result = await undoCheckIn({ checkInId });
    } catch {
      result = {
        message:
          "TourniBase could not undo this check-in. Check the connection and try again.",
        status: "service_error",
      };
    }

    if (!mountedRef.current) {
      return;
    }

    setResultActionPending(false);

    if (result.status === "undone") {
      setView({
        message: `${result.ticketName} is available to scan again.`,
        mode: "notice",
        title: "CHECK-IN UNDONE",
        tone: "green",
      });
      return;
    }

    setResultActionNotice(result.message);
  }

  async function handleOverride(
    candidate: string,
    passId: number,
    source: ScanSource,
  ) {
    setResultActionPending(true);
    setResultActionNotice(null);
    let result: PassValidationResult;

    try {
      result = await overridePass({
        candidate,
        passId,
        reason: overrideReason,
        source,
      });
    } catch {
      result = {
        message:
          "TourniBase could not record the override. Check the connection and try again.",
        status: "service_error",
      };
    }

    if (!mountedRef.current) {
      return;
    }

    setResultActionPending(false);

    if (result.status === "valid") {
      setShowOverrideForm(false);
      setOverrideReason("");
      setView({ candidate, mode: "result", result, source });
      return;
    }

    setResultActionNotice(result.message);
  }

  function openManualLookup() {
    window.location.assign(
      `${window.location.pathname.replace(/\/+$/, "")}/lookup`,
    );
  }

  function openRecentScans() {
    window.location.assign(
      `${window.location.pathname.replace(/\/+$/, "")}/recent`,
    );
  }

  function openGateSale() {
    window.location.assign(
      `${window.location.pathname.replace(/\/+$/, "")}/sale`,
    );
  }

  const canLookup = permissions.includes("lookup");
  const canViewRecent = permissions.includes("recent");
  const canRecordSale = permissions.includes("manual_sale");
  const statusLabel =
    view.mode === "starting"
      ? "Starting camera"
      : view.mode === "scanning"
        ? "Camera active"
        : view.mode === "validating"
          ? "Validating pass"
        : "Ready to scan";

  return (
    <main className="app-grid min-h-screen bg-background pb-8">
      <header className="border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm font-semibold text-white">TourniBase Gate</p>
            <p className="mt-0.5 text-xs text-slate-500">{gateName}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-xs font-semibold text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            {statusLabel}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-xl px-4 py-5 sm:px-5 sm:py-7">
        <section className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-300">
            {venueName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">
            {eventName}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-full bg-white/5 px-3 py-1.5">
              Gate: {gateName}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1.5">
              Staff: {staffLabel}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1.5">
              Expires {formatShortDateTime(expiresAt, eventTimeZone)}
            </span>
          </div>
          <p className="mt-4 text-sm font-medium text-blue-200">
            {GATE_STAFF_PROMISE}
          </p>
        </section>

        <section
          aria-live="assertive"
          className="relative mt-4 overflow-hidden rounded-3xl border border-border bg-card"
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Live camera preview for QR scanning"
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${
              view.mode === "starting" || view.mode === "scanning"
                ? "opacity-100"
                : "opacity-0"
            }`}
          />
          {view.mode === "validating" ? (
            <ValidationPendingPanel />
          ) : view.mode === "result" ? (
            <ValidationResultPanel
              actionNotice={resultActionNotice}
              actionPending={resultActionPending}
              canLookup={canLookup}
              canSell={canRecordSale}
              eventTimeZone={eventTimeZone}
              onManualLookup={openManualLookup}
              onOverride={() =>
                handleOverride(
                  view.candidate,
                  view.result.status === "already_used"
                    ? view.result.passId
                    : 0,
                  view.source,
                )
              }
              onScanNext={startCamera}
              onSellCorrectPass={openGateSale}
              onToggleDetails={() =>
                setShowResultDetails((isVisible) => !isVisible)
              }
              onToggleOverride={() => {
                setResultActionNotice(null);
                setShowOverrideForm((isVisible) => !isVisible);
              }}
              onUndo={(checkInId) => handleUndo(checkInId)}
              overrideReason={overrideReason}
              result={view.result}
              setOverrideReason={setOverrideReason}
              showDetails={showResultDetails}
              showOverrideForm={showOverrideForm}
            />
          ) : view.mode === "notice" ? (
            <ResultPanel
              eyebrow="Admission updated"
              title={view.title}
              description={view.message}
              tone={view.tone}
              actionLabel="Scan next pass"
              onAction={startCamera}
            />
          ) : view.mode === "camera_error" ? (
            <ResultPanel
              eyebrow="Camera unavailable"
              title="USE MANUAL ENTRY"
              description={view.message}
              tone="amber"
              actionLabel="Try camera again"
              onAction={startCamera}
            />
          ) : (
            <CameraPanel
              mode={view.mode}
              onStart={startCamera}
              onStop={() => {
                stopCamera();
                setView({ mode: "idle" });
              }}
            />
          )}
        </section>

        <section className="mt-4 rounded-3xl border border-border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            Camera fallback
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Enter a pass manually
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Paste the mobile pass link or its UUID if the camera cannot read
            the code.
          </p>
          <form onSubmit={submitManualPass} className="mt-4">
            <label
              htmlFor="manual-pass-value"
              className="text-sm font-medium text-slate-200"
            >
              Pass link or token
            </label>
            <input
              ref={manualInputRef}
              id="manual-pass-value"
              name="passValue"
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://…/p/… or pass UUID"
              className="mt-2 h-12 w-full rounded-xl border border-border bg-black/20 px-3 font-mono text-sm text-white outline-none transition placeholder:font-sans placeholder:text-slate-600 focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
            <button
              type="submit"
              disabled={view.mode === "validating"}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {view.mode === "validating"
                ? "Validating…"
                : "Validate pass"}
            </button>
          </form>
        </section>

        <section className="mt-4 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-semibold text-white">Gate tools</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <GateToolButton
              label="Manual lookup"
              enabled={canLookup}
              onClick={openManualLookup}
            />
            <GateToolButton
              label="Recent scans"
              enabled={canViewRecent}
              onClick={openRecentScans}
            />
            <GateToolButton
              label="Gate sale"
              enabled={canRecordSale}
              onClick={openGateSale}
            />
          </div>
        </section>

        <p className="mt-5 px-2 text-center text-xs leading-5 text-slate-600">
          Every scan is checked against the paid order, pass status, event,
          valid date, and prior admissions before entry is approved.
        </p>
      </div>
    </main>
  );
}

function CameraPanel({
  mode,
  onStart,
  onStop,
}: {
  mode: "idle" | "scanning" | "starting";
  onStart: () => void;
  onStop: () => void;
}) {
  const cameraActive = mode === "scanning" || mode === "starting";

  return (
    <div
      className={`relative min-h-[26rem] ${
        cameraActive ? "bg-transparent" : "bg-black"
      }`}
    >
      {cameraActive ? (
        <>
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/15 p-10">
            <div className="relative aspect-square w-full max-w-64 rounded-3xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.28)]">
              <span className="absolute -left-0.5 -top-0.5 h-9 w-9 rounded-tl-3xl border-l-4 border-t-4 border-blue-400" />
              <span className="absolute -right-0.5 -top-0.5 h-9 w-9 rounded-tr-3xl border-r-4 border-t-4 border-blue-400" />
              <span className="absolute -bottom-0.5 -left-0.5 h-9 w-9 rounded-bl-3xl border-b-4 border-l-4 border-blue-400" />
              <span className="absolute -bottom-0.5 -right-0.5 h-9 w-9 rounded-br-3xl border-b-4 border-r-4 border-blue-400" />
            </div>
            <p className="absolute bottom-6 rounded-full bg-black/65 px-4 py-2 text-sm font-medium text-white">
              {mode === "starting"
                ? "Starting camera…"
                : "Hold the pass QR inside the frame"}
            </p>
          </div>
          <button
            type="button"
            onClick={onStop}
            className="absolute right-4 top-4 z-10 rounded-full bg-black/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/85"
          >
            Stop camera
          </button>
        </>
      ) : (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-blue-300/20 bg-blue-300/10 text-2xl text-blue-200">
              ◫
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-white">
              Scan a mobile pass
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
              Camera access begins only after you tap the button.
            </p>
            <button
              type="button"
              onClick={onStart}
              className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-brand-strong px-6 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Start camera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationPendingPanel() {
  return (
    <div className="grid min-h-[26rem] place-items-center bg-blue-400/[0.06] p-6 text-center">
      <div>
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-300/20 border-t-blue-300" />
        <p className="mt-6 text-sm font-semibold text-blue-200">
          Secure validation
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
          CHECKING PASS
        </h2>
        <p className="mx-auto mt-3 max-w-sm leading-7 text-slate-400">
          Confirming payment, pass status, valid date, and prior admissions.
        </p>
      </div>
    </div>
  );
}

function ValidationResultPanel({
  actionNotice,
  actionPending,
  canLookup,
  canSell,
  eventTimeZone,
  onManualLookup,
  onOverride,
  onScanNext,
  onSellCorrectPass,
  onToggleDetails,
  onToggleOverride,
  onUndo,
  overrideReason,
  result,
  setOverrideReason,
  showDetails,
  showOverrideForm,
}: {
  actionNotice: string | null;
  actionPending: boolean;
  canLookup: boolean;
  canSell: boolean;
  eventTimeZone: string;
  onManualLookup: () => void;
  onOverride: () => void;
  onScanNext: () => void;
  onSellCorrectPass: () => void;
  onToggleDetails: () => void;
  onToggleOverride: () => void;
  onUndo: (checkInId: number) => void;
  overrideReason: string;
  result: PassValidationResult;
  setOverrideReason: (value: string) => void;
  showDetails: boolean;
  showOverrideForm: boolean;
}) {
  const presentation = getValidationPresentation(result);

  return (
    <div
      className={`min-h-[26rem] p-6 text-center sm:p-8 ${presentation.background}`}
    >
      <p className={`text-sm font-semibold ${presentation.text}`}>
        {presentation.eyebrow}
      </p>
      <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
        {presentation.title}
      </h2>
      <p className="mx-auto mt-4 max-w-md leading-7 text-slate-300">
        {presentation.description}
      </p>

      <ValidationSummary
        eventTimeZone={eventTimeZone}
        result={result}
      />

      {showDetails ? (
        <ValidationDetails
          eventTimeZone={eventTimeZone}
          result={result}
        />
      ) : null}

      {actionNotice ? (
        <p className="mx-auto mt-4 max-w-md rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">
          {actionNotice}
        </p>
      ) : null}

      {showOverrideForm && result.status === "already_used" ? (
        <div className="mx-auto mt-5 max-w-md rounded-2xl border border-red-300/20 bg-black/15 p-4 text-left">
          <label
            htmlFor="override-reason"
            className="text-sm font-semibold text-white"
          >
            Override reason
          </label>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Explain why another admission should be allowed. This is saved in
            the gate record.
          </p>
          <textarea
            id="override-reason"
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            minLength={3}
            maxLength={500}
            rows={3}
            placeholder="Example: Director approved re-entry"
            className="mt-3 w-full resize-none rounded-xl border border-border bg-black/25 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-red-300/40 focus:ring-4 focus:ring-red-300/10"
          />
          <button
            type="button"
            disabled={actionPending || overrideReason.trim().length < 3}
            onClick={onOverride}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-red-300 px-4 text-sm font-semibold text-red-950 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionPending ? "Recording override…" : "Admit with override"}
          </button>
        </div>
      ) : null}

      <div className="mx-auto mt-7 grid max-w-md gap-2 sm:grid-cols-2">
        <ResultActionButton
          disabled={actionPending}
          label="Scan next"
          onClick={onScanNext}
          variant="primary"
        />

        {result.status === "valid" ? (
          <>
            <ResultActionButton
              disabled={actionPending}
              label={actionPending ? "Undoing…" : "Undo check-in"}
              onClick={() => onUndo(result.checkInId)}
              variant="secondary"
            />
            <ResultActionButton
              label={showDetails ? "Hide details" : "View details"}
              onClick={onToggleDetails}
              variant="secondary"
            />
          </>
        ) : result.status === "already_used" ? (
          <>
            <ResultActionButton
              label={showDetails ? "Hide details" : "View details"}
              onClick={onToggleDetails}
              variant="secondary"
            />
            <ResultActionButton
              disabled={!canLookup}
              label={showOverrideForm ? "Cancel override" : "Override"}
              onClick={onToggleOverride}
              variant="danger"
            />
          </>
        ) : result.status === "wrong_day" ? (
          <>
            <ResultActionButton
              disabled={!canLookup}
              label="Manual lookup"
              onClick={onManualLookup}
              variant="secondary"
            />
            <ResultActionButton
              disabled={!canSell}
              label="Sell correct pass"
              onClick={onSellCorrectPass}
              variant="secondary"
            />
          </>
        ) : result.status === "invalid" ||
          result.status === "not_active" ? (
          <ResultActionButton
            disabled={!canLookup}
            label="Manual lookup"
            onClick={onManualLookup}
            variant="secondary"
          />
        ) : null}
      </div>
    </div>
  );
}

function ValidationSummary({
  eventTimeZone,
  result,
}: {
  eventTimeZone: string;
  result: PassValidationResult;
}) {
  if (result.status === "valid") {
    return (
      <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-2">
        <ResultMetric label="Ticket" value={result.ticketName} />
        <ResultMetric
          label="Admit count"
          value={`${result.admitCount} of ${result.usesAllowed}`}
        />
      </div>
    );
  }

  if (result.status === "already_used") {
    return (
      <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-2">
        <ResultMetric label="Ticket" value={result.ticketName} />
        <ResultMetric
          label="First scan"
          value={
            result.firstScannedAt
              ? formatShortDateTime(
                  result.firstScannedAt,
                  eventTimeZone,
                )
              : "Recorded previously"
          }
        />
      </div>
    );
  }

  if (result.status === "wrong_day") {
    return (
      <div className="mx-auto mt-5 max-w-md">
        <ResultMetric
          label="Valid period"
          value={formatEventValidity(
            result.validFrom,
            result.validUntil,
            eventTimeZone,
          )}
        />
      </div>
    );
  }

  if (result.status === "not_active") {
    return (
      <div className="mx-auto mt-5 max-w-md">
        <ResultMetric label="Ticket" value={result.ticketName} />
      </div>
    );
  }

  return null;
}

function ValidationDetails({
  eventTimeZone,
  result,
}: {
  eventTimeZone: string;
  result: PassValidationResult;
}) {
  if (result.status === "valid") {
    return (
      <dl className="mx-auto mt-4 max-w-md divide-y divide-border rounded-2xl border border-border bg-black/15 px-4 text-left">
        <ResultDetail label="Tournament" value={result.tournamentName} />
        <ResultDetail label="Gate" value={result.gateName} />
        <ResultDetail
          label="Check-in time"
          value={formatShortDateTime(
            result.checkInTime,
            eventTimeZone,
          )}
        />
        <ResultDetail
          label="Entry type"
          value={
            result.wasOverride
              ? "Director override"
              : result.wasManual
                ? "Manual check-in"
                : "Camera scan"
          }
        />
      </dl>
    );
  }

  if (result.status === "already_used") {
    return (
      <dl className="mx-auto mt-4 max-w-md divide-y divide-border rounded-2xl border border-border bg-black/15 px-4 text-left">
        <ResultDetail
          label="First gate"
          value={result.firstGateName ?? "Unknown gate"}
        />
        <ResultDetail
          label="Admissions"
          value={`${result.admitCount} of ${result.usesAllowed}`}
        />
      </dl>
    );
  }

  return null;
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ResultDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-200">{value}</dd>
    </div>
  );
}

function ResultActionButton({
  disabled = false,
  label,
  onClick,
  variant,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  variant: "danger" | "primary" | "secondary";
}) {
  const styles = {
    danger:
      "border-red-300/25 bg-red-300/[0.08] text-red-100 hover:bg-red-300/[0.14]",
    primary: "border-blue-500 bg-blue-500 text-white hover:bg-blue-400",
    secondary:
      "border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-12 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {label}
    </button>
  );
}

function getValidationPresentation(result: PassValidationResult) {
  if (result.status === "valid") {
    return {
      background: "bg-emerald-300/[0.09]",
      description: result.wasOverride
        ? "Override recorded. Admit the guest."
        : "Pass approved. Admit the guest.",
      eyebrow: result.wasOverride
        ? "Admission override"
        : "Secure validation complete",
      text: "text-emerald-200",
      title: "VALID",
    };
  }

  if (result.status === "already_used") {
    return {
      background: "bg-red-400/[0.09]",
      description: "Do not admit without a documented override.",
      eyebrow: "Duplicate admission blocked",
      text: "text-red-200",
      title: "ALREADY SCANNED",
    };
  }

  if (result.status === "wrong_day") {
    return {
      background: "bg-amber-300/[0.09]",
      description: "This pass is outside its valid date or time.",
      eyebrow: "Date check failed",
      text: "text-amber-200",
      title: "NOT VALID TODAY",
    };
  }

  if (result.status === "not_active") {
    return {
      background: "bg-red-400/[0.09]",
      description: result.message,
      eyebrow: "Admission blocked",
      text: "text-red-200",
      title: "PASS NOT ACTIVE",
    };
  }

  if (result.status === "invalid") {
    return {
      background: "bg-red-400/[0.09]",
      description:
        "This QR code does not match an active TourniBase ticket for this event.",
      eyebrow: "Pass not recognized",
      text: "text-red-200",
      title: "INVALID PASS",
    };
  }

  if (result.status === "scanner_unauthorized") {
    return {
      background: "bg-red-400/[0.09]",
      description: result.message,
      eyebrow: "Scanner access ended",
      text: "text-red-200",
      title: "SCANNER UNAVAILABLE",
    };
  }

  return {
    background: "bg-amber-300/[0.09]",
    description: result.message,
    eyebrow: "Validation could not finish",
    text: "text-amber-200",
    title: "TRY AGAIN",
  };
}

function ResultPanel({
  actionLabel,
  description,
  detail,
  eyebrow,
  onAction,
  title,
  tone,
}: {
  actionLabel: string;
  description: string;
  detail?: string;
  eyebrow: string;
  onAction: () => void;
  title: string;
  tone: "amber" | "blue" | "green" | "red";
}) {
  const styles = {
    amber: {
      background: "bg-amber-300/[0.08]",
      button: "bg-amber-300 text-amber-950 hover:bg-amber-200",
      text: "text-amber-200",
    },
    blue: {
      background: "bg-blue-400/[0.08]",
      button: "bg-blue-500 text-white hover:bg-blue-400",
      text: "text-blue-200",
    },
    green: {
      background: "bg-emerald-300/[0.08]",
      button: "bg-emerald-300 text-emerald-950 hover:bg-emerald-200",
      text: "text-emerald-200",
    },
    red: {
      background: "bg-red-400/[0.08]",
      button: "bg-red-300 text-red-950 hover:bg-red-200",
      text: "text-red-200",
    },
  } satisfies Record<
    "amber" | "blue" | "green" | "red",
    { background: string; button: string; text: string }
  >;
  const style = styles[tone];

  return (
    <div
      className={`grid min-h-[26rem] place-items-center p-6 text-center ${style.background}`}
    >
      <div>
        <p className={`text-sm font-semibold ${style.text}`}>{eyebrow}</p>
        <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-md leading-7 text-slate-300">
          {description}
        </p>
        {detail ? (
          <p className="mt-3 font-mono text-xs text-slate-500">{detail}</p>
        ) : null}
        <button
          type="button"
          onClick={onAction}
          className={`mt-7 inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-semibold transition ${style.button}`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function GateToolButton({
  enabled,
  label,
  onClick,
}: {
  enabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      className="min-h-20 rounded-xl border border-border bg-white/[0.025] px-2 py-3 text-xs font-semibold leading-5 text-slate-200 transition hover:border-white/20 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35"
    >
      {label}
    </button>
  );
}

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera access was blocked. Allow camera access in your browser settings or use manual pass entry below.";
    }

    if (error.name === "NotFoundError") {
      return "No camera was found on this device. Use manual pass entry below.";
    }

    if (error.name === "NotReadableError") {
      return "The camera is already in use by another app or browser tab.";
    }
  }

  return "The camera could not start. Try again or use manual pass entry below.";
}

function formatShortDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(value));
}
