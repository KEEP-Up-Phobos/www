/**
 * Interests API - Client for fetching interest categories and managing user preferences
 */

import { API_URL } from './config';

interface InterestCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  itemCount: number;
}

interface InterestItem {
  id: string;
  name: string;
  rank: number;
}

interface CategoryDetails {
  id: string;
  name: string;
  icon: string;
  description: string;
  source: string;
}

interface UserInterest {
  itemId: string;
  weight: number;
}

interface UserInterestsMap {
  [categoryId: string]: UserInterest[];
}

export const interestsAPI = {
  /**
   * Get all interest categories
   */
  async getCategories(): Promise<InterestCategory[]> {
    const response = await fetch(`${API_URL}/api/interests/categories`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch categories');
    return data.categories;
  },

  /**
   * Get items for a specific category
   */
  async getCategoryItems(categoryId: string): Promise<{ category: CategoryDetails; items: InterestItem[] }> {
    const response = await fetch(`${API_URL}/api/interests/category/${categoryId}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch category items');
    return { category: data.category, items: data.items };
  },

  /**
   * Get all categories with their items
   */
  async getAllCategoriesWithItems(): Promise<Array<CategoryDetails & { items: InterestItem[] }>> {
    const categories = await this.getCategories();
    const results = await Promise.all(
      categories.map(async (cat) => {
        const { category, items } = await this.getCategoryItems(cat.id);
        return { ...category, items };
      })
    );
    return results;
  },

  /**
   * Get user's selected interests
   */
  async getUserInterests(userId: number, token?: string): Promise<UserInterestsMap> {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/api/interests/user/${userId}`, { headers });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch user interests');
    return data.interests || {};
  },

  /**
   * Save user's interests
   */
  async saveUserInterests(userId: number, interests: Record<string, string[]>, token?: string): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/api/interests/user/${userId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ interests }),
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Failed to save interests');
  },

  /**
   * Get events matching user's interests
   */
  async getMatchingEvents(userId: number, options?: { lat?: number; lng?: number; radius?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (options?.lat) params.set('lat', String(options.lat));
    if (options?.lng) params.set('lng', String(options.lng));
    if (options?.radius) params.set('radius', String(options.radius));
    if (options?.limit) params.set('limit', String(options.limit));

    const response = await fetch(`${API_URL}/api/interests/match/${userId}?${params}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Failed to fetch matching events');
    return data;
  },
};

export type { InterestCategory, InterestItem, CategoryDetails, UserInterest, UserInterestsMap };
