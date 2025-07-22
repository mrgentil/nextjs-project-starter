import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import Employee from '../models/Employee';
import Payroll from '../models/Payroll';

/**
 * PDF generation utilities for payroll and documents
 */

/**
 * Generate payroll PDF
 */
export const generatePayrollPDF = async (
  payrollId: number,
  outputPath?: string
): Promise<string> => {
  // Get payroll data with employee information
  const payroll = await Payroll.findByPk(payrollId, {
    include: [
      {
        model: Employee,
        as: 'employee'
      }
    ]
  });

  if (!payroll) {
    throw new Error('Payroll not found');
  }

  const employee = (payroll as any).employee;
  if (!employee) {
    throw new Error('Employee not found');
  }

  // Generate filename if not provided
  if (!outputPath) {
    const uploadsDir = process.env.UPLOAD_DIR || 'uploads';
    const filename = `payslip_${employee.employeeNumber}_${payroll.period}.pdf`;
    outputPath = path.join(__dirname, '..', uploadsDir, filename);
  }

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    try {
      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Company header
      doc.fontSize(20)
         .text('FICHE DE PAIE', 50, 50, { align: 'center' })
         .fontSize(12)
         .text('Entreprise XYZ', 50, 80)
         .text('123 Rue de la Paie', 50, 95)
         .text('75001 Paris, France', 50, 110)
         .text('SIRET: 12345678901234', 50, 125);

      // Employee information
      doc.fontSize(14)
         .text('INFORMATIONS EMPLOYÉ', 50, 160)
         .fontSize(10)
         .text(`Nom: ${employee.fullName}`, 50, 180)
         .text(`N° Employé: ${employee.employeeNumber}`, 50, 195)
         .text(`Poste: ${employee.poste}`, 50, 210)
         .text(`Service: ${employee.service}`, 50, 225)
         .text(`Période: ${payroll.formattedPeriod}`, 300, 180)
         .text(`Date d'embauche: ${employee.dateEmbauche.toLocaleDateString('fr-FR')}`, 300, 195)
         .text(`Type de contrat: ${employee.typeContrat}`, 300, 210);

      // Salary details table
      let yPosition = 270;
      
      // Table header
      doc.fontSize(12)
         .text('DÉTAIL DE LA RÉMUNÉRATION', 50, yPosition);
      
      yPosition += 25;
      
      // Table lines
      const drawLine = (y: number) => {
        doc.moveTo(50, y).lineTo(550, y).stroke();
      };
      
      drawLine(yPosition);
      yPosition += 5;
      
      // Headers
      doc.fontSize(10)
         .text('Libellé', 60, yPosition)
         .text('Base', 200, yPosition)
         .text('Taux', 280, yPosition)
         .text('Montant', 380, yPosition)
         .text('Cumul', 480, yPosition);
      
      yPosition += 15;
      drawLine(yPosition);
      yPosition += 10;

      // Salary lines
      const addSalaryLine = (label: string, base: string, rate: string, amount: string, cumul: string = '') => {
        doc.text(label, 60, yPosition)
           .text(base, 200, yPosition)
           .text(rate, 280, yPosition)
           .text(amount, 380, yPosition)
           .text(cumul, 480, yPosition);
        yPosition += 15;
      };

      // Base salary
      addSalaryLine(
        'Salaire de base',
        `${payroll.workingDays} jours`,
        '',
        payroll.formattedBaseSalary,
        ''
      );

      // Bonuses
      if (payroll.bonuses > 0) {
        addSalaryLine(
          'Primes',
          '',
          '',
          new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(payroll.bonuses),
          ''
        );
      }

      // Allowances
      if (payroll.allowances > 0) {
        addSalaryLine(
          'Indemnités',
          '',
          '',
          new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(payroll.allowances),
          ''
        );
      }

      // Overtime
      if (payroll.overtime > 0) {
        addSalaryLine(
          'Heures supplémentaires',
          '',
          '',
          new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(payroll.overtime),
          ''
        );
      }

      drawLine(yPosition);
      yPosition += 10;

      // Gross salary
      doc.fontSize(11)
         .text('SALAIRE BRUT', 60, yPosition)
         .text(payroll.formattedGrossSalary, 380, yPosition);
      
      yPosition += 20;
      drawLine(yPosition);
      yPosition += 15;

      // Deductions
      doc.fontSize(10)
         .text('COTISATIONS ET RETENUES', 60, yPosition);
      yPosition += 20;

      addSalaryLine(
        'Sécurité Sociale',
        payroll.formattedGrossSalary,
        '23%',
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(payroll.socialSecurityDeduction),
        ''
      );

      addSalaryLine(
        'Impôt sur le revenu',
        '',
        '',
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(payroll.taxDeduction),
        ''
      );

      if (payroll.otherDeductions > 0) {
        addSalaryLine(
          'Autres retenues',
          '',
          '',
          new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(payroll.otherDeductions),
          ''
        );
      }

      drawLine(yPosition);
      yPosition += 10;

      // Net salary
      doc.fontSize(14)
         .text('SALAIRE NET À PAYER', 60, yPosition)
         .text(payroll.formattedNetSalary, 380, yPosition);

      yPosition += 30;

      // Leave information
      if (payroll.paidLeaveDays > 0 || payroll.unpaidLeaveDays > 0 || payroll.sickLeaveDays > 0) {
        doc.fontSize(12)
           .text('INFORMATIONS CONGÉS', 50, yPosition);
        yPosition += 20;

        doc.fontSize(10);
        if (payroll.paidLeaveDays > 0) {
          doc.text(`Congés payés: ${payroll.paidLeaveDays} jours`, 60, yPosition);
          yPosition += 15;
        }
        if (payroll.unpaidLeaveDays > 0) {
          doc.text(`Congés sans solde: ${payroll.unpaidLeaveDays} jours`, 60, yPosition);
          yPosition += 15;
        }
        if (payroll.sickLeaveDays > 0) {
          doc.text(`Congés maladie: ${payroll.sickLeaveDays} jours`, 60, yPosition);
          yPosition += 15;
        }
      }

      // Footer
      doc.fontSize(8)
         .text('Ce document est généré automatiquement par le système RH.', 50, 750)
         .text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 50, 765);

      // Finalize PDF
      doc.end();

      stream.on('finish', () => {
        resolve(outputPath);
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate employee contract PDF
 */
export const generateContractPDF = async (
  employeeId: number,
  contractData: {
    startDate: Date;
    contractType: string;
    salary: number;
    position: string;
    department: string;
  },
  outputPath?: string
): Promise<string> => {
  const employee = await Employee.findByPk(employeeId);
  if (!employee) {
    throw new Error('Employee not found');
  }

  // Generate filename if not provided
  if (!outputPath) {
    const uploadsDir = process.env.UPLOAD_DIR || 'uploads';
    const filename = `contract_${employee.employeeNumber}_${Date.now()}.pdf`;
    outputPath = path.join(__dirname, '..', uploadsDir, filename);
  }

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Title
      doc.fontSize(18)
         .text('CONTRAT DE TRAVAIL', 50, 50, { align: 'center' });

      // Company info
      doc.fontSize(12)
         .text('Entreprise XYZ', 50, 100)
         .text('123 Rue de la Paie', 50, 115)
         .text('75001 Paris, France', 50, 130)
         .text('SIRET: 12345678901234', 50, 145);

      // Contract details
      let yPos = 180;
      doc.fontSize(14)
         .text('INFORMATIONS DU CONTRAT', 50, yPos);
      
      yPos += 30;
      doc.fontSize(11)
         .text(`Employé: ${employee.fullName}`, 50, yPos)
         .text(`Adresse: ${employee.adresse || 'Non renseignée'}`, 50, yPos + 15)
         .text(`Date de naissance: ${employee.dateNaissance?.toLocaleDateString('fr-FR') || 'Non renseignée'}`, 50, yPos + 30)
         .text(`Poste: ${contractData.position}`, 50, yPos + 60)
         .text(`Service: ${contractData.department}`, 50, yPos + 75)
         .text(`Type de contrat: ${contractData.contractType}`, 50, yPos + 90)
         .text(`Date de début: ${contractData.startDate.toLocaleDateString('fr-FR')}`, 50, yPos + 105)
         .text(`Salaire: ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(contractData.salary)}`, 50, yPos + 120);

      // Contract terms
      yPos += 160;
      doc.fontSize(12)
         .text('TERMES ET CONDITIONS', 50, yPos);
      
      yPos += 25;
      doc.fontSize(10)
         .text('1. L\'employé s\'engage à exercer ses fonctions avec diligence et professionnalisme.', 50, yPos)
         .text('2. L\'horaire de travail est de 35 heures par semaine, du lundi au vendredi.', 50, yPos + 20)
         .text('3. La période d\'essai est de 3 mois renouvelable une fois.', 50, yPos + 40)
         .text('4. Les congés payés sont accordés selon la législation en vigueur.', 50, yPos + 60)
         .text('5. Toute modification du contrat doit faire l\'objet d\'un avenant écrit.', 50, yPos + 80);

      // Signatures
      yPos += 120;
      doc.text('L\'Employeur', 100, yPos)
         .text('L\'Employé', 400, yPos)
         .text('Date: ___________', 100, yPos + 40)
         .text('Date: ___________', 400, yPos + 40)
         .text('Signature: ___________', 100, yPos + 60)
         .text('Signature: ___________', 400, yPos + 60);

      doc.end();

      stream.on('finish', () => {
        resolve(outputPath);
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate leave certificate PDF
 */
export const generateLeaveCertificatePDF = async (
  leaveRequestId: number,
  outputPath?: string
): Promise<string> => {
  const LeaveRequest = (await import('../models/LeaveRequest')).default;
  
  const leaveRequest = await LeaveRequest.findByPk(leaveRequestId, {
    include: [
      {
        model: Employee,
        as: 'employee'
      }
    ]
  });

  if (!leaveRequest) {
    throw new Error('Leave request not found');
  }

  const employee = (leaveRequest as any).employee;
  if (!employee) {
    throw new Error('Employee not found');
  }

  // Generate filename if not provided
  if (!outputPath) {
    const uploadsDir = process.env.UPLOAD_DIR || 'uploads';
    const filename = `leave_certificate_${employee.employeeNumber}_${leaveRequest.id}.pdf`;
    outputPath = path.join(__dirname, '..', uploadsDir, filename);
  }

  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Title
      doc.fontSize(18)
         .text('ATTESTATION DE CONGÉS', 50, 50, { align: 'center' });

      // Company info
      doc.fontSize(12)
         .text('Entreprise XYZ', 50, 100)
         .text('123 Rue de la Paie', 50, 115)
         .text('75001 Paris, France', 50, 130);

      // Certificate content
      let yPos = 180;
      doc.fontSize(11)
         .text('Je soussigné(e), représentant(e) de l\'entreprise XYZ, certifie que :', 50, yPos);

      yPos += 40;
      doc.text(`Monsieur/Madame ${employee.fullName}`, 50, yPos)
         .text(`Employé(e) au poste de ${employee.poste}`, 50, yPos + 20)
         .text(`Service: ${employee.service}`, 50, yPos + 40)
         .text(`N° employé: ${employee.employeeNumber}`, 50, yPos + 60);

      yPos += 100;
      doc.text(`A bénéficié d'un congé de type: ${leaveRequest.typeLabel}`, 50, yPos)
         .text(`Du ${leaveRequest.startDate.toLocaleDateString('fr-FR')} au ${leaveRequest.endDate.toLocaleDateString('fr-FR')}`, 50, yPos + 20)
         .text(`Soit un total de ${leaveRequest.numberOfDays} jour(s)`, 50, yPos + 40);

      if (leaveRequest.reason) {
        yPos += 60;
        doc.text(`Motif: ${leaveRequest.reason}`, 50, yPos);
      }

      // Footer
      yPos += 80;
      doc.text(`Fait à Paris, le ${new Date().toLocaleDateString('fr-FR')}`, 50, yPos)
         .text('Pour l\'entreprise XYZ', 50, yPos + 40)
         .text('Le Directeur des Ressources Humaines', 50, yPos + 60)
         .text('Signature: ___________________', 50, yPos + 100);

      doc.end();

      stream.on('finish', () => {
        resolve(outputPath);
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Delete PDF file
 */
export const deletePDF = (filePath: string): boolean => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting PDF:', error);
    return false;
  }
};

export default {
  generatePayrollPDF,
  generateContractPDF,
  generateLeaveCertificatePDF,
  deletePDF
};
