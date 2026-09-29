import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:marad_mobile/core/storage/secure_storage.dart';
import 'package:marad_mobile/core/network/api_client.dart';
import 'dart:async';

final socketServiceProvider = Provider<SocketService>((ref) {
  return SocketService();
});

class SocketService {
  io.Socket? socket;
  final SecureStorage _storage = SecureStorage();
  
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get onMessageReceived => _messageController.stream;

  final _typingController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get onTypingStatus => _typingController.stream;
  
  final _readController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get onMessageRead => _readController.stream;

  void connect() async {
    if (socket != null && socket!.connected) return;

    final token = await _storage.getAccessToken();

    socket = io.io(ApiClient.socketUrl,io.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .setExtraHeaders({'Authorization': 'Bearer $token'})
      .build());

    socket!.connect();

    socket!.onConnect((_) {
      debugPrint('Socket connected');
      // The server forgets room membership on every new connection: re-join.
      for (final id in _rooms) {
        socket!.emit('join_conversation', {'conversationId': id});
      }
    });

    socket!.onDisconnect((_) {
      debugPrint('Socket disconnected');
    });

    socket!.on('new_message', (data) {
      if (data is Map<String, dynamic>) {
        _messageController.add(data);
      }
    });

    socket!.on('typing', (data) {
      if (data is Map<String, dynamic>) {
        _typingController.add(data);
      }
    });
    
    socket!.on('message_read', (data) {
      if (data is Map<String, dynamic>) {
        _readController.add(data);
      }
    });
  }

  /// Conversations this client has open. Joined on every (re)connect, since connect()
  /// is asynchronous and a reconnect starts with no rooms on the server.
  final Set<String> _rooms = {};

  /// Room membership is checked on the server; typing and read events need it.
  void joinConversation(String conversationId) {
    _rooms.add(conversationId);
    if (socket?.connected ?? false) {
      socket!.emit('join_conversation', {'conversationId': conversationId});
    }
  }

  void leaveConversation(String conversationId) {
    _rooms.remove(conversationId);
    if (socket?.connected ?? false) {
      socket!.emit('leave_conversation', {'conversationId': conversationId});
    }
  }

  void sendMessage(Map<String, dynamic> data) {
    if (socket?.connected ?? false) {
      socket!.emit('send_message', data);
    }
  }

  void sendTyping(Map<String, dynamic> data) {
    if (socket?.connected ?? false) {
      socket!.emit('typing', data);
    }
  }

  void markAsRead(Map<String, dynamic> data) {
    if (socket?.connected ?? false) {
      socket!.emit('mark_read', data);
    }
  }

  void disconnect() {
    socket?.disconnect();
    socket?.dispose();
    socket = null;
  }

  void dispose() {
    _messageController.close();
    _typingController.close();
    _readController.close();
    disconnect();
  }
}
