chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_SELECTION_TEXT") {
    sendResponse({
      selectedText: getSelectedText()
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
  const activeElement = document.activeElement;

  if (isTextField(activeElement)) {
    const selectionStart = activeElement.selectionStart ?? 0;
    const selectionEnd = activeElement.selectionEnd ?? 0;

    return activeElement.value.slice(selectionStart, selectionEnd).trim();
  }

  return window.getSelection()?.toString().trim() ?? "";
}

function isTextField(element) {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement &&
      ["search", "text", "url", "tel", "password"].includes(element.type))
  );
}
