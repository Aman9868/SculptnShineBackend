import { PrismaClient, Prisma, PolicyType } from '@prisma/client';

const prisma = new PrismaClient();

export class PolicyService {
  static async getAllPolicies(options: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 10, search = '' } = options;
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
  }

  static async getPolicyByIdOrType(idOrType: string) {
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
  }

  static async createPolicy(data: { title: string; type: PolicyType; content: string; isActive?: boolean }) {
    return await prisma.policy.create({
      data: {
        title: data.title,
        type: data.type,
        content: data.content,
        isActive: data.isActive ?? true,
      },
    });
  }

  static async updatePolicy(id: string, data: { title?: string; type?: PolicyType; content?: string; isActive?: boolean }) {
    return await prisma.policy.update({
      where: { id },
      data,
    });
  }

  static async deletePolicy(id: string) {
    return await prisma.policy.delete({
      where: { id },
    });
  }
}
