/* eslint-disable @typescript-eslint/no-require-imports */

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.stats.findMany().then(r => {
  console.log(JSON.stringify(r, null, 2));
  p.$disconnect();
});
