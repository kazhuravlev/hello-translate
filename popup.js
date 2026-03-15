const openOptionsButton = document.getElementById("open-options");
const autoTranslateToggle = document.getElementById("auto-translate-toggle");
const shortcut = document.getElementById("shortcut");
const targetLanguage = document.getElementById("target-language");
const providerStatus = document.getElementById("provider-status");
const sourceText = document.getElementById("source-text");
const results = document.getElementById("results");

const providerLabels = {
  google: "Google",
  deepl: "DeepL",
  extension: "Extension"
};

async function loadSettings() {
  const {
    targetLanguageLabel = "English (American)",
    enabledProviders = ["google"],
    autoTranslateSelection = false
  } = await chrome.storage.sync.get([
    "targetLanguageLabel",
    "enabledProviders",
    "autoTranslateSelection"
  ]);
  const { lastTranslationRun = null } = await chrome.storage.local.get([
    "lastTranslationRun"
  ]);
  const commands = await chrome.commands.getAll();
  const translateCommand = commands.find(
    ({ name }) => name === "_execute_action"
  );

  targetLanguage.textContent = targetLanguageLabel.toUpperCase();
  providerStatus.textContent = enabledProviders.length
    ? enabledProviders.map((provider) => providerLabels[provider] || provider).join("+").toUpperCase()
    : "NONE";
  shortcut.textContent = `KEY:${translateCommand?.shortcut || "Command+Shift+9"}`;
  autoTranslateToggle.checked = autoTranslateSelection;
  renderLastTranslation(lastTranslationRun);
}

openOptionsButton.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
});

autoTranslateToggle.addEventListener("change", async () => {
  await chrome.storage.sync.set({
    autoTranslateSelection: autoTranslateToggle.checked
  });
});

loadSettings().catch(() => {
  targetLanguage.textContent = "ENGLISH (AMERICAN)";
  providerStatus.textContent = "UNAVAILABLE";
});

runTranslation().catch(() => {
  providerStatus.textContent = "UNAVAILABLE";
});

function renderLastTranslation(lastTranslationRun) {
  results.replaceChildren();

  if (!lastTranslationRun) {
    sourceText.textContent = "Select text to translate.";
    results.replaceChildren(renderEmptyResult("No translation yet."));
    return;
  }

  sourceText.textContent = lastTranslationRun.sourceText || "No selected text.";

  for (const result of lastTranslationRun.results || []) {
    const card = document.createElement("article");
    const title = document.createElement("p");
    const text = document.createElement("p");
    const meta = document.createElement("p");

    card.className = `result-card${result.ok ? "" : " is-error"}`;
    title.className = "result-title";
    text.className = "result-text";
    meta.className = "result-meta";

    title.textContent = providerLabels[result.provider] || result.provider;
    text.textContent = result.ok ? result.translatedText : result.error;
    meta.textContent = result.ok
      ? `From ${result.detectedSourceLanguage || "auto"} to ${result.targetLanguage}`
      : "Provider request failed.";

    card.append(title, text, meta);
    results.append(card);
  }
}

async function runTranslation() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "RUN_TRANSLATION"
    });

    await loadSettings();
    if (!response?.ok) {
      providerStatus.textContent = "UNAVAILABLE";
    }
  } catch (error) {
    providerStatus.textContent = "UNAVAILABLE";
    throw error;
  }
}

function renderEmptyResult(text) {
  const card = document.createElement("article");
  const body = document.createElement("p");

  card.className = "result-card";
  body.className = "result-text";
  body.textContent = text;
  card.append(body);
  return card;
}
