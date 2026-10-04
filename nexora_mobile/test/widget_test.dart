import 'package:flutter_test/flutter_test.dart';
import 'package:nexora_mobile/main.dart';

void main() {
  test('driver app URL opens the driver role', () {
    expect(Uri.parse(driverAppUrl).fragment, '/driver');
  });
}
