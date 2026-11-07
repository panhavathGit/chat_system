import '../models/chat_message_model.dart';

/// Abstract datasource contract for the chat feature.
/// Concrete implementations: [ChatMockDatasource] (dev) and a future
/// ChatRemoteDatasource (Dio, once the real backend is available).
abstract class ChatDatasource {
  /// Fetches the existing message history for the current session.
  Future<List<ChatMessageModel>> fetchMessages();

  /// Sends [text] and returns the created message with a confirmed status.
  Future<ChatMessageModel> sendMessage(String text);

  /// Sends a voice message from [audioPath] with [durationSeconds].
  Future<ChatMessageModel> sendVoiceMessage(String audioPath, int durationSeconds);

  /// Returns a simulated AI reply after a delay. Mock only — remove when
  /// real-time stream is wired via [watchIncoming].
  Future<ChatMessageModel> fetchAiReply();
}
