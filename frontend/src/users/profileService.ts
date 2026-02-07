import { http } from "../api/http";
import { API } from "../api/endpoints";
import type {
  UserProfile,
  NotificationSettingsPatch,
  BalanceHistoryItem,
} from "./types";

/** Отримати повний профіль поточного користувача */
export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await http.get<UserProfile>(API.userProfile);
  return data;
}

/** Завантажити фото профілю */
export async function uploadProfileImage(file: File): Promise<{ image_url: string }> {
  const formData = new FormData();
  formData.append("image", file);
  const { data } = await http.post<{ image_url: string }>(
    API.profileUploadImage,
    formData
  );
  return data;
}

/** Видалити фото профілю */
export async function deleteProfileImage(): Promise<void> {
  await http.delete(API.profileDeleteImage);
}

/** Оновити email */
export async function updateEmail(newEmail: string): Promise<{ new_email: string }> {
  const { data } = await http.post<{ new_email: string }>(
    API.profileUpdateEmail,
    { new_email: newEmail }
  );
  return data;
}

/** Змінити пароль */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> {
  await http.post(API.profileChangePassword, {
    old_password: oldPassword,
    new_password: newPassword,
    confirm_password: confirmPassword,
  });
}

/** Оновити налаштування сповіщень */
export async function updateNotificationSettings(
  patch: NotificationSettingsPatch
): Promise<void> {
  await http.put(API.profileNotificationSettings, patch);
}

/** Стати перекладачем */
export async function becomeTranslator(): Promise<{ role: string; message?: string }> {
  const { data } = await http.post<{ role: string; message?: string }>(
    API.becomeTranslator
  );
  return data;
}

/** Стати літератором (автором) */
export async function becomeAuthor(): Promise<{ role: string; message?: string }> {
  const { data } = await http.post<{ role: string; message?: string }>(
    API.becomeAuthor
  );
  return data;
}

/** Поповнити баланс */
export async function depositBalance(amount: number): Promise<{
  new_balance: string;
  balance_history?: BalanceHistoryItem[];
}> {
  const { data } = await http.post(API.addBalance, { amount });
  return data;
}

/** Вивести кошти */
export async function withdrawBalance(amount: number): Promise<{
  new_balance: string;
  balance_history?: BalanceHistoryItem[];
}> {
  const { data } = await http.post(API.withdrawBalance, { amount });
  return data;
}
