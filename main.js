//////// Imports ////////////////////////////////////////////////////////////////
const process = require("process");
const fs = require("fs");
const tcpPortUsed = require("tcp-port-used");
const { spawn } = require("child_process");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const gatewayServer = require("./server");
////////////////////////////////////////////////////////////////////////////////

//////// Global variables //////////////////////////////////////////////////////
const homePath = app.commandLine.getSwitchValue("home");

/** @type {Map<string,number>} */
let serviceList = new Map();

/** @type {BrowserWindow} */
let mainWindow;
////////////////////////////////////////////////////////////////////////////////

// Entry point
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      preload: path.join(__dirname, "preload.js"),
    },
    frame: false,
    kiosk: true,
    title: "VentrOS Core System",
  });
  mainWindow.removeMenu();

  // Fix Same-Origin problem
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    { urls: ["*://*/*"] },
    (details, callback) => {
      const frameOptionKey = Object.keys(details.responseHeaders).find(
        (gotKey) => gotKey.toLowerCase() === "x-frame-options"
      );

      if (frameOptionKey) {
        delete details.responseHeaders[frameOptionKey];
      }

      callback({ cancel: false, responseHeaders: details.responseHeaders });
    }
  );

  gatewayServer(homePath, serviceList);
  startServices();

  if (homePath) {
    startLauncher(mainWindow).catch((error) => {
      console.error(error);
      showNotFound();
    });
  } else {
    showNotFound(mainWindow);
  }
});

//////// Global functions //////////////////////////////////////////////////////

/** @param {BrowserWindow} mainWindow */
async function showNotFound(mainWindow) {
  const pagePath = path.join(__dirname, "pages", "welcome", "index.html");
  return await mainWindow.loadFile(pagePath);
}

function startServices() {
  const basePath = path.join(homePath, "services");

  /** @type {string[]} */
  let servicePaths;
  try {
    servicePaths = fs.readdirSync(basePath);
  } catch (_) {
    return;
  }

  servicePaths.forEach(async (eachPath) => {
    const entryPoint = path.join(basePath, eachPath, "main.js");
    if (fs.existsSync(entryPoint)) {
      let portNumber = 0;
      let attempt = 0;

      for (; attempt < 10; attempt++) {
        portNumber = 32768 + Math.floor(Math.random() * 28231);
        const isUsed = await tcpPortUsed.check(portNumber);
        if (!isUsed) break;
      }

      if (attempt < 10) {
        const serviceName = path.basename(eachPath);
        serviceList.set(serviceName, portNumber);
        const serviceProcess = spawn(
          "node",
          ["main.js", portNumber.toString()],
          {
            cwd: path.resolve(path.join(basePath, eachPath)),
          }
        );
        serviceProcess.on("message", (message) => {
          console.log(`[${serviceName}] ${message.toString()}`);
        });
        serviceProcess.on("error", (error) => {
          console.error(`[${serviceName}] ${error}`);
        });
        serviceProcess.on("exit", (code) => {
          serviceList.delete(serviceName);
          console.log(`"${serviceName}" service exited with code ${code}`);
        });
      }
    }
  });
}

/**
 * @param {BrowserWindow} mainWindow
 * @returns {Promise<void>}
 */
async function startLauncher(mainWindow) {
  let isLauncherDirectory = false;
  try {
    // Check if there is "launcher" directory
    isLauncherDirectory = fs
      .lstatSync(path.join(homePath, "launcher"))
      .isDirectory();

    // Check if that directory has index.html
    const filePath = path.join(homePath, "launcher", "index.html");
    isLauncherDirectory = isLauncherDirectory && fs.existsSync(filePath);
  } catch (_) {
    // Intended empty
  }

  if (isLauncherDirectory) {
    return await mainWindow.loadURL("ventros://launcher");
  } else {
    const filePath = path.join(homePath, "index.html");

    // Check if index.html exists
    if (!fs.existsSync(filePath)) {
      return showNotFound(mainWindow);
    }

    return await mainWindow.loadFile(filePath);
  }
}

////////////////////////////////////////////////////////////////////////////////

//////// IPC Listeners /////////////////////////////////////////////////////////

ipcMain.on("system:stop", () => {
  if (app.commandLine.hasSwitch("system")) {
    spawn("sudo", ["shutdown", "now"]);
  } else {
    process.exit(0);
  }
});

ipcMain.on("system:list:app", () => {
  const appBasePath = path.join(homePath, "apps");

  /** @type {string[]} */
  const appList = [];

  fs.readdirSync(appBasePath).forEach((eachAppDir) => {
    const appEntryPoint = path.join(appBasePath, eachAppDir, "index.html");
    if (fs.existsSync(appEntryPoint)) {
      appList.push(`ventros://${eachAppDir}.app`);
    }
  });

  mainWindow.webContents.send("system:list:app", appList);
});

ipcMain.on("system:list:service", () => {
  const serviceBasePath = path.join(homePath, "services");

  /** @type {string[]} */
  const serviceList = [];

  fs.readdirSync(serviceBasePath).forEach((eachService) => {
    const serviceEntryPoint = path.join(
      serviceBasePath,
      eachService,
      "main.js"
    );
    if (fs.existsSync(serviceEntryPoint)) {
      serviceList.push(`ventros://${eachService}.service`);
    }
  });

  mainWindow.webContents.send("system:list:service", serviceList);
});

////////////////////////////////////////////////////////////////////////////////
