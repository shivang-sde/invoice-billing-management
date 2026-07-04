import db from "../config/db.js";

import {
  createNotification as realtimeCreateNotification,
  notifyBusinessUsers as realtimeNotifyBusinessUsers,
  notifyCompanyAdmins as realtimeNotifyCompanyAdmins,
  notifyCustomer as realtimeNotifyCustomer,
  notifySuperAdmins as realtimeNotifySuperAdmins,
} from "./notificationHelper.js";

export const createNotification = async (payload) => {
  return realtimeCreateNotification({
    connection: db,
    ...payload,
  });
};

export const notifyBusinessUsers = async (payload) => {
  return realtimeNotifyBusinessUsers({
    connection: db,
    ...payload,
  });
};

export const notifyCompanyAdmins = async (payload) => {
  return realtimeNotifyCompanyAdmins({
    connection: db,
    ...payload,
  });
};

export const notifyCustomer = async (payload) => {
  return realtimeNotifyCustomer({
    connection: db,
    ...payload,
  });
};

export const notifySuperAdmins = async (payload) => {
  return realtimeNotifySuperAdmins({
    connection: db,
    ...payload,
  });
};