// background.js
// Core idea: Chrome extensions cannot embed www.youtube.com in an <iframe>
// (YouTube blocks framing of the main site), and there is no API for a
// user to "drag" a custom panel in from the screen edge at the OS level.
// So instead we open a REAL, separate Chrome window - a normal browser
// window, just sized and positioned to sit docked against the right edge
// of the screen. Because it's a real window (not an embed), it's just
// youtube.com like any other tab: fully signed in, full search, full
// recommendations, everything works.
//
// On top of that: when the dock opens, we also shrink and snap the
// user's current window to the remaining left-hand space, so the two
// windows tile the screen instead of overlapping. When the dock closes,
// the original window is restored to wherever/whatever size it was
// before we touched it.

// ---------- dock (YouTube) window state ----------

async function getDockWindowId() {
  const { dockWindowId } = await chrome.storage.local.get('dockWindowId');
  return dockWindowId ?? null;
}

async function setDockWindowId(id) {
  await chrome.storage.local.set({ dockWindowId: id ?? null });
}

async function isDockOpen() {
  const id = await getDockWindowId();
  if (!id) return false;
  try {
    await chrome.windows.get(id);
    return true;
  } catch {
    // Window was closed by the user (e.g. clicked the X) - clean up.
    await setDockWindowId(null);
    return false;
  }
}

// ---------- main (the user's original) window state ----------

async function getMainWindowState() {
  const { mainWindowState } = await chrome.storage.local.get('mainWindowState');
  return mainWindowState ?? null;
}

async function setMainWindowState(state) {
  await chrome.storage.local.set({ mainWindowState: state ?? null });
}

// ---------- settings ----------

async function getSettings() {
  const { widthFraction = 3, autoOpen = false } = await chrome.storage.local.get([
    'widthFraction',
    'autoOpen'
  ]);
  return { widthFraction, autoOpen };
}

// ---------- display helpers ----------

function getAllDisplays() {
  return new Promise((resolve) => {
    chrome.system.display.getInfo((displays) => resolve(displays));
  });
}

// Picks whichever display a given window is actually sitting on (falls
// back to the primary display), so multi-monitor setups tile correctly
// instead of always assuming display #1.
function getDisplayForWindow(win, displays) {
  if (win && typeof win.left === 'number') {
    const cx = win.left + win.width / 2;
    const cy = win.top + win.height / 2;
    const match = displays.find(
      (d) =>
        cx >= d.bounds.left &&
        cx < d.bounds.left + d.bounds.width &&
        cy >= d.bounds.top &&
        cy < d.bounds.top + d.bounds.height
    );
    if (match) return match;
  }
  return displays.find((d) => d.isPrimary) || displays[0];
}

// ---------- shrinking / restoring the user's original window ----------

async function shrinkMainWindow(display, sidebarWidth, triggerWindowId) {
  let mainWin = null;

  if (triggerWindowId) {
    mainWin = await chrome.windows.get(triggerWindowId).catch(() => null);
  }
  if (!mainWin) {
    mainWin = await chrome.windows
      .getLastFocused({ windowTypes: ['normal'] })
      .catch(() => null);
  }
  if (!mainWin || mainWin.type !== 'normal') return;

  // Only remember the "before" bounds the first time we touch this
  // window, so re-triggering (or switching 1/3 <-> 1/4) doesn't
  // overwrite the saved state with already-shrunk bounds.
  const existing = await getMainWindowState();
  if (!existing || existing.id !== mainWin.id) {
    await setMainWindowState({
      id: mainWin.id,
      left: mainWin.left,
      top: mainWin.top,
      width: mainWin.width,
      height: mainWin.height,
      originalState: mainWin.state
    });
  }

  const wa = display.workArea;
  const leftWidth = wa.width - sidebarWidth; // exact complement - no gap, no overlap

  // Can't set bounds directly on a maximized/fullscreen window on every
  // platform - drop it to "normal" first, then apply the new bounds.
  if (mainWin.state !== 'normal') {
    await chrome.windows.update(mainWin.id, { state: 'normal' });
  }
  await chrome.windows.update(mainWin.id, {
    left: wa.left,
    top: wa.top,
    width: leftWidth,
    height: wa.height
  });
}

async function restoreMainWindow() {
  const state = await getMainWindowState();
  if (!state) return;

  try {
    await chrome.windows.get(state.id); // throws if it no longer exists
    if (state.originalState === 'maximized' || state.originalState === 'fullscreen') {
      await chrome.windows.update(state.id, { state: state.originalState });
    } else {
      await chrome.windows.update(state.id, {
        state: 'normal',
        left: state.left,
        top: state.top,
        width: state.width,
        height: state.height
      });
    }
  } catch {
    /* window was closed while the dock was open - nothing to restore */
  }

  await setMainWindowState(null);
}

// ---------- open / close / toggle the dock ----------

async function openDock(triggerWindowId) {
  if (await isDockOpen()) {
    const id = await getDockWindowId();
    chrome.windows.update(id, { focused: true });
    return;
  }

  const { widthFraction } = await getSettings();
  const displays = await getAllDisplays();

  const referenceWin = triggerWindowId
    ? await chrome.windows.get(triggerWindowId).catch(() => null)
    : await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);

  const display = getDisplayForWindow(referenceWin, displays);
  const wa = display.workArea; // excludes the OS taskbar/dock

  const width = Math.round(wa.width / widthFraction);
  const height = wa.height;
  const left = wa.left + wa.width - width; // flush against the right edge
  const top = wa.top;

  // Shrink & snap the user's current window into the remaining left
  // space first, so the moment the new window appears, the two already
  // tile without colliding.
  await shrinkMainWindow(display, width, referenceWin ? referenceWin.id : null);

  chrome.windows.create(
    {
      url: 'https://www.youtube.com',
      type: 'popup', // no tab strip/bookmarks bar -> more like a real sidebar
      left,
      top,
      width,
      height,
      focused: true
    },
    (win) => {
      setDockWindowId(win.id);
    }
  );
}

async function closeDock() {
  const id = await getDockWindowId();
  if (id) {
    try {
      await chrome.windows.remove(id);
    } catch {
      /* already closed */
    }
    await setDockWindowId(null);
  }
  await restoreMainWindow();
}

async function toggleDock(triggerWindowId) {
  if (await isDockOpen()) {
    await closeDock();
  } else {
    await openDock(triggerWindowId);
  }
}

// Keep storage in sync if either window is closed by hand (the dock's
// own X, or the user closing their original window entirely).
chrome.windows.onRemoved.addListener(async (closedId) => {
  const dockId = await getDockWindowId();
  if (dockId === closedId) await setDockWindowId(null);

  const mainState = await getMainWindowState();
  if (mainState && mainState.id === closedId) await setMainWindowState(null);
});

// Keyboard shortcut (default Ctrl+Shift+Y / Cmd+Shift+Y, editable in
// chrome://extensions/shortcuts). Chrome passes the active tab of the
// window the shortcut was pressed in, so we know exactly which window
// to shrink.
chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd === 'toggle-sidebar') toggleDock(tab ? tab.windowId : undefined);
});

// Messages from popup.html.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'TOGGLE_DOCK') {
    toggleDock().then(() => sendResponse({ ok: true }));
    return true; // keep the channel open for the async response
  }
  if (msg.type === 'GET_STATUS') {
    isDockOpen().then((open) => sendResponse({ open }));
    return true;
  }
});

// Optional: auto-open the dock the moment a LeetCode problem page finishes
// loading, if the user has turned that setting on. Uses the tab's own
// window, since that's the window that should get shrunk regardless of
// which window currently has focus.
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  const { autoOpen } = await getSettings();
  if (!autoOpen) return;
  if (/^https:\/\/(www\.)?leetcode\.com\/problems\//.test(tab.url)) {
    if (!(await isDockOpen())) openDock(tab.windowId);
  }
});