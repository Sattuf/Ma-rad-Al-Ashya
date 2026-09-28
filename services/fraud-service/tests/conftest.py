import os

# Test-only secrets. Real deployments must inject their own values.
os.environ.setdefault("JWT_ACCESS_SECRET", "test-access-secret-not-for-production-use")
os.environ.setdefault("INTERNAL_SECRET", "test-internal-secret-not-for-production-use")
