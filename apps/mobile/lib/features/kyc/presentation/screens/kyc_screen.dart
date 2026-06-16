import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../providers/kyc_provider.dart';

class KycScreen extends ConsumerStatefulWidget {
  const KycScreen({super.key});

  @override
  ConsumerState<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends ConsumerState<KycScreen> {
  WebViewController? _webViewController;
  bool _showWebView = false;

  @override
  void initState() {
    super.initState();
    // Refresh status on open
    Future.microtask(() => ref.read(kycProvider.notifier).checkStatus());
  }

  void _initWebView(String url) {
    if (_webViewController != null) return;
    
    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {},
          onPageStarted: (String url) {},
          onPageFinished: (String url) {},
          onWebResourceError: (WebResourceError error) {},
          onNavigationRequest: (NavigationRequest request) {
            // Depending on Didit's callback URLs, we could intercept them here.
            // For example, if it redirects to a success URL:
            if (request.url.contains('success') || request.url.contains('callback')) {
              setState(() {
                _showWebView = false;
              });
              ref.read(kycProvider.notifier).checkStatus();
              // return NavigationDecision.prevent; // optional
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(url));
  }

  @override
  Widget build(BuildContext context) {
    final kycState = ref.watch(kycProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('توثيق الهوية (KYC)'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_showWebView) {
              setState(() => _showWebView = false);
              ref.read(kycProvider.notifier).resumePolling();
            } else {
              Navigator.of(context).pop();
            }
          },
        ),
      ),
      body: _buildBody(kycState),
    );
  }

  Widget _buildBody(KycStateData state) {
    if (_showWebView && state.verificationUrl != null) {
      _initWebView(state.verificationUrl!);
      return WebViewWidget(controller: _webViewController!);
    }

    switch (state.status) {
      case KycState.loading:
        return const Center(child: CircularProgressIndicator());
      
      case KycState.error:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 64),
              const SizedBox(height: 16),
              Text('حدث خطأ', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text(state.errorMessage ?? 'Unknown error', textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.read(kycProvider.notifier).checkStatus(),
                child: const Text('إعادة المحاولة'),
              )
            ],
          ),
        );
        
      case KycState.approved:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.verified, color: Colors.green, size: 80),
              const SizedBox(height: 16),
              Text('تم توثيق حسابك بنجاح!', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              const Text('يمكنك الآن الاستفادة من جميع ميزات التطبيق بثقة.', textAlign: TextAlign.center),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('عودة'),
              )
            ],
          ),
        );
        
      case KycState.rejected:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cancel, color: Colors.red, size: 80),
              const SizedBox(height: 16),
              Text('تم رفض طلب التوثيق', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text('السبب: ${state.decision ?? "غير معروف"}', textAlign: TextAlign.center),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => ref.read(kycProvider.notifier).startVerification(),
                child: const Text('حاول مرة أخرى'),
              )
            ],
          ),
        );
        
      case KycState.processing:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 24),
              Text('جاري مراجعة طلبك...', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              const Text('يرجى الانتظار، قد يستغرق الأمر بعض الوقت.', textAlign: TextAlign.center),
            ],
          ),
        );

      case KycState.sessionCreated:
      case KycState.idle:
      default:
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.security, size: 80, color: Color(0xFF0D9488)),
              const SizedBox(height: 24),
              Text(
                'توثيق الهوية خطوة مهمة',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              const Text(
                'لضمان بيئة آمنة لجميع المستخدمين، نطلب من البائعين توثيق هوياتهم. \n\n'
                'خطوات التوثيق:\n'
                '١. تجهيز بطاقة الهوية أو جواز السفر.\n'
                '٢. التقاط صورة واضحة للوثيقة.\n'
                '٣. التقاط صورة سيلفي قصيرة للتحقق.',
                style: TextStyle(fontSize: 16, height: 1.5),
                textAlign: TextAlign.right,
              ),
              const SizedBox(height: 32),
              if (state.status == KycState.sessionCreated && state.verificationUrl != null)
                ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _showWebView = true;
                    });
                  },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: const Color(0xFF0D9488),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('متابعة التوثيق', style: TextStyle(fontSize: 18)),
                )
              else
                ElevatedButton(
                  onPressed: () {
                    ref.read(kycProvider.notifier).startVerification().then((_) {
                      final currentUrl = ref.read(kycProvider).verificationUrl;
                      if (currentUrl != null) {
                        setState(() {
                          _showWebView = true;
                        });
                      }
                    });
                  },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: const Color(0xFF0D9488),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('ابدأ التوثيق', style: TextStyle(fontSize: 18)),
                ),
            ],
          ),
        );
    }
  }
}
