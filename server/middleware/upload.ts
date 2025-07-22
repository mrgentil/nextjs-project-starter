import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import Document from '../models/Document';

/**
 * Ensure upload directory exists
 */
const ensureUploadDir = (dir: string): void => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Configure multer storage
 */
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads';
    const fullPath = path.join(__dirname, '..', uploadDir);
    
    ensureUploadDir(fullPath);
    cb(null, fullPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename
    const uniqueFilename = Document.generateUniqueFilename(file.originalname);
    cb(null, uniqueFilename);
  }
});

/**
 * File filter function
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
  // Check if file type is allowed
  if (!Document.isValidFileType(file.mimetype)) {
    cb(new Error('Type de fichier non autorisé. Formats acceptés: PDF, JPG, PNG, GIF, DOC, DOCX, TXT'));
    return;
  }
  
  cb(null, true);
};

/**
 * Multer configuration
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
    files: 5 // Maximum 5 files per request
  }
});

/**
 * Single file upload middleware
 */
export const uploadSingle = (fieldName: string = 'file') => {
  return upload.single(fieldName);
};

/**
 * Multiple files upload middleware
 */
export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 5) => {
  return upload.array(fieldName, maxCount);
};

/**
 * Fields upload middleware for different file types
 */
export const uploadFields = upload.fields([
  { name: 'contract', maxCount: 1 },
  { name: 'cv', maxCount: 1 },
  { name: 'id_card', maxCount: 1 },
  { name: 'diploma', maxCount: 3 },
  { name: 'medical_certificate', maxCount: 1 },
  { name: 'other', maxCount: 5 }
]);

/**
 * Error handler for multer errors
 */
export const handleUploadError = (error: any, req: Request, res: any, next: any): void => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          success: false,
          message: 'Fichier trop volumineux. Taille maximale: 5MB'
        });
        break;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          success: false,
          message: 'Trop de fichiers. Maximum 5 fichiers par requête'
        });
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          success: false,
          message: 'Champ de fichier inattendu'
        });
        break;
      default:
        res.status(400).json({
          success: false,
          message: 'Erreur lors du téléchargement du fichier'
        });
    }
  } else if (error.message.includes('Type de fichier non autorisé')) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  } else {
    next(error);
  }
};

/**
 * Validate uploaded file
 */
export const validateUploadedFile = (file: Express.Multer.File): { isValid: boolean; error?: string } => {
  if (!file) {
    return { isValid: false, error: 'Aucun fichier fourni' };
  }

  if (!Document.isValidFileType(file.mimetype)) {
    return { isValid: false, error: 'Type de fichier non autorisé' };
  }

  if (!Document.isValidFileSize(file.size)) {
    return { isValid: false, error: 'Fichier trop volumineux (max 5MB)' };
  }

  return { isValid: true };
};

/**
 * Clean up uploaded file (delete from filesystem)
 */
export const cleanupFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};

/**
 * Get file info from uploaded file
 */
export const getFileInfo = (file: Express.Multer.File) => {
  return {
    filename: file.filename,
    originalName: file.originalname,
    filePath: file.path,
    fileSize: file.size,
    mimeType: file.mimetype
  };
};

/**
 * Middleware to ensure upload directory exists
 */
export const ensureUploadDirectory = (req: Request, res: any, next: any): void => {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const fullPath = path.join(__dirname, '..', uploadDir);
  
  ensureUploadDir(fullPath);
  next();
};

/**
 * Get file extension from mimetype
 */
export const getExtensionFromMimeType = (mimeType: string): string => {
  const mimeToExt: { [key: string]: string } = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'text/plain': '.txt'
  };
  
  return mimeToExt[mimeType] || '';
};

/**
 * Check if file exists
 */
export const fileExists = (filePath: string): boolean => {
  return fs.existsSync(filePath);
};

/**
 * Get file stats
 */
export const getFileStats = (filePath: string): fs.Stats | null => {
  try {
    return fs.statSync(filePath);
  } catch (error) {
    return null;
  }
};

export default {
  uploadSingle,
  uploadMultiple,
  uploadFields,
  handleUploadError,
  validateUploadedFile,
  cleanupFile,
  getFileInfo,
  ensureUploadDirectory,
  getExtensionFromMimeType,
  fileExists,
  getFileStats
};
