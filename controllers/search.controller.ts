import { Request, Response } from 'express';
import { searchService } from '../services/search.service';

export class SearchController {
  async search(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const sortBy = req.query.sortBy as 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | undefined;

      if (!query || query.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Query parameter "q" is required'
        });
        return;
      }

      if (page < 1) {
        res.status(400).json({
          success: false,
          message: 'Page must be greater than 0'
        });
        return;
      }

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100'
        });
        return;
      }

      const startTime = Date.now();
      const result = await searchService.search(query, page, limit, sortBy);
      const duration = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: result,
        performance: {
          duration: `${duration}ms`,
          cached: duration < 50
        }
      });
    } catch (error: any) {
      console.error('Search endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        error: error.message
      });
    }
  }

  async suggest(req: Request, res: Response): Promise<void> {
    try {
      const prefix = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!prefix || prefix.trim().length < 2) {
        res.status(400).json({
          success: false,
          message: 'Query parameter "q" must be at least 2 characters'
        });
        return;
      }

      if (limit < 1 || limit > 50) {
        res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 50'
        });
        return;
      }

      const startTime = Date.now();
      const suggestions = await searchService.suggest(prefix, limit);
      const duration = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          suggestions,
          count: suggestions.length
        },
        performance: {
          duration: `${duration}ms`
        }
      });
    } catch (error: any) {
      console.error('Suggest endpoint error:', error);
      res.status(500).json({
        success: false,
        message: 'Autocomplete failed',
        error: error.message
      });
    }
  }

  async getByCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = req.params.category;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await searchService.getProductsByCategory(category, page, limit);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Get by category error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get products by category',
        error: error.message
      });
    }
  }

  async getByBrand(req: Request, res: Response): Promise<void> {
    try {
      const brand = req.params.brand;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await searchService.getProductsByBrand(brand, page, limit);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Get by brand error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get products by brand',
        error: error.message
      });
    }
  }

  async getTopRated(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;

      const products = await searchService.getTopRatedProducts(limit);

      res.status(200).json({
        success: true,
        data: {
          products,
          count: products.length
        }
      });
    } catch (error: any) {
      console.error('Get top rated error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get top rated products',
        error: error.message
      });
    }
  }
}

export const searchController = new SearchController();