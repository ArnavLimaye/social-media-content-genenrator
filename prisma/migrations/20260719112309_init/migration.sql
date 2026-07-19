-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "audience" TEXT,
    "brandVoice" TEXT,
    "colors" TEXT,
    "logoUrl" TEXT,
    "pillarMon" TEXT NOT NULL,
    "pillarWed" TEXT NOT NULL,
    "pillarFri" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "planId" TEXT,
    "pillar" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "hook" TEXT,
    "caption" TEXT,
    "cta" TEXT,
    "slides" JSONB,
    "hashtags" JSONB,
    "reviewFlags" JSONB,
    "scheduledDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "flagsAcknowledgedAt" DATETIME,
    "imagePath" TEXT,
    "plannerPromptTokens" INTEGER,
    "plannerOutputTokens" INTEGER,
    "copywriterPromptTokens" INTEGER,
    "copywriterOutputTokens" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
