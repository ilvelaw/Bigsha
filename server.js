const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT) || 8787;
const RANKS = path.join(__dirname, "logs", "ranks.json");
function readRanks() {
  try { return JSON.parse(fs.readFileSync(RANKS, "utf8")); } catch { return {}; }
}
function writeRanks(obj) {
  fs.mkdirSync(path.dirname(RANKS), { recursive: true });
  fs.writeFileSync(RANKS, JSON.stringify(obj));
}
const INDEX = path.join(__dirname, "index.html");
const rooms = new Map();

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(code) ? makeCode() : code;
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function relay(room, from, data, binary) {
  for (const peer of [room.host, room.guest]) {
    if (peer && peer !== from && peer.readyState === 1) peer.send(data, { binary: !!binary });
  }
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url.startsWith("/sounds/")) {
    const root = path.join(__dirname, "sounds");
    const parts = url.slice("/sounds/".length).split("/").filter(Boolean);
    const file = path.join(root, ...parts);
    const rel = path.relative(root, file);
    const ext = path.extname(file).toLowerCase();
    if (!parts.length || rel.startsWith("..") || path.isAbsolute(rel) || !fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const type = ext === ".ogg" ? "audio/ogg" : ext === ".wav" ? "audio/wav" : "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=86400" });
    fs.createReadStream(file).pipe(res);
    return;
  }
  if (url.startsWith("/items/")) {
    const name = path.basename(url);
    const file = path.join(__dirname, "items", name);
    if (!file.startsWith(path.join(__dirname, "items")) || !fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
    return;
  }
  if (req.method === "POST" && url === "/study") {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 20000) req.destroy(); });
    req.on("end", () => {
      try { JSON.parse(body); } catch { res.writeHead(400); res.end("bad"); return; }
      const dir = path.join(__dirname, "logs");
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFile(path.join(dir, "usability.jsonl"), body.trim() + "\n", () => {
        res.writeHead(204); res.end();
      });
    });
    return;
  }
  if (url === "/ranks" && req.method === "GET") {
    const rows = Object.values(readRanks()).filter(r => r && r.total > 0)
      .sort((a, b) => (b.total - a.total) || ((b.stars|0) - (a.stars|0)))
      .slice(0, 25);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(rows));
    return;
  }
  if (url === "/ranks" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; if (body.length > 4000) req.destroy(); });
    req.on("end", () => {
      let msg;
      try { msg = JSON.parse(body); } catch { res.writeHead(400); res.end("bad"); return; }
      const id = String(msg.id || "");
      if (!/^[A-Za-z0-9]{6,16}$/.test(id)) { res.writeHead(400); res.end("bad id"); return; }
      const nick = String(msg.nick || "Digger").replace(/[<>]/g, "").trim().slice(0, 20) || "Digger";
      const num = (v, max) => Math.max(0, Math.min(max, v|0));
      const total = num(msg.total, 1000000000);
      const all = readRanks();
      const prev = all[id];
      if (!prev && total <= 0) { res.writeHead(204); res.end(); return; }
      if (!prev || total >= prev.total) {
        all[id] = { id, nick, total, stars: num(msg.stars, 1000), legendary: num(msg.legendary, 25), finds: num(msg.finds, 500), updatedAt: Date.now() };
      } else {
        prev.nick = nick;
      }
      const ranked = Object.values(all).sort((a, b) => (b.total - a.total) || ((b.stars|0) - (a.stars|0)));
      const keep = {};
      ranked.slice(0, 200).forEach(r => { keep[r.id] = r; });
      writeRanks(keep);
      res.writeHead(204); res.end();
    });
    return;
  }
  if (url === "/gear.png") {
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-cache" });
    fs.createReadStream(path.join(__dirname, "gear.png")).pipe(res);
    return;
  }
  if (url === "/study.js") {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" });
    fs.createReadStream(path.join(__dirname, "study.js")).pipe(res);
    return;
  }
  if (url !== "/" && url !== "/index.html") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  fs.createReadStream(INDEX).pipe(res);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (data, isBinary) => {
    const room = rooms.get(ws.roomCode);
    if (isBinary) {
      if (room && ws === room.host) relay(room, ws, data, true);
      return;
    }
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.t === "create") {
      const code = makeCode();
      const name = String(msg.name || "Player 1").slice(0, 16);
      rooms.set(code, { host: ws, guest: null, names: [name, ""] });
      ws.roomCode = code;
      ws.role = "host";
      send(ws, { t: "room", code, role: "host" });
      return;
    }
    if (msg.t === "join") {
      const code = String(msg.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
      const found = rooms.get(code);
      if (!found || !found.host || found.host.readyState !== 1) {
        send(ws, { t: "err", text: "No open room with that code." });
        return;
      }
      if (found.guest && found.guest.readyState === 1) {
        send(ws, { t: "err", text: "That room already has two diggers." });
        return;
      }
      found.guest = ws;
      found.names[1] = String(msg.name || "Player 2").slice(0, 16);
      ws.roomCode = code;
      ws.role = "guest";
      send(ws, { t: "room", code, role: "guest", names: found.names });
      send(found.host, { t: "peer", names: found.names });
      console.log("Room " + code + ": " + found.names[0] + " + " + found.names[1]);
      return;
    }
    if (!room) return;
    relay(room, ws, JSON.stringify(msg), false);
  });

  ws.on("close", () => {
    const room = rooms.get(ws.roomCode);
    if (!room) return;
    const other = ws === room.host ? room.guest : room.host;
    if (other) send(other, { t: "bye" });
    if (ws === room.host) rooms.delete(ws.roomCode);
    else if (room.guest === ws) room.guest = null;
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Biqsha is ready.");
  console.log("  This PC   http://localhost:" + PORT);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if ((net.family === "IPv4" || net.family === 4) && !net.internal) console.log("  Same Wi-Fi  http://" + net.address + ":" + PORT);
    }
  }
});
