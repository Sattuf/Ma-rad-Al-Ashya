import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:marad_mobile/core/utils/errors.dart';
import 'package:marad_mobile/core/utils/money.dart';

DioException _http(int status, [dynamic data]) {
  final options = RequestOptions(path: '/x');
  return DioException(requestOptions: options, response: Response(requestOptions: options, statusCode: status, data: data));
}

void main() {
  group('formatPrice', () {
    test('writes the currency as a word, with Latin digits', () {
      expect(formatPrice(1250.5), '1,250.5 دولار');
      expect(formatPrice(10, 'SAR'), '10 ر.س');
      expect(formatPrice(3, 'XYZ'), '3 XYZ');
    });
  });

  group('userMessage', () {
    test('tells a connection problem apart from a server fault', () {
      final offline = DioException(requestOptions: RequestOptions(path: '/x'), type: DioExceptionType.connectionError);
      expect(userMessage(offline, 'f'), contains('الإنترنت'));
      expect(userMessage(_http(503), 'f'), contains('ليست منك'));
    });

    test('shows Arabic server messages, never English ones or raw exceptions', () {
      expect(userMessage(_http(401, {'message': 'بيانات الدخول غير صحيحة'}), 'f'), 'بيانات الدخول غير صحيحة');
      expect(userMessage(_http(400, {'message': ['title must be longer than 5']}), 'تعذّر النشر.'), 'تعذّر النشر.');
      expect(userMessage(Exception('boom'), 'تعذّر الحفظ.'), 'تعذّر الحفظ.');
    });
  });
}
