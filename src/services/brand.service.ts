import { prisma } from '../config/prisma';
import { cacheService, CACHE_TTL, CACHE_PATTERNS } from './cache.service';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateSlug = (name: string) => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
};

export class BrandService {
  private static async invalidateBrandCache() {
    await cacheService.invalidatePatterns([
      CACHE_PATTERNS.BRANDS,
      CACHE_PATTERNS.PRODUCTS,
    ]);
  }

  static async getAllBrands(query: { search?: string; status?: string; page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const cacheKey = `brands:list:${page}:${limit}:${query.search || 'all'}:${query.status || 'all'}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.LONG, async () => {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (query.status) {
        where.status = query.status;
      }

      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const [brands, total] = await Promise.all([
        prisma.productBrand.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { products: true }
            }
          }
        }),
        prisma.productBrand.count({ where }),
      ]);

      return {
        brands,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  static async getBrandById(id: string) {
    const cacheKey = `brands:id:${id}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.LONG, async () => {
      const brand = await prisma.productBrand.findUnique({
        where: { id },
        include: {
          products: {
            take: 10,
            select: { id: true, title: true, unitPrice: true, discountPercentage: true, gst: true, status: true, images: true }
          },
          _count: { select: { products: true } }
        }
      });

      if (!brand) {
        throw createError(404, 'Product Brand not found');
      }

      return brand;
    });
  }

  static async findOrCreateBrandByName(name: string) {
    if (!name || !name.trim()) return null;
    const trimmedName = name.trim();
    const slug = generateSlug(trimmedName);

    let brand = await prisma.productBrand.findFirst({
      where: {
        OR: [
          { name: { equals: trimmedName, mode: 'insensitive' } },
          { slug: { equals: slug, mode: 'insensitive' } }
        ]
      }
    });

    if (!brand) {
      brand = await prisma.productBrand.create({
        data: {
          name: trimmedName,
          slug,
          status: 'ACTIVE',
        }
      });
      await this.invalidateBrandCache();
    }

    return brand;
  }

  static async createBrand(data: {
    name: string;
    slug?: string;
    logo?: string;
    description?: string;
    website?: string;
    status?: any;
  }) {
    if (!data.name || !data.name.trim()) {
      throw createError(400, 'Brand name is required');
    }

    const slug = data.slug ? generateSlug(data.slug) : generateSlug(data.name);

    const existingName = await prisma.productBrand.findUnique({ where: { name: data.name.trim() } });
    if (existingName) {
      throw createError(400, `Brand with name '${data.name}' already exists`);
    }

    const existingSlug = await prisma.productBrand.findUnique({ where: { slug } });
    if (existingSlug) {
      throw createError(400, `Brand with slug '${slug}' already exists`);
    }

    const brand = await prisma.productBrand.create({
      data: {
        name: data.name.trim(),
        slug,
        logo: data.logo || null,
        description: data.description || null,
        website: data.website || null,
        status: data.status || 'ACTIVE',
      }
    });

    await this.invalidateBrandCache();
    return brand;
  }

  static async updateBrand(id: string, data: any) {
    const existing = await prisma.productBrand.findUnique({ where: { id } });
    if (!existing) {
      throw createError(404, 'Product Brand not found');
    }

    if (data.name && data.name.trim() !== existing.name) {
      const duplicateName = await prisma.productBrand.findUnique({ where: { name: data.name.trim() } });
      if (duplicateName) {
        throw createError(400, `Brand with name '${data.name}' already exists`);
      }
    }

    let slug = existing.slug;
    if (data.slug && generateSlug(data.slug) !== existing.slug) {
      slug = generateSlug(data.slug);
      const duplicateSlug = await prisma.productBrand.findUnique({ where: { slug } });
      if (duplicateSlug) {
        throw createError(400, `Brand with slug '${slug}' already exists`);
      }
    }

    const updated = await prisma.productBrand.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        slug: data.slug ? slug : undefined,
        logo: data.logo !== undefined ? data.logo : undefined,
        description: data.description !== undefined ? data.description : undefined,
        website: data.website !== undefined ? data.website : undefined,
        status: data.status || undefined,
      }
    });

    await this.invalidateBrandCache();
    return updated;
  }

  static async deleteBrand(id: string) {
    const existing = await prisma.productBrand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } }
    });

    if (!existing) {
      throw createError(404, 'Product Brand not found');
    }

    if (existing._count.products > 0) {
      throw createError(400, `Cannot delete brand '${existing.name}' as it has ${existing._count.products} associated products.`);
    }

    await prisma.productBrand.delete({ where: { id } });
    await this.invalidateBrandCache();
    return { success: true, message: `Brand '${existing.name}' deleted successfully` };
  }

  static async getBrandKPIs() {
    const cacheKey = 'brands:kpis';

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.SHORT, async () => {
      const [totalBrands, activeBrands, inactiveBrands] = await Promise.all([
        prisma.productBrand.count(),
        prisma.productBrand.count({ where: { status: 'ACTIVE' } }),
        prisma.productBrand.count({ where: { status: 'INACTIVE' } }),
      ]);

      return {
        totalBrands,
        activeBrands,
        inactiveBrands,
      };
    });
  }

  static async getTopSellingBrands(limit: number = 8, categorySlug?: string) {
    const cacheKey = `brands:top-selling:${limit}:${categorySlug || 'all'}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.LONG, async () => {
      const whereClause: any = {
        status: 'ACTIVE',
        products: { some: { status: 'ACTIVE' } },
      };

      if (categorySlug) {
        whereClause.products.some.category = { slug: categorySlug };
      }

      // Get active brands that have products, ordered by product count
      const brands = await prisma.productBrand.findMany({
        where: whereClause,
        take: limit,
        orderBy: {
          products: { _count: 'desc' },
        },
        include: {
          _count: { select: { products: true } },
          products: {
            where: { status: 'ACTIVE' },
            take: 4,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              slug: true,
              images: true,
              unitPrice: true,
              discountPercentage: true,
              variants: {
                take: 1,
                orderBy: { isDefault: 'desc' },
                select: {
                  unitPrice: true,
                  discountPercentage: true,
                },
              },
            },
          },
        },
      });

      return brands.map((brand) => {
        // Calculate the max discount across all fetched products and their variants
        let maxDiscount = 0;
        brand.products.forEach((p) => {
          if (p.discountPercentage && p.discountPercentage > maxDiscount) {
            maxDiscount = p.discountPercentage;
          }
          p.variants?.forEach((v) => {
            if (v.discountPercentage && v.discountPercentage > maxDiscount) {
              maxDiscount = v.discountPercentage;
            }
          });
        });

        return {
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          logo: brand.logo,
          productCount: brand._count.products,
          maxDiscount: Math.round(maxDiscount),
          products: brand.products.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            image: p.images?.[0] || null,
          })),
        };
      });
    });
  }
}
