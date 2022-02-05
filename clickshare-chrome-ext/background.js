let color = '#3aa757';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ color });
  console.log('Default background color set to %cgreen', `color: ${color}`);
});

//ADDED LISTENERS HERE- Michael
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log({ request })
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log("Received message from " + sender + ": ", request);
  sendResponse({ received: true }); //respond however you like
});