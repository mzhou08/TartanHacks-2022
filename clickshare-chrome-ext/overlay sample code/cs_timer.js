/** Route the message depending on the type of message. */
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === "ping") {
    sendResponse("pong");
  } else if (msg.type === "connect") {
    connect(sendResponse);
    return true; // Tell the caller we will be async
  } else if (msg.type === "disconnect") {
    disconnect(sendResponse);
  } else if (msg.type === "user action") {
    performUserAction(msg.payload, sendResponse);
  } else if (msg.type === "create transaction") {
    performCreateTransactionAction(msg.payload, sendResponse);
    return true; // Tell the caller we will be async
  } else if (msg.type === "check formula") {
    performCheckFormula(msg.payload, sendResponse);
    return true; // Tell the caller we will be async
  }
});

/** Start observe the game page div for changes to the game-state-version data field.
 * When that changes, we know there has been an update, so update the game state.
 *
 * Note that the game page div might be in the process of being created,
 * so wait for it to appear. Return false if it never shows up, or something
 * else goes wrong. Otherwise, return true.
 */
async function connect(sendResponse) {
  try {
    const gamePageDiv = await waitForElement("game-page");
    observer.disconnect();
    observer.observe(gamePageDiv, {
      attributes: true,
      attributeFilter: ["data-game-state-version"],
    });
    updateGameState();
    sendResponse(true);
  } catch (error) {
    console.error(error);
    sendResponse(false);
    alert(
      "Could not find an active game. First join the game to watch, then click the extension icon."
    );
  }
}

/** Stop watching for game state changes, and clear the game state. */
function disconnect(sendResponse) {
  observer.disconnect();
  chrome.storage.local.set({gameState: null});
  sendResponse();
}

/** The observer that, when it is triggered, updates the game state. */
const observer = new MutationObserver((mutation) => {
  updateGameState();
});

/** Looks at the DOM and from it extracts the information that
 * the overlay tab needs to show the overlay, then sets that
 * in storage so the overlay tab can react to it.
 */
function updateGameState() {
  const gamePageDiv = document.getElementById("game-page");
  const playerContainerDiv = document.querySelector(".timer-container");
  const turnOrder = [];
  const tokenTotals = {};
  const playerColors = {};
  const playerNames = {};

  playerContainerDiv
    .querySelectorAll(".tile:not(.isAdmin)")
    .forEach((player) => {
      if (player instanceof HTMLElement) {
        const uid = player.dataset.playerId;
        turnOrder.push({
          uid,
          color: player.style.backgroundColor,
          passed: player.classList.contains("hasPassed"),
          isCurrent: player.classList.contains("isActivePlayer"),
          timeTotalExceptCurrentTurn: Number.parseInt(
            player.getAttribute("data-time-total-except-current-turn")
          ),
        });
        tokenTotals[uid] = {};
        player.querySelectorAll(".token-amount").forEach((tokenAmount) => {
          if (tokenAmount instanceof HTMLElement) {
            tokenTotals[uid][tokenAmount.dataset.token] =
              tokenAmount.dataset.amount;
          }
        });

        const style = player.getAttribute("style");
        const playerColorsArray = [];
        const regex = /(--[a-z-]+):\s*(.+?)\s*;/gi;
        let match = regex.exec(style);
        while (match) {
          playerColorsArray.push([match[1], match[2]]);
          match = regex.exec(style);
        }
        playerColors[uid] = playerColorsArray;
        playerNames[uid] = player.querySelector(".name").textContent;
      }
    });

  const userDiv = playerContainerDiv.querySelector(".isUser");
  const ownUid = userDiv.dataset.playerId;
  const userActionsDiv = userDiv.querySelector(".actions");
  const userActions = [];
  userActionsDiv.querySelectorAll("button").forEach((button) => {
    userActions.push(button.textContent.trim());
  });

  const bankLogPreview = [];
  gamePageDiv
    .querySelectorAll(".bank-log-preview .transaction")
    .forEach((t) => {
      if (t instanceof HTMLElement) {
        bankLogPreview.push({
          formula: t.dataset.formula,
          initiator: t.dataset.initiator,
          associate: t.dataset.associate,
          token: t.dataset.token,
          amount: t.dataset.amount,
          ts: t.dataset.ts,
        });
      }
    });

  const gameStateVersion = Number(gamePageDiv.dataset.gameStateVersion);
  const allowInterPlayerTransactions =
    gamePageDiv.dataset.allowInterPlayerTransactions === "true";

  const gameState = {
    turnOrder,
    userActions,
    playerColors,
    playerNames,
    gameStateVersion,
    tokenTotals,
    bankLogPreview,
    allowInterPlayerTransactions,
    ownUid,
    timestamp: Date.now(),
  };
  chrome.storage.local.set({gameState});
}

/** 1) Checks that the game state version hasn't changed, and thus the game state
 * hasn't changed since the action was seen and sent over to the overlay tab.
 * 2) Looks for the button in the timer tab and clicks it.
 */
function performUserAction(payload, sendResponse) {
  const {action, gameStateVersion} = payload;
  try {
    const gamePageDiv = document.getElementById("game-page");
    if (!gamePageDiv) throw new Error("The game page is missing!");
    if (
      Number(gamePageDiv.dataset.gameStateVersion) !== Number(gameStateVersion)
    ) {
      throw new Error(
        "Game state had become old before the action was performed. Try again."
      );
    }
    document
      .querySelectorAll(".timer-container .tile.isUser .actions button")
      .forEach((btn) => {
        if (btn.textContent.trim() === action) btn.click();
      });
    sendResponse(true);
  } catch (error) {
    sendResponse({error: error.message});
  }
}

async function performCreateTransactionAction(payload, sendResponse) {
  const trannyPanel = document.getElementById(
    "bank-transfer-overlay-control-panel"
  );
  const trannyObserver = new MutationObserver((mutations) => {
    const {result, error} = trannyPanel.dataset;
    if (result === "") return;
    if (result === "ERROR" && error === "") return;
    sendResponse(result === "ERROR" ? {error} : true);
    trannyObserver.disconnect();
  });
  trannyObserver.observe(trannyPanel, {
    subtree: false,
    attributes: true,
  });

  document.getElementById("bank-transfer-overlay-associate").value =
    payload.associate;
  document.getElementById("bank-transfer-overlay-formula").value =
    payload.formula;
  document.getElementById("bank-transfer-overlay-token").value = payload.token;
  document.getElementById("bank-transfer-overlay-submit").click();
}

async function performCheckFormula(payload, sendResponse) {
  const trannyPanel = document.getElementById(
    "bank-transfer-overlay-control-panel"
  );
  const trannyObserver = new MutationObserver((mutations) => {
    const {result, error} = trannyPanel.dataset;
    if (result === "") return;
    if (result === "ERROR" && error === "") return;
    sendResponse(result === "ERROR" ? {error} : result);
    trannyObserver.disconnect();
  });
  trannyObserver.observe(trannyPanel, {
    subtree: false,
    attributes: true,
  });
  document.getElementById("bank-transfer-overlay-formula").value =
    payload.formula;
  document.getElementById("bank-transfer-overlay-check").click();
}

/** Waits for the element with the given ID to appear in the DOM, and
 * then returns it. If that doesn't happen within 2 seconds, reject.
 */
function waitForElement(id) {
  const el = document.getElementById(id);
  if (el) return Promise.resolve(el);
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver((mutations, thisObserver) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((elAdded) => {
          if (elAdded instanceof HTMLElement && elAdded.id === id) {
            thisObserver.disconnect();
            resolve(elAdded);
          }
        });
      });
    });
    observer.observe(document.body, {childList: true, subtree: true});
    window.setTimeout(() => {
      observer.disconnect();
      reject();
    }, 2000);
  });
}
