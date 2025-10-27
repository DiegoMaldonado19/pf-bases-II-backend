import { MongoClient, Db, Collection } from 'mongodb';
import { Product } from '../models/product.model';

class DatabaseConfig {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<void> {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/products_db';
    
    this.client = new MongoClient(uri);
    await this.client.connect();
    
    this.db = this.client.db();
    
    await this.createIndexes();
    
    console.log('MongoDB connected successfully');
  }

  private async createIndexes(): Promise<void> {
    const collection = this.getProductsCollection();

    await collection.createIndex({ title: 'text', category: 'text', brand: 'text' }, {
      weights: {
        title: 10,
        category: 5,
        brand: 3
      },
      name: 'text_search_index'
    });

    await collection.createIndex({ sku: 1 }, { unique: true, name: 'sku_unique_index' });
    await collection.createIndex({ category: 1, brand: 1 }, { name: 'category_brand_index' });
    await collection.createIndex({ product_type: 1 }, { name: 'product_type_index' });

    console.log('MongoDB indexes created successfully');
  }

  getProductsCollection(): Collection<Product> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db.collection<Product>('products');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      console.log('MongoDB disconnected');
    }
  }
}

export const databaseConfig = new DatabaseConfig();