# إعداد البنية التحتية على AWS — AWS Infrastructure Setup

> **ملاحظة:** هذا المستند للتوثيق والتخطيط فقط في الوقت الحالي. سيتم تنفيذ الإعداد الفعلي
> في مرحلة لاحقة عندما يصبح المشروع جاهزاً للنشر (Deployment).

---

## نظرة عامة

يعتمد مشروع **معرض الأشياء** على بنية Microservices مُستضافة على **Amazon Web Services (AWS)**.
تم اختيار منطقة **me-south-1 (البحرين)** كمنطقة أساسية لتقليل زمن الاستجابة (Latency)
للمستخدمين في منطقة الشرق الأوسط.

### المكونات الرئيسية:
| المكون | الخدمة على AWS | الغرض |
|--------|---------------|-------|
| تخزين الوسائط | S3 + CloudFront | صور المنتجات والملفات المرفوعة |
| تنسيق الحاويات | EKS (Kubernetes) | تشغيل الخدمات المصغّرة |
| قاعدة البيانات | RDS (PostgreSQL) | تخزين البيانات الأساسية |
| التخزين المؤقت | ElastiCache (Redis) | الجلسات والتخزين المؤقت |
| الإشعارات | SES / SNS | البريد الإلكتروني والإشعارات |

---

## 1. تخزين الوسائط — S3 + CloudFront

### إعداد S3 Bucket

| الإعداد | القيمة |
|---------|--------|
| **Bucket Name** | `marad-media-{environment}` (مثال: `marad-media-production`) |
| **Region** | `me-south-1` (البحرين) |
| **Versioning** | مُفعّل (Enabled) |
| **Encryption** | AES-256 (SSE-S3) |
| **Access** | خاص — الوصول عبر CloudFront OAI فقط |

#### قواعد دورة الحياة — Lifecycle Rules
- **بعد 90 يوماً:** نقل إلى S3 Infrequent Access (IA) لتقليل التكلفة
- **بعد 365 يوماً:** نقل إلى S3 Glacier للأرشفة طويلة الأمد

#### إعداد CORS
يجب تفعيل CORS للسماح بالوصول من تطبيقات الويب والموبايل:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": [
      "https://marad.app",
      "https://*.marad.app",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

#### Bucket Policy — سياسة الوصول
يُسمح بالوصول فقط عبر CloudFront Origin Access Identity (OAI):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity <OAI_ID>"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::marad-media-production/*"
    }
  ]
}
```

#### Terraform — S3 Bucket

```hcl
resource "aws_s3_bucket" "media" {
  bucket = "marad-media-${var.environment}"

  tags = {
    Project     = "marad"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "media-lifecycle"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

---

### إعداد CloudFront Distribution

| الإعداد | القيمة |
|---------|--------|
| **Origin** | S3 Bucket مع OAI |
| **Price Class** | `PriceClass_200` (أمريكا الشمالية + أوروبا + آسيا + الشرق الأوسط) |
| **Custom Domain** | `media.marad.app` (مستقبلاً) |
| **SSL Certificate** | ACM Certificate (مُدار من AWS) |
| **Cache TTL** | `max-age=31536000` (سنة كاملة) للصور |
| **WAF** | سيتم ربطه مستقبلاً لحماية المحتوى |

#### سلوك التخزين المؤقت — Cache Behavior
- الصور (`*.jpg`, `*.png`, `*.webp`): تُخزّن مؤقتاً لمدة سنة كاملة (31536000 ثانية)
- يتم استخدام **Versioned URLs** لتحديث المحتوى عند الحاجة بدلاً من إبطال Cache

#### Terraform — CloudFront Distribution

```hcl
resource "aws_cloudfront_origin_access_identity" "media" {
  comment = "OAI for marad-media S3 bucket"
}

resource "aws_cloudfront_distribution" "media" {
  origin {
    domain_name = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id   = "S3-marad-media"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.media.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"
  comment             = "Ma'rad Al-Ashya' Media CDN"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-marad-media"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # عند ربط Domain مخصص:
    # acm_certificate_arn      = aws_acm_certificate.media.arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Project     = "marad"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

---

## 2. إعداد Kubernetes — EKS

### المتطلبات الأساسية

تأكد من تثبيت الأدوات التالية قبل البدء:

| الأداة | الإصدار المطلوب | الغرض |
|--------|----------------|-------|
| **AWS CLI** | v2.x | التواصل مع خدمات AWS |
| **eksctl** | أحدث إصدار | إنشاء وإدارة EKS Clusters |
| **kubectl** | متوافق مع K8s 1.30 | إدارة موارد Kubernetes |
| **helm** | v3.x | تثبيت Charts الجاهزة |

#### التحقق من التثبيت:
```bash
aws --version          # AWS CLI v2.x
eksctl version         # eksctl 0.x.x
kubectl version --client # Kubernetes Client v1.30.x
helm version           # Helm v3.x
```

---

### إنشاء EKS Cluster

| الإعداد | القيمة |
|---------|--------|
| **Cluster Name** | `marad-cluster-{environment}` |
| **Kubernetes Version** | 1.30 |
| **Region** | `me-south-1` (البحرين) |

#### Node Groups — مجموعات العقد

| المجموعة | النوع | العدد الأولي | الحد الأدنى | الحد الأقصى | الغرض |
|-----------|-------|-------------|------------|------------|-------|
| `general` | `t3.medium` | 2 | 2 | 5 | تشغيل الخدمات المصغّرة (Microservices) |
| `data` | `t3.large` | 2 | 1 | 3 | قواعد البيانات (في حال الاستضافة الذاتية) |

#### أمر إنشاء الـ Cluster:

```bash
eksctl create cluster \
  --name marad-cluster-production \
  --version 1.30 \
  --region me-south-1 \
  --nodegroup-name general \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed \
  --asg-access \
  --full-ecr-access
```

#### إضافة مجموعة عقد البيانات:

```bash
eksctl create nodegroup \
  --cluster marad-cluster-production \
  --name data \
  --region me-south-1 \
  --node-type t3.large \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 3 \
  --managed
```

---

### إعداد Namespaces

يتم تقسيم البيئات باستخدام Kubernetes Namespaces:

```bash
# إنشاء Namespaces
kubectl create namespace marad-prod        # بيئة الإنتاج
kubectl create namespace marad-staging     # بيئة الاختبار
kubectl create namespace marad-monitoring  # أدوات المراقبة (Prometheus / Grafana)
```

| Namespace | الغرض |
|-----------|-------|
| `marad-prod` | بيئة الإنتاج — جميع الخدمات المصغّرة |
| `marad-staging` | بيئة الاختبار — للمراجعة قبل النشر |
| `marad-monitoring` | أدوات المراقبة: Prometheus، Grafana، Alertmanager |

---

### Helm Charts المطلوبة

#### 1. ingress-nginx — موازن التحميل (Load Balancer)

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"=nlb
```

#### 2. cert-manager — شهادات SSL

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

#### 3. prometheus-community/kube-prometheus-stack — المراقبة

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace marad-monitoring \
  --set grafana.adminPassword="<SECURE_PASSWORD>" \
  --set prometheus.prometheusSpec.retention=30d
```

#### 4. elasticsearch — محرك البحث

```bash
helm repo add elastic https://helm.elastic.co
helm repo update

helm install elasticsearch elastic/elasticsearch \
  --namespace marad-prod \
  --set replicas=2 \
  --set resources.requests.memory="1Gi" \
  --set resources.limits.memory="2Gi" \
  --set volumeClaimTemplate.resources.requests.storage=30Gi
```

---

## 3. قاعدة البيانات المُدارة — RDS

### مواصفات PostgreSQL

| الإعداد | التطوير (Dev) | الإنتاج (Production) |
|---------|-------------|---------------------|
| **المحرك** | PostgreSQL 16 | PostgreSQL 16 |
| **Instance Class** | `db.t3.medium` | `db.r6g.large` |
| **التخزين** | 20 GB (gp3) | 100 GB (gp3) |
| **Multi-AZ** | ❌ معطّل | ✅ مُفعّل |
| **النسخ الاحتياطي** | 7 أيام | 7 أيام |
| **التشفير** | ✅ مُفعّل | ✅ مُفعّل |

### Terraform — RDS

```hcl
resource "aws_db_instance" "marad_postgres" {
  identifier     = "marad-db-${var.environment}"
  engine         = "postgres"
  engine_version = "16"

  instance_class        = var.environment == "production" ? "db.r6g.large" : "db.t3.medium"
  allocated_storage     = var.environment == "production" ? 100 : 20
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "marad"
  username = "marad_admin"
  password = var.db_password # يُخزّن في AWS Secrets Manager

  multi_az               = var.environment == "production" ? true : false
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.marad.name

  backup_retention_period = 7
  backup_window           = "03:00-04:00" # توقيت UTC — الساعة 6 صباحاً بتوقيت الرياض
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection = var.environment == "production" ? true : false
  skip_final_snapshot = var.environment == "production" ? false : true
  final_snapshot_identifier = "marad-db-final-${var.environment}"

  tags = {
    Project     = "marad"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_db_subnet_group" "marad" {
  name       = "marad-db-subnet-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Project     = "marad"
    Environment = var.environment
  }
}
```

---

## 4. Amazon ElastiCache — Redis

### مواصفات Redis

| الإعداد | التطوير (Dev) | الإنتاج (Production) |
|---------|-------------|---------------------|
| **المحرك** | Redis 7.x | Redis 7.x |
| **Node Type** | `cache.t3.micro` | `cache.r6g.large` |
| **عدد العقد** | 1 | 2 (مع Replica) |
| **التشفير أثناء النقل** | ✅ مُفعّل | ✅ مُفعّل |
| **التشفير في التخزين** | ✅ مُفعّل | ✅ مُفعّل |

### الاستخدامات:
- **إدارة الجلسات (Sessions):** تخزين جلسات المستخدمين
- **التخزين المؤقت (Caching):** نتائج البحث والبيانات المتكررة
- **Rate Limiting:** تحديد عدد الطلبات لكل مستخدم
- **قوائم الانتظار (Queues):** معالجة المهام غير المتزامنة عبر BullMQ

### Terraform — ElastiCache

```hcl
resource "aws_elasticache_replication_group" "marad_redis" {
  replication_group_id = "marad-redis-${var.environment}"
  description          = "Ma'rad Al-Ashya' Redis cluster"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.environment == "production" ? "cache.r6g.large" : "cache.t3.micro"
  num_cache_clusters   = var.environment == "production" ? 2 : 1
  port                 = 6379

  subnet_group_name    = aws_elasticache_subnet_group.marad.name
  security_group_ids   = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token # يُخزّن في Secrets Manager

  automatic_failover_enabled = var.environment == "production" ? true : false

  snapshot_retention_limit = 3
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "sun:05:00-sun:07:00"

  tags = {
    Project     = "marad"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_elasticache_subnet_group" "marad" {
  name       = "marad-redis-subnet-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Project     = "marad"
    Environment = var.environment
  }
}
```

---

## 5. IAM Roles و Policies

### الأدوار المطلوبة

#### 1. EKS Node Role
الدور الأساسي لعقد Kubernetes:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:CreateLogGroup"
      ],
      "Resource": "*"
    }
  ]
}
```

**Managed Policies المطلوبة:**
- `AmazonEKSWorkerNodePolicy`
- `AmazonEKS_CNI_Policy`
- `AmazonEC2ContainerRegistryReadOnly`

#### 2. S3 Access Role — الوصول لتخزين الوسائط
للخدمات التي ترفع وتقرأ صور المنتجات (مثل `listings-service`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowMediaUpload",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::marad-media-${environment}",
        "arn:aws:s3:::marad-media-${environment}/*"
      ]
    }
  ]
}
```

#### 3. RDS Access — الوصول لقاعدة البيانات
يتم التحكم بالوصول إلى RDS عبر **Security Groups** بدلاً من IAM Policies:
- فقط العقد الموجودة داخل VPC والمرتبطة بـ Security Group المسموح يمكنها الوصول إلى قاعدة البيانات
- لا يوجد وصول عام (Public Access) مُفعّل

#### 4. SES / SNS — الإشعارات (مستقبلاً)
للخدمات التي ترسل إشعارات بالبريد الإلكتروني أو Push Notifications:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSendEmail",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowSNSPublish",
      "Effect": "Allow",
      "Action": [
        "sns:Publish"
      ],
      "Resource": "arn:aws:sns:me-south-1:*:marad-*"
    }
  ]
}
```

---

## 6. الأمان — Security Checklist

### قائمة التحقق الأمني

| # | البند | الحالة | الوصف |
|---|-------|--------|-------|
| 1 | **VPC مع شبكات فرعية خاصة** | 🔲 مُخطط | جميع الخدمات تعمل في Private Subnets |
| 2 | **Security Groups لكل طبقة** | 🔲 مُخطط | فصل قواعد الوصول بين Web / App / Data tiers |
| 3 | **AWS Secrets Manager** | 🔲 مُخطط | تخزين مفاتيح API وكلمات المرور والأسرار |
| 4 | **WAF لـ API Gateway** | 🔲 مُخطط | حماية من SQL Injection و XSS وهجمات DDoS |
| 5 | **CloudTrail** | 🔲 مُخطط | تسجيل جميع العمليات للمراجعة والتدقيق (Audit) |
| 6 | **تشفير البيانات** | 🔲 مُخطط | تشفير البيانات أثناء النقل (TLS) وفي التخزين (at-rest) |

### هيكل الشبكة — VPC Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     VPC (10.0.0.0/16)                   │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  Public Subnet    │    │  Public Subnet    │          │
│  │  10.0.1.0/24      │    │  10.0.2.0/24      │          │
│  │  ┌──────────────┐ │    │  ┌──────────────┐ │          │
│  │  │  NAT Gateway │ │    │  │  ALB / NLB   │ │          │
│  │  └──────────────┘ │    │  └──────────────┘ │          │
│  └──────────────────┘    └──────────────────┘          │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  Private Subnet   │    │  Private Subnet   │          │
│  │  10.0.10.0/24     │    │  10.0.20.0/24     │          │
│  │  ┌──────────────┐ │    │  ┌──────────────┐ │          │
│  │  │  EKS Nodes   │ │    │  │  EKS Nodes   │ │          │
│  │  └──────────────┘ │    │  └──────────────┘ │          │
│  └──────────────────┘    └──────────────────┘          │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  Data Subnet      │    │  Data Subnet      │          │
│  │  10.0.100.0/24    │    │  10.0.200.0/24    │          │
│  │  ┌──────────────┐ │    │  ┌──────────────┐ │          │
│  │  │  RDS / Redis │ │    │  │  RDS Standby │ │          │
│  │  └──────────────┘ │    │  └──────────────┘ │          │
│  └──────────────────┘    └──────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

### Security Groups — مجموعات الأمان

| Security Group | المنفذ | المصدر | الغرض |
|----------------|--------|--------|-------|
| `sg-alb` | 80, 443 | `0.0.0.0/0` | حركة الويب الواردة |
| `sg-eks-nodes` | All | `sg-alb` | حركة المرور من ALB إلى العقد |
| `sg-rds` | 5432 | `sg-eks-nodes` | وصول PostgreSQL من العقد فقط |
| `sg-redis` | 6379 | `sg-eks-nodes` | وصول Redis من العقد فقط |

---

## 7. تقدير التكلفة المبدئية — Cost Estimate

### التكلفة الشهرية المُقدّرة (بالدولار الأمريكي)

| الخدمة | التطوير (Dev) | الإنتاج (Production) | ملاحظات |
|--------|-------------|---------------------|---------|
| **EKS Control Plane** | ~$75 | ~$75 | $0.10/ساعة ثابت |
| **EC2 (EKS Nodes)** | ~$60 | ~$150 | حسب عدد ونوع العقد |
| **RDS PostgreSQL** | ~$30 | ~$200 | مع Multi-AZ في الإنتاج |
| **ElastiCache Redis** | ~$15 | ~$150 | مع Replica في الإنتاج |
| **S3 + CloudFront** | ~$5 | ~$50 | حسب حجم البيانات وعدد الطلبات |
| **NAT Gateway** | ~$35 | ~$35 | $0.045/ساعة + رسوم البيانات |
| **Secrets Manager** | ~$2 | ~$5 | $0.40/سر/شهر |
| **CloudWatch Logs** | ~$5 | ~$20 | حسب حجم السجلات |
| **Route 53** | ~$1 | ~$2 | Hosted Zone + DNS Queries |
| **البيانات المنقولة** | ~$5 | ~$50 | Data Transfer Out |
| | | | |
| **الإجمالي التقريبي** | **~$233** | **~$737** | |

> ⚠️ **تنبيه:** هذه تقديرات أوّلية تقريبية بناءً على أسعار منطقة `me-south-1`.
> التكلفة الفعلية قد تختلف بشكل كبير حسب:
> - حجم حركة المرور (Traffic)
> - كمية البيانات المُخزّنة والمنقولة
> - استخدام Auto Scaling
> - Reserved Instances أو Savings Plans (قد يوفّر حتى 40%)
>
> يُنصح باستخدام [AWS Pricing Calculator](https://calculator.aws/) للحصول على تقديرات دقيقة.

### نصائح لتقليل التكلفة:
1. **استخدام Reserved Instances** لـ RDS و ElastiCache في بيئة الإنتاج (توفير حتى 40%)
2. **استخدام Spot Instances** للعقد غير الحساسة في EKS (توفير حتى 60%)
3. **تفعيل S3 Intelligent-Tiering** بدلاً من قواعد Lifecycle اليدوية
4. **مراجعة CloudWatch Logs** وتحديد فترة الاحتفاظ لتقليل تكاليف التخزين
5. **استخدام Graviton Instances** (مثل `t4g`, `r6g`) لأداء أفضل بتكلفة أقل
