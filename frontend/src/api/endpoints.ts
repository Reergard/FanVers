export const API = {
  csrf: "/api/users/csrf/",
  login: "/api/users/login/",
  register: "/api/users/register/",
  refresh: "/api/users/refresh/",
  logout: "/api/users/logout/",
  authStatus: "/api/users/auth-status/",

  // Profile
  userProfile: "/api/users/profile/",
  profileUploadImage: "/api/users/profile/upload-image/",
  profileDeleteImage: "/api/users/profile/delete-image/",
  profileUpdateEmail: "/api/users/profile/update-email/",
  profileChangePassword: "/api/users/profile/change-password/",
  profileNotificationSettings: "/api/users/profile/notification-settings/",

  // Balance & roles
  becomeTranslator: "/api/users/become-translator/",
  becomeAuthor: "/api/users/become-author/",
  addBalance: "/api/users/add-balance/",
  withdrawBalance: "/api/users/withdraw-balance/",
} as const;
