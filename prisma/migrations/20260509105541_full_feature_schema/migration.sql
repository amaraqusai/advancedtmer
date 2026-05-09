-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "breakSecs" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL DEFAULT 'Other',
    "goalReached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "maxValue" INTEGER NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "groupId" TEXT,
    "totalStudySeconds" INTEGER NOT NULL DEFAULT 0,
    "totalBreakSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastSync" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "goalsReached" INTEGER NOT NULL DEFAULT 0,
    "currentGoalSecs" INTEGER NOT NULL DEFAULT 3600,
    "lastStudyDate" TEXT,
    "mondaySecs" INTEGER NOT NULL DEFAULT 0,
    "tuesdaySecs" INTEGER NOT NULL DEFAULT 0,
    "wednesdaySecs" INTEGER NOT NULL DEFAULT 0,
    "thursdaySecs" INTEGER NOT NULL DEFAULT 0,
    "fridaySecs" INTEGER NOT NULL DEFAULT 0,
    "saturdaySecs" INTEGER NOT NULL DEFAULT 0,
    "sundaySecs" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL DEFAULT 'Other',
    "colorTheme" TEXT NOT NULL DEFAULT 'Orange',
    "uiTheme" TEXT NOT NULL DEFAULT 'Dark',
    "eyeCareOn" BOOLEAN NOT NULL DEFAULT false,
    "eyeCareTimerOnly" BOOLEAN NOT NULL DEFAULT false,
    "autoBreakOn" BOOLEAN NOT NULL DEFAULT false,
    "autoBreakFreqMins" INTEGER NOT NULL DEFAULT 25,
    "autoBreakDurMins" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("groupId", "id", "lastSync", "name", "totalStudySeconds") SELECT "groupId", "id", "lastSync", "name", "totalStudySeconds" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_name_key" ON "UserAchievement"("userId", "name");
