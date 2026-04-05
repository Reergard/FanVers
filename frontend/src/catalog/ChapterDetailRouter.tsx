import { useCallback, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { catalogApi, catalogKeys } from "../api/catalogApi";
import { getSubscriptionSettings, purchaseChapter } from "../api/subscriptionApi";
import { subscriptionKeys } from "../api/subscriptionApi";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import { Modal } from "../shared/Modal/Modal";
import { Container } from "../shared/Container";
import { Breadcrumb } from "../navigation/Breadcrumb";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import ChapterDetail from "./ChapterDetail";

const STALE_TIME = 2 * 60_000;

/** 403 при навігації: потрібна покупка або вхід */
type ForbiddenPurchaseTarget = {
  chapterId: number;
  targetChapterSlug: string;
  errorText: string;
};

export default function ChapterDetailRouter() {
  const { bookSlug = "", chapterSlug = "" } = useParams<{
    bookSlug: string;
    chapterSlug: string;
  }>();
  const location = useLocation();
  const { isAuthenticated, userId, authReady } = useAuth();
  const { openLoginModal } = useAuthModal();
  const { showSuccess, showError } = useNotification();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [forbiddenPurchase, setForbiddenPurchase] = useState<ForbiddenPurchaseTarget | null>(null);
  const [forbiddenAccessError, setForbiddenAccessError] = useState<string | null>(null);

  const purchaseMutation = useMutation({
    mutationFn: ({
      chapterId,
      useBalance,
    }: {
      chapterId: number;
      targetChapterSlug: string;
      useBalance?: boolean;
    }) => purchaseChapter(chapterId, undefined, useBalance),
    onSuccess: (_data, { targetChapterSlug }) => {
      qc.invalidateQueries({ queryKey: catalogKeys.chapterDetail(bookSlug, chapterSlug) });
      qc.invalidateQueries({ queryKey: catalogKeys.chapters(bookSlug) });
      qc.invalidateQueries({ queryKey: subscriptionKeys.settings(bookSlug) });
      qc.invalidateQueries({ queryKey: subscriptionKeys.userSubscriptions() });
      showSuccess("Розділ придбано");
      setForbiddenPurchase(null);
      if (targetChapterSlug) {
        navigate(`/books/${bookSlug}/chapters/${targetChapterSlug}`);
      }
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof AxiosError &&
        err.response?.data &&
        typeof err.response.data === "object" &&
        "error" in (err.response.data as object)
          ? String((err.response.data as { error?: string }).error)
          : err instanceof Error
            ? err.message
            : "Помилка покупки";
      showError(msg);
    },
  });

  const chapterQ = useQuery({
    queryKey: catalogKeys.chapterDetail(bookSlug, chapterSlug),
    queryFn: () => catalogApi.getChapterDetail(bookSlug, chapterSlug),
    enabled: Boolean(bookSlug) && Boolean(chapterSlug) && authReady,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const navigationQ = useQuery({
    queryKey: catalogKeys.chapterNavigation(bookSlug, chapterSlug),
    queryFn: () => catalogApi.getChapterNavigation(bookSlug, chapterSlug),
    enabled: Boolean(bookSlug) && Boolean(chapterSlug) && !chapterQ.isError && authReady,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const is403RequiresPurchase =
    chapterQ.isError &&
    (chapterQ.error as AxiosError<{ requires_purchase?: boolean }>)?.response?.status === 403 &&
    (chapterQ.error as AxiosError<{ requires_purchase?: boolean }>)?.response?.data?.requires_purchase === true;

  const subSettingsQ = useQuery({
    queryKey: subscriptionKeys.settings(bookSlug),
    queryFn: () => getSubscriptionSettings(bookSlug),
    enabled:
      Boolean(bookSlug) &&
      isAuthenticated &&
      (forbiddenPurchase != null || is403RequiresPurchase),
    staleTime: STALE_TIME,
  });

  const handleNavigateToChapter = useCallback(
    async (targetChapterSlug: string) => {
      try {
        await qc.fetchQuery({
          queryKey: catalogKeys.chapterDetail(bookSlug, targetChapterSlug),
          queryFn: () => catalogApi.getChapterDetail(bookSlug, targetChapterSlug),
          staleTime: STALE_TIME,
        });
        navigate(`/books/${bookSlug}/chapters/${targetChapterSlug}`);
      } catch (error) {
        const err = error as AxiosError<{
          error?: string;
          detail?: string;
          chapter_id?: number;
          requires_purchase?: boolean;
        }>;
        const data = err.response?.data;
        if (err.response?.status === 403) {
          const chapterId = data?.chapter_id ?? 0;
          const requiresPurchase = data?.requires_purchase === true;
          const errorText =
            data?.error ?? data?.detail ?? "Доступ заборонено";
          if (requiresPurchase && chapterId > 0) {
            setForbiddenPurchase({ chapterId, targetChapterSlug, errorText });
          } else {
            setForbiddenAccessError(errorText);
          }
        }
      }
    },
    [bookSlug, navigate, qc]
  );

  if (!authReady || chapterQ.isLoading) {
    return <div>Завантаження розділу...</div>;
  }

  if (chapterQ.isError) {
    const err = chapterQ.error as AxiosError<{ error?: string; detail?: string; chapter_id?: number; requires_purchase?: boolean }>;
    const status = err.response?.status;
    const errorData = err.response?.data;
    const errorText = errorData?.error ?? errorData?.detail;
    const chapterId = errorData?.chapter_id;
    const requiresPurchase = errorData?.requires_purchase === true;

    if (status === 404) return <div>Розділ не знайдено</div>;
    if (status === 401 && !isAuthenticated) {
      return (
        <Container>
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p style={{ marginBottom: "1rem" }}>{errorText ?? "Увійдіть для перегляду"}</p>
            <ActionButton variant="primary" onClick={() => openLoginModal(location.pathname)}>
              Увійти
            </ActionButton>
          </div>
        </Container>
      );
    }
    if (status === 403) {
      if (requiresPurchase && chapterId && isAuthenticated) {
        const subData = subSettingsQ.data as {
          active_subscription?: { remaining_chapters_count?: number };
        } | undefined;
        const hasPack =
          !!subData?.active_subscription &&
          (subData.active_subscription.remaining_chapters_count ?? 0) > 0;

        return (
          <Container>
            <Breadcrumb
              items={[
                { label: "Головна", to: "/" },
                { label: "Книга", to: `/books/${bookSlug}` },
                { label: "Розділ" },
              ]}
            />
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ marginBottom: "1rem" }}>
                {errorText ?? "Необхідно придбати главу для перегляду"}
              </p>
              <p style={{ marginBottom: "1.5rem", opacity: 0.9 }}>
                {subSettingsQ.isLoading || subSettingsQ.isFetching
                  ? "Завантаження варіантів покупки…"
                  : hasPack
                    ? "Оберіть, як придбати розділ: використати слот пакета або купити за баланс."
                    : "Натисніть «Купити», щоб придбати главу за баланс."}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 280, margin: "0 auto" }}>
                {(subSettingsQ.isLoading || subSettingsQ.isFetching) ? (
                  <span style={{ opacity: 0.8 }}>Завантаження…</span>
                ) : hasPack ? (
                  <>
                    <ActionButton
                      variant="primary"
                      onClick={() =>
                        purchaseMutation.mutate({
                          chapterId,
                          targetChapterSlug: "",
                          useBalance: false,
                        })
                      }
                      loading={purchaseMutation.isPending}
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending ? "Покупка…" : "Використати слот пакета"}
                    </ActionButton>
                    <ActionButton
                      variant="outline"
                      onClick={() =>
                        purchaseMutation.mutate({
                          chapterId,
                          targetChapterSlug: "",
                          useBalance: true,
                        })
                      }
                      loading={purchaseMutation.isPending}
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending ? "Покупка…" : "Купити за баланс"}
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton
                    variant="primary"
                    onClick={() =>
                      purchaseMutation.mutate({
                        chapterId,
                        targetChapterSlug: "",
                        useBalance: true,
                      })
                    }
                    loading={purchaseMutation.isPending}
                    disabled={purchaseMutation.isPending}
                  >
                    {purchaseMutation.isPending ? "Покупка…" : "Купити за баланс"}
                  </ActionButton>
                )}
              </div>
            </div>
          </Container>
        );
      }
      if (!isAuthenticated) {
        return (
          <Container>
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ marginBottom: "1rem" }}>{errorText ?? "Доступ заборонено"}</p>
              <ActionButton variant="primary" onClick={() => openLoginModal(location.pathname)}>
                Увійти
              </ActionButton>
            </div>
          </Container>
        );
      }
      return <div>{errorText ?? "Доступ до розділу заборонено"}</div>;
    }
    return <div>Помилка завантаження розділу</div>;
  }

  const chapter = chapterQ.data;
  if (!chapter) return <div>Розділ не знайдено</div>;

  const navigation = navigationQ.data;
  const activeSub = (subSettingsQ.data as { active_subscription?: { remaining_chapters_count?: number } })?.active_subscription;
  const hasActivePack =
    !!activeSub && (activeSub.remaining_chapters_count ?? 0) > 0;
  const resolvedBookSlug = chapter.book_slug || bookSlug;
  const isOwner =
    isAuthenticated &&
    userId != null &&
    chapter.book_owner_id != null &&
    chapter.book_owner_id === userId;

  return (
    <>
      <Container>
        <Breadcrumb
          items={[
            { label: "Головна", to: "/" },
            { label: chapter.book_title || "Книга", to: `/books/${resolvedBookSlug}` },
            { label: chapter.title },
          ]}
        />
      </Container>
      <ChapterDetail
        bookSlug={resolvedBookSlug}
        chapterSlug={chapter.slug || chapterSlug}
        chapterTitle={chapter.title}
        chapterContentHtml={chapter.content}
        prevChapterSlug={navigation?.prev_chapter?.slug ?? null}
        nextChapterSlug={navigation?.next_chapter?.slug ?? null}
        isOwner={isOwner}
        onNavigateToChapter={handleNavigateToChapter}
        chapterMeta={{
          id: chapter.id,
          book_id: chapter.book_id,
          book_title: chapter.book_title,
          title: chapter.title,
        }}
      />
      <Modal
        open={forbiddenAccessError != null}
        onClose={() => setForbiddenAccessError(null)}
        title="Доступ заборонено"
      >
        {forbiddenAccessError && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p>{forbiddenAccessError}</p>
            <ActionButton variant="outline" onClick={() => setForbiddenAccessError(null)}>
              Закрити
            </ActionButton>
          </div>
        )}
      </Modal>
      <Modal
        open={forbiddenPurchase != null}
        onClose={() => setForbiddenPurchase(null)}
        title="Потрібна покупка"
      >
        {forbiddenPurchase && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p>{forbiddenPurchase.errorText}</p>
            <p style={{ opacity: 0.9, fontSize: "0.95em" }}>
              {subSettingsQ.isLoading || subSettingsQ.isFetching
                ? "Завантаження варіантів покупки…"
                : hasActivePack
                  ? "Оберіть: використати слот пакета або купити за баланс."
                  : "Натисніть «Купити», щоб придбати розділ за баланс."}
            </p>
            {isAuthenticated && forbiddenPurchase.chapterId > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {(subSettingsQ.isLoading || subSettingsQ.isFetching) ? (
                  <span style={{ opacity: 0.8 }}>Завантаження…</span>
                ) : hasActivePack ? (
                  <>
                    <ActionButton
                      variant="primary"
                      onClick={() =>
                        purchaseMutation.mutate({
                          chapterId: forbiddenPurchase.chapterId,
                          targetChapterSlug: forbiddenPurchase.targetChapterSlug,
                          useBalance: false,
                        })
                      }
                      loading={purchaseMutation.isPending}
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending ? "Покупка…" : "Використати слот пакета"}
                    </ActionButton>
                    <ActionButton
                      variant="outline"
                      onClick={() =>
                        purchaseMutation.mutate({
                          chapterId: forbiddenPurchase.chapterId,
                          targetChapterSlug: forbiddenPurchase.targetChapterSlug,
                          useBalance: true,
                        })
                      }
                      loading={purchaseMutation.isPending}
                      disabled={purchaseMutation.isPending}
                    >
                      {purchaseMutation.isPending ? "Покупка…" : "Купити за баланс"}
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton
                    variant="primary"
                    onClick={() =>
                      purchaseMutation.mutate({
                        chapterId: forbiddenPurchase.chapterId,
                        targetChapterSlug: forbiddenPurchase.targetChapterSlug,
                        useBalance: true,
                      })
                    }
                    loading={purchaseMutation.isPending}
                    disabled={purchaseMutation.isPending}
                  >
                    {purchaseMutation.isPending ? "Покупка…" : "Купити за баланс"}
                  </ActionButton>
                )}
              </div>
            ) : !isAuthenticated ? (
              <ActionButton
                variant="primary"
                onClick={() => {
                  setForbiddenPurchase(null);
                  openLoginModal(location.pathname);
                }}
              >
                Увійти
              </ActionButton>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}
