/*
  Warnings:

  - The `status` column on the `order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `seller_sales_report` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `category` on the `product` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `role` on the `user` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'SELLER', 'ADMIN');

-- CreateEnum
CREATE TYPE "category" AS ENUM ('Office', 'Sports', 'Books', 'Beauty', 'Clothing', 'Toys', 'TvProjectors', 'SmartphonesTablets', 'Eletronics', 'Pets', 'Furniture');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- DropForeignKey
ALTER TABLE "seller_sales_report" DROP CONSTRAINT "seller_sales_report_sellerId_fkey";

-- AlterTable
ALTER TABLE "order" DROP COLUMN "status",
ADD COLUMN     "status" "order_status" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "product" DROP COLUMN "category",
ADD COLUMN     "category" "category" NOT NULL;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "role",
ADD COLUMN     "role" "user_role" NOT NULL;

-- DropTable
DROP TABLE "seller_sales_report";
