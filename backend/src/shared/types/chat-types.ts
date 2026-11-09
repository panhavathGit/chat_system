// * The only list of allowed values: the database columns are plain TEXT, guarded by CHECK constraints
// * (migration 20261109110000_drop_db_enums). Adding a value means changing it here and in a new CHECK.

// * Which LOS account table a user comes from; roles.type is the source of truth
export const CHAT_USER_TYPES = ['CUSTOMER', 'STAFF'] as const;
export type ChatUserType = (typeof CHAT_USER_TYPES)[number];

export const MESSAGE_TYPES = ['TEXT', 'VOICE', 'IMAGE', 'FILE'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];
