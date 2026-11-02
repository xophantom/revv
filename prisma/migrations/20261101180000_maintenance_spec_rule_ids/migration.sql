-- A service can cover several spec rules (e.g. a revision with oil, filters and plugs).
-- AlterTable
ALTER TABLE "MaintenanceRecord" ADD COLUMN     "specRuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill from the single-rule tag. The old column stays so the previous deploy keeps working.
UPDATE "MaintenanceRecord" SET "specRuleIds" = ARRAY["specRuleId"] WHERE "specRuleId" IS NOT NULL;
