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
        // if (e.target.classList.contains("downloadZips")) {
        //     runDownloadZips = !runDownloadZips;
        //     downloadZips();
        // }
        // if (e.target.classList.contains("openNewTab")) {
        //     openNewTab();
        // }
    });
}

var runDownloadZipInfo = false;
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
            imagePages.push({status: 0, url: element});
        }
        
        log("I have now " + imagePages.length + " image pages to handle");
        let idToRemove = newOpenedTabId;
        newOpenedTabId = undefined;
        return browser.tabs.remove(idToRemove);
    }

    openNewTab()
    .then(newTabIsOpen_PushScript)
    .then(() => scriptToNewTabWritten_ExecuteIt({ command: "getImagePages" }))
    .then(imagePagesReturned)
    .then(updateImagePagesHtml);
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

function updateInfoInHTML(info) {
    $("#" + info.htmlTable.columnIds + 0).text(info.url);
    $("#" + info.htmlTable.columnIds + 1).text(info.status);
    $("#" + info.htmlTable.columnIds + 2).text(info.name);
    if (info.info)
        $("#" + info.htmlTable.columnIds + 3).text(info.info.substring(0, 10));
    $("#" + info.htmlTable.columnIds + 4).text(info.fileName);
    if (info.zips)
        $("#" + info.htmlTable.columnIds + 5).text(info.zips[0]);
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

    function getFileNameFromUrl(url) {
        // https://cdncontent.imctransfer.com/content_01/126000/126072/126072.zip?expires=1672784363&token=b4da86c538b34ed3d7bc82f5d3d043be
        const regex1 = RegExp('[^/]*.zip', 'g');
        let array1 = regex1.exec(url);
        let name = array1[0];
        return name;
    }    
    

    next();
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
$('#image-pages').val("https://adultprime.com/studios/photos?website=Youngbusty");
browser.tabs.query({currentWindow: true})
    .then((tabs) => {for(let i=0; i<tabs.length; i++) log("tab " + tabs[i].id);})
listenForClicks();

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
