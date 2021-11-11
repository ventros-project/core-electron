//////// Imports ////////////////////////////////////////////////////////////////
const fs = require("fs");
const path = require("path");
const { protocol, session } = require("electron");
////////////////////////////////////////////////////////////////////////////////

//////// Type Definitions //////////////////////////////////////////////////////
/**
 * @typedef {import('electron').ProtocolRequest} ProtocolRequest
 */

/**
 * @callback ServerCallback
 * @param {string|import('electron').ProtocolResponse} response
 * @returns {void}
 */
////////////////////////////////////////////////////////////////////////////////

//////// Global variables //////////////////////////////////////////////////////
/** @type {string} */
let dirName = "";

/** @type {string} */
let homePath = "";

/** @type {Map<string,number>} */
let serviceList;
////////////////////////////////////////////////////////////////////////////////

//////// Library Interface /////////////////////////////////////////////////////
/**
 * @param {string} _dirName
 * @param {string} _homePath
 * @param {Map<string,number>} serviceMap
 * @returns {(request: ProtocolRequest, callback: ServerCallback) => void}
 */
module.exports = (_dirName, _homePath, serviceMap) => {
  dirName = _dirName;
  homePath = _homePath;
  serviceList = serviceMap;

  protocol.registerFileProtocol("ventros", executeURL);
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["ventros://*.service/*"] },
    interceptForServices
  );
};
////////////////////////////////////////////////////////////////////////////////

protocol.registerSchemesAsPrivileged([
  {
    scheme: "ventros",
    privileges: {
      standard: true,
      supportFetchAPI: true,
      stream: true,
      allowServiceWorkers: true,
      bypassCSP: true,
    },
  },
]);

/**
 * @param {ProtocolRequest} request
 * @param {ServerCallback} callback
 */
function executeURL(request, callback) {
  const urlSegments = request.url
    .replace(/^ventros\:\/\//, "")
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .split("/");

  const hostname = urlSegments.shift();
  if (hostname == "launcher") {
    runLauncher(urlSegments, callback);
  } else if (hostname.endsWith(".app")) {
    runApp(hostname, urlSegments, callback);
  } else if (hostname.endsWith(".service")) {
    const filePath = path.join(dirName, "pages", "service_not_exist.json");
    callback({
      path: filePath,
      mimeType: "application/json",
      statusCode: 404,
    });
  } else {
    showNotFound(urlSegments, callback);
  }
}

/**
 * @param {Electron.OnBeforeRequestListenerDetails} details
 * @param {(response: Electron.Response) => void} callback
 */
function interceptForServices(details, callback) {
  const urlSegments = details.url
    .replace(/^ventros\:\/\//, "")
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .split("/");

  const hostname = urlSegments.shift();
  if (hostname.endsWith(".service")) {
    const serviceName = hostname.replace(/\.service$/i, "");
    const portNumber = serviceList.get(serviceName);

    if (portNumber) {
      const urlPath = urlSegments.join("/");
      callback({
        redirectURL: `http://localhost:${portNumber}/${urlPath}`,
        cancel: false,
      });
    } else {
      callback({ cancel: false });
    }
  }

  // If service not exist, executeURL will handle it
}

/**
 * @param {string[]} urlSegments
 * @param {ServerCallback} callback
 */
function runLauncher(urlSegments, callback) {
  let filePath = path.join(homePath, "launcher", ...urlSegments);

  try {
    // It's directory? look for index.html
    if (fs.lstatSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch (_) {
    // Not exist? let SPA handle "404 Not Found"
    filePath = path.join(homePath, "launcher", "index.html");
    callback(filePath);
    return;
  }

  callback(filePath);
}

/**
 * @param {string} hostname
 * @param {string[]} urlSegments
 * @param {ServerCallback} callback
 */
function runApp(hostname, urlSegments, callback) {
  const appName = hostname.replace(/\.app$/i, "");
  let filePath = path.join(homePath, "apps", appName, ...urlSegments);

  try {
    // It's directory? look for index.html
    if (fs.lstatSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch (_) {
    // Not exist? let SPA handle "404 Not Found"
    filePath = path.join(homePath, "apps", appName, "index.html");
    if (fs.existsSync(filePath)) {
      callback(filePath);
    } else {
      // Or the app is really not exist? Show default "not found"
      showNotFound(urlSegments, callback);
    }
    return;
  }

  callback(filePath);
}

/**
 * @param {string[]} urlSegments
 * @param {ServerCallback} callback
 */
function showNotFound(urlSegments, callback) {
  let filePath = path.join(dirName, "pages", "not_found", ...urlSegments);

  try {
    // It's directory? look for index.html
    if (fs.lstatSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch (_) {
    // Not exist? let SPA handle "404 Not Found"
    filePath = path.join(dirName, "pages", "not_found", "index.html");
    callback(filePath);
    return;
  }

  callback(filePath);
}
