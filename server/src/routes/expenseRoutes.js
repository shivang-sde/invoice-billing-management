import express from "express";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  createExpense,
  getExpenses,
  getSingleExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/expenseController.js";

const router = express.Router();

router.use(authMiddleware);

// View/List access
router.get(
  "/",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  authorizePermission("expenses"),
  getExpenses,
);

router.get(
  "/:id",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  authorizePermission("expenses"),
  getSingleExpense,
);

// CRUD access
router.post(
  "/",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  authorizePermission("expenses"),
  createExpense,
);

router.put(
  "/:id",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  authorizePermission("expenses"),
  updateExpense,
);

router.delete(
  "/:id",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  authorizePermission("expenses"),
  deleteExpense,
);

export default router;