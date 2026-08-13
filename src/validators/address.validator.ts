import { z } from 'zod';

export const createAddressSchema = z.object({
  body: z.object({
    flatHouse: z.string().min(1, 'Flat/House number is required'),
    areaStreet: z.string().min(1, 'Area/Street is required'),
    landmark: z.string().optional(),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    townCity: z.string().min(1, 'Town/City is required'),
    state: z.string().min(1, 'State is required'),
    deliveryInstructions: z.string().optional(),
    isDefault: z.boolean().optional().default(false),
  }),
});

export const updateAddressSchema = z.object({
  body: z.object({
    flatHouse: z.string().min(1, 'Flat/House number is required').optional(),
    areaStreet: z.string().min(1, 'Area/Street is required').optional(),
    landmark: z.string().optional(),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional(),
    townCity: z.string().min(1, 'Town/City is required').optional(),
    state: z.string().min(1, 'State is required').optional(),
    deliveryInstructions: z.string().optional(),
    isDefault: z.boolean().optional(),
  }),
});
