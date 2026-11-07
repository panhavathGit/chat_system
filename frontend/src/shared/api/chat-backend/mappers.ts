import type { ConversationDto, ChatMessageDto, AttachmentDto } from "@/shared/api/ws";
import type { CbConversation, CbMessage, CbAttachment } from "./chat-backend-types";

const PLACEHOLDER_APPLICATION: ConversationDto["application"] = {
  appId: "",
  product: "",
  amount: "",
  tenor: "",
  status: "New",
  reference: "",
};

function attachmentToDto(a: CbAttachment): AttachmentDto {
  return { id: a.id, mimeType: a.mimeType, sizeBytes: a.sizeBytes, fileName: a.fileName, durationSec: a.durationSec };
}

function attachmentPreviewLabel(msg: CbMessage): string {
  if (!msg.attachment) return msg.text ?? "";
  const { mimeType } = msg.attachment;
  if (mimeType.startsWith("audio/")) return "Voice message";
  if (mimeType.startsWith("image/")) return msg.text ?? msg.attachment.fileName;
  return msg.text ?? msg.attachment.fileName;
}

export function mapConversation(row: CbConversation): ConversationDto {
  const preview = row.lastMessage
    ? row.lastMessage.attachment
      ? attachmentPreviewLabel(row.lastMessage)
      : (row.lastMessage.text ?? "")
    : "";

  return {
    id: row.id,
    customerId: row.customer.id,
    name: row.customer.username,
    avatar: "",
    preview,
    lastMessageAt: row.lastMessageAt,
    unread: 0,
    urgent: false,
    // "assigned" keeps the composer always enabled and hides the HandoffCard (needs-human).
    handoff: "assigned",
    activity: [],
    summary: "",
    application: PLACEHOLDER_APPLICATION,
  };
}

export function mapMessage(msg: CbMessage): ChatMessageDto {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    side: msg.senderKind === "CUSTOMER" ? "customer" : "agent",
    text: msg.text ?? "",
    createdAt: msg.createdAt,
    status: "sent",
    senderId: msg.sender.id,
    clientMessageId: msg.clientMessageId,
    senderName: msg.sender.username,
    attachment: msg.attachment ? attachmentToDto(msg.attachment) : null,
  };
}
