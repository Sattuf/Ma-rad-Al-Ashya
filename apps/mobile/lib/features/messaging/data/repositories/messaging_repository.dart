import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:marad_mobile/core/network/api_client.dart';
import '../models/conversation_model.dart';
import '../models/message_model.dart';

final messagingRepositoryProvider = Provider<MessagingRepository>((ref) {
  return MessagingRepository(apiClient: ApiClient());
});

class MessagingRepository {
  final ApiClient apiClient;

  MessagingRepository({required this.apiClient});

  Future<List<Conversation>> getConversations() async {
    try {
      final response = await apiClient.dio.get('/messaging/conversations');
      if (response.statusCode == 200) {
        final List data = response.data['data'] ?? [];
        return data.map((json) => Conversation.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      debugPrint('Error getting conversations: $e');
      return [];
    }
  }

  Future<List<Message>> getMessages(String conversationId, {String? cursor, int limit = 20}) async {
    try {
      final query = {
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
      };
      final response = await apiClient.dio.get('/messaging/conversations/$conversationId/messages', queryParameters: query);
      if (response.statusCode == 200) {
        final List data = response.data['data'] ?? [];
        return data.map((json) => Message.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      debugPrint('Error getting messages: $e');
      return [];
    }
  }

  Future<void> deleteMessage(String conversationId, String messageId) async {
    await apiClient.dio.delete('/messaging/conversations/$conversationId/messages/$messageId');
  }

  Future<void> blockConversation(String conversationId) async {
    await apiClient.dio.post('/messaging/conversations/$conversationId/block');
  }

  Future<Message> uploadImageMessage(String conversationId, String filePath) async {
    String fileName = filePath.split('/').last;
    FormData formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(filePath, filename: fileName),
    });

    final response = await apiClient.dio.post(
      '/messaging/conversations/$conversationId/messages/image',
      data: formData,
    );
    return Message.fromJson(response.data);
  }
}
