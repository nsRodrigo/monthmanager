// Electron main process — runs the desktop shell.
// Loads the Vite production build from ../dist/index.html.
// Note: must be .cjs because package.json sets "type": "module".
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: "#0b0b0f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external http(s) links in the user's browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  const indexHtml = path.join(__dirname, "..", "dist", "index.html");
  win.loadFile(indexHtml);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
