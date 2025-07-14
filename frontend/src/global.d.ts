export {}

declare global {
  function __(text: string): string
}

declare module 'vue' {
  interface ComponentCustomProperties {
    __: (text: string) => string
  }
}