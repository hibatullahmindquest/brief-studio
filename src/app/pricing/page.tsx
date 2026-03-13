import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing | PostForge AI",
  description:
    "Choose a PostForge AI plan to generate social posts, captions, ad copy, and marketing content at startup speed.",
};

const plans = [
  {
    slug: "starter",
    name: "Starter",
    price: "£19",
    description: "For solo creators and early-stage brands.",
    features: ["100 AI posts per month", "Captions", "Hashtags"],
    highlighted: false,
  },
  {
    slug: "pro",
    name: "Pro",
    price: "£39",
    description: "For teams focused on consistent growth.",
    features: ["500 AI posts", "Ads + captions", "Brand voice"],
    highlighted: true,
  },
  {
    slug: "business",
    name: "Business",
    price: "£79",
    description: "For agencies and fast-moving brands.",
    features: ["Unlimited posts", "Priority AI", "Team access"],
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <main className="editorial-page text-foreground">
      <div className="editorial-container space-y-6">
        <header className="editorial-panel rounded-4xl p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="editorial-kicker">Pricing</div>
              <h1 className="editorial-title mt-5 text-5xl tracking-tight sm:text-6xl">
                Pricing designed to reach your first $2k MRR fast
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 editorial-muted">
                Position the Pro plan as the sweet spot: 50 customers at $39 per month
                puts PostForge AI within reach of $1,950 in recurring revenue.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 px-5 py-4 text-sm leading-7 editorial-muted">
              <p className="font-semibold">Revenue target</p>
              <p>50 users × $39 Pro plan = $1,950/month</p>
            </div>
          </div>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-4xl border p-7 transition hover:-translate-y-1 ${
                plan.highlighted
                  ? "border-[rgba(212,183,143,0.35)] bg-[rgba(255,255,255,0.04)]"
                  : "editorial-panel"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="editorial-title text-3xl">{plan.name}</h2>
                  <p className="mt-2 text-sm editorial-muted">{plan.description}</p>
                </div>
                {plan.highlighted ? (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-(--accent)">
                    Most Popular
                  </span>
                ) : null}
              </div>

              <div className="mt-8 flex items-end gap-2">
                <span className="font-serif text-6xl">{plan.price}</span>
                <span className="pb-1 editorial-muted">/month</span>
              </div>

              <ul className="mt-8 space-y-3 text-sm editorial-muted">
                {plan.features.map((feature) => (
                  <li key={feature} className="rounded-2xl border border-white/10 px-4 py-3">
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={`/checkout?plan=${plan.slug}`}
                className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition ${
                  plan.highlighted
                    ? "bg-foreground text-background hover:opacity-90"
                    : "border border-white/10 hover:bg-white/5"
                }`}
              >
                Buy {plan.name}
              </Link>
            </article>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="editorial-panel rounded-4xl p-7">
            <h3 className="editorial-title text-4xl">Why the Pro plan wins</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                "Enough volume for active brands",
                "Includes ads + captions for conversion",
                "Brand voice keeps output consistent",
                "Simple price point for low-friction upgrades",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 px-4 py-4 text-sm editorial-muted"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="editorial-panel rounded-4xl p-7">
            <h3 className="editorial-title text-4xl">Built for recurring revenue</h3>
            <p className="mt-4 text-sm leading-7 editorial-muted">
              PostForge AI is priced for low-friction trials, clear value expansion, and a
              natural upgrade path from creators to teams.
            </p>
            <div className="mt-6 space-y-3 text-sm editorial-muted">
              <div className="rounded-2xl border border-white/10 px-4 py-3">
                Starter captures price-sensitive creators.
              </div>
              <div className="rounded-2xl border border-white/10 px-4 py-3">
                Pro anchors the funnel with the best value.
              </div>
              <div className="rounded-2xl border border-white/10 px-4 py-3">
                Business monetizes agencies and collaborative teams.
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
