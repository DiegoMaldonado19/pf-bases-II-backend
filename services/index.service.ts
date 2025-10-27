import { databaseConfig } from '../config/database.config';
import { Product } from '../models/product.model';
import { csvParserUtil } from '../utils/csv-parser.util';
import { cacheService } from './cache.service';

export class IndexService {
  private readonly BATCH_SIZE = 1000;

  async loadDataFromCSV(filePath: string): Promise<{ 
    success: boolean; 
    inserted: number; 
    duplicates: number; 
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let inserted = 0;
    let duplicates = 0;
    let errors = 0;

    try {
      console.log('Starting CSV parsing...');
      const products = await csvParserUtil.parseCSV(filePath);
      console.log(`Parsed ${products.length} products from CSV`);

      const collection = databaseConfig.getProductsCollection();

      console.log('Checking for existing data...');
      const existingCount = await collection.countDocuments();
      
      if (existingCount > 0) {
        console.log(`Found ${existingCount} existing products. Skipping duplicates...`);
      }

      console.log('Starting bulk insert...');
      for (let i = 0; i < products.length; i += this.BATCH_SIZE) {
        const batch = products.slice(i, i + this.BATCH_SIZE);
        
        try {
          const result = await collection.insertMany(batch, { ordered: false });
          inserted += result.insertedCount;
          
          console.log(`Batch ${Math.floor(i / this.BATCH_SIZE) + 1}: Inserted ${result.insertedCount}/${batch.length} products`);
        } catch (error: any) {
          if (error.code === 11000) {
            const duplicateCount = error.writeErrors?.filter((e: any) => e.code === 11000).length || 0;
            duplicates += duplicateCount;
            inserted += (batch.length - duplicateCount);
            console.log(`Batch ${Math.floor(i / this.BATCH_SIZE) + 1}: ${duplicateCount} duplicates detected`);
          } else {
            errors += batch.length;
            console.error(`Batch ${Math.floor(i / this.BATCH_SIZE) + 1} error:`, error.message);
          }
        }
      }

      await cacheService.invalidateCache('search:');
      await cacheService.invalidateCache('autocomplete:');

      const duration = (Date.now() - startTime) / 1000;
      console.log(`Data loading completed in ${duration.toFixed(2)}s`);

      return {
        success: true,
        inserted,
        duplicates,
        errors,
        duration
      };

    } catch (error: any) {
      console.error('Load data error:', error);
      const duration = (Date.now() - startTime) / 1000;
      
      return {
        success: false,
        inserted,
        duplicates,
        errors: errors + 1,
        duration
      };
    }
  }

  async getIndexStats(): Promise<{
    totalProducts: number;
    indexes: any[];
    collectionSize: number;
  }> {
    const collection = databaseConfig.getProductsCollection();

    const totalProducts = await collection.countDocuments();
    const indexes = await collection.indexes();
    const stats = await collection.stats();

    return {
      totalProducts,
      indexes,
      collectionSize: stats.size
    };
  }

  async clearAllData(): Promise<{ success: boolean; deletedCount: number }> {
    try {
      const collection = databaseConfig.getProductsCollection();
      const result = await collection.deleteMany({});

      await cacheService.invalidateCache('search:');
      await cacheService.invalidateCache('autocomplete:');

      return {
        success: true,
        deletedCount: result.deletedCount
      };
    } catch (error) {
      console.error('Clear data error:', error);
      return {
        success: false,
        deletedCount: 0
      };
    }
  }
}

export const indexService = new IndexService();