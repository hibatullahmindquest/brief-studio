/* eslint-disable @typescript-eslint/no-require-imports */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.stats.updateMany({
  data: {
    onboardingDone: false,
    summary: null,
    instagramHandle: null,
    brandName: null,
    leadsThisWeek: 0,
    revenue: 0,
    avgCtr: 0,
    postsPublished: 0,
  }
}).then(r => {
  console.log('Reset done:', r);
  p.$disconnect();
});
