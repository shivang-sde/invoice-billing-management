# 🚀 Smart Invoice & Billing Management SaaS

> A modern Multi-Tenant Invoice & Billing Management System built with the MERN Stack, inspired by enterprise billing solutions like Zoho Invoice. Designed for businesses to manage invoices, quotations, customers, branches, subscriptions, KYC verification, reports, and role-based access from a single platform.

---

## 📌 Overview

Smart Invoice & Billing Management is a cloud-based SaaS application that enables organizations to manage their complete billing workflow efficiently.

The platform supports:

- Multi-Tenant Architecture
- Company Registration & KYC
- Branch Management
- Customer Management
- Product Management
- Quotations
- Invoice Generation
- Payments
- Expense Tracking
- Vendor Management
- Tax Management
- Reports & Analytics
- Subscription Billing
- Role-Based Access Control (RBAC)
- Audit Logs
- Notifications

---

# ✨ Features

## 🏢 Company Management

- Company Registration
- Auto Company Admin Creation
- HQ Branch Auto Creation
- Company Settings
- Company Profile
- Email SMTP Configuration
- Company Status Management

---

## 👥 User Management

Supports multiple roles:

- Super Admin
- Company Admin
- Accountant
- Sales User

Features:

- Create Users
- Edit Users
- Activate / Deactivate Users
- Branch Assignment
- Permission Assignment
- Role Permissions

---

## 🔐 Authentication

- Secure JWT Authentication
- Login
- Logout
- Forgot Password
- Reset Password
- Change Password
- Profile Management

---

# 🔒 KYC Verification

Integrated Company KYC Flow.

Supports:

- Aadhaar Verification
- PAN Verification
- GST Verification
- TAN Verification

Features

- Automatic KYC Verification
- Manual KYC Request
- KYC Status Tracking
- KYC Attempts
- KYC Blocking
- SuperAdmin Approval

---

# 🏢 Branch Management

Features

- Auto HQ Branch
- Unlimited Branches
- Branch Status
- Branch Codes
- Branch-wise Management

---

# 👨‍💼 Customer Management

Features

- Create Customer
- Edit Customer
- Customer Details
- Customer GST
- Billing Address
- Shipping Address
- Customer Search

---

# 📦 Product Management

Features

- Product Categories
- Product Price
- Tax Configuration
- HSN Code
- SKU
- Product Status

---

# 📝 Quotation Management

Complete quotation lifecycle.

Features

- Create Quotation
- Edit Quotation
- View Quotation
- Download PDF
- Print
- Email Quotation
- Cancel Quotation
- Convert to Invoice

---

# 🧾 Invoice Management

Features

- Create Invoice
- Edit Invoice
- Invoice Preview
- Download PDF
- Print Invoice
- Email Invoice
- Payment Tracking
- Invoice Status
- Due Dates

---

# 💰 Payment Management

Features

- Record Payments
- Partial Payments
- Full Payments
- Payment History
- Outstanding Amount
- Payment Reports

---

# 💵 Expense Management

Features

- Add Expense
- Expense Categories
- Expense Reports
- Vendor Mapping

---

# 🏭 Vendor Management

Features

- Vendor Registration
- Vendor GST
- Vendor Contact Details
- Purchase Related Management

---

# 🧾 Tax Management

Supports

- GST
- CGST
- SGST
- IGST

Features

- Dynamic Tax Selection
- Tax Reports

---

# 📊 Reports

Includes

- Invoice Reports
- Payment Reports
- Expense Reports
- Tax Reports
- Revenue Reports

---

# 💳 Subscription Management

Features

- Company Plans
- Billing Cycle
- Subscription Renewal
- Payment History
- Platform Revenue

---

# 🔔 Notification System

Real-Time Notifications using Socket.IO

Supports

- Company Notifications
- User Notifications
- Role Notifications

---

# 📑 Audit Logs

Tracks

- Login
- Logout
- CRUD Operations
- Important Company Actions

---

# 🔐 Role Based Access Control

## Super Admin

Complete Platform Access

Can Manage

- Companies
- Users
- Subscriptions
- KYC
- Revenue
- Audit Logs
- Platform Settings

---

## Company Admin

Can Manage

- Company
- Branches
- Customers
- Products
- Quotations
- Invoices
- Vendors
- Taxes
- Payments
- Reports
- Accountants
- Sales Users

---

## Accountant

Permissions can be configured.

Default Modules

- Customers
- Products
- Invoices
- Payments
- Expenses
- Taxes
- Reports

---

## Sales User

Permissions can be configured.

Default Modules

- Customers
- Products
- Quotations
- Invoices

---

# 📁 Project Structure

```
Smart-Invoice-Billing-Management/

│

├── client/

│ ├── src/

│ ├── pages/

│ ├── components/

│ ├── layouts/

│ ├── redux/

│ ├── services/

│ ├── utils/

│ └── App.jsx

│

├── server/

│ ├── src/

│ ├── controllers/

│ ├── routes/

│ ├── middlewares/

│ ├── services/

│ ├── cron/

│ ├── config/

│ ├── uploads/

│ └── server.js

│

├── README.md

└── package.json
```

---

# 🛠️ Tech Stack

## Frontend

- React 19
- Vite
- Tailwind CSS
- React Router
- Redux Toolkit
- React Query
- Axios
- Recharts
- Lucide Icons
- React Hot Toast

---

## Backend

- Node.js
- Express.js
- MySQL
- JWT Authentication
- Socket.IO
- Multer
- Nodemailer
- Puppeteer

---

## Database

- MySQL

---

# 📄 PDF Generation

Professional PDF Engine

Supports

- Invoice PDF
- Quotation PDF
- Print
- Email Attachment

---

# 📧 Email Integration

Supports Company SMTP

- Gmail SMTP
- Custom SMTP
- Test Email
- Invoice Email
- Quotation Email

---

# 🔐 Security

- JWT Authentication
- Password Hashing (bcrypt)
- Input Validation
- SQL Injection Protection
- Role Authorization
- Company Isolation
- Multi-Tenant Architecture

---

# 🌐 Environment Variables

### Backend

```env
PORT=

DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=

JWT_SECRET=

EMAIL_USER=
EMAIL_PASS=

SANDBOX_API_KEY=
SANDBOX_API_SECRET=
SANDBOX_BASE_URL=

CORS_ORIGIN=

BACKEND_URL=
```

### Frontend

```env
VITE_API_BASE_URL=
```

---

# 🚀 Installation

## Clone Repository

```bash
git clone https://github.com/your-username/Smart-Invoice-Billing-Management.git
```

---

## Install Frontend

```bash
cd client

npm install

npm run dev
```

---

## Install Backend

```bash
cd server

npm install

npm run dev
```

---

# 📷 Main Modules

- Dashboard
- Company Management
- User Management
- Branch Management
- Customer Management
- Product Management
- Quotation Management
- Invoice Management
- Payment Management
- Vendor Management
- Expense Management
- Tax Management
- Reports
- Subscription Management
- Notifications
- Audit Logs
- KYC Management

---

# 🎯 Current Status

### Completed

- Multi Tenant Architecture
- Authentication
- Role Based Access
- Company Registration
- Branch Management
- Customer Management
- Product Management
- Quotations
- Invoice Generation
- PDF Engine
- Email Engine
- Reports
- Payments
- Vendors
- Expenses
- Taxes
- Notifications
- Audit Logs
- Subscription Module
- KYC Verification
- Responsive UI
- Dark / Light Theme

---

# 🚀 Future Enhancements

- Inventory Management
- Purchase Orders
- Recurring Invoices
- Mobile Application
- Payment Gateway Integration
- Multi-Currency Support
- Multi-Language Support
- AI Invoice Insights
- OCR Bill Scanner
- Customer Portal
- REST API Documentation

---

# 👨‍💻 Developed By

**Anshul**

Smart Invoice & Billing Management SaaS

Built with ❤️ using React, Node.js, Express, MySQL and Tailwind CSS.

---

# ⭐ Support

If you like this project,

⭐ Star this repository

🍴 Fork the repository

💡 Contribute with improvements

🐞 Report issues

---

## 📜 License

This project is intended for educational, portfolio, and commercial customization purposes. Please review and add your preferred license before production distribution.
