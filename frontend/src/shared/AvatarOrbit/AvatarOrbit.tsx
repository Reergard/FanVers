import React from "react";
import styles from "./AvatarOrbit.module.css";
import menuLineSvg from "../../assets/backgrounds/menu_line.svg";
import defaultAvatar from "../../assets/5VgZtO9jy5g.jpg";

type Props = {
  avatarUrl?: string;
  name: string;
};

export function AvatarOrbit({ avatarUrl, name }: Props) {
  const avatarSrc = avatarUrl || defaultAvatar;
  
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
        <div
          className={styles.avatar}
          style={{ backgroundImage: `url(${avatarSrc})` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
