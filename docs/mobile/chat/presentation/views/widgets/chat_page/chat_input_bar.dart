import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';

import '../../../../../../core/theme/app_colors.dart';
import '../../../../../../core/theme/app_fonts.dart';
import '../../../../../../core/utils/logger.dart';
import '../../../../data/models/chat_message_model.dart';
import '../../../viewmodels/chat_viewmodel.dart';
import 'chat_attachment_menu.dart';
import 'chat_recording_overlay.dart';

class ChatInputBar extends StatefulWidget {
  const ChatInputBar({
    super.key,
    required this.onSend,
    this.replyToMessage,
    this.onClearReply,
  });

  final ValueChanged<String> onSend;
  final ChatMessageModel? replyToMessage;
  final VoidCallback? onClearReply;

  @override
  State<ChatInputBar> createState() => _ChatInputBarState();
}

class _ChatInputBarState extends State<ChatInputBar> {
  final TextEditingController _controller = TextEditingController();
  final AudioRecorder _recorder = AudioRecorder();

  bool _hasText = false;
  bool _isRecording = false;
  Duration _recordingDuration = Duration.zero;
  double _slideProgress = 0.0;
  bool _cancelled = false;
  Timer? _recordingTimer;
  double _dragStartX = 0;

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final hasText = _controller.text.trim().isNotEmpty;
      if (hasText != _hasText) setState(() => _hasText = hasText);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _recorder.dispose();
    _recordingTimer?.cancel();
    super.dispose();
  }

  void _handleSend() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    widget.onSend(text);
    _controller.clear();
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    try {
      final file = await picker.pickImage(source: source);
      if (file != null) {
        widget.onSend(
          source == ImageSource.camera ? '📷 Photo sent' : '🖼️ Image sent',
        );
      }
    } catch (e, s) {
      AppLogger.e('[ChatInputBar] Image pick error', e, s);
    }
  }

  void _showAttachmentMenu() {
    showChatAttachmentMenu(context).then((option) {
      if (option == null) return;
      switch (option) {
        case ChatAttachOption.camera:
          _pickImage(ImageSource.camera);
        case ChatAttachOption.photos:
          _pickImage(ImageSource.gallery);
        case ChatAttachOption.file:
          break;
      }
    });
  }

  // ── Voice recording ───────────────────────────────────────────────────────

  Future<void> _startRecording() async {
    final status = await Permission.microphone.request();
    if (!status.isGranted) {
      AppLogger.w('[ChatInputBar] Microphone permission denied');
      return;
    }
    try {
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc),
        path: path,
      );
      setState(() {
        _isRecording = true;
        _cancelled = false;
        _recordingDuration = Duration.zero;
        _slideProgress = 0;
      });
      _recordingTimer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _recordingDuration += const Duration(seconds: 1));
      });
    } catch (e, s) {
      AppLogger.e('[ChatInputBar] Failed to start recording', e, s);
    }
  }

  Future<void> _stopAndSend() async {
    if (!_isRecording) return;
    _recordingTimer?.cancel();
    try {
      final path = await _recorder.stop();
      final duration = _recordingDuration.inSeconds;
      final wasCancelled = _cancelled;
      setState(() {
        _isRecording = false;
        _slideProgress = 0;
        _cancelled = false;
      });
      if (!wasCancelled && path != null && duration > 0 && mounted) {
        await context.read<ChatViewModel>().sendVoiceMessage(path, duration);
      }
    } catch (e, s) {
      AppLogger.e('[ChatInputBar] Failed to stop recording', e, s);
      setState(() => _isRecording = false);
    }
  }

  void _triggerCancel() {
    if (!_isRecording || _cancelled) return;
    setState(() => _cancelled = true);
    _stopAndSend();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      padding: EdgeInsets.fromLTRB(
        12,
        10,
        12,
        MediaQuery.of(context).padding.bottom + 10,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!_isRecording && widget.replyToMessage != null) ...[
            _ReplyPreviewStrip(
              message: widget.replyToMessage!,
              onClear: widget.onClearReply,
            ),
            const SizedBox(height: 8),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // ── Left area: changes based on recording state ──────────────
              if (_isRecording)
                Expanded(
                  child: ChatRecordingOverlay(
                    duration: _recordingDuration,
                    slideProgress: _slideProgress,
                  ),
                )
              else ...[
                CupertinoButton(
                  padding: const EdgeInsets.all(6),
                  minimumSize: Size.zero,
                  onPressed: _showAttachmentMenu,
                  child: const Icon(
                    CupertinoIcons.plus_circle_fill,
                    color: AppColors.primaryBlue,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 44, maxHeight: 100),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppColors.grey200,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: TextField(
                      controller: _controller,
                      decoration: InputDecoration(
                        hintText: 'Type a message or ask anything',
                        hintStyle: AppFonts.heading3.copyWith(
                          color: AppColors.textSecondary,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                      style: AppFonts.heading3.copyWith(color: AppColors.textPrimary),
                      maxLines: null,
                      textInputAction: TextInputAction.newline,
                      onSubmitted: (_) => _handleSend(),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                if (!_hasText)
                  CupertinoButton(
                    padding: const EdgeInsets.all(6),
                    minimumSize: Size.zero,
                    onPressed: null, // tapping does nothing — must hold
                    child: const Icon(
                      CupertinoIcons.paperplane,
                      color: AppColors.textSecondary,
                      size: 24,
                    ),
                  )
                else
                  CupertinoButton(
                    padding: const EdgeInsets.all(6),
                    minimumSize: Size.zero,
                    onPressed: _handleSend,
                    child: const Icon(
                      CupertinoIcons.paperplane,
                      color: AppColors.primaryBlue,
                      size: 24,
                    ),
                  ),
              ],

              // ── Mic button — ALWAYS in the tree so gesture tracking persists ──
              GestureDetector(
                onLongPressDown: (d) {
                  _dragStartX = d.globalPosition.dx;
                },
                onLongPressStart: (_) => _startRecording(),
                onLongPressMoveUpdate: (d) {
                  if (!_isRecording) return;
                  final slide =
                      ((_dragStartX - d.globalPosition.dx) / 120).clamp(0.0, 1.0);
                  setState(() => _slideProgress = slide);
                  if (slide >= 1.0) _triggerCancel();
                },
                onLongPressEnd: (_) => _stopAndSend(),
                onLongPressCancel: () => _triggerCancel(),
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: Icon(
                    CupertinoIcons.mic,
                    color: _isRecording ? AppColors.accentRed : AppColors.textSecondary,
                    size: 24,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReplyPreviewStrip extends StatelessWidget {
  const _ReplyPreviewStrip({required this.message, this.onClear});

  final ChatMessageModel message;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final preview = message.text.length > 60
        ? '${message.text.substring(0, 60)}…'
        : message.text;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primaryBlueTint,
        borderRadius: BorderRadius.circular(10),
        border: Border(
          left: BorderSide(color: AppColors.primaryBlue, width: 3),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.reply_rounded, size: 16, color: AppColors.primaryBlue),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              preview,
              style: AppFonts.heading5.copyWith(color: AppColors.textSecondary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          GestureDetector(
            onTap: onClear,
            child: const Icon(Icons.close, size: 16, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
