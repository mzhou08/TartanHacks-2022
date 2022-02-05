/// <reference path="../web/node_modules/@types/chrome/index.d.ts" />

const timerTabRegex = /https?:\/\/(?:localhost:3000|sharedgametimer.com)\/(?:game\/([a-z0-9-]+)(\/join|\/create)?)?/;

/** Clear the storage upon installation/activation */
self.addEventListener("activate", function (event) {
  setStorage({
    gameState: null,
    timerTab: null,
    userAction: null,
    activeGame: null,
  });
});

const passThroughCommands = [
  "show-hide-log",
  "transact-money",
  "transact-vp",
  "show-hide-opponent-score",
];
chrome.commands.onCommand.addListener(function (command, tab) {
  if (passThroughCommands.includes(command)) {
    chrome.tabs.sendMessage(tab.id, {type: "command", command});
  } else {
    console.warn("Unknown command received: " + command);
  }
});

/** Message Handler, passing User Actions from Overlay -> Timer tab. */
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (
    msg.type === "user action" ||
    msg.type === "create transaction" ||
    msg.type === "check formula"
  ) {
    getStorageSingle("timerTab").then((timerTab) => {
      if (!timerTab) {
        sendResponse({error: "No Timer Tab registered."});
      } else {
        sendMessage(timerTab, msg)
          .then((response) => sendResponse(response))
          .catch((error) => {
            if (error instanceof Error) sendResponse({error: error.message});
            else if (typeof error === "string") sendResponse({error});
            else if (error && typeof error.error === "string")
              sendResponse(error);
            else sendResponse({error: "unknown"});
          });
      }
    });
    return true;
  }
});

/** When we click the Game Timer Icon, we
 * 1) Ping the tab to see if it responds. If it doesn't, we inject our scripts.
 * 2) We then tell the tab in question to handle the click.
 */
chrome.action.onClicked.addListener(async (tab) => {
  const isTimerTab = timerTabRegex.exec(tab.url);
  const pingOk = await pingTab(tab.id);
  if (!pingOk) {
    if (isTimerTab) {
      const prevTimerTabId = await getStorageSingle("timerTab");
      if (prevTimerTabId) await disconnectTimerTab(prevTimerTabId);
      console.log(`Injecting script into timer tab ${tab.id}`);
      await inject(tab, "cs_timer.js");
    } else {
      console.log(`Injecting script and CSS into tab ${tab.id}`);
      await inject(tab, "cs_overlay.js", "cs_overlay.css");
    }
  } else {
    console.log("Ping responded. Skipping init of content script.");
  }
  if (isTimerTab) {
    connectOrDisconnectTimerTab(tab);
  } else {
    connectOrDisconnectOverlayTab(tab);
  }
});

/** If we close the timer tab, disconnect it. */
chrome.tabs.onRemoved.addListener(async (tabid, removeInfo) => {
  const currentTimerTab = await getStorageSingle("timerTab");
  if (currentTimerTab === tabid) {
    await disconnectTimerTab(tabid);
  }
});

/** If we e.g. update the URL of the timer tab, connect or disconenct
 * depending on the new URL. */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url || changeInfo.status !== "complete") return;
  const match = timerTabRegex.exec(tab.url);
  if (match) {
    const activeGame = await getStorageSingle("activeGame");
    if (match[1] !== activeGame && match[2] === undefined) {
      connectOrDisconnectTimerTab(tab);
    }
  }
});

/** Ask the tab to toggle its active state, and report
 * back true if it is now active, false otherwise. */
async function connectOrDisconnectOverlayTab(tab) {
  const tabId = tab.id;
  const tabNowActive = await sendMessage(tabId, {type: "toggle"});
  if (tabNowActive) {
    setTabIconConnectionStatus(tabId, true);
  } else {
    setTabIconConnectionStatus(tabId, null);
  }
}

/** Check if the tab is a game page, then connect.
 * Otherwise disconnect. */
async function connectOrDisconnectTimerTab(tab) {
  const prevTimerTabId = await getStorageSingle("timerTab");
  if (prevTimerTabId) {
    // If there is an existing timer tab, disconnect it.
    await disconnectTimerTab(prevTimerTabId);
    // If the tab we wanted to connect to was the previous tab, then
    // all we want to do is disconnect it. Basically a toggle. So we are done.
    if (prevTimerTabId === tab.id) return;
  }

  // At this point, old tabs have been disconnected. Time to connect or disconnect this one.
  const match = timerTabRegex.exec(tab.url);
  if (match && match[1] && !tab.url.endsWith("/join")) {
    connectTimerTab(tab.id, match[1]);
  } else {
    disconnectTimerTab(tab.id);
  }
}

/** Connect the timer tab and save the tab's ID in storage for lookup later. */
async function connectTimerTab(tabId, gameId) {
  const connectionSuccessful = await sendMessage(tabId, {type: "connect"});
  if (connectionSuccessful) {
    setTabIconConnectionStatus(tabId, true);
    await setStorage({timerTab: tabId, activeGame: gameId});
  } else {
    setTabIconConnectionStatus(tabId, false);
    await setStorage({timerTab: null, activeGame: null});
  }
}

/** Disconnect from the timer tab, and remove the timerTab ID from storage
 *  so we know it is disconnected. */
async function disconnectTimerTab(tabId) {
  await sendMessage(tabId, {type: "disconnect"})
    .then(() => {
      setTabIconConnectionStatus(tabId, null);
    })
    .catch((error) => {
      console.warn(error);
      setTabIconConnectionStatus(tabId, false);
    });
  await setStorage({timerTab: null, gameState: null, activeGame: null});
}

/** Ping the given tab and return true if it works, false otherwise. */
function pingTab(tabId) {
  return promisify(chrome.tabs.sendMessage)(tabId, {type: "ping"})
    .then(() => true)
    .catch((error) => false);
}

/** Inject script and optionally CSS into the currently active tab. */
async function inject(tab, script, css) {
  const cssPromise = css
    ? promisify(chrome.scripting.insertCSS)({
        target: {tabId: tab.id},
        files: [css],
      })
    : Promise.resolve();
  const scriptPromise = promisify(chrome.scripting.executeScript)({
    target: {tabId: tab.id},
    files: [script],
  });
  await cssPromise;
  return scriptPromise;
}

/**
 * @param {boolean} connected true if connection OK, false if failure, null to clear
 */
function setTabIconConnectionStatus(tabId, connected) {
  if (connected === true) {
    chrome.action.setIcon({
      tabId,
      path: {
        16: "icons/success-16.png",
        24: "icons/success-24.png",
        32: "icons/success-32.png",
      },
    });
  } else if (connected === false) {
    chrome.action.setIcon({
      tabId,
      path: {
        16: "icons/error-16.png",
        24: "icons/error-24.png",
        32: "icons/error-32.png",
      },
    });
  } else if (connected === null || connected === undefined) {
    chrome.action.setIcon({
      tabId,
      path: {
        16: "icons/default-16.png",
        24: "icons/default-24.png",
        32: "icons/default-32.png",
      },
    });
  } else {
    console.warn("Illegal value", connected);
  }
}

/**** UTILS METHODS ************/

const setStorage = promisify(chrome.storage.local.set, chrome.storage.local);
const getStorage = promisify(chrome.storage.local.get, chrome.storage.local);
const setStorageSingle = (key, val) => setStorage({[key]: val});
const getStorageSingle = (key) => getStorage(key).then((items) => items[key]);
const sendMessage = promisify(chrome.tabs.sendMessage);

/**
 * @param {Function} f
 */
function promisify(f, applyTo) {
  return function (...args) {
    // return a wrapper-function (*)
    return new Promise((resolve, reject) => {
      function callback(result) {
        // our custom callback for f (**)
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message);
        } else {
          resolve(result);
        }
      }
      args.push(callback); // append our custom callback to the end of f arguments
      if (applyTo) f.call(applyTo, ...args);
      // call the original function
      else f.call(this, ...args); // call the original function
    });
  };
}
