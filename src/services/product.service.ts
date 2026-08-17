import { prisma } from '../config/prisma';
import { BrandService } from './brand.service';
import { cacheService, CACHE_TTL, CACHE_PATTERNS } from './cache.service';
import { DbLoggerService } from './db-logger.service';

const createError = (statusCode: number, message: string) => {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export class ProductService {
  private static async invalidateProductCache() {
    await cacheService.invalidatePatterns([
      CACHE_PATTERNS.PRODUCTS,
      CACHE_PATTERNS.CATEGORIES,
    ]);
  }
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
    const cacheKey = `products:v3:list:${JSON.stringify(query)}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.DEFAULT, async () => {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (query.categoryId) where.categoryId = query.categoryId;
      if (query.categorySlug) where.category = { slug: query.categorySlug };
      if (query.subcategoryId) where.subcategoryId = query.subcategoryId;
      if (query.subcategorySlug) where.subcategory = { slug: query.subcategorySlug };
      
      const requestedStatus = query.status || 'ACTIVE';
      if (requestedStatus !== 'ALL') {
        where.status = requestedStatus;
      }
      
      if (where.status === 'ACTIVE') {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { unitPrice: { gt: 0 } },
              { variants: { some: { unitPrice: { gt: 0 } } } }
            ]
          }
        ];
      }
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

      let orderBy: any = { createdAt: 'desc' };
      if (query.sort) {
        switch (query.sort) {
          case 'price_asc':
            orderBy = { unitPrice: 'asc' };
            break;
          case 'price_desc':
            orderBy = { unitPrice: 'desc' };
            break;
          case 'rating_desc':
            orderBy = [{ averageRating: 'desc' }, { reviewCount: 'desc' }];
            break;
          case 'popular':
            orderBy = [{ reviewCount: 'desc' }, { averageRating: 'desc' }, { createdAt: 'desc' }];
            break;
          case 'newest':
          default:
            orderBy = { createdAt: 'desc' };
            break;
        }
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

      const result = {
        products,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };

      if (query.search || query.categoryId || query.brandId || query.preference || query.flavors || query.weights || query.minPrice || query.maxPrice) {
        DbLoggerService.logCatalogSearch(query.search, query, total);
      }

      return result;
    });
  }

  static async getFilters(query: { search?: string, status?: string }) {
    const cacheKey = `products:v3:filters:${JSON.stringify(query)}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.MEDIUM, async () => {
      const where: any = {
        status: query.status || 'ACTIVE'
      };
      if (where.status === 'ACTIVE') {
        where.AND = [
          {
            OR: [
              { unitPrice: { gt: 0 } },
              { variants: { some: { unitPrice: { gt: 0 } } } }
            ]
          }
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
    });
  }

  static async getProductById(idOrSlug: string) {
    const cacheKey = `products:detail:${idOrSlug}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.MEDIUM, async () => {
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
    });
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

    await this.invalidateProductCache();

    DbLoggerService.logProduct('PRODUCT_CREATED', product.id, {
      title: product.title,
      sku: product.sku,
      unitPrice: product.unitPrice,
      stock: product.stock,
      categoryId: product.categoryId,
      brandId: product.brandId,
    });

    return product;
  }

  static async updateProduct(id: string, data: any) {
    const existing = await prisma.product.findUnique({ 
      where: { id },
      include: { brand: true, variants: true } 
    });
    if (!existing) {
      throw createError(404, 'Product not found');
    }

    if (data.sku && data.sku !== existing.sku) {
      const duplicateSku = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (duplicateSku) {
        throw createError(400, `Product SKU '${data.sku}' already exists`);
      }
    }

    // Separate relational nested objects from scalar update fields
    const { 
      brand, 
      category, 
      subcategory, 
      variants, 
      reviews, 
      inventoryLogs, 
      orderItems, 
      cartItems, 
      wishlistItems,
      reason, 
      createdAt, 
      updatedAt, 
      id: _ignoredId,
      ...cleanData 
    } = data;

    // Resolve Brand Relation
    let brandId = cleanData.brandId;
    if (brand && typeof brand === 'object' && brand.id) {
      brandId = brand.id;
    } else if (typeof brand === 'string' && brand.trim()) {
      const brandObj = await BrandService.findOrCreateBrandByName(brand);
      if (brandObj) {
        brandId = brandObj.id;
      }
    } else if (cleanData.brand && typeof cleanData.brand === 'string' && cleanData.brand.trim()) {
      const brandObj = await BrandService.findOrCreateBrandByName(cleanData.brand);
      if (brandObj) {
        brandId = brandObj.id;
      }
    }

    if (brandId === "") {
      brandId = null;
    }

    if (brandId !== undefined) {
      cleanData.brandId = brandId;
    }

    // Resolve Category / Subcategory IDs if sent as nested objects
    if (category && typeof category === 'object' && category.id) {
      cleanData.categoryId = category.id;
    }
    if (subcategory && typeof subcategory === 'object' && subcategory.id) {
      cleanData.subcategoryId = subcategory.id;
    }

    if (cleanData.expiryDate) {
      cleanData.expiryDate = new Date(cleanData.expiryDate);
    }

    // Process and synchronize product variants if provided
    if (Array.isArray(variants)) {
      const incomingVariantIds = variants.map((v: any) => v.id).filter(Boolean);
      
      // Delete variants that were removed in the edit form
      const variantsToDelete = existing.variants.filter((ev: any) => !incomingVariantIds.includes(ev.id));
      if (variantsToDelete.length > 0) {
        await prisma.productVariant.deleteMany({
          where: { id: { in: variantsToDelete.map((v: any) => v.id) } },
        });
      }

      // Upsert/create/update incoming variants
      for (const [idx, v] of variants.entries()) {
        const variantSku = v.sku?.trim() || `${cleanData.sku || existing.sku}-V${idx + 1}`;
        const variantData: any = {
          title: v.title || `${v.flavor || ''} ${v.weight || ''}`.trim() || `Variant ${idx + 1}`,
          sku: variantSku,
          flavor: v.flavor || null,
          weight: v.weight || null,
          unitPrice: parseFloat(v.unitPrice) || parseFloat(cleanData.unitPrice) || existing.unitPrice,
          discountPercentage: v.discountPercentage !== undefined ? parseFloat(v.discountPercentage) : 0,
          gst: v.gst !== undefined ? parseFloat(v.gst) : 18,
          expiryDate: v.expiryDate ? new Date(v.expiryDate) : (cleanData.expiryDate || null),
          stock: parseInt(v.stock) >= 0 ? parseInt(v.stock) : 0,
          images: Array.isArray(v.images) ? v.images : (cleanData.images || existing.images || []),
          isDefault: v.isDefault ?? (idx === 0),
        };

        if (v.id && existing.variants.some((ev: any) => ev.id === v.id)) {
          await prisma.productVariant.update({
            where: { id: v.id },
            data: variantData,
          });
        } else {
          await prisma.productVariant.create({
            data: {
              ...variantData,
              productId: id,
            },
          });
        }
      }

      if (variants.length > 0) {
        // Compute aggregate stock and earliest active expiry date
        const totalVariantStock = variants.reduce((sum: number, v: any) => sum + (parseInt(v.stock) || 0), 0);
        cleanData.stock = totalVariantStock;

        const activeExpiries = variants
          .filter((v: any) => v.expiryDate && (parseInt(v.stock) || 0) > 0)
          .map((v: any) => new Date(v.expiryDate).getTime());

        if (activeExpiries.length > 0) {
          cleanData.expiryDate = new Date(Math.min(...activeExpiries));
        }

        const lowestPrice = Math.min(...variants.map((v: any) => parseFloat(v.unitPrice)).filter((p: number) => !isNaN(p) && p > 0));
        if (isFinite(lowestPrice) && lowestPrice > 0) {
          cleanData.unitPrice = lowestPrice;
        }
      }
    }

    const stockDifference = cleanData.stock !== undefined ? cleanData.stock - existing.stock : 0;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...cleanData,
        status: cleanData.stock !== undefined ? (cleanData.stock === 0 ? 'OUT_OF_STOCK' : cleanData.status || existing.status) : cleanData.status,
      },
      include: {
        brand: true,
        category: true,
        subcategory: true,
        variants: true,
      }
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

    await this.invalidateProductCache();

    DbLoggerService.logProduct('PRODUCT_UPDATED', updatedProduct.id, {
      title: updatedProduct.title,
      sku: updatedProduct.sku,
      updatedFields: Object.keys(data),
      stockDifference,
    });

    return updatedProduct;
  }

  static async deleteProduct(id: string) {
    try {
      await prisma.product.delete({ where: { id } });
      await this.invalidateProductCache();

      DbLoggerService.logProduct('PRODUCT_DELETED', id, { productId: id });

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

  static async bulkUploadProducts(rawProducts: any[]) {
    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      throw createError(400, 'Invalid payload: Array of products is required');
    }

    const categories = await prisma.productCategory.findMany({
      include: { subcategories: true }
    });
    const brands = await prisma.productBrand.findMany();

    const results = {
      total: rawProducts.length,
      created: 0,
      updated: 0,
      variantsCreated: 0,
      variantsUpdated: 0,
      failed: 0,
      errors: [] as Array<{ row: number; title?: string; sku?: string; error: string }>
    };

    // Cache of products created/seen in this batch to allow instant parent-child variant linking
    const batchProductMap = new Map<string, any>(); // key: sku or slug or title lowercase

    for (let index = 0; index < rawProducts.length; index++) {
      const row = rawProducts[index];
      const rowNum = index + 1;

      try {
        const parentSku = (row.parentSku || row.ParentSKU || row.parent_sku || row['Parent SKU'] || row['Parent Product SKU'] || '').toString().trim();
        const flavor = (row.flavor || row.Flavor || row['Flavor / Shade'] || '').toString().trim() || null;
        const weight = (row.weight || row.Weight || row['Weight / Size'] || '').toString().trim() || null;
        const isDefaultVariant = (row.isDefault || row.IsDefault || row['Is Default'] || '').toString().trim().toUpperCase() === 'TRUE';

        // -------------------------------------------------------------
        // CASE 1: Explicit Variant Row Linked via ParentSKU
        // -------------------------------------------------------------
        if (parentSku) {
          let parentProduct = batchProductMap.get(parentSku.toLowerCase());
          if (!parentProduct) {
            parentProduct = await prisma.product.findUnique({
              where: { sku: parentSku }
            });
          }

          if (!parentProduct) {
            throw new Error(`Parent product with SKU "${parentSku}" not found. Ensure parent product is listed before its variants or exists in database.`);
          }

          const variantSku = (row.sku || row.SKU || row['Sku'] || '').toString().trim() || 
            `${parentProduct.sku}-${(flavor || '').replace(/[^a-z0-9]/gi, '')}-${(weight || '').replace(/[^a-z0-9]/gi, '')}`.toUpperCase();
          
          const variantTitle = (row.variantTitle || row.Title || row.title || `${parentProduct.title} - ${[flavor, weight].filter(Boolean).join(' ')}`).toString().trim();
          const variantUnitPrice = parseFloat(row.unitPrice || row.UnitPrice || row.price || row.Price || row['Unit Price'] || parentProduct.unitPrice.toString());
          const variantDiscount = parseFloat(row.discountPercentage || row.DiscountPercentage || row.discount || '0') || 0;
          const variantGst = parseFloat(row.gst || row.GST || parentProduct.gst.toString()) || 18;
          const variantStock = parseInt(row.stock || row.Stock || row.quantity || '0', 10) || 0;

          let variantImages: string[] = [];
          const rawVariantImages = row.images || row.Images || row['Image URLs'] || row.image;
          if (Array.isArray(rawVariantImages)) {
            variantImages = rawVariantImages.map((img: any) => String(img).trim()).filter(Boolean);
          } else if (typeof rawVariantImages === 'string') {
            variantImages = rawVariantImages.split(/[\n,;]+/).map((img: string) => img.trim()).filter(Boolean);
          }
          if (variantImages.length === 0) {
            variantImages = parentProduct.images || [];
          }

          // Check if variant with this SKU exists
          const existingVariant = await prisma.productVariant.findUnique({
            where: { sku: variantSku }
          });

          if (existingVariant) {
            await prisma.productVariant.update({
              where: { id: existingVariant.id },
              data: {
                productId: parentProduct.id,
                title: variantTitle,
                flavor,
                weight,
                unitPrice: variantUnitPrice,
                discountPercentage: variantDiscount,
                gst: variantGst,
                stock: variantStock,
                images: variantImages,
                isDefault: isDefaultVariant,
              }
            });
            results.variantsUpdated++;
          } else {
            await prisma.productVariant.create({
              data: {
                productId: parentProduct.id,
                title: variantTitle,
                sku: variantSku,
                flavor,
                weight,
                unitPrice: variantUnitPrice,
                discountPercentage: variantDiscount,
                gst: variantGst,
                stock: variantStock,
                images: variantImages,
                isDefault: isDefaultVariant,
              }
            });
            results.variantsCreated++;
          }

          continue;
        }

        // -------------------------------------------------------------
        // CASE 2: Parent Product Row (With optional embedded variant)
        // -------------------------------------------------------------
        const title = (row.title || row.Title || row['Product Title'] || '').toString().trim();
        if (!title) {
          throw new Error('Product title is required');
        }

        const skuRaw = (row.sku || row.SKU || row['Sku'] || '').toString().trim();
        const baseSlug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        const sku = skuRaw || (baseSlug.substring(0, 20).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase());

        const unitPrice = parseFloat(row.unitPrice || row.UnitPrice || row.price || row.Price || row['Unit Price'] || '0');
        if (isNaN(unitPrice) || unitPrice < 0) {
          throw new Error('Valid unitPrice is required (>= 0)');
        }

        const discountPercentage = parseFloat(row.discountPercentage || row.DiscountPercentage || row.discount || row['Discount %'] || '0') || 0;
        const gst = parseFloat(row.gst || row.GST || row['GST %'] || '18') || 18;
        const stock = parseInt(row.stock || row.Stock || row.quantity || row.Quantity || '0', 10) || 0;
        const lowStockAlert = parseInt(row.lowStockAlert || row.LowStockAlert || row['Low Stock Alert'] || '5', 10) || 5;

        // Preference enum
        const prefRaw = (row.preference || row.Preference || '').toString().trim().toUpperCase().replace(/[-\s]/g, '_');
        let preference: any = 'NOT_APPLICABLE';
        if (['VEGETARIAN', 'NON_VEGETARIAN', 'EGGITARIAN', 'VEGAN', 'NOT_APPLICABLE'].includes(prefRaw)) {
          preference = prefRaw;
        }

        // Status enum
        const statusRaw = (row.status || row.Status || '').toString().trim().toUpperCase().replace(/[-\s]/g, '_');
        let status: any = 'ACTIVE';
        if (['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'].includes(statusRaw)) {
          status = statusRaw;
        } else if (stock === 0) {
          status = 'OUT_OF_STOCK';
        }

        // Expiry Date
        let expiryDate: Date | null = null;
        if (row.expiryDate || row.ExpiryDate || row['Expiry Date']) {
          const parsedDate = new Date(row.expiryDate || row.ExpiryDate || row['Expiry Date']);
          if (!isNaN(parsedDate.getTime())) {
            expiryDate = parsedDate;
          }
        }

        // Brand matching or creation
        const brandName = (row.brandName || row.brand || row.Brand || row['Brand Name'] || '').toString().trim();
        let brandId: string | null = null;
        if (brandName) {
          let matchedBrand = brands.find(
            b => b.name.toLowerCase() === brandName.toLowerCase() || b.slug.toLowerCase() === brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          );

          if (!matchedBrand) {
            const newBrandSlug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            matchedBrand = await prisma.productBrand.create({
              data: {
                name: brandName,
                slug: newBrandSlug + '-' + Math.random().toString(36).substring(2, 6),
                status: 'ACTIVE'
              }
            });
            brands.push(matchedBrand);
          }
          brandId = matchedBrand.id;
        }

        // Category & Subcategory matching
        const catName = (row.categoryName || row.category || row.Category || row['Category Name'] || '').toString().trim();
        const subcatName = (row.subcategoryName || row.subcategory || row.Subcategory || row['Subcategory Name'] || '').toString().trim();
        let categoryId: string | null = null;
        let subcategoryId: string | null = null;

        if (catName) {
          const matchedCategory = categories.find(
            c => c.name.toLowerCase() === catName.toLowerCase() || c.slug.toLowerCase() === catName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          );

          if (matchedCategory) {
            categoryId = matchedCategory.id;

            if (subcatName && matchedCategory.subcategories?.length > 0) {
              const matchedSub = matchedCategory.subcategories.find(
                s => s.name.toLowerCase() === subcatName.toLowerCase() || s.slug.toLowerCase() === subcatName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
              );
              if (matchedSub) {
                subcategoryId = matchedSub.id;
              }
            }
          }
        }

        // Images parsing
        let images: string[] = [];
        const rawImages = row.images || row.Images || row['Image URLs'] || row.image || row.Image;
        if (Array.isArray(rawImages)) {
          images = rawImages.map((img: any) => String(img).trim()).filter(Boolean);
        } else if (typeof rawImages === 'string') {
          images = rawImages.split(/[\n,;]+/).map((img: string) => img.trim()).filter(Boolean);
        }

        if (images.length === 0) {
          images = ['https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=800&q=80'];
        }

        const description = (row.description || row.Description || '').toString().trim() || null;

        // Check if product with this SKU already exists
        let product = await prisma.product.findUnique({
          where: { sku }
        });

        if (product) {
          product = await prisma.product.update({
            where: { id: product.id },
            data: {
              title,
              description,
              brandId,
              preference,
              unitPrice,
              discountPercentage,
              gst,
              expiryDate,
              stock,
              lowStockAlert,
              images,
              status,
              categoryId,
              subcategoryId,
            }
          });
          results.updated++;
        } else {
          // Generate unique slug
          let slug = baseSlug;
          let counter = 1;
          while (await prisma.product.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }

          product = await prisma.product.create({
            data: {
              title,
              slug,
              description,
              brandId,
              preference,
              unitPrice,
              discountPercentage,
              gst,
              expiryDate,
              sku,
              stock,
              lowStockAlert,
              images,
              status,
              categoryId,
              subcategoryId,
            }
          });
          results.created++;
        }

        // Cache in batch map for succeeding variant rows
        batchProductMap.set(sku.toLowerCase(), product);

        // If this product row also specified Flavor or Weight, auto-create its initial variant
        if (flavor || weight) {
          const varSku = `${sku}-VAR-1`;
          const existingVar = await prisma.productVariant.findFirst({
            where: {
              productId: product.id,
              OR: [{ sku: varSku }, { flavor, weight }]
            }
          });

          if (!existingVar) {
            await prisma.productVariant.create({
              data: {
                productId: product.id,
                title: `${product.title} - ${[flavor, weight].filter(Boolean).join(' ')}`,
                sku: varSku,
                flavor,
                weight,
                unitPrice,
                discountPercentage,
                gst,
                stock,
                images,
                isDefault: true,
              }
            });
            results.variantsCreated++;
          }
        }
      } catch (err: any) {
        results.failed++;
        results.errors.push({
          row: rowNum,
          title: row.title || row.Title,
          sku: row.sku || row.SKU,
          error: err.message || 'Unknown processing error'
        });
      }
    }

    await this.invalidateProductCache();

    DbLoggerService.logProduct('BULK_UPLOAD', undefined, {
      totalProcessed: rawProducts.length,
      created: results.created,
      updated: results.updated,
      failed: results.failed,
    });

    return results;
  }

  static async exportProductsForExcel(query: any = {}) {
    const products = await prisma.product.findMany({
      include: {
        brand: true,
        category: true,
        subcategory: true,
        variants: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    const exportRows: any[] = [];

    for (const p of products) {
      // Main Product Row
      exportRows.push({
        Title: p.title,
        SKU: p.sku,
        ParentSKU: '',
        Brand: p.brand?.name || '',
        Category: p.category?.name || '',
        Subcategory: p.subcategory?.name || '',
        Flavor: '',
        Weight: '',
        UnitPrice: p.unitPrice,
        DiscountPercentage: p.discountPercentage || 0,
        GST: p.gst,
        Stock: p.stock,
        LowStockAlert: p.lowStockAlert,
        Preference: p.preference || 'NOT_APPLICABLE',
        Status: p.status,
        IsDefault: '',
        Description: p.description || '',
        Images: (p.images || []).join(', '),
        ExpiryDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : '',
      });

      // Variant Rows (if any)
      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          exportRows.push({
            Title: v.title,
            SKU: v.sku,
            ParentSKU: p.sku,
            Brand: p.brand?.name || '',
            Category: p.category?.name || '',
            Subcategory: p.subcategory?.name || '',
            Flavor: v.flavor || '',
            Weight: v.weight || '',
            UnitPrice: v.unitPrice,
            DiscountPercentage: v.discountPercentage || 0,
            GST: v.gst,
            Stock: v.stock,
            LowStockAlert: p.lowStockAlert,
            Preference: p.preference || 'NOT_APPLICABLE',
            Status: p.status,
            IsDefault: v.isDefault ? 'TRUE' : 'FALSE',
            Description: '',
            Images: (v.images || []).join(', '),
            ExpiryDate: p.expiryDate ? p.expiryDate.toISOString().split('T')[0] : '',
          });
        }
      }
    }

    return exportRows;
  }

  static getSampleTemplateData() {
    return [
      // 1. Parent Product: ON Gold Standard Whey
      {
        Title: 'Optimum Nutrition Gold Standard 100% Whey',
        SKU: 'ON-GSWHEY-MAIN',
        ParentSKU: '',
        Brand: 'Optimum Nutrition',
        Category: 'Proteins & Fitness Supplements',
        Subcategory: 'Whey Isolate & Concentrates',
        Flavor: '',
        Weight: '',
        UnitPrice: 3899,
        DiscountPercentage: 15,
        GST: 18,
        Stock: 80,
        LowStockAlert: 5,
        Preference: 'VEGETARIAN',
        Status: 'ACTIVE',
        IsDefault: '',
        Description: 'World #1 Whey Protein with 24g premium protein and 5.5g naturally occurring BCAAs.',
        Images: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=800&q=80',
        ExpiryDate: '2027-12-31'
      },
      // Variant 1 of ON Whey
      {
        Title: 'Optimum Nutrition Gold Standard Whey - Double Rich Chocolate 2 lbs',
        SKU: 'ON-GSWHEY-2LB-CHOC',
        ParentSKU: 'ON-GSWHEY-MAIN',
        Brand: 'Optimum Nutrition',
        Category: 'Proteins & Fitness Supplements',
        Subcategory: 'Whey Isolate & Concentrates',
        Flavor: 'Double Rich Chocolate',
        Weight: '2 lbs',
        UnitPrice: 3899,
        DiscountPercentage: 15,
        GST: 18,
        Stock: 45,
        LowStockAlert: 5,
        Preference: 'VEGETARIAN',
        Status: 'ACTIVE',
        IsDefault: 'TRUE',
        Description: '',
        Images: 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?auto=format&fit=crop&w=800&q=80',
        ExpiryDate: '2027-12-31'
      },
      // Variant 2 of ON Whey
      {
        Title: 'Optimum Nutrition Gold Standard Whey - French Vanilla Cream 5 lbs',
        SKU: 'ON-GSWHEY-5LB-VAN',
        ParentSKU: 'ON-GSWHEY-MAIN',
        Brand: 'Optimum Nutrition',
        Category: 'Proteins & Fitness Supplements',
        Subcategory: 'Whey Isolate & Concentrates',
        Flavor: 'French Vanilla Cream',
        Weight: '5 lbs',
        UnitPrice: 7899,
        DiscountPercentage: 20,
        GST: 18,
        Stock: 35,
        LowStockAlert: 5,
        Preference: 'VEGETARIAN',
        Status: 'ACTIVE',
        IsDefault: 'FALSE',
        Description: '',
        Images: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
        ExpiryDate: '2027-12-31'
      },
      // 2. Standalone Skincare Product (No Variants)
      {
        Title: 'CeraVe Hydrating Facial Cleanser for Normal to Dry Skin 473ml',
        SKU: 'CERAVE-CLEANSER-473ML',
        ParentSKU: '',
        Brand: 'CeraVe',
        Category: 'Skincare & Facial Care',
        Subcategory: 'Face Serums & Glow Elixirs',
        Flavor: '',
        Weight: '473 ml',
        UnitPrice: 1250,
        DiscountPercentage: 10,
        GST: 18,
        Stock: 30,
        LowStockAlert: 5,
        Preference: 'NOT_APPLICABLE',
        Status: 'ACTIVE',
        IsDefault: 'TRUE',
        Description: 'Gentle foaming cleanser with 3 essential ceramides and hyaluronic acid for lasting barrier hydration.',
        Images: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80',
        ExpiryDate: '2028-06-30'
      }
    ];
  }

  /**
   * Industry-Standard Best Sellers Service
   * Calculates rank by sales quantity from paid orders with rating/active backfill and Redis caching.
   */
  static async getBestSellers(limit: number = 8, categoryId?: string) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 30));
    const cacheKey = `products:best-sellers:${safeLimit}:${categoryId || 'all'}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.DEFAULT, async () => {
      // 1. Fetch IDs of paid / completed non-cancelled orders
      const paidOrders = await prisma.order.findMany({
        where: {
          OR: [
            { paymentStatus: 'COMPLETED' },
            { status: 'PAID' },
            { status: 'PROCESSING' },
            { status: 'SHIPPED' },
            { status: 'DELIVERED' }
          ],
          NOT: { status: 'CANCELLED' }
        },
        select: { id: true },
        take: 2000
      });

      const paidOrderIds = paidOrders.map(o => o.id);
      const bestSellers: any[] = [];

      if (paidOrderIds.length > 0) {
        const topSales = await prisma.orderItem.groupBy({
          by: ['productId'],
          _sum: { quantity: true },
          where: {
            orderId: { in: paidOrderIds }
          },
          orderBy: {
            _sum: {
              quantity: 'desc'
            }
          },
          take: safeLimit
        });

        const topProductIds = topSales.map(item => item.productId).filter((id): id is string => Boolean(id));

      if (topProductIds.length > 0) {
        const fetchedProducts = await prisma.product.findMany({
          where: {
            id: { in: topProductIds },
            status: 'ACTIVE',
            OR: [
              { unitPrice: { gt: 0 } },
              { variants: { some: { unitPrice: { gt: 0 } } } }
            ],
            ...(categoryId ? { categoryId } : {})
          },
          include: {
            category: { select: { id: true, name: true, slug: true } },
            subcategory: { select: { id: true, name: true, slug: true } },
            brand: { select: { id: true, name: true, logo: true } },
            variants: {
              where: { stock: { gte: 0 } },
              orderBy: [{ isDefault: 'desc' }, { unitPrice: 'asc' }]
            }
          }
        });

        // Preserve ranking order of highest quantity sold
        const productMap = new Map(fetchedProducts.map(p => [p.id, p]));
        for (const s of topSales) {
          if (!s.productId) continue;
          const p = productMap.get(s.productId);
          if (p) {
            bestSellers.push({
              ...p,
              totalSold: s._sum.quantity || 0,
              isBestSeller: true
            });
          }
        }
      }
    }

      // 2. If fewer than safeLimit, backfill with highest rated active products with price > 0
      if (bestSellers.length < safeLimit) {
        const existingIds = bestSellers.map(p => p.id);
        const needed = safeLimit - bestSellers.length;

        const backfillProducts = await prisma.product.findMany({
          where: {
            id: { notIn: existingIds },
            status: 'ACTIVE',
            OR: [
              { unitPrice: { gt: 0 } },
              { variants: { some: { unitPrice: { gt: 0 } } } }
            ],
            ...(categoryId ? { categoryId } : {})
          },
          take: needed,
          orderBy: [
            { averageRating: 'desc' },
            { reviewCount: 'desc' },
            { createdAt: 'desc' }
          ],
          include: {
            category: { select: { id: true, name: true, slug: true } },
            subcategory: { select: { id: true, name: true, slug: true } },
            brand: { select: { id: true, name: true, logo: true } },
            variants: {
              where: { stock: { gte: 0 } },
              orderBy: [{ isDefault: 'desc' }, { unitPrice: 'asc' }]
            }
          }
        });

        for (const p of backfillProducts) {
          bestSellers.push({
            ...p,
            totalSold: 0,
            isBestSeller: true
          });
        }
      }

      return bestSellers;
    });
  }
}

