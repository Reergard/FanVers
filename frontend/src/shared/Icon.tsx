import React from "react";

type Props = React.SVGProps<SVGSVGElement> & {
  name: string;
  title?: string;
};

export function Icon({ name, title, ...svgProps }: Props) {
  const ariaHidden = title ? undefined : true;

  return (
    <svg
      {...svgProps}
      role={title ? "img" : "presentation"}
      aria-hidden={svgProps["aria-hidden"] ?? ariaHidden}
    >
      {title ? <title>{title}</title> : null}
      <use href={`#${name}`} />
    </svg>
  );
}
