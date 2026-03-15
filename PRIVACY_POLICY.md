# Privacy Policy for Hello Translate

Effective date: March 15, 2026

## Overview

Hello Translate is a Chrome extension that translates text you select on web pages.
This policy explains what data the extension processes, where that data is stored,
and when it is shared with third-party services.

## Information the extension processes

Hello Translate may process the following information when you use it:

- Selected text from the current page
- The target language you choose
- Provider settings, such as whether Google and/or DeepL are enabled
- Translation provider API keys that you enter
- Translation history saved by the extension
- The page title and page URL associated with a saved translation
- Timestamps for saved translations

## How the extension uses information

The extension uses this information to:

- Read the text you explicitly select for translation
- Send selected text to the translation provider or providers you enabled
- Show translation results in the popup
- Save your settings and translation history locally in Chrome storage
- Support optional auto-translate behavior after a mouse text selection

## When data is shared

Hello Translate does not run its own backend service.

If you enable a provider, the selected text you choose to translate is sent
directly from your browser to that provider's API:

- Google Cloud Translation Basic v2
- DeepL API v2

The extension only sends selected text to providers needed to complete your
requested translation.

The extension does not sell your data.

## Local storage

Hello Translate stores data in Chrome extension storage on your device.

Stored in `chrome.storage.sync`:

- Target language
- Enabled providers
- Auto-translate preference

Stored in `chrome.storage.local`:

- Google API key
- DeepL API key
- Last translation run
- Translation history

Translation history can include:

- Source text
- Translated results
- Provider name
- Detected source language
- Target language
- Page title
- Page URL
- Timestamp

## Permissions

Hello Translate uses Chrome permissions to:

- Access the active tab needed to read selected text
- Store settings and history
- Communicate with enabled translation provider APIs

The extension is intended to operate on regular `http` and `https` pages.

## Your choices

You can:

- Choose which translation providers to enable
- Change the target language
- Enable or disable auto-translate
- Clear translation history from the settings page
- Remove the extension at any time

If you do not want selected text sent to a provider, do not use the extension to
translate that text.

## Data retention

Settings and translation history remain in Chrome storage until:

- You change or remove them
- You clear translation history
- You remove the extension
- Chrome clears extension storage

## Security note

Hello Translate uses provider API keys that you enter manually.
Those keys are stored locally in Chrome extension storage.

DeepL keys are used directly from the client. If you enable DeepL, your API key
is present in the browser environment and used for direct API requests. You
should only use this setup if it matches your own security requirements.

## Children

Hello Translate is not specifically directed to children.

## Changes to this policy

This privacy policy may be updated if the extension's behavior changes.
The latest version should be published with the extension listing and repository.

## Contact

Project homepage:
https://github.com/kazhuravlev/hello-translate

