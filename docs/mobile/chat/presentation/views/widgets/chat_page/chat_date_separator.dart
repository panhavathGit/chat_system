import 'package:flutter/material.dart';

import '../../../../../../core/theme/app_colors.dart';
import '../../../../../../core/theme/app_fonts.dart';

class ChatDateSeparator extends StatelessWidget {
  const ChatDateSeparator({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.grey200,
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            label,
            style: AppFonts.heading5.copyWith(
              color: AppColors.textSecondary,
              fontWeight: AppFonts.medium,
            ),
          ),
        ),
      ),
    );
  }
}
