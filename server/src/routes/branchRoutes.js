import express from "express";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
} from "../controllers/branchController.js";

const router = express.Router();

router.use(authMiddleware);

// CRUD only when Branch toggle ON or Company Admin
router.post("/", authorizePermission("branches"), createBranch);
router.put("/:id", authorizePermission("branches"), updateBranch);
router.delete("/:id", authorizePermission("branches"), deleteBranch);

// List/View default for company_admin/accountant/sales_user
router.get(
  "/",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getBranches,
);

router.get(
  "/dropdown",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getBranches,
);

router.get(
  "/:id",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getBranchById,
);

export default router;