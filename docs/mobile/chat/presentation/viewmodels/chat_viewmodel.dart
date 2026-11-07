import 'package:flutter/foundation.dart';

import '../../data/models/chat_message_model.dart';
import '../../data/repositories/chat_repository.dart';
import '../../../../core/utils/logger.dart';

enum ChatState { idle, loading, sending, error }

class ChatViewModel extends ChangeNotifier {
  final ChatRepository _repository;

  ChatViewModel(this._repository);

  ChatState _state = ChatState.idle;
  List<ChatMessageModel> _messages = [];
  String? _errorMessage;

  ChatState get state => _state;
  List<ChatMessageModel> get messages => List.unmodifiable(_messages);
  String? get errorMessage => _errorMessage;

  ChatMessageModel? _replyToMessage;
  ChatMessageModel? get replyToMessage => _replyToMessage;

  void setReplyTo(ChatMessageModel message) {
    _replyToMessage = message;
    _setState(_state);
  }

  void clearReply() {
    _replyToMessage = null;
    _setState(_state);
  }

  void _setState(ChatState newState) {
    _state = newState;
    notifyListeners();
  }

  /// Loads the initial message history from the repository.
  Future<void> loadMessages() async {
    if (_state == ChatState.loading) return;
    _setState(ChatState.loading);
    try {
      _messages = await _repository.getMessages();
      _errorMessage = null;
      _setState(ChatState.idle);
    } catch (e, s) {
      AppLogger.e('[ChatViewModel] Failed to load messages', e, s);
      _errorMessage = 'Failed to load messages. Please try again.';
      _setState(ChatState.error);
    }
  }

  /// Sends a voice message from [audioPath] recorded for [durationSeconds].
  Future<void> sendVoiceMessage(String audioPath, int durationSeconds) async {
    _setState(ChatState.sending);
    try {
      final sent = await _repository.sendVoiceMessage(audioPath, durationSeconds);
      _messages = [..._messages, sent];
      _setState(ChatState.idle);
    } catch (e, s) {
      AppLogger.e('[ChatViewModel] Failed to send voice message', e, s);
      _errorMessage = 'Failed to send voice message. Please try again.';
      _setState(ChatState.error);
    }
  }

  /// Sends [text] as the current user, then fetches an AI reply from the
  /// repository (delay + content are the datasource's responsibility).
  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty) return;
    _setState(ChatState.sending);
    try {
      final sent = await _repository.sendMessage(text.trim());
      _messages = [..._messages, sent];
      _setState(ChatState.idle);

      final reply = await _repository.getAiReply();
      _messages = [..._messages, reply];
      _setState(ChatState.idle);
    } catch (e, s) {
      AppLogger.e('[ChatViewModel] Failed to send message', e, s);
      _errorMessage = 'Failed to send message. Please try again.';
      _setState(ChatState.error);
    }
  }
}
