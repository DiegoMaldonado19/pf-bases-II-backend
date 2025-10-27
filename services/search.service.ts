import { databaseConfig } from '../config/database.config';
import { Product, SearchResult, RelevanceScore } from '../models/product.model';
import { cacheService } from './cache.service';

export class SearchService {
  async search(query: string, page: number = 1, limit: number = 20): Promise<SearchResult> {
    const cachedResult = await cacheService.getCachedSearch(query, page, limit);
    
    if (cachedResult) {
      return cachedResult;
    }

    const trimmedQuery = query.trim().toLowerCase();
    const skip = (page - 1) * limit;

    const rankedResults = await this.searchWithRelevance(trimmedQuery);

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

    await cacheService.setCachedSearch(query, page, limit, result);

    return result;
  }

  private async searchWithRelevance(query: string): Promise<RelevanceScore[]> {
    const collection = databaseConfig.getProductsCollection();
    const results: RelevanceScore[] = [];

    const titleMatches = await collection.find({
      title: { $regex: query, $options: 'i' }
    }).toArray();
    titleMatches.forEach(product => {
      results.push({ product, score: 5, matchedField: 'title' });
    });

    const categoryMatches = await collection.find({
      category: { $regex: query, $options: 'i' },
      _id: { $nin: titleMatches.map(p => p._id) }
    }).toArray();
    categoryMatches.forEach(product => {
      results.push({ product, score: 4, matchedField: 'category' });
    });

    const brandMatches = await collection.find({
      brand: { $regex: query, $options: 'i' },
      _id: { $nin: [...titleMatches, ...categoryMatches].map(p => p._id) }
    }).toArray();
    brandMatches.forEach(product => {
      results.push({ product, score: 3, matchedField: 'brand' });
    });

    const skuMatches = await collection.find({
      sku: { $regex: query, $options: 'i' },
      _id: { $nin: [...titleMatches, ...categoryMatches, ...brandMatches].map(p => p._id) }
    }).toArray();
    skuMatches.forEach(product => {
      results.push({ product, score: 2, matchedField: 'sku' });
    });

    const productTypeMatches = await collection.find({
      product_type: { $regex: query, $options: 'i' },
      _id: { $nin: [...titleMatches, ...categoryMatches, ...brandMatches, ...skuMatches].map(p => p._id) }
    }).toArray();
    productTypeMatches.forEach(product => {
      results.push({ product, score: 1, matchedField: 'product_type' });
    });

    return results.sort((a, b) => b.score - a.score);
  }

  async suggest(prefix: string, limit: number = 10): Promise<string[]> {
    const cachedSuggestions = await cacheService.getAutocompleteSuggestions(prefix, limit);
    
    if (cachedSuggestions.length > 0) {
      return cachedSuggestions;
    }

    const collection = databaseConfig.getProductsCollection();
    const regex = new RegExp(`^${prefix}`, 'i');

    const suggestions = await collection.aggregate([
      {
        $match: {
          $or: [
            { title: regex },
            { category: regex },
            { brand: regex }
          ]
        }
      },
      {
        $project: {
          _id: 0,
          suggestions: [
            { $cond: [{ $regexMatch: { input: "$title", regex: prefix, options: "i" } }, "$title", null] },
            { $cond: [{ $regexMatch: { input: "$category", regex: prefix, options: "i" } }, "$category", null] },
            { $cond: [{ $regexMatch: { input: "$brand", regex: prefix, options: "i" } }, "$brand", null] }
          ]
        }
      },
      { $unwind: "$suggestions" },
      { $match: { suggestions: { $ne: null } } },
      { $group: { _id: "$suggestions" } },
      { $limit: limit },
      { $project: { _id: 0, suggestion: "$_id" } }
    ]).toArray();

    const result = suggestions.map(s => s.suggestion);
    
    await cacheService.setAutocompleteSuggestions(prefix, result);

    return result;
  }
}

export const searchService = new SearchService();