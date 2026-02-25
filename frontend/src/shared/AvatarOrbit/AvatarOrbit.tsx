import React from "react";
import styles from "./AvatarOrbit.module.css";
import menuLineSvg from "../../assets/backgrounds/menu_line.svg";
import { resolveAvatarUrl } from "../avatar/resolveAvatarUrl";

type Props = {
  avatarUrl?: string;
  name: string;
};

export function AvatarOrbit({ avatarUrl, name }: Props) {
  const avatarSrc = resolveAvatarUrl(avatarUrl);
  
  return (
    <div className={styles.orbitContainer}>
      {/* SVG орбита */}
      <img 
        src={menuLineSvg} 
        alt="" 
        className={styles.orbitSvg}
        aria-hidden="true"
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
