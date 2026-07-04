import axios from "axios";

const SANDBOX_BASE_URL = process.env.SANDBOX_BASE_URL;
const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY;
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET;
const SANDBOX_API_VERSION = process.env.SANDBOX_API_VERSION || "1.0";

let cachedAccessToken = null;
let cachedTokenExpiresAt = 0;

const validateSandboxConfig = () => {
  if (!SANDBOX_BASE_URL) {
    throw new Error("SANDBOX_BASE_URL missing in environment");
  }

  if (!SANDBOX_API_KEY) {
    throw new Error("SANDBOX_API_KEY missing in environment");
  }

  if (!SANDBOX_API_SECRET) {
    throw new Error("SANDBOX_API_SECRET missing in environment");
  }
};

const normalizeBaseUrl = () => {
  return SANDBOX_BASE_URL.replace(/\/$/, "");
};

const extractErrorMessage = (error, fallback) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    error?.response?.data?.data?.message ||
    error?.message ||
    fallback
  );
};

const getSandboxAccessToken = async () => {
  validateSandboxConfig();

  const now = Date.now();

  if (cachedAccessToken && cachedTokenExpiresAt > now + 60_000) {
    return cachedAccessToken;
  }

  try {
    const response = await axios.post(
      `${normalizeBaseUrl()}/authenticate`,
      null,
      {
        headers: {
          "x-api-key": SANDBOX_API_KEY,
          "x-api-secret": SANDBOX_API_SECRET,
          "x-api-version": SANDBOX_API_VERSION,
        },
      },
    );

    const token =
      response.data?.access_token ||
      response.data?.token ||
      response.data?.data?.access_token ||
      response.data?.data?.token;

    if (!token) {
      throw new Error("Sandbox access token not received");
    }

    cachedAccessToken = token;

    const expiresIn =
      Number(response.data?.expires_in) ||
      Number(response.data?.data?.expires_in) ||
      23 * 60 * 60;

    cachedTokenExpiresAt = Date.now() + expiresIn * 1000;

    return cachedAccessToken;
  } catch (error) {
    throw new Error(
      extractErrorMessage(error, "Failed to authenticate with Sandbox"),
    );
  }
};

const getSandboxHeaders = async () => {
  const token = await getSandboxAccessToken();

  return {
    Authorization: token,
    "x-api-key": SANDBOX_API_KEY,
    "x-api-version": SANDBOX_API_VERSION,
    "Content-Type": "application/json",
  };
};

const postSandbox = async (path, payload, fallbackMessage) => {
  try {
    const headers = await getSandboxHeaders();

    console.log("SANDBOX POST =>", {
      url: `${normalizeBaseUrl()}${path}`,
      payload,
    });

    const response = await axios.post(
      `${normalizeBaseUrl()}${path}`,
      payload,
      { headers },
    );

    return response.data;
  } catch (error) {
    console.error("SANDBOX API ERROR =>", {
      status: error?.response?.status,
      data: error?.response?.data,
      message: error?.message,
    });

    throw new Error(extractErrorMessage(error, fallbackMessage));
  }
};

export const generateAadhaarOtp = async ({
  aadhaarNumber,
  consent = "Y",
  reason = "KYC verification for company onboarding",
}) => {
  if (!aadhaarNumber) {
    throw new Error("Aadhaar number is required");
  }

  return postSandbox(
    "/kyc/aadhaar/okyc/otp",
    {
      "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
      aadhaar_number: aadhaarNumber,
      consent,
      reason,
    },
    "Failed to generate Aadhaar OTP",
  );
};

export const verifyAadhaarOtp = async ({
  referenceId,
  otp,
}) => {
  if (!referenceId) {
    throw new Error("Aadhaar reference id is required");
  }

  if (!otp) {
    throw new Error("Aadhaar OTP is required");
  }

  return postSandbox(
    "/kyc/aadhaar/okyc/otp/verify",
    {
      "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
      reference_id: referenceId,
      otp,
    },
    "Failed to verify Aadhaar OTP",
  );
};

export const verifyPan = async ({
  panNumber,
  nameAsPerPan,
  dateOfBirth,
  consent = "Y",
  reason = "KYC verification for company onboarding",
}) => {
  if (!panNumber) {
    throw new Error("PAN number is required");
  }

  if (!nameAsPerPan) {
    throw new Error("Name as per PAN is required");
  }

  if (!dateOfBirth) {
    throw new Error("Date of birth/incorporation is required");
  }

  return postSandbox(
    "/kyc/pan/verify",
    {
      "@entity": "in.co.sandbox.kyc.pan_verification.request",
      pan: panNumber,
      name_as_per_pan: nameAsPerPan,
      date_of_birth: dateOfBirth,
      consent,
      reason,
    },
    "Failed to verify PAN",
  );
};

export const verifyGst = async (gstNumber) => {
  if (!gstNumber) {
    throw new Error("GST number is required");
  }

  return postSandbox(
    "/gst/compliance/public/gstin/search",
    {
      gstin: gstNumber,
    },
    "Failed to verify GST",
  );
};

export const verifyTan = async (tanNumber) => {
  if (!tanNumber) {
    throw new Error("TAN number is required");
  }

  return postSandbox(
    "/kyc/tan",
    {
      tan: tanNumber,
    },
    "Failed to verify TAN",
  );
};