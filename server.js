// server.js (FINAL + CHAT + PRESENCE + LEAVE REALTIME)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

/* ⭐ CORS */
app.use(cors({
  origin: ["https://vrismcrm.netlify.app", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
}));
app.use(express.json());

/* ⭐ ROUTES */
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/departments", require("./routes/departmentRoutes"));
app.use("/api/teams", require("./routes/teamRoutes"));
app.use("/api/quotations", require("./routes/quotationRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/accounts", require("./routes/businessAccountRoutes"));

app.use("/api/service", require("./routes/brandServiceRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/work-sessions", require("./routes/workSessionRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/credentials", require("./routes/credentialRoutes"));
app.use("/api/access", require("./routes/userAccessRoutes"));
app.use("/api/projects", require("./routes/projectRoutes"));

/* 🆕 ⭐ LEAVE MANAGEMENT API */
app.use("/api/leaves", require("./routes/leaveRoutes"));  // <— ADDED

/* ⭐ CHAT */
app.use("/api/chat", require("./routes/chatRoutes"));

app.get("/api/test", (req, res) => res.json({ message: "Server is working 🎉" }));

/* ⭐ HTTP + SOCKET */
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["https://vrismcrm.netlify.app"],
    // origin: ["https://vrismcrm.netlify.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});
global._io = io;

const User = require("./models/User");

io.on("connection", (socket) => {
  console.log("🟢 Socket Connected:", socket.id);

  socket.on("join_room", (userId) => {
    if (!userId) return;
    socket.join(userId.toString());
  });

  /* ⭐ CHAT */
  socket.on("send_message", (msg) => {
    if (!msg?.to) return;
    io.to(msg.to.toString()).emit("new_message", msg);
  });

  /* ⭐ TYPING */
  socket.on("typing", ({ from, to }) => {
    if (!to) return;
    io.to(to.toString()).emit("typing", { from });
  });

  /* ⭐ PRESENCE */
  socket.on("presence_change", async ({ userId, presence }) => {
    if (!userId) return;
    const user = await User.findById(userId);
    if (!user) return;

    const previous = user.presence;

    const updated = await User.findByIdAndUpdate(userId, {
      presence,
      previousPresence: previous,
      lastActiveAt: new Date(),
    }, { new: true });

    io.emit("presence_updated", {
      userId: updated._id.toString(),
      presence: updated.presence,
      previousPresence: previous,
      lastActiveAt: updated.lastActiveAt,
    });
  });

  /* 🆕 ⭐ REAL-TIME LEAVE SYSTEM */
  socket.on("new_leave_request", (data) => {
    console.log("📩 New Leave Applied:", data);
    io.emit("leave_request_received", data); // Send alert to Admin
  });

  socket.on("leave_status_update", ({ userId, status, leaveId }) => {
    console.log("📌 Leave Status Changed:", status);
    io.to(userId.toString()).emit("leave_response", { status, leaveId });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});

/* ⭐ CRON */
require("./cron/userStatusCron")();

/* ⭐ DB + START */
connectDB().then(() => {
  const PORT = process.env.PORT || 5001;
  httpServer.listen(PORT, () =>
    console.log(`🔥 API + SOCKET Running on ${PORT}`)
  );
});
