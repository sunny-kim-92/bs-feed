/*
  Warnings:

  - You are about to alter the column `text` on the `Post` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.

*/
-- AlterTable
ALTER TABLE `Post` MODIFY `text` INTEGER NOT NULL;
