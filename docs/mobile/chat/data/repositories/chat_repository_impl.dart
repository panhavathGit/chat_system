import '../datasources/chat_datasource.dart';
import '../models/chat_message_model.dart';
import 'chat_repository.dart';

/// Concrete implementation of [ChatRepository].
/// Delegates all work to the injected [ChatDatasource] — currently the mock,
/// but can be swapped for the remote datasource without touching the ViewModel.
class ChatRepositoryImpl implements ChatRepository {
  final ChatDatasource _datasource;

  ChatRepositoryImpl(this._datasource);

  @override
  Future<List<ChatMessageModel>> getMessages() => _datasource.fetchMessages();

  @override
  Future<ChatMessageModel> sendMessage(String text) =>
      _datasource.sendMessage(text);

  @override
  Future<ChatMessageModel> sendVoiceMessage(String audioPath, int durationSeconds) =>
      _datasource.sendVoiceMessage(audioPath, durationSeconds);

  @override
  Future<ChatMessageModel> getAiReply() => _datasource.fetchAiReply();
}
