// Initialize button with user's preferred color
let confIdSubmit = document.getElementById("confIdSubmit");

// chrome.storage.sync.get("color", ({ color }) => {
//   changeColor.style.backgroundColor = color;
// });

// When the submit button is clicked, use setClickerPos to move the clicker

confIdSubmit.addEventListener("click", async () => {
    let [tab] = chrome.tabs.query({ active: true, currentWindow: true });
    // chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    //   chrome.tabs.sendMessage(tabs[0].id, {createDiv: {width: "100px", height: "100px", innerHTML: "Hello"}}, function(response) {
    //     console.log(response.confirmation);
    //   });
    // });

    console.log("hello?");
    let conferenceID = document.getElementById("conference-id-input").value;

    console.log(conferenceID);
  
    // chrome.scripting.executeScript({
    //   target: { tabId: tab.id },
    //   function: setClickerPos,
    // });
});


  
  // The body of this function will be executed as a content script inside the
  // current page
function setClickerPos() {
    fetch("https://tartan-hacks-2022-default-rtdb.firebaseio.com/coords.json")
    .then((response) => {
      return response.json;
    })
    .then((data) => {
      const clickCoords = [];

      for (const key in data) {
        const coords = {
          id: key,
          ...data[key],
        };

        clickCoords.unshift(coords);
      }

      console.log(coords);
    })
}