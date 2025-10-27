import { redisConfig } from '../config/redis.config';
import { SearchResult } from '../models/product.model';

export class CacheService {
  private readonly CACHE_TTL = 3600;
  private readonly SEARCH_PREFIX = 'search:';
  private readonly AUTOCOMPLETE_PREFIX = 'autocomplete:';

  async getCachedSearch(query: string, page: number, limit: number): Promise<SearchResult | null> {
    try {
      const key = this.buildSearchKey(query, page, limit);
      const cached = await redisConfig.getClient().get(key);
      
      if (cached) {
        console.log(`Cache HIT for query: ${query}`);
        return JSON.parse(cached);
      }
      
      console.log(`Cache MISS for query: ${query}`);
      return null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async setCachedSearch(
    query: string, 
    page: number, 
    limit: number, 
    result: SearchResult
  ): Promise<void> {
    try {
      const key = this.buildSearchKey(query, page, limit);
      await redisConfig.getClient().setEx(
        key, 
        this.CACHE_TTL, 
        JSON.stringify(result)
      );
      console.log(`Cache SET for query: ${query}`);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async getAutocompleteSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    try {
      const key = `${this.AUTOCOMPLETE_PREFIX}${prefix.toLowerCase()}`;
      const cached = await redisConfig.getClient().get(key);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return [];
    } catch (error) {
      console.error('Redis autocomplete get error:', error);
      return [];
    }
  }

  async setAutocompleteSuggestions(prefix: string, suggestions: string[]): Promise<void> {
    try {
      const key = `${this.AUTOCOMPLETE_PREFIX}${prefix.toLowerCase()}`;
      await redisConfig.getClient().setEx(
        key, 
        this.CACHE_TTL, 
        JSON.stringify(suggestions)
      );
    } catch (error) {
      console.error('Redis autocomplete set error:', error);
    }
  }

  async invalidateCache(pattern: string): Promise<void> {
    try {
      const keys = await redisConfig.getClient().keys(`${pattern}*`);
      if (keys.length > 0) {
        await redisConfig.getClient().del(keys);
        console.log(`Invalidated ${keys.length} cache keys`);
      }
    } catch (error) {
      console.error('Redis invalidate error:', error);
    }
  }

  private buildSearchKey(query: string, page: number, limit: number): string {
    return `${this.SEARCH_PREFIX}${query.toLowerCase()}:${page}:${limit}`;
  }
}

export const cacheService = new CacheService();