"use strict";

browser.runtime.onMessage.addListener(request => {
    console.log("Message from the background script:");
    console.log(request.command);
    return Promise.resolve({response: "Hi from content script"});
  });