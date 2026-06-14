import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/profile_repository.dart';

enum ProfileStatus { initial, loading, success, error }

class ProfileState {
  final ProfileStatus status;
  final UserProfile? user;
  final String? errorMessage;

  ProfileState({
    this.status = ProfileStatus.initial,
    this.user,
    this.errorMessage,
  });

  ProfileState copyWith({
    ProfileStatus? status,
    UserProfile? user,
    String? errorMessage,
  }) {
    return ProfileState(
      status: status ?? this.status,
      user: user ?? this.user,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

class ProfileNotifier extends StateNotifier<ProfileState> {
  final ProfileRepository _repository;

  ProfileNotifier(this._repository) : super(ProfileState());

  Future<void> loadProfile() async {
    state = state.copyWith(status: ProfileStatus.loading);
    try {
      final user = await _repository.getProfile();
      state = state.copyWith(status: ProfileStatus.success, user: user);
    } catch (e) {
      state = state.copyWith(
        status: ProfileStatus.error,
        errorMessage: 'فشل في تحميل الملف الشخصي: $e',
      );
    }
  }

  Future<bool> updateProfile({String? fullName, String? bio, String? city}) async {
    state = state.copyWith(status: ProfileStatus.loading);
    try {
      final user = await _repository.updateProfile(
        fullName: fullName,
        bio: bio,
        city: city,
      );
      state = state.copyWith(status: ProfileStatus.success, user: user);
      return true;
    } catch (e) {
      state = state.copyWith(
        status: ProfileStatus.error,
        errorMessage: 'فشل في تحديث الملف الشخصي',
      );
      return false;
    }
  }

  Future<bool> uploadAvatar(File file) async {
    state = state.copyWith(status: ProfileStatus.loading);
    try {
      final avatarUrl = await _repository.uploadAvatar(file);
      if (state.user != null) {
        final updatedUser = UserProfile(
          id: state.user!.id,
          fullName: state.user!.fullName,
          bio: state.user!.bio,
          city: state.user!.city,
          avatarUrl: avatarUrl,
          email: state.user!.email,
          phone: state.user!.phone,
          notificationMessages: state.user!.notificationMessages,
          notificationListings: state.user!.notificationListings,
          notificationTransactions: state.user!.notificationTransactions,
        );
        state = state.copyWith(status: ProfileStatus.success, user: updatedUser);
      } else {
        state = state.copyWith(status: ProfileStatus.success);
      }
      return true;
    } catch (e) {
      state = state.copyWith(
        status: ProfileStatus.error,
        errorMessage: 'فشل في رفع الصورة',
      );
      return false;
    }
  }

  Future<void> updateNotifications({
    bool? messages,
    bool? listings,
    bool? transactions,
  }) async {
    try {
      await _repository.updateNotifications(
        messages: messages,
        listings: listings,
        transactions: transactions,
      );
      if (state.user != null) {
        final updatedUser = UserProfile(
          id: state.user!.id,
          fullName: state.user!.fullName,
          bio: state.user!.bio,
          city: state.user!.city,
          avatarUrl: state.user!.avatarUrl,
          email: state.user!.email,
          phone: state.user!.phone,
          notificationMessages: messages ?? state.user!.notificationMessages,
          notificationListings: listings ?? state.user!.notificationListings,
          notificationTransactions: transactions ?? state.user!.notificationTransactions,
        );
        state = state.copyWith(user: updatedUser);
      }
    } catch (e) {
      // Revert state logic could be here, for simplicity just show error
      state = state.copyWith(
        status: ProfileStatus.error,
        errorMessage: 'فشل في حفظ إعدادات الإشعارات',
      );
    }
  }
}

final profileRepositoryProvider = Provider((ref) => ProfileRepository());

final profileProvider = StateNotifierProvider<ProfileNotifier, ProfileState>((ref) {
  return ProfileNotifier(ref.read(profileRepositoryProvider));
});
