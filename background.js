const defaultSettings = {
  targetLanguage: "EN-US",
  targetLanguageLabel: "English (American)",
  enabledProviders: ["google"],
  autoTranslateSelection: false
};
const MAX_HISTORY_ITEMS = 100;
const recentAutoSelections = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    [
      "targetLanguage",
      "targetLanguageLabel",
      "enabledProviders",
      "autoTranslateSelection"
    ],
    ({
      targetLanguage,
      targetLanguageLabel,
      enabledProviders,
      autoTranslateSelection
    }) => {
      const nextSettings = {};

      if (!targetLanguage) {
        nextSettings.targetLanguage = defaultSettings.targetLanguage;
      }

      if (!targetLanguageLabel) {
        nextSettings.targetLanguageLabel = defaultSettings.targetLanguageLabel;
      }

      if (!Array.isArray(enabledProviders)) {
        nextSettings.enabledProviders = defaultSettings.enabledProviders;
      }

      if (typeof autoTranslateSelection !== "boolean") {
        nextSettings.autoTranslateSelection = defaultSettings.autoTranslateSelection;
      }

      if (Object.keys(nextSettings).length) {
        chrome.storage.sync.set(nextSettings);
      }
    }
  );

  chrome.storage.local.get(
    ["lastTranslationRun", "translationHistory"],
    ({ lastTranslationRun, translationHistory }) => {
      const nextState = {};

      if (typeof lastTranslationRun === "undefined") {
        nextState.lastTranslationRun = null;
      }

      if (!Array.isArray(translationHistory)) {
        nextState.translationHistory = [];
      }

      if (Object.keys(nextState).length) {
        chrome.storage.local.set(nextState);
      }
    }
  );

  console.log("Hello Translate extension installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "RUN_TRANSLATION") {
    handleTranslateCommand()
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          message: error.message || "Translation failed."
        });
      });

    return true;
  }

  if (message?.type === "GET_TRANSLATION_HISTORY") {
    chrome.storage.local.get(["translationHistory"], ({ translationHistory = [] }) => {
      sendResponse({
        history: translationHistory
      });
    });

    return true;
  }

  if (message?.type === "CLEAR_TRANSLATION_HISTORY") {
    chrome.storage.local.set({
      translationHistory: []
    }).then(() => {
      sendResponse({
        ok: true
      });
    });

    return true;
  }

  if (message?.type === "AUTO_TRANSLATE_SELECTION_READY") {
    handleAutoTranslateSelection(message, _sender)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          message: error.message || "Auto translate failed."
        });
      });

    return true;
  }
});

async function handleTranslateCommand() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) {
    return {
      ok: false,
      message: "No active tab found."
    };
  }

  try {
    const {
      selectedText,
      pageTitle = "",
      pageUrl = ""
    } = await getSelectedTextFromTab(tab.id);

    if (!selectedText) {
      await storeTranslationRun({
        sourceText: "",
        results: [
          {
            provider: "extension",
            ok: false,
            error: "Select some text first."
          }
        ]
      });
      return {
        ok: false,
        message: "Select some text first."
      };
    }

    const {
      targetLanguage: storedTargetLanguage = "EN-US",
      enabledProviders = ["google"]
    } = await chrome.storage.sync.get(["targetLanguage", "enabledProviders"]);
    const { googleApiKey = "", deeplApiKey = "" } = await chrome.storage.local.get([
      "googleApiKey",
      "deeplApiKey"
    ]);
    const targetLanguage = normalizeTargetLanguage(storedTargetLanguage);

    const results = await runEnabledProviders({
      enabledProviders,
      targetLanguage,
      text: selectedText,
      googleApiKey,
      deeplApiKey
    });

    await storeTranslationRun({
      pageTitle,
      pageUrl,
      sourceText: selectedText,
      targetLanguage,
      results
    });
    return {
      ok: true,
      message: "Translation finished."
    };
  } catch (error) {
    await storeTranslationRun({
      sourceText: "",
      results: [
        {
          provider: "extension",
          ok: false,
          error: error.message || "Translation failed."
        }
      ]
    });
    return {
      ok: false,
      message: error.message || "Translation failed."
    };
  }
}

async function handleAutoTranslateSelection(message, sender) {
  const { autoTranslateSelection = false } = await chrome.storage.sync.get([
    "autoTranslateSelection"
  ]);

  if (!autoTranslateSelection) {
    return {
      ok: false,
      message: "Auto translate is disabled."
    };
  }

  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  const selectedText = (message?.selectedText || "").trim();

  if (!tabId || typeof windowId !== "number" || !selectedText) {
    return {
      ok: false,
      message: "No selection available."
    };
  }

  const dedupeKey = `${tabId}:${selectedText}`;
  const now = Date.now();
  const lastSeen = recentAutoSelections.get(dedupeKey) || 0;

  if (now - lastSeen < 1200) {
    return {
      ok: false,
      message: "Duplicate selection ignored."
    };
  }

  recentAutoSelections.set(dedupeKey, now);

  try {
    await chrome.action.openPopup({ windowId });
  } catch (error) {
    console.warn("Could not open popup automatically.", error);
  }

  return {
    ok: true,
    message: "Auto translate popup opened."
  };
}

async function translateWithGoogle({ apiKey, targetLanguage, text }) {
  const response = await fetch(
    "https://translation.googleapis.com/language/translate/v2",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey
      },
      body: JSON.stringify({
        q: text,
        target: targetLanguage,
        format: "text"
      })
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload?.error?.message || "Google Translate request failed.";
    throw new Error(message);
  }

  const translated = payload?.data?.translations?.[0];

  if (!translated?.translatedText) {
    throw new Error("Google Translate returned an empty response.");
  }

  return translated;
}

async function translateWithDeepl({ apiKey, targetLanguage, text }) {
  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `DeepL-Auth-Key ${apiKey}`
    },
    body: JSON.stringify({
      text: [text],
      target_lang: targetLanguage
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.message || "DeepL request failed.";
    throw new Error(message);
  }

  const translated = payload?.translations?.[0];

  if (!translated?.text) {
    throw new Error("DeepL returned an empty response.");
  }

  return {
    translatedText: translated.text,
    detectedSourceLanguage: translated.detected_source_language
  };
}

async function runEnabledProviders({
  enabledProviders,
  targetLanguage,
  text,
  googleApiKey,
  deeplApiKey
}) {
  if (!enabledProviders.length) {
    return [
      {
        provider: "extension",
        ok: false,
        error: "Enable at least one translation service in settings."
      }
    ];
  }

  const tasks = enabledProviders.map(async (provider) => {
    try {
      if (provider === "google") {
        if (!googleApiKey) {
          throw new Error("Google API key is missing.");
        }

        const translated = await translateWithGoogle({
          apiKey: googleApiKey,
          targetLanguage,
          text
        });

        return {
          provider,
          ok: true,
          translatedText: translated.translatedText,
          detectedSourceLanguage: translated.detectedSourceLanguage,
          targetLanguage
        };
      }

      if (provider === "deepl") {
        if (!deeplApiKey) {
          throw new Error("DeepL API key is missing.");
        }

        const translated = await translateWithDeepl({
          apiKey: deeplApiKey,
          targetLanguage,
          text
        });

        return {
          provider,
          ok: true,
          translatedText: translated.translatedText,
          detectedSourceLanguage: translated.detectedSourceLanguage,
          targetLanguage
        };
      }

      throw new Error("Unsupported provider.");
    } catch (error) {
      return {
        provider,
        ok: false,
        error: error.message || "Translation failed."
      };
    }
  });

  return Promise.all(tasks);
}

async function storeTranslationRun(lastTranslationRun) {
  const persistedRun = {
    ...lastTranslationRun,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  const { translationHistory = [] } = await chrome.storage.local.get([
    "translationHistory"
  ]);

  await chrome.storage.local.set({
    lastTranslationRun: persistedRun,
    translationHistory: [persistedRun, ...translationHistory].slice(
      0,
      MAX_HISTORY_ITEMS
    )
  });
}

async function getSelectedTextFromTab(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "GET_SELECTION_TEXT"
    });
  } catch (error) {
    const noReceiver =
      chrome.runtime.lastError?.message ||
      error?.message ||
      "Could not reach the page.";

    throw new Error(
      /Receiving end does not exist/i.test(noReceiver)
        ? "Refresh the page once after reloading the extension, then try again."
        : noReceiver
    );
  }
}

function normalizeTargetLanguage(language) {
  const normalized = String(language || "").trim().toUpperCase();

  if (normalized === "EN") {
    return "EN-US";
  }

  if (normalized === "RU") {
    return "RU";
  }

  return normalized || "EN-US";
}
