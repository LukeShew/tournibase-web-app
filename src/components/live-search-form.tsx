"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter } from "next/navigation";

export function LiveSearchForm({
  defaultValue = "",
  inputClassName,
  inputId,
  placeholder,
}: {
  defaultValue?: string;
  inputClassName: string;
  inputId: string;
  placeholder: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useCallback(
    (searchQuery: string) => {
      const params = new URLSearchParams(window.location.search);
      const normalizedQuery = searchQuery.trim();

      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      } else {
        params.delete("q");
      }

      const destination = params.size > 0 ? `${pathname}?${params}` : pathname;

      startTransition(() => {
        router.replace(destination, { scroll: false });
      });
    },
    [pathname, router],
  );

  useEffect(() => {
    const currentQuery =
      new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
    const normalizedQuery = query.trim();

    if (normalizedQuery === currentQuery) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      navigate(query);
    }, 250);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [navigate, query]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    navigate(query);
  }

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
      onSubmit={submitSearch}
      role="search"
    >
      <label className="sr-only" htmlFor={inputId}>
        {placeholder}
      </label>
      <input
        id={inputId}
        name="q"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-brand-strong px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
      >
        {isPending ? "Filtering…" : "Search"}
      </button>
      {query ? (
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-border bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-card-strong hover:text-slate-950"
          onClick={() => {
            setQuery("");
            navigate("");
          }}
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}
