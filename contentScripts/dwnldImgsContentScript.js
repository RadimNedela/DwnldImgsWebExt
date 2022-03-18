"use strict";

if (!document.__dwnldImgsContentScript) {
  browser.runtime.onMessage.addListener(request => {
    console.log("Message from the background script:");
    console.log(request.command);
    return Promise.resolve({
      response: "Hi from content script",
      imgs: getImgs(),
      pathname: getPathname(),
      models: getModels(),
    });
  });




  function getImgs() {
    var foundImgs = [];
    //foundImgs.push("https://cdni.teacherpics.com/1280/1/200/44793016/44793016_004_0e4b.jpg")
    var links = $("a.ss-image");
    links.each((index, element) => {
      //   var a = $(element).find("a");
      //   if (a.length > 0) {
      //     var firstA = a[0];
      var href = element.href;
      //     if (href.includes(".zip?st=")) {
      foundImgs.push(href);
      //     }
      //   }
    });
    return foundImgs;
  }

  function getPathname() {
    var pathname = window.location.pathname;
    //directory = directory.substr(directory.lastIndexOf("/") + 1);
    return pathname;
  }

  function getModels() {
    var models = "";
    var persons = $(".person");
    models = persons.text();
    console.log("found models " + models);
    return models;
  }



  document.__dwnldImgsContentScript = true;
}