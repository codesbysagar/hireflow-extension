/**
 * HireFlow - Backend API Configuration
 */

export const CONFIG = {
  AUTH_BASE_URL: 'https://nebula-auth-mn52.onrender.com/api/v1/auth',
  WORKER_BASE_URL: 'https://nebula-worker.onrender.com/api/v1/worker',
  MASTER_BASE_URL: 'https://nebula-master.onrender.com/api/v1/master',
} as const;

export type ApiConfig = typeof CONFIG;
