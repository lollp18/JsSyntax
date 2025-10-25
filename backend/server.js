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
app.use('/dist', express.static('dist')); 

app.get("/", function (req, res) {
  res.sendFile(path.resolve("index.html"));
});

const server = app.listen(8080, function () {
  console.log("Server running on port 8080");
});

const ioserver = new Server(server, {
  cors: { origin: "*" },
});

const loadAndSendComponents = async (socket = null) => {
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
    
    const target = socket || ioserver;
    target.emit("components-updated", content);
    console.log(socket ? "Component initial load sent to new client." : "Component update broadcasted to all clients.");

  } catch (err) {
    console.error("Error processing component files:", err);
  }
};

const watcher = chokidar.watch(componentsPath, {
  ignored: /\.|\#.*$/,
  persistent: true,
  ignoreInitial: true,
});

watcher
  .on("add", path => { console.log(`File ${path} has been added`); loadAndSendComponents(); })
  .on("change", path => { console.log(`File ${path} has been changed`); loadAndSendComponents(); })
  .on("unlink", path => { console.log(`File ${path} has been removed`); loadAndSendComponents(); });

ioserver.on("connection", (socket) => {
  console.log("Client connected. Sending initial components...");
  loadAndSendComponents(socket);
});
