import { io } from "socket.io-client";

// ◄ CHANGED: Dynamically reads the URL and strips out /api so it maps to Nginx port 8090
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL 
  ? import.meta.env.VITE_API_BASE_URL.replace('/api', '') 
  : "http://localhost:5000";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
});

let joinedUserKey = null;

const joinRooms = (user) => {
  if (!user?.id) return;

  socket.emit("join_rooms", {
    id: user.id,
    company_id: user.company_id,
    role: user.role,
  });
};

export const connectSocket = (user) => {
  if (!user?.id) return;

  const userKey = `${user.id}_${user.company_id}_${user.role}`;

  if (socket.connected) {
    if (joinedUserKey !== userKey) {
      joinRooms(user);
      joinedUserKey = userKey;
    }

    return;
  }

  socket.connect();

  socket.once("connect", () => {
    joinRooms(user);
    joinedUserKey = userKey;
  });
};

export const disconnectSocket = () => {
  joinedUserKey = null;

  if (socket.connected) {
    socket.disconnect();
  }
};

export default socket;