"use strict";

function sayHello() {
    $('.ap-logo').text("Say Hello");
}

function getPageInfoAndZipFiles() {
    // <a class="photoset-action-link site-link" href="https://cdncontent.imctransfer.com/content_01/125000/125815/125815.zip?expires=1672592063&amp;token=f89c779cf246606b21924bed6bba9ca2"><i class="fa fa-download fa-2x" style="vertical-align:middle"></i><b> download photo set</b></a>
    var toReturn = {
        Name: getName(),
        Info: getInfo(),
        Zips: findAllZips(),
    };
    return toReturn;
}

function getName() {
    var infoTitle = $(".update-info-title").text();
    return infoTitle;
}

function getInfo() {
    var infoLine = $(".update-info-line").text();
    return infoLine;
}

function findAllZips() {
    var foundZips = [];

    var links = $("a");
    links.each((index, element) => {
      var href = element.href;
      if (href.includes(".zip?expires")) {
        foundZips.push(href);
      }
    });
    return foundZips;
}

