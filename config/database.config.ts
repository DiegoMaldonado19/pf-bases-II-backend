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

    await collection.createIndex(
      { 
        title: 'text', 
        category: 'text', 
        brand: 'text',
        product_type: 'text',
        description: 'text'
      }, 
      {
        weights: {
          title: 10,
          category: 8,
          brand: 6,
          sku: 4,
          product_type: 2,
          description: 1
        },
        name: 'full_text_search_index',
        default_language: 'spanish'
      }
    );

    await collection.createIndex({ sku: 1 }, { 
      unique: true, 
      name: 'sku_unique_index' 
    });

    await collection.createIndex({ id: 1 }, { 
      unique: true, 
      name: 'id_unique_index' 
    });

    await collection.createIndex({ category: 1, brand: 1 }, { 
      name: 'category_brand_compound_index' 
    });

    await collection.createIndex({ product_type: 1 }, { 
      name: 'product_type_index' 
    });

    await collection.createIndex({ price: 1 }, { 
      name: 'price_index' 
    });

    await collection.createIndex({ rating: -1 }, { 
      name: 'rating_desc_index' 
    });

    await collection.createIndex({ stock: 1 }, { 
      name: 'stock_index' 
    });

    await collection.createIndex({ created_at: -1 }, { 
      name: 'created_at_desc_index' 
    });

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