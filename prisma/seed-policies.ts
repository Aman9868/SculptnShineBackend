import { PrismaClient, PolicyType } from '@prisma/client';
import policiesData from './policies-data.json';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding policies...');

  for (const policy of policiesData) {
    await prisma.policy.upsert({
      where: { type: policy.type as PolicyType },
      update: {
        title: policy.title,
        content: policy.content,
      },
      create: {
        type: policy.type as PolicyType,
        title: policy.title,
        content: policy.content,
        isActive: true,
      },
    });
    console.log(`Upserted policy: ${policy.title}`);
  }

  console.log('Policies seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
