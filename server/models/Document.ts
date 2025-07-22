import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import path from 'path';

/**
 * Document types enum
 */
export enum DocumentType {
  CONTRACT = 'contract', // Contrat de travail
  CV = 'cv', // Curriculum Vitae
  ID_CARD = 'id_card', // Carte d'identité
  DIPLOMA = 'diploma', // Diplôme
  MEDICAL_CERTIFICATE = 'medical_certificate', // Certificat médical
  PAYSLIP = 'payslip', // Fiche de paie
  OTHER = 'other' // Autre
}

/**
 * Document attributes interface
 */
export interface DocumentAttributes {
  id: number;
  employeeId: number;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  type: DocumentType;
  description?: string;
  uploadedBy: number; // User who uploaded the document
  uploadedAt: Date;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Document creation attributes
 */
export interface DocumentCreationAttributes extends Optional<DocumentAttributes, 'id' | 'description' | 'uploadedAt' | 'isActive' | 'createdAt' | 'updatedAt'> {}

/**
 * Document model class
 */
class Document extends Model<DocumentAttributes, DocumentCreationAttributes> implements DocumentAttributes {
  public id!: number;
  public employeeId!: number;
  public filename!: string;
  public originalName!: string;
  public filePath!: string;
  public fileSize!: number;
  public mimeType!: string;
  public type!: DocumentType;
  public description?: string;
  public uploadedBy!: number;
  public uploadedAt!: Date;
  public isActive!: boolean;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Get file extension
   */
  public get fileExtension(): string {
    return path.extname(this.filename).toLowerCase();
  }

  /**
   * Get formatted file size
   */
  public get formattedFileSize(): string {
    const bytes = this.fileSize;
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Check if document is an image
   */
  public isImage(): boolean {
    const imageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageTypes.includes(this.fileExtension);
  }

  /**
   * Check if document is a PDF
   */
  public isPDF(): boolean {
    return this.fileExtension === '.pdf';
  }

  /**
   * Check if document is a Word document
   */
  public isWordDocument(): boolean {
    const wordTypes = ['.doc', '.docx'];
    return wordTypes.includes(this.fileExtension);
  }

  /**
   * Get document type label in French
   */
  public get typeLabel(): string {
    const labels: Record<DocumentType, string> = {
      [DocumentType.CONTRACT]: 'Contrat de travail',
      [DocumentType.CV]: 'Curriculum Vitae',
      [DocumentType.ID_CARD]: 'Carte d\'identité',
      [DocumentType.DIPLOMA]: 'Diplôme',
      [DocumentType.MEDICAL_CERTIFICATE]: 'Certificat médical',
      [DocumentType.PAYSLIP]: 'Fiche de paie',
      [DocumentType.OTHER]: 'Autre'
    };
    return labels[this.type];
  }

  /**
   * Generate unique filename
   */
  public static generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const extension = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, extension);
    
    // Clean filename (remove special characters)
    const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
    
    return `${cleanName}_${timestamp}_${random}${extension}`;
  }

  /**
   * Validate file type
   */
  public static isValidFileType(mimeType: string): boolean {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    return allowedTypes.includes(mimeType);
  }

  /**
   * Validate file size (max 5MB)
   */
  public static isValidFileSize(size: number): boolean {
    const maxSize = 5 * 1024 * 1024; // 5MB
    return size <= maxSize;
  }

  /**
   * Soft delete document
   */
  public async softDelete(): Promise<void> {
    this.isActive = false;
    await this.save();
  }

  /**
   * Restore soft deleted document
   */
  public async restore(): Promise<void> {
    this.isActive = true;
    await this.save();
  }
}

/**
 * Initialize Document model
 */
Document.init(
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
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        isInt: true,
      },
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    type: {
      type: DataTypes.ENUM(...Object.values(DocumentType)),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    uploadedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Document',
    tableName: 'documents',
    timestamps: true,
    defaultScope: {
      where: {
        isActive: true,
      },
    },
    scopes: {
      withDeleted: {
        where: {},
      },
      onlyDeleted: {
        where: {
          isActive: false,
        },
      },
    },
    indexes: [
      {
        fields: ['employeeId'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['uploadedBy'],
      },
      {
        fields: ['isActive'],
      },
      {
        fields: ['uploadedAt'],
      },
    ],
  }
);

export default Document;
