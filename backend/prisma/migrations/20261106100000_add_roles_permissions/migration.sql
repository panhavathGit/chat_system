-- CreateTable: roles
CREATE TABLE "roles" (
  "id"          SERIAL        NOT NULL,
  "name"        VARCHAR       NOT NULL,
  "kind"        "chat_user_kind" NOT NULL,
  "description" VARCHAR,
  "created_at"  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateTable: permissions
CREATE TABLE "permissions" (
  "id"         SERIAL        NOT NULL,
  "module"     VARCHAR       NOT NULL,
  "action"     VARCHAR       NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_module_action_key" ON "permissions"("module", "action");

-- CreateTable: role_permissions
CREATE TABLE "role_permissions" (
  "id"            SERIAL NOT NULL,
  "role_id"       INT    NOT NULL,
  "permission_id" INT    NOT NULL,

  CONSTRAINT "role_permissions_pkey"               PRIMARY KEY ("id"),
  CONSTRAINT "role_permissions_role_id_fkey"       FOREIGN KEY ("role_id")       REFERENCES "roles"("id")       ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- Seed: roles
INSERT INTO "roles" ("name", "kind", "description") VALUES
  ('CUSTOMER',                  'CUSTOMER', 'Mobile app customer'),
  ('CREDIT_SUPPORT_OFFICER',    'STAFF',    'Handles draft application review'),
  ('CREDIT_SUPPORT_SUPERVISOR', 'STAFF',    'Supervises credit support officers'),
  ('CREDIT_ASSESSMENT',         'STAFF',    'Handles credit assessment'),
  ('CREDIT_SUPERVISOR',         'STAFF',    'Supervises credit assessment officers'),
  ('CREDIT_COMMITTEE',          'STAFF',    'Final credit decision'),
  ('ACCOUNTANT_AP',             'STAFF',    'Accounts payable / disbursement'),
  ('ACCOUNTANT_AR',             'STAFF',    'Accounts receivable / repayment'),
  ('ACCOUNTANT_SUPERVISOR',     'STAFF',    'Supervises accountants'),
  ('COLLECTION_OFFICER',        'STAFF',    'Handles overdue repayments'),
  ('COLLECTION_SUPERVISOR',     'STAFF',    'Supervises collection officers'),
  ('OPERATION_SUPERVISOR',      'STAFF',    'Operations oversight'),
  ('ADMIN',                     'STAFF',    'Full system access'),
  ('SUPER_ADMIN',               'STAFF',    'Full system access plus admin management'),
  ('IT_SUPPORT',                'STAFF',    'User management only');

-- Seed: permissions
INSERT INTO "permissions" ("module", "action") VALUES
  ('CONVERSATION', 'View All'),
  ('CONVERSATION', 'View'),
  ('MESSAGE',      'View History'),
  ('MESSAGE',      'Send'),
  ('ATTACHMENT',   'Upload'),
  ('ATTACHMENT',   'Download');

-- Seed: role_permissions
-- CUSTOMER: everything except 'View All' (staff inbox)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.name = 'CUSTOMER'
  AND NOT (p.module = 'CONVERSATION' AND p.action = 'View All');

-- All STAFF roles: all permissions
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r, "permissions" p
WHERE r.kind = 'STAFF';

-- AlterTable: chat_users — add role_id (nullable first for backfill)
ALTER TABLE "chat_users" ADD COLUMN "role_id" INT;

ALTER TABLE "chat_users"
  ADD CONSTRAINT "chat_users_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: CUSTOMER kind → CUSTOMER role
UPDATE "chat_users" cu
SET "role_id" = r.id
FROM "roles" r
WHERE cu.kind = 'CUSTOMER' AND r.name = 'CUSTOMER';

-- Backfill: STAFF kind → match los_role name
UPDATE "chat_users" cu
SET "role_id" = r.id
FROM "roles" r
WHERE cu.kind = 'STAFF' AND cu.los_role = r.name;

-- Safety check: fail the migration if any row is still unresolved
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "chat_users" WHERE "role_id" IS NULL) THEN
    RAISE EXCEPTION 'chat_users backfill incomplete: some rows have an unrecognised los_role. '
      'Fix the data or add the missing role to the seed before re-running.';
  END IF;
END $$;

-- Set NOT NULL now that every row is resolved
ALTER TABLE "chat_users" ALTER COLUMN "role_id" SET NOT NULL;

-- Drop los_role (replaced by the FK)
ALTER TABLE "chat_users" DROP COLUMN "los_role";
