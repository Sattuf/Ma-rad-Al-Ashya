import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:marad_mobile/core/storage/secure_storage.dart';
import 'dart:async';

final socketServiceProvider = Provider<SocketService>((ref) {
  return SocketService();
});

class SocketService {
  IO.Socket? socket;
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

    socket = IO.io('http://10.0.2.2:3004', IO.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .setExtraHeaders({'Authorization': 'Bearer $token'})
      .build());

    socket!.connect();

    socket!.onConnect((_) {
      print('Socket connected');
    });

    socket!.onDisconnect((_) {
      print('Socket disconnected');
    });

    socket!.on('receive_message', (data) {
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
