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
const logCountLenght = 800;

function getImagePages() {
    var newOpenedTabId;

    function logImagePages(msg) {
        console.error(`: ${msg}`);
        var elem = document.getElementById("get-image-pages-info-content");
        if (elem) {
            var current = elem.innerHTML;
            if (current.length > logCountLenght)
                current = current.substring(current.length - logCountLenght);
            elem.innerHTML = current + msg + "\n";
        }
    }
    
    function openNewTab() {
        let url = $('#image-pages').val();
        let $replace = $('#replace-number');
        let replace = $replace.val();
        if (url.includes("{0}")) {
            $replace.val(1 + parseInt(replace));
            url = url.replace("{0}", replace);
        }
        let options = {
            url: url,
            active: false,
        };
        return browser.tabs.create(options);
    }
    
    function newTabIsOpen_PushScript(tabInfo) {
        logImagePages("new tab open, pushing script to it");
        newOpenedTabId = tabInfo.id;
        return browser.tabs.executeScript(newOpenedTabId, { file: "myPageNewTabContentScript.js" });
    }
    
    function scriptToNewTabWritten_ExecuteIt(objToExecute) {
        logImagePages("script to tab written, executing ");
        return browser.tabs.sendMessage(newOpenedTabId, objToExecute);
    }
    
    function imagePagesReturned(imagePageInfo) {
        logImagePages("image pages returned with " + imagePageInfo.response);
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
        
        logImagePages("I have now " + imagePages.length + " image pages to handle");
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
    .then(updateImagePagesHtml)
    .catch((message) => {
        logImagePages("ERROR " + message);
        if (newOpenedTabId)
            browser.tabs.remove(newOpenedTabId);
        newOpenedTabId = undefined;
        getImagePages();
    });
}

function downloadZipInfos() {
    function logZipInfos(msg) {
        console.error(`: ${msg}`);
        var elem = document.getElementById("download-zip-infos-info-content");
        if (elem) {
            var current = elem.innerHTML;
            if (current.length > logCountLenght)
                current = current.substring(current.length - logCountLenght);
            elem.innerHTML = current + msg + "\n";
        }
    }

    function next() {
        if (runDownloadZipInfo) {
            var info = getNextInfoToRun();
            if (info)
                downloadZipInfo(info);
            else
                runDownloadZipInfo = false;
        }
    }

    function getNextInfoToRun() {
        for(let i=0; i<imagePages.length; i++) {
            if (imagePages[i].status == 0 || imagePages[i].status == 3) {
                imagePages[i].status += 1;
                updateInfoInHTML(imagePages[i]);
                return imagePages[i];
            }
        }
        return null;
    }

    function createNewTab(page) {
        logZipInfos("Creating new tab for " + page);
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
            .then(() => downloadZipInfos())
            .catch(msg => downloadZipInfoFailed(msg, info));
    }

    function downloadZipInfoFailed(msg, info) {
        logZipInfos(msg);
        browser.tabs.remove(info.tab.id);
        if (info.status > 2)
            info.status = 8; // error, ignore it
        else
            info.status = 3;
        updateInfoInHTML(info);
        next();
    }
    

    function scriptToTabWritten(msg, info) {
        info.name = msg[0].Name;
        info.info = msg[0].Info;
        info.zips = msg[0].Zips;
        info.status = 2;
        updateInfoInHTML(info);
        logZipInfos("Script to tab written successfully " + info.name + "\n" + info.zips[0]);
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
            logZipInfos("checking file name " + fileName);
            for (let i=0; i<alreadyDownloaded.length; i++) {
                if (fileName == alreadyDownloaded[i]) {
                    info.status = 10;
                    return;
                }
            }
            logZipInfos("file " + fileName +" to be downloaded");
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
    var info;

    function logDownloadZips(msg) {
        console.error(`: ${msg}`);
        var elem = document.getElementById("download-zips-info-content");
        if (elem) {
            var current = elem.innerHTML;
            if (current.length > logCountLenght)
                current = current.substring(current.length - logCountLenght);
            elem.innerHTML = current + msg + "\n";
        }
    }
    
    function next() {
        if (runDownloadZips) {
            info = getNextZipToDownload();
            if (info)
                doTheDownload();
        }
    }
    
    function getNextZipToDownload() {
        logDownloadZips("Trying to find next file to download from " + imagePages.length + " pages");
        for (var i = 0; i<imagePages.length; i++) {
            info = imagePages[i];
            if (info.status == 2) {
                logDownloadZips("next zip to download foud " + info.zips[0]);
                return info;
            }
        }
    }
    
    function doTheDownload() {
        if (info.status == 2) {
            info.status = 10;
            updateInfoInHTML(info);
            var url = info.zips[0];
            if (url) {
                var fileName = info.name;
                if (!fileName) fileName = "Unknown";
                fileName = fileName.replace(".", "_");
                fileName = fileName.replace("|", "_");
                let name = getFileNameFromUrl(url) || "unknown.zip";
                fileName = info.studio + "/" + fileName + "/" + name;
                fileName = fileName.replace(/ /g, "_");
    
                browser.downloads.download({
                    url: url,
                    filename: fileName
                }).then(downloadItemID => {
                    downloadTextFile(fileName);
                    info.status = 11;
                    updateInfoInHTML(info);
                    searchForDownloads(downloadItemID);
                }).catch((message) => {
                    logDownloadZips("ERROR: " + message);
                    info.status = 15;
                    updateInfoInHTML(info);
                    next();
                });
            }
        }
    }
    
    function searchForDownloads(downloadItemID) {
        browser.downloads.search({ id: downloadItemID })
        .then(checkDownloads)
        .catch((message) => {
            logDownloadZips("ERROR: " + message);
            info.status = 16;
            updateInfoInHTML(info);
            next();
        });
    }
    
    function checkDownloads(arrayOfDownloadItems) {
        for (let i=0; i<arrayOfDownloadItems.length; i++) {
            var downloadItem = arrayOfDownloadItems[i];
            logDownloadZips("Checking file " + downloadItem.filename);
            logDownloadZips("file status: --" + downloadItem.state + "--");
            if (downloadItem.state === "complete") {
                arrayOfDownloadItems.splice(i);
                downloadZips();
            }
            if (downloadItem.state === "interrupted") {
                arrayOfDownloadItems.splice(i);
                info.status = 17;
                updateInfoInHTML(info);
                downloadZips();
            }
        }
        if (arrayOfDownloadItems.length > 0){
            setTimeout(() => {
                searchForDownloads(arrayOfDownloadItems[0].id);
            }, 1000);
        }
    }
    
    function downloadTextFile(fileName) {
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
        if (current.length > logCountLenght)
            current = current.substring(current.length - logCountLenght);
        elem.innerHTML = current + msg + "\n";
    }
}

/**
* When the popup loads, inject a content script into the active tab,
* and add a click handler.
*/
log(originalPageTabId);
$('#image-pages').val("https://adultprime.com/studios/photos?q=&website=Clubsweethearts&niche=&year=&type=&sort=&page={0}#focused");
$('#replace-number').val(1);
browser.tabs.query({currentWindow: true})
    .then((tabs) => {for(let i=0; i<tabs.length; i++) log("tab " + tabs[i].id);})
listenForClicks();

