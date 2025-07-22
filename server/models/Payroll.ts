import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

/**
 * Payroll status enum
 */
export enum PayrollStatus {
  DRAFT = 'draft', // Brouillon
  CALCULATED = 'calculated', // Calculé
  VALIDATED = 'validated', // Validé
  PAID = 'paid' // Payé
}

/**
 * Payroll attributes interface
 */
export interface PayrollAttributes {
  id: number;
  employeeId: number;
  period: string; // Format: YYYY-MM (ex: 2024-01)
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  
  // Deductions
  socialSecurityDeduction: number;
  taxDeduction: number;
  otherDeductions: number;
  
  // Bonuses and allowances
  bonuses: number;
  allowances: number;
  overtime: number;
  
  // Leave calculations
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  sickLeaveDays: number;
  
  // Working days
  workingDays: number;
  actualWorkingDays: number;
  
  status: PayrollStatus;
  calculatedAt?: Date;
  validatedAt?: Date;
  validatedBy?: number;
  paidAt?: Date;
  
  // PDF generation
  pdfPath?: string;
  pdfGeneratedAt?: Date;
  
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Payroll creation attributes
 */
export interface PayrollCreationAttributes extends Optional<PayrollAttributes, 'id' | 'grossSalary' | 'netSalary' | 'socialSecurityDeduction' | 'taxDeduction' | 'otherDeductions' | 'bonuses' | 'allowances' | 'overtime' | 'paidLeaveDays' | 'unpaidLeaveDays' | 'sickLeaveDays' | 'actualWorkingDays' | 'status' | 'calculatedAt' | 'validatedAt' | 'validatedBy' | 'paidAt' | 'pdfPath' | 'pdfGeneratedAt' | 'notes' | 'createdAt' | 'updatedAt'> {}

/**
 * Payroll model class
 */
class Payroll extends Model<PayrollAttributes, PayrollCreationAttributes> implements PayrollAttributes {
  public id!: number;
  public employeeId!: number;
  public period!: string;
  public baseSalary!: number;
  public grossSalary!: number;
  public netSalary!: number;
  
  // Deductions
  public socialSecurityDeduction!: number;
  public taxDeduction!: number;
  public otherDeductions!: number;
  
  // Bonuses and allowances
  public bonuses!: number;
  public allowances!: number;
  public overtime!: number;
  
  // Leave calculations
  public paidLeaveDays!: number;
  public unpaidLeaveDays!: number;
  public sickLeaveDays!: number;
  
  // Working days
  public workingDays!: number;
  public actualWorkingDays!: number;
  
  public status!: PayrollStatus;
  public calculatedAt?: Date;
  public validatedAt?: Date;
  public validatedBy?: number;
  public paidAt?: Date;
  
  // PDF generation
  public pdfPath?: string;
  public pdfGeneratedAt?: Date;
  
  public notes?: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Calculate gross salary based on base salary and adjustments
   */
  public calculateGrossSalary(): number {
    const dailyRate = this.baseSalary / this.workingDays;
    const unpaidDeduction = dailyRate * this.unpaidLeaveDays;
    
    this.grossSalary = this.baseSalary - unpaidDeduction + this.bonuses + this.allowances + this.overtime;
    return this.grossSalary;
  }

  /**
   * Calculate social security deduction (approximately 23% in France)
   */
  public calculateSocialSecurityDeduction(): number {
    this.socialSecurityDeduction = this.grossSalary * 0.23;
    return this.socialSecurityDeduction;
  }

  /**
   * Calculate tax deduction (simplified calculation)
   */
  public calculateTaxDeduction(): number {
    // Simplified tax calculation - in reality this would be much more complex
    if (this.grossSalary <= 1500) {
      this.taxDeduction = 0;
    } else if (this.grossSalary <= 3000) {
      this.taxDeduction = (this.grossSalary - 1500) * 0.11;
    } else if (this.grossSalary <= 5000) {
      this.taxDeduction = 1500 * 0.11 + (this.grossSalary - 3000) * 0.30;
    } else {
      this.taxDeduction = 1500 * 0.11 + 2000 * 0.30 + (this.grossSalary - 5000) * 0.41;
    }
    
    return this.taxDeduction;
  }

  /**
   * Calculate net salary
   */
  public calculateNetSalary(): number {
    this.netSalary = this.grossSalary - this.socialSecurityDeduction - this.taxDeduction - this.otherDeductions;
    return this.netSalary;
  }

  /**
   * Perform complete payroll calculation
   */
  public async calculatePayroll(): Promise<void> {
    this.calculateGrossSalary();
    this.calculateSocialSecurityDeduction();
    this.calculateTaxDeduction();
    this.calculateNetSalary();
    
    this.status = PayrollStatus.CALCULATED;
    this.calculatedAt = new Date();
    
    await this.save();
  }

  /**
   * Validate payroll
   */
  public async validatePayroll(validatorId: number): Promise<void> {
    if (this.status !== PayrollStatus.CALCULATED) {
      throw new Error('Payroll must be calculated before validation');
    }
    
    this.status = PayrollStatus.VALIDATED;
    this.validatedAt = new Date();
    this.validatedBy = validatorId;
    
    await this.save();
  }

  /**
   * Mark payroll as paid
   */
  public async markAsPaid(): Promise<void> {
    if (this.status !== PayrollStatus.VALIDATED) {
      throw new Error('Payroll must be validated before marking as paid');
    }
    
    this.status = PayrollStatus.PAID;
    this.paidAt = new Date();
    
    await this.save();
  }

  /**
   * Get formatted period
   */
  public get formattedPeriod(): string {
    const [year, month] = this.period.split('-');
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  /**
   * Get formatted salary amounts
   */
  public get formattedBaseSalary(): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(this.baseSalary);
  }

  public get formattedGrossSalary(): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(this.grossSalary);
  }

  public get formattedNetSalary(): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(this.netSalary);
  }

  /**
   * Get status label in French
   */
  public get statusLabel(): string {
    const labels: Record<PayrollStatus, string> = {
      [PayrollStatus.DRAFT]: 'Brouillon',
      [PayrollStatus.CALCULATED]: 'Calculé',
      [PayrollStatus.VALIDATED]: 'Validé',
      [PayrollStatus.PAID]: 'Payé'
    };
    return labels[this.status];
  }

  /**
   * Check if payroll is editable
   */
  public isEditable(): boolean {
    return this.status === PayrollStatus.DRAFT || this.status === PayrollStatus.CALCULATED;
  }

  /**
   * Generate period string from date
   */
  public static generatePeriod(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get working days in a month
   */
  public static getWorkingDaysInMonth(year: number, month: number): number {
    const date = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    let workingDays = 0;

    for (let day = 1; day <= lastDay; day++) {
      date.setDate(day);
      const dayOfWeek = date.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    return workingDays;
  }
}

/**
 * Initialize Payroll model
 */
Payroll.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'employees',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    period: {
      type: DataTypes.STRING(7), // YYYY-MM format
      allowNull: false,
      validate: {
        is: /^\d{4}-\d{2}$/,
        notEmpty: true,
      },
    },
    baseSalary: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    grossSalary: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    netSalary: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    socialSecurityDeduction: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    taxDeduction: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    otherDeductions: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    bonuses: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    allowances: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    overtime: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isDecimal: true,
      },
    },
    paidLeaveDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true,
      },
    },
    unpaidLeaveDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true,
      },
    },
    sickLeaveDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true,
      },
    },
    workingDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 31,
        isInt: true,
      },
    },
    actualWorkingDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        isInt: true,
      },
    },
    status: {
      type: DataTypes.ENUM(...Object.values(PayrollStatus)),
      allowNull: false,
      defaultValue: PayrollStatus.DRAFT,
    },
    calculatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    validatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    validatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    pdfPath: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    pdfGeneratedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Payroll',
    tableName: 'payrolls',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['employeeId', 'period'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['period'],
      },
      {
        fields: ['validatedBy'],
      },
    ],
  }
);

export default Payroll;
