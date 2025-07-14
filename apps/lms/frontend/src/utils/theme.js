import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfig from 'tailwind.config.js'

export const config = resolveConfig(tailwindConfig)
export const theme = config.theme
