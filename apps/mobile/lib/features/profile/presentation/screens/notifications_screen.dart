import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/profile_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileState = ref.watch(profileProvider);
    final user = profileState.user;

    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('الإشعارات')),
        body: const Center(child: Text('لا توجد بيانات')),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('إعدادات الإشعارات', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0D9488), Color(0xFF10B981)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'التحكم في الإشعارات',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
            ),
            const SizedBox(height: 8),
            const Text(
              'اختر نوع الإشعارات التي ترغب في تلقيها لتجربة مخصصة لك.',
              style: TextStyle(fontSize: 14, color: Colors.grey),
            ),
            const SizedBox(height: 32),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  _buildSwitchTile(
                    title: 'رسائل المستخدمين',
                    subtitle: 'إشعارات عند استلام رسائل جديدة من البائعين أو المشترين.',
                    icon: Icons.chat_bubble_outline,
                    value: user.notificationMessages,
                    onChanged: (val) {
                      ref.read(profileProvider.notifier).updateNotifications(messages: val);
                    },
                  ),
                  const Divider(height: 1, indent: 70, endIndent: 20),
                  _buildSwitchTile(
                    title: 'تحديثات الإعلانات',
                    subtitle: 'تنبيهات حول الإعلانات التي تتابعها أو أضفتها للمفضلة.',
                    icon: Icons.campaign_outlined,
                    value: user.notificationListings,
                    onChanged: (val) {
                      ref.read(profileProvider.notifier).updateNotifications(listings: val);
                    },
                  ),
                  const Divider(height: 1, indent: 70, endIndent: 20),
                  _buildSwitchTile(
                    title: 'تحديثات الصفقات',
                    subtitle: 'تحديثات حول عمليات البيع والشراء والدفع.',
                    icon: Icons.receipt_long_outlined,
                    value: user.notificationTransactions,
                    onChanged: (val) {
                      ref.read(profileProvider.notifier).updateNotifications(transactions: val);
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      child: SwitchListTile(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4.0),
          child: Text(subtitle, style: const TextStyle(fontSize: 13, color: Colors.grey)),
        ),
        secondary: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDFA),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: const Color(0xFF0D9488), size: 24),
        ),
        value: value,
        activeColor: const Color(0xFF0D9488),
        onChanged: onChanged,
      ),
    );
  }
}
