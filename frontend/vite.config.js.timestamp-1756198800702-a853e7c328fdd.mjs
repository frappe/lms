// vite.config.js
import { defineConfig } from 'file:///C:/github%20open%20source/frappee%20lms/lms/frontend/node_modules/vite/dist/node/index.js'
import vue from 'file:///C:/github%20open%20source/frappee%20lms/lms/frontend/node_modules/@vitejs/plugin-vue/dist/index.mjs'
import path from 'path'
import frappeui from 'file:///C:/github%20open%20source/frappee%20lms/lms/frontend/node_modules/frappe-ui/vite/index.js'
import { VitePWA } from 'file:///C:/github%20open%20source/frappee%20lms/lms/frontend/node_modules/vite-plugin-pwa/dist/index.js'
var __vite_injected_original_dirname =
	'C:\\github open source\\frappee lms\\lms\\frontend'
var vite_config_default = defineConfig({
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
				description: 'Easy to use, 100% open source Learning Management System',
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
		host: '0.0.0.0',
		// Accept connections from any network interface
		allowedHosts: ['ps', 'fs'],
		// Explicitly allow this host
	},
	resolve: {
		alias: {
			'@': path.resolve(__vite_injected_original_dirname, 'src'),
			'tailwind.config.js': path.resolve(
				__vite_injected_original_dirname,
				'tailwind.config.js'
			),
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
export { vite_config_default as default }
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxnaXRodWIgb3BlbiBzb3VyY2VcXFxcZnJhcHBlZSBsbXNcXFxcbG1zXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxnaXRodWIgb3BlbiBzb3VyY2VcXFxcZnJhcHBlZSBsbXNcXFxcbG1zXFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9naXRodWIlMjBvcGVuJTIwc291cmNlL2ZyYXBwZWUlMjBsbXMvbG1zL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXHJcbmltcG9ydCBmcmFwcGV1aSBmcm9tICdmcmFwcGUtdWkvdml0ZSdcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSdcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcblx0cGx1Z2luczogW1xyXG5cdFx0ZnJhcHBldWkoe1xyXG5cdFx0XHRmcmFwcGVQcm94eTogdHJ1ZSxcclxuXHRcdFx0bHVjaWRlSWNvbnM6IHRydWUsXHJcblx0XHRcdGppbmphQm9vdERhdGE6IHRydWUsXHJcblx0XHRcdGZyYXBwZVR5cGVzOiB7XHJcblx0XHRcdFx0aW5wdXQ6IHt9LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRidWlsZENvbmZpZzoge1xyXG5cdFx0XHRcdGluZGV4SHRtbFBhdGg6ICcuLi9sbXMvd3d3L2xtcy5odG1sJyxcclxuXHRcdFx0fSxcclxuXHRcdH0pLFxyXG5cdFx0dnVlKHtcclxuXHRcdFx0c2NyaXB0OiB7XHJcblx0XHRcdFx0ZGVmaW5lTW9kZWw6IHRydWUsXHJcblx0XHRcdFx0cHJvcHNEZXN0cnVjdHVyZTogdHJ1ZSxcclxuXHRcdFx0fSxcclxuXHRcdH0pLFxyXG5cdFx0Vml0ZVBXQSh7XHJcblx0XHRcdHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG5cdFx0XHRkZXZPcHRpb25zOiB7XHJcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcclxuXHRcdFx0fSxcclxuXHRcdFx0d29ya2JveDoge1xyXG5cdFx0XHRcdGNsZWFudXBPdXRkYXRlZENhY2hlczogdHJ1ZSxcclxuXHRcdFx0XHRtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNSAqIDEwMjQgKiAxMDI0LFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRtYW5pZmVzdDoge1xyXG5cdFx0XHRcdGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcclxuXHRcdFx0XHRuYW1lOiAnTGVhcm5pbmcnLFxyXG5cdFx0XHRcdHNob3J0X25hbWU6ICdMZWFybmluZycsXHJcblx0XHRcdFx0c3RhcnRfdXJsOiAnL2xtcycsXHJcblx0XHRcdFx0ZGVzY3JpcHRpb246XHJcblx0XHRcdFx0XHQnRWFzeSB0byB1c2UsIDEwMCUgb3BlbiBzb3VyY2UgTGVhcm5pbmcgTWFuYWdlbWVudCBTeXN0ZW0nLFxyXG5cdFx0XHRcdHRoZW1lX2NvbG9yOiAnIzBmNzE1OScsXHJcblx0XHRcdFx0YmFja2dyb3VuZF9jb2xvcjogJyNmZmZmZmYnLFxyXG5cdFx0XHRcdGljb25zOiBbXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHNyYzogJy9hc3NldHMvbG1zL2Zyb250ZW5kL21hbmlmZXN0L21hbmlmZXN0LWljb24tMTkyLm1hc2thYmxlLnBuZycsXHJcblx0XHRcdFx0XHRcdHNpemVzOiAnMTkyeDE5MicsXHJcblx0XHRcdFx0XHRcdHR5cGU6ICdpbWFnZS9wbmcnLFxyXG5cdFx0XHRcdFx0XHRwdXJwb3NlOiAnbWFza2FibGUgYW55JyxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdHNyYzogJy9hc3NldHMvbG1zL2Zyb250ZW5kL21hbmlmZXN0L21hbmlmZXN0LWljb24tNTEyLm1hc2thYmxlLnBuZycsXHJcblx0XHRcdFx0XHRcdHNpemVzOiAnNTEyeDUxMicsXHJcblx0XHRcdFx0XHRcdHR5cGU6ICdpbWFnZS9wbmcnLFxyXG5cdFx0XHRcdFx0XHRwdXJwb3NlOiAnbWFza2FibGUgYW55JyxcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XSxcclxuXHRcdFx0fSxcclxuXHRcdH0pLFxyXG5cdF0sXHJcblx0c2VydmVyOiB7XHJcblx0XHRob3N0OiAnMC4wLjAuMCcsIC8vIEFjY2VwdCBjb25uZWN0aW9ucyBmcm9tIGFueSBuZXR3b3JrIGludGVyZmFjZVxyXG5cdFx0YWxsb3dlZEhvc3RzOiBbJ3BzJywgJ2ZzJ10sIC8vIEV4cGxpY2l0bHkgYWxsb3cgdGhpcyBob3N0XHJcblx0fSxcclxuXHRyZXNvbHZlOiB7XHJcblx0XHRhbGlhczoge1xyXG5cdFx0XHQnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMnKSxcclxuXHRcdFx0J3RhaWx3aW5kLmNvbmZpZy5qcyc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICd0YWlsd2luZC5jb25maWcuanMnKSxcclxuXHRcdH0sXHJcblx0fSxcclxuXHRvcHRpbWl6ZURlcHM6IHtcclxuXHRcdGluY2x1ZGU6IFtcclxuXHRcdFx0J2ZlYXRoZXItaWNvbnMnLFxyXG5cdFx0XHQnc2hvd2Rvd24nLFxyXG5cdFx0XHQnZW5naW5lLmlvLWNsaWVudCcsXHJcblx0XHRcdCd0YWlsd2luZC5jb25maWcuanMnLFxyXG5cdFx0XHQnaW50ZXJhY3RqcycsXHJcblx0XHRcdCdoaWdobGlnaHQuanMnLFxyXG5cdFx0XHQncGx5cicsXHJcblx0XHRdLFxyXG5cdH0sXHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBNFUsU0FBUyxvQkFBb0I7QUFDelcsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sVUFBVTtBQUNqQixPQUFPLGNBQWM7QUFDckIsU0FBUyxlQUFlO0FBSnhCLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzNCLFNBQVM7QUFBQSxJQUNSLFNBQVM7QUFBQSxNQUNSLGFBQWE7QUFBQSxNQUNiLGFBQWE7QUFBQSxNQUNiLGVBQWU7QUFBQSxNQUNmLGFBQWE7QUFBQSxRQUNaLE9BQU8sQ0FBQztBQUFBLE1BQ1Q7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLGVBQWU7QUFBQSxNQUNoQjtBQUFBLElBQ0QsQ0FBQztBQUFBLElBQ0QsSUFBSTtBQUFBLE1BQ0gsUUFBUTtBQUFBLFFBQ1AsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsTUFDbkI7QUFBQSxJQUNELENBQUM7QUFBQSxJQUNELFFBQVE7QUFBQSxNQUNQLGNBQWM7QUFBQSxNQUNkLFlBQVk7QUFBQSxRQUNYLFNBQVM7QUFBQSxNQUNWO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUix1QkFBdUI7QUFBQSxRQUN2QiwrQkFBK0IsSUFBSSxPQUFPO0FBQUEsTUFDM0M7QUFBQSxNQUNBLFVBQVU7QUFBQSxRQUNULFNBQVM7QUFBQSxRQUNULE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLFdBQVc7QUFBQSxRQUNYLGFBQ0M7QUFBQSxRQUNELGFBQWE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLE9BQU87QUFBQSxVQUNOO0FBQUEsWUFDQyxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixTQUFTO0FBQUEsVUFDVjtBQUFBLFVBQ0E7QUFBQSxZQUNDLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxZQUNOLFNBQVM7QUFBQSxVQUNWO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDUCxNQUFNO0FBQUE7QUFBQSxJQUNOLGNBQWMsQ0FBQyxNQUFNLElBQUk7QUFBQTtBQUFBLEVBQzFCO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUixPQUFPO0FBQUEsTUFDTixLQUFLLEtBQUssUUFBUSxrQ0FBVyxLQUFLO0FBQUEsTUFDbEMsc0JBQXNCLEtBQUssUUFBUSxrQ0FBVyxvQkFBb0I7QUFBQSxJQUNuRTtBQUFBLEVBQ0Q7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNiLFNBQVM7QUFBQSxNQUNSO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
