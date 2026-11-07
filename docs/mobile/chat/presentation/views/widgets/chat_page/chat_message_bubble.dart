import 'package:flutter/material.dart';

import '../../../../../../core/constants/images_constant.dart';
import '../../../../../../core/theme/app_colors.dart';
import '../../../../../../core/theme/app_fonts.dart';
import '../../../../data/models/chat_message_model.dart';
import 'bubbles/chat_voice_bubble.dart';
import 'chat_message_action_sheet.dart';

class ChatMessageBubble extends StatelessWidget {
  const ChatMessageBubble({
    super.key,
    required this.message,
    required this.onReply,
  });

  final ChatMessageModel message;
  final VoidCallback onReply;

  bool get _isMe => message.sender == ChatSender.me;

  String _formatTime(DateTime dt) {
    final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final m = dt.minute.toString().padLeft(2, '0');
    final period = dt.hour < 12 ? 'AM' : 'PM';
    return '$h:$m $period';
  }

  String? get _statusLabel {
    if (!_isMe) return null;
    return switch (message.status) {
      ChatMessageStatus.sending => 'Sending',
      ChatMessageStatus.sent    => 'Sent',
      ChatMessageStatus.read    => 'Read',
    };
  }

  void _showActionSheet(BuildContext context) {
    ChatMessageActionSheet.show(
      context,
      message: message,
      onReply: onReply,
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: () => _showActionSheet(context),
      child: Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment:
            _isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment:
                _isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (!_isMe) ...[
                const _BotAvatar(),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.68,
                  ),
                  decoration: BoxDecoration(
                    color: _isMe ? AppColors.primaryBlue : AppColors.cardBackground,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(18),
                      topRight: const Radius.circular(18),
                      bottomLeft: Radius.circular(_isMe ? 18 : 4),
                      bottomRight: Radius.circular(_isMe ? 4 : 18),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (!_isMe) ...[
                        const _AssistantLabel(),
                        const SizedBox(height: 4),
                      ],
                      if (message.type == ChatMessageType.voice)
                        ChatVoiceBubble(message: message)
                      else
                        Text(
                          message.text,
                          style: AppFonts.heading3.copyWith(
                            color: _isMe ? AppColors.textLight : AppColors.textPrimary,
                            height: 1.45,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Padding(
            padding: EdgeInsets.only(
              left: _isMe ? 0 : 44,
              right: 4,
            ),
            child: Text(
              _statusLabel != null
                  ? '${_formatTime(message.createdAt)} • $_statusLabel'
                  : _formatTime(message.createdAt),
              style: AppFonts.heading5.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ],
      ),
    ),
    );
  }
}

class _AssistantLabel extends StatelessWidget {
  const _AssistantLabel();

  @override
  Widget build(BuildContext context) {
    return Text(
        'AI ASSISTANT',
        style: AppFonts.heading5.copyWith(
          color: AppColors.aiAssistantPurple,
          fontWeight: AppFonts.bold,
          letterSpacing: 0.5,
        ),
    );
  }
}

class _BotAvatar extends StatelessWidget {
  const _BotAvatar();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.asset(
        AppAssets.aiAssistant,
        width: 32,
        height: 32,
        fit: BoxFit.cover,
      ),
    );
  }
}
