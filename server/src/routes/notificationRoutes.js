import express from "express";
import authMiddleware, {
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(authMiddleware);

const allowedNotificationRoles = [
  "superadmin",
  "company_admin",
  "accountant",
  "sales_user",
];

router.get(
  "/",
  authorizeRoles(...allowedNotificationRoles),
  getNotifications,
);

router.get(
  "/unread-count",
  authorizeRoles(...allowedNotificationRoles),
  getUnreadNotificationCount,
);

router.patch(
  "/read-all",
  authorizeRoles(...allowedNotificationRoles),
  markAllNotificationsRead,
);

router.patch(
  "/:id/read",
  authorizeRoles(...allowedNotificationRoles),
  markNotificationRead,
);

export default router;