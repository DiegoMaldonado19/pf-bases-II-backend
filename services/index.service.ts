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
      console.log('Iniciando análisis de CSV...');
      const products = await csvParserUtil.parseCSV(filePath);
      console.log(`Se analizaron ${products.length} productos del CSV`);

      const collection = databaseConfig.getProductsCollection();

      console.log('Verificando datos existentes...');
      const existingCount = await collection.countDocuments();
      
      if (existingCount > 0) {
        console.log(`Se encontraron ${existingCount} productos existentes. Saltando duplicados...`);
      }

      console.log('Iniciando inserción masiva...');
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
      console.log(`Carga de datos completada en ${duration.toFixed(2)}s`);

      return {
        success: true,
        inserted,
        duplicates,
        errors,
        duration
      };

    } catch (error: any) {
      console.error('Error al cargar los datos:', error);
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
    const stats = await collection.estimatedDocumentCount();

    return {
      totalProducts,
      indexes,
      collectionSize: stats
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
      console.error('Error al limpiar los datos:', error);
      return {
        success: false,
        deletedCount: 0
      };
    }
  }

  async bulkInsertProducts(products: Product[]): Promise<{ insertedCount: number }> {
    try {
      const collection = databaseConfig.getProductsCollection();
      let totalInserted = 0;
      const totalBatches = Math.ceil(products.length / this.BATCH_SIZE);

      console.log(`Iniciando inserción masiva: ${products.length} productos en ${totalBatches} lotes`);

      for (let i = 0; i < products.length; i += this.BATCH_SIZE) {
        const batch = products.slice(i, i + this.BATCH_SIZE);
        const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;
        
        try {
          const result = await collection.insertMany(batch, { ordered: false });
          totalInserted += result.insertedCount;
          
          if (batchNumber % 100 === 0 || batchNumber === totalBatches) {
            console.log(`Progreso: ${batchNumber}/${totalBatches} lotes (${totalInserted} productos insertados)`);
          }
        } catch (error: any) {
          if (error.code === 11000) {
            const duplicateCount = error.writeErrors?.filter((e: any) => e.code === 11000).length || 0;
            totalInserted += (batch.length - duplicateCount);
            console.log(`Lote ${batchNumber}: ${duplicateCount} duplicados encontrados`);
          } else {
            console.error(`Lote ${batchNumber} error:`, error);
            throw error;
          }
        }
      }

      console.log(`Inserción masiva completada: ${totalInserted} productos insertados con éxito`);

      await cacheService.invalidateCache('search:');
      await cacheService.invalidateCache('autocomplete:');

      return { insertedCount: totalInserted };
    } catch (error) {
      console.error('Error en la inserción masiva:', error);
      throw error;
    }
  }
}

export const indexService = new IndexService();