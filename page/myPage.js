"use strict";

const delay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));

const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
  });

var originalPageTabId = params.activeTabId;

$('#top-h1').text("Moje stránka, originál byl " + originalPageTabId);

function listenForClicks() {
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("get-image-pages")) {
            getImagePages();
        }
        if (e.target.classList.contains("download-zip-infos")) {
            runDownloadZipInfo = !runDownloadZipInfo;
            if (runDownloadZipInfo) downloadZipInfos();
        }
        if (e.target.classList.contains("download-zips")) {
            runDownloadZips = !runDownloadZips;
            downloadZips();
        }
    });
}

var runDownloadZipInfo = false;
var runDownloadZips = false;
var imagePages = [];
// {status: int, url: string, htmlTable: {rowId: string}


function getImagePages() {
    var newOpenedTabId;

    function openNewTab() {
        let url = $('#image-pages').val();
        let options = {
            url: url,
            active: false,
        };
        return browser.tabs.create(options);
    }
    
    function newTabIsOpen_PushScript(tabInfo) {
        log("new tab open, pushing script to it");
        newOpenedTabId = tabInfo.id;
        return browser.tabs.executeScript(newOpenedTabId, { file: "myPageNewTabContentScript.js" });
    }
    
    function scriptToNewTabWritten_ExecuteIt(objToExecute) {
        log("script to tab written, executing ");
        return browser.tabs.sendMessage(newOpenedTabId, objToExecute);
    }
    
    function imagePagesReturned(imagePageInfo) {
        log("image pages returned with " + imagePageInfo.response);
        for(let i=0; i<imagePageInfo.imagePages.length; i++) {
            let element = imagePageInfo.imagePages[i];
            let alreadyExisting = false;
            for(let j=0; j<imagePages.length; j++) {
                if (imagePages[j].url === element) {
                    alreadyExisting = true;
                    break;
                }
            }
            if (alreadyExisting) break;
            let studio = element.substring(element.lastIndexOf("site=") + 5);

            imagePages.push({status: 0, url: element, studio: studio});
        }
        
        log("I have now " + imagePages.length + " image pages to handle");
        let idToRemove = newOpenedTabId;
        newOpenedTabId = undefined;
        return browser.tabs.remove(idToRemove);
    }

    function updateImagePagesHtml() {
        var body = $("#image-pages-table-body");
        for (let i=0; i<imagePages.length; i++) {
            let element = imagePages[i];
    
            if (typeof(element.htmlTable) !== "object") {
                let htmlTable = {
                    rowId: "imagePageHtmlRowId" + i,
                    columnIds: "imagePageHtmlRow" + i + "Column",
                };
                element.htmlTable = htmlTable;
    
                let tr = $('<tr id="' + htmlTable.rowId + '"></tr>');
                for (let k=0; k<6; k++) {
                    let td = $('<td id="' + htmlTable.columnIds + k + '"></td>');
                    tr.append(td);
                }
                body.append(tr);
                updateInfoInHTML(element);
            }
        };
    }
    
    openNewTab()
    .then(newTabIsOpen_PushScript)
    .then(() => scriptToNewTabWritten_ExecuteIt({ command: "getImagePages" }))
    .then(imagePagesReturned)
    .then(updateImagePagesHtml);
}

function downloadZipInfos() {
    var downloadZipInfosRunning = 0;

    function next() {
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
        for(let i=0; i<imagePages.length; i++) {
            if (imagePages[i].status == 0) {
                downloadZipInfosRunning++;
                imagePages[i].status = 1;
                updateInfoInHTML(imagePages[i]);
                return imagePages[i];
            }
        }
        return null;
    }

    function createNewTab(page) {
        log("Creating new tab for " + page);
        return browser.tabs.create({
            url: page,
            active: false,
        });
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
        log(msg);
        browser.tabs.remove(info.tab.id)
        .then(() => info.status = 0);
        updateInfoInHTML(info);
    }
    

    function scriptToTabWritten(msg, info) {
        info.name = msg[0].Name;
        info.info = msg[0].Info;
        info.zips = msg[0].Zips;
        info.status = 2;
        updateInfoInHTML(info);
        log("Script to tab written successfully " + info.name + "\n" + info.zips[0]);
        checkAlreadyDownloadedFiles(info);
        updateInfoInHTML(info);
        return browser.tabs.remove(info.tab.id);
    }

    function checkAlreadyDownloadedFiles(info) {
        var url = info.zips[0];
        if (url) {
            var fileName = getFileNameFromUrl(url);
            fileName = fileName.replace(".zip", "");
            info.fileName = fileName;
            log("checking file name " + fileName);
            for (let i=0; i<alreadyDownloaded.length; i++) {
                if (fileName == alreadyDownloaded[i]) {
                    info.status = 10;
                    return;
                }
            }
            log("file " + fileName +" to be downloaded");
        }
    }    

    function getPageInfoAndZipFilesFromTab(info) {
        return browser.tabs.executeScript(info.tab.id, 
            {
            code: "getPageInfoAndZipFiles();"
        });
    }

    next();
}

function downloadZips() {
    function next() {
        if (runDownloadZips) {
            var info = getNextZipToDownload();
            if (info)
                doTheDownload(info);
        }
    }
    
    function getNextZipToDownload() {
        log("Trying to find next file to download from " + imagePages.length + " pages");
        for (var i = 0; i<imagePages.length; i++) {
            var info = imagePages[i];
            if (info.status == 2) {
                log("next zip to download foud " + info.zips[0]);
                return info;
            }
        }
    }
    
    function doTheDownload(info) {
        if (info.status == 2) {
            info.status = 10;
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
                    updateInfoInHTML(info);
                    searchForDownloads(downloadItemID);
                });
            }
        }
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
    
    next();
}

function updateInfoInHTML(info) {
    $("#" + info.htmlTable.columnIds + 0).text(info.url);
    $("#" + info.htmlTable.columnIds + 1).text(info.status);
    $("#" + info.htmlTable.columnIds + 2).text(info.name);
    $("#" + info.htmlTable.columnIds + 3).text(info.studio);
    if (info.info)
        $("#" + info.htmlTable.columnIds + 4).text(info.info.substring(0, 10));
    $("#" + info.htmlTable.columnIds + 5).text(info.fileName);
    if (info.zips)
        $("#" + info.htmlTable.columnIds + 6).text(info.zips[0]);
}

function getFileNameFromUrl(url) {
    // https://cdncontent.imctransfer.com/content_01/126000/126072/126072.zip?expires=1672784363&token=b4da86c538b34ed3d7bc82f5d3d043be
    const regex1 = RegExp('[^/]*.zip', 'g');
    let array1 = regex1.exec(url);
    let name = array1[0];
    return name;
}    

function error(message) {
    log("ERROR " + message);
}

function log(msg) {
    console.error(`: ${msg}`);
    var elem = document.getElementById("info-content");
    if (elem) {
        var current = elem.innerHTML;
        if (current.length > 500)
            current = current.substring(current.length - 500);
        elem.innerHTML = current + msg + "\n";
    }
}

/**
* When the popup loads, inject a content script into the active tab,
* and add a click handler.
*/
log(originalPageTabId);
$('#image-pages').val("https://adultprime.com/studios/photos?q=&website=Youngbusty&niche=&year=&type=&sort=&page=26#focused");
browser.tabs.query({currentWindow: true})
    .then((tabs) => {for(let i=0; i<tabs.length; i++) log("tab " + tabs[i].id);})
listenForClicks();

