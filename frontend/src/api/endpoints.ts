export const API = {
  csrf: "/api/users/csrf/",
  login: "/api/users/login/",
  register: "/api/users/register/",
  refresh: "/api/users/refresh/",
  logout: "/api/users/logout/",
  authStatus: "/api/users/auth-status/",
  oauthExchange: "/api/users/oauth-exchange/",
  oauthBegin: (provider: "google-oauth2" | "facebook") => `/api/auth/o/${provider}/`,

  // Profile
  userProfile: "/api/users/profile/",
  profileUploadImage: "/api/users/profile/upload-image/",
  profileDeleteImage: "/api/users/profile/delete-image/",
  profileUpdateEmail: "/api/users/profile/update-email/",
  profileChangePassword: "/api/users/profile/change-password/",
  profileNotificationSettings: "/api/users/profile/notification-settings/",
  usersAuthorsList: "/api/users/authors/",
  usersTranslatorsList: "/api/users/translators/",

  // Balance & roles
  becomeTranslator: "/api/users/become-translator/",
  becomeAuthor: "/api/users/become-author/",
  addBalance: "/api/users/add-balance/",
  withdrawBalance: "/api/users/withdraw-balance/",

  // Bookmarks (navigation)
  bookmarkStatus: (bookId: number) => `/api/navigation/bookmarks/status/${bookId}/`,
  bookmarks: "/api/navigation/bookmarks/",
  bookmarkById: (id: number) => `/api/navigation/bookmarks/${id}/`,

  // Notifications
  notifications: "/api/notification/notifications/",
  notificationById: (id: number | string) => `/api/notification/notifications/${id}/`,
  notificationMarkAsRead: (id: number | string) =>
    `/api/notification/notifications/${id}/mark_as_read/`,

  // Reviews (comments)
  bookComments: (bookSlug: string) => `/api/reviews/book/${bookSlug}/comments/`,
  chapterComments: (chapterSlug: string) => `/api/reviews/chapter/${chapterSlug}/comments/`,
  commentReaction: (type: "book" | "chapter", commentId: number) =>
    `/api/reviews/${type}-comment/${commentId}/update_reaction/`,
  commentOwnerLike: (type: "book" | "chapter", commentId: number) =>
    `/api/reviews/${type}-comment/${commentId}/owner_like/`,
  bookCommentDetail: (bookSlug: string, commentId: number) =>
    `/api/reviews/book/${bookSlug}/comments/${commentId}/`,
  chapterCommentDetail: (chapterSlug: string, commentId: number) =>
    `/api/reviews/chapter/${chapterSlug}/comments/${commentId}/`,

  // Rating (book + translation quality)
  ratingBookRatings: (bookSlug: string) => `/api/rating/${encodeURIComponent(bookSlug)}/book-ratings/`,
  ratingSubmit: "/api/rating/",

  // Search
  bookSearch: "/api/search/book-search/",

  // Website advertising
  mainPageAds: "/api/website_advertising/advertisements/main_page_ads/",
  advertisingList: "/api/website_advertising/advertisements/",
  advertisingUserAds: "/api/website_advertising/advertisements/user_advertisements/",
  advertisingSubmitOrder: "/api/website_advertising/advertisements/submit_order/",
  advertisingBookAds: "/api/website_advertising/advertisements/book_advertisements/",

  // Main: новинки (НОВИНКИ) для головної сторінки
  booksNews: "/api/main/books-news/",

  // Subscription
  subscriptionSettings: (bookSlug: string) =>
    `/api/subscription/books/${encodeURIComponent(bookSlug)}/`,
  subscriptionPurchasePlan: (bookSlug: string) =>
    `/api/subscription/books/${encodeURIComponent(bookSlug)}/purchase-plan/`,
  subscriptionApplyPlan: (bookSlug: string) =>
    `/api/subscription/books/${encodeURIComponent(bookSlug)}/apply-plan/`,
  subscriptionUserSubscriptions: "/api/subscription/user/subscriptions/",

  // Chat
  chat: {
    list: "/api/chat/",
    create: "/api/chat/create/",
    byId: (chatId: number | string) => `/api/chat/${chatId}/`,
    messages: (chatId: number | string) => `/api/chat/${chatId}/messages/`,
    sendMessage: (chatId: number | string) => `/api/chat/${chatId}/send_message/`,
    markAsRead: (chatId: number | string) => `/api/chat/${chatId}/mark_as_read/`,
  },
} as const;
