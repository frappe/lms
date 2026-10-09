import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'node:path'

export default defineConfig({
	base: '/assets/lms/frontend/signup-select/',
	plugins: [vue()],
	publicDir: false,
	resolve: { dedupe: ['vue', 'frappe-ui'] },
	css: {
		postcss: {
			plugins: [
				tailwindcss({
					config: path.resolve(
						__dirname,
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
		rollupOptions: {
			input: path.resolve(__dirname, 'src/signup-select.js'),
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
