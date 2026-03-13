import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout-form";

export const metadata: Metadata = {
  title: "Checkout | PostForge AI",
  description:
    "Choose a PostForge AI plan and continue to checkout for your social media content generator subscription.",
};

export default function CheckoutPage() {
  return (
    <main className="editorial-page text-foreground">
      <div className="editorial-container space-y-6">
        <header className="editorial-panel rounded-4xl p-6 sm:p-8">
          <div className="max-w-3xl">
            <div className="editorial-kicker">Checkout</div>
            <h1 className="editorial-title mt-5 text-5xl tracking-tight sm:text-6xl">
              Start your PostForge AI subscription
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 editorial-muted">
              Select a plan, confirm your details, and continue to the payment step.
            </p>
          </div>
        </header>

        <section className="mt-10">
          <Suspense>
            <CheckoutForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
