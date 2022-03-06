/**
 * CSS to hide everything on the page,
 * except for elements that have the "beastify-image" class.
 */
const hidePage = `body > :not(.beastify-image) {
    display: none;
  }`;

/**
* Listen for clicks on the buttons, and send the appropriate message to
* the content script in the page.
*/
function listenForClicks() {
    document.addEventListener("click", (e) => {

        function getImages(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { command: "getImages" }, downloadFiles)
        }

        /**
        * Just log the error to the console.
        */
        function reportError(error) {
            console.error(`Cosi je špatně: ${error}`);
        }

        if (e.target.classList.contains("getImages")) {
            chrome.tabs.query({ active: true, currentWindow: true }, getImages);
        }
    });
}

/**
* There was an error executing the script.
* Display the popup's error message, and hide the normal UI.
*/
function reportExecuteScriptError(error) {
    document.querySelector("#popup-content").classList.add("hidden");
    document.querySelector("#error-content").classList.remove("hidden");
    console.error(`Failed to execute beastify content script: ${error.message}`);
}



/**
* When the popup loads, inject a content script into the active tab,
* and add a click handler.
* If we couldn't inject the script, handle the error.
*/
chrome.tabs.executeScript({ file: "/libs/jquery-3.5.1.js" });
chrome.tabs.executeScript({ file: "/contentScripts/beastify.js" });
//    .then(chrome.tabs.executeScript({ file: "/libs/jquery-3.5.1.min.js" }))
listenForClicks();





function downloadFiles(message) {
    var fileList = message.zips;
    var directory = message.directory;

    for (let i = 0; i < fileList.length; i++) {
        var fileName = fileList[i];
        var zipIndex = fileName.indexOf(".zip?st=") + 4;
        fileName = fileName.substr(0, zipIndex);
        fileName = fileName.substr(fileName.lastIndexOf("/") + 1);
        fileName = directory + "_" + fileName;

        sendUrlToXDM(fileList[i], fileName);
        // chrome.downloads.download({
        //     url: fileList[i],
        //     filename: fileName
        // });
    }
}



var sendUrlToXDM = function (url, fileName) {
    log("sending to xdm: " + url);
    var data = "url=" + url + "\r\n";
    data += "file=" + fileName + "\r\n";
    data += "res=realUA:" + navigator.userAgent + "\r\n";
    chrome.cookies.getAll({ "url": url }, function (cookies) {
        for (var i = 0; i < cookies.length; i++) {
            var cookie = cookies[i];
            data += "cookie=" + cookie.name + ":" + cookie.value + "\r\n";
        }
        log(data);

        port.postMessage({ "message": "/download" + "\r\n" + data });

        // var xhr = new XMLHttpRequest();
        // xhr.open('POST', xdmHost + "/download", true);
        // xhr.send(data);
    });
};





var requests = [];
var blockedHosts = ["update.microsoft.com", "windowsupdate.com", "thwawte.com"];
var videoUrls = [".facebook.com|pagelet", "player.vimeo.com/", "instagram.com/p/"];
var fileExts = ["3GP", "7Z", "AVI", "BZ2", "DEB", "DOC", "DOCX", "EXE", "GZ", "ISO",
    "MSI", "PDF", "PPT", "PPTX", "RAR", "RPM", "XLS", "XLSX", "SIT", "SITX", "TAR", "JAR", "ZIP", "XZ"];
var vidExts = ["MP4", "M3U8", "F4M", "WEBM", "OGG", "MP3", "AAC", "FLV", "MKV", "DIVX",
    "MOV", "MPG", "MPEG", "OPUS"];
var isXDMUp = true;
var monitoring = true;
var debug = false;
var xdmHost = "http://127.0.0.1:9614";
var disabled = false;
var lastIcon;
var lastPopup;
var videoList = [];
var mimeList = [];

var log = function (msg) {
    if (debug) {
        try {
            log(msg);
        } catch (e) {
            log(e + "");
        }
    }
}


var initSelf = function () {
    /*
    On startup, connect to the "native" app.
    */
    port = chrome.runtime.connectNative("xdm_chrome.native_host");

    /*
    Listen for messages from the app.
    */
    port.onMessage.addListener((data) => {
        monitoring = data.enabled;
        blockedHosts = data.blockedHosts;
        videoUrls = data.videoUrls;
        fileExts = data.fileExts;
        vidExts = data.vidExts;
        isXDMUp = true;
        videoList = data.vidList;
        if (data.mimeList) {
            mimeList = data.mimeList;
        }
        //    updateBrowserAction();

        log("Received: " + data);
    });

    /*
    On start up send the app a message.
    */
    log("Sending to native...")
    port.postMessage({ "message": "hello from extension" });
};

initSelf();
log("loaded");
chrome.downloads.setShelfEnabled(false);
