import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:device_info_plus/device_info_plus.dart';

class DeviceFingerprintService {
  static Future<String> getFingerprintHash() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      String osVersion = '';
      String model = '';
      String deviceId = '';

      if (Platform.isAndroid) {
        final androidInfo = await deviceInfo.androidInfo;
        osVersion = androidInfo.version.release;
        model = androidInfo.model;
        deviceId = androidInfo.id;
      } else if (Platform.isIOS) {
        final iosInfo = await deviceInfo.iosInfo;
        osVersion = iosInfo.systemVersion;
        model = iosInfo.model;
        deviceId = iosInfo.identifierForVendor ?? '';
      }

      final fingerprintRaw = '$osVersion|$model|$deviceId';
      final bytes = utf8.encode(fingerprintRaw);
      final hash = sha256.convert(bytes);

      return hash.toString();
    } catch (e) {
      return '';
    }
  }
}
