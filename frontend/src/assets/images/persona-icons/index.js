// Auto-wired logo map: filename (minus extension) → asset URL.
// Drop a new .png/.svg in this folder and reference it by filename — no
// code changes needed.
const modules = import.meta.glob('./*.{png,svg}', {
	eager: true,
	import: 'default',
})

export default Object.fromEntries(
	Object.entries(modules).map(([path, url]) => [
		path.replace(/^\.\//, '').replace(/\.(png|svg)$/, ''),
		url,
	])
)
