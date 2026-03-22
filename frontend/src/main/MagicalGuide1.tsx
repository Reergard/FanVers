import { SectionLineTitle } from "../navigation/SectionLineTitle";

/**
 * Майбутній розділ «Тренди» — окрема логіка (динаміка, ріст активності), не ТОП за періодом.
 * Дані підключатимуться окремим API після реалізації на бекенді.
 */
export function MagicalGuide1() {
  return (
    <section className="mg2-section" aria-label="Тренди">
      <SectionLineTitle text="ТРЕНДИ" className="mg2-sectionLineTitle" />
      <p className="mg2-description" style={{ width: "100%", maxWidth: "42rem", margin: "0 auto" }}>
        Розділ у розробці. Тут з’явиться окремий рейтинг трендів (динаміка та утримання
        активності), відмінний від ТОПу за днями / тижнем / місяцем / усім часом у блоці нижче.
      </p>
    </section>
  );
}

export default MagicalGuide1;
