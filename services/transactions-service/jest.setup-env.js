// Test-only secrets. Real deployments must inject their own values.
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-not-for-production-use';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-not-for-production-use';
process.env.INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'test-internal-secret-not-for-production-use';
