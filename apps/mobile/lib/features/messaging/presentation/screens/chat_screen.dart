import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/messaging_provider.dart';
import '../widgets/chat_bubble.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import 'dart:async';

class ChatScreen extends ConsumerStatefulWidget {
  final String conversationId;
  final String otherUserName;

  const ChatScreen({
    super.key,
    required this.conversationId,
    required this.otherUserName,
  });

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  Timer? _typingTimer;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _typingTimer?.cancel();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(chatProvider(widget.conversationId).notifier).loadMoreMessages();
    }
  }

  void _onTextChanged(String text) {
    final userId = ref.read(authProvider).user?.id ?? '';
    final notifier = ref.read(chatProvider(widget.conversationId).notifier);

    notifier.sendTyping(true, userId);

    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 2), () {
      notifier.sendTyping(false, userId);
    });
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    final userId = ref.read(authProvider).user?.id ?? '';
    ref.read(chatProvider(widget.conversationId).notifier).sendMessage(text, userId);

    _messageController.clear();
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider(widget.conversationId));
    final currentUserId = ref.watch(authProvider).user?.id ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.otherUserName),
            if (chatState.isTyping)
              const Text(
                'يكتب...',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
              ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              reverse: true,
              itemCount: chatState.messages.length + (chatState.isLoading ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == chatState.messages.length) {
                  return const Center(child: CircularProgressIndicator());
                }
                final message = chatState.messages[index];
                return ChatBubble(
                  message: message,
                  isMe: message.senderId == currentUserId,
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.image),
                    onPressed: () {
                      // Implement image picker and upload
                    },
                  ),
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      onChanged: _onTextChanged,
                      decoration: InputDecoration(
                        hintText: 'اكتب رسالة...',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.send),
                    color: Theme.of(context).primaryColor,
                    onPressed: _sendMessage,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
