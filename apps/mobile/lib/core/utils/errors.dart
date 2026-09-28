import 'package:dio/dio.dart';

/// User-facing error text — same rules and wording as the web (apps/web/src/lib/errors.ts):
/// say what happened and what to do, tell "your connection" from "our server", and never
/// show raw exceptions or English server text.
String userMessage(Object error, String fallback) {
  if (error is! DioException) return fallback;
  final response = error.response;
  if (response == null) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'استغرق الطلب وقتاً أطول من المعتاد. قد يكون اتصالك بطيئاً؛ حاول مجدداً.';
      case DioExceptionType.connectionError:
        return 'لا يوجد اتصال بالإنترنت، أو تعذّر الوصول إلى الخادم. تحقّق من الشبكة ثم حاول مجدداً.';
      default:
        return fallback;
    }
  }
  final status = response.statusCode ?? 0;
  if (status >= 500) return 'حدث خلل من جهتنا، والمشكلة ليست منك. حاول بعد قليل.';
  if (status == 429) return 'محاولات كثيرة في وقت قصير. انتظر دقيقة ثم حاول مجدداً.';
  final arabic = _arabicServerMessage(response.data);
  if (arabic != null) return arabic;
  if (status == 401) return 'انتهت جلستك. سجّل الدخول مجدداً.';
  if (status == 403) return 'لا تملك صلاحية لهذا الإجراء.';
  if (status == 404) return 'لم نعثر على المطلوب؛ ربما حُذف.';
  return fallback;
}

final RegExp _arabic = RegExp(r'[؀-ۿ]');

String? _arabicServerMessage(dynamic data) {
  if (data is! Map) return null;
  final raw = data['message'] ?? data['detail'];
  final messages = raw is List ? raw : [raw];
  final shown = messages.whereType<String>().where((m) => _arabic.hasMatch(m)).toList();
  return shown.isEmpty ? null : shown.join('، ');
}
