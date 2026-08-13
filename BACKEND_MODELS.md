# Backend Models & APIs Documentation

## Database Models

### 1. User Model

Extended user model with profile and address management fields.

#### Fields:
- `id` (string): UUID - Primary key
- `email` (string): Unique email address
- `passwordHash` (string): Bcrypt hashed password
- `firstName` (string): User's first name
- `lastName` (string): User's last name
- `profileImage` (string, optional): URL to profile picture
- `refreshToken` (string, optional): JWT refresh token
- `role` (enum: USER | ADMIN): User role (default: USER)
- `phone` (string, optional): Phone number
- `dateOfBirth` (DateTime, optional): User's date of birth
- `gender` (enum, optional): User's gender
- `bio` (string, optional): User's bio/about section
- `isCreatedByAdmin` (boolean): Was user created by admin (default: false)
- `status` (enum: ACTIVE | INACTIVE): Account status (default: ACTIVE)
- `createdAt` (DateTime): Account creation timestamp
- `updatedAt` (DateTime): Last update timestamp

#### Relations:
- `auditLogs`: One-to-many (User has many AuditLogs)
- `cart`: One-to-one (User has one Cart)
- `orders`: One-to-many (User has many Orders)
- `addresses`: One-to-many (User has many Addresses)

---

### 2. Address Model

Stores user's delivery addresses with support for multiple addresses per user.

#### Fields:
- `id` (string): UUID - Primary key
- `userId` (string): Foreign key to User
- `flatHouse` (string): Flat, House no., Building, Company, or Apartment
- `areaStreet` (string): Area, Street, Sector, or Village
- `landmark` (string, optional): Nearby landmark reference
- `pincode` (string): 6-digit postal code
- `townCity` (string): Town or city name
- `state` (string): State or province name
- `deliveryInstructions` (string, optional): Special instructions for delivery
- `isDefault` (boolean): Is this the default address (default: false)
- `createdAt` (DateTime): Address creation timestamp
- `updatedAt` (DateTime): Last update timestamp

#### Relations:
- `user`: Many-to-one (Address belongs to User)

#### Constraints:
- One default address per user (automatically managed by service)
- Cascade delete when user is deleted

---

### 3. Gender Enum

User's gender preference.

```prisma
enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}
```

---

## API Endpoints

### Authentication Endpoints

#### 1. Register User
```
POST /api/auth/register
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "uuid",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 2. Login
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User logged in successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "status": "ACTIVE"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

---

#### 3. Refresh Token
```
POST /api/auth/refresh-token
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

---

#### 4. Logout
```
POST /api/auth/logout
```

**Request Body:**
```json
{
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### 5. Update Profile
```
PUT /api/auth/update-profile/:userId
```

**Request Body:**
```json
{
  "firstName": "Jonathan",
  "lastName": "Doe",
  "email": "jonathan@example.com",
  "phone": "+1234567890",
  "dateOfBirth": "1990-01-01T00:00:00Z",
  "gender": "MALE",
  "bio": "Software developer and tech enthusiast",
  "profileImage": "https://example.com/image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid",
    "email": "jonathan@example.com",
    "firstName": "Jonathan",
    "lastName": "Doe",
    "phone": "+1234567890",
    "dateOfBirth": "1990-01-01T00:00:00Z",
    "gender": "MALE",
    "bio": "Software developer and tech enthusiast",
    "profileImage": "https://example.com/image.jpg",
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

---

### Address Endpoints

#### 1. Create Address
```
POST /api/addresses/:userId/addresses
```

**Request Body:**
```json
{
  "flatHouse": "Flat 101, Tower A",
  "areaStreet": "MG Road, Sector 5",
  "landmark": "Near Apollo Hospital",
  "pincode": "560001",
  "townCity": "Bangalore",
  "state": "Karnataka",
  "deliveryInstructions": "Ring doorbell twice",
  "isDefault": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Address created successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "flatHouse": "Flat 101, Tower A",
    "areaStreet": "MG Road, Sector 5",
    "landmark": "Near Apollo Hospital",
    "pincode": "560001",
    "townCity": "Bangalore",
    "state": "Karnataka",
    "deliveryInstructions": "Ring doorbell twice",
    "isDefault": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 2. Get All Addresses for User
```
GET /api/addresses/:userId/addresses
```

**Response:**
```json
{
  "success": true,
  "message": "Addresses retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "flatHouse": "Flat 101, Tower A",
      "areaStreet": "MG Road, Sector 5",
      "landmark": "Near Apollo Hospital",
      "pincode": "560001",
      "townCity": "Bangalore",
      "state": "Karnataka",
      "deliveryInstructions": "Ring doorbell twice",
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### 3. Get Address by ID
```
GET /api/addresses/:userId/addresses/:addressId
```

**Response:**
```json
{
  "success": true,
  "message": "Address retrieved successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "flatHouse": "Flat 101, Tower A",
    "areaStreet": "MG Road, Sector 5",
    "landmark": "Near Apollo Hospital",
    "pincode": "560001",
    "townCity": "Bangalore",
    "state": "Karnataka",
    "deliveryInstructions": "Ring doorbell twice",
    "isDefault": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 4. Update Address
```
PUT /api/addresses/:userId/addresses/:addressId
```

**Request Body:**
```json
{
  "flatHouse": "Flat 102, Tower A",
  "townCity": "Bangalore",
  "isDefault": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Address updated successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "flatHouse": "Flat 102, Tower A",
    "areaStreet": "MG Road, Sector 5",
    "landmark": "Near Apollo Hospital",
    "pincode": "560001",
    "townCity": "Bangalore",
    "state": "Karnataka",
    "deliveryInstructions": "Ring doorbell twice",
    "isDefault": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 5. Delete Address
```
DELETE /api/addresses/:userId/addresses/:addressId
```

**Response:**
```json
{
  "success": true,
  "message": "Address deleted successfully"
}
```

---

## Input Validation Schemas

### Gender Enum Values
```
MALE
FEMALE
OTHER
PREFER_NOT_TO_SAY
```

### Address Validation Rules
- **flatHouse**: Required, minimum 1 character
- **areaStreet**: Required, minimum 1 character
- **landmark**: Optional string
- **pincode**: Required, must be exactly 6 digits
- **townCity**: Required, minimum 1 character
- **state**: Required, minimum 1 character
- **deliveryInstructions**: Optional string
- **isDefault**: Optional boolean (default: false)

### Profile Update Validation Rules
- **firstName**: Optional, minimum 2 characters
- **lastName**: Optional, minimum 2 characters
- **email**: Optional, must be valid email
- **phone**: Optional string
- **dateOfBirth**: Optional ISO DateTime string
- **gender**: Optional, must be one of: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
- **bio**: Optional, maximum 500 characters
- **profileImage**: Optional string (URL or base64)

---

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad request / Validation error
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not found
- `409`: Conflict (e.g., email already exists)
- `500`: Internal server error

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "detailed error info (in development)"
}
```

---

## Business Rules

### Address Management
1. Users can have multiple addresses
2. Only one address can be marked as default
3. When setting a new default address, the previous default is automatically unset
4. If the default address is deleted, the oldest remaining address becomes default
5. Addresses are permanently associated with a user (cascade delete)

### Profile Management
1. Email must be unique across all users
2. Password is hashed using bcrypt (10 salt rounds)
3. Profile image can be uploaded as URL or base64 string
4. Bio is limited to 500 characters
5. All profile fields are optional except email and names

### Gender Field
1. Optional field with 4 predefined values
2. Supports "Prefer not to say" option for privacy
3. Can be updated via profile endpoint

---

## Database Relationships

```
User (1) ─── (n) Address
User (1) ─── (n) Order
User (1) ─── (1) Cart
User (1) ─── (n) AuditLog
```

---

## Migration Steps

To apply these schema changes to your database:

```bash
# Generate migration
npx prisma migrate dev --name add_profile_and_address_fields

# Or apply directly (development only)
npx prisma db push
```

Then update the Prisma client:
```bash
npx prisma generate
```

---

## Testing Endpoints

### Create Address
```bash
curl -X POST http://localhost:5000/api/addresses/{userId}/addresses \
  -H "Content-Type: application/json" \
  -d '{
    "flatHouse": "Flat 101, Tower A",
    "areaStreet": "MG Road, Sector 5",
    "landmark": "Near Apollo Hospital",
    "pincode": "560001",
    "townCity": "Bangalore",
    "state": "Karnataka",
    "isDefault": true
  }'
```

### Update Profile
```bash
curl -X PUT http://localhost:5000/api/auth/update-profile/{userId} \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jonathan",
    "gender": "MALE",
    "bio": "Software developer"
  }'
```

---
