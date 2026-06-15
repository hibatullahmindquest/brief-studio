export type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
  soon?: boolean; // module planned but not built yet — shown disabled
  admin?: boolean; // only rendered for admin users
};

export type DashboardNavGroup = {
  group: string;
  items: DashboardNavItem[];
};

// SCIS navigation — Workspace modules first, inherited tools grouped below.
// `soon` items are part of the SCIS vision but not yet built (shown disabled).
export const dashboardNav: DashboardNavGroup[] = [
  {
    group: "Workspace",
    items: [
      { href: "/dashboard", label: "Today", description: "Daily overview" },
      { href: "#", label: "Daily Signals", description: "What to make next", soon: true },
      { href: "#", label: "Organic", description: "FB / IG performance", soon: true },
      { href: "/dashboard/analytics/paid", label: "Paid", description: "Ad spend, CPL, fatigue" },
      { href: "#", label: "Research", description: "Sources & ideas", soon: true },
      { href: "#", label: "Library", description: "Saved outputs", soon: true },
      { href: "#", label: "Reports", description: "Daily / weekly / monthly", soon: true },
    ],
  },
  {
    group: "Create",
    items: [{ href: "/studio", label: "Studio", description: "AI brief wizard" }],
  },
  {
    group: "Admin",
    items: [
      { href: "/dashboard/settings", label: "Settings", description: "Brand & preferences" },
      { href: "/dashboard/settings/meta", label: "Meta Connections", description: "Connect accounts", admin: true },
    ],
  },
];

export const dashboardKPIs = [
  { label: "Leads This Week", value: "128", delta: "+22%" },
  { label: "Revenue Influenced", value: "£12.4k", delta: "+17%" },
  { label: "Avg. CTR", value: "4.9%", delta: "+0.8%" },
  { label: "Posts Published", value: "34", delta: "+11" },
];

export const topPerformers = [
  { name: "Streetwear Launch", handle: "@dropmode", uplift: "39%" },
  { name: "Gym Reboot Promo", handle: "@fitstack", uplift: "25%" },
  { name: "Skincare Bundle", handle: "@glowlab", uplift: "18%" },
  { name: "Coffee Creator Pack", handle: "@brewcraft", uplift: "11%" },
];

export const campaignRows = [
  {
    name: "Spring Product Drop",
    channel: "Instagram + TikTok",
    stage: "Scaling",
    budget: "£1,800",
    roi: "3.2x",
  },
  {
    name: "48h Flash Offer",
    channel: "Reels + Stories",
    stage: "Testing",
    budget: "£650",
    roi: "2.1x",
  },
  {
    name: "UGC Creator Push",
    channel: "Instagram",
    stage: "Live",
    budget: "£920",
    roi: "2.8x",
  },
];
