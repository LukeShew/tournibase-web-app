"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { IScannerControls } from "@zxing/browser";
import { extractPassToken } from "@/lib/pass-tokens";

type ScannerView =
  | { mode: "idle" }
  | { mode: "starting" }
  | { mode: "scanning" }
  | {
      mode: "captured";
      passToken: string;
      source: "camera" | "manual";
    }
  | {
      message: string;
      mode: "camera_error" | "invalid";
    };

type RecentCapture = {
  capturedAt: string;
  id: string;
  passToken: string;
};

export function MobileGateScanner({
  eventName,
  expiresAt,
  gateName,
  permissions,
  staffLabel,
  venueName,
}: {
  eventName: string;
  expiresAt: string;
  gateName: string;
  permissions: string[];
  staffLabel: string;
  venueName: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanLockedRef = useRef(false);
  const mountedRef = useRef(true);
  const [view, setView] = useState<ScannerView>({ mode: "idle" });
  const [recentCaptures, setRecentCaptures] = useState<RecentCapture[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [toolNotice, setToolNotice] = useState<string | null>(null);

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
    setShowRecent(false);
    setToolNotice(null);
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
          captureCandidate(result.getText(), "camera");
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

  function captureCandidate(value: string, source: "camera" | "manual") {
    stopCamera();
    const passToken = extractPassToken(value);

    if (!passToken) {
      setView({
        message:
          "This QR code does not contain a TourniBase mobile pass link or pass token.",
        mode: "invalid",
      });
      return;
    }

    setRecentCaptures((currentCaptures) => [
      {
        capturedAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        passToken,
      },
      ...currentCaptures,
    ].slice(0, 5));
    setView({ mode: "captured", passToken, source });
  }

  function submitManualPass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const value = formData.get("passValue");

    captureCandidate(typeof value === "string" ? value : "", "manual");
  }

  function openManualLookup() {
    setShowRecent(false);
    setToolNotice(null);
    manualInputRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    manualInputRef.current?.focus();
  }

  function openRecentCaptures() {
    setToolNotice(null);
    setShowRecent((isVisible) => !isVisible);
  }

  function showGateSaleNotice() {
    setShowRecent(false);
    setToolNotice(
      "Gate sale recording is not enabled on this scanner yet.",
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
              Expires {formatShortDateTime(expiresAt)}
            </span>
          </div>
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
          {view.mode === "captured" ? (
            <ResultPanel
              eyebrow="Pass detected"
              title="CODE CAPTURED"
              description="The pass code was read successfully. Do not admit the guest until TourniBase displays a secure validation result."
              tone="blue"
              detail={`Pass ending ${view.passToken.slice(-8)} · ${view.source === "camera" ? "Camera" : "Manual entry"}`}
              actionLabel="Scan next pass"
              onAction={startCamera}
            />
          ) : view.mode === "invalid" ? (
            <ResultPanel
              eyebrow="Not recognized"
              title="INVALID QR"
              description={view.message}
              tone="red"
              actionLabel="Try another pass"
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
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-strong px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Read pass code
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
              onClick={openRecentCaptures}
            />
            <GateToolButton
              label="Gate sale"
              enabled={canRecordSale}
              onClick={showGateSaleNotice}
            />
          </div>

          {showRecent ? (
            <RecentCaptures captures={recentCaptures} />
          ) : toolNotice ? (
            <p
              aria-live="polite"
              className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-sm leading-6 text-amber-100"
            >
              {toolNotice}
            </p>
          ) : null}
        </section>

        <p className="mt-5 px-2 text-center text-xs leading-5 text-slate-600">
          Capturing a QR code does not admit a guest. Every pass must receive a
          server validation result.
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
  tone: "amber" | "blue" | "red";
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
    red: {
      background: "bg-red-400/[0.08]",
      button: "bg-red-300 text-red-950 hover:bg-red-200",
      text: "text-red-200",
    },
  } satisfies Record<
    "amber" | "blue" | "red",
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

function RecentCaptures({ captures }: { captures: RecentCapture[] }) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-black/10 p-4">
      <p className="text-sm font-semibold text-white">
        Recent codes on this device
      </p>
      {captures.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-slate-500">
          No pass codes have been captured in this browser session.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {captures.map((capture) => (
            <li
              key={capture.id}
              className="flex items-center justify-between gap-3 py-2.5 text-xs"
            >
              <span className="font-mono text-slate-300">
                …{capture.passToken.slice(-8)}
              </span>
              <span className="text-slate-600">
                {new Intl.DateTimeFormat("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                }).format(new Date(capture.capturedAt))}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-600">
        These are detected codes, not admission decisions.
      </p>
    </div>
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

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}
