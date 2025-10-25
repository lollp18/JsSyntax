import fs from "fs"
import path from "path"

import express from "express"
import { Server } from "socket.io"
const app = express()

const content = []
function processFilesInFolder(folderPath) {
  fs.readdirSync(folderPath).forEach((file) => {
    if (file.endsWith(".js")) {
      const FileContent = fs.readFileSync(path.join(folderPath, file), "utf8")
      content.push(FileContent)
    }
  })
}
processFilesInFolder("./components")
console.log(content)
app.get("/", function (req, res) {
  res.send("<h1>hi</h1>")
})
const server = app.listen(8080, function (req, res) {
  console.log("server running on port 8080")
})

const ioserver = new Server(server, {
  cors: {
    origin: "*", // Oder spezifische Domain
  },
})

ioserver.on("connection", (socket) => {
  socket.on("components", (data) => {
    ioserver.emit("components", content)
  })
})
