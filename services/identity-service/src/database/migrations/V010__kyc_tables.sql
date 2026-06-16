CREATE TABLE IF NOT EXISTS "kyc_verifications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "session_id" varchar(255) NOT NULL,
    "status" varchar(50) NOT NULL DEFAULT 'pending',
    "vendor_data" jsonb,
    "encrypted_data" bytea,
    "kms_key_id" varchar(255),
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
    "expires_at" timestamp
);

CREATE TABLE IF NOT EXISTS "kyc_audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "action" varchar(100) NOT NULL,
    "details" jsonb,
    "ip_address" varchar(45),
    "created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "is_identity_verified" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "identity_verified_at" timestamp;

CREATE INDEX IF NOT EXISTS "idx_kyc_verifications_user_id" ON "kyc_verifications" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_kyc_verifications_session_id" ON "kyc_verifications" ("session_id");
