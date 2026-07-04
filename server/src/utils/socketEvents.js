import { io } from "../../server.js";

export const emitNotificationUpdate = ({
  company_id,
  user_id,
}) => {
  if (company_id) {
    io.to(`company_${company_id}`).emit(
      "notification_updated",
    );
  }

  if (user_id) {
    io.to(`user_${user_id}`).emit(
      "notification_updated",
    );
  }
};

export const emitCustomerNotification = ({
  user_id,
  notification,
}) => {
  if (!user_id) return;

  io.to(`user_${user_id}`).emit(
    "customer_notification",
    notification,
  );
};

export const emitDashboardUpdate = ({
  company_id,
}) => {
  if (company_id) {
    io.to(`company_${company_id}`).emit(
      "dashboard_updated",
    );
  }
};