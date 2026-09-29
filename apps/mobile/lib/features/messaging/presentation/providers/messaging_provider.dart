import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/messaging_repository.dart';
import '../../data/models/conversation_model.dart';
import '../../data/models/message_model.dart';
import '../../services/socket_service.dart';

final conversationsProvider = StateNotifierProvider<ConversationsNotifier, AsyncValue<List<Conversation>>>((ref) {
  final repo = ref.watch(messagingRepositoryProvider);
  final socketService = ref.watch(socketServiceProvider);
  return ConversationsNotifier(repo, socketService)..loadConversations();
});

class ConversationsNotifier extends StateNotifier<AsyncValue<List<Conversation>>> {
  final MessagingRepository repo;
  final SocketService socketService;

  ConversationsNotifier(this.repo, this.socketService) : super(const AsyncValue.loading()) {
    socketService.connect();
    socketService.onMessageReceived.listen((data) {
      loadConversations();
    });
  }

  Future<void> loadConversations() async {
    try {
      final conversations = await repo.getConversations();
      state = AsyncValue.data(conversations);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

class ChatState {
  final List<Message> messages;
  final bool isLoading;
  final String? nextCursor;
  final bool isTyping;

  ChatState({
    this.messages = const [],
    this.isLoading = false,
    this.nextCursor,
    this.isTyping = false,
  });

  ChatState copyWith({
    List<Message>? messages,
    bool? isLoading,
    String? nextCursor,
    bool? isTyping,
  }) {
    return ChatState(
      messages: messages ?? this.messages,
      isLoading: isLoading ?? this.isLoading,
      nextCursor: nextCursor ?? this.nextCursor,
      isTyping: isTyping ?? this.isTyping,
    );
  }
}

final chatProvider = StateNotifierProvider.family<ChatNotifier, ChatState, String>((ref, conversationId) {
  final repo = ref.watch(messagingRepositoryProvider);
  final socketService = ref.watch(socketServiceProvider);
  return ChatNotifier(repo, socketService, conversationId);
});

const _pendingPrefix = 'pending-';

class ChatNotifier extends StateNotifier<ChatState> {
  final MessagingRepository repo;
  final SocketService socketService;
  final String conversationId;

  final List<StreamSubscription> _subscriptions = [];

  ChatNotifier(this.repo, this.socketService, this.conversationId) : super(ChatState()) {
    socketService.connect();
    socketService.joinConversation(conversationId);
    _initSocketListeners();
    loadMessages();
  }

  @override
  void dispose() {
    for (final s in _subscriptions) {
      s.cancel();
    }
    socketService.leaveConversation(conversationId);
    super.dispose();
  }

  void _initSocketListeners() {
    _subscriptions.add(socketService.onMessageReceived.listen((data) {
      if (data['conversationId'] != conversationId) return;
      final newMessage = Message.fromJson(data);
      // The server echoes my own message back: replace its optimistic copy instead of
      // showing it twice.
      final pending = state.messages.indexWhere(
        (m) => m.id.startsWith(_pendingPrefix) && m.senderId == newMessage.senderId && m.text == newMessage.text,
      );
      if (pending >= 0) {
        final updated = [...state.messages]..[pending] = newMessage;
        state = state.copyWith(messages: updated);
      } else {
        state = state.copyWith(messages: [newMessage, ...state.messages]);
        socketService.markAsRead({'conversationId': conversationId});
      }
    }));

    _subscriptions.add(socketService.onTypingStatus.listen((data) {
      if (data['conversationId'] == conversationId) {
        state = state.copyWith(isTyping: data['isTyping'] ?? false);
      }
    }));

    // The other participant read up to a message id: mark mine up to it.
    _subscriptions.add(socketService.onMessageRead.listen((data) {
      if (data['conversationId'] != conversationId) return;
      final upTo = BigInt.tryParse('${data['lastReadMessageId']}');
      if (upTo == null) return;
      state = state.copyWith(
        messages: state.messages.map((m) {
          final id = BigInt.tryParse(m.id);
          final readNow = m.senderId != data['userId'] && id != null && id <= upTo;
          return readNow ? m.copyWith(isRead: true) : m;
        }).toList(),
      );
    }));
  }

  Future<void> loadMessages() async {
    if (state.isLoading) return;
    state = state.copyWith(isLoading: true);
    
    try {
      final messages = await repo.getMessages(conversationId);
      final nextCursor = messages.isNotEmpty ? messages.last.id : null;
      state = state.copyWith(
        messages: messages,
        isLoading: false,
        nextCursor: nextCursor,
      );
      socketService.markAsRead({'conversationId': conversationId});
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> loadMoreMessages() async {
    if (state.isLoading || state.nextCursor == null) return;
    
    state = state.copyWith(isLoading: true);
    try {
      final olderMessages = await repo.getMessages(conversationId, cursor: state.nextCursor);
      final nextCursor = olderMessages.isNotEmpty ? olderMessages.last.id : null;
      state = state.copyWith(
        messages: [...state.messages, ...olderMessages],
        isLoading: false,
        nextCursor: nextCursor,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }

  void sendMessage(String text, String senderId, {String? imageUrl}) {
    // The server takes the sender from the verified token, never from the payload.
    socketService.sendMessage({'conversationId': conversationId, 'content': text});

    // Optimistic copy, replaced when the server echoes the stored message.
    final msg = Message(
      id: '$_pendingPrefix${DateTime.now().microsecondsSinceEpoch}',
      conversationId: conversationId,
      senderId: senderId,
      text: text,
      imageUrl: imageUrl,
      createdAt: DateTime.now(),
    );
    state = state.copyWith(messages: [msg, ...state.messages]);
  }

  Future<void> sendImage(String filePath, String senderId) async {
    // Optimistic loading message (not matched against the echo: the upload's response
    // replaces it below).
    final msgId = 'upload-${DateTime.now().microsecondsSinceEpoch}';
    final tempMsg = Message(
      id: msgId,
      conversationId: conversationId,
      senderId: senderId,
      text: '',
      imageUrl: filePath, // Using local path temporarily
      createdAt: DateTime.now(),
    );
    
    state = state.copyWith(messages: [tempMsg, ...state.messages]);

    try {
      final msg = await repo.uploadImageMessage(conversationId, filePath);
      // Replace temp message with actual message
      final newMessages = state.messages.map((m) => m.id == msgId ? msg : m).toList();
      state = state.copyWith(messages: newMessages);
    } catch (e) {
      debugPrint('Error uploading image: $e');
      // Remove temp message on error
      state = state.copyWith(messages: state.messages.where((m) => m.id != msgId).toList());
    }
  }

  Future<void> deleteMessage(String messageId) async {
    // Optimistic update
    final currentMessages = state.messages.toList();
    state = state.copyWith(messages: currentMessages.where((m) => m.id != messageId).toList());
    
    try {
      await repo.deleteMessage(conversationId, messageId);
    } catch (e) {
      // Revert if failed
      state = state.copyWith(messages: currentMessages);
    }
  }

  Future<void> blockConversation() async {
    try {
      await repo.blockConversation(conversationId);
      // Optional: Update conversation list status to blocked
    } catch (e) {
      debugPrint('Error blocking conversation: $e');
    }
  }

  void sendTyping(bool isTyping, String userId) {
    socketService.sendTyping({
      'conversationId': conversationId,
      'userId': userId,
      'isTyping': isTyping,
    });
  }
}
