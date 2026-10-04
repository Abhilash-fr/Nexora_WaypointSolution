import 'dart:ui_web' as ui_web;

import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

final Set<String> _registeredViewTypes = {};

Widget buildDriverView(String url) {
  final viewType = 'nexora-driver-${url.hashCode}';
  if (_registeredViewTypes.add(viewType)) {
    ui_web.platformViewRegistry.registerViewFactory(viewType, (int viewId) {
      return web.HTMLIFrameElement()
        ..src = url
        ..title = 'Nexora Driver App'
        ..allow = 'geolocation'
        ..style.border = '0'
        ..style.width = '100%'
        ..style.height = '100%';
    });
  }

  return HtmlElementView(viewType: viewType);
}
