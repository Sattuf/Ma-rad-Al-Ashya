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

  /**
   * Creates the Stripe PaymentIntent on listings-service. There is deliberately no fallback:
   * a promotion only exists once Stripe confirms the payment (webhook) — never client-side.
   */
  createPaymentIntent: async (listingId: string, plan: PromotionPlan): Promise<{ clientSecret: string }> => {
    const response = await api.post('/promotions/create-payment-intent', { listingId, plan: plan.id });
    return { clientSecret: response.data.client_secret };
  },

  getMyPromotions: async (): Promise<Promotion[]> => {
    const response = await api.get('/promotions/my');
    return response.data || [];
  },
};
