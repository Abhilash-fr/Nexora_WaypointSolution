import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class MobileDriverView extends StatefulWidget {
  const MobileDriverView({required this.url, super.key});

  final String url;

  @override
  State<MobileDriverView> createState() => _MobileDriverViewState();
}

class _MobileDriverViewState extends State<MobileDriverView> {
  late final WebViewController _controller;
  int _progress = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (mounted) setState(() => _progress = progress);
          },
          onPageFinished: (_) {
            if (mounted) {
              setState(() {
                _progress = 100;
                _error = null;
              });
            }
          },
          onWebResourceError: (error) {
            if (mounted && (error.isForMainFrame ?? true)) {
              setState(() => _error = error.description);
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.url));
  }

  Future<void> _reload() async {
    setState(() {
      _error = null;
      _progress = 0;
    });
    await _controller.reload();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_progress < 100 && _error == null)
          LinearProgressIndicator(value: _progress / 100),
        Expanded(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_error != null)
                ColoredBox(
                  color: Theme.of(context).scaffoldBackgroundColor,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.wifi_off, size: 48),
                          const SizedBox(height: 12),
                          const Text(
                            'Could not open the driver app',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Check that the web app is running and reachable at '
                            '${widget.url}\n\n$_error',
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: _reload,
                            icon: const Icon(Icons.refresh),
                            label: const Text('Try again'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
