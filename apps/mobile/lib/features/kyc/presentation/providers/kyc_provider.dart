import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repositories/identity_repository.dart';

enum KycState {
  idle,
  loading,
  sessionCreated,
  processing,
  approved,
  rejected,
  error,
}

class KycStateData {
  final KycState status;
  final String? verificationUrl;
  final String? errorMessage;
  final String? decision;

  KycStateData({
    this.status = KycState.idle,
    this.verificationUrl,
    this.errorMessage,
    this.decision,
  });

  KycStateData copyWith({
    KycState? status,
    String? verificationUrl,
    String? errorMessage,
    String? decision,
  }) {
    return KycStateData(
      status: status ?? this.status,
      verificationUrl: verificationUrl ?? this.verificationUrl,
      errorMessage: errorMessage,
      decision: decision ?? this.decision,
    );
  }
}

final identityRepositoryProvider = Provider((ref) => IdentityRepository());

final kycProvider = StateNotifierProvider<KycNotifier, KycStateData>((ref) {
  final repository = ref.watch(identityRepositoryProvider);
  return KycNotifier(repository);
});

class KycNotifier extends StateNotifier<KycStateData> {
  final IdentityRepository _repository;
  Timer? _pollingTimer;

  KycNotifier(this._repository) : super(KycStateData()) {
    checkStatus();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> checkStatus() async {
    try {
      final response = await _repository.getKycStatus();
      final statusStr = response['status'] as String?;
      final decision = response['decision'] as String?;

      if (statusStr == 'approved') {
        state = state.copyWith(status: KycState.approved, decision: decision);
        _stopPolling();
      } else if (statusStr == 'rejected') {
        state = state.copyWith(status: KycState.rejected, decision: decision);
        _stopPolling();
      } else if (statusStr == 'processing') {
        state = state.copyWith(status: KycState.processing, decision: decision);
        _startPolling();
      } else if (statusStr == 'session_created') {
        // If there's an active session but not submitted yet, we might want to poll
        // depending on Didit's flow. We'll poll just in case.
        state = state.copyWith(status: KycState.sessionCreated, decision: decision);
        _startPolling();
      } else {
        state = state.copyWith(status: KycState.idle);
        _stopPolling();
      }
    } catch (e) {
      // If error (e.g. 404 not found, meaning no session), we stay idle.
      state = state.copyWith(status: KycState.idle);
      _stopPolling();
    }
  }

  Future<void> startVerification() async {
    state = state.copyWith(status: KycState.loading);
    try {
      final response = await _repository.startKyc();
      final url = response['verification_url'] as String?;
      
      if (url != null) {
        state = state.copyWith(status: KycState.sessionCreated, verificationUrl: url);
        _startPolling();
      } else {
        state = state.copyWith(status: KycState.error, errorMessage: 'Did not receive verification URL');
      }
    } catch (e) {
      state = state.copyWith(status: KycState.error, errorMessage: e.toString());
    }
  }

  void resumePolling() {
    _startPolling();
  }

  void _startPolling() {
    if (_pollingTimer?.isActive == true) return;
    _pollingTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      checkStatus();
    });
  }

  void _stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }
}
