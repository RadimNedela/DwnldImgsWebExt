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
        if (e.target.classList.contains("downloadZipInfos")) {
            downloadZipInfos();
        }
        if (e.target.classList.contains("downloadZips")) {
            downloadZips();
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

const delay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));

var imagePageInfos = [];
// {url, tab, currentStatus, name, info, zips}

function imagePagesReturned(message) {
    log("image pages returned " + message.imagePages.length + ", " + message.imagePages[0]);
    for(let i = 0; i<message.imagePages.length; i++) {
        let info = {
            url: message.imagePages[i],
            currentStatus: 0
        };
        imagePageInfos.push(info);
    }
}

function downloadZipInfos() {
    if (imagePageInfos.length > 0) {
        let i=0;
        if (imagePageInfos[i].currentStatus == 0) {
            createNewTab(imagePageInfos[i].url)
                .then((tab) => {imagePageInfos[i].tab = tab; return delay(500); })
                .then(() => getPageInfoAndZipFilesFromTab(i))
                .then((msg) => scriptToTabWritten(msg, i))
                .then()
                .catch(error);
        }
    }
}

function downloadZips() {

}

function error(message) {
    log("ERROR " + message);
}

function createNewTab(page) {
    log("Creating new tab for " + page);
    return browser.tabs.create({
        url: page,
        active: false,
    });
}

function getPageInfoAndZipFilesFromTab(index) {
    return browser.tabs.executeScript(imagePageInfos[index].tab.id, 
        {
        code: "getPageInfoAndZipFiles();"
    });
}

function scriptToTabWritten(msg, index, tab) {
    var info = imagePageInfos[index];
    info.name = msg[0].Name;
    info.info = msg[0].Info;
    info.zips = msg[0].Zips;
    info.currentStatus = 2;
    log("Script to tab written successfully " + info.name + "\n" + info.zips[0]);
    return browser.tabs.remove(info.tab.id);
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
