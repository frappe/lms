import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export default defineConfig({
	plugins: [vue()],
	test: {
		environment: 'jsdom',
		globals: true,
		include: ['src/tests/**/*.test.{ts,js}'],
	},
	resolve: {
		alias: {
			'@': path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
		},
	},
})
