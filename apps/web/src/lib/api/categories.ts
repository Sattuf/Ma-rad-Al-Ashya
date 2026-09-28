import { api } from './auth';
import type { Category } from '@/types/listing';

export const categoriesApi = {
  /** Category tree (roots with children). Cached 5 minutes at the gateway. */
  getTree: async (): Promise<Category[]> => {
    const response = await api.get('/categories');
    return response.data;
  },
};

/** Flattens the tree for a select, indenting children. */
export function flattenCategories(tree: Category[], depth = 0): Array<Category & { depth: number }> {
  return tree.flatMap((c) => [{ ...c, depth }, ...flattenCategories(c.children ?? [], depth + 1)]);
}
