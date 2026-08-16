import { prisma } from '../config/prisma';
import { cacheService, CACHE_TTL, CACHE_PATTERNS } from './cache.service';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class SubcategoryService {
  private static async invalidateSubcategoryCache() {
    await cacheService.invalidatePatterns([
      CACHE_PATTERNS.SUBCATEGORIES,
      CACHE_PATTERNS.CATEGORIES,
      CACHE_PATTERNS.PRODUCTS,
    ]);
  }

  static async getAllSubcategories(categoryId?: string, page = 1, limit = 10, search?: string) {
    const cacheKey = `subcategories:list:${categoryId || 'all'}:${page}:${limit}:${search || 'all'}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.LONG, async () => {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [subcategories, total] = await Promise.all([
        prisma.productSubcategory.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            category: {
              select: { name: true, slug: true }
            }
          }
        }),
        prisma.productSubcategory.count({ where }),
      ]);

      return {
        subcategories,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  static async getSubcategoryById(id: string) {
    const cacheKey = `subcategories:id:${id}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.LONG, async () => {
      const subcategory = await prisma.productSubcategory.findUnique({
        where: { id },
        include: {
          category: {
            select: { name: true, slug: true }
          }
        }
      });

      if (!subcategory) {
        throw createError(404, 'Subcategory not found');
      }

      return subcategory;
    });
  }

  static async createSubcategory(data: any) {
    // Check if slug is unique
    if (data.slug) {
      const existing = await prisma.productSubcategory.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        throw createError(400, 'Subcategory with this slug already exists');
      }
    }

    const subcategory = await prisma.productSubcategory.create({
      data,
    });

    await this.invalidateSubcategoryCache();
    return subcategory;
  }

  static async updateSubcategory(id: string, data: any) {
    // Check if updating slug and it's unique
    if (data.slug) {
      const existing = await prisma.productSubcategory.findFirst({
        where: {
          slug: data.slug,
          id: { not: id },
        },
      });
      if (existing) {
        throw createError(400, 'Subcategory with this slug already exists');
      }
    }

    try {
      const subcategory = await prisma.productSubcategory.update({
        where: { id },
        data,
      });

      await this.invalidateSubcategoryCache();
      return subcategory;
    } catch (error) {
      throw createError(404, 'Subcategory not found');
    }
  }

  static async deleteSubcategory(id: string) {
    try {
      await prisma.productSubcategory.delete({
        where: { id },
      });

      await this.invalidateSubcategoryCache();
      return { message: 'Subcategory deleted successfully' };
    } catch (error) {
      throw createError(404, 'Subcategory not found');
    }
  }

  static async getSubcategoryKPIs(categoryId?: string) {
    const cacheKey = `subcategories:kpis:${categoryId || 'all'}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.SHORT, async () => {
      const where: any = {};
      if (categoryId) {
        where.categoryId = categoryId;
      }

      const [totalSubcategories, activeSubcategories, inactiveSubcategories] = await Promise.all([
        prisma.productSubcategory.count({ where }),
        prisma.productSubcategory.count({ where: { ...where, status: 'ACTIVE' } }),
        prisma.productSubcategory.count({ where: { ...where, status: 'INACTIVE' } }),
      ]);

      return {
        totalSubcategories,
        activeSubcategories,
        inactiveSubcategories,
      };
    });
  }

  static async exportSubcategories(categoryId?: string) {
    const where: any = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const subcategories = await prisma.productSubcategory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: {
          select: { name: true }
        }
      }
    });

    const fields = ['ID', 'Name', 'Slug', 'Category Name', 'Description', 'Status', 'Created At'];
    const csvRows = [fields.join(',')];

    for (const sub of subcategories) {
      const row = [
        sub.id,
        `"${sub.name.replace(/"/g, '""')}"`,
        sub.slug,
        `"${sub.category?.name?.replace(/"/g, '""') || ''}"`,
        `"${(sub.description || '').replace(/"/g, '""')}"`,
        sub.status,
        sub.createdAt.toISOString()
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}
