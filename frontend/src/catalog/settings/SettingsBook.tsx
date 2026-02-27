import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Container } from "../../shared/Container";
import { useAuth } from "../../auth/useAuth";
import { useNotification } from "../../shared/NotificationModal/NotificationProvider";
import { useBookBySlug } from "../hooks/useBookBySlug";
import GeneralSettings from "./GeneralSettings";
import Subscription from "./Subscription";
import Advertising from "./Advertising";
import AccessRights from "./AccessRights";
import "./SettingsBook.css";

type SettingsTab = "general" | "subscription" | "advertising" | "access";

export default function SettingsBook() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { userId, authReady } = useAuth();
  const { showError } = useNotification();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { data: book, isLoading } = useBookBySlug(slug);

  useEffect(() => {
    if (!authReady || !book) return;
    if (userId == null || book.owner !== userId) {
      showError(userId == null ? "Необхідна авторизація" : "У вас немає прав для редагування цієї книги");
      navigate(`/books/${slug}`, { replace: true });
    }
  }, [authReady, book, navigate, showError, slug, userId]);

  if (!slug) return null;

  if (!authReady || isLoading) {
    return (
      <Container>
        <section className="settings-page">
          <div className="settings-loading">Завантаження налаштувань…</div>
        </section>
      </Container>
    );
  }

  if (!book) {
    return (
      <Container>
        <section className="settings-page">
          <div className="settings-loading">Книгу не знайдено</div>
        </section>
      </Container>
    );
  }

  if (authReady && (userId == null || book.owner !== userId)) {
    return null;
  }

  return (
    <Container>
      <section className="settings-page" aria-label="Налаштування книги">
        <header className="settings-head">
          <nav className="settings-breadcrumbs" aria-label="Breadcrumbs">
            <Link className="settings-crumb" to="/">Головна</Link>
            <span className="settings-sep">›</span>
            <Link className="settings-crumb" to={`/books/${slug}`}>{book.title}</Link>
            <span className="settings-sep">›</span>
            <span className="settings-crumb" aria-current="page">Налаштування</span>
          </nav>
          <h1 className="settings-title">Налаштування книги</h1>
        </header>

        <div className="settings-tabs" role="tablist" aria-label="Вкладки налаштувань">
          <button type="button" role="tab" aria-selected={activeTab === "general"} className={activeTab === "general" ? "active" : ""} onClick={() => setActiveTab("general")}>Загальні</button>
          <button type="button" role="tab" aria-selected={activeTab === "subscription"} className={activeTab === "subscription" ? "active" : ""} onClick={() => setActiveTab("subscription")}>Підписка</button>
          <button type="button" role="tab" aria-selected={activeTab === "advertising"} className={activeTab === "advertising" ? "active" : ""} onClick={() => setActiveTab("advertising")}>Реклама</button>
          <button type="button" role="tab" aria-selected={activeTab === "access"} className={activeTab === "access" ? "active" : ""} onClick={() => setActiveTab("access")}>Доступ</button>
        </div>

        <div
          className="settings-panel"
          role="tabpanel"
          aria-label={
            activeTab === "general"
              ? "Загальні налаштування"
              : activeTab === "subscription"
                ? "Підписка"
                : activeTab === "advertising"
                  ? "Реклама"
                  : "Доступ"
          }
        >
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "subscription" && <Subscription />}
          {activeTab === "advertising" && <Advertising />}
          {activeTab === "access" && <AccessRights />}
        </div>
      </section>
    </Container>
  );
}
