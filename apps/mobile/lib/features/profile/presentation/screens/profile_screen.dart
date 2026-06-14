import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/profile_provider.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(profileProvider.notifier).loadProfile());
  }

  @override
  Widget build(BuildContext context) {
    final profileState = ref.watch(profileProvider);
    final user = profileState.user;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('الملف الشخصي', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0D9488), Color(0xFF10B981)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white),
            onPressed: () => context.push('/profile/notifications'),
          ),
        ],
      ),
      body: profileState.status == ProfileStatus.loading && user == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488)))
          : profileState.status == ProfileStatus.error && user == null
              ? Center(child: Text(profileState.errorMessage ?? 'حدث خطأ', style: const TextStyle(color: Colors.red)))
              : user == null
                  ? const Center(child: Text('لا توجد بيانات'))
                  : RefreshIndicator(
                      onRefresh: () => ref.read(profileProvider.notifier).loadProfile(),
                      child: SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(24.0),
                        child: Column(
                          crossAxisAlignment: crossAxisAlignment.center,
                          children: [
                            const SizedBox(height: 20),
                            Stack(
                              children: [
                                Container(
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.1),
                                        blurRadius: 15,
                                        offset: const Offset(0, 5),
                                      ),
                                    ],
                                  ),
                                  child: CircleAvatar(
                                    radius: 60,
                                    backgroundColor: Colors.white,
                                    backgroundImage: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                                        ? CachedNetworkImageProvider(user.avatarUrl!)
                                        : null,
                                    child: user.avatarUrl == null || user.avatarUrl!.isEmpty
                                        ? const Icon(Icons.person, size: 60, color: Color(0xFF0D9488))
                                        : null,
                                  ),
                                ),
                                Positioned(
                                  bottom: 0,
                                  left: 0,
                                  child: GestureDetector(
                                    onTap: () => context.push('/profile/edit'),
                                    child: Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: const BoxDecoration(
                                        color: Color(0xFF10B981),
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.edit, color: Colors.white, size: 20),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 24),
                            Text(
                              user.fullName,
                              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF1F2937)),
                            ),
                            if (user.city != null && user.city!.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.location_on, size: 16, color: Colors.grey),
                                  const SizedBox(width: 4),
                                  Text(user.city!, style: const TextStyle(color: Colors.grey, fontSize: 16)),
                                ],
                              ),
                            ],
                            const SizedBox(height: 24),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(20),
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
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('نبذة عني', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF374151))),
                                  const SizedBox(height: 12),
                                  Text(
                                    user.bio?.isNotEmpty == true ? user.bio! : 'لم يتم كتابة نبذة شخصية بعد.',
                                    style: TextStyle(color: user.bio?.isNotEmpty == true ? const Color(0xFF4B5563) : Colors.grey.shade400, fontSize: 16, height: 1.5),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(20),
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
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('معلومات التواصل', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Color(0xFF374151))),
                                  const SizedBox(height: 16),
                                  if (user.email != null && user.email!.isNotEmpty) ...[
                                    Row(
                                      children: [
                                        const Icon(Icons.email_outlined, color: Color(0xFF0D9488)),
                                        const SizedBox(width: 12),
                                        Text(user.email!, style: const TextStyle(fontSize: 16, color: Color(0xFF4B5563))),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                  ],
                                  if (user.phone != null && user.phone!.isNotEmpty) ...[
                                    Row(
                                      children: [
                                        const Icon(Icons.phone_outlined, color: Color(0xFF0D9488)),
                                        const SizedBox(width: 12),
                                        Text(user.phone!, textDirection: TextDirection.ltr, style: const TextStyle(fontSize: 16, color: Color(0xFF4B5563))),
                                      ],
                                    ),
                                  ],
                                  if ((user.email == null || user.email!.isEmpty) && (user.phone == null || user.phone!.isEmpty))
                                    Text('لا توجد معلومات تواصل', style: TextStyle(color: Colors.grey.shade400)),
                                ],
                              ),
                            ),
                            const SizedBox(height: 30),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: () => context.push('/profile/edit'),
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  backgroundColor: const Color(0xFF0D9488),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                  elevation: 2,
                                ),
                                child: const Text('تعديل الملف الشخصي', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
    );
  }
}
