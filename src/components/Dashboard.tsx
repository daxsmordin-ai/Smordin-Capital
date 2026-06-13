"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface ArticleDTO {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  sourceName: string;
  author: string | null;
  publishedAt: string;
  fetchedAt: string;
  region: string | null;
  sector: string | null;
  keywords: string[];
  relevanceScore: number;
  imageUrl: string | null;
}

interface RunDTO {
  startedAt: string;
  finishedAt: string | null;
  articlesFetched: number;
  articlesNew: number;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  errors: string | null;
}

interface SourceStat {
  name: string;
  type: string;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
}

export interface DashboardInitial {
  items: ArticleDTO[];
  total: number;
  facets: { sectors: string[]; regions: string[]; sources: string[] };
  lastRun: RunDTO | null;
  sourceStats: SourceStat[];
}

interface ApiResponse {
  items: ArticleDTO[];
  total: number;
  facets: { sectors: string[]; regions: string[]; sources: string[] };
}

const SORTS = [
  { id: "recent", label: "Most recent" },
  { id: "relevance", label: "Most relevant" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function freshnessTone(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3.6e6;
  if (hours < 6) return "bg-emerald-100 text-emerald-700";
  if (hours < 48) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default function Dashboard({ initial }: { initial: DashboardInitial }) {
  const [items, setItems] = useState<ArticleDTO[]>(initial.items);
  const [total, setTotal] = useState<number>(initial.total);
  const [facets, setFacets] = useState(initial.facets);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [sourceName, setSourceName] = useState<string>("all");
  const [sort, setSort] = useState<SortId>("recent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastRunLabel = useMemo(() => {
    if (!initial.lastRun) return "No ingest yet";
    const finished = initial.lastRun.finishedAt ?? initial.lastRun.startedAt;
    return `Last ingest ${relativeTime(finished)} · +${initial.lastRun.articlesNew} new`;
  }, [initial.lastRun]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchArticles();
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sector, region, sourceName, sort]);

  async function fetchArticles() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (sector !== "all") params.set("sector", sector);
      if (region !== "all") params.set("region", region);
      if (sourceName !== "all") params.set("source", sourceName);
      params.set("sort", sort);
      params.set("limit", "75");
      const res = await fetch(`/api/articles?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      setItems(data.items);
      setTotal(data.total);
      setFacets(data.facets);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function triggerIngest() {
    setRunning(true);
    setRunMessage(null);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `API ${res.status}`);
      setRunMessage(
        `Ingested ${data.articlesFetched} (${data.articlesNew} new) from ${data.sourcesSucceeded}/${data.sourcesAttempted} sources.`,
      );
      await fetchArticles();
    } catch (err) {
      setRunMessage(`Ingest failed: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Project Finance · News Aggregator
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Deal flow, infra & energy transition headlines.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Pulls from curated RSS, the open GDELT index, and optional API providers. Articles
            are de-duped, classified, and scored for relevance to project finance work.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <button
            onClick={triggerIngest}
            disabled={running}
            className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? "Ingesting…" : "Run ingest"}
          </button>
          <span className="text-xs text-ink-muted">{lastRunLabel}</span>
          {runMessage && <span className="text-xs text-ink-muted">{runMessage}</span>}
        </div>
      </header>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card md:grid-cols-[1fr_repeat(4,minmax(0,160px))]">
        <input
          type="search"
          placeholder="Search title, summary, or keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:bg-white"
        />
        <FacetSelect
          label="Sector"
          value={sector}
          onChange={setSector}
          options={facets.sectors}
        />
        <FacetSelect
          label="Region"
          value={region}
          onChange={setRegion}
          options={facets.regions}
        />
        <FacetSelect
          label="Source"
          value={sourceName}
          onChange={setSourceName}
          options={facets.sources}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortId)}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:bg-white"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </section>

      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>
          {loading ? "Loading…" : `${total.toLocaleString()} article${total === 1 ? "" : "s"}`}
        </span>
        {error && <span className="text-rose-600">Error: {error}</span>}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.length === 0 && !loading ? (
          <EmptyState />
        ) : (
          items.map((a) => <ArticleCard key={a.id} article={a} />)
        )}
      </section>

      <SourceStatus stats={initial.sourceStats} />
    </div>
  );
}

function FacetSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:bg-white"
      aria-label={label}
    >
      <option value="all">All {label.toLowerCase()}s</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ArticleCard({ article }: { article: ArticleDTO }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer noopener"
      className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${freshnessTone(article.publishedAt)}`}>
          {relativeTime(article.publishedAt)}
        </span>
        {article.sector && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            {article.sector}
          </span>
        )}
        {article.region && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            {article.region}
          </span>
        )}
        {article.relevanceScore > 0 && (
          <span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">
            relevance {article.relevanceScore.toFixed(0)}
          </span>
        )}
      </div>
      <h2 className="line-clamp-3 text-base font-semibold leading-snug text-ink group-hover:text-accent">
        {article.title}
      </h2>
      {article.summary && (
        <p className="line-clamp-3 text-sm text-ink-muted">{article.summary}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        <span className="font-medium text-ink-soft">{article.sourceName}</span>
        {article.author && <span>· {article.author}</span>}
        {article.keywords.length > 0 && (
          <span className="ml-auto flex flex-wrap gap-1">
            {article.keywords.slice(0, 3).map((k) => (
              <span key={k} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                {k}
              </span>
            ))}
          </span>
        )}
      </div>
    </a>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      <h3 className="text-lg font-semibold text-ink">No articles yet</h3>
      <p className="max-w-md text-sm text-ink-muted">
        Click <span className="font-semibold">Run ingest</span> above, or run{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">npm run ingest</code> in your
        terminal to populate the database.
      </p>
    </div>
  );
}

function SourceStatus({ stats }: { stats: SourceStat[] }) {
  if (stats.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-ink-muted">
        Sources will be registered automatically on the first ingest run.
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <h3 className="mb-3 text-sm font-semibold text-ink">Source health</h3>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.name}
            className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50/60 p-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-ink-soft">{s.name}</span>
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">
                {s.type}
              </span>
            </div>
            <div className="flex items-center justify-between text-ink-muted">
              <span>
                {s.lastFetchedAt
                  ? `Last fetched ${relativeTime(s.lastFetchedAt)}`
                  : "Not yet fetched"}
              </span>
              {s.lastError ? (
                <span className="truncate text-rose-600" title={s.lastError}>
                  error
                </span>
              ) : (
                <span className="text-emerald-600">ok</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
