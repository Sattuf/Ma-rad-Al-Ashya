export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  services: {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    listings: process.env.LISTINGS_SERVICE_URL || 'http://localhost:3002',
    search: process.env.SEARCH_SERVICE_URL || 'http://localhost:3003',
    messaging: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
    transactions: process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:3005',
    identity: process.env.IDENTITY_SERVICE_URL || 'http://localhost:3006',
    fraud: process.env.FRAUD_SERVICE_URL || 'http://localhost:8001',
    personalization: process.env.PERSONALIZATION_SERVICE_URL || 'http://localhost:8002',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
});
