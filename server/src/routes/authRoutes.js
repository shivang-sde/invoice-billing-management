import express from "express";
import {
  login,
  logout,
  getMe,
  registerCompany,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/authController.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/company-register", registerCompany);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.patch("/change-password", authMiddleware, changePassword);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, getMe);

export default router;