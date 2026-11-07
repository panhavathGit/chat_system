import '../models/chat_message_model.dart';

/// Abstract repository interface for the chat feature.
/// The ViewModel depends on this type — never on a concrete datasource class.
abstract class ChatRepository {
  Future<List<ChatMessageModel>> getMessages();
  Future<ChatMessageModel> sendMessage(String text);
  Future<ChatMessageModel> sendVoiceMessage(String audioPath, int durationSeconds);
  Future<ChatMessageModel> getAiReply();
}
