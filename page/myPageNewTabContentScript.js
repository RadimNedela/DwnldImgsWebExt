"use strict";

if (!document.__dwnldImgsContentScript) {
  browser.runtime.onMessage.addListener(request => {
    console.log("Message from the background script:");
    console.log(request.command);
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


  document.__dwnldImgsContentScript = true;
}