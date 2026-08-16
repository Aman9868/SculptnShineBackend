import { Prisma, PrismaClient } from '@prisma/client';
import { getRequestContext } from './request-context';

const basePrisma = new PrismaClient();

const writeAuditLog = async (action: string, entity: string, details?: Prisma.InputJsonValue) => {
  try {
    const ctx = getRequestContext();
    await (basePrisma as any).auditLog.create({
      data: {
        action,
        entity,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        status: 'SUCCESS',
        details,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

const getUpdatedFields = (data: unknown) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [];
  }

  return Object.keys(data);
};

export const prisma = basePrisma.$extends({
  query: {
    productCategory: {
      async create({ args, query }) {
        const category = await query(args);
        await writeAuditLog('Created Category', 'ProductCategory', {
          categoryId: category.id,
          name: category.name,
          slug: category.slug,
          status: category.status,
        });
        return category;
      },
      async update({ args, query }) {
        const category = await query(args);
        await writeAuditLog('Updated Category', 'ProductCategory', {
          categoryId: category.id,
          name: category.name,
          slug: category.slug,
          updatedFields: getUpdatedFields(args.data),
        });
        return category;
      },
      async delete({ args, query }) {
        const category = await query(args);
        await writeAuditLog('Deleted Category', 'ProductCategory', {
          categoryId: category.id,
          name: category.name,
          slug: category.slug,
        });
        return category;
      },
    },
    productSubcategory: {
      async create({ args, query }) {
        const subcategory = await query(args);
        await writeAuditLog('Created Subcategory', 'ProductSubcategory', {
          subcategoryId: subcategory.id,
          categoryId: subcategory.categoryId,
          name: subcategory.name,
          slug: subcategory.slug,
          status: subcategory.status,
        });
        return subcategory;
      },
      async update({ args, query }) {
        const subcategory = await query(args);
        await writeAuditLog('Updated Subcategory', 'ProductSubcategory', {
          subcategoryId: subcategory.id,
          categoryId: subcategory.categoryId,
          name: subcategory.name,
          slug: subcategory.slug,
          updatedFields: getUpdatedFields(args.data),
        });
        return subcategory;
      },
      async delete({ args, query }) {
        const subcategory = await query(args);
        await writeAuditLog('Deleted Subcategory', 'ProductSubcategory', {
          subcategoryId: subcategory.id,
          categoryId: subcategory.categoryId,
          name: subcategory.name,
          slug: subcategory.slug,
        });
        return subcategory;
      },
    },
  },
});
