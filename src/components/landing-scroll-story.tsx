"use client";

import { useEffect, useRef, useState } from "react";

const chapters = [
  {
    eyebrow: "01 · Sell before arrival",
    title: "Turn admission into a simple checkout.",
    body: "Create Saturday, Sunday, and weekend passes, then share one public ticket page with teams and families.",
    points: ["Card checkout through Stripe", "Pass options tied to the event"],
  },
  {
    eyebrow: "02 · Deliver automatically",
    title: "Every buyer gets a pass built for their phone.",
    body: "After payment, TourniBase emails the order and gives each attendee a unique mobile pass for the gate.",
    points: ["Unique QR code for each pass", "Email delivery and mobile backup"],
  },
  {
    eyebrow: "03 · Validate at the gate",
    title: "Give staff a clear answer in seconds.",
    body: "A secure scanner link checks the pass and records entry without giving gate staff full dashboard access.",
    points: ["Valid entries recorded live", "Repeat and invalid use clearly blocked"],
  },
] as const;

export function LandingScrollStory() {
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        if (visibleEntry) {
          setActiveChapter(Number(visibleEntry.target.getAttribute("data-chapter")));
        }
      },
      { rootMargin: "-30% 0px -45% 0px", threshold: [0.1, 0.35, 0.6] },
    );

    const elements = chapterRefs.current;
    elements.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className="relative bg-[#f7f8fb] py-24 sm:py-32">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">One connected flow</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">From the first purchase to the final scan.</h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">The order, pass, and gate activity stay connected, so directors can see what is happening without piecing together separate systems.</p>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          <div>
            {chapters.map((chapter, index) => (
              <article
                key={chapter.eyebrow}
                ref={(element) => { chapterRefs.current[index] = element; }}
                data-chapter={index}
                className="flex min-h-[68vh] flex-col justify-center border-t border-slate-200 py-16 first:border-t-0 first:pt-0 lg:min-h-[72vh]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{chapter.eyebrow}</p>
                <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">{chapter.title}</h3>
                <p className="mt-5 text-lg leading-8 text-slate-600">{chapter.body}</p>
                <ul className="mt-7 space-y-3">
                  {chapter.points.map((point) => (
                    <li key={point} className="flex items-center gap-3 text-sm font-medium text-slate-700"><span className="grid h-6 w-6 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">✓</span>{point}</li>
                  ))}
                </ul>
                <div className="mt-9 lg:hidden"><StoryVisual activeChapter={index} compact /></div>
              </article>
            ))}
          </div>
          <div className="relative hidden lg:block">
            <div className="sticky top-10 flex h-[calc(100vh-5rem)] min-h-[620px] items-center"><StoryVisual activeChapter={activeChapter} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoryVisual({ activeChapter, compact = false }: { activeChapter: number; compact?: boolean }) {
  return (
    <div className={`gate-dark relative w-full overflow-hidden rounded-[2.25rem] bg-[#07111f] shadow-[0_35px_90px_rgba(15,23,42,0.24)] ${compact ? "min-h-[470px]" : "min-h-[620px]"}`}>
      <div className="landing-court-lines-dark absolute inset-0 opacity-60" />
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-xs font-bold text-white">T</span><span className="text-xs font-semibold text-white">TourniBase</span></div>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((index) => <span key={index} className={`h-1.5 rounded-full transition-all duration-500 motion-reduce:transition-none ${activeChapter === index ? "w-7 bg-blue-400" : "w-1.5 bg-white/20"}`} />)}
        </div>
      </div>
      <div className={`relative ${compact ? "h-[470px]" : "h-[620px]"}`}>
        <StoryPanel active={activeChapter === 0}><CheckoutScene compact={compact} /></StoryPanel>
        <StoryPanel active={activeChapter === 1}><PassScene compact={compact} /></StoryPanel>
        <StoryPanel active={activeChapter === 2}><GateScene compact={compact} /></StoryPanel>
      </div>
    </div>
  );
}

function StoryPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div aria-hidden={!active} className={`absolute inset-0 transition duration-700 ease-out motion-reduce:transition-none ${active ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-8 scale-[0.98] opacity-0"}`}>{children}</div>;
}

function CheckoutScene({ compact }: { compact: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-5 pb-6 pt-20 sm:px-9">
      <div className="w-full max-w-xl">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Ticket page</p>
        <div className="mt-5 overflow-hidden rounded-[1.75rem] bg-white shadow-2xl">
          <div className="bg-blue-600 px-5 py-5 text-white sm:px-7"><p className="text-xs text-blue-100">Sample tournament</p><p className="mt-1 text-xl font-semibold">Choose admission</p></div>
          <div className="space-y-3 p-5 sm:p-7">
            <TicketOption title="Saturday pass" price="$10" selected />
            <TicketOption title="Sunday pass" price="$10" />
            <TicketOption title="Weekend pass" price="$20" />
            <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5"><div><p className="text-xs text-slate-500">Order total</p><p className="mt-1 font-mono text-lg font-semibold text-slate-950">$10.00</p></div><span className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white">Continue to checkout</span></div>
          </div>
        </div>
        {!compact ? <p className="mt-5 text-center text-sm text-slate-400">One public page for the event</p> : null}
      </div>
    </div>
  );
}

function TicketOption({ price, selected = false, title }: { price: string; selected?: boolean; title: string }) {
  return <div className={`flex items-center justify-between rounded-2xl border p-3.5 ${selected ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}><div className="flex items-center gap-3"><span className={`h-4 w-4 rounded-full border-[4px] ${selected ? "border-blue-600" : "border-slate-300"}`} /><span className="text-sm font-semibold text-slate-800">{title}</span></div><span className="font-mono text-sm font-semibold text-slate-950">{price}</span></div>;
}

function PassScene({ compact }: { compact: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-5 pb-6 pt-20">
      <div className="relative flex w-full max-w-xl items-center justify-center">
        <div className="absolute left-0 top-1/2 hidden w-48 -translate-y-1/2 rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-white sm:block"><p className="text-[10px] uppercase tracking-[0.14em] text-blue-300">Email sent</p><p className="mt-3 text-sm font-semibold">Your admission passes</p><div className="mt-4 h-2 w-full rounded bg-white/10" /><div className="mt-2 h-2 w-3/4 rounded bg-white/10" /><div className="mt-5 rounded-lg bg-blue-600 py-2 text-center text-[10px] font-semibold">View passes</div></div>
        <div className="relative z-10 w-[245px] rounded-[2.75rem] border-[8px] border-slate-900 bg-blue-600 p-3 shadow-2xl sm:w-[270px]">
          <div className="rounded-[2rem] bg-blue-600 px-3 pb-4 pt-3 text-white"><div className="flex items-center justify-between text-[10px]"><span className="font-semibold">TourniBase</span><span className="text-blue-100">Admission pass</span></div><div className="mt-5 rounded-2xl bg-white p-4 text-slate-950"><p className="text-[10px] uppercase tracking-[0.12em] text-blue-700">Weekend pass</p><p className="mt-2 text-base font-semibold">Sample tournament</p><p className="mt-1 text-xs text-slate-500">Taylor Johnson</p><QrGraphic /><p className="mt-3 text-center font-mono text-[10px] text-slate-500">TB-004218</p></div></div>
        </div>
        {!compact ? <div className="absolute bottom-8 right-0 hidden w-44 rounded-2xl border border-white/10 bg-white/[0.07] p-4 sm:block"><p className="text-[10px] uppercase tracking-[0.14em] text-blue-300">Ready for the gate</p><p className="mt-2 text-xs leading-5 text-slate-300">Each admission has its own pass and QR code.</p></div> : null}
      </div>
    </div>
  );
}

function GateScene({ compact }: { compact: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-5 pb-6 pt-20 sm:px-9">
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.14em] text-blue-300">Gate 1</p><p className="mt-2 text-xl font-semibold text-white">Pass accepted</p></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-xl font-bold text-emerald-950">✓</span></div>
        <div className="mt-5 rounded-2xl bg-white p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-slate-500">Weekend pass</p><p className="mt-1 text-lg font-semibold text-slate-950">Taylor Johnson</p></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Checked in</span></div><div className="mt-5 grid grid-cols-2 gap-3"><GateDetail label="Order" value="TB-004218" /><GateDetail label="Time" value="10:42 AM" /></div></div>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4"><div><p className="text-xs font-semibold text-amber-200">Repeat scan protection</p><p className="mt-1 text-[10px] text-slate-400">The next use is blocked and clearly identified.</p></div>{!compact ? <span className="rounded-lg bg-amber-300/15 px-2.5 py-1 text-[10px] font-semibold text-amber-200">Active</span> : null}</div>
      </div>
    </div>
  );
}

function GateDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-100 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 font-mono text-xs font-semibold text-slate-900">{value}</p></div>;
}

function QrGraphic() {
  return (
    <div className="relative mx-auto mt-5 grid h-28 w-28 grid-cols-7 gap-1 bg-white p-2" aria-hidden="true">
      {Array.from({ length: 49 }, (_, index) => {
        const row = Math.floor(index / 7);
        const column = index % 7;
        const finder = (row < 3 && column < 3) || (row < 3 && column > 3) || (row > 3 && column < 3);
        const fill = finder || (index * 7 + row * 3 + column) % 5 < 2;
        return <span key={index} className={fill ? "bg-slate-950" : "bg-white"} />;
      })}
      <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg bg-blue-600 text-[10px] font-bold text-white">T</span>
    </div>
  );
}
