import { useMemo } from "react";
import styles from "./AvatarOrbit.module.css";
import menuLineSvgRaw from "../../assets/backgrounds/menu_line.svg?raw";
import { resolveAvatarUrl } from "../avatar/resolveAvatarUrl";

/**
 * Strips feGaussianBlur filter from SVG — iOS Safari renders it blurry.
 * Returns SVG string with just the path (no filter).
 */
function stripSvgFilter(svg: string): string {
  return svg
    .replace(/\s*filter="[^"]*"/g, "")
    .replace(/<defs>[\s\S]*?<\/defs>/g, "");
}

type Props = {
  avatarUrl?: string;
  name: string;
  /** fullWidth: орбіта на всю ширину контейнера (для гостевого меню) */
  variant?: "default" | "fullWidth";
};

export function AvatarOrbit({ avatarUrl, name: _name, variant = "default" }: Props) {
  const avatarSrc = resolveAvatarUrl(avatarUrl);
  const orbitSvgClean = useMemo(() => stripSvgFilter(menuLineSvgRaw), []);

  return (
    <div className={`${styles.orbitContainer} ${variant === "fullWidth" ? styles.orbitFullWidth : ""}`}>
      {/* Inline SVG без filter — чітко на iOS Safari (img+filter дає розмиття) */}
      <span
        className={styles.orbitSvg}
        dangerouslySetInnerHTML={{ __html: orbitSvgClean }}
        aria-hidden
      />
      
      {/* Аватар в центре орбиты */}
      <div className={styles.avatarWrapper}>
        <div className={styles.avatar} aria-hidden="true">
          <img className={styles.avatarImage} src={avatarSrc} alt="" />
        </div>
      </div>
    </div>
  );
}
