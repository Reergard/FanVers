import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import styles from "./Profile.module.css";
import crownSvg from "./assets/icons/crown.svg";
import turnedOffView from "./assets/icons/turned_off_view.svg";
import includedView from "./assets/icons/included_view.svg";
import { SaveButton } from "../shared/SaveButton/SaveButton";
import crystalProfile from "./assets/icons/crysral_profile.svg";
import vectorProfile from "./assets/icons/Vector_Profile.svg";
import paymentIcon from "./assets/icons/payment.svg";
import cashWithdrawalIcon from "./assets/icons/cash_withdrawal.svg";
import historyIcon from "./assets/icons/history.svg";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import { refreshAuthStatus } from "../auth/service";
import {
  getMyProfile,
  uploadProfileImage,
  updateProfileAbout,
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
import { UserSubscriptionsSection } from "./UserSubscriptionsSection";
import type { NotificationSettingsPatch, BalanceHistoryItem } from "./types";
import backgroundsAvatarsSvgRaw from "./assets/backgrounds/backgrounds_avatars.svg?raw";

/** Strips feGaussianBlur filter from SVG — iOS Safari renders it blurry (like AvatarOrbit in header menu). */
function stripSvgFilter(svg: string): string {
  return svg
    .replace(/\s*filter="[^"]*"/g, "")
    .replace(/<defs>[\s\S]*?<\/defs>/g, "");
}

const AVATAR_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Узгоджено з бекендом `ProfileAboutUpdateSerializer` */
const PROFILE_ABOUT_MAX_LEN = 2500;
const PROFILE_ABOUT_MAX_LINES = 80;
const PLACEHOLDER_ABOUT_TEXT = "Немає опису.";

function normalizeAboutForEdit(about: string | null | undefined): string {
  if (about == null || about === "" || about === PLACEHOLDER_ABOUT_TEXT) return "";
  return about;
}

function hasDisplayableAbout(about: string | null | undefined): boolean {
  return Boolean(about && about !== PLACEHOLDER_ABOUT_TEXT);
}

/**
 * Узгоджено з бекендом: `trim_whitespace`, `max_length`, ліміт рядків як `splitlines()` після trim.
 * Розбіжність `\r` як окремого рядка теоретично можлива між JS `split(/\r\n|\r|\n/)` і Python `splitlines()` для екзотичних символів; для типового тексту збігається.
 */
function validateAboutInput(text: string): string | null {
  if (text.includes("\x00")) {
    return "Текст містить недопустимі символи.";
  }
  const t = text.trim();
  if (t.length > PROFILE_ABOUT_MAX_LEN) {
    return `Максимум ${PROFILE_ABOUT_MAX_LEN} символів після обрізки пробілів (зараз ${t.length}).`;
  }
  if (t.length > 0) {
    const lines = t.split(/\r\n|\r|\n/);
    if (lines.length > PROFILE_ABOUT_MAX_LINES) {
      return `Максимум ${PROFILE_ABOUT_MAX_LINES} рядків.`;
    }
  }
  return null;
}

function parseAboutUpdateError(err: unknown): string {
  const ax = err as {
    response?: {
      status?: number;
      data?: { error?: string; details?: Record<string, string[] | string> };
    };
  };
  const status = ax.response?.status;
  const data = ax.response?.data;
  const details = data?.details;
  if (details && typeof details === "object") {
    const aboutErr = details.about;
    if (Array.isArray(aboutErr) && aboutErr[0]) {
      const first = aboutErr[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && "string" in first) return String((first as { string: string }).string);
    }
    if (typeof aboutErr === "string") return aboutErr;
    const firstKey = Object.keys(details)[0];
    if (firstKey) {
      const v = details[firstKey];
      if (Array.isArray(v) && v[0]) return String(v[0]);
      if (typeof v === "string") return v;
    }
  }
  if (typeof data?.error === "string") return data.error;
  if (status === 401) return "Потрібна авторизація. Увійдіть знову.";
  if (status === 403) return "Немає прав на зміну профілю.";
  if (status === 404) return "Профіль не знайдено.";
  if (status === 429) return "Забагато запитів. Спробуйте пізніше.";
  return "Не вдалося зберегти текст. Спробуйте ще раз.";
}

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
    const isJpeg =
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
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
  const { openLoginModal } = useAuthModal();
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
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [aboutDraft, setAboutDraft] = useState("");
  const [amount, setAmount] = useState("");
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryItem[]>([]);
  const { hideAdultContent, setHideAdultContent } = useAdultContent();

  const avatarBgSvgClean = useMemo(() => stripSvgFilter(backgroundsAvatarsSvgRaw), []);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getMyProfile,
    enabled: isAuthenticated,
    // Після зміни ролі/балансу в адмінці — оновлення при поверненні на вкладку
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const profile = profileQuery.data;
  const isLoading = profileQuery.isLoading;

  useEffect(() => {
    if (profile?.hide_adult_content == null) return;
    setHideAdultContent(Boolean(profile.hide_adult_content));
  }, [profile?.hide_adult_content, setHideAdultContent]);

  const updateAboutMutation = useMutation({
    mutationFn: (about: string) => updateProfileAbout(about),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setAboutModalOpen(false);
      showSuccess("Блок «Про себе» успішно збережено");
    },
    onError: (err: unknown) => {
      showError(parseAboutUpdateError(err));
    },
  });

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
    onSuccess: () => {
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
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshAuthStatus();
      showSuccess(data?.message ?? "Роль оновлено");
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error ?? "Помилка при зміні ролі");
    },
  });

  const becomeAuthorMutation = useMutation({
    mutationFn: becomeAuthor,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      await refreshAuthStatus();
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

  const openAboutModal = useCallback(() => {
    setAboutDraft(normalizeAboutForEdit(profile?.about));
    setAboutModalOpen(true);
  }, [profile?.about]);

  const closeAboutModal = useCallback(() => {
    if (updateAboutMutation.isPending) return;
    setAboutModalOpen(false);
  }, [updateAboutMutation.isPending]);

  const aboutTrimmed = aboutDraft.trim();
  const aboutClientError = validateAboutInput(aboutDraft);
  const aboutUnchanged =
    profile != null && normalizeAboutForEdit(profile.about) === aboutTrimmed;
  const canSaveAbout =
    aboutClientError == null && !updateAboutMutation.isPending && !aboutUnchanged;

  const handleSaveAbout = useCallback(() => {
    const err = validateAboutInput(aboutDraft);
    if (err) {
      showError(err);
      return;
    }
    const next = aboutDraft.trim();
    if (profile != null && normalizeAboutForEdit(profile.about) === next) {
      return;
    }
    updateAboutMutation.mutate(next);
  }, [aboutDraft, profile, showError, updateAboutMutation]);

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
  const mayWithdrawBalance = profile.can_withdraw_balance === true;

  const renderProfileTypeRow = () => (
    <div className={styles.profileTypeRow}>
      <span className={styles.profileTypeLabel}>Тип профілю:</span>
      <span className={styles.profileTypeActive}>{profile.role}</span>

      {profile.role === "Читач" && (
        <button
          type="button"
          className={`${styles.linkCyanBtn} ${styles.profileTypeRoleBtn}`}
          style={{ backgroundImage: `url(${vectorProfile})` }}
          onClick={() => becomeTranslatorMutation.mutate()}
          disabled={
            becomeTranslatorMutation.isPending || becomeAuthorMutation.isPending
          }
        >
          {becomeTranslatorMutation.isPending ? "Зміна ролі..." : "Стати перекладачем"}
        </button>
      )}
      {(profile.role === "Читач" || profile.role === "Перекладач") && (
        <button
          type="button"
          className={`${styles.linkCyanBtn} ${styles.profileTypeRoleBtn}`}
          style={{ backgroundImage: `url(${vectorProfile})` }}
          onClick={() => becomeAuthorMutation.mutate()}
          disabled={
            becomeAuthorMutation.isPending ||
            (profile.role === "Читач" && becomeTranslatorMutation.isPending)
          }
        >
          {becomeAuthorMutation.isPending ? "Зміна ролі..." : "Стати літератором"}
        </button>
      )}
    </div>
  );

  return (
    <section className={styles.page}>
      <div className={styles.wrap}>
        <Breadcrumb items={[{ label: "Головна", to: "/" }, { label: "Профіль" }]} />
        <PageTitle>ПРОФІЛЬ</PageTitle>

        {/* Row 1: Login — full width, separate from main grid */}
        <header className={styles.row1Header}>
          <div className={styles.loginBlock}>
            <img src={crownSvg} className={styles.crown} alt="" width={61} height={40} aria-hidden="true" />
            <div className={styles.loginRow}>
              <span className={styles.loginLabel}>Логін:</span>
              <span className={styles.loginValue}>{profile.username}</span>
            </div>
          </div>
          <div className={styles.headerLine} aria-hidden="true" />
        </header>

        {/* Row 2 & 3: Main upper block — единая сетка 2×3 с замкнутыми линиями */}
        <div className={styles.upperBlock}>
          <aside className={styles.colPhoto}>
            <div className={styles.avatarWithBtnWrap}>
              <div className={styles.avatarCard}>
                <div className={styles.avatarOrbit} aria-hidden="true" />
                <span
                  className={styles.avatarBgSvg}
                  dangerouslySetInnerHTML={{ __html: avatarBgSvgClean }}
                  aria-hidden
                />
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
                className={`${styles.btnOutlineGold} ${styles.btnPhotoChange}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadAvatarMutation.isPending}
              >
              <span className={styles.btnTextDesktop}>
                {uploadAvatarMutation.isPending ? "Завантаження..." : "Змінити фото профілю"}
              </span>
              <svg className={styles.iconPhotoChange} viewBox="0 0 21 21" aria-hidden="true">
                <use href="#photo-change" />
              </svg>
            </button>
            </div>
          </aside>

          <section className={styles.colAbout} id="edit-about">
            <div className={styles.aboutHeaderRow}>
              <h3 className={styles.aboutLabel}>Про себе:</h3>
              <button
                type="button"
                className={`${styles.btnOutlineGold} ${styles.btnPhotoChange} ${styles.btnEditAbout}`}
                onClick={openAboutModal}
                aria-haspopup="dialog"
                aria-label="Редагувати блок «Про себе»"
              >
                <span className={styles.btnTextDesktop}>Змінити</span>
                <svg className={styles.iconPhotoChange} viewBox="0 0 22 22" aria-hidden="true">
                  <use href="#pencil" />
                </svg>
              </button>
            </div>
            <div className={styles.aboutBlock}>
              <div className={styles.aboutNotebookLines} aria-hidden="true" />
              {hasDisplayableAbout(profile.about) ? (
                <p className={styles.aboutText}>{profile.about}</p>
              ) : null}
            </div>
            <div className={`${styles.profileTypeSection} ${styles.profileTypeSectionDesktop}`}>
              {renderProfileTypeRow()}
            </div>
          </section>

          <div className={`${styles.profileTypeSection} ${styles.profileTypeSectionMobile}`}>
            {renderProfileTypeRow()}
          </div>

          <section className={styles.colStats}>
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
          </section>

          <div className={styles.colEmailCurrent}>
            <h3 className={styles.sectionTitle}>Змінити email:</h3>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Поточний email :</span>
              <span className={`${styles.fieldBox} ${styles.fieldBoxEmailCurrent}`}>
                <input
                  className={styles.input}
                  type="text"
                  value={profile.email || ""}
                  readOnly
                  aria-readonly="true"
                />
              </span>
            </label>
          </div>

          <div className={styles.colEmailNew}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Новий email :</span>
              <span className={styles.fieldBox}>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="name@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  autoComplete="email"
                  disabled={updateEmailMutation.isPending}
                />
              </span>
            </label>
            <div className={styles.saveButtonWrap}>
              <SaveButton
                type="button"
                onClick={handleEmailSubmit}
                disabled={updateEmailMutation.isPending || !newEmail.trim()}
                loading={updateEmailMutation.isPending}
                variant="default"
              />
            </div>
          </div>

          <div className={styles.colBalance}>
              <div className={styles.balanceRow}>
                <div className={styles.balanceInfo} data-mobile-area="commission">
                  <span className={styles.mutedGold}>Комісія з транзакцій:</span>
                  <span className={styles.balanceCommissionValue}>{profile.commission ?? 15}%</span>
                </div>
                {mayWithdrawBalance ? (
                  <button
                    type="button"
                    className={`${styles.btnRed} ${styles.balanceBtnWithdraw}`}
                    onClick={() => setWithdrawModalOpen(true)}
                    disabled={withdrawMutation.isPending || balanceNum <= 0}
                  >
                    <img src={cashWithdrawalIcon} alt="" className={styles.btnBalanceIcon} aria-hidden="true" />
                    <span className={styles.btnBalanceText}>
                      {withdrawMutation.isPending ? "Завантаження..." : <>Запросити<br />виплату</>}
                    </span>
                  </button>
                ) : null}
              </div>
              <div className={styles.balanceRow}>
                <div className={styles.balanceInfo} data-mobile-area="balance">
                  <span className={styles.mutedGold}>Баланс:</span>
                  <span className={styles.balanceCommissionValue}>{profile.balance}</span>
                </div>
                <button
                  type="button"
                  className={`${styles.btnGreen} ${styles.balanceBtnDeposit}`}
                  onClick={() => setDepositModalOpen(true)}
                  disabled={depositMutation.isPending}
                >
                  <img src={paymentIcon} alt="" className={styles.btnBalanceIcon} aria-hidden="true" />
                  <span className={styles.btnBalanceText}>
                    {depositMutation.isPending ? "Завантаження..." : <>Купити<br />coins</>}
                  </span>
                </button>
              </div>
              <button
                type="button"
                className={`${styles.btnOutlineGold} ${styles.balanceHistoryBtn}`}
                onClick={handleTransactionHistory}
              >
                <img src={historyIcon} alt="" className={styles.btnBalanceIcon} aria-hidden="true" />
                <span className={styles.historyBtnTextDesktop}>Історія транзакцій</span>
                <span className={styles.historyBtnTextMobile}>Історія<br />транзакцій</span>
              </button>
          </div>
        </div>

        <div className={styles.lowerSections}>
          {/* Row 6: Bottom zone — account settings | notification settings + crystal */}
          <div className={styles.row6Grid}>
          <section className={styles.colAccountSettings}>
            <h3 className={styles.sectionTitle}>Налаштування акаунту:</h3>
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
          </section>

          <section className={styles.colUserSubscriptions}>
            <UserSubscriptionsSection />
          </section>

          <section className={styles.colNotificationSettings}>
            <h3 className={styles.sectionTitle}>Налаштування сповіщень:</h3>
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
              <span>Поява/припинення абонементів в книгах</span>
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={profile.chapter_comment_notifications ?? true}
                onChange={(e) => handleNotificationChange("chapter_comment_notifications", e.target.checked)}
              />
              <span>Коментарі до розділу</span>
            </label>
            <div className={styles.crystal} aria-hidden="true">
              <img src={crystalProfile} alt="" className={styles.crystalImg} />
            </div>
          </section>
        </div>

          {/* Password block */}
          <section className={styles.row5Password}>
            <h3 className={styles.sectionTitle}>Змінити пароль:</h3>
            <div className={styles.passwordFields}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Старий пароль :</span>
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
                    <img src={showOldPass ? turnedOffView : includedView} alt="" className={styles.eyeIcon} aria-hidden="true" />
                  </button>
                </span>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Новий пароль :</span>
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
                    <img src={showNewPass ? turnedOffView : includedView} alt="" className={styles.eyeIcon} aria-hidden="true" />
                  </button>
                </span>
              </label>
              <div className={styles.passwordConfirmWithSave}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Підтвердити пароль :</span>
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
                      <img src={showConfirmPass ? turnedOffView : includedView} alt="" className={styles.eyeIcon} aria-hidden="true" />
                    </button>
                  </span>
                </label>
                <div className={styles.saveButtonWrap}>
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
                    variant="default"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={aboutModalOpen}
        onClose={closeAboutModal}
        title="Редагувати «Про себе»"
      >
        <div className={styles.modalForm}>
          <p className={styles.modalHint}>
            Короткий текст про вас бачитимуть інші користувачі там, де відображається ваш профіль. Можна залишити поле
            порожнім — тоді на сторінці залишаться лише лінії-намітки.
          </p>
          <label className={styles.field} htmlFor="profile-about-modal-text">
            <span className={styles.fieldLabel}>Текст</span>
            <textarea
              id="profile-about-modal-text"
              className={styles.aboutModalTextarea}
              value={aboutDraft}
              onChange={(e) => setAboutDraft(e.target.value)}
              maxLength={PROFILE_ABOUT_MAX_LEN}
              disabled={updateAboutMutation.isPending}
              rows={6}
              spellCheck
              autoComplete="off"
              aria-invalid={aboutClientError != null}
              aria-describedby="profile-about-modal-meta"
            />
          </label>
          <div id="profile-about-modal-meta" className={styles.aboutModalMeta}>
            <span className={aboutClientError ? styles.aboutModalMetaError : undefined}>
              {aboutClientError ?? `${PROFILE_ABOUT_MAX_LINES} рядків максимум`}
            </span>
            <span aria-live="polite">
              {aboutDraft.length} / {PROFILE_ABOUT_MAX_LEN}
            </span>
          </div>
          <div className={styles.aboutModalActions}>
            <button
              type="button"
              className={styles.btnRed}
              onClick={closeAboutModal}
              disabled={updateAboutMutation.isPending}
            >
              Скасувати
            </button>
            <div className={styles.saveButtonWrap}>
              <SaveButton
                type="button"
                onClick={handleSaveAbout}
                disabled={!canSaveAbout}
                loading={updateAboutMutation.isPending}
                variant="green"
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        title="Купити coins"
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
            {depositMutation.isPending ? "Завантаження..." : "Купити coins"}
          </button>
        </div>
      </Modal>

      <Modal
        open={withdrawModalOpen && mayWithdrawBalance}
        onClose={() => setWithdrawModalOpen(false)}
        title="Запросити виплату"
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
            {withdrawMutation.isPending ? "Завантаження..." : "Запросити виплату"}
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
                  {item.amount ?? ""}{" "}
                  {item.operation_type ?? item.type ?? ""} —{" "}
                  {String(item.created_at ?? item.date ?? "")}
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
