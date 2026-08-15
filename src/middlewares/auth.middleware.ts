import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DecodedAccessToken, getAccessTokenSecret } from '../config/jwt.config';
import { setRequestUserId } from '../config/request-context';

// Extend Express Request object to include user
declare global {
  namespace Express {
    interface Request {
      user?: DecodedAccessToken;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const unverifiedPayload = jwt.decode(token);

    if (!unverifiedPayload || typeof unverifiedPayload === 'string') {
      return res.status(401).json({ success: false, message: 'Token is not valid' });
    }

    const secret = getAccessTokenSecret(unverifiedPayload.role);
    const decoded = jwt.verify(token, secret) as DecodedAccessToken;

    // Fallback for older tokens that used 'id' instead of 'userId'
    if (!decoded.userId && (decoded as any).id) {
      decoded.userId = (decoded as any).id;
    }

    req.user = decoded;
    setRequestUserId(decoded.userId);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token is not valid' });
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: You do not have the required permissions'
      });
    }
    next();
  };
};
