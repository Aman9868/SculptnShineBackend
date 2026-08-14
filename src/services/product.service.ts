import { prisma } from '../config/prisma';
import { BrandService } from './brand.service';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class ProductService {
  static async getAllProducts(query: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    categorySlug?: string;
    subcategoryId?: string;
    subcategorySlug?: string;
    brandId?: string;
    status?: string;
    brand?: string;
    preference?: string;
    flavors?: string;
    weights?: string;
    minPrice?: string | number;
    maxPrice?: string | number;
    rating?: string | number;
    sort?: string;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.categorySlug) where.category = { slug: query.categorySlug };
    if (query.subcategoryId) where.subcategoryId = query.subcategoryId;
    if (query.subcategorySlug) where.subcategory = { slug: query.subcategorySlug };
    if (query.brandId) where.brandId = query.brandId;
    if (query.status) where.status = query.status;
    if (query.brand) {
      where.brand = { name: { contains: query.brand, mode: 'insensitive' } };
    }

    // Preferences can be a comma-separated list
    if (query.preference) {
      const prefs = query.preference.split(',');
      // Try to parse them as the Preference enum, ignore invalid ones
      where.preference = { in: prefs };
    }

    // Rating filtering (minimum stars)
    if (query.rating) {
      const minStar = Number(query.rating);
      if (!isNaN(minStar) && minStar > 0) {
        where.averageRating = { gte: minStar };
        where.reviewCount = { gt: 0 };
      }
    }

    // Variants filtering (Flavors, Weights)
    if (query.flavors || query.weights) {
      where.variants = { some: {} };
      if (query.flavors) {
        where.variants.some.flavor = { in: query.flavors.split(',') };
      }
      if (query.weights) {
        where.variants.some.weight = { in: query.weights.split(',') };
      }
    }

    // Price Filtering on Product base price
    if (query.minPrice || query.maxPrice) {
      const min = query.minPrice ? Number(query.minPrice) : undefined;
      const max = query.maxPrice ? Number(query.maxPrice) : undefined;

      const priceFilter: any = {};
      if (min !== undefined) priceFilter.gte = min;
      if (max !== undefined) priceFilter.lte = max;

      where.AND = [
        ...(where.AND || []),
        { unitPrice: priceFilter }
      ];
    }

    if (query.search) {
      const keywords = query.search.trim().split(/\s+/).filter(k => k.length > 0);
      if (keywords.length > 0) {
        where.AND = [
          ...(where.AND || []),
          ...keywords.map(keyword => ({
            OR: [
              { title: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
              { sku: { contains: keyword, mode: 'insensitive' } },
              { brand: { name: { contains: keyword, mode: 'insensitive' } } },
              { category: { name: { contains: keyword, mode: 'insensitive' } } },
            ]
          }))
        ];
      }
    }

    let orderBy: any = { createdAt: 'desc' }; // default: newest
    if (query.sort) {
      if (query.sort === 'price_asc') orderBy = { unitPrice: 'asc' };
      else if (query.sort === 'price_desc') orderBy = { unitPrice: 'desc' };
      else if (query.sort === 'newest') orderBy = { createdAt: 'desc' };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          subcategory: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, slug: true, logo: true } },
          variants: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getFilters(query: { search?: string, status?: string }) {
    const where: any = {
      status: query.status || 'ACTIVE'
    };
    if (query.search) {
      const keywords = query.search.trim().split(/\s+/).filter(k => k.length > 0);
      if (keywords.length > 0) {
        where.AND = [
          ...(where.AND || []),
          ...keywords.map(keyword => ({
            OR: [
              { title: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
              { sku: { contains: keyword, mode: 'insensitive' } },
              { brand: { name: { contains: keyword, mode: 'insensitive' } } },
              { category: { name: { contains: keyword, mode: 'insensitive' } } },
            ]
          }))
        ];
      }
    }

    const products = await prisma.product.findMany({
      where,
      select: { preference: true, averageRating: true, reviewCount: true, brand: { select: { name: true } } }
    });

    const variants = await prisma.productVariant.findMany({
      where: { product: where },
      select: { flavor: true, weight: true }
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

    const ratedProducts = products.filter(p => p.reviewCount > 0 && p.averageRating > 0);
    const ratings = [4, 3, 2, 1].map(stars => ({
      stars,
      count: ratedProducts.filter(p => p.averageRating >= stars).length
    })).filter(r => r.count > 0);

    return {
      brands: getCounts(products, 'brand.name'),
      preferences: getCounts(products, 'preference'),
      flavors: getCounts(variants, 'flavor'),
      weights: getCounts(variants, 'weight'),
      ratings,
    };
  }

  static async getProductById(idOrSlug: string) {
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
          { sku: idOrSlug }
        ]
      },
      include: {
        category: true,
        subcategory: true,
        brand: true,
        variants: { orderBy: { createdAt: 'asc' } },
        inventoryLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!product) {
      throw createError(404, 'Product not found');
    }

    const basePrice = product.unitPrice;
    const discountPct = product.discountPercentage || 0;
    const calculatedDiscountPrice = discountPct > 0 
      ? Math.round(basePrice * (1 - discountPct / 100)) 
      : basePrice;

    const enrichedVariants = (product.variants || []).map((v: any) => {
      const vBasePrice = v.unitPrice ?? basePrice;
      const vDiscountPct = v.discountPercentage ?? discountPct ?? 0;
      const vDiscountPrice = vDiscountPct > 0 
        ? Math.round(vBasePrice * (1 - vDiscountPct / 100)) 
        : vBasePrice;
      return {
        ...v,
        price: vBasePrice,
        discountPrice: vDiscountPrice,
        salePrice: vDiscountPrice,
      };
    });

    const reviewAgg = await prisma.productReview.aggregate({
      where: { productId: product.id, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { id: true },
    });

    const averageRating = reviewAgg._avg.rating 
      ? Number(reviewAgg._avg.rating.toFixed(1)) 
      : product.averageRating || 0;
    const reviewCount = reviewAgg._count.id > 0 
      ? reviewAgg._count.id 
      : product.reviewCount || 0;

    return {
      ...product,
      averageRating,
      reviewCount,
      price: basePrice,
      discountPrice: calculatedDiscountPrice,
      salePrice: calculatedDiscountPrice,
      variants: enrichedVariants,
    };
  }

  static async createProduct(data: {
    title: string;
    slug?: string;
    description?: string;
    brand?: string;
    brandId?: string;
    preference?: any;
    unitPrice: number;
    discountPercentage?: number;
    gst?: number;
    expiryDate?: Date;
    sku: string;
    stock: number;
    lowStockAlert?: number;
    images?: string[];
    videos?: string[];
    categoryId?: string;
    subcategoryId?: string;
    status?: any;
    variants?: Array<{
      title: string;
      sku: string;
      flavor?: string;
      weight?: string;
      unitPrice: number;
      discountPercentage?: number;
      gst?: number;
      expiryDate?: Date | string;
      stock?: number;
      images?: string[];
      isDefault?: boolean;
    }>;
  }) {
    const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existingSku) {
      throw createError(400, `Product SKU '${data.sku}' already exists`);
    }

    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) {
      throw createError(400, `Product slug '${slug}' already exists`);
    }

    // Resolve Brand Relation (find or auto-create ProductBrand if string provided)
    let brandId = data.brandId || null;

    if (!brandId && data.brand && data.brand.trim()) {
      const brandObj = await BrandService.findOrCreateBrandByName(data.brand);
      if (brandObj) {
        brandId = brandObj.id;
      }
    }

    const product = await prisma.product.create({
      data: {
        title: data.title,
        slug,
        description: data.description,
        brandId: brandId,
        preference: data.preference || 'NOT_APPLICABLE',
        unitPrice: data.unitPrice,
        discountPercentage: data.discountPercentage || 0,
        gst: data.gst ?? 18,
        expiryDate: data.expiryDate,
        sku: data.sku,
        stock: data.stock,
        lowStockAlert: data.lowStockAlert || 5,
        images: data.images || [],
        videos: data.videos || [],
        status: data.status || (data.stock > 0 ? 'ACTIVE' : 'OUT_OF_STOCK'),
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        variants: data.variants && data.variants.length > 0 ? {
          create: data.variants.map((v) => ({
            title: v.title,
            sku: v.sku,
            flavor: v.flavor,
            weight: v.weight,
            unitPrice: v.unitPrice,
            discountPercentage: v.discountPercentage || 0,
            gst: v.gst ?? 18,
            expiryDate: v.expiryDate ? new Date(v.expiryDate) : (data.expiryDate || null),
            stock: v.stock || 0,
            images: v.images || [],
            isDefault: v.isDefault || false,
          }))
        } : undefined,
      },
      include: {
        brand: true,
        variants: true,
      },
    });

    if (data.stock > 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: product.id,
          change: data.stock,
          type: 'INITIAL_STOCK',
          reason: 'Initial product stock allocation',
        },
      });
    }

    return product;
  }

  static async updateProduct(id: string, data: any) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw createError(404, 'Product not found');
    }

    if (data.sku && data.sku !== existing.sku) {
      const duplicateSku = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (duplicateSku) {
        throw createError(400, `Product SKU '${data.sku}' already exists`);
      }
    }

    const stockDifference = data.stock !== undefined ? data.stock - existing.stock : 0;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        status: data.stock !== undefined ? (data.stock === 0 ? 'OUT_OF_STOCK' : data.status || existing.status) : data.status,
      },
    });

    if (stockDifference !== 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: id,
          change: stockDifference,
          type: stockDifference > 0 ? 'MANUAL_RESTOCK' : 'MANUAL_DEDUCTION',
          reason: data.reason || 'Manual stock update by Admin',
        },
      });
    }

    return updatedProduct;
  }

  static async deleteProduct(id: string) {
    try {
      await prisma.product.delete({ where: { id } });
      return { message: 'Product deleted successfully' };
    } catch (error) {
      throw createError(404, 'Product not found');
    }
  }

  static async getInventoryStatus() {
    const [totalProducts, outOfStockProducts, lowStockProducts] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { stock: 0 } }),
      prisma.product.count({
        where: {
          stock: { gt: 0, lte: 5 },
        },
      }),
    ]);

    const lowStockItems = await prisma.product.findMany({
      where: {
        stock: { lte: 5 },
      },
      select: {
        id: true,
        title: true,
        sku: true,
        stock: true,
        lowStockAlert: true,
        status: true,
      },
      orderBy: { stock: 'asc' },
    });

    return {
      totalProducts,
      outOfStockProducts,
      lowStockProducts,
      lowStockItems,
    };
  }
}
