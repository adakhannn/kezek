ALTER TABLE whatsapp_otp_codes
ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_attempt_status
ON whatsapp_otp_codes (phone, expires_at, used_at, failed_attempts);

