export type DashboardNavItem = {
  href: string;
  label: string;
  description: string;
};

export const dashboardNavItems: DashboardNavItem[] = [
  { href: "/dashboard", label: "Overview", description: "Performance at a glance" },
  { href: "/dashboard/analytics", label: "Analytics", description: "Growth, reach, and engagement" },
  { href: "/dashboard/campaigns", label: "Campaigns", description: "Active launches and offers" },
  { href: "/dashboard/calendar", label: "Calendar", description: "Weekly publishing rhythm" },
  { href: "/dashboard/content-lab", label: "Content Lab", description: "Generate and iterate copy" },
  { href: "/dashboard/ideas", label: "🧠 Ideas Engine", description: "AI-generated viral content ideas" },
  { href: "/dashboard/plan", label: "📅 30-Day Plan", description: "Full month content calendar" },
  { href: "/dashboard/virality", label: "🔮 Virality Predictor", description: "Will your post go viral?" },
  { href: "/dashboard/notes", label: "📝 Notes", description: "Capture ideas and drafts" },
  { href: "/dashboard/settings", label: "Settings", description: "Brand profile and preferences" },
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
