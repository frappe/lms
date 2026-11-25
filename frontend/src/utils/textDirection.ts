/** `<html dir>` comes from the server and is fixed for the page's lifetime. */
export const isRtl = (): boolean => document.documentElement.dir === 'rtl'

/** For reka-ui's ConfigProvider, whose parts default to ltr. */
export const textDirection = (): 'ltr' | 'rtl' => (isRtl() ? 'rtl' : 'ltr')

/** The physical side a line ends on, for APIs that take only left or right. */
export const inlineEndSide = (): 'left' | 'right' =>
	isRtl() ? 'left' : 'right'

/** The physical side a line starts on, for APIs that take only left or right. */
export const inlineStartSide = (): 'left' | 'right' =>
	isRtl() ? 'right' : 'left'
