const targetLanguageInput = document.getElementById("target-language");
const autoTranslateSelectionInput = document.getElementById(
  "auto-translate-selection"
);
const useGoogleInput = document.getElementById("use-google");
const googleApiKeyInput = document.getElementById("google-api-key");
const useDeeplInput = document.getElementById("use-deepl");
const deeplApiKeyInput = document.getElementById("deepl-api-key");
const clearHistoryButton = document.getElementById("clear-history");
const historyList = document.getElementById("history-list");
const status = document.getElementById("status");

const fallbackTargetLanguages = [
  { language: "AR", name: "Arabic" },
  { language: "BG", name: "Bulgarian" },
  { language: "CS", name: "Czech" },
  { language: "DA", name: "Danish" },
  { language: "DE", name: "German" },
  { language: "EL", name: "Greek" },
  { language: "EN-GB", name: "English (British)" },
  { language: "EN-US", name: "English (American)" },
  { language: "ES", name: "Spanish" },
  { language: "ET", name: "Estonian" },
  { language: "FI", name: "Finnish" },
  { language: "FR", name: "French" },
  { language: "HU", name: "Hungarian" },
  { language: "ID", name: "Indonesian" },
  { language: "IT", name: "Italian" },
  { language: "JA", name: "Japanese" },
  { language: "KO", name: "Korean" },
  { language: "LT", name: "Lithuanian" },
  { language: "LV", name: "Latvian" },
  { language: "NB", name: "Norwegian (Bokmal)" },
  { language: "NL", name: "Dutch" },
  { language: "PL", name: "Polish" },
  { language: "PT-BR", name: "Portuguese (Brazilian)" },
  { language: "PT-PT", name: "Portuguese (European)" },
  { language: "RO", name: "Romanian" },
  { language: "RU", name: "Russian" },
  { language: "SK", name: "Slovak" },
  { language: "SL", name: "Slovenian" },
  { language: "SV", name: "Swedish" },
  { language: "TR", name: "Turkish" },
  { language: "UK", name: "Ukrainian" },
  { language: "ZH", name: "Chinese (simplified)" }
];

const providerLabels = {
  google: "Google",
  deepl: "DeepL",
  extension: "Extension"
};

async function loadSettings() {
  const {
    targetLanguage: storedTargetLanguage = "EN-US",
    enabledProviders = ["google"],
    autoTranslateSelection = false,
    targetLanguageLabel = "English (American)"
  } = await chrome.storage.sync.get([
    "targetLanguage",
    "enabledProviders",
    "autoTranslateSelection",
    "targetLanguageLabel"
  ]);
  const { googleApiKey = "", deeplApiKey = "" } = await chrome.storage.local.get(
    ["googleApiKey", "deeplApiKey"]
  );
  const targetLanguage = normalizeTargetLanguage(storedTargetLanguage);

  await loadTargetLanguageOptions({
    deeplApiKey,
    selectedLanguage: targetLanguage,
    selectedLabel: targetLanguageLabel
  });
  autoTranslateSelectionInput.checked = autoTranslateSelection;
  useGoogleInput.checked = enabledProviders.includes("google");
  googleApiKeyInput.value = googleApiKey;
  useDeeplInput.checked = enabledProviders.includes("deepl");
  deeplApiKeyInput.value = deeplApiKey;

  await loadHistory();
}

targetLanguageInput.addEventListener("change", async () => {
  await persistSettings({
    statusMessage: "Target language saved."
  });
});

autoTranslateSelectionInput.addEventListener("change", async () => {
  await persistSettings({
    statusMessage: autoTranslateSelectionInput.checked
      ? "Auto translate enabled."
      : "Auto translate disabled."
  });
});

useGoogleInput.addEventListener("change", async () => {
  await persistSettings({
    statusMessage: useGoogleInput.checked
      ? "Google provider enabled."
      : "Google provider disabled."
  });
});

useDeeplInput.addEventListener("change", async () => {
  await persistSettings({
    statusMessage: useDeeplInput.checked
      ? "DeepL provider enabled."
      : "DeepL provider disabled."
  });
});

googleApiKeyInput.addEventListener("change", async () => {
  await persistSettings({
    statusMessage: "Google API key saved."
  });
});

deeplApiKeyInput.addEventListener("change", async () => {
  await loadTargetLanguageOptions({
    deeplApiKey: deeplApiKeyInput.value.trim(),
    selectedLanguage: targetLanguageInput.value,
    selectedLabel: targetLanguageInput.selectedOptions[0]?.textContent || ""
  });
  await persistSettings({
    statusMessage: "DeepL API key saved."
  });
});

async function persistSettings({ statusMessage = "Settings saved." } = {}) {
  const enabledProviders = [];
  const targetLanguage = normalizeTargetLanguage(
    targetLanguageInput.value || "EN-US"
  );
  const targetLanguageLabel =
    targetLanguageInput.selectedOptions[0]?.textContent || targetLanguage;

  if (useGoogleInput.checked) {
    enabledProviders.push("google");
  }

  if (useDeeplInput.checked) {
    enabledProviders.push("deepl");
  }

  await chrome.storage.sync.set({
    targetLanguage,
    targetLanguageLabel,
    enabledProviders,
    autoTranslateSelection: autoTranslateSelectionInput.checked
  });
  await chrome.storage.local.set({
    googleApiKey: googleApiKeyInput.value.trim(),
    deeplApiKey: deeplApiKeyInput.value.trim()
  });

  const { autoTranslateSelection = false } = await chrome.storage.sync.get([
    "autoTranslateSelection"
  ]);

  targetLanguageInput.value = targetLanguage;
  autoTranslateSelectionInput.checked = autoTranslateSelection;
  status.textContent = statusMessage;
}

clearHistoryButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({
    type: "CLEAR_TRANSLATION_HISTORY"
  });

  await loadHistory();
  status.textContent = "Translation history cleared.";
});

loadSettings().catch(() => {
  status.textContent = "Could not load saved settings.";
});

async function loadHistory() {
  const response = await chrome.runtime.sendMessage({
    type: "GET_TRANSLATION_HISTORY"
  });

  renderHistory(response?.history || []);
}

function renderHistory(history) {
  historyList.replaceChildren();

  if (!history.length) {
    const empty = document.createElement("p");

    empty.className = "history-empty";
    empty.textContent = "No translations saved yet.";
    historyList.append(empty);
    return;
  }

  for (const entry of history) {
    const item = document.createElement("article");
    const title = document.createElement("p");
    const link = document.createElement("a");
    const meta = document.createElement("p");
    const source = document.createElement("p");
    const results = document.createElement("div");

    item.className = "history-item";
    title.className = "history-title";
    link.className = "history-link";
    meta.className = "history-meta";
    source.className = "history-source";
    results.className = "history-results";

    title.textContent = entry.pageTitle || "Untitled page";
    link.href = entry.pageUrl || "#";
    link.textContent = entry.pageUrl || "No page URL";
    link.target = "_blank";
    link.rel = "noreferrer";
    meta.textContent = formatDate(entry.createdAt);
    source.textContent = `Selected text: ${entry.sourceText || "Unavailable"}`;

    for (const result of entry.results || []) {
      results.append(renderHistoryResult(result));
    }

    item.append(title, link, meta, source, results);
    historyList.append(item);
  }
}

function renderHistoryResult(result) {
  const card = document.createElement("section");
  const title = document.createElement("p");
  const text = document.createElement("p");
  const meta = document.createElement("p");

  card.className = `history-result${result.ok ? "" : " is-error"}`;
  title.className = "history-result-title";
  text.className = "history-result-text";
  meta.className = "history-result-meta";

  title.textContent = providerLabels[result.provider] || result.provider;
  text.textContent = result.ok ? result.translatedText : result.error;
  meta.textContent = result.ok
    ? `From ${result.detectedSourceLanguage || "auto"} to ${result.targetLanguage}`
    : "Provider request failed.";

  card.append(title, text, meta);
  return card;
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp);
}

async function loadTargetLanguageOptions({
  deeplApiKey,
  selectedLanguage,
  selectedLabel
}) {
  const languages = await fetchDeeplTargetLanguages(deeplApiKey).catch(() =>
    fallbackTargetLanguages
  );

  targetLanguageInput.replaceChildren();

  for (const { language, name } of mergeSelectedLanguage(
    languages,
    selectedLanguage,
    selectedLabel
  )) {
    const option = document.createElement("option");

    option.value = language;
    option.textContent = name;
    targetLanguageInput.append(option);
  }

  targetLanguageInput.value =
    targetLanguageInput.querySelector(`option[value="${selectedLanguage}"]`)
      ?.value || targetLanguageInput.options[0]?.value || "EN-US";
}

async function fetchDeeplTargetLanguages(apiKey) {
  if (!apiKey) {
    return fallbackTargetLanguages;
  }

  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/languages?type=target"
    : "https://api.deepl.com/v2/languages?type=target";
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`
    }
  });

  if (!response.ok) {
    throw new Error("Could not load DeepL target languages.");
  }

  const payload = await response.json();

  return payload
    .filter((item) => item?.language && item?.name)
    .map(({ language, name }) => ({ language, name }));
}

function mergeSelectedLanguage(languages, selectedLanguage, selectedLabel) {
  if (!selectedLanguage) {
    return languages;
  }

  if (languages.some(({ language }) => language === selectedLanguage)) {
    return languages;
  }

  return [
    {
      language: selectedLanguage,
      name: selectedLabel || selectedLanguage
    },
    ...languages
  ];
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
