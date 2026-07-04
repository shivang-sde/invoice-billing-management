import express from "express";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  createTax,
  getTaxes,
  updateTax,
  deleteTax,
} from "../controllers/taxController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", authorizePermission("taxes"), createTax);

router.get("/", authorizePermission("taxes"), getTaxes);

router.get(
  "/dropdown",
  authorizeRoles("company_admin", "accountant", "sales_user"),
  getTaxes,
);

router.put("/:id", authorizePermission("taxes"), updateTax);

router.delete("/:id", authorizePermission("taxes"), deleteTax);

export default router;