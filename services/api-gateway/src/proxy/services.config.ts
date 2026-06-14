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
    name: 'messaging-service-conversations',
    url: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
    prefix: 'conversations',
    description: 'خدمة المحادثات الفورية — Real-time Messaging (Conversations)',
  },
  {
    name: 'transactions-service',
    url: process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:3005',
    prefix: 'transactions',
    description: 'خدمة إدارة المعاملات — Transactions Management',
  },
  {
    name: 'transactions-service-reviews',
    url: process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:3005',
    prefix: 'reviews',
    description: 'Reviews Management',
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
  {
    name: 'users-service',
    url: process.env.USERS_SERVICE_URL || 'http://localhost:3007',
    prefix: 'users',
    description: 'User Profile and Notifications Management',
  },
  {
    name: 'listings-service',
    url: process.env.LISTINGS_SERVICE_URL || 'http://localhost:3002',
    prefix: 'listings',
    description: 'Listings and Categories Management',
  },
  {
    name: 'categories-service',
    url: process.env.LISTINGS_SERVICE_URL || 'http://localhost:3002',
    prefix: 'categories',
    description: 'Categories Management (routes to listings-service)',
  },
  {
    name: 'moderation-service',
    url: process.env.MODERATION_SERVICE_URL || 'http://localhost:3008',
    prefix: 'reports',
    description: 'Moderation and Reports',
  },
  {
    name: 'moderation-service-admin',
    url: process.env.MODERATION_SERVICE_URL || 'http://localhost:3008',
    prefix: 'admin',
    description: 'Moderation Admin',
  },
];
