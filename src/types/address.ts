export interface Address {
  id: string;
  userId: string;
  flatHouse: string;
  areaStreet: string;
  landmark?: string | null;
  pincode: string;
  townCity: string;
  state: string;
  deliveryInstructions?: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAddressDto {
  flatHouse: string;
  areaStreet: string;
  landmark?: string;
  pincode: string;
  townCity: string;
  state: string;
  deliveryInstructions?: string;
  isDefault?: boolean;
}

export interface UpdateAddressDto {
  flatHouse?: string;
  areaStreet?: string;
  landmark?: string;
  pincode?: string;
  townCity?: string;
  state?: string;
  deliveryInstructions?: string;
  isDefault?: boolean;
}
