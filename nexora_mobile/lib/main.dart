import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'driver_view_stub.dart'
    if (dart.library.html) 'driver_view_web.dart' as driver_view;

String get driverAppUrl {
  const configuredUrl = String.fromEnvironment('DRIVER_WEB_URL');
  if (configuredUrl.isNotEmpty) return configuredUrl;

  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
    return 'http://localhost:5173/#/driver';
  }
  return 'http://10.0.2.2:5173/#/driver';
}

void main() {
  runApp(const NexoraDriverApp());
}

class NexoraDriverApp extends StatelessWidget {
  const NexoraDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nexora Driver',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff0d9488)),
        useMaterial3: true,
      ),
      home: DriverScreen(url: driverAppUrl),
    );
  }
}

class DriverScreen extends StatelessWidget {
  const DriverScreen({required this.url, super.key});

  final String url;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: driver_view.buildDriverView(url),
      ),
    );
  }
}
