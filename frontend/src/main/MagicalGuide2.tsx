/**
 * Секція «Рекомендації» (MagicalGuide2).
 *
 * Персональні рекомендації ще не підключені до API — показуємо лише текст.
 * Карусель карток (BookCard + mg2-grid + mg2-nav) повернути після готового ендпоінта.
 */
import { SectionLineTitle } from "../navigation/SectionLineTitle";

const RECOMMENDATIONS_PLACEHOLDER =
  "Незабаром тут з'явиться підбірка. Логіка рекомендацій в процесі розробки.";

export function MagicalGuide2() {
  return (
    <section className="mg2-section" aria-label="Рекомендації">
      <SectionLineTitle text="Рекомендації" className="mg2-sectionLineTitle" />
      <p className="mg2-description mg2-recommendationsPlaceholder">
        {RECOMMENDATIONS_PLACEHOLDER}
      </p>
      {/*
        Карусель карток (як у MagicalGuide1 / MagicalGuide3): BookCard у mg2-cardShell,
        mg2-grid, mg2-nav, useMedia — після підключення API рекомендацій.
      */}
    </section>
  );
}

export default MagicalGuide2;
