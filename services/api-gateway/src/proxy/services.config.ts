/**
 * خريطة الخدمات المصغرة — Microservices URL Map
 * تحدد عناوين الخدمات الخلفية التي يوجه إليها الـ API Gateway
 */
export interface ServiceConfig {
  name: string;
  url: string;
  prefix: string;
  description: string;
  /**
   * When false, the prefix is kept in the forwarded path. Needed for services whose
   * controllers are mounted under the same name (e.g. `@Controller('listings')`).
   * Defaults to true (prefix removed).
   */
  stripPrefix?: boolean;
  /** Short TTL cache for anonymous GETs (seconds). Omit to disable. */
  cacheTtlSeconds?: number;
  /**
   * Which forwarded paths may be cached. Detail pages (e.g. /listings/:id) are excluded
   * because the service counts a view on every request.
   */
  cacheableRoutes?: RegExp;
}

/**
 * Service-to-service endpoints. They are protected by INTERNAL_SECRET in the services,
 * and additionally never exposed through the public gateway (defense in depth).
 * Matched against `${METHOD} /${forwardedPath}`.
 */
export const BLOCKED_ROUTES: { service: string; method: string; pattern: RegExp }[] = [
  { service: 'listings-service', method: 'POST', pattern: /^\/listings\/batch\/?$/i },
  { service: 'listings-service', method: 'PUT', pattern: /^\/listings\/[^/]+\/status\/?$/i },
  { service: 'users-service', method: '*', pattern: /^\/users\/[^/]+\/(status|verify)\/?$/i },
  { service: 'search-service', method: 'POST', pattern: /^\/search\/index\/?$/i },
  { service: 'search-service', method: 'PUT', pattern: /^\/search\/listings\/[^/]+\/boost\/?$/i },
  { service: 'fraud-service', method: '*', pattern: /^\/fraud\/(device|transaction)(\/|$)/i },
];

/**
 * Public paths served by another service than their prefix: forwarded with the full path.
 * Matched against the client path after /api/v1.
 */
export const ROUTE_OVERRIDES: { pattern: RegExp; service: string }[] = [
  // Reviews and ratings are owned by transactions-service but read under the user.
  { pattern: /^\/users\/[^/]+\/(reviews|rating-summary)\/?$/i, service: 'transactions-service' },
];

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
    stripPrefix: false,
    cacheTtlSeconds: 30,
    cacheableRoutes: /^\/listings(\/(user|category)\/[^/]+)?\/?$/,
  },
  {
    name: 'categories-service',
    url: process.env.LISTINGS_SERVICE_URL || 'http://localhost:3002',
    prefix: 'categories',
    description: 'Categories Management (routes to listings-service)',
    stripPrefix: false,
    cacheTtlSeconds: 300,
  },
  {
    name: 'promotions-service',
    url: process.env.LISTINGS_SERVICE_URL || 'http://localhost:3002',
    prefix: 'promotions',
    description: 'Promotions and Boosting Management',
    stripPrefix: false,
  },
  {
    name: 'search-service',
    url: process.env.SEARCH_SERVICE_URL || 'http://localhost:3003',
    prefix: 'search',
    description: 'خدمة البحث — Search Service',
    stripPrefix: false,
    cacheTtlSeconds: 30,
    cacheableRoutes: /^\/search(\/(suggestions|autocomplete|map|related|categories\/stats))?\/?$/,
  },
  {
    name: 'messaging-service',
    url: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
    prefix: 'messages',
    description: 'خدمة المحادثات الفورية — Real-time Messaging',
    stripPrefix: false,
  },
  {
    name: 'messaging-service-conversations',
    url: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
    prefix: 'conversations',
    description: 'خدمة المحادثات الفورية — Real-time Messaging (Conversations)',
    stripPrefix: false,
  },
  {
    // Mobile app uses /api/v1/messaging/conversations/...
    name: 'messaging-service-mobile',
    url: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
    prefix: 'messaging',
    description: 'Messaging (mobile path alias)',
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
    stripPrefix: false,
  },
  {
    name: 'users-service',
    url: process.env.USERS_SERVICE_URL || 'http://localhost:3007',
    prefix: 'users',
    description: 'User Profile and Notifications Management',
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
  {
    name: 'fraud-service',
    url: process.env.FRAUD_SERVICE_URL || 'http://localhost:8001',
    prefix: 'fraud',
    description: 'خدمة كشف الاحتيال — Fraud Detection',
    stripPrefix: false,
  },
  {
    name: 'personalization-service',
    url: process.env.PERSONALIZATION_SERVICE_URL || 'http://localhost:8002',
    prefix: 'recommendations',
    description: 'خدمة التخصيص والتوصيات — Personalization & Recommendations',
    stripPrefix: false,
  },
  {
    name: 'personalization-events',
    url: process.env.PERSONALIZATION_SERVICE_URL || 'http://localhost:8002',
    prefix: 'events',
    description: 'Personalization Events',
    stripPrefix: false,
  },
];
