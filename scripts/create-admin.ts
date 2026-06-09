import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { isAdmin: true, teamRole: "admin" },
    });
    console.log(`✓ User ${email} already exists — updated to admin`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      username,
      isAdmin: true,
      teamRole: "admin",
    },
  });

  console.log(`✓ Admin created: ${user.email} (username: ${user.username})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
