/*
  Warnings:

  - You are about to drop the column `outOfOrderDate` on the `Invoice` table. All the data in the column will be lost.
  - You are about to drop the column `outOfOrderDate` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "outOfOrderDate",
ADD COLUMN     "invoiceDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "outOfOrderDate",
ADD COLUMN     "invoiceDate" TIMESTAMP(3);
