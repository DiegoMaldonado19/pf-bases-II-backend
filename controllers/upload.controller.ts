import { Request, Response } from 'express';
import { uploadService } from '../services/upload.service';
import fs from 'fs';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export class UploadController {
  async uploadCSV(req: MulterRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No se cargó ningún archivo'
        });
        return;
      }

      const filePath = req.file.path;
      
      const result = await uploadService.processAndImport(filePath);
      
      fs.unlinkSync(filePath);
      
      const duration = Date.now() - startTime;
      
      res.json({
        success: true,
        data: result,
        message: `Se importaron exitosamente ${result.inserted} productos`,
        performance: {
          duration: `${duration}ms`
        }
      });
    } catch (error: any) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting temporary file:', unlinkError);
        }
      }
      
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al cargar el archivo'
      });
    }
  }
}

export const uploadController = new UploadController();
