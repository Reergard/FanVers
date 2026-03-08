import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import styles from "./Profile.module.css";
import crownSvg from "./assets/icons/crown.svg";
import turnedOffView from "./assets/icons/turned_off_view.svg";
import includedView from "./assets/icons/included_view.svg";
import { SaveButton } from "../shared/SaveButton/SaveButton";
import crystalProfile from "./assets/icons/crysral_profile.svg";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import { refreshAuthStatus } from "../auth/service";
import {
  getMyProfile,
  uploadProfileImage,
  updateEmail,
  changePassword,
  updateNotificationSettings,
  becomeTranslator,
  becomeAuthor,
  depositBalance,
  withdrawBalance,
} from "./profileService";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { Modal } from "../shared/Modal/Modal";
import { useAdultContent } from "../settings/useAdultContent";
import { Breadcrumb } from "../navigation/Breadcrumb";
import { PageTitle } from "../navigation/PageTitle";
import { resolveAvatarUrl } from "../shared/avatar/resolveAvatarUrl";
import type { UserProfile, NotificationSettingsPatch, BalanceHistoryItem } from "./types";

const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateAvatarFile(file: File): string | null {
  if (file.size > AVATAR_MAX_SIZE) {
    return "Розмір файлу не може перевищувати 5MB";
  }
  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return "Підтримуються тільки формати: JPEG, PNG, WebP";
  }
  return null;
}

async function validateAvatarMagicBytes(file: File): Promise<boolean> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // JPEG: FF D8 FF
    const isJpeg =
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    // WebP: RIFF....WEBP
    const isWebp =
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;
    return isJpeg || isPng || isWebp;
  } catch {
    return false;
  }
}

/** Парсинг балансу: "10.50" | "10,50" | "10500" → number */
function parseBalance(value: string | number | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : 0;
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email не може бути порожнім";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return "Невірний формат email";
  return null;
}

function validatePasswords(
  oldP: string,
  newP: string,
  confirmP: string
): string | null {
  if (!oldP) return "Введіть поточний пароль";
  if (!newP) return "Введіть новий пароль";
  if (newP.length < 8) return "Новий пароль повинен містити мінімум 8 символів";
  if (newP !== confirmP) return "Новий пароль та підтвердження не співпадають";
  return null;
}

export default function Profile() {
  const { isAuthenticated, authReady } = useAuth();
  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [passwords, setPasswords] = useState({
    old: "",
    new: "",
    confirm: "",
  });

  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [adultConfirmModalOpen, setAdultConfirmModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([]);
  const { hideAdultContent, setHideAdultContent } = useAdultContent();

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getMyProfile,
    enabled: isAuthenticated,
  });

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading;

  useEffect(() => {
    if (profile?.email) setNewEmail(profile.email);
  }, [profile?.email]);

  useEffect(() => {
    if (profile?.hide_adult_content == null) return;
    setHideAdultContent(Boolean(profile.hide_adult_content));
  }, [profile?.hide_adult_content, setHideAdultContent]);

  const uploadAvatarMutation = useMutation({
    mutationFn: uploadProfileImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess("Фото профілю успішно оновлено");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error ??
        (err?.response?.status === 429
          ? "Занадто багато спроб. Спробуйте через годину."
          : "Помилка при завантаженні фото");
      showError(msg);
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: updateEmail,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setNewEmail("");
      showSuccess("Email успішно оновлено");
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error ?? "Помилка при оновленні email");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ old: o, new: n, confirm: c }: typeof passwords) =>
      changePassword(o, n, c),
    onSuccess: () => {
      setPasswords({ old: "", new: "", confirm: "" });
      showSuccess("Пароль успішно змінено");
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error ?? "Помилка при зміні пароля");
    },
  });

  const becomeTranslatorMutation = useMutation({
    mutationFn: becomeTranslator,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess(data?.message ?? "Роль оновлено");
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error ?? "Помилка при зміні ролі");
    },
  });

  const becomeAuthorMutation = useMutation({
    mutationFn: becomeAuthor,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess(data?.message ?? "Роль оновлено");
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error ?? "Помилка при зміні ролі");
    },
  });

  const depositMutation = useMutation({
    mutationFn: (amt: number) => depositBalance(amt),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshAuthStatus();
      setBalanceHistory(data?.balance_history ?? []);
      setDepositModalOpen(false);
      setAmount("");
      showSuccess("Баланс успішно поповнено");
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error ?? "Помилка при поповненні балансу");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (amt: number) => withdrawBalance(amt),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshAuthStatus();
      setBalanceHistory(data?.balance_history ?? []);
      setWithdrawModalOpen(false);
      setAmount("");
      showSuccess("Кошти успішно виведені");
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error ?? "Помилка при виведенні коштів");
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateAvatarFile(file);
    if (err) {
      showError(err);
      return;
    }
    const validMagic = await validateAvatarMagicBytes(file);
    if (!validMagic) {
      showError("Невірний формат файлу або файл пошкоджений");
      return;
    }
    uploadAvatarMutation.mutate(file);
  };

  const handleEmailSubmit = () => {
    const err = validateEmail(newEmail);
    if (err) {
      showError(err);
      return;
    }
    updateEmailMutation.mutate(newEmail);
  };

  const handlePasswordSubmit = () => {
    const err = validatePasswords(passwords.old, passwords.new, passwords.confirm);
    if (err) {
      showError(err);
      return;
    }
    changePasswordMutation.mutate(passwords);
  };

  const handleNotificationChange = async (
    key: keyof NotificationSettingsPatch,
    value: boolean
  ) => {
    const patch = { [key]: value };
    try {
      await updateNotificationSettings(patch);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccess("Налаштування оновлено");
    } catch (err: any) {
      showError(err?.response?.data?.error ?? "Помилка при оновленні");
    }
  };

  const handleAdultPreferencesUpdate = async (
    patch: NotificationSettingsPatch,
    localHideAdultContent?: boolean
  ) => {
    try {
      await updateNotificationSettings(patch);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (typeof localHideAdultContent === "boolean") {
        setHideAdultContent(localHideAdultContent);
      }
      showSuccess("Налаштування оновлено");
    } catch (err: any) {
      showError(err?.response?.data?.error ?? "Помилка при оновленні");
    }
  };

  const handleDeposit = () => {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      showError("Введіть коректну суму");
      return;
    }
    depositMutation.mutate(num);
  };

  const handleWithdraw = () => {
    const num = Number(amount);
    const balanceNum = profile ? parseBalance(profile.balance) : 0;
    if (!Number.isFinite(num) || num <= 0) {
      showError("Введіть коректну суму");
      return;
    }
    if (num > balanceNum) {
      showError("Недостатньо коштів");
      return;
    }
    withdrawMutation.mutate(num);
  };

  const handleTransactionHistory = () => {
    setTransactionModalOpen(true);
  };

  const handleAdultContentToggle = (nextValue: boolean) => {
    if (nextValue) {
      setAdultConfirmModalOpen(true);
      return;
    }
    void handleAdultPreferencesUpdate(
      {
        hide_adult_content: false,
        age_confirmed: true,
      },
      false
    );
  };

  const confirmHideAdultContent = () => {
    setAdultConfirmModalOpen(false);
    void handleAdultPreferencesUpdate(
      {
        hide_adult_content: true,
        age_confirmed: false,
      },
      true
    );
  };

  const cancelHideAdultContent = () => {
    setHideAdultContent(false);
    setAdultConfirmModalOpen(false);
  };

  if (!authReady) {
    return (
      <section className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.loading}>Завантаження...</div>
        </div>
      </section>
    );
  }

  const { openLoginModal } = useAuthModal();

  if (!isAuthenticated) {
    return (
      <section className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.authRequired}>
            <p>Увійдіть, щоб відкрити профіль</p>
            <button
              type="button"
              className={`${styles.linkCyan} ${styles.linkCyanBtn}`}
              onClick={() => openLoginModal("/profile")}
            >
              Увійти
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading || !profile) {
    return (
      <section className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.loading}>Завантаження профілю...</div>
        </div>
      </section>
    );
  }

  const avatarUrl = resolveAvatarUrl(
    profile.has_custom_image === false
      ? null
      : (profile.profile_image_large ?? profile.image ?? profile.profile_image_small)
  );
  const balanceNum = parseBalance(profile.balance);

  return (
    <section className={styles.page}>
      <div className={styles.wrap}>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Профіль" }]} />
        <header className={styles.header}>
          <PageTitle>ПРОФІЛЬ</PageTitle>
          <div className={styles.loginBlock}>
            <img src={crownSvg} className={styles.crown} alt="" width={61} height={40} aria-hidden="true" />
            <div className={styles.loginRow}>
              <span className={styles.loginLabel}>Логін:</span>
              <span className={styles.loginValue}>{profile.username}</span>
            </div>
          </div>
          <div className={styles.headerLine} aria-hidden="true" />
        </header>

        <div className={styles.topGrid}>
          <aside className={styles.leftTop}>
            <div className={styles.avatarCard}>
              <div className={styles.avatarOrbit} aria-hidden="true" />
              <div className={styles.avatarFrame}>
                <img
                  className={styles.avatarImg}
                  src={avatarUrl}
                  alt="Фото профілю"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </aside>

          <section className={styles.rightTop}>
            <div className={styles.about}>
              <div className={styles.aboutHead}>
                <span className={styles.aboutLabel}>Про себе:</span>
              </div>
              <p className={styles.aboutText}>
                {profile.about ?? "Немає опису."}
              </p>
              <a className={styles.linkCyan} href="#edit-about">
                Змінити
              </a>
            </div>

            <div className={styles.sectionLine} aria-hidden="true" />

            <div className={styles.stats}>
              <div className={styles.statsHeaderRow}>
                <div className={styles.statsHeaderLeft}>
                  <span className={styles.statsKey}>Тип профілю:</span>
                  <span className={styles.statsVal}>{profile.role}</span>
                </div>
                {profile.role === "Читач" && (
                  <button
                    type="button"
                    className={styles.linkCyanBtn}
                    onClick={() => becomeTranslatorMutation.mutate()}
                    disabled={becomeTranslatorMutation.isPending}
                  >
                    {becomeTranslatorMutation.isPending ? "Зміна ролі..." : "Стати перекладачем"}
                  </button>
                )}
                {profile.role === "Перекладач" && (
                  <button
                    type="button"
                    className={styles.linkCyanBtn}
                    onClick={() => becomeAuthorMutation.mutate()}
                    disabled={becomeAuthorMutation.isPending}
                  >
                    {becomeAuthorMutation.isPending ? "Зміна ролі..." : "Стати літератором"}
                  </button>
                )}
              </div>

              <div className={styles.statsRows}>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Загальна кількість перекладених символів:</span>
                  <span className={styles.statValue}>{profile.total_characters ?? 0}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Загальна кількість розділів:</span>
                  <span className={styles.statValue}>{profile.total_chapters ?? 0}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Загальна кількість безкоштовних розділів:</span>
                  <span className={styles.statValue}>{profile.free_chapters ?? 0}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Середній рейтинг перекладів:</span>
                  <span className={styles.statValue}>{profile.average_rating ?? "Н/Д"}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Кількість авторських книжок:</span>
                  <span className={styles.statValue}>{profile.total_author ?? 0}</span>
                </div>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Кількість перекладів:</span>
                  <span className={styles.statValue}>{profile.total_translations ?? 0}</span>
                </div>
              </div>
            </div>
          </section>

          <div className={styles.sectionLineFull} aria-hidden="true" />

          <div className={styles.leftButtons}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
              aria-hidden="true"
            />
            <button
              type="button"
              className={styles.btnOutlineGold}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatarMutation.isPending}
            >
              {uploadAvatarMutation.isPending ? "Завантаження..." : "Змінити фото профілю"}
            </button>
            <button
              type="button"
              className={styles.btnOutlineGold}
              onClick={handleTransactionHistory}
            >
              Історія транзакцій
            </button>
          </div>

          <div className={styles.balanceRow}>
            <div className={styles.balanceLine1}>
              <div className={styles.balanceMeta}>
                <span className={styles.mutedGold}>Комісія:</span>
                <span className={styles.cyan}>{profile.commission ?? 15}%</span>
              </div>
            </div>
            <div className={styles.balanceLine2}>
              <div className={styles.balanceMeta}>
                <span className={styles.mutedGold}>Баланс:</span>
                <span className={styles.green}>{profile.balance}</span>
              </div>
              <div className={styles.balanceActions}>
                <button
                  type="button"
                  className={styles.btnGreen}
                  onClick={() => setDepositModalOpen(true)}
                  disabled={depositMutation.isPending}
                >
                  {depositMutation.isPending ? "Завантаження..." : "Поповнити баланс"}
                </button>
                <button
                  type="button"
                  className={styles.btnRed}
                  onClick={() => setWithdrawModalOpen(true)}
                  disabled={withdrawMutation.isPending || balanceNum <= 0}
                >
                  {withdrawMutation.isPending ? "Завантаження..." : "Вивести кошти"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.bottomGrid}>
          <section className={styles.leftBottom}>
            <div className={styles.formBlock}>
              <h3 className={styles.blockTitle}>Змінити email</h3>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Новий email :</span>
                <span className={styles.fieldBox}>
                  <input
                    className={styles.input}
                    type="email"
                    placeholder={profile.email || "name@gmail.com"}
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoComplete="email"
                    disabled={updateEmailMutation.isPending}
                  />
                </span>
              </label>
              <SaveButton
                type="button"
                onClick={handleEmailSubmit}
                disabled={updateEmailMutation.isPending || !newEmail.trim()}
                loading={updateEmailMutation.isPending}
                variant="default"
              />
            </div>

            <div className={styles.formBlock}>
              <h3 className={styles.blockTitle}>Змінити пароль</h3>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Старий пароль</span>
                <span className={styles.fieldBox}>
                  <input
                    className={styles.input}
                    type={showOldPass ? "text" : "password"}
                    value={passwords.old}
                    onChange={(e) => setPasswords((p) => ({ ...p, old: e.target.value }))}
                    autoComplete="current-password"
                    disabled={changePasswordMutation.isPending}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowOldPass(!showOldPass)}
                    aria-label={showOldPass ? "Сховати пароль" : "Показати пароль"}
                  >
                    <img src={showOldPass ? includedView : turnedOffView} alt="" className={styles.eyeIcon} aria-hidden="true" />
                  </button>
                </span>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Новий пароль</span>
                <span className={styles.fieldBox}>
                  <input
                    className={styles.input}
                    type={showNewPass ? "text" : "password"}
                    value={passwords.new}
                    onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
                    autoComplete="new-password"
                    disabled={changePasswordMutation.isPending}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowNewPass(!showNewPass)}
                    aria-label={showNewPass ? "Сховати пароль" : "Показати пароль"}
                  >
                    <img src={showNewPass ? includedView : turnedOffView} alt="" className={styles.eyeIcon} aria-hidden="true" />
                  </button>
                </span>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Підтвердити пароль</span>
                <span className={styles.fieldBox}>
                  <input
                    className={styles.input}
                    type={showConfirmPass ? "text" : "password"}
                    value={passwords.confirm}
                    onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                    autoComplete="new-password"
                    disabled={changePasswordMutation.isPending}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    aria-label={showConfirmPass ? "Сховати пароль" : "Показати пароль"}
                  >
                    <img src={showConfirmPass ? includedView : turnedOffView} alt="" className={styles.eyeIcon} aria-hidden="true" />
                  </button>
                </span>
              </label>
              <SaveButton
                type="button"
                onClick={handlePasswordSubmit}
                disabled={
                  changePasswordMutation.isPending ||
                  !passwords.old ||
                  !passwords.new ||
                  !passwords.confirm
                }
                loading={changePasswordMutation.isPending}
                variant="green"
              />
            </div>
          </section>

          <section className={styles.rightBottom}>
            <div className={styles.settingsBlock}>
              <h3 className={styles.blockTitleCenter}>Налаштування акаунту</h3>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={profile.notifications_enabled ?? true}
                  onChange={(e) => handleNotificationChange("notifications_enabled", e.target.checked)}
                />
                <span>Сповіщення</span>
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={hideAdultContent}
                  onChange={(e) => handleAdultContentToggle(e.target.checked)}
                />
                <span>Прибрати 18+</span>
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={profile.private_messages_enabled ?? true}
                  onChange={(e) => handleNotificationChange("private_messages_enabled", e.target.checked)}
                />
                <span>Отримувати приватні повідомлення</span>
              </label>
              <label className={styles.checkNote}>
                <input
                  type="checkbox"
                  checked={profile.age_confirmed ?? false}
                  onChange={(e) => {
                    const nextAgeConfirmed = e.target.checked;
                    if (nextAgeConfirmed) {
                      void handleAdultPreferencesUpdate(
                        {
                          age_confirmed: true,
                          hide_adult_content: false,
                        },
                        false
                      );
                      return;
                    }
                    void handleAdultPreferencesUpdate(
                      {
                        age_confirmed: false,
                        hide_adult_content: true,
                      },
                      true
                    );
                  }}
                />
                <span>
                  Я підтверджую, що мені виповнилося 18 років, і я можу переглядати
                  контент, призначений для дорослих.
                </span>
              </label>
            </div>

            <div className={styles.settingsBlock}>
              <h3 className={styles.blockTitleCenter}>Налаштування сповіщень</h3>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={profile.comment_notifications ?? true}
                  onChange={(e) => handleNotificationChange("comment_notifications", e.target.checked)}
                />
                <span>Коментарі у ваших постах та відповіді на ваші коментарі</span>
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={profile.translation_status_notifications ?? true}
                  onChange={(e) => handleNotificationChange("translation_status_notifications", e.target.checked)}
                />
                <span>Зміна статусу перекладу</span>
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={profile.chapter_subscription_notifications ?? true}
                  onChange={(e) => handleNotificationChange("chapter_subscription_notifications", e.target.checked)}
                />
                <span>Зняття розділу з передплати</span>
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={profile.chapter_comment_notifications ?? true}
                  onChange={(e) => handleNotificationChange("chapter_comment_notifications", e.target.checked)}
                />
                <span>Коментарі до розділу</span>
              </label>
            </div>

            <div className={styles.crystal} aria-hidden="true">
              <img src={crystalProfile} alt="" className={styles.crystalImg} />
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        title="Поповнити баланс"
      >
        <div className={styles.modalForm}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Сума</span>
            <span className={styles.fieldBox}>
              <input
                className={styles.input}
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </span>
          </label>
          <button
            type="button"
            className={styles.btnGreen}
            onClick={handleDeposit}
            disabled={depositMutation.isPending || !amount}
          >
            {depositMutation.isPending ? "Завантаження..." : "Поповнити"}
          </button>
        </div>
      </Modal>

      <Modal
        open={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        title="Вивести кошти"
      >
        <div className={styles.modalForm}>
          <p className={styles.modalHint}>Доступно: {profile.balance}</p>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Сума</span>
            <span className={styles.fieldBox}>
              <input
                className={styles.input}
                type="number"
                min="1"
                max={balanceNum}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </span>
          </label>
          <button
            type="button"
            className={styles.btnRed}
            onClick={handleWithdraw}
            disabled={withdrawMutation.isPending || !amount || balanceNum <= 0}
          >
            {withdrawMutation.isPending ? "Завантаження..." : "Вивести"}
          </button>
        </div>
      </Modal>

      <Modal
        open={transactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        title="Історія транзакцій"
      >
        <div className={styles.transactionHistory}>
          {balanceHistory.length === 0 ? (
            <p>Історія порожня</p>
          ) : (
            <ul>
              {balanceHistory.map((item, i) => (
                <li key={i}>
                  {item.amount ?? ""} — {String(item.created_at ?? item.date ?? "")}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <Modal
        open={adultConfirmModalOpen}
        onClose={cancelHideAdultContent}
        title="Підтвердження 18+"
      >
        <div className={styles.modalForm}>
          <p className={styles.modalHint}>
            Ви впевнені, що хочете прибрати контент 18+ з усіх сторінок?
          </p>
          <div className={styles.balanceActions}>
            <button type="button" className={styles.btnRed} onClick={cancelHideAdultContent}>
              Скасувати
            </button>
            <button type="button" className={styles.btnGreen} onClick={confirmHideAdultContent}>
              Підтвердити
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
