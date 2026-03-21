import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getUserSubscriptions, subscriptionKeys, type UserBookSubscription } from "../api/subscriptionApi";
import styles from "./UserSubscriptionsSection.module.css";

type Tab = "active" | "history";

export function UserSubscriptionsSection() {
  const [tab, setTab] = useState<Tab>("active");

  const { data, isLoading } = useQuery({
    queryKey: subscriptionKeys.userSubscriptions(),
    queryFn: getUserSubscriptions,
  });

  const active = data?.active ?? [];
  const history = data?.history ?? [];

  if (isLoading) {
    return (
      <section className={styles.section} aria-label="Мої підписки">
        <p className={styles.loading}>Завантаження…</p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-label="Мої підписки">
      <h3 className={styles.title}>Мої підписки</h3>

      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === "active" ? styles.tabActive : ""}
          onClick={() => setTab("active")}
        >
          Активні
        </button>
        <button
          type="button"
          className={tab === "history" ? styles.tabActive : ""}
          onClick={() => setTab("history")}
        >
          Історія
        </button>
      </div>

      {tab === "active" && (
        <ul className={styles.list}>
          {active.length === 0 ? (
            <li className={styles.empty}>Немає активних пакетів</li>
          ) : (
            active.map((s) => (
              <li key={s.id}>
                <SubscriptionItem sub={s} />
              </li>
            ))
          )}
        </ul>
      )}

      {tab === "history" && (
        <ul className={styles.list}>
          {history.length === 0 ? (
            <li className={styles.empty}>Історія порожня</li>
          ) : (
            history.slice(0, 20).map((s) => (
              <li key={s.id}>
                <SubscriptionItem sub={s} isHistory />
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}

function SubscriptionItem({
  sub,
  isHistory = false,
}: {
  sub: UserBookSubscription;
  isHistory?: boolean;
}) {
  return (
    <div className={styles.item}>
      <Link to={`/books/${sub.book_slug}`} className={styles.bookLink}>
        {sub.book_title}
      </Link>
      <span className={styles.itemMeta}>
        {isHistory ? (
          <>
            {sub.status} — {sub.price_paid} FC
          </>
        ) : (
          <>
            {sub.remaining_chapters_count}/{sub.plan_chapters_count} розділів — {sub.price_paid} FC
          </>
        )}
      </span>
    </div>
  );
}
