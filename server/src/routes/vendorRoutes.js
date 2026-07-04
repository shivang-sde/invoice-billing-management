import express from "express";

import authMiddleware, {
  authorizePermission,
  authorizeRoles,
} from "../middlewares/authMiddleware.js";

import {
  createVendor,
  getVendors,
  getSingleVendor,
  updateVendor,
  deleteVendor,
} from "../controllers/vendorController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", authorizePermission("vendors"), createVendor);

router.get("/", authorizePermission("vendors"), getVendors);

router.get(
  "/dropdown",
  authorizeRoles(
    "company_admin",
    "accountant"
  ),
  getVendors
);

router.get("/:id", authorizePermission("vendors"), getSingleVendor);

router.put("/:id", authorizePermission("vendors"), updateVendor);

router.delete("/:id", authorizePermission("vendors"), deleteVendor);

export default router;
