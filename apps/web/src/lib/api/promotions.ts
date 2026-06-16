import { api } from './auth';

export interface PromotionPlan {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  description: string;
  features: string[];
}

export interface Promotion {
  id: string;
  listingId: string;
  planId: string;
  status: 'active' | 'expired';
  startDate: string;
  endDate: string;
}

const STORAGE_KEY = 'marad_promoted_listings';

// Helper to get local promotions from localStorage
const getLocalPromotions = (): Promotion[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

// Helper to save a local promotion
export const saveLocalPromotion = (listingId: string, planId: string, durationDays: number): Promotion => {
  const promotions = getLocalPromotions();
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + durationDays);

  const newPromo: Promotion = {
    id: `promo_${Math.random().toString(36).substr(2, 9)}`,
    listingId,
    planId,
    status: 'active',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };

  promotions.push(newPromo);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(promotions));
  return newPromo;
};

export const promotionsApi = {
  getPlans: async (): Promise<PromotionPlan[]> => {
    try {
      const response = await api.get('/promotions/plans');
      return response.data;
    } catch (error) {
      // Fallback plans in case the backend is not ready
      return [
        {
          id: 'basic',
          name: 'أساسي (Basic)',
          price: 49,
          durationDays: 7,
          description: 'ترقية الإعلان ووضعه في مقدمة القائمة لمدة 7 أيام.',
          features: ['ظهور متقدم في نتائج البحث', 'علامة تمييز بسيطة', 'دعم فني عادي'],
        },
        {
          id: 'featured',
          name: 'مميز (Featured)',
          price: 99,
          durationDays: 14,
          description: 'وضع الإعلان في قائمة العقارات المميزة مع فرصة تصفح أعلى بـ 3 أضعاف.',
          features: ['ظهور في قسم العقارات المميزة', 'شارة "مروّج 🚀" بارزة', 'إحصائيات متقدمة للمشاهدات', 'دعم فني سريع'],
        },
        {
          id: 'premium',
          name: 'ذهبي (Premium)',
          price: 199,
          durationDays: 30,
          description: 'أقصى درجات الظهور والتفاعل. يثبت الإعلان في الصفحة الرئيسية مع ترويج مكثف.',
          features: ['تثبيت في أعلى الصفحة الرئيسية', 'شارة "مروّج 🚀" ذهبية براقة', 'تنبيهات للمشتركين المهتمين', 'دعم فني على مدار الساعة', 'تقارير أسبوعية مفصلة'],
        },
      ];
    }
  },

  createPaymentIntent: async (listingId: string, plan: PromotionPlan): Promise<{ clientSecret: string; isMock?: boolean }> => {
    try {
      const response = await api.post('/promotions/payment-intent', { listingId, planId: plan.id });
      return response.data;
    } catch (error) {
      console.warn('Backend API for payment-intent failed or not available, using mock client secret');
      // Return a simulated client secret for the frontend fallback
      return {
        clientSecret: `mock_secret_${listingId}_${plan.id}_${Date.now()}`,
        isMock: true,
      };
    }
  },

  getMyPromotions: async (): Promise<Promotion[]> => {
    try {
      const response = await api.get('/promotions/my');
      const apiPromos = response.data || [];
      const localPromos = getLocalPromotions();
      // Combine API promotions and local promotions, avoiding duplicates
      const allPromos = [...apiPromos];
      localPromos.forEach(lp => {
        if (!allPromos.some(ap => ap.listingId === lp.listingId)) {
          allPromos.push(lp);
        }
      });
      return allPromos;
    } catch (error) {
      return getLocalPromotions();
    }
  },
};
