import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FraudSignal {
  final String id;
  final String userId;
  final String reason;
  final String severity; // Low, Medium, High, Critical
  final DateTime timestamp;

  FraudSignal({
    required this.id,
    required this.userId,
    required this.reason,
    required this.severity,
    required this.timestamp,
  });
}

class FraudDashboardScreen extends ConsumerWidget {
  const FraudDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Dummy Data for the dashboard
    final stats = {
      'Total Signals': '124',
      'High Severity': '12',
      'Blocked Users': '8',
      'Pending Reviews': '45',
    };

    final signals = [
      FraudSignal(id: '1', userId: 'usr_101', reason: 'Multiple failed logins', severity: 'Medium', timestamp: DateTime.now().subtract(const Duration(minutes: 5))),
      FraudSignal(id: '2', userId: 'usr_102', reason: 'Device fingerprint mismatch', severity: 'High', timestamp: DateTime.now().subtract(const Duration(hours: 1))),
      FraudSignal(id: '3', userId: 'usr_103', reason: 'Suspicious IP address', severity: 'Low', timestamp: DateTime.now().subtract(const Duration(hours: 2))),
      FraudSignal(id: '4', userId: 'usr_104', reason: 'Repeated registrations', severity: 'Critical', timestamp: DateTime.now().subtract(const Duration(hours: 5))),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Fraud Dashboard (Admin)'),
        backgroundColor: Colors.red[800],
        foregroundColor: Colors.white,
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                childAspectRatio: 1.5,
                children: [
                  _buildStatCard('Total Signals', stats['Total Signals']!, Icons.warning_amber_rounded, Colors.orange),
                  _buildStatCard('High Severity', stats['High Severity']!, Icons.priority_high, Colors.red),
                  _buildStatCard('Blocked Users', stats['Blocked Users']!, Icons.block, Colors.black87),
                  _buildStatCard('Pending Reviews', stats['Pending Reviews']!, Icons.rate_review, Colors.blue),
                ],
              ),
            ),
          ),
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Text(
                'Recent Fraud Signals',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final signal = signals[index];
                return _buildSignalTile(signal);
              },
              childCount: signals.length,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 28),
                const Spacer(),
                Text(
                  value,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(fontSize: 14, color: Colors.grey[700], fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSignalTile(FraudSignal signal) {
    Color badgeColor;
    switch (signal.severity) {
      case 'Critical':
        badgeColor = Colors.red[900]!;
        break;
      case 'High':
        badgeColor = Colors.red;
        break;
      case 'Medium':
        badgeColor = Colors.orange;
        break;
      case 'Low':
      default:
        badgeColor = Colors.green;
        break;
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: badgeColor.withOpacity(0.2),
          child: Icon(Icons.security, color: badgeColor),
        ),
        title: Text('User: ${signal.userId}'),
        subtitle: Text(signal.reason),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: badgeColor,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            signal.severity,
            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
          ),
        ),
      ),
    );
  }
}
