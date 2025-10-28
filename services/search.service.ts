import { databaseConfig } from '../config/database.config';
import { Product, SearchResult, RelevanceScore } from '../models/product.model';
import { cacheService } from './cache.service';

export class SearchService {
  async search(
    query: string, 
    page: number = 1, 
    limit: number = 20,
    sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest'
  ): Promise<SearchResult> {
    const cacheKey = `${query}:${page}:${limit}:${sortBy || 'relevance'}`;
    const cachedResult = await cacheService.getCachedSearch(cacheKey, page, limit);
    
    if (cachedResult) {
      return cachedResult;
    }

    const trimmedQuery = query.trim().toLowerCase();
    const skip = (page - 1) * limit;

    const rankedResults = await this.searchWithRelevance(trimmedQuery);

    if (sortBy && sortBy !== 'relevance') {
      this.applySorting(rankedResults, sortBy);
    }

    const paginatedProducts = rankedResults.slice(skip, skip + limit);
    const total = rankedResults.length;
    const totalPages = Math.ceil(total / limit);

    const result: SearchResult = {
      products: paginatedProducts.map(r => r.product),
      total,
      page,
      limit,
      totalPages
    };

    await cacheService.setCachedSearch(cacheKey, page, limit, result);

    return result;
  }

  private async searchWithRelevance(query: string): Promise<RelevanceScore[]> {
    const collection = databaseConfig.getProductsCollection();
    const results: RelevanceScore[] = [];
    const seenIds = new Set<string>();

    const addUniqueResults = (products: Product[], score: number, field: RelevanceScore['matchedField']) => {
      products.forEach(product => {
        const id = product._id?.toString() || product.sku;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          results.push({ product, score, matchedField: field });
        }
      });
    };

    const titleMatches = await collection.find({
      title: { $regex: this.escapeRegex(query), $options: 'i' }
    }).toArray();
    addUniqueResults(titleMatches, 5, 'title');

    const categoryMatches = await collection.find({
      category: { $regex: this.escapeRegex(query), $options: 'i' }
    }).toArray();
    addUniqueResults(categoryMatches, 4, 'category');

    const brandMatches = await collection.find({
      brand: { $regex: this.escapeRegex(query), $options: 'i' }
    }).toArray();
    addUniqueResults(brandMatches, 3, 'brand');

    const skuMatches = await collection.find({
      sku: { $regex: this.escapeRegex(query), $options: 'i' }
    }).toArray();
    addUniqueResults(skuMatches, 2, 'sku');

    const productTypeMatches = await collection.find({
      product_type: { $regex: this.escapeRegex(query), $options: 'i' }
    }).toArray();
    addUniqueResults(productTypeMatches, 1, 'product_type');

    return results.sort((a, b) => b.score - a.score);
  }

  private applySorting(results: RelevanceScore[], sortBy: string): void {
    switch (sortBy) {
      case 'price_asc':
        results.sort((a, b) => a.product.price - b.product.price);
        break;
      case 'price_desc':
        results.sort((a, b) => b.product.price - a.product.price);
        break;
      case 'rating':
        results.sort((a, b) => b.product.rating - a.product.rating);
        break;
      case 'newest':
        results.sort((a, b) => 
          new Date(b.product.created_at).getTime() - new Date(a.product.created_at).getTime()
        );
        break;
    }
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async suggest(prefix: string, limit: number = 10): Promise<string[]> {
    const cachedSuggestions = await cacheService.getAutocompleteSuggestions(prefix, limit);
    
    if (cachedSuggestions.length > 0) {
      return cachedSuggestions;
    }

    const collection = databaseConfig.getProductsCollection();
    const regex = new RegExp(`^${this.escapeRegex(prefix)}`, 'i');

    const titleSuggestions = await collection.distinct('title', { 
      title: regex 
    });

    const categorySuggestions = await collection.distinct('category', { 
      category: regex 
    });

    const brandSuggestions = await collection.distinct('brand', { 
      brand: regex 
    });

    const allSuggestions = [
      ...titleSuggestions.slice(0, 5),
      ...categorySuggestions.slice(0, 3),
      ...brandSuggestions.slice(0, 2)
    ];

    const uniqueSuggestions = Array.from(new Set(allSuggestions))
      .filter(s => s && s.toLowerCase().startsWith(prefix.toLowerCase()))
      .slice(0, limit);
    
    await cacheService.setAutocompleteSuggestions(prefix, uniqueSuggestions);

    return uniqueSuggestions;
  }

  async getProductsByCategory(category: string, page: number = 1, limit: number = 20): Promise<SearchResult> {
    const collection = databaseConfig.getProductsCollection();
    const skip = (page - 1) * limit;

    const products = await collection.find({ category })
      .sort({ rating: -1, price: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments({ category });

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getProductsByBrand(brand: string, page: number = 1, limit: number = 20): Promise<SearchResult> {
    const collection = databaseConfig.getProductsCollection();
    const skip = (page - 1) * limit;

    const products = await collection.find({ brand })
      .sort({ rating: -1, price: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments({ brand });

    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getTopRatedProducts(limit: number = 20): Promise<Product[]> {
    const collection = databaseConfig.getProductsCollection();
    
    return collection.find({ rating: { $gte: 4.5 } })
      .sort({ rating: -1, price: 1 })
      .limit(limit)
      .toArray();
  }
}

export const searchService = new SearchService();