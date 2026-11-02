import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'

export const renderMath = (root: HTMLElement | null): void => {
	if (!root) return
	renderMathInElement(root, {
		delimiters: [
			{ left: '$$', right: '$$', display: true },
			{ left: '\\[', right: '\\]', display: true },
			{ left: '\\(', right: '\\)', display: false },
			{ left: '$', right: '$', display: false },
		],
		ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
		throwOnError: false,
	})
}
