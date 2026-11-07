import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../../core/theme/app_colors.dart';
import '../../../../../../core/theme/app_fonts.dart';

class ChatHeader extends StatelessWidget {
  const ChatHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.grey300, width: 1)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            decoration: BoxDecoration(
              color: AppColors.grey300,
              borderRadius: BorderRadius.circular(32),
            ),
            child: CupertinoButton(
              padding: const EdgeInsets.all(4),
              minimumSize: Size.zero,
              onPressed: () => context.pop(),
              child: const Icon(
                CupertinoIcons.back,
                color: AppColors.textPrimary,
                size: 26,
              ),
            ),
          ),

          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Specialist Support',
                  style: AppFonts.heading2.copyWith(
                    color: AppColors.textPrimary,
                    fontWeight: AppFonts.semiBold,
                  ),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Color(0xFF22C55E),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      'Agent',
                      style: AppFonts.heading5.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Chat + phone icons in a shared rounded-border container
          // with a vertical divider between them — matching the design.
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.grey200, width: 1),
              color: AppColors.grey200,
              borderRadius: BorderRadius.circular(32),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                CupertinoButton(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  minimumSize: Size.zero,
                  onPressed: () {},
                  child: const Icon(
                    CupertinoIcons.chat_bubble,
                    color: AppColors.textPrimary,
                    size: 20,
                  ),
                ),
                Container(width: 1, height: 24, color: AppColors.grey500),
                CupertinoButton(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  minimumSize: Size.zero,
                  onPressed: () {},
                  child: const Icon(
                    CupertinoIcons.phone,
                    color: AppColors.textPrimary,
                    size: 20,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
