import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community",
  description: "Join the PostForge AI community, pick issues, and start contributing.",
};

const links = [
  {
    title: "Live demo",
    href: "https://postforge-ai.vercel.app",
    description: "Try the product and share feedback from real usage.",
  },
  {
    title: "GitHub repository",
    href: "https://github.com/mouadhhhallem/postforge-ai",
    description: "Star, fork, and explore the codebase.",
  },
  {
    title: "Good first issues",
    href: "https://github.com/mouadhhhallem/postforge-ai/labels/good%20first%20issue",
    description: "Beginner-friendly tasks for fast onboarding.",
  },
  {
    title: "Discussions",
    href: "https://github.com/mouadhhhallem/postforge-ai/discussions",
    description: "Share ideas, showcase outputs, and ask implementation questions.",
  },
  {
    title: "Open in Codespaces",
    href: "https://codespaces.new/mouadhhhallem/postforge-ai",
    description: "Spin up the project in one click from the browser.",
  },
  {
    title: "First public release",
    href: "https://github.com/mouadhhhallem/postforge-ai/releases/tag/v0.1.0",
    description: "See release notes and project milestones.",
  },
];

export default function CommunityPage() {
  return (
    <main className="editorial-page text-foreground">
      <div className="editorial-container space-y-8">
        <section className="editorial-panel rounded-4xl p-6 sm:p-8">
          <p className="editorial-kicker">Community</p>
          <h1 className="editorial-title mt-3 text-5xl sm:text-6xl">Build with PostForge AI</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 editorial-muted">
            Join the sprint, pick an issue, push a PR, and help shape the future of AI-powered social
            content tooling. The goal is simple: ship useful features fast and openly.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="https://github.com/mouadhhhallem/postforge-ai" className="editorial-button editorial-button-primary">
              Star on GitHub
            </a>
            <a
              href="https://github.com/mouadhhhallem/postforge-ai/issues"
              className="editorial-button editorial-button-secondary"
            >
              Pick an issue
            </a>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {links.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="editorial-panel rounded-3xl p-5 transition hover:border-white/30 hover:bg-[rgba(255,255,255,0.04)]"
            >
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-7 editorial-muted">{item.description}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] editorial-muted">Open link</p>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}
