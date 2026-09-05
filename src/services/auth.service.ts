import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { DbLoggerService } from './db-logger.service';
import {
  DecodedRefreshToken,
  jwtConfig,
  signAccessToken,
  signRefreshToken,
} from '../config/jwt.config';

const formatUserResponse = (user: any) => {
  const { passwordHash, refreshToken, profile, ...rest } = user;
  return {
    ...rest,
    profileImage: profile?.profileImage,
    phone: profile?.phone,
    dateOfBirth: profile?.dateOfBirth,
    gender: profile?.gender,
    bio: profile?.bio,
    addresses: profile?.addresses || [],
    orders: profile?.orders || [],
    cart: profile?.cart || null,
    webPushNotifications: profile?.webPushNotifications ?? true,
    emailNotifications: profile?.emailNotifications ?? true,
    smsNotifications: profile?.smsNotifications ?? false,
    whatsappNotifications: profile?.whatsappNotifications ?? false,
  };
};

export class AuthService {
  static async register(data: any) {
    const { email, password, firstName, lastName } = data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw { statusCode: 409, message: 'User with this email already exists' } as AppError;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user with empty profile
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        profile: {
          create: {}
        }
      },
      include: {
        profile: true
      }
    });

    const payload = {
      userId: newUser.id,
      role: newUser.role,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Save Refresh Token to DB
    await prisma.user.update({
      where: { id: newUser.id },
      data: { refreshToken },
    });

    const formattedUser = formatUserResponse(newUser);

    DbLoggerService.logAuth('USER_REGISTERED', newUser.id, newUser.email, 'SUCCESS', {
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    });

    return {
      user: formattedUser,
      accessToken,
      refreshToken,
    };
  }

  static async login(data: any) {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: {
          include: { addresses: true, orders: true, cart: true }
        }
      }
    });

    if (!user) {
      DbLoggerService.logAuth('LOGIN_FAILED', undefined, email, 'FAILED', { reason: 'User not found' });
      throw { statusCode: 401, message: 'Invalid email or password' } as AppError;
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      DbLoggerService.logAuth('LOGIN_FAILED', user.id, email, 'FAILED', { reason: 'Incorrect password' });
      throw { statusCode: 401, message: 'Invalid email or password' } as AppError;
    }

    const payload = {
      userId: user.id,
      role: user.role,
      email: user.email,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Save Refresh Token to DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    const formattedUser = formatUserResponse(user);

    DbLoggerService.logAuth(user.role === 'ADMIN' ? 'ADMIN_LOGIN' : 'USER_LOGIN', user.id, user.email, 'SUCCESS');

    return {
      user: formattedUser,
      accessToken,
      refreshToken,
    };
  }

  static async refreshToken(token: string) {
    if (!token) {
      throw { statusCode: 401, message: 'Refresh token is required' } as AppError;
    }

    let decoded: DecodedRefreshToken;

    try {
      decoded = jwt.verify(token, jwtConfig.refreshSecret) as DecodedRefreshToken;
    } catch (error) {
      throw { statusCode: 403, message: 'Invalid refresh token' } as AppError;
    }

    if (decoded.tokenType !== 'refresh') {
      throw { statusCode: 403, message: 'Invalid refresh token' } as AppError;
    }

    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        refreshToken: token,
      },
    });

    if (!user) {
      throw { statusCode: 403, message: 'Invalid refresh token' } as AppError;
    }

    const payload = {
      userId: user.id,
      role: user.role,
    };
    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(userId: string) {
    await prisma.user.updateMany({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { success: true };
  }

  static async updateProfile(userId: string, data: any) {
    // Check if email is already taken (if email is being updated)
    if (data.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser && existingUser.id !== userId) {
        throw { statusCode: 409, message: 'Email is already in use' } as AppError;
      }
    }

    // Prepare update data
    const userUpdate: any = {};
    if (data.firstName) userUpdate.firstName = data.firstName;
    if (data.lastName) userUpdate.lastName = data.lastName;
    if (data.email) userUpdate.email = data.email;

    const profileUpdate: any = {};
    if (data.phone !== undefined) profileUpdate.phone = data.phone;
    if (data.dateOfBirth !== undefined) profileUpdate.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.gender !== undefined) profileUpdate.gender = data.gender;
    if (data.bio !== undefined) profileUpdate.bio = data.bio;
    if (data.profileImage !== undefined) profileUpdate.profileImage = data.profileImage;
    if (data.webPushNotifications !== undefined) profileUpdate.webPushNotifications = data.webPushNotifications;
    if (data.emailNotifications !== undefined) profileUpdate.emailNotifications = data.emailNotifications;
    if (data.smsNotifications !== undefined) profileUpdate.smsNotifications = data.smsNotifications;
    if (data.whatsappNotifications !== undefined) profileUpdate.whatsappNotifications = data.whatsappNotifications;

    // Update user and profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...userUpdate,
        profile: {
          upsert: {
            create: profileUpdate,
            update: profileUpdate,
          },
        },
      },
      include: {
        profile: {
          include: { addresses: true, orders: true, cart: true }
        }
      },
    });

    // Remove password hash from response
    return formatUserResponse(updatedUser);
  }

  static async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found' } as AppError;
    }

    if (user.role === 'ADMIN') {
      throw { statusCode: 403, message: 'Admin accounts cannot be deleted directly' } as AppError;
    }

    const orderCount = user.profile
      ? await prisma.order.count({ where: { userProfileId: user.profile.id } })
      : 0;

    if (orderCount > 0) {
      throw {
        statusCode: 409,
        message: 'This account cannot be deleted because it has order history. Please contact support to request data removal.',
      } as AppError;
    }

    // Users without orders can be removed safely through the configured cascades.
    await prisma.user.delete({
      where: { id: userId },
    });

    return { success: true, message: 'Account and profile deleted successfully' };
  }
}
