export {}

declare module '*.svg?raw' {
  const content: string
  export default content
}

declare global {
  function __(text: string): string

  interface String {
    format(...args: any[]): string
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    __: (text: string) => string
  }
}