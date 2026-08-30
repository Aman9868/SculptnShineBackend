const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const banners = await prisma.banner.findMany({ where: { type: 'CATEGORY_HEADER' } });
  console.log(JSON.stringify(banners, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
