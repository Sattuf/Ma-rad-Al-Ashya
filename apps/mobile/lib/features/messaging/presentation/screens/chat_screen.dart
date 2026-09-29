import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/messaging_provider.dart';
import '../widgets/chat_bubble.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
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

  bool _isTyping = false;

  /// "Typing" is a state: one event when it starts and one when it stops (2 s idle or
  /// the message is sent), not one per keystroke — that was ~35 events per sentence,
  /// broadcast to the room by the server.
  void _onTextChanged(String text) {
    final userId = ref.read(authProvider).user?['id'] ?? '';
    final notifier = ref.read(chatProvider(widget.conversationId).notifier);

    if (!_isTyping && text.isNotEmpty) {
      _isTyping = true;
      notifier.sendTyping(true, userId);
    }

    _typingTimer?.cancel();
    _typingTimer = Timer(const Duration(seconds: 2), _stopTyping);
  }

  void _stopTyping() {
    _typingTimer?.cancel();
    if (!_isTyping) return;
    _isTyping = false;
    final userId = ref.read(authProvider).user?['id'] ?? '';
    ref.read(chatProvider(widget.conversationId).notifier).sendTyping(false, userId);
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    final userId = ref.read(authProvider).user?['id'] ?? '';
    ref.read(chatProvider(widget.conversationId).notifier).sendMessage(text, userId);

    _messageController.clear();
    _stopTyping();
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
    );
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      final userId = ref.read(authProvider).user?['id'] ?? '';
      ref.read(chatProvider(widget.conversationId).notifier).sendImage(pickedFile.path, userId);
    }
  }

  void _showDeleteMenu(String messageId) {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.delete, color: Colors.red),
                title: const Text('حذف الرسالة', style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.pop(context);
                  ref.read(chatProvider(widget.conversationId).notifier).deleteMessage(messageId);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final chatState = ref.watch(chatProvider(widget.conversationId));
    final currentUserId = ref.watch(authProvider).user?['id'] ?? '';

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
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'block') {
                ref.read(chatProvider(widget.conversationId).notifier).blockConversation();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('تم حظر المحادثة')),
                );
                context.pop();
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'block',
                child: Text('حظر المحادثة'),
              ),
            ],
          ),
        ],
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
                final isMe = message.senderId == currentUserId;
                return ChatBubble(
                  message: message,
                  isMe: isMe,
                  onLongPress: isMe && DateTime.now().difference(message.createdAt).inMinutes <= 5
                      ? () => _showDeleteMenu(message.id)
                      : null,
                  onImageTap: message.imageUrl != null
                      ? () => context.push('/image_viewer', extra: message.imageUrl)
                      : null,
                );
              },
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(8.0),
              child: Row(
                children: [
                  // Icon-only buttons need a tooltip: it is their accessible name (TalkBack).
                  IconButton(
                    icon: const Icon(Icons.image),
                    tooltip: 'إرسال صورة',
                    onPressed: _pickImage,
                  ),
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      onChanged: _onTextChanged,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
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
                    tooltip: 'إرسال',
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
