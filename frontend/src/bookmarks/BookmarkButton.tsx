import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { useAuthModal } from "../auth/AuthModalContext";
import { useNotification } from "../shared/NotificationModal/NotificationProvider";
import { ActionButton } from "../shared/ActionButton/ActionButton";
import {
  getBookmarkStatus,
  addBookmark,
  updateBookmark,
} from "./api";
import { bookmarkKeys } from "./keys";
import { monitoringKeys } from "../api/monitoringKeys";
import type { BookmarkStatus } from "./types";
import styles from "./BookmarkButton.module.css";

const STATUS_LABELS: Record<BookmarkStatus, string> = {
  reading: "Читаю",
  dropped: "Кинув читати",
  planned: "В планах",
  completed: "Прочитав",
};

type Props = {
  bookId: number;
};

export function BookmarkButton({ bookId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const location = useLocation();
  const { openLoginModal } = useAuthModal();
  const { isAuthenticated, authReady } = useAuth();
  const { showError } = useNotification();

  const { data: bookmarkData, isLoading, error: queryError, refetch } = useQuery({
    queryKey: bookmarkKeys.status(bookId),
    queryFn: () => getBookmarkStatus(bookId),
    enabled: !!bookId && isAuthenticated && authReady,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: (newStatus: BookmarkStatus) => addBookmark(bookId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.status(bookId) });
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "user-bookmarks",
      });
      queryClient.invalidateQueries({ queryKey: monitoringKeys.readingStats() });
    },
    onError: () => {
      showError("Не вдалося додати закладку");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      bookmarkId,
      status,
    }: {
      bookmarkId: number;
      status: BookmarkStatus;
    }) => updateBookmark(bookmarkId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookmarkKeys.status(bookId) });
      queryClient.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "user-bookmarks",
      });
      queryClient.invalidateQueries({ queryKey: monitoringKeys.readingStats() });
    },
    onError: () => {
      showError("Не вдалося оновити закладку");
    },
  });

  // Закрити dropdown при кліку поза ним
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleStatusChange = (newStatus: BookmarkStatus) => {
    if (!isAuthenticated) {
      openLoginModal(location.pathname);
      return;
    }
    if (!authReady) return;
    if (bookmarkData?.id != null) {
      updateMutation.mutate({ bookmarkId: bookmarkData.id, status: newStatus });
    } else {
      addMutation.mutate(newStatus);
    }
    setIsOpen(false);
  };

  const handleButtonClick = () => {
    if (!isAuthenticated) {
      openLoginModal(location.pathname);
      return;
    }
    if (!authReady) return;
    setIsOpen(!isOpen);
  };

  const isPending = addMutation.isPending || updateMutation.isPending;
  const currentLabel =
    bookmarkData?.status != null
      ? STATUS_LABELS[bookmarkData.status]
      : "В закладки";

  if (isLoading && isAuthenticated) {
    return (
      <ActionButton variant="primary" loading disabled>
        Завантаження…
      </ActionButton>
    );
  }

  if (queryError && isAuthenticated) {
    return (
      <ActionButton
        variant="primary"
        onClick={() => refetch()}
      >
        Помилка — натисніть для повтору
      </ActionButton>
    );
  }

  const isDisabled = isPending || (isAuthenticated && !authReady);

  return (
    <div className={styles.container} ref={dropdownRef}>
      <ActionButton
        variant="primary"
        onClick={handleButtonClick}
        loading={isPending}
        disabled={isDisabled}
        ariaLabel={`Закладки: ${currentLabel}`}
      >
        {currentLabel}
      </ActionButton>

      {isOpen && (
        <div
          className={styles.dropdown}
          role="listbox"
          aria-label="Оберіть статус закладки"
        >
          {(Object.entries(STATUS_LABELS) as [BookmarkStatus, string][]).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={bookmarkData?.status === value}
                className={bookmarkData?.status === value ? styles.active : ""}
                onClick={() => handleStatusChange(value)}
              >
                {label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
