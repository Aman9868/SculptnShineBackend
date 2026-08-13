import { Router } from 'express';
import { AddressController } from '../controllers/address.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { createAddressSchema, updateAddressSchema } from '../validators/address.validator';

const router = Router();

// Protect all address routes
router.use(authenticate);

// Get all addresses for user
router.get('/', AddressController.getAddresses);

// Create address
router.post('/', validate(createAddressSchema), AddressController.createAddress);

// Update address
router.put('/:addressId', validate(updateAddressSchema), AddressController.updateAddress);

// Delete address
router.delete('/:addressId', AddressController.deleteAddress);

export default router;
