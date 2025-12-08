import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import frappeui from 'frappe-ui/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	plugins: [
		frappeui({
			frappeProxy: true,
			lucideIcons: true,
			jinjaBootData: true,
			frappeTypes: {
				input: {},
			},
			buildConfig: {
				indexHtmlPath: '../lms/www/lms.html',
			},
		}),
		vue({
			script: {
				defineModel: true,
				propsDestructure: true,
			},
		}),
		VitePWA({
			registerType: 'autoUpdate',
			devOptions: {
				enabled: true,
			},
			workbox: {
				cleanupOutdatedCaches: true,
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
				globDirectory: '/assets/lms/frontend',
				globPatterns: ['**/*.{js,ts,css,html,png,svg}'],
				runtimeCaching: [
					{
						urlPattern: ({ request }) =>
							request.destination === 'document',
						handler: 'NetworkFirst',
						options: {
							cacheName: 'html-cache',
						},
					},
				],
			},
			manifest: false,
		}),
	],
	server: {
		host: '0.0.0.0', // Accept connections from any network interface
		allowedHosts: ['ps', 'fs', 'home'], // Explicitly allow this host
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	optimizeDeps: {
		include: [
			'feather-icons',
			'engine.io-client',
			'interactjs',
			'highlight.js',
			'plyr',
		],
		exclude: mode === 'production' ? [] : ['frappe-ui'],
	},
}))
