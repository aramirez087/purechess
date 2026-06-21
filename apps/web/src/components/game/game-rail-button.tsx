'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type GameRailButtonVariant = 'default' | 'brass' | 'danger';
type GameRailButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const SIZE: Record<GameRailButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-2.5 text-sm',
  lg: 'h-10 px-3 text-sm font-medium',
  icon: 'h-10 w-10',
};

const VARIANT: Record<GameRailButtonVariant, string> = {
  default: 'chrome-btn',
  brass: 'chrome-btn-brass',
  danger: 'chrome-btn chrome-btn-danger group',
};

type SharedProps = {
  variant?: GameRailButtonVariant;
  size?: GameRailButtonSize;
  className?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
};

type ButtonProps = SharedProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    href?: undefined;
  };

type LinkProps = SharedProps &
  Omit<React.ComponentProps<typeof Link>, 'className' | 'children'> & {
    href: string;
  };

function chromeClasses(
  variant: GameRailButtonVariant,
  size: GameRailButtonSize,
  className?: string,
  fullWidth?: boolean,
) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border transition-[color,background-color,border-color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40',
    VARIANT[variant],
    SIZE[size],
    fullWidth && 'w-full flex-1',
    className,
  );
}

export function GameRailButton({
  variant = 'default',
  size = 'lg',
  className,
  fullWidth,
  children,
  ...props
}: ButtonProps | LinkProps) {
  if ('href' in props && props.href) {
    const { href, ...linkProps } = props;
    return (
      <Link
        href={href}
        className={chromeClasses(variant, size, className, fullWidth)}
        {...linkProps}
      >
        {children}
      </Link>
    );
  }

  const { href: _href, ...buttonProps } = props as ButtonProps;
  return (
    <button
      type="button"
      className={chromeClasses(variant, size, className, fullWidth)}
      {...buttonProps}
    >
      {children}
    </button>
  );
}