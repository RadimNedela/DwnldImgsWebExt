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
            runDownloadZipInfo = !runDownloadZipInfo;
            if (runDownloadZipInfo) downloadZipInfos();
        }
        if (e.target.classList.contains("downloadZips")) {
            runDownloadZips = !runDownloadZips;
            downloadZips();
        }
        if (e.target.classList.contains("openNewTab")) {
            openNewTab();
        }
    });
}

/**
* When the popup loads, inject a content script into the active tab,
* and add a click handler.
*/
//browser.tabs.executeScript({ file: "/libs/jquery-3.6.0.min.js" });
browser.tabs.executeScript({ file: "/contentScripts/dwnldImgsContentScript.js" });
listenForClicks();

const delay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));

var imagePageInfos = [];
// {url, tab, currentStatus, name, info, zips, studio}
var downloadZipInfosRunning = 0;
var runDownloadZipInfo = false;
var runDownloadZips = false;


function imagePagesReturned(message) {
    //log("image pages returned " + message.imagePages.length + ", " + message.imagePages[0]);
    for(let i = 0; i<message.imagePages.length; i++) {
        let url = message.imagePages[i];
        let studio = url.substring(url.lastIndexOf("site=") + 5);

        let info = {
            url: url,
            currentStatus: 0,
            studio: studio
        };
        imagePageInfos.push(info);
    }
}

function downloadZipInfos() {
    if (runDownloadZipInfo) {
        var info = getNextInfoToRun();
        while (info) {
            downloadZipInfo(info);
            info = getNextInfoToRun();
        }
    }
}

function getNextInfoToRun() {
    if (downloadZipInfosRunning > 0) return null;
    for(let i=0; i<imagePageInfos.length; i++) {
        if (imagePageInfos[i].currentStatus == 0) {
            downloadZipInfosRunning++;
            imagePageInfos[i].currentStatus = 1;
            return imagePageInfos[i];
        }
    }
    return null;
}

function downloadZipInfo(info) {
    createNewTab(info.url)
        .then((tab) => {info.tab = tab; return delay(1500); })
        .then(() => getPageInfoAndZipFilesFromTab(info))
        .then((msg) => scriptToTabWritten(msg, info))
        .then(() => {downloadZipInfosRunning--; downloadZipInfos();})
        .catch(msg => downloadZipInfoFailed(msg, info));
}

function downloadZipInfoFailed(msg, info) {
    error(msg);
    browser.tabs.remove(info.tab.id)
    .then(() => info.currentStatus = 0);
}

function downloadZips() {
    if (runDownloadZips) {
        var info = getNextZipToDownload();
        if (info)
            doTheDownload(info);
    }
}

function getNextZipToDownload() {
    log("Trying to find next file to download from " + imagePageInfos.length + " pages");
    for (var i = 0; i<imagePageInfos.length; i++) {
        var info = imagePageInfos[i];
        if (info.currentStatus == 2) {
            log("next zip to download foud " + info.zips[0]);
            return info;
        }
    }
}

function doTheDownload(info) {
    if (info.currentStatus == 2) {
        info.currentStatus = 10;
        var url = info.zips[0];
        if (url) {
            var fileName = info.name;
            if (!fileName) fileName = "Unknown";
            let name = getFileNameFromUrl(url) || "unknown.zip";
            fileName = info.studio + "/" + fileName + "/" + name;
            fileName = fileName.replace(/ /g, "_");

            browser.downloads.download({
                url: url,
                filename: fileName
            }).then(downloadItemID => {
                downloadTextFile(fileName, info);
                searchForDownloads(downloadItemID);
            });
        }
    }
}

function getFileNameFromUrl(url) {
    // https://cdncontent.imctransfer.com/content_01/126000/126072/126072.zip?expires=1672784363&token=b4da86c538b34ed3d7bc82f5d3d043be
    const regex1 = RegExp('[^/]*.zip', 'g');
    let array1 = regex1.exec(url);
    let name = array1[0];
    return name;
}

function searchForDownloads(downloadItemID) {
    browser.downloads.search({ id: downloadItemID })
    .then(checkDownloads, error);
}

function checkDownloads(arrayOfDownloadItems) {
    for (let i=0; i<arrayOfDownloadItems.length; i++) {
        var downloadItem = arrayOfDownloadItems[i];
        log("Checking file " + downloadItem.filename);
        log("file status: --" + downloadItem.state + "--");
        if (downloadItem.state === "complete") {
            arrayOfDownloadItems.splice(i);
            downloadZips();
        }
    }
    if (arrayOfDownloadItems.length > 0){
        setTimeout(() => {
            searchForDownloads(arrayOfDownloadItems[0].id);
        }, 1000);
    }
}

function downloadTextFile(fileName, info) {
    var file = new Blob([info.info], {type: 'plain/text'});
    var a = document.createElement("a"), url = URL.createObjectURL(file);
        a.href = url;
        a.download = fileName.replace(".zip", ".txt").replace(new RegExp("/", "g"), "$");
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
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

function getPageInfoAndZipFilesFromTab(info) {
    return browser.tabs.executeScript(info.tab.id, 
        {
        code: "getPageInfoAndZipFiles();"
    });
}

function scriptToTabWritten(msg, info, tab) {
    info.name = msg[0].Name;
    info.info = msg[0].Info;
    info.zips = msg[0].Zips;
    info.currentStatus = 2;
    log("Script to tab written successfully " + info.name + "\n" + info.zips[0]);
    checkAlreadyDownloadedFiles(info);
    return browser.tabs.remove(info.tab.id);
}

function checkAlreadyDownloadedFiles(info) {
    var url = info.zips[0];
    if (url) {
        var fileName = getFileNameFromUrl(url);
        fileName = fileName.replace(".zip", "");
        log("checking file name " + fileName);
        for (let i=0; i<alreadyDownloaded.length; i++) {
            if (fileName == alreadyDownloaded[i]) {
                info.currentStatus = 10;
                return;
            }
        }
        log("file " + fileName +" to be downloaded");
    }
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
    if (elem) {
        var current = elem.innerHTML;
        if (current.length > 500)
            current = current.substring(current.length - 500);
        elem.innerHTML = current + msg + "\n";
    }
}


function openNewTab() {
    browser.tabs.query({active: true, currentWindow: true})
    .then((activeTabs) => {
        log("jsem tu ");
        let activeTab = activeTabs[0];
        let url = `/page/myPage.html?activeTabId=` + activeTab.id;
        log ("url = " + url);
        let options = {
            url: url,
            // openerTabId: openerTab.id
        };
        return browser.tabs.create(options)
    })
    .then(log)
    .catch(log);
}

browser.runtime.onMessage.addListener(onMessageListener);

function onMessageListener(request) {
    log("Message on the choose action script: ");
    log(request.command);
    if (request.command === "getImagePages") {
        return Promise.resolve({
            response: "přijato, zpracovává se" + request.tabId,
            imagePageInfos: imagePageInfos
        });
    }
}


//__chooseAction = true;
// log("loaded");
//}
const alreadyDownloaded = [
    124940,
    125102,
    125407,
    124938,
    125124,
    124939,
    125408,
    125411,
    125410,
    126072,
    124942,
    125409,
];
