import 'package:flutter/material.dart';

import '../../../../../../core/theme/app_colors.dart';
import '../../../../../../core/theme/app_fonts.dart';

/// Inline recording row shown inside the input bar while the user holds the mic.
/// Displays a pulsing dot, live timer, animated wave bars, and slide-to-cancel hint.
class ChatRecordingOverlay extends StatefulWidget {
  const ChatRecordingOverlay({
    super.key,
    required this.duration,
    required this.slideProgress,
  });

  final Duration duration;

  /// 0.0 = no slide, 1.0 = cancel threshold reached.
  final double slideProgress;

  @override
  State<ChatRecordingOverlay> createState() => _ChatRecordingOverlayState();
}

class _ChatRecordingOverlayState extends State<ChatRecordingOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _waveController;

  @override
  void initState() {
    super.initState();
    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _waveController.dispose();
    super.dispose();
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(1, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final cancelOpacity = (widget.slideProgress * 2).clamp(0.0, 1.0);
    final isCancelling = widget.slideProgress > 0.4;

    return Row(
      children: [
        // Pulsing red dot
        RepaintBoundary(
          child: AnimatedBuilder(
            animation: _waveController,
            builder: (_, _) => Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.accentRed.withValues(
                  alpha: 0.5 + 0.5 * _waveController.value,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        // Live timer
        Text(
          _formatDuration(widget.duration),
          style: AppFonts.heading3.copyWith(
            color: AppColors.accentRed,
            fontWeight: AppFonts.semiBold,
          ),
        ),
        const SizedBox(width: 12),
        // Animated wave bars
        RepaintBoundary(
          child: AnimatedBuilder(
            animation: _waveController,
            builder: (_, _) => _RecordingWaveBars(
              animation: _waveController,
              color: isCancelling ? AppColors.grey400 : AppColors.primaryBlue,
            ),
          ),
        ),
        const Spacer(),
        // "Slide to cancel" / "Release to cancel"
        AnimatedOpacity(
          opacity: 1.0 - cancelOpacity,
          duration: const Duration(milliseconds: 100),
          child: Row(
            children: [
              const Icon(Icons.chevron_left, size: 16, color: AppColors.textSecondary),
              Text(
                'Slide to cancel',
                style: AppFonts.heading4.copyWith(color: AppColors.textSecondary),
              ),
            ],
          ),
        ),
        AnimatedOpacity(
          opacity: cancelOpacity,
          duration: const Duration(milliseconds: 100),
          child: Text(
            'Release to cancel',
            style: AppFonts.heading4.copyWith(color: AppColors.accentRed),
          ),
        ),
      ],
    );
  }
}

class _RecordingWaveBars extends StatelessWidget {
  const _RecordingWaveBars({required this.animation, required this.color});

  final Animation<double> animation;
  final Color color;

  static const List<double> _maxHeights = [8, 16, 12, 20, 10, 18, 14, 8, 16, 12];

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: List.generate(_maxHeights.length, (i) {
        final phase = i / _maxHeights.length;
        final animValue = (animation.value + phase) % 1.0;
        final h = 4 + (_maxHeights[i] - 4) * animValue;
        return Container(
          width: 3,
          height: h,
          margin: const EdgeInsets.symmetric(horizontal: 1),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        );
      }),
    );
  }
}
