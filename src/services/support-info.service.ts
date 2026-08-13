import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const supportInfoService = {
  getAllSupportInfo: async () => {
    return prisma.supportInfo.findMany({
      orderBy: { createdAt: 'asc' }
    });
  },

  getSupportInfoById: async (id: string) => {
    return prisma.supportInfo.findUnique({
      where: { id }
    });
  },

  createSupportInfo: async (data: {
    type: string;
    email?: string;
    mobileNumber?: string;
    whatsappNumber?: string;
    address?: string;
    operatingHours?: string;
    isActive?: boolean;
  }) => {
    return prisma.supportInfo.create({
      data
    });
  },

  updateSupportInfo: async (id: string, data: {
    type?: string;
    email?: string;
    mobileNumber?: string;
    whatsappNumber?: string;
    address?: string;
    operatingHours?: string;
    isActive?: boolean;
  }) => {
    return prisma.supportInfo.update({
      where: { id },
      data
    });
  },

  deleteSupportInfo: async (id: string) => {
    return prisma.supportInfo.delete({
      where: { id }
    });
  }
};
