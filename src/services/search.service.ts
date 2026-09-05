import { prisma } from '../config/prisma';

export class SearchService {
  static async globalSearch(query: string, limit: number = 5) {
    const q = (query || '').trim();
    if (!q) {
      return {
        products: [],
        orders: [],
        brands: [],
        categories: [],
        users: [],
      };
    }

    const [products, orders, brands, categories, users] = await Promise.all([
      // 1. Products
      prisma.product.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          sku: true,
          unitPrice: true,
          discountPercentage: true,
          stock: true,
          images: true,
          status: true,
          brand: {
            select: { name: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // 2. Orders
      prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
            { shippingName: { contains: q, mode: 'insensitive' } },
            { shippingPhone: { contains: q, mode: 'insensitive' } },
            {
              userProfile: {
                user: {
                  OR: [
                    { email: { contains: q, mode: 'insensitive' } },
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        },
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          shippingName: true,
          createdAt: true,
          userProfile: {
            select: {
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 3. Brands
      prisma.productBrand.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          status: true,
        },
        orderBy: { name: 'asc' },
      }),

      // 4. Categories
      prisma.productCategory.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          status: true,
        },
        orderBy: { name: 'asc' },
      }),

      // 5. Users
      prisma.user.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          status: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      products,
      orders,
      brands,
      categories,
      users,
    };
  }
}

