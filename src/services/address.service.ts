import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { CreateAddressDto, UpdateAddressDto } from '../types/address';

export class AddressService {
  static async createAddress(userId: string, data: CreateAddressDto) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user || !user.profile) throw { statusCode: 404, message: 'User profile not found' } as AppError;
    const userProfileId = user.profile.id;

    // If this is set as default, unset other default addresses
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userProfileId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userProfileId,
        flatHouse: data.flatHouse,
        areaStreet: data.areaStreet,
        landmark: data.landmark,
        pincode: data.pincode,
        townCity: data.townCity,
        state: data.state,
        deliveryInstructions: data.deliveryInstructions,
        isDefault: data.isDefault || false,
      },
    });

    return address;
  }

  static async updateAddress(addressId: string, userId: string, data: UpdateAddressDto) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user || !user.profile) throw { statusCode: 404, message: 'User profile not found' } as AppError;
    const userProfileId = user.profile.id;

    // Check if address exists and belongs to user
    const address = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userProfileId !== userProfileId) {
      throw { statusCode: 404, message: 'Address not found' } as AppError;
    }

    // If this is set as default, unset other default addresses
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userProfileId, isDefault: true, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (data.flatHouse) updateData.flatHouse = data.flatHouse;
    if (data.areaStreet) updateData.areaStreet = data.areaStreet;
    if (data.landmark !== undefined) updateData.landmark = data.landmark;
    if (data.pincode) updateData.pincode = data.pincode;
    if (data.townCity) updateData.townCity = data.townCity;
    if (data.state) updateData.state = data.state;
    if (data.deliveryInstructions !== undefined) updateData.deliveryInstructions = data.deliveryInstructions;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    const updatedAddress = await prisma.address.update({
      where: { id: addressId },
      data: updateData,
    });

    return updatedAddress;
  }

  static async deleteAddress(addressId: string, userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user || !user.profile) throw { statusCode: 404, message: 'User profile not found' } as AppError;
    const userProfileId = user.profile.id;

    // Check if address exists and belongs to user
    const address = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address || address.userProfileId !== userProfileId) {
      throw { statusCode: 404, message: 'Address not found' } as AppError;
    }

    await prisma.address.delete({
      where: { id: addressId },
    });

    // If the deleted address was the default one, make the most recently created one default
    if (address.isDefault) {
      const latestAddress = await prisma.address.findFirst({
        where: { userProfileId },
        orderBy: { createdAt: 'desc' },
      });

      if (latestAddress) {
        await prisma.address.update({
          where: { id: latestAddress.id },
          data: { isDefault: true },
        });
      }
    }


    return { success: true };
  }

  static async getAddresses(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user || !user.profile) throw { statusCode: 404, message: 'User profile not found' } as AppError;
    const userProfileId = user.profile.id;

    const addresses = await prisma.address.findMany({
      where: { userProfileId },
      orderBy: { isDefault: 'desc' },
    });

    // Attach user info to each address for the frontend
    return addresses.map((addr) => ({
      ...addr,
      userName: `${user.firstName} ${user.lastName}`.trim(),
      userPhone: user.profile!.phone || '',
    }));
  }
}
