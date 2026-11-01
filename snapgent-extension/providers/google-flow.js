// SPDX-License-Identifier: GPL-3.0-or-later
// providers/google-flow.js - Provider for Google Flow (flow.google.com)
// eslint-disable-next-line no-unused-vars
const ZSProvider = (() => {
  "use strict";
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let diag = () => {};
  let locked = false;
  let lockedEditor = null;

  const S = {
    user: '[data-message-author-role="user"], [data-testid*="user-message"], .user-message, [class*="UserMessage"], [class*="user-bubble"]',
    assistant: '[data-message-author-role="assistant"], [data-testid*="assistant-message"], .assistant-message, [data-testid*="session-message"], [class*="ModelMessage"], [class*="AssistantMessage"], [class*="bot-message"]',
    editor: [
      'textarea[placeholder*="create" i]',
      'textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="prompt" i]',
      'textarea',
      '[contenteditable="true"]',
      'input[type="text"][placeholder*="create" i]'
    ].join(","),
    send: [
      'button[aria-label*="Send" i]',
      'button[aria-label*="Submit" i]',
      'button[data-testid*="send" i]',
      'button[type="submit"]',
      'button:has(svg)'
    ].join(","),
    stop: [
      'button[aria-label*="Stop" i]',
      'button[data-testid*="stop" i]'
    ].join(",")
  };

  const timings = {
    GEN_IDLE_MS: 3000,
    REASON_IDLE_MS: 15000,
    WARMUP_MS: 60000,
    REASON_NOREPLY_MS: 120000,
    STABLE_MS: 10000,
    RESPONSE_TIMEOUT_MS: 300000,
  };

  const visible = (el) => !!el && el.isConnected && el.getClientRects().length > 0;

  function getEditor() {
    if (locked && visible(lockedEditor)) return lockedEditor;
    const all = document.querySelectorAll(S.editor);
    for (const el of all) {
      if (!el.closest("#zs-root") && visible(el)) return el;
    }
    return null;
  }

  const editorText = () => {
    const el = getEditor();
    if (!el) return "";
    return el.value !== undefined ? el.value : (el.innerText || el.textContent || "");
  };

  const allItems = () => {
    let items = [...document.querySelectorAll(`${S.user}, ${S.assistant}`)].filter(el => !el.closest("#zs-root"));
    if (items.length === 0) {
      // Fallback: look inside the session / chat drawer for message containers
      const drawer = document.querySelector('aside, [role="complementary"], [class*="session"], [class*="chat"]');
      if (drawer) {
        items = [...drawer.querySelectorAll('div[class*="message"], div[class*="bubble"], p')].filter(el => !el.closest("#zs-root") && (el.innerText || "").trim().length > 0);
      }
    }
    return items;
  };

  const isAssistantItem = (item) => !!item && (item.matches(S.assistant) || !!item.querySelector(S.assistant));
  const isUserItem = (item) => !isAssistantItem(item);

  const assistantItems = () => allItems().filter(isAssistantItem);
  const assistantCount = () => assistantItems().length;
  const userCount = () => allItems().filter(isUserItem).length;

  const lastAssistant = () => {
    const items = assistantItems();
    return items.length ? items[items.length - 1] : null;
  };

  const lastAssistantId = () => {
    const last = lastAssistant();
    return last ? (last.getAttribute("data-message-id") || last.id || String(assistantCount())) : null;
  };

  const itemText = (item) => {
    if (!item) return "";
    return (item.innerText || item.textContent || "").trim();
  };

  const readAssistant = () => {
    const last = lastAssistant();
    return last ? { item: last, reply: itemText(last) } : null;
  };

  const chatIsEmpty = () => allItems().length === 0;
  const isFreshChat = () => chatIsEmpty();

  const composerFrame = () => {
    const ed = getEditor();
    return ed ? (ed.closest("form") || ed.parentElement) : null;
  };

  const barMount = () => {
    const ed = getEditor();
    if (!ed) return null;
    let box = ed.closest("form") || ed.parentElement;
    while (box && box.parentElement && box.parentElement !== document.body) {
      if (box.offsetHeight > 50 && box.offsetWidth > 250) break;
      box = box.parentElement;
    }
    if (!box) return null;
    return {
      parent: box.parentElement,
      before: box,
      inside: false,
    };
  };

  const setInputLock = (state) => {
    locked = state;
    if (state) lockedEditor = getEditor();
    else lockedEditor = null;
  };

  async function typeAndSend(text) {
    const ed = getEditor();
    if (!ed) throw new Error("Google Flow editor not found");

    ed.focus();
    // React / Angular input value setter to trigger internal component state update
    const nativeSetter = Object.getOwnPropertyDescriptor(
      ed.tagName.toLowerCase() === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(ed, text);
    } else {
      ed.value = text;
    }

    ed.dispatchEvent(new Event("input", { bubbles: true }));
    ed.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(200);

    // Try finding send / submit button near the editor
    let sendBtn = null;
    let curr = ed;
    for (let i = 0; i < 5 && curr && curr !== document.body; i++) {
      sendBtn = curr.querySelector('button:not([disabled]):has(svg), button[type="submit"]:not([disabled]), button[aria-label*="send" i]:not([disabled]), button[aria-label*="submit" i]:not([disabled])');
      if (sendBtn && visible(sendBtn)) break;
      curr = curr.parentElement;
    }

    if (!sendBtn) {
      const allBtns = document.querySelectorAll(S.send);
      for (const b of allBtns) {
        if (visible(b) && !b.disabled && !b.closest("#zs-root")) {
          sendBtn = b;
          break;
        }
      }
    }

    if (sendBtn && visible(sendBtn) && !sendBtn.disabled) {
      sendBtn.click();
    } else {
      // Fallback: send Enter keydown with keyCode 13
      const enterDown = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true });
      ed.dispatchEvent(enterDown);
      const enterUp = new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true });
      ed.dispatchEvent(enterUp);
    }
  }

  const stopGeneration = () => {
    const stopBtn = document.querySelector(S.stop);
    if (stopBtn && visible(stopBtn)) stopBtn.click();
  };

  const isGenerating = () => {
    const stopBtn = document.querySelector(S.stop);
    return !!(stopBtn && visible(stopBtn));
  };

  const isBusyNow = () => isGenerating();
  const isHardGenerating = () => isGenerating();
  const enforceComposer = () => {};
  const ensureComposerReady = async () => {};
  const scanError = () => null;

  return {
    id: "google-flow",
    displayName: "Google Flow",
    sendRetryLimit: 1,
    supportsVision: true,
    timings,
    chipAtItemLevel: true,
    reliableCounts: true,
    init({ diag: d } = {}) { if (d) diag = d; },
    allItems, isUserItem, isAssistantItem, itemText, classifyText: itemText,
    assistantCount, userCount, lastAssistant, lastAssistantId, readAssistant,
    streamLen: () => 0, snapshot: () => ({}),
    getEditor, editorText, chatIsEmpty, isFreshChat, composerFrame, barMount,
    setInputLock, typeAndSend, stopGeneration,
    isGenerating, isBusyNow, isHardGenerating,
    enforceComposer, ensureComposerReady,
    turnHalted: () => false, findContinueBtn: () => null, clickContinueBtn: () => false,
    scanError, isTooLongMsg: () => false, isBusyMsg: () => false,
    attachImages: () => false, clearAttachments: () => {},
    conversationKey: () => location.pathname,
    installSendHooks: () => {},
    findToolBlockSpot: () => null,
  };
})();
