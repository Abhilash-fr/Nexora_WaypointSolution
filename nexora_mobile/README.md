# Nexora Driver Mobile

This Flutter app opens the existing Nexora Driver web interface inside a native
Android/iOS WebView. When run in a browser, it embeds the same interface in an
iframe instead; `webview_flutter` itself does not provide a browser implementation.

## Run locally

Start the backend and database from the repository root:

```powershell
docker compose up db backend
```

In another terminal, start the Vite app so an Android emulator or phone can reach
it:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

Then run Flutter from this folder:

```powershell
cd nexora_mobile
flutter pub get
flutter run
```

The default URL is `http://10.0.2.2:5173/#/driver` for the Android emulator.
For a physical phone, use the computer's LAN IP and pass it as a Dart define:

```powershell
flutter run --dart-define=DRIVER_WEB_URL=http://192.168.1.20:5173/#/driver
```

Replace `192.168.1.20` with the computer's LAN IP. The phone and computer must
be on the same network. For Flutter's Chrome target, the default URL is
`http://localhost:5173/#/driver`; run the Vite server on the same computer.

The Android manifest permits cleartext traffic for local HTTP development. Use
an HTTPS URL and remove `android:usesCleartextTraffic="true"` before releasing
the app publicly.
