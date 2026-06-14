/**
 * خريطة الخدمات المصغرة — Microservices URL Map
 * تحدد عناوين الخدمات الخلفية التي يوجه إليها الـ API Gateway
 */
export interface ServiceConfig {
  name: string;
  url: string;
  prefix: string;
  description: string;
}

export const SERVICES_CONFIG: ServiceConfig[] = [
  {
    name: 'auth-service',
    url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    prefix: 'auth',
    description: 'خدمة المصادقة والتفويض — Authentication & Authorization',
  },
  {
    name: 'listings-service',
    url: process.env.LISTINGS_SERVICE_URL || 'http://localhost:3002',
    prefix: 'listings',
    description: 'خدمة إدارة الإعلانات — Listings Management',
  },
  {
    name: 'search-service',
    url: process.env.SEARCH_SERVICE_URL || 'http://localhost:3003',
    prefix: 'search',
    description: 'خدمة البحث — Search Service',
  },
  {
    name: 'messaging-service',
    url: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
    prefix: 'messages',
    description: 'خدمة المحادثات الفورية — Real-time Messaging',
  },
  {
    name: 'transactions-service',
    url: process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:3005',
    prefix: 'transactions',
    description: 'خدمة إدارة المعاملات — Transactions Management',
  },
  {
    name: 'identity-service',
    url: process.env.IDENTITY_SERVICE_URL || 'http://localhost:3006',
    prefix: 'identity',
    description: 'خدمة التحقق من الهوية — Identity Verification',
  },
  {
    name: 'fraud-service',
    url: process.env.FRAUD_SERVICE_URL || 'http://localhost:8001',
    prefix: 'fraud',
    description: 'خدمة كشف الاحتيال — Fraud Detection',
  },
  {
    name: 'personalization-service',
    url: process.env.PERSONALIZATION_SERVICE_URL || 'http://localhost:8002',
    prefix: 'recommendations',
    description: 'خدمة التخصيص والتوصيات — Personalization & Recommendations',
  },
];
