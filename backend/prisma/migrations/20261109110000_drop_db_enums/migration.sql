-- Postgres enums → TEXT; the allowed values live in code (src/shared/types/chat-types.ts)
-- and these CHECK constraints keep the database honest. Prisma does not model CHECK constraints.

-- chat_users.type and roles.type: the (role_id, type) FK spans both columns, so drop it while the types change
ALTER TABLE "chat_users" DROP CONSTRAINT "chat_users_role_id_type_fkey";
ALTER TABLE "roles" ALTER COLUMN "type" SET DATA TYPE TEXT USING "type"::text;
ALTER TABLE "chat_users" ALTER COLUMN "type" SET DATA TYPE TEXT USING "type"::text;
ALTER TABLE "chat_users" ADD CONSTRAINT "chat_users_role_id_type_fkey"
  FOREIGN KEY ("role_id", "type") REFERENCES "roles"("id", "type") ON DELETE RESTRICT ON UPDATE CASCADE;
-- * Only roles needs the check: the FK means chat_users.type can only hold a value some role has
ALTER TABLE "roles" ADD CONSTRAINT "roles_type_check" CHECK ("type" IN ('CUSTOMER', 'STAFF'));
DROP TYPE "chat_user_type";

-- messages.type
ALTER TABLE "messages" ALTER COLUMN "type" SET DATA TYPE TEXT USING "type"::text;
ALTER TABLE "messages" ADD CONSTRAINT "messages_type_check" CHECK ("type" IN ('TEXT', 'VOICE', 'IMAGE', 'FILE'));
DROP TYPE "message_type";
