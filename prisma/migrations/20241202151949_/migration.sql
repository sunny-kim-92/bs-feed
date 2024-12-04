-- CreateTable
CREATE TABLE `PageRank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `linkId` INTEGER NOT NULL,
    `url` VARCHAR(512) NOT NULL,
    `title` VARCHAR(512) NULL,
    `description` VARCHAR(1000) NULL,
    `score` INTEGER NULL,
    `likes` INTEGER NULL,
    `reposts` INTEGER NULL,
    `replies` INTEGER NULL,
    `createdAt` DATETIME(0) NULL,

    UNIQUE INDEX `url`(`url`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
