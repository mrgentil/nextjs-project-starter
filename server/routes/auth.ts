import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import User, { UserRole } from '../models/User';
import Employee from '../models/Employee';
import { generateToken, AuthenticatedRequest, requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Rate limiting for auth routes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/auth/login
 * @desc User login
 * @access Public
 */
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
      return;
    }

    // Find user
    const user = await User.findOne({
      where: { email: email.toLowerCase() },
      include: [
        {
          model: Employee,
          as: 'employeeProfile',
          required: false
        }
      ]
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Compte désactivé'
      });
      return;
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
      return;
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token
    const token = generateToken(user);

    // Get employee profile if exists
    const employeeProfile = (user as any).employeeProfile;

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          lastLogin: user.lastLogin,
          employeeProfile: employeeProfile ? {
            id: employeeProfile.id,
            employeeNumber: employeeProfile.employeeNumber,
            poste: employeeProfile.poste,
            service: employeeProfile.service
          } : null
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

/**
 * @route POST /api/auth/register
 * @desc Register new user (Admin only)
 * @access Private (Admin)
 */
router.post('/register', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check if user is admin
    if (!req.user?.isAdmin()) {
      res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
      return;
    }

    const {
      username,
      email,
      password,
      firstName,
      lastName,
      role = UserRole.EMPLOYEE
    } = req.body;

    // Validation
    if (!username || !email || !password || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires doivent être remplis'
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'Un utilisateur avec cet email ou nom d\'utilisateur existe déjà'
      });
      return;
    }

    // Create user
    const newUser = await User.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role
    });

    res.status(201).json({
      success: true,
      message: 'Utilisateur créé avec succès',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          fullName: newUser.fullName,
          role: newUser.role,
          isActive: newUser.isActive
        }
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.name === 'SequelizeValidationError') {
      res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.errors.map((err: any) => err.message)
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user profile
 * @access Private
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findByPk(req.userId, {
      include: [
        {
          model: Employee,
          as: 'employeeProfile',
          required: false
        }
      ]
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    const employeeProfile = (user as any).employeeProfile;

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          employeeProfile: employeeProfile ? {
            id: employeeProfile.id,
            employeeNumber: employeeProfile.employeeNumber,
            poste: employeeProfile.poste,
            service: employeeProfile.service,
            salaire: employeeProfile.salaire,
            typeContrat: employeeProfile.typeContrat,
            statut: employeeProfile.statut
          } : null
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

/**
 * @route PUT /api/auth/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/profile', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email } = req.body;

    const user = await User.findByPk(req.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        where: {
          email: email.toLowerCase(),
          id: { [require('sequelize').Op.ne]: user.id }
        }
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'Cet email est déjà utilisé par un autre utilisateur'
        });
        return;
      }
    }

    // Update user
    await user.update({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email ? email.toLowerCase() : user.email
    });

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          role: user.role
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

/**
 * @route PUT /api/auth/password
 * @desc Change user password
 * @access Private
 */
router.put('/password', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Mot de passe actuel et nouveau mot de passe requis'
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
      });
      return;
    }

    const user = await User.findByPk(req.userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
      return;
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
      return;
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc User logout (client-side token removal)
 * @access Private
 */
router.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // In a JWT-based system, logout is typically handled client-side
    // by removing the token. Here we just confirm the logout.
    
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
});

export default router;
