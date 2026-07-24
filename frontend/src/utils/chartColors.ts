/**
 * Chart series colors either come from ECharts' built-in palette (when no
 * colors are passed) or are hardcoded per page, so a theme that restyles the
 * app through CSS custom properties cannot recolor them. Themes can opt in
 * by defining --chart-1 .. --chart-5 on :root.
 *
 * Returns the resolved values of the defined tokens, in order. When no token
 * is defined it returns undefined so callers keep their current default
 * colors — themes that don't define the tokens see no change at all.
 */
export function getChartColors(count: number = 5): string[] | undefined {
	const styles = getComputedStyle(document.documentElement)
	const colors: string[] = []
	for (let i = 1; i <= count; i++) {
		const color = styles.getPropertyValue(`--chart-${i}`).trim()
		if (color) colors.push(color)
	}
	return colors.length ? colors : undefined
}
