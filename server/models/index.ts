import sequelize from '../config/database';
import User from './User';
import Employee from './Employee';
import LeaveRequest from './LeaveRequest';
import Document from './Document';
import Payroll from './Payroll';

/**
 * Define model associations
 */

// User - Employee associations
User.hasOne(Employee, {
  foreignKey: 'userId',
  as: 'employeeProfile',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

Employee.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// Employee - Manager associations (self-referencing)
Employee.belongsTo(Employee, {
  foreignKey: 'managerId',
  as: 'manager',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

Employee.hasMany(Employee, {
  foreignKey: 'managerId',
  as: 'subordinates',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// Employee - LeaveRequest associations
Employee.hasMany(LeaveRequest, {
  foreignKey: 'employeeId',
  as: 'leaveRequests',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

LeaveRequest.belongsTo(Employee, {
  foreignKey: 'employeeId',
  as: 'employee',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// Employee - LeaveRequest (reviewer) associations
Employee.hasMany(LeaveRequest, {
  foreignKey: 'reviewedBy',
  as: 'reviewedLeaveRequests',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

LeaveRequest.belongsTo(Employee, {
  foreignKey: 'reviewedBy',
  as: 'reviewer',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// Employee - Document associations
Employee.hasMany(Document, {
  foreignKey: 'employeeId',
  as: 'documents',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Document.belongsTo(Employee, {
  foreignKey: 'employeeId',
  as: 'employee',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// User - Document (uploader) associations
User.hasMany(Document, {
  foreignKey: 'uploadedBy',
  as: 'uploadedDocuments',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

Document.belongsTo(User, {
  foreignKey: 'uploadedBy',
  as: 'uploader',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

// Employee - Payroll associations
Employee.hasMany(Payroll, {
  foreignKey: 'employeeId',
  as: 'payrolls',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Payroll.belongsTo(Employee, {
  foreignKey: 'employeeId',
  as: 'employee',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// User - Payroll (validator) associations
User.hasMany(Payroll, {
  foreignKey: 'validatedBy',
  as: 'validatedPayrolls',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

Payroll.belongsTo(User, {
  foreignKey: 'validatedBy',
  as: 'validator',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

/**
 * Export all models and sequelize instance
 */
export {
  sequelize,
  User,
  Employee,
  LeaveRequest,
  Document,
  Payroll
};

/**
 * Initialize database connection and sync models
 */
export const initializeDatabase = async (force: boolean = false): Promise<void> => {
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Sync models
    await sequelize.sync({ force });
    console.log('✅ Database models synchronized successfully.');

    if (force) {
      console.log('⚠️  Database tables recreated (force: true)');
    }
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    console.log('✅ Database connection closed successfully.');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
};

export default {
  sequelize,
  User,
  Employee,
  LeaveRequest,
  Document,
  Payroll,
  initializeDatabase,
  closeDatabase
};
