import { prisma } from '../config/prisma';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class CategoryService {
  static async createCategory(data: any) {
    // Check if slug is unique
    const existing = await prisma.productCategory.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      throw createError(400, 'Category with this slug already exists');
    }

    const category = await prisma.productCategory.create({
      data,
    });
    return category;
  }

  static async getAllCategories(page: number = 1, limit: number = 10, search?: string, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [categories, total] = await Promise.all([
      prisma.productCategory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productCategory.count({ where }),
    ]);

    return {
      categories,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getCategoryById(idOrSlug: string) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    
    const category = await prisma.productCategory.findUnique({
      where: isUUID ? { id: idOrSlug } : { slug: idOrSlug },
      include: { subcategories: true },
    });
    if (!category) {
      throw createError(404, 'Category not found');
    }
    return category;
  }

  static async getCategoryFilters(idOrSlug: string) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const category = await prisma.productCategory.findUnique({
      where: isUUID ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true }
    });

    if (!category) {
      throw createError(404, 'Category not found');
    }

    // Get all variants for products in this category to calculate counts
    const variants = await prisma.productVariant.findMany({
      where: { product: { categoryId: category.id } },
      select: { flavor: true, weight: true }
    });

    // Get all products to calculate preference and brand counts
    const products = await prisma.product.findMany({
      where: { categoryId: category.id },
      select: { preference: true, brand: { select: { name: true } } }
    });

    const getCounts = (items: any[], key: string) => {
      const counts: Record<string, number> = {};
      items.forEach(item => {
        const val = key.includes('.') ? item[key.split('.')[0]]?.[key.split('.')[1]] : item[key];
        if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      });
      return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    };

    const flavors = getCounts(variants, 'flavor');
    const weights = getCounts(variants, 'weight');
    const preferences = getCounts(products, 'preference');
    const brands = getCounts(products, 'brand.name');

    return { flavors, weights, preferences, brands };
  }

  static async updateCategory(id: string, data: any) {
    // Check if updating slug and it's unique
    if (data.slug) {
      const existing = await prisma.productCategory.findFirst({
        where: {
          slug: data.slug,
          id: { not: id },
        },
      });
      if (existing) {
        throw createError(400, 'Category with this slug already exists');
      }
    }

    try {
      const category = await prisma.productCategory.update({
        where: { id },
        data,
      });
      return category;
    } catch (error) {
      throw createError(404, 'Category not found');
    }
  }

  static async deleteCategory(id: string) {
    try {
      await prisma.productCategory.delete({
        where: { id },
      });
      return { message: 'Category deleted successfully' };
    } catch (error) {
      throw createError(404, 'Category not found');
    }
  }

  static async getCategoryKPIs() {
    const [totalCategories, activeCategories, inactiveCategories] = await Promise.all([
      prisma.productCategory.count(),
      prisma.productCategory.count({ where: { status: 'ACTIVE' } }),
      prisma.productCategory.count({ where: { status: 'INACTIVE' } }),
    ]);

    return {
      totalCategories,
      activeCategories,
      inactiveCategories,
    };
  }

  static async exportCategories() {
    const categories = await prisma.productCategory.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const fields = ['ID', 'Name', 'Slug', 'Description', 'Status', 'Created At'];
    const csvRows = [fields.join(',')];

    for (const cat of categories) {
      const row = [
        cat.id,
        `"${cat.name.replace(/"/g, '""')}"`,
        cat.slug,
        `"${(cat.description || '').replace(/"/g, '""')}"`,
        cat.status,
        cat.createdAt.toISOString()
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}
