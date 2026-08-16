import jwt from 'jsonwebtoken';

export type JwtRole = 'ADMIN' | 'USER';

export interface AccessTokenPayload {
  userId: string;
  role: JwtRole;
  email?: string;
}

export interface DecodedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
}

export interface DecodedRefreshToken extends AccessTokenPayload {
  tokenType: 'refresh';
  iat: number;
  exp: number;
}

const getEnv = (key: string, fallback: string) => process.env[key] || fallback;

export const jwtConfig = {
  accessSecret: getEnv('JWT_SECRET', 'secret'),
  accessExpiresIn: getEnv('JWT_EXPIRES_IN', '24h') as jwt.SignOptions['expiresIn'],
  refreshSecret: getEnv('JWT_REFRESH_SECRET', getEnv('JWT_SECRET', 'secret')),
  refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '30d') as jwt.SignOptions['expiresIn'],
  adminSecret: getEnv('JWT_ADMIN_SECRET', getEnv('JWT_SECRET', 'secret')),
};

export const getAccessTokenSecret = (role?: string) => {
  return role === 'ADMIN' ? jwtConfig.adminSecret : jwtConfig.accessSecret;
};

export const signAccessToken = (payload: AccessTokenPayload) => {
  return jwt.sign(payload, getAccessTokenSecret(payload.role), {
    expiresIn: jwtConfig.accessExpiresIn,
  });
};

export const signRefreshToken = (payload: AccessTokenPayload) => {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpiresIn,
  });
};
