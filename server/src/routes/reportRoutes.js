import express from "express";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import { getReports } from "../controllers/reportController.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  authorizePermission("reports"),
  getReports,
);

export default router;