// Initialize button with user's preferred color
let confIdSubmit = document.getElementById("confIdSubmit");
let confIdForm = document.getElementById("confIdForm");

// chrome.storage.sync.get("color", ({ color }) => {
//   changeColor.style.backgroundColor = color;
// });

// When the submit button is clicked, use setClickerPos to move the clicker
// confIdForm.submit(function (e) {e.preventDefault();});

confIdSubmit.addEventListener("click", async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    //   chrome.tabs.sendMessage(tabs[0].id, {createDiv: {width: "100px", height: "100px", innerHTML: "Hello"}}, function(response) {
    //     console.log(response.confirmation);
    //   });
    // });

    let conferenceID = document.getElementById("conference-id-input").value;

    console.log(conferenceID);
  
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: setClickerPos,
    });


});

function CreateDiv(){
  console.log("Created");
  var div = document.createElement("div");
  div.style.width = "100px";
  div.style.height = "100px";
  div.innerHTML = "Hello";
  document.body.appendChild(div);
}
  
  // The body of this function will be executed as a content script inside the
  // current page
function setClickerPos() {
    fetch("https://tartan-hacks-2022-default-rtdb.firebaseio.com/4912.json")
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      let clickCoords = [];

      for (const key in data) {
        const coords = {
          id: key,
          ...data[key],
        };

        clickCoords.unshift(coords);
      }
      console.log(clickCoords[0]);


      // const img = document.createElement("img");
      const img = new Image();
      img.src = chrome.runtime.getURL("./click.png");
      Object.assign(img.style, {
          position: 'fixed',
          width: '5vw',
          height: '5vh',
          opacity: 50,
          objectFit: 'cover',
          objectPosition: 'center center',
          pointerEvents: 'none'
      });
      img.style.left = String(clickCoords[0]["x"]) + "px";
      img.style.top = String(clickCoords[0]["y"]) + "px";
      document.body.appendChild(img);
    })

    

}