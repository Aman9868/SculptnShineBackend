import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/error.middleware';
import { AuditLogService } from './audit.service';

export class UserService {
  static async getAllUsers(page: number = 1, limit: number = 10, search?: string, role?: string) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (role && role !== 'All Users') {
      // Expecting 'ADMIN' or 'USER'
      where.role = role === 'Administrators' ? 'ADMIN' : 'USER';
    }
    
    if (search && search.trim()) {
      const trimmedSearch = search.trim();
      const digitsOnly = trimmedSearch.replace(/\D/g, '');
      
      const phoneQueries: any[] = [
        { profile: { phone: { contains: trimmedSearch, mode: 'insensitive' } } }
      ];

      if (digitsOnly.length >= 3) {
        phoneQueries.push({ profile: { phone: { contains: digitsOnly, mode: 'insensitive' } } });
        
        // If has 91 prefix and length > 10, strip 91
        const without91 = (digitsOnly.startsWith('91') && digitsOnly.length > 10) ? digitsOnly.slice(2) : digitsOnly;
        if (without91 !== digitsOnly) {
          phoneQueries.push({ profile: { phone: { contains: without91, mode: 'insensitive' } } });
        }

        // Handle formatted variations like "98765 43210" or "+91 98765 43210"
        if (without91.length === 10) {
          const split5 = `${without91.slice(0, 5)} ${without91.slice(5)}`;
          phoneQueries.push({ profile: { phone: { contains: split5, mode: 'insensitive' } } });
          phoneQueries.push({ profile: { phone: { contains: `+91 ${split5}`, mode: 'insensitive' } } });
          phoneQueries.push({ profile: { phone: { contains: `+91${without91}`, mode: 'insensitive' } } });
          phoneQueries.push({ profile: { phone: { contains: `+91 ${without91}`, mode: 'insensitive' } } });
        }
      }

      where.OR = [
        { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
        { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
        { email: { contains: trimmedSearch, mode: 'insensitive' } },
        ...phoneQueries,
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          profile: { select: { profileImage: true, phone: true } },
          role: true,
          isCreatedByAdmin: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const mappedUsers = users.map((u: any) => ({
      ...u,
      profileImage: u.profile?.profileImage,
      phone: u.profile?.phone,
      profile: undefined,
    }));

    return {
      users: mappedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getUserKPIs() {
    const [totalUsers, admins, customers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'USER' } }),
    ]);
    
    // For now, we mock 'Active Users' to be 95% of total users for demonstration, 
    // or just return the total users if you don't have a status field yet.
    const activeUsers = Math.floor(totalUsers * 0.95);

    return {
      totalUsers: { count: totalUsers, trend: 12.4 },
      administrators: { count: admins, trend: 9.1 },
      customers: { count: customers, trend: 14.3 },
      activeUsers: { count: activeUsers, trend: 8.7 },
    };
  }

  static async changeUserStatus(userId: string, status: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { status: status as any },
    });
  }

  static async exportUsers() {
    const users = await prisma.user.findMany({
      include: { profile: { select: { phone: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const fields = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Status', 'Created At'];
    const csvRows = [fields.join(',')];

    for (const u of users) {
      const row = [
        u.id,
        `"${u.firstName.replace(/"/g, '""')}"`,
        `"${u.lastName.replace(/"/g, '""')}"`,
        u.email,
        u.profile?.phone || '',
        u.role,
        u.status,
        u.createdAt.toISOString()
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isCreatedByAdmin: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          include: {
            addresses: {
              orderBy: { createdAt: 'desc' },
            },
            orders: {
              include: {
                items: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        title: true,
                        images: true,
                        sku: true,
                      },
                    },
                    variant: true,
                  },
                },
                payments: true,
              },
              orderBy: { createdAt: 'desc' },
            },
            cart: {
              include: {
                items: {
                  include: {
                    product: true,
                    variant: true,
                  },
                },
              },
            },
            integrations: true,
          },
        },
      },
    });

    if (!user) {
      throw { statusCode: 404, message: 'User not found' } as AppError;
    }

    const mappedUser = {
      ...user,
      profileImage: user.profile?.profileImage,
      phone: user.profile?.phone,
      dateOfBirth: user.profile?.dateOfBirth,
      gender: user.profile?.gender,
      bio: user.profile?.bio,
      addresses: user.profile?.addresses || [],
      orders: user.profile?.orders || [],
      cart: user.profile?.cart || null,
      webPushNotifications: user.profile?.webPushNotifications ?? true,
      emailNotifications: user.profile?.emailNotifications ?? true,
      smsNotifications: user.profile?.smsNotifications ?? false,
      whatsappNotifications: user.profile?.whatsappNotifications ?? false,
      integrations: user.profile?.integrations || [],
      profile: undefined
    };

    return mappedUser;
  }

  static async createUser(data: any) {
    const { password, ...userData } = data;
    
    const existingUser = await prisma.user.findUnique({ where: { email: userData.email } });
    if (existingUser) {
      throw { statusCode: 400, message: 'User with this email already exists' } as AppError;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        status: userData.status,
        passwordHash,
        isCreatedByAdmin: true,
        profile: {
          create: { phone: userData.phone },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        profile: { select: { phone: true } },
        isCreatedByAdmin: true,
        status: true,
        createdAt: true,
      },
    });

    await AuditLogService.log('Created User', 'User', 'admin', { createdUserId: newUser.id });
    
    return newUser;
  }

  static async updateUser(userId: string, data: any, reqUser: any) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw { statusCode: 404, message: 'User not found' } as AppError;
    }

    // Permission Check: Admin can only edit users they created, or themselves.
    const isSelf = reqUser.userId === userId;
    if (!isSelf && reqUser.role === 'ADMIN') {
      if (!user.isCreatedByAdmin) {
        throw { statusCode: 403, message: 'Forbidden: Cannot edit self-registered users' } as AppError;
      }
    }

    const { phone, profileImage, ...userUpdates } = data;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...userUpdates,
        profile: {
          upsert: {
            create: { phone, profileImage },
            update: { phone, profileImage },
          }
        }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profile: { select: { profileImage: true, phone: true } },
        role: true,
        isCreatedByAdmin: true,
        status: true,
        updatedAt: true,
      },
    });

    await AuditLogService.log('Updated Profile', 'User', reqUser.userId, {
      updatedFields: Object.keys(data),
      targetUserId: userId,
    });

    return updatedUser;
  }

  static async changePassword(userId: string, data: any) {
    const { currentPassword, newPassword } = data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw { statusCode: 404, message: 'User not found' } as AppError;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw { statusCode: 400, message: 'Incorrect current password' } as AppError;
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await AuditLogService.log('Changed Password', 'User', userId);

    return { success: true };
  }
}
