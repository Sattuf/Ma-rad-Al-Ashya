import 'package:marad_mobile/core/utils/errors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/messaging_provider.dart';

class ConversationsScreen extends ConsumerWidget {
  const ConversationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationsState = ref.watch(conversationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('الرسائل'),
      ),
      body: conversationsState.when(
        data: (conversations) {
          if (conversations.isEmpty) {
            return const Center(child: Text('لا توجد رسائل بعد'));
          }
          return RefreshIndicator(
            onRefresh: () async {
              await ref.read(conversationsProvider.notifier).loadConversations();
            },
            child: ListView.builder(
              itemCount: conversations.length,
              itemBuilder: (context, index) {
                final conv = conversations[index];
                return ListTile(
                  leading: CircleAvatar(
                    backgroundImage: conv.otherUserAvatar != null
                        ? NetworkImage(conv.otherUserAvatar!)
                        : null,
                    child: conv.otherUserAvatar == null
                        ? const Icon(Icons.person)
                        : null,
                  ),
                  title: Text(conv.otherUserName),
                  subtitle: Text(
                    conv.lastMessage ?? 'صورة',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: conv.unreadCount > 0
                      ? CircleAvatar(
                          radius: 12,
                          backgroundColor: Theme.of(context).primaryColor,
                          child: Text(
                            conv.unreadCount.toString(),
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                          ),
                        )
                      : null,
                  onTap: () {
                    context.push('/messages/${conv.id}', extra: conv.otherUserName);
                  },
                );
              },
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, st) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(userMessage(e, 'تعذّر تحميل المحادثات. حاول مجدداً.'), textAlign: TextAlign.center))),
      ),
    );
  }
}
