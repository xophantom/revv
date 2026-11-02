-- Fuel log, recurring custom alerts and the alert e-mail digest. Additive only: safe to apply
-- before deploying the code that uses it.
-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'ETHANOL', 'DIESEL', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alertDigestAt" TIMESTAMP(3),
ADD COLUMN     "alertDigestKey" TEXT;

-- AlterTable
ALTER TABLE "CustomAlert" ADD COLUMN     "dueDay" INTEGER,
ADD COLUMN     "repeatKm" INTEGER,
ADD COLUMN     "repeatMonths" INTEGER;

-- CreateTable
CREATE TABLE "FuelRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "km" INTEGER NOT NULL,
    "volumeMl" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "fuel" "FuelType" NOT NULL DEFAULT 'GASOLINE',
    "fullTank" BOOLEAN NOT NULL DEFAULT true,
    "station" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FuelRecord_vehicleId_date_idx" ON "FuelRecord"("vehicleId", "date");

-- AddForeignKey
ALTER TABLE "FuelRecord" ADD CONSTRAINT "FuelRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

