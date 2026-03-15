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
const saveButton = document.getElementById("save-settings");
const status = document.getElementById("status");

const providerLabels = {
  google: "Google",
  deepl: "DeepL",
  extension: "Extension"
};

async function loadSettings() {
  const {
    targetLanguage = "en",
    enabledProviders = ["google"],
    autoTranslateSelection = false
  } = await chrome.storage.sync.get([
    "targetLanguage",
    "enabledProviders",
    "autoTranslateSelection"
  ]);
  const { googleApiKey = "", deeplApiKey = "" } = await chrome.storage.local.get(
    ["googleApiKey", "deeplApiKey"]
  );

  targetLanguageInput.value = targetLanguage;
  autoTranslateSelectionInput.checked = autoTranslateSelection;
  useGoogleInput.checked = enabledProviders.includes("google");
  googleApiKeyInput.value = googleApiKey;
  useDeeplInput.checked = enabledProviders.includes("deepl");
  deeplApiKeyInput.value = deeplApiKey;

  await loadHistory();
}

saveButton.addEventListener("click", async () => {
  await persistSettings();
});

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

async function persistSettings({ statusMessage = "Settings saved." } = {}) {
  const enabledProviders = [];
  const targetLanguage = targetLanguageInput.value || "en";

  if (useGoogleInput.checked) {
    enabledProviders.push("google");
  }

  if (useDeeplInput.checked) {
    enabledProviders.push("deepl");
  }

  await chrome.storage.sync.set({
    targetLanguage,
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
