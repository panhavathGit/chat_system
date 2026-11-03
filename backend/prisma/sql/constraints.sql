-- PostgreSQL 16+ constraints Prisma cannot express. Append to the first generated
-- migration (prisma migrate dev --create-only, then paste this into migration.sql).

-- One active OWNER per conversation (partial unique index).
CREATE UNIQUE INDEX agent_conversations_one_active_owner
  ON agent_conversations (conversation_id)
  WHERE unassigned_at IS NULL AND role = 'OWNER';

-- ASSISTANT messages have no sender; CUSTOMER and AGENT messages must have one.
-- (That the user's role matches sender_type is checked in the application.)
ALTER TABLE messages ADD CONSTRAINT messages_sender_matches_type CHECK (
  (sender_type = 'ASSISTANT') = (sender_user_id IS NULL)
);

-- handoff and assignee must agree: ASSIGNED <=> an agent is set.
ALTER TABLE conversations ADD CONSTRAINT conversations_handoff_matches_assignee CHECK (
  (handoff = 'ASSIGNED') = (assigned_agent_id IS NOT NULL)
);

-- closed_at is set exactly when the conversation is no longer OPEN.
ALTER TABLE conversations ADD CONSTRAINT conversations_closed_at_matches_status CHECK (
  (status = 'OPEN') = (closed_at IS NULL)
);

-- Search-in-chat: full-text index on message text.
CREATE INDEX messages_text_fts ON messages USING GIN (to_tsvector('simple', text));
