import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

interface BaseIconProps extends IconProps {
  children: ReactNode;
}

function IconBase({ size = 18, children, ...props }: BaseIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconPulse(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12h3.4l2.1-6.5 4.7 13 2.3-6.5H21" />
    </IconBase>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" />
      <path d="m18.6 15 .8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1Z" />
    </IconBase>
  );
}

export function IconStop(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2.4" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 5.4v13.2L19 12 8 5.4Z" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function IconShield(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 22s8-3.8 8-9.6V5.2L12 2 4 5.2v7.2C4 18.2 12 22 12 22Z" />
      <path d="m8.8 11.7 2.1 2.1 4.3-4.3" />
    </IconBase>
  );
}

export function IconShieldOff(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 22s8-3.8 8-9.6V5.2L12 2 4 5.2v7.2C4 18.2 12 22 12 22Z" />
      <path d="M4.5 3.8 20.2 20.2" />
    </IconBase>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.3 3.7 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4.2" />
      <path d="M12 17.2h.01" />
    </IconBase>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.2 2.5 2.5 5.5-5.6" />
    </IconBase>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </IconBase>
  );
}

export function IconClose(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function IconMonitor(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </IconBase>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </IconBase>
  );
}

export function IconTargetFull(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </IconBase>
  );
}

export function IconTargetVignette(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" opacity=".45" />
    </IconBase>
  );
}

export function IconTargetFrame(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <rect x="7" y="7" width="10" height="10" rx="1.2" opacity=".4" />
    </IconBase>
  );
}

export function IconBolt(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M13.2 2 4.5 13.2h6L10.8 22l8.7-11.2h-6L13.2 2Z" />
    </IconBase>
  );
}

export function IconGauge(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20.4 16a9 9 0 1 0-16.8 0" />
      <path d="m12 12 3.6-2.4" />
      <path d="M12 21h.01" />
    </IconBase>
  );
}

export function IconRotate(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </IconBase>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20.5 8A9 9 0 0 0 5 5.3L3 7.5" />
      <path d="M3 3v4.5h4.5" />
      <path d="M3.5 16A9 9 0 0 0 19 18.7l2-2.2" />
      <path d="M21 21v-4.5h-4.5" />
    </IconBase>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h9a6 6 0 0 1 6 6v1" />
    </IconBase>
  );
}

export function IconAutomation(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
      <path d="M10 6.5h4a3 3 0 0 1 3 3V14" />
      <path d="m14.5 11.5 2.5 2.5 2.5-2.5" />
    </IconBase>
  );
}

export function IconTimer(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 1.5" />
      <path d="M9 2h6" />
    </IconBase>
  );
}
