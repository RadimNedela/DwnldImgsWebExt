"use strict";

if (!document.__dwnldImgsContentScript) {
  browser.runtime.onMessage.addListener(request => {
    console.log("Message from the background script:");
    console.log(request.command);
    if (request.command === "getImages")
      return Promise.resolve({
        response: "getImagesReturn",
        imgs: getImgs(),
        pathname: getPathname(),
        models: getModels(),
      });
    
    if (request.command === "getImagePages")
      return Promise.resolve({
        response: "getImagePagesReturn",
        imagePages: getImagePages(),
      });
  });

  function getImagePages() {
    var foundImagePages = [];

    var links = $("a");
    links.each((index, element) => {
      var href = element.href;
      if (href.includes("/photo/")) {
        foundImagePages.push(href);
      }
    });
    console.log(foundImagePages);
    return foundImagePages;
  }


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