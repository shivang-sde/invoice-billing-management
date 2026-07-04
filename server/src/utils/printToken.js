import jwt from "jsonwebtoken";

const PRINT_TOKEN_SECRET =
  process.env.PRINT_TOKEN_SECRET || process.env.JWT_SECRET;

export const createPrintToken = ({ type, documentId, companyId }) => {
  return jwt.sign(
    {
      type,
      documentId,
      companyId,
      purpose: "document_print",
    },
    PRINT_TOKEN_SECRET,
    { expiresIn: "2m" },
  );
};

export const verifyPrintToken = (token) => {
  return jwt.verify(token, PRINT_TOKEN_SECRET);
};