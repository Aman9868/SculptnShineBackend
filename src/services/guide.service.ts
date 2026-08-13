import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';

export class GuideService {
  static async getAllGuides(page: number = 1, limit: number = 10, status?: boolean) {
    const skip = (page - 1) * limit;
    const where = status !== undefined ? { status } : {};

    const [guides, total] = await Promise.all([
      prisma.guide.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.guide.count({ where }),
    ]);

    return {
      guides,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getGuideById(id: string) {
    const guide = await prisma.guide.findUnique({
      where: { id },
    });

    if (!guide) {
      throw { statusCode: 404, message: 'Guide not found' } as AppError;
    }

    return guide;
  }

  static async getGuideBySlug(slug: string) {
    const guide = await prisma.guide.findUnique({
      where: { slug },
    });

    if (!guide) {
      throw { statusCode: 404, message: 'Guide not found' } as AppError;
    }

    return guide;
  }

  static async createGuide(data: any) {
    const existing = await prisma.guide.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      throw { statusCode: 400, message: 'A guide with this slug already exists' } as AppError;
    }

    return prisma.guide.create({
      data,
    });
  }

  static async updateGuide(id: string, data: any) {
    const guide = await prisma.guide.findUnique({ where: { id } });
    if (!guide) {
      throw { statusCode: 404, message: 'Guide not found' } as AppError;
    }

    if (data.slug && data.slug !== guide.slug) {
      const existing = await prisma.guide.findUnique({ where: { slug: data.slug } });
      if (existing) {
        throw { statusCode: 400, message: 'A guide with this slug already exists' } as AppError;
      }
    }

    return prisma.guide.update({
      where: { id },
      data,
    });
  }

  static async deleteGuide(id: string) {
    const guide = await prisma.guide.findUnique({ where: { id } });
    if (!guide) {
      throw { statusCode: 404, message: 'Guide not found' } as AppError;
    }

    await prisma.guide.delete({
      where: { id },
    });

    return { message: 'Guide deleted successfully' };
  }
}
