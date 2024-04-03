import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import frappeui from 'frappe-ui/vite'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		frappeui(),
		vue({
			script: {
				defineModel: true,
				propsDestructure: true,
			},
		}),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	build: {
		outDir: `../lms/public/frontend`,
		emptyOutDir: true,
		commonjsOptions: {
			include: [/tailwind.config.js/, /node_modules/],
		},
		sourcemap: true,
		target: 'es2015',
		rollupOptions: {
			output: {
				manualChunks: {
					'frappe-ui': ['frappe-ui'],
				},
			},
		},
	},
	optimizeDeps: {
		include: ['frappe-ui > feather-icons', 'showdown', 'engine.io-client'],
	},
})
