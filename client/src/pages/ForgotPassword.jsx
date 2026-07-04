import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validateEmail = () => {
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      setError("Email is required");
      return false;
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError("Invalid email format");
      return false;
    }

    setError("");
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateEmail()) return;

    try {
      setLoading(true);

      const res = await api.post("/auth/forgot-password", {
        email: normalizeEmail(email),
      });

      toast.success(
        res.data?.message ||
          "If this email exists, a password reset link has been sent.",
      );
      setSent(true);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <div className="bg-slate-900 px-8 py-7 text-white">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600">
            <Mail size={24} />
          </div>

          <h1 className="text-2xl font-bold">Forgot Password</h1>
          <p className="mt-2 text-sm text-slate-300">
            Enter your registered email and we’ll send you a password reset
            link.
          </p>
        </div>

        <div className="px-8 py-7">
          {sent ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
              <CheckCircle2 className="mb-3 text-green-600" size={30} />

              <h2 className="text-base font-bold text-slate-900">
                Reset link request submitted
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                If this email is registered, you will receive a reset password
                link shortly.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setError("");
                }}
                className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Try another email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Registered Email
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="admin@company.com"
                    className={`w-full rounded-xl border bg-white py-3 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:ring-4 ${
                      error
                        ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                        : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
                    }`}
                  />
                </div>

                {error && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600">
                    {error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>
          )}

          <Link
            to="/"
            className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-700"
          >
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;