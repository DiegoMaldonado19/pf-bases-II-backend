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
    
    const pipeline = [
      {
        $match: {
          $or: [
            { title: { $regex: this.escapeRegex(query), $options: 'i' } },
            { category: { $regex: this.escapeRegex(query), $options: 'i' } },
            { brand: { $regex: this.escapeRegex(query), $options: 'i' } },
            { sku: { $regex: this.escapeRegex(query), $options: 'i' } },
            { product_type: { $regex: this.escapeRegex(query), $options: 'i' } }
          ]
        }
      },
      {
        $addFields: {
          relevanceScore: {
            $sum: [
              // Título: 5 puntos
              { $cond: [
                { $regexMatch: { input: "$title", regex: this.escapeRegex(query), options: "i" } },
                5,
                0
              ]},
              // Categoría: 4 puntos
              { $cond: [
                { $regexMatch: { input: "$category", regex: this.escapeRegex(query), options: "i" } },
                4,
                0
              ]},
              // Marca: 3 puntos
              { $cond: [
                { $regexMatch: { input: "$brand", regex: this.escapeRegex(query), options: "i" } },
                3,
                0
              ]},
              // SKU: 2 puntos
              { $cond: [
                { $regexMatch: { input: "$sku", regex: this.escapeRegex(query), options: "i" } },
                2,
                0
              ]},
              // Tipo de producto: 1 punto
              { $cond: [
                { $regexMatch: { input: "$product_type", regex: this.escapeRegex(query), options: "i" } },
                1,
                0
              ]}
            ]
          },
          matchedField: {
            $switch: {
              branches: [
                { 
                  case: { $regexMatch: { input: "$title", regex: this.escapeRegex(query), options: "i" } },
                  then: "title"
                },
                { 
                  case: { $regexMatch: { input: "$category", regex: this.escapeRegex(query), options: "i" } },
                  then: "category"
                },
                { 
                  case: { $regexMatch: { input: "$brand", regex: this.escapeRegex(query), options: "i" } },
                  then: "brand"
                },
                { 
                  case: { $regexMatch: { input: "$sku", regex: this.escapeRegex(query), options: "i" } },
                  then: "sku"
                },
                { 
                  case: { $regexMatch: { input: "$product_type", regex: this.escapeRegex(query), options: "i" } },
                  then: "product_type"
                }
              ],
              default: "title"
            }
          }
        }
      },
      {
        $sort: { relevanceScore: -1, rating: -1 }
      }
    ];

    const products = await collection.aggregate(pipeline).toArray() as any[];

    return products.map(p => ({
      product: p as Product,
      score: p.relevanceScore || 0,
      matchedField: p.matchedField || 'title'
    }));
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