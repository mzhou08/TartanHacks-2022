let header = document.querySelector('#intro');
let anim = [
    { t: "", ms: 400 },
    { t: "_", ms: 400 },
    { t: " ", ms: 400 },
    { t: "_", ms: 400 },
    { t: "C_", ms: 175 },
    { t: "Cl_", ms: 175 },
    { t: "Cli_", ms: 175 },
    { t: "Clic_", ms: 175 },
    { t: "Click_", ms: 175 },
    { t: "ClickS_", ms: 175 },
    { t: "ClickSh_", ms: 175 },
    { t: "ClickSha_", ms: 175 },
    { t: "ClickShar_", ms: 175 },
    { t: "ClickShare_", ms: 175 },
    { t: "ClickShare", ms: 175 },
    { t: "ClickShare_", ms: 175 },
    { t: "ClickShare", ms: 175 },
    { t: "ClickShare_", ms: 175 },
    { t: "ClickShar_", ms: 175 },
    { t: "ClickSha_", ms: 175 },
    { t: "ClickSh_", ms: 175 },
    { t: "ClickS_", ms: 175 },
    { t: "Click_", ms: 175 },
    { t: "Clic_", ms: 175 },
    { t: "Cli_", ms: 175 },
    { t: "Cl_", ms: 175 },
    { t: "C_", ms: 175 },
    { t: "_", ms: 175 },
    { t: "", ms: 175 },
    { t: "_", ms: 175 },
    { t: "", ms: 175 }
];
let stepDenominator = 1;
if (window.localStorage.stepDenominator)
    stepDenominator = window.localStorage.stepDenominator;
let i = 0;
let update = () => {
    let step = anim[i];
    header.innerText = step.t;
    i++;

    if (i < anim.length)
        setTimeout(update, step.ms / stepDenominator);
    else {
        header.classList.add('top');
        setTimeout(() => {
            document.getElementById('main').style.opacity = 1;
        }, 500);
        window.localStorage.stepDenominator = 2;
    }
    
}
update();