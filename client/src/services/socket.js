import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
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