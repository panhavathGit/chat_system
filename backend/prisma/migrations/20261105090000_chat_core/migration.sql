-- CreateEnum
CREATE TYPE "chat_user_kind" AS ENUM ('CUSTOMER', 'STAFF');

-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('AGENT', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "ticket_event_type" AS ENUM ('OPEN', 'ASSIGN', 'REASSIGN', 'UNASSIGN', 'START', 'FINISH');

-- CreateEnum
CREATE TYPE "sender_kind" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "message_type" AS ENUM ('TEXT', 'VOICE', 'IMAGE', 'FILE', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_author_id_fkey";

-- DropTable
DROP TABLE "posts";

-- DropTable
DROP TABLE "users";

-- CreateTable
CREATE TABLE "chat_users" (
    "id" UUID NOT NULL,
    "los_user_id" INTEGER NOT NULL,
    "kind" "chat_user_kind" NOT NULL,
    "username" TEXT NOT NULL,
    "los_role" TEXT,
    "staff_role" "staff_role",
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chat_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "last_message_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "conversation_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "ticket_status" NOT NULL DEFAULT 'PENDING',
    "agent_id" UUID,
    "purpose" TEXT,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "closed_by_id" UUID,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_events" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "type" "ticket_event_type" NOT NULL,
    "actor_id" UUID,
    "agent_id" UUID,
    "purpose" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_id" UUID,
    "sender_kind" "sender_kind" NOT NULL,
    "type" "message_type" NOT NULL,
    "text" TEXT,
    "attachment_id" UUID,
    "client_message_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "duration_sec" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_users_los_user_id_kind_key" ON "chat_users"("los_user_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_customer_id_key" ON "conversations"("customer_id");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_number_key" ON "tickets"("number");

-- CreateIndex
CREATE INDEX "tickets_status_opened_at_idx" ON "tickets"("status", "opened_at");

-- CreateIndex
CREATE INDEX "tickets_agent_id_idx" ON "tickets"("agent_id");

-- CreateIndex
CREATE INDEX "tickets_customer_id_idx" ON "tickets"("customer_id");

-- CreateIndex
CREATE INDEX "ticket_events_ticket_id_created_at_idx" ON "ticket_events"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_events_agent_id_type_created_at_idx" ON "ticket_events"("agent_id", "type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_attachment_id_key" ON "messages"("attachment_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_ticket_id_idx" ON "messages"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_sender_id_client_message_id_key" ON "messages"("sender_id", "client_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "chat_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "chat_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "chat_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "chat_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "chat_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "chat_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "chat_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "chat_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CreateIndex (hand-written: Prisma can't express a partial unique index)
-- A customer has at most one ticket that isn't CLOSED
CREATE UNIQUE INDEX "tickets_one_open_per_customer" ON "tickets"("customer_id") WHERE "status" <> 'CLOSED';
