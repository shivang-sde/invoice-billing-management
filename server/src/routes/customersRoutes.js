import express from "express";

import {
  createCustomer,
  getCustomers,
  getSingleCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customersController.js";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

// DROPDOWN ROUTE
// Invoice / Quotation forms ke liye read-only customer list
router.get(
  "/dropdown",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getCustomers,
);

// CUSTOMER MODULE
router.post("/", authorizePermission("customers"), createCustomer);

router.get(
  "/",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getCustomers,
);

router.get("/:id", authorizePermission("customers"), getSingleCustomer);

router.put("/:id", authorizePermission("customers"), updateCustomer);

router.delete("/:id", authorizePermission("customers"), deleteCustomer);

export default router;
