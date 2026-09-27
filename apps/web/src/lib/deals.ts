import type { DealStatus } from '@/lib/api/transactions';

/** Status from the viewer's side: "waiting for you" is an action, "waiting for them" is not. */
export function dealStatusLabel(status: DealStatus, role: 'buyer' | 'seller'): { label: string; tone: 'warning' | 'neutral' | 'success' | 'danger' } {
  switch (status) {
    case 'pending_seller':
      return role === 'seller' ? { label: 'بانتظار تأكيدك', tone: 'warning' } : { label: 'بانتظار تأكيد البائع', tone: 'neutral' };
    case 'pending_buyer':
      return role === 'buyer' ? { label: 'بانتظار تأكيدك', tone: 'warning' } : { label: 'بانتظار تأكيد المشتري', tone: 'neutral' };
    case 'completed':
      return { label: 'تمّت', tone: 'success' };
    case 'cancelled':
      return { label: 'أُلغيت', tone: 'danger' };
  }
}
