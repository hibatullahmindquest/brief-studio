"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type PlanKey = "starter" | "pro" | "business";

type Plan = {
  name: string;
  price: string;
  billing: string;
  description: string;
  features: string[];
};

const plans: Record<PlanKey, Plan> = {
  starter: {
    name: "Starter",
    price: "£19",
    billing: "/month",
    description: "For solo creators and early-stage brands.",
    features: ["100 AI posts per month", "Captions", "Hashtags"],
  },
  pro: {
    name: "Pro",
    price: "£39",
    billing: "/month",
    description: "For teams focused on consistent growth.",
    features: ["500 AI posts", "Ads + captions", "Brand voice"],
  },
  business: {
    name: "Business",
    price: "£79",
    billing: "/month",
    description: "For agencies and fast-moving brands.",
    features: ["Unlimited posts", "Priority AI", "Team access"],
  },
};

function getPlanKey(value: string | null): PlanKey {
  if (value === "starter" || value === "pro" || value === "business") {
    return value;
  }

  return "pro";
}

export function CheckoutForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const activePlanKey = getPlanKey(searchParams.get("plan"));
  const activePlan = useMemo(() => plans[activePlanKey], [activePlanKey]);

  const handleCheckout = () => {
    setIsSubmitting(true);
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: activePlanKey }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          setCheckoutMessage("Unable to start checkout.");
        }
      })
      .catch((e) => {
        console.error(e);
        setCheckoutMessage("Checkout request failed");
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="editorial-panel rounded-4xl p-6 sm:p-8">
        <div className="editorial-kicker">Buyer details</div>
        <h2 className="editorial-title mt-5 text-4xl">Complete your PostForge AI upgrade</h2>
        <p className="mt-4 text-base leading-8 editorial-muted">
          You now have a proper checkout step. This version collects the selected plan and buyer details, then confirms the purchase flow instead of leaving the button feeling dead.
        </p>

        <div className="mt-8 space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Work email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-(--accent)"
              placeholder="founder@brand.com"
              type="email"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium">Brand or company name</span>
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-(--accent)"
              placeholder="PostForge AI"
            />
          </label>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Preparing checkout..." : `Continue with ${activePlan.name}`}
          </button>

          {checkoutMessage ? (
            <div className="rounded-2xl border border-white/10 px-4 py-4 text-sm leading-7 editorial-muted">
              {checkoutMessage}
            </div>
          ) : null}
        </div>
      </div>

      <div className="editorial-panel rounded-4xl p-6 sm:p-8">
        <p className="editorial-kicker">Order summary</p>
        <h3 className="editorial-title mt-3 text-4xl">{activePlan.name}</h3>
        <p className="mt-3 text-sm leading-7 editorial-muted">{activePlan.description}</p>

        <div className="mt-6 flex items-end gap-2">
          <span className="font-serif text-6xl">{activePlan.price}</span>
          <span className="pb-1 editorial-muted">{activePlan.billing}</span>
        </div>

        <div className="mt-6 space-y-3 text-sm editorial-muted">
          {activePlan.features.map((feature) => (
            <div
              key={feature}
              className="rounded-2xl border border-white/10 px-4 py-3"
            >
              {feature}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 px-4 py-4 text-sm leading-7 editorial-muted">
          Stripe is not connected yet, so this screen currently confirms the selected plan and shows the next real integration step instead of failing silently.
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className="editorial-button editorial-button-secondary">
            Back to pricing
          </Link>
          <Link href="/dashboard" className="editorial-button editorial-button-secondary">
            Try dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
