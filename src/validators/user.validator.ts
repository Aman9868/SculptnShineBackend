import { z } from 'zod';

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().optional(),
    role: z.enum(['ADMIN', 'USER']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    profileImage: z.string().optional(),
    webPushNotifications: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    whatsappNotifications: z.boolean().optional(),
  }).strict(),
});

export const adminCreateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, 'First name is required'),
    lastName: z.string().min(2, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    role: z.enum(['ADMIN', 'USER']),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }).strict(),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }).strict(),
});
