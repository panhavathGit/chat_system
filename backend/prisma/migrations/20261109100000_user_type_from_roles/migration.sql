-- Rename "kind" to "type" in place (no data loss)
ALTER TYPE "chat_user_kind" RENAME TO "chat_user_type";
ALTER TABLE "roles" RENAME COLUMN "kind" TO "type";
ALTER TABLE "chat_users" RENAME COLUMN "kind" TO "type";
ALTER INDEX "chat_users_los_user_id_kind_key" RENAME TO "chat_users_los_user_id_type_key";

-- roles is the source of truth: chat_users.type must equal its role's type
CREATE UNIQUE INDEX "roles_id_type_key" ON "roles"("id", "type");
ALTER TABLE "chat_users" DROP CONSTRAINT "chat_users_role_id_fkey";
ALTER TABLE "chat_users" ADD CONSTRAINT "chat_users_role_id_type_fkey"
  FOREIGN KEY ("role_id", "type") REFERENCES "roles"("id", "type") ON DELETE RESTRICT ON UPDATE CASCADE;

-- messages.sender_kind duplicated the sender's chat_users.type
ALTER TABLE "messages" DROP COLUMN "sender_kind";
DROP TYPE "sender_kind";
