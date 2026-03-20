require("dotenv").config();
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const session = require("express-session");
require("./config/passport");
const { connectRedis, redisClient } = require("./config/redis");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const projectRoutes = require("./routes/project.routes");
const taskRoutes = require("./routes/task.routes");
const userRoutes = require("./routes/user.routes");
const activityRoutes = require("./routes/activity.routes");
const contactRoutes = require("./routes/contact.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const adminRoutes = require("./routes/admin.routes");
const projectMonitoringRoutes = require("./routes/projectMonitoring.routes");
const paymentRoutes = require("./routes/payment.routes");

const http = require("http");
const { initSocket } = require("./socket");

const app = express();
const server = http.createServer(app);

// Initialize Socket.io attached to the HTTP server
initSocket(server);

process.on('unhandledRejection', (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on('uncaughtException', (err) => {
  console.error("Uncaught Exception thrown:", err);
});
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5174",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// Then register routes
app.use("/api/contact", contactRoutes);


app.use(
  session({
    secret: process.env.JWT_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

const startServer = async () => {
  try {


    await connectDB();
    console.log("MongoDB connected successfully");

    await connectRedis();
    console.log("Redis connected successfully");

    app.get("/", (req, res) => {
      res.send("API running");
    });

    app.use("/api/auth", authRoutes);
    app.use("/api/projects", projectRoutes);
    app.use("/api/tasks", taskRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/activities", activityRoutes);
    app.use("/api/analytics", analyticsRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/project-monitoring", projectMonitoringRoutes);
    app.use("/api/payment", paymentRoutes);

    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
};

startServer();
