import plugin from 'tailwindcss/plugin.js'

// `pt-safe-*` / `pb-safe-*`: the designed spacing, or the device's safe-area
// inset, whichever is larger.
//
// Replaces a `standalone:pb-4` idiom that compiled to nothing — `standalone:`
// is not a registered variant here or in the frappe-ui preset — and that would
// have been wrong even if it had: `pb-4` guesses 16px rather than reading the
// device, and the home indicator overlaps in mobile Safari too, not only when
// installed.
//
// Top and bottom only. `safe-area-inset-left/right` are physical, so a logical
// `ps-safe` would be wrong under RTL and a physical one would trip the RTL
// semgrep rule. Nothing needs them, so they are not generated.
export const safeAreaPlugin = plugin(({ matchUtilities, theme }) => {
	for (const [suffix, edge] of Object.entries({ t: 'top', b: 'bottom' })) {
		matchUtilities(
			{
				[`p${suffix}-safe`]: (value) => ({
					[`padding-${edge}`]: `max(${value}, env(safe-area-inset-${edge}))`,
				}),
			},
			{ values: theme('spacing') }
		)
	}
})
