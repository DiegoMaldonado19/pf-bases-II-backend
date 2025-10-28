import fs from 'fs';
import csvParser from 'csv-parser';
import { Product } from '../models/product.model';

export class CsvParserUtil {
  async parseCSV(filePath: string): Promise<Product[]> {
    return new Promise((resolve, reject) => {
      const products: Product[] = [];
      let rowCount = 0;
      let skippedRows = 0;

      fs.createReadStream(filePath)
        .pipe(csvParser({ separator: '\t' }))
        .on('data', (row: any) => {
          rowCount++;
          
          try {
            const product: Product = {
              id: parseInt(row.id),
              title: this.sanitizeString(row.title),
              brand: this.sanitizeString(row.brand),
              category: this.sanitizeString(row.category),
              product_type: this.sanitizeString(row.product_type),
              description: this.sanitizeString(row.description),
              price: parseFloat(row.price),
              currency: this.sanitizeString(row.currency),
              stock: parseInt(row.stock),
              sku: this.sanitizeString(row.sku),
              rating: parseFloat(row.rating),
              created_at: new Date(row.created_at)
            };

            if (this.isValidProduct(product)) {
              products.push(product);
            } else {
              skippedRows++;
              console.warn(`Invalid product at row ${rowCount}: SKU ${product.sku}`);
            }
          } catch (error: any) {
            skippedRows++;
            console.warn(`Error parsing row ${rowCount}: ${error.message}`);
          }
        })
        .on('end', () => {
          console.log(`CSV parsing completed:`);
          console.log(`- Total rows processed: ${rowCount}`);
          console.log(`- Valid products: ${products.length}`);
          console.log(`- Skipped rows: ${skippedRows}`);
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
    return String(value).trim().replace(/\0/g, '');
  }

  private isValidProduct(product: Product): boolean {
    return !!(
      product.id &&
      product.title &&
      product.brand &&
      product.category &&
      product.product_type &&
      product.sku &&
      !isNaN(product.price) &&
      product.price >= 0 &&
      !isNaN(product.stock) &&
      product.stock >= 0 &&
      !isNaN(product.rating) &&
      product.rating >= 0 &&
      product.rating <= 5
    );
  }
}

export const csvParserUtil = new CsvParserUtil();