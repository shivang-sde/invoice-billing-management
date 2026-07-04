import express from "express";

import {
  createAdmin,
  getAdmins,
  updateAdmin,
  updateAdminStatus,
  createAccountant,
  getAccountants,
  createSalesUser,
  getSalesUsers,
  updateTeamUser,
  updateTeamUserStatus,
  uploadProfileImage,
  getInactiveUsers,
} from "../controllers/userController.js";

import authMiddleware, {authorizeRoles} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

// SuperAdmin manages company admins
router.post("/admin", authorizeRoles("superadmin"), createAdmin);
router.get("/admins", authorizeRoles("superadmin"), getAdmins);
router.put("/admin/:id", authorizeRoles("superadmin"), updateAdmin);
router.patch(
  "/admin/:id/status",
  authorizeRoles("superadmin"),
  updateAdminStatus,
);

// Company Admin manages accountants
router.post("/accountant", authorizeRoles("company_admin"), createAccountant);
router.get("/accountants", authorizeRoles("company_admin"), getAccountants);

// Company Admin manages sales users
router.post("/sales-user", authorizeRoles("company_admin"), createSalesUser);
router.get("/sales-users", authorizeRoles("company_admin"), getSalesUsers);

// Company Admin updates team users
router.put("/team/:id", authorizeRoles("company_admin"), updateTeamUser);
router.patch(
  "/team/:id/status",
  authorizeRoles("company_admin"),
  updateTeamUserStatus,
);

router.patch(
  "/profile-image",
  authorizeRoles("superadmin", "company_admin", "accountant", "sales_user", "customer"),
  uploadProfileImage,
);

router.get(
  "/inactive-users",
  authorizeRoles("superadmin"),
  getInactiveUsers,
);

export default router;
