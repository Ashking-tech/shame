export const adminToken = process.env.ADMIN_TOKEN || "";
export const uploadLimitMax = Number(process.env.UPLOAD_RATE_LIMIT_MAX || 5);
export const uploadLimitWindowMs = Number(
  process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000
);
export const apiLimitMax = Number(process.env.API_RATE_LIMIT_MAX || 120);
export const apiLimitWindowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60 * 1000);
export const deleteLimitMax = Number(process.env.DELETE_RATE_LIMIT_MAX || 20);
export const deleteLimitWindowMs = Number(
  process.env.DELETE_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000
);
export const supabaseUrl = process.env.SUPABASE_URL || "";
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const supabaseBucket = process.env.SUPABASE_BUCKET || "hall-images";
