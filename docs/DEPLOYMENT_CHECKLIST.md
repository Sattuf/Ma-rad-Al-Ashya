# Deployment Checklist

This document outlines the pre-release checks that must be performed before deploying a new version of the Marad project.

## 1. Code Quality & Testing
- [ ] All unit and integration tests are passing.
- [ ] Code coverage meets the minimum threshold (e.g., 80%).
- [ ] Linting and code style checks pass with no warnings.
- [ ] Security scans (e.g., SAST, dependency checks) are clean.

## 2. Infrastructure & Monitoring
- [ ] Terraform plan shows expected changes only.
- [ ] Kubernetes manifests (or Helm charts) are updated with new image tags.
- [ ] Prometheus metrics and Grafana dashboards are correctly configured.
- [ ] Log aggregation is working and properly mapped to the services.
- [ ] EKS HPA (Horizontal Pod Autoscaler) limits are configured appropriately for expected load.

## 3. Database & Caching
- [ ] Database migrations are reviewed and safely executable (e.g., non-blocking, backwards compatible).
- [ ] ElastiCache/Redis usage patterns are verified to avoid memory leaks.
- [ ] Backup and disaster recovery strategies are validated for the new release.

## 4. Load & Performance
- [ ] k6 load tests (`search-load.js`, `listings-browse-load.js`, `auth-load.js`) run successfully without degrading response times.
- [ ] Load balancer (AWS ALB) configuration allows sufficient throughput and routing rules are verified.
- [ ] Rate limiting and WAF rules are properly configured to prevent abuse.

## 5. Deployment Process
- [ ] Deploy staging environment and verify core functionalities.
- [ ] Execute smoke tests against the staging environment.
- [ ] Prepare rollback plan in case of critical failure in production.
- [ ] Deploy to production during off-peak hours (or using zero-downtime deployment strategies like Blue/Green).
- [ ] Run production smoke tests post-deployment.

## 6. Post-Deployment
- [ ] Monitor error rates and latency in Grafana dashboards.
- [ ] Check logs for any unexpected warnings or exceptions.
- [ ] Notify stakeholders of successful deployment.
