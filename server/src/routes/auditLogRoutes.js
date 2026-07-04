import express from "express";
import {
  getAuditLogs,
  exportAuditLogsCSV,
} from "../controllers/auditLogController.js";

import authMiddleware, {
  authorizePermission,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

const allowAuditLogs = (req, res, next) => {
  if (req.user?.role === "superadmin") {
    return next();
  }

  return authorizePermission("audit_logs")(req, res, next);
};

router.get("/", allowAuditLogs, getAuditLogs);

router.get("/export/csv", allowAuditLogs, exportAuditLogsCSV);

export default router;