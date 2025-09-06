import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import frappeui from 'frappe-ui/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
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
			},
			manifest: {
				display: 'standalone',
				name: 'Learning',
				short_name: 'Learning',
				start_url: '/lms',
				description:
					'Easy to use, 100% open source Learning Management System',
				theme_color: '#0f7159',
				background_color: '#ffffff',
				icons: [
					{
						src: '/assets/lms/frontend/manifest/manifest-icon-192.maskable.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable any',
					},
					{
						src: '/assets/lms/frontend/manifest/manifest-icon-512.maskable.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable any',
					},
				],
			},
		}),
	],
	server: {
		host: '0.0.0.0', // Accept connections from any network interface
		allowedHosts: ['ps', 'fs', 'home'], // Explicitly allow this host
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
			'tailwind.config.js': path.resolve(__dirname, 'tailwind.config.js'),
		},
	},
	optimizeDeps: {
		include: [
			'feather-icons',
			'showdown',
			'engine.io-client',
			'tailwind.config.js',
			'interactjs',
			'highlight.js',
			'plyr',
		],
	},
})
