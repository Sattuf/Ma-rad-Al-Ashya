import 'package:intl/intl.dart';

/// Arabic currency names. "US$" inside right-to-left text is reordered by the bidi
/// algorithm ("$US 1,250"), so the unit is written as a word — same rule as the web
/// (apps/web/src/types/listing.ts, formatMoney).
const Map<String, String> _currencyNames = {
  'USD': 'دولار',
  'SAR': 'ر.س',
  'AED': 'د.إ',
  'EUR': 'يورو',
  'SYP': 'ل.س',
  'IQD': 'د.ع',
  'EGP': 'ج.م',
};

final NumberFormat _amount = NumberFormat('#,##0.##', 'en');

/// 1250.5 + 'USD' → "1,250.5 دولار" (Latin digits, as on the web).
String formatPrice(num price, [String currency = 'USD']) =>
    '${_amount.format(price)} ${_currencyNames[currency] ?? currency}';
