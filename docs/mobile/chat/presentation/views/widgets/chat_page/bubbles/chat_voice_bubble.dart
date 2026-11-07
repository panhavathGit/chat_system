import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../../../../../core/theme/app_colors.dart';
import '../../../../../../../core/theme/app_fonts.dart';
import '../../../../../../../core/utils/logger.dart';
import '../../../../../data/models/chat_message_model.dart';

/// Playback bubble for voice messages.
/// Shows play/pause, animated waveform bars, and elapsed/total duration.
class ChatVoiceBubble extends StatefulWidget {
  const ChatVoiceBubble({super.key, required this.message});

  final ChatMessageModel message;

  @override
  State<ChatVoiceBubble> createState() => _ChatVoiceBubbleState();
}

class _ChatVoiceBubbleState extends State<ChatVoiceBubble>
    with SingleTickerProviderStateMixin {
  final AudioPlayer _player = AudioPlayer();
  late final AnimationController _waveController;

  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _total = Duration.zero;

  bool get _isMe => widget.message.sender == ChatSender.me;
  Color get _accentColor => _isMe ? Colors.white : AppColors.primaryBlue;
  Color get _mutedColor =>
      _isMe ? Colors.white54 : AppColors.textSecondary;

  @override
  void initState() {
    super.initState();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    final secs = widget.message.audioDuration ?? 0;
    _total = Duration(seconds: secs);

    _player.onPlayerStateChanged.listen((state) {
      if (!mounted) return;
      setState(() => _isPlaying = state == PlayerState.playing);
      if (state == PlayerState.playing) {
        _waveController.repeat(reverse: true);
      } else {
        _waveController.stop();
      }
    });

    _player.onPositionChanged.listen((pos) {
      if (!mounted) return;
      setState(() => _position = pos);
    });

    _player.onDurationChanged.listen((dur) {
      if (!mounted) return;
      setState(() => _total = dur);
    });

    _player.onPlayerComplete.listen((_) {
      if (!mounted) return;
      setState(() {
        _isPlaying = false;
        _position = Duration.zero;
      });
      _waveController.stop();
      _waveController.reset();
    });
  }

  @override
  void dispose() {
    _player.dispose();
    _waveController.dispose();
    super.dispose();
  }

  Future<void> _togglePlayback() async {
    try {
      if (_isPlaying) {
        await _player.pause();
      } else {
        final path = widget.message.audioPath;
        if (path == null) return;
        if (_position > Duration.zero) {
          await _player.resume();
        } else {
          await _player.play(DeviceFileSource(path));
        }
      }
    } catch (e, s) {
      AppLogger.e('[ChatVoiceBubble] Playback error', e, s);
    }
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(1, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  double get _progress {
    if (_total.inMilliseconds == 0) return 0;
    return (_position.inMilliseconds / _total.inMilliseconds).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Play / pause button
        GestureDetector(
          onTap: _togglePlayback,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _accentColor.withValues(alpha: 0.15),
            ),
            child: Icon(
              _isPlaying ? CupertinoIcons.pause_fill : CupertinoIcons.play_fill,
              color: _accentColor,
              size: 18,
            ),
          ),
        ),
        const SizedBox(width: 10),
        // Waveform + progress
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            RepaintBoundary(
              child: _WaveformBars(
                progress: _progress,
                isPlaying: _isPlaying,
                animation: _waveController,
                activeColor: _accentColor,
                inactiveColor: _mutedColor,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _isPlaying || _position > Duration.zero
                  ? _formatDuration(_position)
                  : _formatDuration(_total),
              style: AppFonts.heading5.copyWith(color: _mutedColor),
            ),
          ],
        ),
      ],
    );
  }
}

class _WaveformBars extends AnimatedWidget {
  const _WaveformBars({
    required this.progress,
    required this.isPlaying,
    required this.activeColor,
    required this.inactiveColor,
    required Animation<double> animation,
  }) : super(listenable: animation);

  final double progress;
  final bool isPlaying;
  final Color activeColor;
  final Color inactiveColor;

  // Static heights give a natural voice waveform shape.
  static const List<double> _heights = [
    6, 10, 16, 10, 20, 14, 8, 18, 12, 20,
    16, 8, 14, 20, 10, 6, 18, 14, 10, 16,
  ];

  @override
  Widget build(BuildContext context) {
    final anim = listenable as Animation<double>;
    final barCount = _heights.length;

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: List.generate(barCount, (i) {
        final fraction = i / barCount;
        final isPast = fraction <= progress;
        double h = _heights[i];
        if (isPlaying && isPast) {
          // Animate bars that have been played
          h = h * (0.7 + 0.3 * anim.value);
        }
        return Container(
          width: 3,
          height: h,
          margin: const EdgeInsets.symmetric(horizontal: 1),
          decoration: BoxDecoration(
            color: isPast ? activeColor : inactiveColor,
            borderRadius: BorderRadius.circular(2),
          ),
        );
      }),
    );
  }
}
