import { useState } from "react";
import styles from "./NotificationsPage.module.css";
import { Container } from "../shared/Container";
import { SaveButton } from "../shared/SaveButton/SaveButton";
import { FilterCheckbox } from "../shared/FilterCheckbox/FilterCheckbox";

type MessageItem = {
  id: string;
  title: string;
  text: string;
  isRead: boolean;
};

const MOCK_MESSAGES: MessageItem[] = [
  {
    id: "1",
    title: "Повідомлення 1",
    text:
      "Вітання. Добро пожалувати в систему перекладів «UA Translate». Цей сайт призначений для професійних мов любительських перекладів будь-яких новелів, фанфіків, ранобе з різних мов.",
    isRead: false,
  },
  {
    id: "2",
    title: "Повідомлення 2",
    text:
      "Вітання. Добро пожалувати в систему перекладів «UA Translate». Цей сайт призначений для професійних мов любительських перекладів будь-яких новелів, фанфіків, ранобе з різних мов.",
    isRead: false,
  },
  {
    id: "3",
    title: "Повідомлення 3",
    text:
      "Вітання. Добро пожалувати в систему перекладів «UA Translate». Цей сайт призначений для професійних мов любительських перекладів будь-яких новелів, фанфіків, ранобе з різних мов.",
    isRead: true,
  },
  {
    id: "4",
    title: "Повідомлення 4",
    text:
      "Вітання. Добро пожалувати в систему перекладів «UA Translate». Цей сайт призначений для професійних мов любительських перекладів будь-яких новелів, фанфіків, ранобе з різних мов.",
    isRead: true,
  },
];

const FILTERS = [
  "Помилка у тексті",
  "Передача перекладу іншому",
  "Отримання перекладу від іншого",
  "Зміна статусу замовлення реклами у соцмережах",
  "Вихід нових розділів",
  "Новий розділ у перекладі",
  "Зміна статусу перекладу",
  "Зняття розділу з передплати",
  "Коментар до глави",
  "Коментар до книги",
];

function pluralize(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "повідомлення";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "повідомлення";
  return "повідомлень";
}

export function NotificationsPage() {
  const total = MOCK_MESSAGES.length;
  const [filters, setFilters] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    FILTERS.forEach((label) => {
      initial[label] = label === "Отримання перекладу від іншого";
    });
    return initial;
  });

  const handleFilterChange = (label: string, checked: boolean) => {
    setFilters((prev) => ({ ...prev, [label]: checked }));
  };

  const handleSaveFilters = () => {
    // TODO: API call
  };

  return (
    <section className={styles.page}>
      <Container>
        <header className={styles.header}>
          <h1 className={styles.title}>Повідомлення</h1>

          <div className={styles.headerMid}>
            <span className={styles.count}>
              Показано {total} {pluralize(total)}
            </span>
            <span className={styles.topLine} aria-hidden="true" />
          </div>
        </header>

        <div className={styles.layout}>
          {/* LEFT: filters card */}
          <aside className={styles.sidebar} aria-label="Фільтри повідомлень">
            <div className={styles.frame} aria-hidden="true" />
            <div className={styles.sidebarInner}>
              <h2 className={styles.sidebarTitle}>ПОВІДОМЛЕННЯ</h2>

              <form className={styles.filters} onSubmit={(e) => e.preventDefault()}>
                {FILTERS.map((label, idx) => {
                  const id = `msg-filter-${idx}`;
                  return (
                    <FilterCheckbox
                      key={id}
                      id={id}
                      label={label}
                      checked={filters[label] ?? false}
                      onChange={(checked) => handleFilterChange(label, checked)}
                    />
                  );
                })}

                <div className={styles.sidebarActions}>
                  <SaveButton
                    type="button"
                    onClick={handleSaveFilters}
                    variant="default"
                  />
                </div>
              </form>
            </div>
          </aside>

          {/* RIGHT: messages list */}
          <main className={styles.content} aria-label="Список повідомлень">
            <div className={styles.contentHeader}>
              <span className={styles.contentCount}>
                Показано {total} {pluralize(total)}
              </span>
              <span className={styles.contentLine} aria-hidden="true" />
            </div>

            <ul className={styles.list}>
              {MOCK_MESSAGES.map((m) => (
                <li key={m.id} className={styles.itemWrap}>
                  <article className={styles.item}>
                    <div className={styles.itemTitlePill}>{m.title}</div>

                    <p className={styles.itemText}>{m.text}</p>

                    <div className={styles.itemFooter}>
                      <button type="button" className={styles.markReadBtn}>
                        Позначити як прочитане
                      </button>

                      <button type="button" className={styles.deleteBtn}>
                        Видалити
                      </button>
                    </div>
                  </article>

                  <div className={styles.separator} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </main>
        </div>
      </Container>
    </section>
  );
}
