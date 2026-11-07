import '../models/chat_message_model.dart';
import 'chat_datasource.dart';

/// Mock datasource that returns hardcoded messages matching the design screenshot.
/// Swap for ChatRemoteDatasource once the real API endpoint is confirmed.
class ChatMockDatasource implements ChatDatasource {
  @override
  Future<List<ChatMessageModel>> fetchMessages() async {
    // Simulate a brief network delay.
    await Future.delayed(const Duration(milliseconds: 400));

    final now = DateTime.now();
    return [
      ChatMessageModel(
        id: '1',
        text:
            'Hi, I submitted my instant cash application yesterday. Can I change my repayment date to the 25th instead of the 30th?',
        sender: ChatSender.me,
        createdAt: now.subtract(const Duration(minutes: 62)),
        status: ChatMessageStatus.sent,
      ),
      ChatMessageModel(
        id: '2',
        text:
            'Welcome to LUYLEUN Mobile App. Kindly stay on the line while we connect you to our agent.',
        sender: ChatSender.assistant,
        createdAt: now.subtract(const Duration(minutes: 61)),
        status: ChatMessageStatus.read,
      ),
      ChatMessageModel(
        id: '3',
        text:
            'Okay, please connect me with someone who can update the date today.',
        sender: ChatSender.me,
        createdAt: now.subtract(const Duration(minutes: 60)),
        status: ChatMessageStatus.read,
      ),
    ];
  }

  @override
  Future<ChatMessageModel> sendMessage(String text) async {
    // Immediately acknowledge the message as sent.
    return ChatMessageModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      text: text,
      sender: ChatSender.me,
      createdAt: DateTime.now(),
      status: ChatMessageStatus.sent,
    );
  }

  @override
  Future<ChatMessageModel> sendVoiceMessage(String audioPath, int durationSeconds) async {
    return ChatMessageModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      text: '',
      sender: ChatSender.me,
      createdAt: DateTime.now(),
      status: ChatMessageStatus.sent,
      type: ChatMessageType.voice,
      audioPath: audioPath,
      audioDuration: durationSeconds,
    );
  }

  @override
  Future<ChatMessageModel> fetchAiReply() async {
    // Simulate agent response time.
    await Future.delayed(const Duration(milliseconds: 1500));
    return ChatMessageModel(
      id: '${DateTime.now().millisecondsSinceEpoch}_reply',
      text: 'Thank you for reaching out! Our agent will assist you shortly.',
      sender: ChatSender.assistant,
      createdAt: DateTime.now(),
      status: ChatMessageStatus.read,
    );
  }
}
