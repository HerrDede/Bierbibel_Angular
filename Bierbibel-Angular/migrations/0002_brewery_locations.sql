CREATE TABLE IF NOT EXISTS "BrauereiStandorte" (
  "name_key" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "formatted_address" TEXT,
  "latitude" REAL,
  "longitude" REAL,
  "status" TEXT NOT NULL CHECK ("status" IN ('found', 'not_found')),
  "updated_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    ("status" = 'found' AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL)
    OR ("status" = 'not_found' AND "latitude" IS NULL AND "longitude" IS NULL)
  )
);
