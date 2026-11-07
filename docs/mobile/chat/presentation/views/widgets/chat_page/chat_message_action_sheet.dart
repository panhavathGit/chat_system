import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../../core/theme/app_colors.dart';
import '../../../../../../core/theme/app_fonts.dart';
import '../../../../data/models/chat_message_model.dart';

const _emojis = [
  '🔥', '👏', '😂', '😭', '🙏', '😆',
  '😳', '🤔', '😍', '❤️', '👍', '😈',
];

/// Slide-up bottom sheet shown on long-press of a chat message.
/// Sections: message preview → emoji grid → Copy → Reply.
class ChatMessageActionSheet extends StatelessWidget {
  const ChatMessageActionSheet({
    super.key,
    required this.message,
    required this.onReply,
  });

  final ChatMessageModel message;
  final VoidCallback onReply;

  static Future<void> show(
    BuildContext context, {
    required ChatMessageModel message,
    required VoidCallback onReply,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => ChatMessageActionSheet(
        message: message,
        onReply: onReply,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          const SizedBox(height: 12),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.grey300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Message preview
          _MessagePreview(message: message),
          const SizedBox(height: 16),

          // Emoji grid
          _EmojiGrid(onEmojiTap: (_) => Navigator.pop(context)),
          const SizedBox(height: 8),

          const Divider(height: 1, color: AppColors.grey200),

          // Copy action
          _ActionRow(
            label: 'Copy',
            icon: Icons.copy_rounded,
            onTap: () {
              Clipboard.setData(ClipboardData(text: message.text));
              Navigator.pop(context);
            },
          ),

          const Divider(height: 1, color: AppColors.grey200),

          // Reply action
          _ActionRow(
            label: 'Reply',
            icon: Icons.reply_rounded,
            onTap: () {
              Navigator.pop(context);
              onReply();
            },
          ),

          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _MessagePreview extends StatelessWidget {
  const _MessagePreview({required this.message});

  final ChatMessageModel message;

  @override
  Widget build(BuildContext context) {
    final preview = message.text.length > 120
        ? '${message.text.substring(0, 120)}…'
        : message.text;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.grey100,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          'React to: $preview',
          style: AppFonts.heading3.copyWith(color: AppColors.textPrimary),
        ),
      ),
    );
  }
}

class _EmojiGrid extends StatelessWidget {
  const _EmojiGrid({required this.onEmojiTap});

  final ValueChanged<String> onEmojiTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 6,
          mainAxisSpacing: 4,
          crossAxisSpacing: 4,
          childAspectRatio: 1,
        ),
        itemCount: _emojis.length,
        itemBuilder: (context, index) {
          final emoji = _emojis[index];
          return GestureDetector(
            onTap: () => onEmojiTap(emoji),
            child: Center(
              child: Text(emoji, style: const TextStyle(fontSize: 28)),
            ),
          );
        },
      ),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: AppFonts.heading2.copyWith(color: AppColors.textPrimary),
              ),
            ),
            Icon(icon, color: AppColors.textSecondary, size: 22),
          ],
        ),
      ),
    );
  }
}
