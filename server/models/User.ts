import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import bcrypt from 'bcryptjs';

/**
 * User roles enum
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee'
}

/**
 * User attributes interface
 */
export interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User creation attributes (optional fields for creation)
 */
export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'isActive' | 'lastLogin' | 'createdAt' | 'updatedAt'> {}

/**
 * User model class
 */
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public role!: UserRole;
  public firstName!: string;
  public lastName!: string;
  public isActive!: boolean;
  public lastLogin?: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Hash password before saving
   */
  public async hashPassword(): Promise<void> {
    if (this.changed('password')) {
      const saltRounds = 12;
      this.password = await bcrypt.hash(this.password, saltRounds);
    }
  }

  /**
   * Compare password with hash
   */
  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }

  /**
   * Get full name
   */
  public get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  /**
   * Check if user has specific role
   */
  public hasRole(role: UserRole): boolean {
    return this.role === role;
  }

  /**
   * Check if user is admin
   */
  public isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  /**
   * Check if user is manager
   */
  public isManager(): boolean {
    return this.role === UserRole.MANAGER;
  }

  /**
   * Update last login timestamp
   */
  public async updateLastLogin(): Promise<void> {
    this.lastLogin = new Date();
    await this.save();
  }
}

/**
 * Initialize User model
 */
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [6, 255],
        notEmpty: true,
      },
    },
    role: {
      type: DataTypes.ENUM(...Object.values(UserRole)),
      allowNull: false,
      defaultValue: UserRole.EMPLOYEE,
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [2, 50],
        notEmpty: true,
      },
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [2, 50],
        notEmpty: true,
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeSave: async (user: User) => {
        await user.hashPassword();
      },
    },
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
      {
        unique: true,
        fields: ['username'],
      },
      {
        fields: ['role'],
      },
    ],
  }
);

export default User;
