import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/theme/app_colors.dart';
import '../viewmodels/chat_viewmodel.dart';
import 'widgets/chat_page/chat_date_separator.dart';
import 'widgets/chat_page/chat_header.dart';
import 'widgets/chat_page/chat_input_bar.dart';
import 'widgets/chat_page/chat_message_bubble.dart';

class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<ChatViewModel>().loadMessages().then((_) {
        _scrollToBottom();
      });
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      _scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  Future<void> _handleSend(String text) async {
    await context.read<ChatViewModel>().sendMessage(text);
    await Future.delayed(const Duration(milliseconds: 80));
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final vm = context.watch<ChatViewModel>();

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const ChatHeader(),
            Expanded(child: _buildMessageList(vm)),
            ChatInputBar(
              onSend: _handleSend,
              replyToMessage: vm.replyToMessage,
              onClearReply: () => context.read<ChatViewModel>().clearReply(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageList(ChatViewModel vm) {
    if (vm.state == ChatState.loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primaryBlue),
      );
    }

    if (vm.state == ChatState.error && vm.messages.isEmpty) {
      return Center(
        child: Text(
          vm.errorMessage ?? 'Something went wrong.',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: vm.messages.length + 1,
      itemBuilder: (context, index) {
        if (index == 0) return const ChatDateSeparator(label: 'Today');
        final message = vm.messages[index - 1];
        return ChatMessageBubble(
          message: message,
          onReply: () => context.read<ChatViewModel>().setReplyTo(message),
        );
      },
    );
  }
}
