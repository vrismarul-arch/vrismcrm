// server.js (FINAL REAL-TIME CHAT + PRESENCE WORKING)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

/* -------------------------------------------------
   ⭐ CORS CONFIG
-------------------------------------------------- */
const corsOptions = {
  origin: ["https://vrismcrm.netlify.app", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
};
app.use(cors(corsOptions));
app.use(express.json());

/* -------------------------------------------------
   ⭐ ROUTES
-------------------------------------------------- */
app.use("/api/events", require("./routes/eventRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/departments", require("./routes/departmentRoutes"));
app.use("/api/teams", require("./routes/teamRoutes"));
app.use("/api/accounts", require("./routes/businessAccountRoutes"));
app.use("/api/quotations", require("./routes/quotationRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/service", require("./routes/brandServiceRoutes"));
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/work-sessions", require("./routes/workSessionRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/credentials", require("./routes/credentialRoutes"));
app.use("/api/access", require("./routes/userAccessRoutes"));

/* ======================================================
   ⭐⭐ CHAT API ROUTE
====================================================== */
app.use("/api/chat", require("./routes/chatRoutes"));

app.get("/api/test", (req, res) =>
  res.json({ message: "Server is working 🎉" })
);

/* -------------------------------------------------
   ⭐ CREATE HTTP + SOCKET SERVER
-------------------------------------------------- */
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["https://vrismcrm.netlify.app"],
    // origin: ["https://vrismcrm.netlify.app", "http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

// Make io global
global._io = io;

/* -------------------------------------------------
   ⭐ SOCKET.IO — CHAT + PRESENCE
-------------------------------------------------- */
const User = require("./models/User");

io.on("connection", (socket) => {
  console.log("🟢 Socket Connected:", socket.id);

  /* ⭐ JOIN USER ROOM */
  socket.on("join_room", (userId) => {
    if (!userId) return;
    socket.join(userId.toString());
    console.log("👤 Joined Room:", userId);
  });

  /* ⭐ REAL-TIME MESSAGE FORWARD
     (REST API stores the message; socket only delivers it) */
  socket.on("send_message", (msg) => {
    if (!msg?.to) return;
    io.to(msg.to.toString()).emit("new_message", msg);
  });

  /* ⭐ TYPING INDICATOR */
  socket.on("typing", ({ from, to }) => {
    if (!to) return;
    io.to(to.toString()).emit("typing", { from });
  });

  /* ⭐ PRESENCE SYSTEM */
  socket.on("presence_change", async (data) => {
    try {
      const { userId, presence } = data;
      if (!userId) return;

      const user = await User.findById(userId);
      if (!user) return;

      const previousPresence = user.presence;

      const updated = await User.findByIdAndUpdate(
        userId,
        {
          presence,
          previousPresence,
          lastActiveAt: new Date(),
        },
        { new: true }
      );

      io.emit("presence_updated", {
        userId: userId.toString(),
        presence: updated.presence,
        previousPresence,
        lastActiveAt: updated.lastActiveAt,
      });

    } catch (err) {
      console.error("Presence error:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);
  });
});

/* -------------------------------------------------
   ⭐ AUTO-OFFLINE CRON
-------------------------------------------------- */
const userStatusCron = require("./cron/userStatusCron");
userStatusCron();

/* -------------------------------------------------
   ⭐ START SERVER
-------------------------------------------------- */
connectDB().then(() => {
  const PORT = process.env.PORT || 5001;
  httpServer.listen(PORT, () =>
    console.log(`🔥 API + WebSocket Running on ${PORT}`)
  );
});
