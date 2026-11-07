-- DropIndex
DROP INDEX "messages_conversation_id_created_at_idx";

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "seq" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "messages_seq_key" ON "messages"("seq");

-- CreateIndex
CREATE INDEX "messages_conversation_id_seq_idx" ON "messages"("conversation_id", "seq");

