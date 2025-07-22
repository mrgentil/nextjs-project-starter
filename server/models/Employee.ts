import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

/**
 * Contract types enum
 */
export enum ContractType {
  CDI = 'CDI', // Contrat à Durée Indéterminée
  CDD = 'CDD', // Contrat à Durée Déterminée
  STAGE = 'STAGE', // Stage
  FREELANCE = 'FREELANCE', // Freelance
  INTERIM = 'INTERIM' // Intérim
}

/**
 * Employee status enum
 */
export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
  TERMINATED = 'terminated'
}

/**
 * Employee attributes interface
 */
export interface EmployeeAttributes {
  id: number;
  userId?: number; // Foreign key to User table (optional for employees who don't have login access)
  employeeNumber: string; // Unique employee identifier
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse?: string;
  dateNaissance?: Date;
  dateEmbauche: Date;
  poste: string;
  service: string;
  salaire: number;
  typeContrat: ContractType;
  statut: EmployeeStatus;
  managerId?: number; // Foreign key to another Employee (manager)
  numeroSecuriteSociale?: string;
  iban?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Employee creation attributes
 */
export interface EmployeeCreationAttributes extends Optional<EmployeeAttributes, 'id' | 'userId' | 'adresse' | 'dateNaissance' | 'managerId' | 'numeroSecuriteSociale' | 'iban' | 'notes' | 'createdAt' | 'updatedAt'> {}

/**
 * Employee model class
 */
class Employee extends Model<EmployeeAttributes, EmployeeCreationAttributes> implements EmployeeAttributes {
  public id!: number;
  public userId?: number;
  public employeeNumber!: string;
  public nom!: string;
  public prenom!: string;
  public email!: string;
  public telephone!: string;
  public adresse?: string;
  public dateNaissance?: Date;
  public dateEmbauche!: Date;
  public poste!: string;
  public service!: string;
  public salaire!: number;
  public typeContrat!: ContractType;
  public statut!: EmployeeStatus;
  public managerId?: number;
  public numeroSecuriteSociale?: string;
  public iban?: string;
  public notes?: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Get full name
   */
  public get fullName(): string {
    return `${this.prenom} ${this.nom}`;
  }

  /**
   * Get formatted salary
   */
  public get formattedSalary(): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(this.salaire);
  }

  /**
   * Calculate years of service
   */
  public get yearsOfService(): number {
    const today = new Date();
    const hireDate = new Date(this.dateEmbauche);
    return Math.floor((today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  }

  /**
   * Check if employee is active
   */
  public isActive(): boolean {
    return this.statut === EmployeeStatus.ACTIVE;
  }

  /**
   * Check if employee is on leave
   */
  public isOnLeave(): boolean {
    return this.statut === EmployeeStatus.ON_LEAVE;
  }

  /**
   * Generate unique employee number
   */
  public static generateEmployeeNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `EMP${year}${random}`;
  }
}

/**
 * Initialize Employee model
 */
Employee.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    employeeNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    nom: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [2, 50],
        notEmpty: true,
      },
    },
    prenom: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        len: [2, 50],
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
    telephone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    adresse: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    dateNaissance: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
        isBefore: new Date().toISOString().split('T')[0], // Must be before today
      },
    },
    dateEmbauche: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        notEmpty: true,
      },
    },
    poste: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true,
      },
    },
    service: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true,
      },
    },
    salaire: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    typeContrat: {
      type: DataTypes.ENUM(...Object.values(ContractType)),
      allowNull: false,
      defaultValue: ContractType.CDI,
    },
    statut: {
      type: DataTypes.ENUM(...Object.values(EmployeeStatus)),
      allowNull: false,
      defaultValue: EmployeeStatus.ACTIVE,
    },
    managerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'employees',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    numeroSecuriteSociale: {
      type: DataTypes.STRING(15),
      allowNull: true,
      unique: true,
      validate: {
        len: [13, 15],
      },
    },
    iban: {
      type: DataTypes.STRING(34),
      allowNull: true,
      validate: {
        len: [15, 34],
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Employee',
    tableName: 'employees',
    timestamps: true,
    hooks: {
      beforeCreate: async (employee: Employee) => {
        if (!employee.employeeNumber) {
          employee.employeeNumber = Employee.generateEmployeeNumber();
        }
      },
    },
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
      {
        unique: true,
        fields: ['employeeNumber'],
      },
      {
        fields: ['service'],
      },
      {
        fields: ['poste'],
      },
      {
        fields: ['statut'],
      },
      {
        fields: ['typeContrat'],
      },
      {
        fields: ['managerId'],
      },
    ],
  }
);

export default Employee;
