# Hello Translate Chrome Extension

This is a minimal Manifest V3 Chrome extension that can be loaded unpacked from source.
It now includes a settings page for a translation hotkey and target language.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `/Users/ka/p/personal/chrome-translate`

## Files

- `manifest.json`: Extension metadata and entry points.
- `Taskfile.yml`: Packaging and Chrome Web Store upload/publish automation.
- `popup.html`, `popup.css`, `popup.js`: Browser action popup UI.
- `options.html`, `options.css`, `options.js`: Extension settings UI.
- `background.js`: Background service worker.

## Current configuration

- Suggested macOS hotkey: `Command+Shift+9`
- Target languages: English (`en`) and Russian (`ru`)
- Translation providers: Google Cloud Translation Basic v2 and DeepL v2
- Shortcut customization page in Chrome: `chrome://extensions/shortcuts`

## Translation flow

1. Select text on any regular `http` or `https` page.
2. Press the configured shortcut.
3. Chrome opens the extension popup.
4. The popup reads the current selection, calls every enabled translation service, and shows one result card per provider.
5. Every run is saved to local history with source text, provider results, page title, page URL, and timestamp.

Optional mode: enable auto translate in settings to open the popup automatically after you finish a mouse selection. Translation starts only after the mouse button is released.

If you reloaded the unpacked extension and test on a tab that was already open, refresh that page once first.

## Provider setup

1. Create a Google Cloud project.
2. Enable Cloud Translation Basic v2.
3. Create an API key.
4. Open the extension settings page and paste the key into the Google API key field.
5. If you want DeepL too, paste a DeepL API key and enable that service.

The target language is stored in `chrome.storage.sync`. The API key is stored in `chrome.storage.local`.
Translation history is stored in `chrome.storage.local` and can be reviewed or cleared from the settings page.

DeepL note: this implementation uses direct client-side API calls because you requested that behavior. DeepL's own docs recommend not exposing API keys in client-side code.

## Next steps for Chrome Web Store

- Finalize permissions and any host access your extension needs.
- Replace `homepage_url` and listing copy with your production values.

## Automation

- `task validate`: Check manifest and required icon files.
- `task package`: Build `dist/hello-translate-<version>.zip`.
- `task webstore-upload`: Upload the packaged zip to an existing Chrome Web Store item.
- `task webstore-publish`: Publish the uploaded draft.
- `task webstore-deploy`: Package, upload, and publish in one command.

Required environment variables for Web Store API tasks:

- `CHROME_EXTENSION_ID`: Your Chrome Web Store extension id.
- `CHROME_WEBSTORE_TOKEN`: A valid Google OAuth or service-account access token for the Chrome Web Store API.
- `CHROME_PUBLISH_TARGET`: Optional. Defaults to `default`.
