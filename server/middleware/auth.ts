import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { UserRole } from '../models/User';

/**
 * Extended Request interface to include user information
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
  userId?: number;
}

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Token d\'accès requis'
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      res.status(500).json({
        success: false,
        message: 'Erreur de configuration du serveur'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Find user in database
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé ou inactif'
      });
      return;
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Token expiré'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Token invalide'
      });
      return;
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification'
    });
  }
};

/**
 * Authorization middleware factory
 * Creates middleware to check if user has required role(s)
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Permissions insuffisantes'
      });
      return;
    }

    next();
  };
};

/**
 * Admin only middleware
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Manager or Admin middleware
 */
export const requireManagerOrAdmin = requireRole(UserRole.MANAGER, UserRole.ADMIN);

/**
 * Any authenticated user middleware (already covered by authenticateToken)
 */
export const requireAuth = authenticateToken;

/**
 * Optional authentication middleware
 * Attaches user if token is present but doesn't fail if not
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    const user = await User.findByPk(decoded.userId);

    if (user && user.isActive) {
      req.user = user;
      req.userId = user.id;
    }

    next();
  } catch (error) {
    // Ignore errors in optional auth
    next();
  }
};

/**
 * Generate JWT token for user
 */
export const generateToken = (user: User): string => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, jwtSecret, {
    expiresIn: jwtExpiresIn
  } as jwt.SignOptions);
};

/**
 * Refresh token middleware
 * Generates a new token if the current one is close to expiry
 */
export const refreshTokenIfNeeded = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || !req.user) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.decode(token) as JWTPayload;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;

    // If token expires in less than 1 hour, generate a new one
    if (timeUntilExpiry < 3600) {
      const newToken = generateToken(req.user);
      res.setHeader('X-New-Token', newToken);
    }

    next();
  } catch (error) {
    // Don't fail the request if refresh fails
    next();
  }
};

/**
 * Rate limiting for authentication endpoints
 */
export const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
};

export default {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireManagerOrAdmin,
  requireAuth,
  optionalAuth,
  generateToken,
  refreshTokenIfNeeded,
  authRateLimit
};
