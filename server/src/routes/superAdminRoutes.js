import express from "express";

import authMiddleware, {
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  getSuperAdminStats,
  getSuperAdminCompanyDetails,
} from "../controllers/superAdminController.js";

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/dashboard",
  authorizeRoles("superadmin"),
  getSuperAdminStats,
);

router.get(
  "/companies/:id/details",
  authorizeRoles("superadmin"),
  getSuperAdminCompanyDetails,
);

export default router;