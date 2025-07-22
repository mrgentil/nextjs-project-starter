import Employee from '../models/Employee';
import LeaveRequest, { LeaveStatus, LeaveType } from '../models/LeaveRequest';
import Payroll, { PayrollStatus } from '../models/Payroll';

/**
 * Payroll calculation utilities
 */

/**
 * Calculate working days in a month excluding weekends
 */
export const getWorkingDaysInMonth = (year: number, month: number): number => {
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
};

/**
 * Calculate leave days for an employee in a specific month
 */
export const calculateLeaveDaysInMonth = async (
  employeeId: number,
  year: number,
  month: number
): Promise<{
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  sickLeaveDays: number;
}> => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const leaveRequests = await LeaveRequest.findAll({
    where: {
      employeeId,
      status: LeaveStatus.APPROVED,
      startDate: {
        [require('sequelize').Op.lte]: endDate
      },
      endDate: {
        [require('sequelize').Op.gte]: startDate
      }
    }
  });

  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let sickLeaveDays = 0;

  leaveRequests.forEach(leave => {
    const leaveStart = new Date(Math.max(leave.startDate.getTime(), startDate.getTime()));
    const leaveEnd = new Date(Math.min(leave.endDate.getTime(), endDate.getTime()));
    
    const days = calculateWorkingDaysBetween(leaveStart, leaveEnd);

    switch (leave.type) {
      case LeaveType.CONGE_PAYE:
      case LeaveType.RTT:
        paidLeaveDays += days;
        break;
      case LeaveType.MALADIE:
        sickLeaveDays += days;
        break;
      case LeaveType.SANS_SOLDE:
        unpaidLeaveDays += days;
        break;
      case LeaveType.MATERNITE:
      case LeaveType.PATERNITE:
        // These are typically paid by social security, not deducted from salary
        paidLeaveDays += days;
        break;
      default:
        paidLeaveDays += days;
    }
  });

  return { paidLeaveDays, unpaidLeaveDays, sickLeaveDays };
};

/**
 * Calculate working days between two dates
 */
export const calculateWorkingDaysBetween = (startDate: Date, endDate: Date): number => {
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
};

/**
 * Calculate gross salary based on base salary and adjustments
 */
export const calculateGrossSalary = (
  baseSalary: number,
  workingDays: number,
  unpaidLeaveDays: number,
  bonuses: number = 0,
  allowances: number = 0,
  overtime: number = 0
): number => {
  const dailyRate = baseSalary / workingDays;
  const unpaidDeduction = dailyRate * unpaidLeaveDays;
  
  return baseSalary - unpaidDeduction + bonuses + allowances + overtime;
};

/**
 * Calculate social security contributions (French system)
 */
export const calculateSocialSecurityContributions = (grossSalary: number): {
  employeeContribution: number;
  employerContribution: number;
  total: number;
} => {
  // Simplified French social security rates (2024)
  const employeeRate = 0.2295; // ~23% for employee
  const employerRate = 0.4245; // ~42% for employer
  
  const employeeContribution = grossSalary * employeeRate;
  const employerContribution = grossSalary * employerRate;
  
  return {
    employeeContribution,
    employerContribution,
    total: employeeContribution + employerContribution
  };
};

/**
 * Calculate income tax (simplified French system)
 */
export const calculateIncomeTax = (grossSalary: number, isMarried: boolean = false): number => {
  // Simplified French income tax calculation
  // This is a very basic calculation - real system is much more complex
  
  const annualSalary = grossSalary * 12;
  const taxableIncome = annualSalary - (annualSalary * 0.1); // 10% deduction
  
  let tax = 0;
  
  if (taxableIncome <= 10777) {
    tax = 0;
  } else if (taxableIncome <= 27478) {
    tax = (taxableIncome - 10777) * 0.11;
  } else if (taxableIncome <= 78570) {
    tax = (27478 - 10777) * 0.11 + (taxableIncome - 27478) * 0.30;
  } else if (taxableIncome <= 168994) {
    tax = (27478 - 10777) * 0.11 + (78570 - 27478) * 0.30 + (taxableIncome - 78570) * 0.41;
  } else {
    tax = (27478 - 10777) * 0.11 + (78570 - 27478) * 0.30 + (168994 - 78570) * 0.41 + (taxableIncome - 168994) * 0.45;
  }
  
  // Apply marital status adjustment (simplified)
  if (isMarried) {
    tax *= 0.8; // 20% reduction for married couples
  }
  
  return Math.max(0, tax / 12); // Monthly tax
};

/**
 * Calculate net salary
 */
export const calculateNetSalary = (
  grossSalary: number,
  socialSecurityDeduction: number,
  taxDeduction: number,
  otherDeductions: number = 0
): number => {
  return Math.max(0, grossSalary - socialSecurityDeduction - taxDeduction - otherDeductions);
};

/**
 * Complete payroll calculation for an employee
 */
export const calculateEmployeePayroll = async (
  employeeId: number,
  year: number,
  month: number,
  bonuses: number = 0,
  allowances: number = 0,
  overtime: number = 0,
  otherDeductions: number = 0
): Promise<Partial<Payroll>> => {
  // Get employee data
  const employee = await Employee.findByPk(employeeId);
  if (!employee) {
    throw new Error('Employee not found');
  }

  // Calculate working days
  const workingDays = getWorkingDaysInMonth(year, month);
  
  // Calculate leave days
  const leaveDays = await calculateLeaveDaysInMonth(employeeId, year, month);
  
  // Calculate actual working days
  const actualWorkingDays = workingDays - leaveDays.paidLeaveDays - leaveDays.unpaidLeaveDays - leaveDays.sickLeaveDays;
  
  // Calculate gross salary
  const grossSalary = calculateGrossSalary(
    employee.salaire,
    workingDays,
    leaveDays.unpaidLeaveDays,
    bonuses,
    allowances,
    overtime
  );
  
  // Calculate social security contributions
  const socialSecurity = calculateSocialSecurityContributions(grossSalary);
  
  // Calculate income tax
  const taxDeduction = calculateIncomeTax(grossSalary);
  
  // Calculate net salary
  const netSalary = calculateNetSalary(
    grossSalary,
    socialSecurity.employeeContribution,
    taxDeduction,
    otherDeductions
  );
  
  const period = `${year}-${month.toString().padStart(2, '0')}`;
  
  return {
    employeeId,
    period,
    baseSalary: employee.salaire,
    grossSalary,
    netSalary,
    socialSecurityDeduction: socialSecurity.employeeContribution,
    taxDeduction,
    otherDeductions,
    bonuses,
    allowances,
    overtime,
    paidLeaveDays: leaveDays.paidLeaveDays,
    unpaidLeaveDays: leaveDays.unpaidLeaveDays,
    sickLeaveDays: leaveDays.sickLeaveDays,
    workingDays,
    actualWorkingDays,
    status: PayrollStatus.CALCULATED,
    calculatedAt: new Date()
  };
};

/**
 * Validate payroll data
 */
export const validatePayrollData = (payrollData: Partial<Payroll>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!payrollData.employeeId) {
    errors.push('Employee ID is required');
  }
  
  if (!payrollData.period || !/^\d{4}-\d{2}$/.test(payrollData.period)) {
    errors.push('Valid period (YYYY-MM) is required');
  }
  
  if (!payrollData.baseSalary || payrollData.baseSalary <= 0) {
    errors.push('Base salary must be greater than 0');
  }
  
  if (!payrollData.workingDays || payrollData.workingDays <= 0) {
    errors.push('Working days must be greater than 0');
  }
  
  if (payrollData.actualWorkingDays !== undefined && payrollData.actualWorkingDays < 0) {
    errors.push('Actual working days cannot be negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

/**
 * Calculate year-to-date totals for an employee
 */
export const calculateYearToDateTotals = async (
  employeeId: number,
  year: number,
  upToMonth: number
): Promise<{
  totalGrossSalary: number;
  totalNetSalary: number;
  totalTaxDeduction: number;
  totalSocialSecurityDeduction: number;
}> => {
  const payrolls = await Payroll.findAll({
    where: {
      employeeId,
      period: {
        [require('sequelize').Op.like]: `${year}-%`
      }
    }
  });
  
  const relevantPayrolls = payrolls.filter(p => {
    const month = parseInt(p.period.split('-')[1]);
    return month <= upToMonth;
  });
  
  return relevantPayrolls.reduce((totals, payroll) => ({
    totalGrossSalary: totals.totalGrossSalary + payroll.grossSalary,
    totalNetSalary: totals.totalNetSalary + payroll.netSalary,
    totalTaxDeduction: totals.totalTaxDeduction + payroll.taxDeduction,
    totalSocialSecurityDeduction: totals.totalSocialSecurityDeduction + payroll.socialSecurityDeduction
  }), {
    totalGrossSalary: 0,
    totalNetSalary: 0,
    totalTaxDeduction: 0,
    totalSocialSecurityDeduction: 0
  });
};

export default {
  getWorkingDaysInMonth,
  calculateLeaveDaysInMonth,
  calculateWorkingDaysBetween,
  calculateGrossSalary,
  calculateSocialSecurityContributions,
  calculateIncomeTax,
  calculateNetSalary,
  calculateEmployeePayroll,
  validatePayrollData,
  formatCurrency,
  calculateYearToDateTotals
};
