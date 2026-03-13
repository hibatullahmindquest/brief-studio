import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const serviceLines = [
    "Instagram posts",
    "Captions",
    "Ad copy",
    "Gym promotions",
    "Streetwear launches",
    "Hashtag packs",
  ];

  const principles = [
    "Businesses struggle to post consistently",
    "Writing captions takes time",
    "Ad copy requires marketing skills",
    "Hiring marketers is expensive",
  ];

  const examples = [
    "Instagram posts for new product drops",
    "Facebook ads with stronger hooks and CTAs",
    "TikTok captions that match brand tone",
    "Promotions for gyms, ecommerce, and agencies",
  ];

  const audience = [
    "Small businesses",
    "Gym owners",
    "Streetwear brands",
    "Creators",
    "Agencies",
    "Ecommerce stores",
  ];

  return (
    <main className="editorial-page text-foreground">
      <section className="hero-bg relative flex items-center justify-center h-screen overflow-hidden">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center px-6 max-w-3xl">
          <h1 className="huge-title editorial-title text-white">
            Create viral social media posts in seconds with AI
          </h1>
          <p className="mt-6 text-lg leading-8 editorial-muted">
            Generate Instagram posts, captions, ad copy, gym promotions, and
            streetwear brand content with a tone that feels intentional, polished,
            and ready to publish.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
            <Link href="/checkout?plan=pro" className="editorial-button editorial-button-primary">
              Start Free
            </Link>
            <Link href="/dashboard" className="editorial-button editorial-button-secondary">
              Generate Your First Post
            </Link>
          </div>
        </div>
      </section>
      <div className="editorial-container space-y-12">
        <section className="editorial-panel rounded-4xl p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="editorial-kicker">Website Preview</p>
            <a href="https://postforge-ai.vercel.app" className="text-xs editorial-muted hover:text-foreground">
              Open live site
            </a>
          </div>
          <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.02)]">
            <Image
              src="/images/preview.png"
              alt="PostForge AI website preview"
              width={1600}
              height={900}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        </section>

        <section className="mesh-card glow-ring editorial-panel rounded-4xl px-6 py-6 sm:px-8 sm:py-8">
          <nav className="flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="editorial-kicker">PostForge AI</p>
              <p className="mt-3 max-w-md text-sm editorial-muted">
                Editorial-grade AI content for brands that want presence, not noise.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm editorial-muted">
              <a href="#approach" className="hover:text-foreground">Approach</a>
              <a href="#offerings" className="hover:text-foreground">Offerings</a>
              <a href="#pricing" className="hover:text-foreground">Pricing</a>
              <Link href="/dashboard" className="editorial-button editorial-button-secondary">
                Enter Studio
              </Link>
            </div>
          </nav>

          <div className="grid gap-12 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="editorial-kicker">AI social media generator</p>
              <h1 className="editorial-title mt-6 max-w-5xl text-6xl leading-[0.94] sm:text-7xl lg:text-8xl">
                Create viral social media posts in seconds with AI
              </h1>
              <p className="mt-8 max-w-2xl text-lg leading-8 editorial-muted">
                Generate Instagram posts, captions, ad copy, gym promotions, and
                streetwear brand content with a tone that feels intentional, polished,
                and ready to publish.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/checkout?plan=pro" className="editorial-button editorial-button-primary">
                  Start Free
                </Link>
                <Link href="/dashboard" className="editorial-button editorial-button-secondary">
                  Generate Your First Post
                </Link>
              </div>
            </div>

            <div className="rounded-4xl border border-white/10 bg-[rgba(255,255,255,0.025)] p-6">
              <div className="flex items-center justify-between">
                <p className="editorial-kicker">Live Output</p>
                <span className="text-xs uppercase tracking-[0.24em] editorial-muted">Active Studio</span>
              </div>
              <div className="editorial-rule mt-5" />
              <div className="mt-6 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] editorial-muted">Input</p>
                  <p className="mt-3 text-base">Streetwear brand hoodie drop</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] editorial-muted">Output</p>
                  <div className="mt-3 space-y-3 text-sm leading-7 editorial-muted">
                    <p>New drop. Limited release. Built for the ones who move first.</p>
                    <p>Our latest hoodie just landed with sharper lines, cleaner weight, and real presence.</p>
                    <p>Wear the streets. Own the culture.</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {serviceLines.map((item) => (
                    <div key={item} className="rounded-3xl border border-white/10 px-3 py-4 text-center text-xs editorial-muted">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="approach" className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="editorial-panel rounded-4xl p-8">
            <p className="editorial-kicker">Why it matters</p>
            <h2 className="editorial-title mt-4 text-4xl sm:text-5xl">
              Creating social content every day drains time, taste, and momentum
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {principles.map((item) => (
              <div key={item} className="editorial-panel rounded-3xl p-6 text-sm leading-7 editorial-muted">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section id="offerings" className="editorial-panel rounded-4xl p-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="editorial-kicker">What the AI writes</p>
              <h2 className="editorial-title mt-4 text-4xl sm:text-5xl">
                Let AI create your content with a clearer point of view
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {examples.map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 px-5 py-5 text-sm leading-7 editorial-muted">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="editorial-rule my-8" />
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              "1 — Enter your brand or business type",
              "2 — Choose content type: post, caption, ad, or promo",
              "3 — AI generates viral-ready content instantly",
            ].map((step) => (
              <div key={step} className="rounded-3xl border border-white/10 px-5 py-6 text-sm leading-7 editorial-muted">
                {step}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="editorial-panel rounded-4xl p-8">
            <p className="editorial-kicker">For whom</p>
            <h2 className="editorial-title mt-4 text-4xl sm:text-5xl">
              Built for brands that need both volume and taste
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {audience.map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 px-4 py-4 text-sm editorial-muted">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div id="pricing" className="editorial-panel rounded-4xl p-8">
            <p className="editorial-kicker">Pricing</p>
            <h2 className="editorial-title mt-4 text-4xl sm:text-5xl">A small team can get there fast</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 editorial-muted">
              The funnel is built around the Pro plan: enough value to feel real, enough simplicity to convert.
            </p>
            <div className="mt-8 space-y-4">
              {[
                ["Starter", "£19", "100 posts, captions, hashtags"],
                ["Pro", "£39", "500 posts, ads, captions, brand voice"],
                ["Business", "£79", "Unlimited posts, priority AI, team access"],
              ].map(([name, price, detail]) => (
                <div key={name} className="flex flex-col gap-2 rounded-3xl border border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-medium">{name}</p>
                    <p className="text-sm editorial-muted">{detail}</p>
                  </div>
                  <p className="font-serif text-4xl">{price}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <Link href="/pricing" className="editorial-button editorial-button-secondary">View Pricing</Link>
              <Link href="/checkout?plan=pro" className="editorial-button editorial-button-primary">Start with Pro</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
