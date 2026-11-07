// Model representing a single message in the chat.
// Uses a simple string ID derived from the send timestamp — sufficient for
// mock/local use; swap to UUID once the real backend is wired.
enum ChatMessageStatus { sending, sent, read }

enum ChatSender { me, assistant }

enum ChatMessageType { text, voice }

class ChatMessageModel {
  final String id;
  final String text;
  final ChatSender sender;
  final DateTime createdAt;
  final ChatMessageStatus status;
  final ChatMessageType type;

  /// Local file path for voice messages. Null for text messages.
  final String? audioPath;

  /// Duration in seconds for voice messages. Null for text messages.
  final int? audioDuration;

  const ChatMessageModel({
    required this.id,
    required this.text,
    required this.sender,
    required this.createdAt,
    required this.status,
    this.type = ChatMessageType.text,
    this.audioPath,
    this.audioDuration,
  });

  ChatMessageModel copyWith({
    String? text,
    ChatMessageStatus? status,
    String? audioPath,
    int? audioDuration,
  }) {
    return ChatMessageModel(
      id: id,
      text: text ?? this.text,
      sender: sender,
      createdAt: createdAt,
      status: status ?? this.status,
      type: type,
      audioPath: audioPath ?? this.audioPath,
      audioDuration: audioDuration ?? this.audioDuration,
    );
  }
}
