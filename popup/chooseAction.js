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

        if (e.target.classList.contains("getImages")) {
            browser.tabs.query({ active: true, currentWindow: true }, getImages);
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
}


__chooseAction = true;
log("loaded");
//}
