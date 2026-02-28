import React from "react";

/**
 * Inline SVG рамки меню (hexagon).
 * Використовується замість Icon(name="menu_frame") для стабільної роботи на iOS Safari,
 * де спрайт + feGaussianBlur дає розмиту картинку або іншу рамку.
 * Той самий дизайн, що в sprite.svg symbol#menu_frame, але без filter.
 */
type Props = React.SVGProps<SVGSVGElement>;

export function MenuFrameSvg(props: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 411 106"
      preserveAspectRatio="none"
      fill="none"
      role="presentation"
      aria-hidden
      {...props}
    >
      {/* Зовнішній hexagon */}
      <path
        d="M376.26 8.3877L403.913 50.3457L376.26 92.3057H34.3242L6.66992 50.3457L34.3242 8.3877H376.26Z"
        stroke="#05B4C7"
        strokeOpacity={0.5}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
      {/* Внутрішній hexagon */}
      <path
        d="M376.26 0.387695L403.913 42.3457L376.26 84.3057H34.3242L6.66992 42.3457L34.3242 0.387695H376.26Z"
        stroke="#05B4C7"
        strokeOpacity={0.5}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
