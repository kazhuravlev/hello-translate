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

  if (message?.type === "GET_FOCUSED_TEXT_FIELD") {
    sendResponse(getFocusedTextFieldPayload());
  }

  if (message?.type === "REPLACE_FOCUSED_TEXT_FIELD") {
    sendResponse(replaceFocusedTextFieldValue(message));
  }
});

let pendingTextField = null;
let pendingTextFieldToken = "";

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
      ["search", "text", "url", "tel"].includes(element.type))
  );
}

function getFocusedTextFieldPayload() {
  const activeElement = getDeepActiveElement();

  if (!isTranslatableTextField(activeElement)) {
    pendingTextField = null;
    pendingTextFieldToken = "";
    return {
      ok: false,
      message: "Focus an editable text field first."
    };
  }

  if (activeElement.disabled || activeElement.readOnly) {
    return {
      ok: false,
      message: "The focused text field is not editable."
    };
  }

  if (!activeElement.value.trim()) {
    return {
      ok: false,
      message: "The focused text field is empty."
    };
  }

  pendingTextField = activeElement;
  pendingTextFieldToken = crypto.randomUUID();

  return {
    ok: true,
    fieldToken: pendingTextFieldToken,
    value: activeElement.value,
    contextText: normalizeContext(activeElement.value),
    pageLanguage: document.documentElement.lang || "",
    pageTitle: document.title || "",
    pageUrl: window.location.href || ""
  };
}

function replaceFocusedTextFieldValue({ fieldToken, translatedText }) {
  if (
    !pendingTextField ||
    !pendingTextField.isConnected ||
    fieldToken !== pendingTextFieldToken ||
    getDeepActiveElement() !== pendingTextField
  ) {
    return {
      ok: false,
      message: "The focused text field is no longer available."
    };
  }

  if (pendingTextField.disabled || pendingTextField.readOnly) {
    return {
      ok: false,
      message: "The focused text field is no longer editable."
    };
  }

  if (typeof translatedText !== "string" || !translatedText) {
    return {
      ok: false,
      message: "The translation service returned no replacement text."
    };
  }

  const field = pendingTextField;
  const valueSetter = Object.getOwnPropertyDescriptor(
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype,
    "value"
  )?.set;

  if (!valueSetter) {
    return {
      ok: false,
      message: "Could not update the focused text field."
    };
  }

  valueSetter.call(field, translatedText);
  field.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertReplacementText",
    data: translatedText
  }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  field.focus();
  field.setSelectionRange(translatedText.length, translatedText.length);
  pendingTextField = null;
  pendingTextFieldToken = "";

  return { ok: true };
}

function getDeepActiveElement() {
  let activeElement = document.activeElement;

  while (activeElement?.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }

  return activeElement;
}

function isTranslatableTextField(element) {
  return isTextField(element);
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
