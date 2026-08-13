import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Free shipping threshold
  await prisma.storeSetting.upsert({
    where: { key: 'FREE_SHIPPING_THRESHOLD' },
    update: { value: '2000' },
    create: {
      key: 'FREE_SHIPPING_THRESHOLD',
      value: '2000',
      description: 'Minimum cart subtotal to qualify for free shipping',
    },
  });

  console.log('Seeded Store Settings');

  const rules = [
    {
      name: 'Delhi/HR/PB/HP',
      states: ['Delhi', 'Haryana', 'Punjab', 'Himachal Pradesh'],
      charge: 75,
      isDefault: false,
    },
    {
      name: 'UP/UK/RJ',
      states: ['Uttar Pradesh', 'Uttarakhand', 'Rajasthan'],
      charge: 85,
      isDefault: false,
    },
    {
      name: 'Metro Cities',
      states: ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'West Bengal', 'Telangana', 'Gujarat'],
      charge: 115,
      isDefault: false,
    },
    {
      name: 'North East',
      states: ['Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'],
      charge: 150,
      isDefault: false,
    },
    {
      name: 'Rest of India',
      states: [],
      charge: 130,
      isDefault: true,
    }
  ];

  for (const rule of rules) {
    await prisma.shippingRule.upsert({
      where: { name: rule.name },
      update: { states: rule.states, charge: rule.charge, isDefault: rule.isDefault },
      create: { name: rule.name, states: rule.states, charge: rule.charge, isDefault: rule.isDefault },
    });
  }

  console.log('Seeded Shipping Rules');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
