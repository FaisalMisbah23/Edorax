-- CreateTable
CREATE TABLE "PersonalizedPrompt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "sourceHash" VARCHAR(64) NOT NULL,
    "basedOn" JSONB NOT NULL DEFAULT '[]',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalizedPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalizedPrompt_userId_generatedAt_idx" ON "PersonalizedPrompt"("userId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalizedPrompt_userId_blockId_key" ON "PersonalizedPrompt"("userId", "blockId");

-- AddForeignKey
ALTER TABLE "PersonalizedPrompt" ADD CONSTRAINT "PersonalizedPrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizedPrompt" ADD CONSTRAINT "PersonalizedPrompt_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
