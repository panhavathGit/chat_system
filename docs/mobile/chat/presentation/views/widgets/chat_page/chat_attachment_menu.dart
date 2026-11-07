import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../../../../../core/theme/app_colors.dart';
import '../../../../../../core/theme/app_fonts.dart';

enum ChatAttachOption { camera, photos, file }

Future<ChatAttachOption?> showChatAttachmentMenu(BuildContext context) {
  return showGeneralDialog<ChatAttachOption>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'attachment-menu',
    barrierColor: Colors.transparent,
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (_, _, _) => const SizedBox.shrink(),
    transitionBuilder: (ctx, animation, _, _) {
      final slide = Tween<Offset>(
        begin: const Offset(-1, 0),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut));

      return SlideTransition(
        position: slide,
        child: Align(
          alignment: Alignment.bottomLeft,
          child: Padding(
            padding: EdgeInsets.only(
              left: 16,
              bottom: MediaQuery.of(ctx).padding.bottom + 80,
            ),
            child: Material(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              elevation: 8,
              shadowColor: Colors.black26,
              child: IntrinsicWidth(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _AttachMenuRow(
                      label: 'Camera',
                      icon: CupertinoIcons.camera,
                      onTap: () => Navigator.of(ctx).pop(ChatAttachOption.camera),
                    ),
                    const Divider(height: 1, color: Color(0xFFEEEEEE)),
                    _AttachMenuRow(
                      label: 'Photos',
                      icon: CupertinoIcons.photo,
                      onTap: () => Navigator.of(ctx).pop(ChatAttachOption.photos),
                    ),
                    const Divider(height: 1, color: Color(0xFFEEEEEE)),
                    _AttachMenuRow(
                      label: 'Share a file',
                      icon: CupertinoIcons.doc_text,
                      onTap: () => Navigator.of(ctx).pop(ChatAttachOption.file),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}

class _AttachMenuRow extends StatelessWidget {
  const _AttachMenuRow({
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
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: AppFonts.heading3.copyWith(color: AppColors.textPrimary),
            ),
            const SizedBox(width: 32),
            Icon(icon, size: 22, color: AppColors.textPrimary),
          ],
        ),
      ),
    );
  }
}
