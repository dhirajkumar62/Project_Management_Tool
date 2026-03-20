const { Server } = require("socket.io");

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:5174",
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);

        // Join a specific project room
        socket.on("joinProject", (projectId) => {
            socket.join(projectId);
            console.log(`Socket ${socket.id} joined project: ${projectId}`);
        });

        // Leave a specific project room
        socket.on("leaveProject", (projectId) => {
            socket.leave(projectId);
            console.log(`Socket ${socket.id} left project: ${projectId}`);
        });

        // Typing indicators
        socket.on("typing", ({ projectId, userId, username }) => {
            socket.to(projectId).emit("userTyping", { userId, username });
        });

        socket.on("stopTyping", ({ projectId, userId }) => {
            socket.to(projectId).emit("userStoppedTyping", { userId });
        });

        // Cursor movement for multiplayer presence
        socket.on("cursorMove", ({ projectId, userId, username, x, y }) => {
            socket.to(projectId).emit("cursorMoved", { userId, username, x, y });
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

module.exports = { initSocket, getIo };
