"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type IgResult = {
  followers: number | null;
  posts: number | null;
  bio: string | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  engagementRate?: number | null;
  hashtagsUsed?: string[];
  latestCaptions?: string[];
};

// mainGoal is now an array so the user can pick multiple goals
type QuizData = {
  brandName: string;
  instagramHandle: string;
  industry: string;
  industryOther: string; // filled when industry === "Other"
  monthlyRevenue: string;
  adSpend: string;
  teamSize: string;
  mainGoals: string[]; // multi-select
};

const INDUSTRIES = [
  "Fashion & Streetwear",
  "Fitness & Wellness",
  "Food & Beverage",
  "Beauty & Skincare",
  "Tech & SaaS",
  "E-commerce / D2C",
  "Music & Entertainment",
  "Real Estate",
  "Education & Coaching",
  "Other",
];

const TEAM_SIZES = [
  { value: "solo", label: "Solo (just me)" },
  { value: "2-5", label: "2 - 5 people" },
  { value: "6-20", label: "6 - 20 people" },
  { value: "20+", label: "20+ people" },
];

const GOALS = [
  { value: "grow_followers", label: "Grow my audience fast" },
  { value: "increase_sales", label: "Turn followers into buyers" },
  { value: "launch_product", label: "Launch a new product / collection" },
  { value: "build_brand", label: "Build long-term brand authority" },
];

const LOADING_STEPS = [
  "Saving your brand profile",
  "Fetching Instagram data",
  "Generating AI analytics summary",
  "Building your personalised dashboard",
];

// ── Live currency converter ──────────────────────────────────────────────────
type ExchangeRates = Record<string, number>;

const CONVERTER_CURRENCIES = [
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "AED", label: "UAE Dirham" },
  { code: "SAR", label: "Saudi Riyal" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "CNY", label: "Chinese Yuan" },
  { code: "INR", label: "Indian Rupee" },
  { code: "BRL", label: "Brazilian Real" },
];

function CurrencyConverter() {
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("EUR");
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((data) => {
        if (data?.rates) {
          setRates(data.rates as ExchangeRates);
          const d = new Date((data.time_last_update_utc as string) ?? Date.now());
          setLastUpdated(d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const numericAmount = parseFloat(amount);
  const usdEquivalent =
    rates && !isNaN(numericAmount) && numericAmount > 0 && rates[from]
      ? (numericAmount / rates[from]).toFixed(2)
      : null;

  return (
    <div className="rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)] p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs uppercase tracking-[0.18em] editorial-muted">Currency Converter to USD</p>
        {loading && <span className="text-xs editorial-muted animate-pulse">Fetching live rates...</span>}
        {lastUpdated && !loading && (
          <span className="text-xs editorial-muted">Rates updated {lastUpdated}</span>
        )}
      </div>
      <div className="flex gap-3 flex-wrap">
        <select
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-xl border border-white/10 bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm outline-none focus:border-(--accent)"
        >
          {CONVERTER_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} - {c.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          className="flex-1 min-w-30 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm outline-none focus:border-(--accent) placeholder:text-muted"
        />
      </div>
      {usdEquivalent !== null ? (
        <p className="text-sm">
          <span className="text-lg font-semibold text-foreground">$ {usdEquivalent}</span>
          <span className="ml-2 editorial-muted">USD</span>
        </p>
      ) : (
        <p className="text-xs editorial-muted">Select a currency and enter an amount to see the equivalent in USD.</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function BrandOnboarding() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [step, setStep] = useState<"quiz" | "loading" | "done">("quiz");
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [igResult, setIgResult] = useState<IgResult | null>(null);

  const [quiz, setQuiz] = useState<QuizData>({
    brandName: "",
    instagramHandle: "",
    industry: "",
    industryOther: "",
    monthlyRevenue: "",
    adSpend: "",
    teamSize: "",
    mainGoals: [],
  });

  function set<K extends keyof QuizData>(field: K, value: QuizData[K]) {
    setQuiz((q) => ({ ...q, [field]: value }));
  }

  function toggleGoal(value: string) {
    setQuiz((q) => {
      const exists = q.mainGoals.includes(value);
      return {
        ...q,
        mainGoals: exists ? q.mainGoals.filter((g) => g !== value) : [...q.mainGoals, value],
      };
    });
  }

  function resolvedIndustry() {
    return quiz.industry === "Other" ? (quiz.industryOther.trim() || "Other") : quiz.industry;
  }

  function validatePage(): string | null {
    if (page === 1) {
      if (!quiz.brandName.trim()) return "Please enter your brand name.";
    }
    if (page === 2) {
      if (!quiz.industry) return "Please select your industry.";
      if (quiz.industry === "Other" && !quiz.industryOther.trim())
        return "Please describe your industry.";
    }
    if (page === 3) {
      if (!quiz.monthlyRevenue.trim()) return "Please enter your monthly revenue (enter 0 if pre-revenue).";
      if (isNaN(Number(quiz.monthlyRevenue))) return "Monthly revenue must be a number.";
      if (!quiz.adSpend.trim()) return "Please enter your monthly ad spend (enter 0 if none).";
      if (isNaN(Number(quiz.adSpend))) return "Ad spend must be a number.";
    }
    if (page === 4) {
      if (!quiz.teamSize) return "Please select your team size.";
      if (quiz.mainGoals.length === 0) return "Please select at least one goal.";
    }
    return null;
  }

  function nextPage() {
    const err = validatePage();
    if (err) { setError(err); return; }
    setError(null);
    setPage((p) => p + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validatePage();
    if (err) { setError(err); return; }
    setError(null);
    setStep("loading");

    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < LOADING_STEPS.length) setLoadingStep(i);
      else clearInterval(interval);
    }, 900);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: quiz.brandName.trim(),
          instagramHandle: quiz.instagramHandle.trim(),
          industry: resolvedIndustry(),
          monthlyRevenue: parseFloat(quiz.monthlyRevenue) || 0,
          adSpend: parseFloat(quiz.adSpend) || 0,
          teamSize: quiz.teamSize,
          mainGoal: quiz.mainGoals, // array sent to API
        }),
      });
      clearInterval(interval);
      const data = await res.json() as { error?: string; ig?: IgResult };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStep("quiz");
        return;
      }
      if (data.ig) setIgResult(data.ig);
      setStep("done");
      setTimeout(() => router.refresh(), 2000);
    } catch {
      clearInterval(interval);
      setError("Network error. Please try again.");
      setStep("quiz");
    }
  }

  // ── Done screen ────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="editorial-panel rounded-4xl p-8 sm:p-10">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400 text-2xl">
            checkmark
          </div>
          <div>
            <h2 className="editorial-title text-3xl">Brand profile saved</h2>
            <p className="mt-1 text-sm editorial-muted">Loading your analytics overview...</p>
          </div>
        </div>
        {igResult && (igResult.followers != null || igResult.posts != null || igResult.bio) && (
          <div className="mt-4 rounded-3xl border border-white/10 p-5 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] editorial-muted">Extracted from Instagram via Apify</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {igResult.followers != null && (
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="text-xs editorial-muted">Followers</p>
                  <p className="mt-1 text-2xl font-semibold">{igResult.followers.toLocaleString()}</p>
                </div>
              )}
              {igResult.posts != null && (
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="text-xs editorial-muted">Posts</p>
                  <p className="mt-1 text-2xl font-semibold">{igResult.posts.toLocaleString()}</p>
                </div>
              )}
              {igResult.avgLikes != null && (
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="text-xs editorial-muted">Avg Likes</p>
                  <p className="mt-1 text-2xl font-semibold">{igResult.avgLikes.toLocaleString()}</p>
                </div>
              )}
              {igResult.engagementRate != null && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <p className="text-xs editorial-muted">Engagement Rate</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-400">{igResult.engagementRate}%</p>
                </div>
              )}
            </div>
            {igResult.bio && (
              <div className="rounded-2xl border border-white/10 p-4">
                <p className="text-xs editorial-muted">Bio</p>
                <p className="mt-1 text-sm leading-6">{igResult.bio}</p>
              </div>
            )}
            {igResult.hashtagsUsed && igResult.hashtagsUsed.length > 0 && (
              <div className="rounded-2xl border border-white/10 p-4">
                <p className="text-xs editorial-muted mb-2">Top Hashtags Used</p>
                <div className="flex flex-wrap gap-2">
                  {igResult.hashtagsUsed.slice(0, 10).map((h) => (
                    <span key={h} className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-xs editorial-muted">#{h}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="editorial-panel rounded-4xl p-8 text-center space-y-6">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        <h2 className="editorial-title text-3xl">Building your dashboard...</h2>
        <div className="mx-auto max-w-sm space-y-3 text-sm editorial-muted text-left">
          {LOADING_STEPS.map((msg, idx) => (
            <div
              key={msg}
              className={"flex items-center gap-3 transition-opacity duration-500 " + (idx <= loadingStep ? "opacity-100" : "opacity-25")}
            >
              <span className={idx <= loadingStep ? "text-emerald-400" : ""}>{idx <= loadingStep ? "check" : "circle"}</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Quiz pages ─────────────────────────────────────────────────────────────
  return (
    <div className="editorial-panel rounded-4xl p-6 sm:p-10">
      {/* Progress bar */}
      <div className="mb-2 flex items-center justify-between">
        <p className="editorial-kicker">Brand Setup -- Step {page} of 4</p>
        <span className="text-xs editorial-muted">{Math.round(((page - 1) / 4) * 100)}% complete</span>
      </div>
      <div className="mb-8 h-1 w-full rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[rgba(212,183,143,0.95)] transition-all duration-500"
          style={{ width: ((page - 1) / 4 * 100) + "%" }}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* PAGE 1 -- Brand identity */}
        {page === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="editorial-title text-4xl sm:text-5xl">What is your brand?</h2>
              <p className="mt-3 text-sm leading-7 editorial-muted">
                We use this to personalise your entire dashboard, analytics, and AI-generated content.
              </p>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Brand name <span className="text-red-400">*</span></span>
              <input
                value={quiz.brandName}
                onChange={(e) => set("brandName", e.target.value)}
                placeholder="e.g. Void Apparel, FitCore, Nova Studio"
                className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-(--accent)"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                Instagram handle{" "}
                <span className="editorial-muted text-xs font-normal">(optional — we scrape your followers, engagement &amp; hashtags via Apify)</span>
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm editorial-muted">@</span>
                <input
                  value={quiz.instagramHandle}
                  onChange={(e) => set("instagramHandle", e.target.value.replace(/^@/, "").replace(/\s/g, ""))}
                  placeholder="yourbrand"
                  className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] py-3 pl-8 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-(--accent)"
                />
              </div>
              <p className="text-xs editorial-muted">
                Powered by <strong className="text-foreground">Apify instagram-scraper</strong> — pulls followers, avg likes, engagement rate, top hashtags &amp; bio.
              </p>
            </label>
          </div>
        )}

        {/* PAGE 2 -- Industry */}
        {page === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="editorial-title text-4xl sm:text-5xl">What industry are you in?</h2>
              <p className="mt-3 text-sm leading-7 editorial-muted">
                This shapes your content strategy, benchmark comparisons, and campaign suggestions.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind}
                  type="button"
                  onClick={() => {
                    set("industry", ind);
                    if (ind !== "Other") set("industryOther", "");
                  }}
                  className={"rounded-2xl border px-4 py-3 text-left text-sm font-medium transition " +
                    (quiz.industry === ind
                      ? "border-(--accent) bg-[rgba(212,183,143,0.12)] text-foreground"
                      : "border-white/10 bg-[rgba(255,255,255,0.02)] editorial-muted hover:border-white/20")}
                >
                  {ind}
                </button>
              ))}
            </div>
            {/* Text input shown only when "Other" is selected */}
            {quiz.industry === "Other" && (
              <label className="block space-y-2">
                <span className="text-sm font-medium">
                  Describe your industry <span className="text-red-400">*</span>
                </span>
                <input
                  autoFocus
                  value={quiz.industryOther}
                  onChange={(e) => set("industryOther", e.target.value)}
                  placeholder="e.g. Pet accessories, NFT / Web3, Legal services..."
                  className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-(--accent)"
                />
              </label>
            )}
          </div>
        )}

        {/* PAGE 3 -- Numbers (USD) + live converter */}
        {page === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="editorial-title text-4xl sm:text-5xl">Tell us your numbers</h2>
              <p className="mt-3 text-sm leading-7 editorial-muted">
                This is how we give you accurate stats -- not made-up numbers. Enter 0 if you are pre-revenue or not running ads yet. All amounts in <strong>US dollars ($)</strong>.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium">
                Monthly revenue <span className="text-red-400">*</span>{" "}
                <span className="editorial-muted text-xs font-normal">(USD)</span>
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold">$</span>
                <input
                  type="number"
                  min="0"
                  value={quiz.monthlyRevenue}
                  onChange={(e) => set("monthlyRevenue", e.target.value)}
                  placeholder="0"
                  className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] py-3 pl-9 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-(--accent)"
                />
              </div>
              <p className="text-xs editorial-muted">Your current average monthly revenue from sales</p>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium">
                Monthly ad spend <span className="text-red-400">*</span>{" "}
                <span className="editorial-muted text-xs font-normal">(USD)</span>
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold">$</span>
                <input
                  type="number"
                  min="0"
                  value={quiz.adSpend}
                  onChange={(e) => set("adSpend", e.target.value)}
                  placeholder="0"
                  className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] py-3 pl-9 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-(--accent)"
                />
              </div>
              <p className="text-xs editorial-muted">How much you spend on paid ads per month</p>
            </label>

            {/* Live currency converter card */}
            <CurrencyConverter />
          </div>
        )}

        {/* PAGE 4 -- Team + goals (multi-select) */}
        {page === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="editorial-title text-4xl sm:text-5xl">Almost done</h2>
              <p className="mt-3 text-sm leading-7 editorial-muted">Two quick answers and we will build your dashboard.</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Team size <span className="text-red-400">*</span></p>
              <div className="grid gap-3 sm:grid-cols-2">
                {TEAM_SIZES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("teamSize", value)}
                    className={"rounded-2xl border px-4 py-3 text-left text-sm font-medium transition " +
                      (quiz.teamSize === value
                        ? "border-(--accent) bg-[rgba(212,183,143,0.12)] text-foreground"
                        : "border-white/10 bg-[rgba(255,255,255,0.02)] editorial-muted hover:border-white/20")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">
                Main goal right now <span className="text-red-400">*</span>{" "}
                <span className="text-xs font-normal editorial-muted">(pick one or more)</span>
              </p>
              <div className="grid gap-3">
                {GOALS.map(({ value, label }) => {
                  const selected = quiz.mainGoals.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleGoal(value)}
                      className={"rounded-2xl border px-4 py-3 text-left text-sm font-medium transition flex items-center gap-3 " +
                        (selected
                          ? "border-(--accent) bg-[rgba(212,183,143,0.12)] text-foreground"
                          : "border-white/10 bg-[rgba(255,255,255,0.02)] editorial-muted hover:border-white/20")}
                    >
                      {/* Checkbox indicator */}
                      <span className={"flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs transition " +
                        (selected ? "border-(--accent) bg-[rgba(212,183,143,0.35)] text-foreground" : "border-white/20")}
                      >
                        {selected ? "check" : ""}
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            Warning: {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          {page > 1 && (
            <button
              type="button"
              onClick={() => { setError(null); setPage((p) => p - 1); }}
              className="rounded-full border border-white/10 px-5 py-3 text-sm editorial-muted transition hover:border-white/20"
            >
              Back
            </button>
          )}
          {page < 4 ? (
            <button
              type="button"
              onClick={nextPage}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
            >
              Generate my analytics dashboard
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
