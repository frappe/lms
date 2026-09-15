/**
 * frappe-ui's `tailwind/generated/colors.json` emits OKLCH strings
 * (`oklch(1 0 0)`), not hex. The theme-bootstrap and document-surface test
 * suites resolve a token straight out of that file and then compare it (or
 * feed it through hex-only helpers like `luma`/`relative`) as a hex string,
 * so every resolved value is normalized to hex here, once, at the source.
 *
 * Conversion: OKLCH -> OKLab -> linear sRGB -> gamma-encoded sRGB, per
 * Björn Ottosson's reference formulas (https://bottosson.github.io/posts/oklab/).
 * No colour library is a project dependency (checked package.json), so this
 * is a direct implementation rather than a wrapper around one.
 */
// Alpha is optional (`oklch(0 0 0 / 0.4)`) — frappe-ui's shadow/overlay
// tokens use it, the surface/ink/outline tokens these tests read do not.
const OKLCH_PATTERN =
	/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/

const gammaEncode = (channel: number): number => {
	const clamped = Math.min(1, Math.max(0, channel))
	return clamped <= 0.0031308
		? 12.92 * clamped
		: 1.055 * clamped ** (1 / 2.4) - 0.055
}

const toHexChannel = (channel: number): string =>
	Math.round(gammaEncode(channel) * 255)
		.toString(16)
		.padStart(2, '0')

// Alpha is a linear 0-1 opacity, not a linear-light colour value, so it must
// not go through the sRGB gamma curve `gammaEncode()` applies to R/G/B.
const toHexAlpha = (alpha: number): string =>
	Math.round(Math.min(1, Math.max(0, alpha)) * 255)
		.toString(16)
		.padStart(2, '0')

export const oklchToHex = (value: string): string => {
	const match = value.trim().match(OKLCH_PATTERN)
	if (!match) throw new Error(`not an oklch() colour: ${value}`)

	const [l, c, hDegrees] = match.slice(1, 4).map(Number)
	const alpha = match[4] === undefined ? undefined : Number(match[4])
	const hRadians = (hDegrees * Math.PI) / 180
	const a = c * Math.cos(hRadians)
	const b = c * Math.sin(hRadians)

	const l_ = l + 0.3963377774 * a + 0.2158037573 * b
	const m_ = l - 0.1055613458 * a - 0.0638541728 * b
	const s_ = l - 0.0894841775 * a - 1.291485548 * b
	const lCubed = l_ ** 3
	const mCubed = m_ ** 3
	const sCubed = s_ ** 3

	const r =
		4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed
	const g =
		-1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed
	const bl =
		-0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed

	const rgb = `${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(bl)}`
	return alpha === undefined ? `#${rgb}` : `#${rgb}${toHexAlpha(alpha)}`
}
