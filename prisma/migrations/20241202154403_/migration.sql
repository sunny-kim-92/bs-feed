/*
  Warnings:

  - Made the column `postId` on table `Reply` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Reply` MODIFY `postId` VARCHAR(191) NOT NULL;
