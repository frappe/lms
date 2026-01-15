export type ButtonTheme = 'gray' | 'blue' | 'green' | 'red' | 'emerald'
export type ButtonVariant = 'subtle' | 'solid' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl'
export type ThemeVariant = `${ButtonTheme}-${ButtonVariant}`

export interface ButtonProps {
    label?: string
    theme?: ButtonTheme
    size?: ButtonSize
    variant?: ButtonVariant
    loading?: boolean
    loadingText?: string
    disabled?: boolean
    icon?: any
    iconLeft?: any
    iconRight?: any
    route?: string
    link?: string
    tooltip?: string
    type?: 'button' | 'submit' | 'reset'
}
