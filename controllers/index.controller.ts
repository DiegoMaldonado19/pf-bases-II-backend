import { Request, Response } from 'express';
import { indexService } from '../services/index.service';
import path from 'path';

export class IndexController {
  async loadData(req: Request, res: Response): Promise<void> {
    try {
      const filePath = path.join(__dirname, '../../data/products.csv');

      const result = await indexService.loadDataFromCSV(filePath);

      res.status(200).json({
        success: result.success,
        message: 'Data loading process completed',
        data: {
          inserted: result.inserted,
          duplicates: result.duplicates,
          errors: result.errors,
          duration: `${result.duration.toFixed(2)}s`
        }
      });
    } catch (error: any) {
      console.error('Load data endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load data',
        error: error.message
      });
    }
  }

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await indexService.getIndexStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('Get stats endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve stats',
        error: error.message
      });
    }
  }

  async clearData(req: Request, res: Response): Promise<void> {
    try {
      const result = await indexService.clearAllData();

      res.status(200).json({
        success: result.success,
        message: `Deleted ${result.deletedCount} products`
      });
    } catch (error: any) {
      console.error('Clear data endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear data',
        error: error.message
      });
    }
  }
}

export const indexController = new IndexController();