let header = document.querySelector('#intro');
let anim = [
    { t: "{ }", ms: 400 },
    { t: "{_}", ms: 400 },
    { t: "{ }", ms: 400 },
    { t: "{_}", ms: 400 },
    { t: "{C_}", ms: 200 },
    { t: "{Cl_}", ms: 200 },
    { t: "{Cli_}", ms: 200 },
    { t: "{Clic_}", ms: 200 },
    { t: "{Click_}", ms: 200 },
    { t: "{ClickS_}", ms: 200 },
    { t: "{ClickSh_}", ms: 200 },
    { t: "{ClickSha_}", ms: 200 },
    { t: "{ClickShar_}", ms: 200 },
    { t: "{ClickShare_}", ms: 400 },
    { t: "{ClickShare}", ms: 400 },
    { t: "{ClickShare_ }", ms: 400 },
    { t: "{ClickShare}", ms: 400 },
    { t: "{ClickShare_}", ms: 400 },
    { t: "{ClickShare}", ms: 400 },
    { t: "{ClickShare}", ms: 400 }
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