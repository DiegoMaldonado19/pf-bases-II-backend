export interface Product {
  _id?: string;
  id: number;
  title: string;
  brand: string;
  category: string;
  product_type: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  sku: string;
  rating: number;
  created_at: Date;
}

export interface SearchResult {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RelevanceScore {
  product: Product;
  score: number;
  matchedField: 'title' | 'category' | 'brand' | 'sku' | 'product_type';
}