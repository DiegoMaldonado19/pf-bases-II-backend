import fs from 'fs';
import csvParser from 'csv-parser';
import { Product } from '../models/product.model';

export class CsvParserUtil {
  async parseCSV(filePath: string): Promise<Product[]> {
    return new Promise((resolve, reject) => {
      const products: Product[] = [];
      let rowCount = 0;

      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row: any) => {
          rowCount++;
          
          const product: Product = {
            title: this.sanitizeString(row.title || row.Title),
            category: this.sanitizeString(row.category || row.Category),
            brand: this.sanitizeString(row.brand || row.Brand),
            product_type: this.sanitizeString(row.product_type || row.ProductType || row['Product Type']),
            sku: this.sanitizeString(row.sku || row.SKU),
            price: this.parsePrice(row.price || row.Price),
            description: this.sanitizeString(row.description || row.Description),
            created_at: new Date()
          };

          if (this.isValidProduct(product)) {
            products.push(product);
          } else {
            console.warn(`Invalid product at row ${rowCount}:`, product.sku);
          }
        })
        .on('end', () => {
          console.log(`CSV parsing completed. Total rows: ${rowCount}, Valid products: ${products.length}`);
          resolve(products);
        })
        .on('error', (error) => {
          console.error('CSV parsing error:', error);
          reject(error);
        });
    });
  }

  private sanitizeString(value: any): string {
    if (!value) return '';
    return String(value).trim();
  }

  private parsePrice(value: any): number | undefined {
    if (!value) return undefined;
    const parsed = parseFloat(String(value).replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? undefined : parsed;
  }

  private isValidProduct(product: Product): boolean {
    return !!(
      product.title &&
      product.category &&
      product.brand &&
      product.product_type &&
      product.sku
    );
  }
}

export const csvParserUtil = new CsvParserUtil();