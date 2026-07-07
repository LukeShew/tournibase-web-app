import { Brand } from "@/components/brand";

export function LegalPageShell({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="app-grid min-h-screen bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5 sm:px-6 lg:px-8">
          <Brand />
        </div>
      </header>

      <article className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-blue-300">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-white">
          {title}
        </h1>
        <div className="mt-8 space-y-8 rounded-3xl border border-border bg-card/90 p-6 leading-7 text-slate-300 sm:p-8">
          {children}
        </div>
      </article>
    </main>
  );
}

export function LegalSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-white">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-7 text-slate-400">
        {children}
      </div>
    </section>
  );
}
