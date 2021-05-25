const express = require("express");
const http = require("http");
const session = require("express-session");
const sharedSession = require("express-socket.io-session");
const morgan = require("morgan");
const cors = require("cors");
const piecesMoves = require("./piecesMoves");
import MongoStore from "connect-mongo";

require("dotenv").config();

const PORT = process.env.PORT || 80;
const app = express();
const server = http.createServer(app);
const sessionConfigs = session({
  secret: process.env.SESSION_SECRET,
  proxy: process.env.NODE_ENV === 'production',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: `mongodb+srv://${process.env.DB_LOGIN}:${process.env.DB_PASS}@cluster0.grwjz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`,
  }),
  cookie: { secure: process.env.NODE_ENV === 'production' },
});

app.use(morgan(":method :url :response-time"));

app.use(express.json());

app.use(sessionConfigs);

const corsConfigs = {
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
};

app.use(cors(corsConfigs));

// socket.io configs
const io = require("socket.io")(server, {
  cors: corsConfigs,
});
io.use(
  sharedSession(sessionConfigs, {
    autoSave: true,
  })
);

// Stores all the rooms
let rooms = new Map();

//=================< Utils Functions >================
/* Further down bellow there are a bunch of function with different applications */

// When room created this function is used to generate unique id in range from 0 to 999999
function generateRoomId() {
  let id = Math.floor(Math.random() * 1000000);
  if (rooms.get(id)) return generateRoomId();
  return id;
}

// When user joins room this function is called to identify what initial role to provide
function identifyInitRole(roomId) {
  let role = "spectator";
  let room = rooms.get(roomId);
  let users = Array.from(room.users.values());
  let player1 = users.find((user) => user.role === "player1");
  let player2 = users.find((user) => user.role === "player2");
  if (!player2) role = "player2";
  if (!player1) role = "player1";
  return role;
}

// finds players among users map
function findPlayers(room) {
  let players = [];

  players[0] = Array.from(room.users.values()).find(
    (user) => user.role === "player1"
  );
  players[1] = Array.from(room.users.values()).find(
    (user) => user.role === "player2"
  );

  return players;
}

function switchTimers(player, otherPlayer, bonusTime) {
  // pause this player's time and remember time left
  player.remainTime -= new Date() - player.startTime - bonusTime;

  // start this player's timer
  otherPlayer.startTime = new Date();
}

function defaultBoardContent() {
  let boardContent = [];

  for (let i = 0; i < 8; i++) boardContent.push([{}, {}, {}, {}, {}, {}, {}, {}]);

  boardContent[0][0] = { piece: "rook", color: "white", castling: true };
  boardContent[0][1] = { piece: "knight", color: "white" };
  boardContent[0][2] = { piece: "bishop", color: "white" };
  boardContent[0][3] = { piece: "queen", color: "white" };
  boardContent[0][4] = { piece: "king", color: "white", castling: true };
  boardContent[0][5] = { piece: "bishop", color: "white" };
  boardContent[0][6] = { piece: "knight", color: "white" };
  boardContent[0][7] = { piece: "rook", color: "white", castling: true };
  boardContent[7][0] = { piece: "rook", color: "black", castling: true };
  boardContent[7][1] = { piece: "knight", color: "black" };
  boardContent[7][2] = { piece: "bishop", color: "black" };
  boardContent[7][3] = { piece: "queen", color: "black" };
  boardContent[7][4] = { piece: "king", color: "black", castling: true };
  boardContent[7][5] = { piece: "bishop", color: "black" };
  boardContent[7][6] = { piece: "knight", color: "black" };
  boardContent[7][7] = { piece: "rook", color: "black", castling: true };

  for (let i = 0; i < 8; i++) boardContent[1][i] = { piece: "pawn", color: "white" };
  for (let i = 0; i < 8; i++) boardContent[6][i] = { piece: "pawn", color: "black" };

  return boardContent;
}

function startGame(roomId, room) {
  let [player1, player2] = findPlayers(room);

  player1.ready = false;
  player2.ready = false;

  if (Math.random() * 2 < 1) {
    player1.color = "white";
    player2.color = "black";
  } else {
    player2.color = "white";
    player1.color = "black";
  }

  let board = {
    content: defaultBoardContent(),
    currentColor: "white",
    currentRound: 1,
    movesHistory: [],
    roundsHistory: [],
    score: {
      player1: 0,
      player2: 0,
    },
    stats: {
      moves: 0,
      player1PiecesKilled: 0,
      player2PiecesKilled: 0,
      startTime: new Date(),
      endTime: 0,
    },
    player1: player1,
    player2: player2,
  };

  room.board = board;

  if (room.settings.timerEnabled) {
    player1.startTime = new Date();
    player2.startTime = new Date();
    player1.remainTime = room.settings.timerLength + 100;
    player2.remainTime = room.settings.timerLength + 100;

    if (player1.color === "white") {
      switchTimers(player2, player1, 0);
      setPlayerTimeout(roomId, room, player2);
    } else {
      switchTimers(player1, player2, 0);
      setPlayerTimeout(roomId, room, player1);
    }
  }

  io.to(roomId).emit("start-game", board);
}

// Checks if move is allowed
function checkMove(userId, roomId, origin, destination) {
  let room = rooms.get(roomId);
  let user = room.users.get(userId);
  let pieceColor = room.board.content[origin.y][origin.x].color;
  let piece = room.board.content[origin.y][origin.x].piece;
  let castling = room.board.content[origin.y][origin.x].castling;

  if (
    user.color === room.board.currentColor &&
    pieceColor === user.color &&
    piecesMoves[piece + "Moves"](
      room.board.content,
      origin,
      pieceColor,
      castling
    ).find((move) => {
      if (move.y === destination.y && move.x === destination.x) {
        destination.type = move.type;
        if (move.enPassant) destination.enPassant = move.enPassant;
        return true;
      }
      return false;
    })
  )
    return true;

  return false;
}

// Calculates all the new game stats after the following move
function gameStatsUpdate(user, room, destination) {
  if (user.color === "white") room.board.stats.moves++;

  if (
    room.board.content[destination.y][destination.x].color ===
    room.board.player1.color
  )
    room.board.stats.player1PiecesKilled++;
  if (
    room.board.content[destination.y][destination.x].color ===
    room.board.player2.color
  )
    room.board.stats.player2PiecesKilled++;
}

// when both player ready this function counting down and starts game if i reaches 0
function readyCountDown(roomId, room, i) {
  if (!i) return startGame(roomId, room);
  let [player1, player2] = findPlayers(room);
  if (player1?.ready && player2?.ready) {
    io.to(roomId).emit("server-msg", `Game starts in ${i}...`);
    setTimeout(() => readyCountDown(roomId, room, i - 1), 1000);
  }
}

function startNextRound(roomId, room) {
  if (room.board.player1?.ready && room.board.player2?.ready) {
    room.board.player1.ready = false;
    room.board.player2.ready = false;
    room.board.player1.color =
      room.board.player1.color === "white" ? "black" : "white";
    room.board.player2.color =
      room.board.player2.color === "white" ? "black" : "white";
    room.board.content = defaultBoardContent();
    room.board.currentColor = "white";
    room.board.currentRound++;
    io.to(roomId).emit("start-round", room.board);
  }
}

function setPlayerTimeout(roomId, room, player) {
  room.timerId = setTimeout(
    () => {
      if (room.board?.roundsHistory.length === room.board?.currentRound) return;

      room.board.score[player.role]++;
      room.board.roundsHistory.push({
        winner: player.role,
        color: player.color.slice(),
      });

      if (room.board.score[player.role] > room.settings.rounds / 2) {
        room.board.winner = player;
        room.board.stats.endTime = new Date();
      }

      io.to(roomId).emit("board-data", room.board);

      if (room.board.winner) room.board = null;
    },
    player.color === room.board.player1.color
      ? room.board.player2.remainTime
      : room.board.player1.remainTime
  );
}

//====================< Socket routes >====================

// All the interactions inside room goes via sockets
io.use((socket, next) => {
  if (!socket.handshake.session.username) {
    socket.handshake.session.username = "Player";
    socket.handshake.session.room = { id: 0 };
  }
  let roomId = socket.handshake.session.room.id;
  if (roomId) {
    let room = rooms.get(roomId);
    let user = room.users.get(socket.handshake.session.id);
    if (user) user.connected = true;
  }
  next();
});

io.on("connection", (socket) => {
  let userId = socket.handshake.session.id;
  let roomId = socket.handshake.session.room.id;

  if (!roomId) return;

  let room = rooms.get(roomId);
  let user = room.users.get(userId);

  socket.on("enter-room", () => {
    if (user) {
      socket.join(roomId);

      socket.emit("data", roomId, room.name, Array.from(room.users.values()));
      socket.emit("settings", room.settings);
      socket.emit("user-data", user.status, user.role);
      socket.emit("server-msg", `Welcome, ${user.username}!`);
      if (room.board?.content) {
        socket.emit("board-data", room.board);
        socket.emit(
          "user-data",
          user.status,
          user.role,
          user.color || room.board.player1.color
        );
      }
      if (room.users.size === 1) {
        io.to(roomId).emit("server-msg", "Room successfully created!");
        io.to(roomId).emit("server-msg", "Room ID " + roomId);
      }
    }
  });

  socket.on("get-user-data", () => {
    if (room.board?.content)
      socket.emit(
        "user-data",
        user.status,
        user.role,
        user.color || room.board.player1.color
      );
    else socket.emit("user-data", user.status, user.role);
  });

  socket.on("msg", (msg) => {
    if (msg.length)
      io.to(roomId).emit("msg", socket.handshake.session.username, msg);
  });

  socket.on("change-room-name", () => {
    if (user.status !== "guest") {
      io.to(roomId).emit("data", roomId, room.name, Array.from(room.users.values()));
    }
  });

  socket.on("changed-username", (newUsername) => {
    let oldUsername = socket.handshake.session.username;

    if (oldUsername === newUsername || !/^[a-zA-Z][\w\d]{3,}/.test(newUsername))
      return;

    user.username = newUsername;
    io.to(roomId).emit("data", roomId, room.name, Array.from(room.users.values()));
    io.to(roomId).emit(
      "server-msg",
      oldUsername + " changed username to " + newUsername
    );
  });

  socket.on("set-settings", (settings) => {
    if (user.status === "guest") return;

    if (settings?.rounds > 0 && settings?.rounds < 16)
      room.settings.rounds = settings.rounds;
    room.settings.timerEnabled = settings.timerEnabled;
    if (settings?.timerLength > 0 && settings?.timerLength < 100 * 60 * 1000)
      room.settings.timerLength = settings.timerLength;
    if (settings?.timerBonus > 0 && settings?.timerBonus < 61 * 1000)
      room.settings.timerBonus = settings.timerBonus;
    io.to(roomId).emit("settings", room.settings);
  });

  // if both players are ready to start game then starts countdown
  socket.on("ready-status", (readyStatus) => {
    if (user.role === "spectator") return;

    if (
      !room.board?.content ||
      room.board.currentRound === room.board.roundsHistory.length
    ) {
      user.ready = readyStatus;
      io.to(roomId).emit("data", roomId, room.name, Array.from(room.users.values()));

      if (!room.board?.currentRound) readyCountDown(roomId, room, 5);
      else startNextRound(roomId, room);
    }
  });

  // players submit moves to this route
  socket.on("move", (origin, destination) => {
    if (
      room.board.winner ||
      room.board.currentRound === room.board.roundsHistory.length
    )
      return;

    if (checkMove(userId, roomId, origin, destination)) {
      gameStatsUpdate(user, room, origin, destination);

      // enPassant related staff
      let enPassantPawn = room.board.content
        .flat()
        .find((piece) => piece.color === room.board.currentColor && piece.enPassant);
      if (enPassantPawn) delete enPassantPawn.enPassant;

      if (destination.enPassant && destination.type === "attack") {
        room.board.content[destination.y - 1][destination.x] = {};
        room.board.content[destination.y + 1][destination.x] = {};
      }
      if (destination.enPassant && destination.type === "move")
        room.board.content[origin.y][origin.x].enPassant = true;

      // castling related staff
      if (room.board.content[origin.y][origin.x].piece === "king") {
        if (destination.x - origin.x > 1) {
          delete room.board.content[destination.y][7].castling;
          room.board.content[destination.y][destination.x - 1] =
            room.board.content[destination.y][7];
          room.board.content[destination.y][7] = {};
        }

        if (destination.x - origin.x < -1) {
          delete room.board.content[destination.y][0].castling;
          room.board.content[destination.y][destination.x + 1] =
            room.board.content[destination.y][0];
          room.board.content[destination.y][0] = {};
        }
      }

      if (room.board.content[origin.y][origin.x].castling)
        delete room.board.content[origin.y][origin.x].castling;

      // Regular move
      room.board.content[destination.y][destination.x] =
        room.board.content[origin.y][origin.x];
      room.board.content[origin.y][origin.x] = {};
      room.board.currentColor =
        room.board.currentColor === "white" ? "black" : "white";

      // check for winner
      if (piecesMoves.isCheckmate(room.board.content, room.board.currentColor)) {
        room.board.score[user.role]++;
        room.board.roundsHistory.push({
          winner: user.role,
          color: user.color.slice(),
        });
        if (room.board.score[user.role] > room.settings.rounds / 2) {
          room.board.winner = user;
        } else if (
          room.board.score.player1 === room.board.score.player2 &&
          room.board.currentRound === room.settings.rounds
        ) {
          room.board.winner = "draw";
        }
        room.board.stats.endTime = new Date();
      }

      if (room.settings.timerEnabled) {
        if (room.timerId) {
          clearTimeout(room.timerId);
        }

        if (user.color === room.board.player1.color)
          switchTimers(user, room.board.player2, room.settings.timerBonus);
        else switchTimers(user, room.board.player1, room.settings.timerBonus);

        if (
          room.board?.roundsHistory.length !== room.board?.currentRound &&
          !room.board.winner
        )
          setPlayerTimeout(roomId, room, user);
      }

      if (
        (destination.y === 7 || destination.y === 0) &&
        room.board.content[destination.y][destination.x].piece === "pawn"
      )
        room.board.content[destination.y][destination.x].piece = "queen";
    }
    io.to(roomId).emit("board-data", room.board);
    if (room.board.winner) room.board = null;
  });

  // syncs the express and socket session if needed
  socket.on("reload-session", () => {
    socket.handshake.session.reload(() => {});
  });

  socket.on("leave-room", () => {
    room.users.delete(userId);
    socket.handshake.session.room.id = 0;

    if (room.board?.content && user.role !== "spectator") {
      room.board.roundsHistory.push({
        winner: user.role === "player1" ? "player2" : "player1",
        color: user.color.slice() === "white" ? "black" : "white",
      });
      room.board.winner =
        user.role === "player1" ? room.board.player2 : room.board.player1;
      io.to(roomId).emit("board-data", room.board);
    }

    io.to(roomId).emit("data", roomId, room.name, Array.from(room.users.values()));
    if (!room.users.size) {
      rooms.delete(roomId);
      console.log(`Room ${roomId} deleted.`);
    } else {
      let players = findPlayers(room);
      if (!players[0]) players[1].role = "player1";

      if (user.status === "owner") {
        if (players[0]) players[0].status = "owner";
        else room.users.values().next().value.status = "owner";
      }
      io.to(roomId).emit("data", roomId, room.name, Array.from(room.users.values()));
    }
  });

  // users not removed from room on disconnecting because they can reconnect
  socket.on("disconnecting", () => {
    user.connected = false;
    setTimeout(() => {
      if (user.connected || !room.users.get(userId)) return;

      if (room.timerId) clearTimeout(room.timerId);

      if (room.board?.content && user.role !== "spectator") {
        room.board.roundsHistory.push({
          winner: user.role === "player1" ? "player2" : "player1",
          color: user.color.slice() === "white" ? "black" : "white",
        });
        room.board.winner =
          user.role === "player1" ? room.board.player2 : room.board.player1;

        room.board.stats.endTime = new Date();
      }
      io.to(roomId).emit("board-data", room.board);

      if (room.board?.winner) room.board = null;
      room.users.delete(userId);
      socket.handshake.session.room.id = 0;
      io.to(roomId).emit("data", roomId, room.name, Array.from(room.users.values()));
      if (!room.users.size) {
        rooms.delete(roomId);
        console.log(`Room ${roomId} deleted.`);
      } else {
        let players = findPlayers(room);
        if (!players[0] && players[1]) players[1].role = "player1";

        if (user.status === "owner") {
          if (players[0]) players[0].status = "owner";
          else room.users.values().next().value.status = "owner";
        }
        io.to(roomId).emit(
          "data",
          roomId,
          room.name,
          Array.from(room.users.values())
        );
      }
    }, 120 * 1000);
  });
});

// Automatically sets default values for user
app.use((req, res, next) => {
  if (!req.session.username) {
    req.session.username = "Player";
    req.session.room = { id: 0 };
  }
  next();
});

/*====================< Routes >===================*/
/* Down below you can see different routes e.g. to create or to join room        */
/* It can be easily done using sockets, but i decided to separate this into routes */

// This is a general route to get username and roomId, if previously connection
// was established
app.get("/", (req, res) => {
  res.json({ username: req.session.username, roomId: req.session.room.id });
});

// Route to get client url if needed
app.get("/client-url", (req, res) => {
  res.json({ clientUrl: process.env.CLIENT_URL });
});

// This route checks if submitted username is appropriate and sets it to the session
app.post("/submit-username", (req, res) => {
  if (req.body.username === req.session.username)
    return res.json({ username: req.session.username, errorMsg: "" });

  let errorMsg = "";
  if (/^[a-zA-Z][\w\d]{3,}/.test(req.body.username)) {
    req.session.username = req.body.username;
  } else {
    errorMsg =
      "Username should be at least 4 symbols long and can only include letters, digits and '_' symbol";
  }
  res.json({ username: req.session.username, errorMsg: errorMsg });
});

// This route checks if submitted room name is appropriate and sets it to the room
app.post("/submit-room-name", (req, res) => {
  let errorMsg = "";
  if (/^[a-zA-Z][\w\d]{4,}/.test(req.body["room-name"])) {
    rooms.get(req.session.room.id).name = req.body["room-name"];
  } else {
    errorMsg =
      "Room name should be at least 4 symbols long and can only include letters, digits and '_' symbol";
  }
  res.json({ errorMsg: errorMsg });
});

// This route simply creates room
app.post("/create-room", (req, res) => {
  let roomId = generateRoomId();
  let room = {
    name: "Room",
    users: new Map(),
    settings: {
      rounds: 1,
      timerEnabled: true,
      timerLength: 10 * 60 * 1000,
      timerBonus: 2 * 1000,
    },
  };

  // automatically adds room creator to users
  room.users.set(req.session.id, {
    username: req.session.username,
    role: "player1",
    status: "owner",
    ready: false,
  });
  // sets room to rooms map
  rooms.set(roomId, room);

  req.session.room = { id: roomId };
  res.json({ accessGranted: true });
});

// This route simply adds user to room
app.get("/join-room/:id", (req, res) => {
  // cant enter more than one room, automatically joins already joined one
  if (req.session.room.id) return res.json({ accessGranted: true });

  let roomId = Number.parseInt(req.params.id);
  let room = rooms.get(roomId);

  if (room) {
    let role = identifyInitRole(roomId);
    room.users.set(req.session.id, {
      username: req.session.username,
      role: role,
      status: "guest",
    });
    req.session.room = { id: roomId };
    res.json({ accessGranted: true });
    io.to(roomId).emit("server-msg", req.session.username + " joined!");
  } else
    res.json({
      accessGranted: false,
      errorMsg: "Sorry, we couldn't find room with this ID.",
    });
});

server.listen(PORT, () => {
  console.log("Server listening on port " + PORT);
});
