import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'node:path'
import frappeui from 'frappe-ui/vite'

export default defineConfig({
	base: '/assets/lms/frontend/signup-select/',
	plugins: [
		frappeui({
			frappeProxy: false,
			jinjaBootData: false,
			buildConfig: false,
		}),
		vue(),
	],
	publicDir: false,
	resolve: {
		dedupe: ['vue', 'frappe-ui'],
		// Select straight from its file: this frappe-ui's main entry has dynamic
		// imports, which Rolldown cannot fold into the one-file IIFE this builds.
		alias: {
			'frappe-ui-select': path.resolve(
				import.meta.dirname,
				'node_modules/frappe-ui/src/components/Select/Select.vue'
			),
		},
	},
	css: {
		postcss: {
			plugins: [
				tailwindcss({
					config: path.resolve(
						import.meta.dirname,
						'tailwind.signup-select.config.js'
					),
				}),
				autoprefixer(),
			],
		},
	},
	build: {
		outDir: '../lms/public/frontend/signup-select',
		emptyOutDir: true,
		assetsInlineLimit: 0,
		cssCodeSplit: false,
		rolldownOptions: {
			input: path.resolve(import.meta.dirname, 'src/signup-select.js'),
			output: {
				format: 'iife',
				name: 'LMSSignupSelect',
				entryFileNames: 'signup-select.js',
				assetFileNames: (assetInfo) =>
					assetInfo.name?.endsWith('.css')
						? 'signup-select.css'
						: 'assets/[name]-[hash][extname]',
			},
		},
	},
})
