import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

/**
 * Leave types enum
 */
export enum LeaveType {
  CONGE_PAYE = 'conge_paye', // Congés payés
  MALADIE = 'maladie', // Congé maladie
  MATERNITE = 'maternite', // Congé maternité
  PATERNITE = 'paternite', // Congé paternité
  FORMATION = 'formation', // Congé formation
  SANS_SOLDE = 'sans_solde', // Congé sans solde
  RTT = 'rtt', // Réduction du temps de travail
  EXCEPTIONNEL = 'exceptionnel' // Congé exceptionnel
}

/**
 * Leave request status enum
 */
export enum LeaveStatus {
  PENDING = 'pending', // En attente
  APPROVED = 'approved', // Approuvé
  REJECTED = 'rejected', // Rejeté
  CANCELLED = 'cancelled' // Annulé
}

/**
 * Leave request attributes interface
 */
export interface LeaveRequestAttributes {
  id: number;
  employeeId: number;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  numberOfDays: number;
  reason?: string;
  status: LeaveStatus;
  requestedAt: Date;
  reviewedBy?: number; // Manager who reviewed the request
  reviewedAt?: Date;
  reviewComments?: string;
  attachmentPath?: string; // For medical certificates, etc.
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Leave request creation attributes
 */
export interface LeaveRequestCreationAttributes extends Optional<LeaveRequestAttributes, 'id' | 'numberOfDays' | 'reason' | 'status' | 'requestedAt' | 'reviewedBy' | 'reviewedAt' | 'reviewComments' | 'attachmentPath' | 'createdAt' | 'updatedAt'> {}

/**
 * Leave request model class
 */
class LeaveRequest extends Model<LeaveRequestAttributes, LeaveRequestCreationAttributes> implements LeaveRequestAttributes {
  public id!: number;
  public employeeId!: number;
  public type!: LeaveType;
  public startDate!: Date;
  public endDate!: Date;
  public numberOfDays!: number;
  public reason?: string;
  public status!: LeaveStatus;
  public requestedAt!: Date;
  public reviewedBy?: number;
  public reviewedAt?: Date;
  public reviewComments?: string;
  public attachmentPath?: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Calculate number of working days between start and end date
   */
  public static calculateWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  /**
   * Check if request is pending
   */
  public isPending(): boolean {
    return this.status === LeaveStatus.PENDING;
  }

  /**
   * Check if request is approved
   */
  public isApproved(): boolean {
    return this.status === LeaveStatus.APPROVED;
  }

  /**
   * Check if request is rejected
   */
  public isRejected(): boolean {
    return this.status === LeaveStatus.REJECTED;
  }

  /**
   * Approve the leave request
   */
  public async approve(reviewerId: number, comments?: string): Promise<void> {
    this.status = LeaveStatus.APPROVED;
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    this.reviewComments = comments;
    await this.save();
  }

  /**
   * Reject the leave request
   */
  public async reject(reviewerId: number, comments?: string): Promise<void> {
    this.status = LeaveStatus.REJECTED;
    this.reviewedBy = reviewerId;
    this.reviewedAt = new Date();
    this.reviewComments = comments;
    await this.save();
  }

  /**
   * Get formatted date range
   */
  public get dateRange(): string {
    const start = this.startDate.toLocaleDateString('fr-FR');
    const end = this.endDate.toLocaleDateString('fr-FR');
    return `${start} - ${end}`;
  }

  /**
   * Get leave type label in French
   */
  public get typeLabel(): string {
    const labels: Record<LeaveType, string> = {
      [LeaveType.CONGE_PAYE]: 'Congés payés',
      [LeaveType.MALADIE]: 'Congé maladie',
      [LeaveType.MATERNITE]: 'Congé maternité',
      [LeaveType.PATERNITE]: 'Congé paternité',
      [LeaveType.FORMATION]: 'Congé formation',
      [LeaveType.SANS_SOLDE]: 'Congé sans solde',
      [LeaveType.RTT]: 'RTT',
      [LeaveType.EXCEPTIONNEL]: 'Congé exceptionnel'
    };
    return labels[this.type];
  }

  /**
   * Get status label in French
   */
  public get statusLabel(): string {
    const labels: Record<LeaveStatus, string> = {
      [LeaveStatus.PENDING]: 'En attente',
      [LeaveStatus.APPROVED]: 'Approuvé',
      [LeaveStatus.REJECTED]: 'Rejeté',
      [LeaveStatus.CANCELLED]: 'Annulé'
    };
    return labels[this.status];
  }
}

/**
 * Initialize LeaveRequest model
 */
LeaveRequest.init(
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
    type: {
      type: DataTypes.ENUM(...Object.values(LeaveType)),
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        notEmpty: true,
      },
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        notEmpty: true,
        isAfterStartDate(value: string) {
          if (new Date(value) < new Date(this.startDate as string)) {
            throw new Error('End date must be after start date');
          }
        },
      },
    },
    numberOfDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        isInt: true,
      },
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(LeaveStatus)),
      allowNull: false,
      defaultValue: LeaveStatus.PENDING,
    },
    requestedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'employees',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewComments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attachmentPath: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'LeaveRequest',
    tableName: 'leave_requests',
    timestamps: true,
    hooks: {
      beforeSave: (leaveRequest: LeaveRequest) => {
        // Auto-calculate number of days if not provided
        if (!leaveRequest.numberOfDays) {
          leaveRequest.numberOfDays = LeaveRequest.calculateWorkingDays(
            leaveRequest.startDate,
            leaveRequest.endDate
          );
        }
      },
    },
    indexes: [
      {
        fields: ['employeeId'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['startDate', 'endDate'],
      },
      {
        fields: ['reviewedBy'],
      },
    ],
  }
);

export default LeaveRequest;
