import { promises as fs } from "fs";
import path from "path";
import express from "express";
import { Server } from "socket.io";
import cors from "cors";
import chokidar from "chokidar";

const app = express();
const componentsPath = "./components";

app.use(cors());
app.use('/frontend', express.static('frontend'));
app.use('/dist', express.static('dist')); // Statische Dateien aus dem dist-Ordner bereitstellen

app.get("/", function (req, res) {
  res.sendFile(path.resolve("index.html"));
});

const server = app.listen(8080, function () {
  console.log("Server running on port 8080");
});

const ioserver = new Server(server, {
  cors: {
    origin: "*",
  },
});

const loadAndSendComponents = async () => {
  try {
    const files = await fs.readdir(componentsPath);
    const content = [];
    for (const file of files) {
      if (file.endsWith(".jss")) {
        const filePath = path.join(componentsPath, file);
        const fileContent = await fs.readFile(filePath, "utf8");
        content.push(fileContent);
      }
    }
    // An alle verbundenen Clients senden
    ioserver.emit("components-updated", content);
    console.log("Component update sent to clients.");
  } catch (err) {
    console.error("Error processing component files:", err);
  }
};

// Initiales Laden
loadAndSendComponents();

// Auf Änderungen überwachen
const watcher = chokidar.watch(componentsPath, {
  ignored: /\.|\#.*$/, // ignoriere dotfiles
  persistent: true,
  ignoreInitial: true, // Nicht beim initialen Scan auslösen
});

watcher.on("add", path => { console.log(`File ${path} has been added`); loadAndSendComponents(); });
watcher.on("change", path => { console.log(`File ${path} has been changed`); loadAndSendComponents(); });
watcher.on("unlink", path => { console.log(`File ${path} has been removed`); loadAndSendComponents(); });

ioserver.on("connection", (socket) => {
  console.log("Client connected. Sending initial components...");
  // Die neuesten Komponenten an den neu verbundenen Client senden
  loadAndSendComponents(); 
});
