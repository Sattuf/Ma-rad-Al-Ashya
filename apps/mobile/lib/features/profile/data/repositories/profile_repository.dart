import 'dart:io';
import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';

class UserProfile {
  final String id;
  final String fullName;
  final String? bio;
  final String? city;
  final String? avatarUrl;
  final String? email;
  final String? phone;
  final bool notificationMessages;
  final bool notificationListings;
  final bool notificationTransactions;

  UserProfile({
    required this.id,
    required this.fullName,
    this.bio,
    this.city,
    this.avatarUrl,
    this.email,
    this.phone,
    this.notificationMessages = true,
    this.notificationListings = true,
    this.notificationTransactions = true,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] ?? '',
      fullName: json['full_name'] ?? '',
      bio: json['bio'],
      city: json['city'],
      avatarUrl: json['avatar_url'],
      email: json['email'],
      phone: json['phone'],
      notificationMessages: json['notification_messages'] ?? true,
      notificationListings: json['notification_listings'] ?? true,
      notificationTransactions: json['notification_transactions'] ?? true,
    );
  }
}

class ProfileRepository {
  final ApiClient _apiClient = ApiClient();

  Future<UserProfile> getProfile() async {
    final response = await _apiClient.dio.get('/users/profile');
    return UserProfile.fromJson(response.data);
  }

  Future<UserProfile> updateProfile({
    String? fullName,
    String? bio,
    String? city,
  }) async {
    final Map<String, dynamic> data = {};
    if (fullName != null) data['full_name'] = fullName;
    if (bio != null) data['bio'] = bio;
    if (city != null) data['city'] = city;

    final response = await _apiClient.dio.put('/users/profile', data: data);
    return UserProfile.fromJson(response.data);
  }

  Future<String> uploadAvatar(File file) async {
    String fileName = file.path.split('/').last;
    FormData formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path, filename: fileName),
    });

    final response = await _apiClient.dio.post(
      '/users/profile/avatar',
      data: formData,
    );
    return response.data['avatar_url'];
  }

  Future<void> updateNotifications({
    bool? messages,
    bool? listings,
    bool? transactions,
  }) async {
    final Map<String, dynamic> data = {};
    if (messages != null) data['notification_messages'] = messages;
    if (listings != null) data['notification_listings'] = listings;
    if (transactions != null) data['notification_transactions'] = transactions;

    await _apiClient.dio.put('/users/notifications', data: data);
  }
}
