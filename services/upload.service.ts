import { csvParserUtil } from '../utils/csv-parser.util';
import { indexService } from './index.service';

export class UploadService {
  async processAndImport(filePath: string): Promise<{
    inserted: number;
    skipped: number;
    total: number;
  }> {
    try {
      const products = await csvParserUtil.parseCSV(filePath);
      
      if (products.length === 0) {
        throw new Error('No valid products found in CSV file');
      }
      
      const result = await indexService.bulkInsertProducts(products);
      
      return {
        inserted: result.insertedCount,
        skipped: products.length - result.insertedCount,
        total: products.length
      };
    } catch (error: any) {
      console.error('Error processing CSV:', error);
      throw new Error(`Failed to process CSV: ${error.message}`);
    }
  }
}

export const uploadService = new UploadService();
