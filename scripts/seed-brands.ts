import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const brands = [
  {
    name: "SifuTutor",
    slug: "sifututor",
    tagline: "Trusted Home & Online Tutors Across Malaysia",
    tone: "professional, warm, encouraging",
    targetAudience:
      "Ibu bapa, pelajar PT3 (13-15), pelajar SPM (15-17), pelajar 3M, pelajar sekolah rendah",
    coreOffer: "Platform cari tutor 1-to-1 online + home tutor",
    keyMessages:
      "Tutor berpengalaman, belajar di mana-mana secara online atau di rumah, fleksibel, kelas 100% focus pada student, report card setiap 3 bulan",
    dontSay:
      "free trial, free class, nama brand competitor, confirm gred naik atau gred A, berjaya dalam masa singkat",
    primaryColor: "#0b1c73",
    secondaryColor: "#ef5122",
    instagramHandle: "sifututor",
    facebookHandle: "sifututor.my",
    tiktokHandle: "@sifututor",
    isActive: true,
  },
  {
    name: "NakNgaji",
    slug: "nakngaji",
    tagline: "Mengaji 1-to-1 Online Atau di Rumah",
    tone: "gentle, nurturing, warm, family-oriented, professional, credible",
    targetAudience:
      "Kanak-kanak (3-12), remaja (13-17), ibu bapa, dewasa semua peringkat",
    coreOffer: "Platform cari guru mengaji 1-to-1 online + home",
    keyMessages:
      "Guru bertauliah dan disaring, belajar dari rumah atau online, semua peringkat umur dan level mengaji dari kosong hingga advance, bukan setakat mengaji — fardu ain, tarannum, tadabbur, bahasa arab, hafazan",
    dontSay:
      "nama brand lain, sumber rujukan syiah, badan Islam yang tidak bertauliah di Malaysia",
    primaryColor: "#35be89",
    secondaryColor: "#ffffff",
    instagramHandle: "nakngaji.my",
    facebookHandle: "nakngaji.my",
    tiktokHandle: "@nakngaji.my",
    isActive: true,
  },
];

async function main() {
  console.log("Seeding brands...");

  for (const brand of brands) {
    const result = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: brand,
      create: brand,
    });
    console.log(`✓ ${result.name} (${result.id})`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
