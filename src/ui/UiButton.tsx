import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'nav'
}

/** Framed gold-edge button matching in-game HudButton look. */
export function UiButton({ children, variant = 'primary', className = '', ...rest }: Props) {
  return (
    <button type="button" className={`ui-btn ui-btn--${variant} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
