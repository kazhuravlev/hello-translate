chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SELECTION_TEXT") {
    const selection = getSelectionPayload();

    sendResponse({
      selectedText: selection.selectedText,
      contextText: selection.contextText,
      pageLanguage: document.documentElement.lang || "",
      pageTitle: document.title || "",
      pageUrl: window.location.href || ""
    });
  }
});

document.addEventListener("mouseup", () => {
  window.setTimeout(() => {
    const selectedText = getSelectedText();

    if (!selectedText) {
      return;
    }

    chrome.runtime.sendMessage({
      type: "AUTO_TRANSLATE_SELECTION_READY",
      selectedText
    }).catch(() => {
      // Ignore: popup open or auto-translate may not be available on this page.
    });
  }, 0);
});

function getSelectedText() {
  return getSelectionPayload().selectedText;
}

function getSelectionPayload() {
  const activeElement = document.activeElement;

  if (isTextField(activeElement)) {
    const selectionStart = activeElement.selectionStart ?? 0;
    const selectionEnd = activeElement.selectionEnd ?? 0;
    const selectedText = activeElement.value.slice(selectionStart, selectionEnd).trim();

    return {
      selectedText,
      contextText: buildTextFieldContext(activeElement.value, selectionStart, selectionEnd)
    };
  }

  return buildDomSelectionPayload();
}

function isTextField(element) {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      ["search", "text", "url", "tel", "password"].includes(element.type))
  );
}

function buildTextFieldContext(value, selectionStart, selectionEnd) {
  return normalizeContext(
    value.slice(Math.max(0, selectionStart - 220), selectionEnd + 220)
  );
}

function buildDomSelectionPayload() {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() ?? "";

  if (!selectedText || !selection?.rangeCount) {
    return {
      selectedText,
      contextText: ""
    };
  }

  const range = selection.getRangeAt(0);
  const contextNode =
    findContextElement(range.commonAncestorContainer) || document.body;
  const contextText = extractContextAroundSelection(
    normalizeContext(contextNode.textContent || ""),
    selectedText
  );

  return {
    selectedText,
    contextText
  };
}

function findContextElement(node) {
  const element =
    node instanceof Element ? node : node.parentElement;

  if (!element) {
    return null;
  }

  return (
    element.closest("p, li, blockquote, article, section, div, td, th") || element
  );
}

function extractContextAroundSelection(fullText, selectedText) {
  if (!fullText) {
    return "";
  }

  const normalizedSelection = normalizeContext(selectedText);
  const selectionIndex = fullText.indexOf(normalizedSelection);

  if (selectionIndex === -1) {
    return clampContext(fullText);
  }

  const before = fullText.slice(Math.max(0, selectionIndex - 220), selectionIndex);
  const selected = fullText.slice(
    selectionIndex,
    selectionIndex + normalizedSelection.length
  );
  const after = fullText.slice(
    selectionIndex + normalizedSelection.length,
    selectionIndex + normalizedSelection.length + 220
  );

  return normalizeContext([before, selected, after].filter(Boolean).join(" "));
}

function clampContext(text) {
  return normalizeContext(text.slice(0, 500));
}

function normalizeContext(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}
