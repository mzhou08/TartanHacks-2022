/** Apart from the ping, the only message we accept is 'toggle',
 * and that will either set up the overlay and activate the listeners
 * to watch for game state updates, or it will tear all of that down.
 * It returns true if the overlay is now active, else false.
 */
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.type === "ping") {
    sendResponse("pong");
  } else if (msg.type === "toggle") {
    if (chrome.storage.onChanged.hasListener(storageChangeHandler)) {
      chrome.storage.onChanged.removeListener(storageChangeHandler);
      removeElementById("sgt-player-order");
      removeElementById("sgt-actions");
      removeElementById("sgt-notification");
      removeElementById("sgt-bank");
      sendResponse(false);
    } else {
      chrome.storage.onChanged.addListener(storageChangeHandler);
      checkStorage();
      sendResponse(true);
    }
  } else if (msg.type === "command") {
    if (msg.command === "show-hide-log") {
      document.getElementById("sgt-bank-log").classList.toggle("sgt-hide");
    } else if (msg.command === "show-hide-opponent-score") {
      const bank = document.getElementById("sgt-bank");
      bank.classList.add("sgt-animating-1s");
      setTimeout(() => bank.classList.toggle("sgt-hide-opponents"), 1);
      setTimeout(() => bank.classList.remove("sgt-animating-1s"), 1000);
    } else if (msg.command === "transact-money") {
      startTransactionFor("💲");
    } else if (msg.command === "transact-vp") {
      startTransactionFor("⭐");
    } else {
      console.warn("Unknown Command: ", msg);
    }
  } else {
    console.warn("Unknown Message: ", msg);
  }
});

/** If the gameState updates, in storage, then update the game, */
function storageChangeHandler(changes, namespace) {
  if (namespace !== "local") return;
  for (var key in changes) {
    if (key === "gameState") {
      updateGame(changes[key].newValue);
    }
  }
}

/** Check the storage and update the game state with whatever is there now. */
function checkStorage(changes, namespace) {
  chrome.storage.local.get(null, (value) => {
    updateGame(value && value.gameState ? value.gameState : null);
  });
}

/** Interval for updating the time percentages of the player total time. */
let timeTotalUpdateInterval = null;

/** Create the overlay */
function updateGame(state) {
  // We have two top-level containers. First, create or delete them
  // depending on if we have a game to show or not.

  // A third top-level element is the notification, which is only
  // active is the other two are not.
  let sgtPlayerOrder = document.getElementById("sgt-player-order");
  let sgtActions = document.getElementById("sgt-actions");
  let sgtNotification = document.getElementById("sgt-notification");
  let sgtBank = document.getElementById("sgt-bank");

  if (!state) {
    if (sgtPlayerOrder)
      sgtPlayerOrder.parentElement.removeChild(sgtPlayerOrder);
    if (sgtActions) sgtActions.parentElement.removeChild(sgtActions);
    if (sgtBank) sgtBank.parentElement.removeChild(sgtBank);

    if (!sgtNotification) {
      showNotification(
        `<p>No game detected. Please open <a href="https://sharedgametimer.com/" target="_blank">the Shared Game Timer</a> in a different tab, open the game you wish to control and click the extension icon on that tab to connect the two.</p><p>For the full documentation of how to use the Shared Game Timer Overlay, please visit <a href="https://sharedgametimer.com/online-gaming" target="_blank">https://sharedgametimer.com/online-gaming</a></p>`
      );
    }
    return;
  } else {
    if (sgtNotification)
      sgtNotification.parentElement.removeChild(sgtNotification);
  }

  const {
    turnOrder,
    userActions,
    gameStateVersion,
    playerColors,
    tokenTotals,
    bankLogPreview,
    ownUid,
    timestamp,
  } = state;
  if (
    !Array.isArray(turnOrder) ||
    !Array.isArray(userActions) ||
    !Number.isInteger(gameStateVersion) ||
    !playerColors ||
    !tokenTotals ||
    !Array.isArray(bankLogPreview)
  ) {
    console.error("Illegal game state", state);
    return;
  }

  const turnOrderMarkerHeight = 30;
  const turnOrderMarkerGap = 3;
  const turnOrderContainerHeight =
    (turnOrderMarkerHeight + turnOrderMarkerGap) * turnOrder.length;

  if (!sgtPlayerOrder) {
    sgtPlayerOrder = document.createElement("div");
    sgtPlayerOrder.id = "sgt-player-order";
    sgtPlayerOrder.style.height = `${turnOrderContainerHeight}px`;
    sgtPlayerOrder.style.top = `calc(50vh - ${turnOrderContainerHeight / 2}px)`;

    // Add as many sgt-player elements as we have players.
    // We assue the number of players never change.
    turnOrder.forEach((p) => {
      const {uid, color} = p;
      const player = document.createElement("div");
      player.classList.add("sgt-player");
      player.dataset.uid = uid;
      sgtPlayerOrder.appendChild(player);
    });
    addTopLevelElement(sgtPlayerOrder);
  }

  if (!sgtActions) {
    sgtActions = document.createElement("div");
    sgtActions.id = "sgt-actions";
    sgtActions.dataset.uid = ownUid;
    addTopLevelElement(sgtActions);
  }

  // Important: Only update the content of the ations container if we have
  // any actions. That means that we leave old actions in place if we go
  // from having actions to not having actions. Why? So that the actions
  // containers doesn't change while it is being slid out of view.
  // We don't want suddenly disappearing buttons now do we?
  // We ALWAYS update the 'have-actions' class so that it can trigger
  // the slide in/out of the actions tray.
  const hasActions = userActions.length > 0;
  const hadActions = sgtActions.classList.contains("sgt-has-actions");
  const actionsUnchanged =
    userActions.length === sgtActions.childElementCount &&
    userActions.every((action) => {
      const selector = `#sgt-actions .sgt-action[data-action='${action}']`;
      return document.querySelector(selector) instanceof HTMLElement;
    });

  if (!hadActions && hasActions) {
    // Add the buttons immediately and trigger the reveal.
    addButtons(userActions, gameStateVersion, sgtActions);
    sgtActions.classList.toggle("sgt-has-actions", hasActions);
  } else if (hadActions && !hasActions) {
    // Leave the buttons as-is and trigger the hide.
    // The old buttons will be visible as they slide out.
    sgtActions.classList.toggle("sgt-has-actions", hasActions);
  } else if (hadActions && !actionsUnchanged) {
    // We need to change the buttons. So, first hide the old buttons.
    sgtActions.classList.toggle("sgt-has-actions", false);
    // Wait for the duration of the CSS animation, then add the buttons and trigger reveal.
    window.setTimeout(() => {
      addButtons(userActions, gameStateVersion, sgtActions);
      sgtActions.classList.toggle("sgt-has-actions", true);
    }, 1000);
  } else if (hadActions && actionsUnchanged) {
    // Update the state version number...
    document
      .querySelectorAll("#sgt-actions .sgt-action")
      .forEach((el) => (el.dataset.gameStateVersion = gameStateVersion));
  }

  turnOrder.forEach((p, index) => {
    const {uid, passed, isCurrent} = p;
    const player = sgtPlayerOrder.querySelector(`[data-uid='${uid}']`);
    const playerHeight = Number(
      /\d+/.exec(window.getComputedStyle(player).height)[0]
    );

    if (player instanceof HTMLElement) {
      player.style.top = `${index * (playerHeight + 3)}px`;
      player.classList.toggle("sgt-active", isCurrent);
      player.classList.toggle("sgt-has-passed", passed);
    }
  });

  const updatePlayerTimes = () => {
    const currentPlayer = turnOrder.find(p => p.isCurrent);
    const addedTime = currentPlayer ? Math.max(0, Date.now() - timestamp) : 0;
    const playTime =
      turnOrder.reduce((p, n) => p + n.timeTotalExceptCurrentTurn, 0) +
      addedTime;
    turnOrder.forEach((p) => {
      const {uid, isCurrent, timeTotalExceptCurrentTurn} = p;
      const player = sgtPlayerOrder.querySelector(`[data-uid='${uid}']`);
      const playerTime = isCurrent
        ? timeTotalExceptCurrentTurn + addedTime
        : timeTotalExceptCurrentTurn;
      const timePerc =
        playTime > 0 ? Math.round((100 * playerTime) / playTime) : "-";
      if (player instanceof HTMLElement) {
        player.innerText = timePerc;
      }
    });
  };

  if (timeTotalUpdateInterval) {
    window.clearInterval(timeTotalUpdateInterval);
  }
  updatePlayerTimes();
  timeTotalUpdateInterval = window.setInterval(updatePlayerTimes, 10000);

  /** Bank, one-time-setup */
  let tokens = Object.keys(tokenTotals[ownUid]);
  if (tokens.length === 0) {
    // Do nothing!
  } else if (!sgtBank) {
    sgtBank = document.createElement("div");
    sgtBank.id = "sgt-bank";
    addTopLevelElement(sgtBank);

    const totalsVer = document.createElement("table");
    totalsVer.id = "sgt-bank-totals";
    sgtBank.appendChild(totalsVer);

    const actions = document.createElement("div");
    actions.id = "sgt-bank-actions";
    actions.dataset.uid = ownUid;
    sgtBank.appendChild(actions);

    const log = document.createElement("div");
    log.id = "sgt-bank-log";
    sgtBank.appendChild(log);

    const playerIdsOwnPlayerFirst = Object.keys(tokenTotals);
    if (playerIdsOwnPlayerFirst.includes(ownUid)) {
      playerIdsOwnPlayerFirst.splice(
        playerIdsOwnPlayerFirst.indexOf(ownUid),
        1
      );
      playerIdsOwnPlayerFirst.unshift(ownUid);
    }

    {
      // Grows Vertical
      const totalsBody = totalsVer.createTBody();
      const tokenRow = totalsBody.insertRow();
      tokenRow.classList.add("sgt-token");
      tokens.forEach((token) => {
        const cell = tokenRow.insertCell();
        cell.textContent = token;
      });
      playerIdsOwnPlayerFirst.forEach((playerId) => {
        const tokenKeyValueMap = tokenTotals[playerId];
        const row = totalsBody.insertRow();
        row.dataset.uid = playerId;
        if (playerId !== ownUid) row.classList.add("sgt-opponent");
        tokens.forEach((token) => {
          const cell = row.insertCell();
          createAndAttachTokenAmount(cell, token, tokenKeyValueMap[token]);
        });
      });
    }

    const transForm = document.createElement("form");
    transForm.classList.add("sgt-hide");
    transForm.id = "sgt-trans-form";

    {
      const transferShowHideButton = document.createElement("button");
      transferShowHideButton.appendChild(icon_bank);
      transferShowHideButton.id = "sgt-trans-form-showhide";
      transferShowHideButton.addEventListener("click", (ev) => {
        ev.preventDefault();
        const isHidden = transForm.classList.toggle("sgt-hide");
        if (!isHidden) {
          document.getElementById("sgt-trans-form-input-formula").value = "";
          updateTransFormStatus("");
        }
      });
      transForm.appendChild(transferShowHideButton);
    }

    {
      const transferShowHelpButton = document.createElement("button");
      transferShowHelpButton.appendChild(icon_help);
      transferShowHelpButton.id = "sgt-trans-form-help";
      transferShowHelpButton.addEventListener("click", (ev) => {
        ev.preventDefault();
        showNotification(
          `<p>The transaction form accepts simple numbers and formulas. Example: 5 , -9 , 3*6 , 2*(6-2)+8</p>
          <p>Hover over a log entry to see the formula. (omitted for simple numbers)</p>
          <p>Submit the form using the Gain/Lose button, or hit Enter. Shift+Enter also minimizes the form.</p>
          <p>Alt+M (for 💲) and Alt+V (for ⭐) opens the form (if closed) and focuses the input field from anywhere. Alt+L toggles the visibility of the transaction log. All shortcuts can be editied here: <a href="chrome://extensions/shortcuts" target="_blank">chrome://extensions/shortcuts</a></p>
          <p>PS. Formulas must evaluate to whole numbers. Use f(...), c(...) or r(...) to round down (f=floor), up (c=ceiling) or to the nearest (r=round) whole number. E.g. f(5/3) = 1</p>`
        );
      });
      transForm.appendChild(transferShowHelpButton);
    }

    const tokenSelection = document.createElement("div");
    tokenSelection.id = "sgt-trans-form-token-selection";
    transForm.appendChild(tokenSelection);
    tokens.forEach((token, i) => {
      const label = document.createElement("label");
      label.innerText = token;
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "token";
      radio.value = token;
      radio.checked = i === 0;
      label.appendChild(radio);
      tokenSelection.appendChild(label);
    });

    const associateSelection = document.createElement("div");
    associateSelection.id = "sgt-trans-form-associate-selection";
    transForm.appendChild(associateSelection);
    const associateSelect = document.createElement("select");
    associateSelect.id = "sgt-trans-form-associate-select";
    associateSelect.name = "associate";
    associateSelection.appendChild(associateSelect);
    const bankOption = document.createElement("option");
    bankOption.value = "";
    bankOption.textContent = "The Bank";
    associateSelect.options.add(bankOption);
    for (let i = 1; i < playerIdsOwnPlayerFirst.length; i++) {
      console.log(state.playerNames, i, playerIdsOwnPlayerFirst[i]);
      const option = document.createElement("option");
      option.value = playerIdsOwnPlayerFirst[i];
      option.textContent = state.playerNames[playerIdsOwnPlayerFirst[i]];
      associateSelect.options.add(option);
    }
    associateSelect.value = "";

    const formulaInput = document.createElement("input");
    formulaInput.id = "sgt-trans-form-input-formula";
    formulaInput.type = "text";
    formulaInput.name = "formula";
    formulaInput.placeholder = "Amount (try 2*21)";
    wireUpFormulaInput(formulaInput);
    transForm.appendChild(formulaInput);

    const submitButton = document.createElement("button");
    submitButton.id = "sgt-trans-form-submit-button";
    submitButton.type = "submit";
    submitButton.textContent = "Gain / Lose";
    submitButton.disabled = true;
    transForm.appendChild(submitButton);

    const errorMsg = document.createElement("span");
    errorMsg.id = "sgt-trans-form-error";
    transForm.appendChild(errorMsg);

    actions.appendChild(transForm);
    transForm.addEventListener("submit", sgtBankTransFormSubmitHandler);
    transForm.vali;
  } else {
    /** Bank, only on updates */
    Object.entries(tokenTotals).forEach(([playerId, tokenKeyValueMap]) => {
      Object.entries(tokenKeyValueMap).forEach(([token, amount]) => {
        const el = document.querySelector(
          `#sgt-bank-totals tr[data-uid='${playerId}'] .sgt-amount[data-token='${token}']`
        );
        if (el instanceof HTMLElement) {
          el.textContent = amount;
        }
      });
    });
  }

  /** Bank, recurring updates */
  const log = document.getElementById("sgt-bank-log");
  const existingLogEntryTs = [];
  const newEntries = [];
  bankLogPreview
    .slice(-8)
    .forEach(({formula, initiator, associate, token, amount, ts}) => {
      existingLogEntryTs.push(ts);
      const el = document.querySelector(`.sgt-bank-log-entry[data-ts='${ts}']`);
      if (!(el instanceof HTMLElement)) {
        const logEntry = document.createElement("div");
        logEntry.classList.add("sgt-bank-log-entry");
        logEntry.classList.add("sgt-new");
        newEntries.push(logEntry);
        if (associate) logEntry.classList.add("sgt-inter-player");
        logEntry.dataset.ts = ts;
        if (formula) logEntry.title = formula;
        log.prepend(logEntry);

        const initiatorEl = document.createElement("span");
        initiatorEl.dataset.uid = initiator;
        initiatorEl.classList.add("sgt-bank-log-counterpart", "sgt-initiator");
        createAndAttachTokenAmount(initiatorEl, token, amount, true);
        logEntry.appendChild(initiatorEl);
        if (associate) {
          const associateEl = document.createElement("span");
          associateEl.dataset.uid = associate;
          associateEl.classList.add(
            "sgt-bank-log-counterpart",
            "sgt-associate"
          );
          createAndAttachTokenAmount(associateEl, token, -amount, true);
          logEntry.appendChild(associateEl);
        }
      }
    });
  document.querySelectorAll(`.sgt-bank-log-entry`).forEach((el) => {
    if (
      !(el instanceof HTMLElement) ||
      !el.dataset.ts ||
      !existingLogEntryTs.includes(el.dataset.ts)
    ) {
      el.parentElement.removeChild(el);
    }
  });

  {
    const transForm = document.getElementById("sgt-trans-form");
    if (transForm instanceof HTMLFormElement) {
      transForm.classList.toggle(
        "allow-inter-player-transactions",
        state.allowInterPlayerTransactions
      );
      if (!state.allowInterPlayerTransactions) {
        const el = document.getElementById("sgt-trans-form-associate-select");
        if (el instanceof HTMLSelectElement) {
          el.value = "";
        }
      }
    }
  }

  if (newEntries.length > 0) {
    setTimeout(function () {
      newEntries.forEach((el) => el.classList.remove("sgt-new"));
    }, 10);
  }

  /** Set CSS color variables for all elements related to a player */
  const possibleParentsOfColorElements = [
    sgtPlayerOrder,
    sgtActions,
    sgtBank,
  ].filter((el) => el !== null);
  function setCssColors(el) {
    if (el instanceof HTMLElement && el.dataset.uid) {
      playerColors[el.dataset.uid].forEach(([key, val]) => {
        el.style.setProperty(key, val);
      });
    }
  }
  possibleParentsOfColorElements.forEach((el) => {
    setCssColors(el);
    el.querySelectorAll("*[data-uid]").forEach(setCssColors);
  });
}

/** Adds the given element to the DOM. Most of the time, it is added to the body,
 * but if we are on tabletopia, then we add it to the canvas so that it is
 * still visible in full-screen mode.
 *
 * @param {HTMLElement} element
 */
function addTopLevelElement(element) {
  const oldFullscreenButton = document.getElementById("btn-fullscreen");
  element.classList.add("sgt-just-added");
  if (oldFullscreenButton) {
    const fullscreenButton = document.createElement("div");
    fullscreenButton.id = "sgt-btn-fullscreen";
    fullscreenButton.classList.add("btn-fullscreen");
    fullscreenButton.addEventListener("click", function () {
      document.getElementById("canvas").requestFullscreen();
    });
    oldFullscreenButton.replaceWith(fullscreenButton);
  }
  const isOnTabletopia = document.getElementById("sgt-btn-fullscreen");
  if (isOnTabletopia) {
    document.getElementById("canvas").appendChild(element);
  } else {
    document.body.appendChild(element);
  }

  setTimeout(() => element.classList.remove("sgt-just-added"), 20);
}

function addButtons(userActions, gameStateVersion, el) {
  el.innerHTML = "";
  userActions.forEach((action) => {
    const btn = document.createElement("button");
    btn.classList.add("sgt-action");
    btn.dataset.action = action;
    btn.dataset.gameStateVersion = gameStateVersion;
    btn.textContent = action;
    btn.addEventListener("click", (e) => sgtActionButtonHandler(btn));
    el.appendChild(btn);
  });
}

function sgtActionButtonHandler(buttonElement) {
  const {action, gameStateVersion} = buttonElement.dataset;
  console.log("action", action, gameStateVersion);
  // First, disable all the buttons while handling this click.
  const actionButtons = document.getElementsByClassName("sgt-action");
  for (let i = 0; i < actionButtons.length; i++) {
    actionButtons.item(i).disabled = true;
  }
  const payload = {action, gameStateVersion};
  chrome.runtime.sendMessage(
    {type: "user action", payload},
    function (response) {
      if (!checkResponseForError(response)) {
        // Whatever went wrong... We better restore the buttons to active state.
        for (let i = 0; i < actionButtons.length; i++) {
          actionButtons.item(i).disabled = false;
        }
      }
    }
  );
}

function startTransactionFor(token) {
  const form = document.getElementById("sgt-trans-form");
  const radio = document.querySelector(
    `#sgt-trans-form-token-selection input[type='radio'][value='${token}']`
  );
  const formula = document.getElementById("sgt-trans-form-input-formula");
  if (form instanceof HTMLFormElement && formula instanceof HTMLInputElement) {
    form.classList.remove("sgt-hide");
    if (radio instanceof HTMLInputElement) {
      radio.checked = true;
    }
    formula.focus();
  }
}

/**
 * @param {HTMLInputElement} formulaInput
 */
function wireUpFormulaInput(formulaInput) {
  /**
   * This should be attached to the window when the input field is focused.
   * It will then prevent any keystrokes from reaching other parts of the system,
   * like wasd keys for Tabletopia etc.
   * This also means that we have to manually handle input... Yes... This is hacky as hell!
   * @param {KeyboardEvent} ev
   */
  function globalKeyHandler(ev) {
    // Stop the propagation to prevent other scripts from interrupting the input.
    // Tabletopia... I'm looking at you.
    // We may also prevent default if we handle the keystroke ourselves.
    ev.stopImmediatePropagation();
    if (ev.key === "Enter") {
      // Submit the form on enter.
      // The form submit handler has been changed to also handle key events.
      sgtBankTransFormSubmitHandler(null, ev.shiftKey);
      ev.preventDefault();
    } else if (ev.key === "Escape") {
      formulaInput.blur();
      ev.preventDefault();
    } else if (ev.key.match(/^[=rdu( )0-9+*/-]$/i)) {
      // If it is one of the allowed keys, enter it into the value of the form
      // then send a message to the SW (via input handler) to check the value.
      // Note 1) We've reassigned = to mean +, to avoid having to use the SHIFT key
      // Note 2) We have to manually handle selection ranges. Yes. Hacky.
      const start = formulaInput.selectionStart;
      const key = ev.key === "=" ? "+" : ev.key.toLowerCase();
      formulaInput.value =
        formulaInput.value.substring(0, formulaInput.selectionStart) +
        key +
        formulaInput.value.substring(formulaInput.selectionEnd);
      formulaInput.setSelectionRange(start + 1, start + 1);
      sgtBankTransFormFormulaInputHandler(ev);
      ev.preventDefault();
    } else {
      // Do nothing. Not even prevent default.
      // Some keys (e.g. left arrow, Ctrl+a etc) are not intercepted by tabletopia,
      // and we don't want to prevent e.g. navigation back and forth in the text field.
    }
  }
  function stopPropagation(ev) {
    ev.stopImmediatePropagation();
  }
  // The input event is often blocked by either us or tabletopia. But some input events come through
  // for e.g. Backspace key strokes, and then we do want to cause a refresh of the formula output.
  formulaInput.addEventListener(
    "input",
    sgtBankTransFormFormulaInputHandler,
    true
  );
  // When we focus, we stop the propagation of all key strokes so that we are the top dog,
  // capturing all inputs. That also means that we have to undo this when we blur the field
  // to restore the keys working.
  formulaInput.addEventListener(
    "focus",
    (ev) => {
      window.addEventListener("keydown", globalKeyHandler, true);
      window.addEventListener("keyup", stopPropagation, true);
      window.addEventListener("keypress", stopPropagation, true);
    },
    {capture: true}
  );
  formulaInput.addEventListener(
    "blur",
    (ev) => {
      window.removeEventListener("keydown", globalKeyHandler, true);
      window.removeEventListener("keyup", stopPropagation, true);
      window.removeEventListener("keypress", stopPropagation, true);
    },
    {capture: true}
  );
}

function sgtBankTransFormSubmitHandler(submitEvent, closeForm) {
  if (submitEvent) submitEvent.preventDefault();

  const form = document.getElementById("sgt-trans-form");
  if (form instanceof HTMLFormElement) {
    var formData = new FormData(form);
    const token = formData.get("token");
    const formula = formData.get("formula");
    const associate = formData.get("associate");
    const payload = {token, formula, associate};
    chrome.runtime.sendMessage(
      {type: "create transaction", payload},
      function (response) {
        if (response.error) {
          updateTransFormStatus(false, response.error);
        } else {
          document.getElementById("sgt-trans-form-input-formula").value = "";
          updateTransFormStatus("");
          if (closeForm) {
            form.classList.add("sgt-hide");
          }
        }
      }
    );
  }
}

function sgtBankTransFormFormulaInputHandler(inputEvent) {
  const target = inputEvent.target;
  const button = document.getElementById("sgt-trans-form-submit-button");
  if (
    target instanceof HTMLInputElement &&
    button instanceof HTMLButtonElement
  ) {
    const formula = target.value || target.value.trim();
    if (formula.match(/^[+-]?$/)) {
      updateTransFormStatus("");
      return;
    }
    if (formula.match(/[+-/*]$/)) {
      // Do nothing...
      return;
    }
    const formulaNr = Number(formula);
    if (!Number.isNaN(formulaNr)) {
      updateTransFormStatus(formulaNr);
      return;
    }

    const payload = {formula};
    chrome.runtime.sendMessage(
      {type: "check formula", payload},
      function (response) {
        if (response.error) {
          updateTransFormStatus(false, response.error);
        } else {
          updateTransFormStatus(Number(response));
        }
      }
    );
  }
}

function updateTransFormStatus(amountOrFalse, errorText) {
  const button = document.getElementById("sgt-trans-form-submit-button");
  const hint = document.getElementById("sgt-trans-form-error");
  if (typeof amountOrFalse === "string" && amountOrFalse.trim() === "") {
    button.disabled = true;
    button.textContent = "Gain / Lose";
    hint.textContent = "";
    hint.title = "";
    hint.classList.remove("in-error");
    return;
  }

  if (typeof amountOrFalse === "number") {
    if (Number.isNaN(amountOrFalse)) {
      hint.textContent = "Bad formula. Hover to see why.";
      hint.title = errorText;
    } else if (Number.isFinite(amountOrFalse)) {
      const gainOrLose = amountOrFalse >= 0 ? "Gain " : "Lose ";
      button.textContent = gainOrLose + amountOrFalse;
      hint.title = "";
      if (Number.isInteger(amountOrFalse)) {
        button.disabled = false;
        hint.textContent = "";
        hint.classList.remove("in-error");
        return;
      } else {
        hint.textContent = "Make whole by r(..), u(..) or d(..)";
      }
    } else {
      hint.textContent = "Result is infinite!";
      hint.title = "";
    }
  } else {
    hint.textContent = "Bad formula. Hover to see why.";
    hint.title = errorText;
  }
  button.disabled = true;
  hint.classList.add("in-error");
}

function checkResponseForError(response) {
  let error;
  if (response && response.error) {
    error = response.error;
  } else if (!response && chrome.runtime.lastError) {
    error = chrome.runtime.lastError;
  }
  if (!error) return true;

  console.error(error);

  if (typeof error === "string") {
    alert(error);
  } else if (typeof error.message === "string") {
    alert(error.message);
  } else {
    alert("something went wrong. check the log");
  }
  return false;
}

function htmlToElement(html) {
  var template = document.createElement("template");
  html = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = html;
  return template.content.firstChild;
}

function removeElementById(id) {
  let el = document.getElementById(id);
  if (el) el.parentElement.removeChild(el);
}

function createAndAttachTokenAmount(parentEl, token, amount, forcePlusSign) {
  const el = document.createElement("div");
  el.classList.add("sgt-token-amount");
  parentEl.appendChild(el);

  const amountEl = document.createElement("span");
  amountEl.classList.add("sgt-amount");
  amountEl.dataset.token = token;
  amountEl.dataset.amount = amount;
  amountEl.textContent =
    (amount < 0 ? "−" : forcePlusSign ? "+" : "") + Math.abs(amount);
  el.appendChild(amountEl);

  const tokenEl = document.createElement("span");
  tokenEl.classList.add("sgt-token");
  tokenEl.dataset.token = token;
  tokenEl.textContent = token;
  el.appendChild(tokenEl);
}

function showNotification(content) {
  let sgtNotification = document.getElementById("sgt-notification");
  if (!sgtNotification) {
    sgtNotification = document.createElement("div");
    sgtNotification.id = "sgt-notification";
    addTopLevelElement(sgtNotification);
  }
  sgtNotification.innerHTML = `<div class="sgt-message">${content}</div><button id="sgt-notification-close-btn">Close</button>"`;
  document
    .getElementById("sgt-notification-close-btn")
    .addEventListener("click", (e) => {
      sgtNotification.parentElement.removeChild(sgtNotification);
    });
}

const icon_bank = htmlToElement(
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M11.5,1L2,6V8H21V6M16,10V17H19V10M2,22H21V19H2M10,10V17H13V10M4,10V17H7V10H4Z" /></svg>`
);

const icon_help = htmlToElement(
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M10,19H13V22H10V19M12,2C17.35,2.22 19.68,7.62 16.5,11.67C15.67,12.67 14.33,13.33 13.67,14.17C13,15 13,16 13,17H10C10,15.33 10,13.92 10.67,12.92C11.33,11.92 12.67,11.33 13.5,10.67C15.92,8.43 15.32,5.26 12,5A3,3 0 0,0 9,8H6A6,6 0 0,1 12,2Z" /></svg>`
);
