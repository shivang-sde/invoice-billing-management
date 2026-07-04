import express from "express";

import authMiddleware, {
  authorizePermission,
} from "../middlewares/authMiddleware.js";

import {
  createPayment,
  getPayments,
  getInvoicePayments,
} from "../controllers/paymentController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", authorizePermission("payments"), createPayment);

router.get("/", authorizePermission("payments"), getPayments);

router.get(
  "/invoice/:invoiceId",
  authorizePermission("payments"),
  getInvoicePayments,
);

export default router;
