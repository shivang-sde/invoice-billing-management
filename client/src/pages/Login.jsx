import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";

import {
  FileText,
  Mail,
  ArrowRight,
  ShieldCheck,
  Building2,
  BarChart3,
  Sparkles,
  CheckCircle2,
  X,
  KeyRound,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: location.state?.email || "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [forgotError, setForgotError] = useState("");

  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(location.state?.email || "");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateLogin = () => {
    const nextErrors = {};
    const email = normalizeEmail(formData.email);

    if (!email) {
      nextErrors.email = "Email is required";
    } else if (!EMAIL_REGEX.test(email)) {
      nextErrors.email = "Invalid email format";
    }

    if (!formData.password) {
      nextErrors.password = "Password is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateForgotPassword = () => {
    const email = normalizeEmail(forgotEmail);

    if (!email) {
      setForgotError("Email is required");
      return false;
    }

    if (!EMAIL_REGEX.test(email)) {
      setForgotError("Invalid email format");
      return false;
    }

    setForgotError("");
    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateLogin()) return;

    try {
      setLoading(true);

      const payload = {
        email: normalizeEmail(formData.email),
        password: formData.password,
      };

      const res = await api.post("/auth/login", payload);
      const user = res.data.user;

      localStorage.removeItem("kyc_token");
      localStorage.removeItem("kyc_user");
      localStorage.removeItem("pending_company_id");
      localStorage.removeItem("pending_admin_email");

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(user));

      toast.success(
        user.branch_name
          ? `Login successful - ${user.branch_name}`
          : "Login successful",
      );

      if (user.role === "superadmin") {
        navigate("/superadmin/dashboard", { replace: true });
      } else if (user.role === "customer") {
        navigate("/customer-portal/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      const data = error.response?.data;

      if (
        error.response?.status === 403 &&
        data?.kyc_required &&
        data?.company_id
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        if (data.token) {
          localStorage.setItem("kyc_token", data.token);
        }

        if (data.user) {
          localStorage.setItem("kyc_user", JSON.stringify(data.user));
        }

        localStorage.setItem("pending_company_id", data.company_id);
        localStorage.setItem("pending_admin_email", normalizeEmail(formData.email));

        toast.error(data.message || "Please complete KYC verification");

        navigate(`/kyc-verification/${data.company_id}`, {
          replace: true,
          state: {
            email: normalizeEmail(formData.email),
            kyc_status: data.kyc_status,
            kyc_attempts: data.kyc_attempts,
          },
        });

        return;
      }

      toast.error(data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();

    if (!validateForgotPassword()) return;

    try {
      setForgotLoading(true);

      await api.post("/auth/forgot-password", {
        email: normalizeEmail(forgotEmail),
      });

      toast.success("If this email exists, reset link has been sent.");
      setShowForgotModal(false);
      setForgotError("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send reset link");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 px-4 py-4">
      <div className="mx-auto grid h-[calc(100vh-32px)] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative hidden overflow-hidden bg-slate-950 p-10 text-white lg:block">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="mb-12 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-900/30">
                  <FileText size={26} />
                </div>

                <div>
                  <h1 className="text-2xl font-bold">Smart Invoice</h1>
                  <p className="text-sm text-slate-400">
                    SaaS Billing Management
                  </p>
                </div>
              </div>

              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
                <Sparkles size={14} />
                Multi-tenant invoice platform
              </div>

              <h2 className="max-w-xl text-2xl font-bold leading-tight">
                Run invoices, subscriptions and payments from one powerful
                dashboard.
              </h2>

              <p className="mt-4 max-w-md text-base leading-relaxed text-slate-400">
                Manage company billing and invoices with role-based access and
                multi-branch support.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <FeatureItem
                icon={<ShieldCheck size={21} />}
                title="Secure RBAC Access"
                text="SuperAdmin, Company Admin, Accountant, Sales User and Customer Portal."
              />

              <FeatureItem
                icon={<Building2 size={21} />}
                title="Company & Branch Isolation"
                text="Each company works in its own secure tenant workspace."
              />

              <FeatureItem
                icon={<BarChart3 size={21} />}
                title="Billing & Revenue Tracking"
                text="Subscription invoices, payments and platform revenue summary."
              />
            </div>
          </div>
        </div>

        <div className="flex items-center p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                <CheckCircle2 size={14} />
                Welcome back
              </div>

              <h2 className="text-3xl font-bold text-slate-900">
                Login to Dashboard
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Enter your credentials to continue managing your billing
                workspace.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full rounded-xl border bg-white py-3.5 pl-12 pr-4 text-sm font-medium outline-none transition focus:ring-4 ${
                      errors.email
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                  />
                </div>

                {errors.email && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Password
                </label>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter password"
                    className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm outline-none focus:ring-4 ${
                      errors.password
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {errors.password && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">
                    {errors.password}
                  </p>
                )}

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(formData.email || "");
                      setForgotError("");
                      setShowForgotModal(true);
                    }}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {loading ? "Logging In..." : "Login to Dashboard"}
                {!loading && <ArrowRight size={19} />}
              </button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    New here?
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/register-company")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Building2 size={18} />
                Create Company Account
              </button>
            </form>

            <p className="mt-6 text-center text-xs font-medium text-slate-400">
              By continuing, you agree to use Smart Invoice securely for your
              billing operations.
            </p>
          </div>
        </div>
      </div>

      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <KeyRound size={22} />
                </div>

                <h2 className="text-xl font-bold text-slate-900">
                  Forgot Password
                </h2>

                <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
                  Enter your registered email. We will send a password reset
                  link to your mail.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotError("");
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      if (forgotError) setForgotError("");
                    }}
                    placeholder="Enter registered email"
                    className={`w-full rounded-xl border bg-white py-3.5 pl-12 pr-4 text-sm font-medium outline-none transition focus:ring-4 ${
                      forgotError
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                  />
                </div>

                {forgotError && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">
                    {forgotError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {forgotLoading ? "Sending Link..." : "Send Reset Link"}
                {!forgotLoading && <Send size={18} />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotError("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Login
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureItem({ icon, title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur ">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-500/20 p-2 text-blue-300">
          {icon}
        </div>

        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-400">{text}</p>
        </div>
      </div>
    </div>
  );
}

export default Login;