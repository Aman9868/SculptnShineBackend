import { Prisma, PolicyType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { cacheService, CACHE_TTL, CACHE_PATTERNS } from './cache.service';

export class PolicyService {
  private static async invalidatePolicyCache() {
    await cacheService.delByPattern(CACHE_PATTERNS.POLICIES);
  }

  static async getAllPolicies(options: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 10, search = '' } = options;
    const cacheKey = `policies:list:${page}:${limit}:${search || 'all'}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.DAY, async () => {
      const skip = (page - 1) * limit;

      const where: Prisma.PolicyWhereInput = search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {};

      const [policies, total] = await Promise.all([
        prisma.policy.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.policy.count({ where }),
      ]);

      return {
        policies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  static async getPolicyByIdOrType(idOrType: string) {
    const cacheKey = `policies:idOrType:${idOrType}`;

    return await cacheService.getOrSet(cacheKey, CACHE_TTL.DAY, async () => {
      // Check if the string is a valid PolicyType enum value
      const isEnumValue = Object.values(PolicyType).includes(idOrType as PolicyType);

      if (isEnumValue) {
        return await prisma.policy.findFirst({
          where: {
            OR: [
              { id: idOrType },
              { type: idOrType as PolicyType }
            ]
          },
        });
      }

      return await prisma.policy.findFirst({
        where: { id: idOrType },
      });
    });
  }

  static async createPolicy(data: { title: string; type: PolicyType; content: string; isActive?: boolean }) {
    const policy = await prisma.policy.create({
      data: {
        title: data.title,
        type: data.type,
        content: data.content,
        isActive: data.isActive ?? true,
      },
    });

    await this.invalidatePolicyCache();
    return policy;
  }

  static async updatePolicy(id: string, data: { title?: string; type?: PolicyType; content?: string; isActive?: boolean }) {
    const policy = await prisma.policy.update({
      where: { id },
      data,
    });

    await this.invalidatePolicyCache();
    return policy;
  }

  static async deletePolicy(id: string) {
    const result = await prisma.policy.delete({
      where: { id },
    });

    await this.invalidatePolicyCache();
    return result;
  }
}
