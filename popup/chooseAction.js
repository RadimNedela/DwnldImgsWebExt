"use strict";

//if (!__chooseAction) {
/**
* Listen for clicks on the buttons, and send the appropriate message to
* the content script in the page.
*/
function listenForClicks() {
    document.addEventListener("click", (e) => {

        function getImages(tabs) {
            browser.tabs.sendMessage(tabs[0].id, { command: "getImages" }, downloadFiles)
        }
        function getImagePages(tabs) {
            browser.tabs.sendMessage(tabs[0].id, { command: "getImagePages" }, imagePagesReturned)
        }

        if (e.target.classList.contains("getImages")) {
            browser.tabs.query({ active: true, currentWindow: true }, getImages);
        }
        if (e.target.classList.contains("getImagePages")) {
            browser.tabs.query({ active: true, currentWindow: true }, getImagePages);
        }
    });
}

/**
* When the popup loads, inject a content script into the active tab,
* and add a click handler.
*/
browser.tabs.executeScript({ file: "/libs/jquery-3.6.0.min.js" });
browser.tabs.executeScript({ file: "/contentScripts/dwnldImgsContentScript.js" });
listenForClicks();


function imagePagesReturned(message) {
    log("image pages returned " + message.imagePages.length + ", " + message.imagePages[0]);
    createNewTab(message.imagePages[0]);
}


function createNewTab(page) {
    log("Creating new tab for " + page);
    browser.tabs.create({
        url: page,
        active: false,
    })
        .then(tabCreated,log);
}

function tabCreated(tab) {
    browser.tabs.executeScript(tab.id, 
        {
        //file: "/contentScripts/newTabContentScript.js",
        code: `getPageInfoAndZipFiles();`
    }).then(scriptToTabWritten, log);
}

function scriptToTabWritten(msg) {
    log("Script to tab written successfully " + msg[0].Name  + msg[0].Info + "\n" + msg[0].Zips[0]);
}


function downloadFiles(message) {
    log(message.response);
    var fileList = message.imgs;
    var pathname = message.pathname;
    var models = message.models;

    //  /pics/schoolgirl-madison-breeze-disrobes-to-show-stepdad-tiny-tits-give-handjob-44793016/
    var directory;
    if (models) {
        directory = models.replace(" ", "_");
    } else 
        directory = pathname.substr(6, pathname.length - 1);

    log("directory = " + directory);

    for (let i = 0; i < fileList.length; i++) {
        var fileName = fileList[i];
        fileName = fileName.substr(fileName.lastIndexOf("/") + 1);
        fileName = directory + "/" + fileName;

        log("downloading " + fileList[i] + " as " + fileName);
        browser.downloads.download({
            url: fileList[i],
            filename: fileName
        });
    }
}


var log = function (msg) {
    console.error(`: ${msg}`);
    var elem = document.getElementById("info-content");
    if (elem)
        elem.innerHTML += msg + "\n";
}


__chooseAction = true;
log("loaded");
//}
