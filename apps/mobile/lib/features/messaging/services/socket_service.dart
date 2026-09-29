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

  /// One shared socket for the whole app, created once even if several screens call
  /// connect() at the same time.
  void connect() {
    if (socket != null) {
      if (!socket!.connected) socket!.connect();
      return;
    }

    socket = io.io(ApiClient.socketUrl, io.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      // Called on every (re)connection, so a reconnect after the 15-minute access token
      // expired sends the refreshed one (ApiClient stores it). The token goes in the
      // socket.io auth payload, which works on Android, iOS and the web alike (browsers
      // cannot set headers on a websocket).
      .setAuthFn((send) {
        _storage.getAccessToken().then((token) => send({'token': token ?? ''}));
      })
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

  /// socket.io buffers emits while disconnected and sends them on reconnect, so a message
  /// typed during a network blip is delivered instead of silently dropped.
  void sendMessage(Map<String, dynamic> data) {
    socket?.emit('send_message', data);
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
