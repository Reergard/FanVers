export type MenuItem = {
  to: string;
  label: string;
  iconName?: string;
  kind?: "cta" | "link" | "danger";
};

export const USER_MENU: MenuItem[] = [
  { to: "/notifications", label: "Сповіщення", iconName: "bell" },
  { to: "/chat", label: "ChatVerse", iconName: "mail" },
  { to: "/bookmarks", label: "Закладки", iconName: "zakladki" },
  { to: "/my-translations", label: "Власні переклади", iconName: "my_books" },
  { to: "/profile", label: "Профіль", iconName: "profile" },
  { to: "/logout", label: "Вихід", iconName: "exit", kind: "danger" },
];

// Если для мобилки тебе нужно добавлять ещё NAV_MENU — оставь отдельно:
export const NAV_MENU = [
  { to: "/catalog", label: "Каталог" },
  { to: "/authors", label: "Автори" },
  { to: "/faq", label: "FAQ" },
];
