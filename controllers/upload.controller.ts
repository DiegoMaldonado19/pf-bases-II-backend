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
      console.log('[UPLOAD] Iniciando proceso de carga...');
      
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No se cargó ningún archivo'
        });
        return;
      }

      const filePath = req.file.path;
      console.log('[UPLOAD] Archivo recibido:', req.file.originalname);
      
      const result = await uploadService.processAndImport(filePath);
      
      console.log('[UPLOAD] Proceso completado, eliminando archivo temporal...');
      fs.unlinkSync(filePath);
      
      const duration = Date.now() - startTime;
      
      const response = {
        success: true,
        data: result,
        message: `Se importaron exitosamente ${result.inserted} productos`,
        performance: {
          duration: `${duration}ms`
        }
      };
      
      console.log('[UPLOAD] Enviando respuesta al cliente:', response);
      res.status(200).json(response);
      console.log('[UPLOAD] Respuesta enviada exitosamente');
    } catch (error: any) {
      console.error('[UPLOAD] Error en el proceso:', error);
      
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
