import { api } from './auth';

export interface PromotionPlan {
  id: 'basic' | 'featured' | 'premium';
  name: string;
  /** Charged amount, always from the server (never a client-side constant). */
  price: number;
  currency: string;
  durationDays: number;
  boostMultiplier: number;
  description: string;
  features: string[];
}

export interface Promotion {
  id: string;
  listingId: string;
  planId: string;
  status: 'active' | 'pending' | 'expired' | 'failed';
  startDate?: string;
  endDate?: string;
}

// Display copy only. It describes what listings-service actually does: a ranking boost
// in search results for a fixed period. Price and duration come from the server.
const PLAN_COPY: Record<PromotionPlan['id'], { name: string; description: string }> = {
  basic: { name: 'أساسي', description: 'يرفع ترتيب إعلانك في نتائج البحث.' },
  featured: { name: 'مميّز', description: 'دفعة أقوى في نتائج البحث لمدة أطول.' },
  premium: { name: 'ذهبي', description: 'أعلى أولوية في نتائج البحث لأطول مدة.' },
};

interface ServerPlan {
  id: PromotionPlan['id'];
  price: number;
  boost_multiplier: number;
  duration_days: number;
}

interface ServerPromotion {
  id: string;
  listingId: string;
  plan: string;
  stripePaymentStatus: 'pending' | 'succeeded' | 'failed';
  startsAt?: string | null;
  expiresAt?: string | null;
}

export const promotionsApi = {
  /** No offline fallback: showing a price the server would not charge is worse than an error. */
  getPlans: async (): Promise<PromotionPlan[]> => {
    const response = await api.get('/promotions/plans');
    return (response.data as ServerPlan[]).map((p) => ({
      id: p.id,
      name: PLAN_COPY[p.id]?.name ?? p.id,
      description: PLAN_COPY[p.id]?.description ?? '',
      price: Number(p.price),
      currency: 'USD',
      durationDays: p.duration_days,
      boostMultiplier: p.boost_multiplier,
      features: [`ترتيب أعلى ×${p.boost_multiplier} في نتائج البحث`, `لمدة ${p.duration_days} يوماً`, 'دفع آمن عبر Stripe'],
    }));
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
    const now = Date.now();
    return ((response.data ?? []) as ServerPromotion[]).map((p) => ({
      id: p.id,
      listingId: p.listingId,
      planId: p.plan,
      startDate: p.startsAt ?? undefined,
      endDate: p.expiresAt ?? undefined,
      status:
        p.stripePaymentStatus === 'failed'
          ? 'failed'
          : p.stripePaymentStatus === 'pending'
            ? 'pending'
            : p.expiresAt && new Date(p.expiresAt).getTime() > now
              ? 'active'
              : 'expired',
    }));
  },
};
