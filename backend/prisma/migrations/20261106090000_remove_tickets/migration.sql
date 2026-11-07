-- Hand-written: ticket SYSTEM notices ("Ticket #12 opened", ...) have no sender and no place without tickets
DELETE FROM "messages" WHERE "sender_kind" = 'SYSTEM' OR "type" = 'SYSTEM' OR "sender_id" IS NULL;

-- AlterEnum
BEGIN;
CREATE TYPE "message_type_new" AS ENUM ('TEXT', 'VOICE', 'IMAGE', 'FILE');
ALTER TABLE "messages" ALTER COLUMN "type" TYPE "message_type_new" USING ("type"::text::"message_type_new");
ALTER TYPE "message_type" RENAME TO "message_type_old";
ALTER TYPE "message_type_new" RENAME TO "message_type";
DROP TYPE "public"."message_type_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "sender_kind_new" AS ENUM ('CUSTOMER', 'STAFF');
ALTER TABLE "messages" ALTER COLUMN "sender_kind" TYPE "sender_kind_new" USING ("sender_kind"::text::"sender_kind_new");
ALTER TYPE "sender_kind" RENAME TO "sender_kind_old";
ALTER TYPE "sender_kind_new" RENAME TO "sender_kind";
DROP TYPE "public"."sender_kind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_ticket_id_fkey";

-- DropForeignKey
ALTER TABLE "ticket_events" DROP CONSTRAINT "ticket_events_actor_id_fkey";

-- DropForeignKey
ALTER TABLE "ticket_events" DROP CONSTRAINT "ticket_events_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "ticket_events" DROP CONSTRAINT "ticket_events_ticket_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_agent_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_closed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_conversation_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_customer_id_fkey";

-- DropIndex
DROP INDEX "messages_ticket_id_idx";

-- AlterTable
ALTER TABLE "chat_users" DROP COLUMN "staff_role";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "ticket_id",
ALTER COLUMN "sender_id" SET NOT NULL;

-- DropTable
DROP TABLE "ticket_events";

-- DropTable
DROP TABLE "tickets";

-- DropEnum
DROP TYPE "staff_role";

-- DropEnum
DROP TYPE "ticket_event_type";

-- DropEnum
DROP TYPE "ticket_status";

