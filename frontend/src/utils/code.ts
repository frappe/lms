import { Code } from "lucide-vue-next"
import { h, createApp } from "vue"
import { HTML_ESCAPE_MAP } from "@/utils/format"
// lib/core registers no languages; register just the picker's set to avoid bundling all ~190.
import hljs from 'highlight.js/lib/core';
import apache from 'highlight.js/lib/languages/apache';
import bash from 'highlight.js/lib/languages/bash';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import coffeescript from 'highlight.js/lib/languages/coffeescript';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import xml from 'highlight.js/lib/languages/xml';
import http from 'highlight.js/lib/languages/http';
import json from 'highlight.js/lib/languages/json';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import kotlin from 'highlight.js/lib/languages/kotlin';
import less from 'highlight.js/lib/languages/less';
import lua from 'highlight.js/lib/languages/lua';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import nginx from 'highlight.js/lib/languages/nginx';
import objectivec from 'highlight.js/lib/languages/objectivec';
import php from 'highlight.js/lib/languages/php';
import perl from 'highlight.js/lib/languages/perl';
import properties from 'highlight.js/lib/languages/properties';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import shell from 'highlight.js/lib/languages/shell';
import swift from 'highlight.js/lib/languages/swift';
import ini from 'highlight.js/lib/languages/ini';
import typescript from 'highlight.js/lib/languages/typescript';
import yaml from 'highlight.js/lib/languages/yaml';
import plaintext from 'highlight.js/lib/languages/plaintext';

// Canonical names; each module's aliases (cs, html, toml) resolve the picker keys too.
const HLJS_LANGUAGES: Record<string, any> = {
	apache, bash, csharp, cpp, css, coffeescript, diff, go, xml, http,
	json, java, javascript, kotlin, less, lua, makefile, markdown, nginx,
	objectivec, php, perl, properties, python, ruby, rust, scss, sql, shell,
	swift, ini, typescript, yaml, plaintext,
};
for (const [name, language] of Object.entries(HLJS_LANGUAGES)) {
	hljs.registerLanguage(name, language);
}


// Atom One Dark, self-hosted and scoped tightly to out-specify frappe-ui's .ProseMirror .hljs-* rules.
const CODEBOX_THEME_CSS = `
.codeBoxHolder { max-width: 100%; }
.codeBoxHolder .codeBoxTextArea { overflow-x: auto; max-width: 100%; }
.codeBoxHolder .codeBoxTextArea.dark.hljs { color: #abb2bf; background: #282c34; }
.codeBoxHolder .codeBoxTextArea.dark { caret-color: #abb2bf; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-comment,
.codeBoxHolder .codeBoxTextArea.dark .hljs-quote { color: #5c6370; font-style: italic; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-doctag,
.codeBoxHolder .codeBoxTextArea.dark .hljs-keyword,
.codeBoxHolder .codeBoxTextArea.dark .hljs-formula { color: #c678dd; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-section,
.codeBoxHolder .codeBoxTextArea.dark .hljs-name,
.codeBoxHolder .codeBoxTextArea.dark .hljs-selector-tag,
.codeBoxHolder .codeBoxTextArea.dark .hljs-deletion,
.codeBoxHolder .codeBoxTextArea.dark .hljs-subst { color: #e06c75; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-literal { color: #56b6c2; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-string,
.codeBoxHolder .codeBoxTextArea.dark .hljs-regexp,
.codeBoxHolder .codeBoxTextArea.dark .hljs-addition,
.codeBoxHolder .codeBoxTextArea.dark .hljs-attribute,
.codeBoxHolder .codeBoxTextArea.dark .hljs-meta .hljs-string { color: #98c379; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-attr,
.codeBoxHolder .codeBoxTextArea.dark .hljs-variable,
.codeBoxHolder .codeBoxTextArea.dark .hljs-template-variable,
.codeBoxHolder .codeBoxTextArea.dark .hljs-type,
.codeBoxHolder .codeBoxTextArea.dark .hljs-selector-class,
.codeBoxHolder .codeBoxTextArea.dark .hljs-selector-attr,
.codeBoxHolder .codeBoxTextArea.dark .hljs-selector-pseudo,
.codeBoxHolder .codeBoxTextArea.dark .hljs-number { color: #d19a66; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-symbol,
.codeBoxHolder .codeBoxTextArea.dark .hljs-bullet,
.codeBoxHolder .codeBoxTextArea.dark .hljs-link,
.codeBoxHolder .codeBoxTextArea.dark .hljs-meta,
.codeBoxHolder .codeBoxTextArea.dark .hljs-selector-id,
.codeBoxHolder .codeBoxTextArea.dark .hljs-title { color: #61aeee; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-built_in,
.codeBoxHolder .codeBoxTextArea.dark .hljs-title.class_,
.codeBoxHolder .codeBoxTextArea.dark .hljs-class .hljs-title { color: #e6c07b; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-emphasis { font-style: italic; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-strong { font-weight: bold; }
.codeBoxHolder .codeBoxTextArea.dark .hljs-link { text-decoration: underline; }
`;

// Convert legacy contenteditable HTML to plain text: block tags -> line breaks,
// <br> -> \n, inline tags stripped. DOMParser is inert (no scripts/loads).
const LEGACY_BLOCK_TAGS = new Set([
	'DIV', 'P', 'LI', 'UL', 'OL', 'PRE', 'BLOCKQUOTE', 'TABLE', 'TR', 'TD', 'TH',
	'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE',
]);

function legacyHTMLToPlainText(html: string): string {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	let text = '';
	// A trailing \n from a block boundary is trimmed; an explicit <br> is kept.
	let endsOnBlockBreak = false;
	const walk = (node: Node) => {
		for (const child of Array.from(node.childNodes)) {
			if (child.nodeType === Node.TEXT_NODE) {
				if (child.textContent) {
					text += child.textContent;
					endsOnBlockBreak = false;
				}
				continue;
			}
			if (child.nodeType !== Node.ELEMENT_NODE) continue;
			const tag = (child as Element).tagName;
			if (tag === 'BR') {
				text += '\n';
				endsOnBlockBreak = false;
				continue;
			}
			const isBlock = LEGACY_BLOCK_TAGS.has(tag);
			if (isBlock && text && !text.endsWith('\n')) text += '\n';
			walk(child);
			if (isBlock && text && !text.endsWith('\n')) {
				text += '\n';
				endsOnBlockBreak = true;
			}
		}
	};
	walk(doc.body);
	return endsOnBlockBreak ? text.replace(/\n$/, '') : text;
}

// nh3 sanitizes the lesson content field on save, mangling raw < > &. Keep stored
// code entity-escaped (nh3 preserves entities) and decode on load. New format:'text'
// data must be escaped with escapeForStorage only.
function escapeForStorage(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Reverses escapeHTML (derived from HTML_ESCAPE_MAP so they can't drift), plus numeric
// synonyms. Broader than escapeForStorage on purpose: covers legacy escapeHTML-built data.
const STORAGE_ENTITIES: Record<string, string> = {
	...Object.fromEntries(
		Object.entries(HTML_ESCAPE_MAP as Record<string, string>)
			.map(([char, entity]) => [entity.toLowerCase(), char])
	),
	'&#34;': '"', '&#x22;': '"',
	'&#x27;': "'",
	'&#96;': '`',
	'&#61;': '=',
};
const STORAGE_ENTITY_RE = new RegExp(`(?:${Object.keys(STORAGE_ENTITIES).join('|')})`, 'gi');

function decodeFromStorage(stored: string): string {
	// Leftmost-first: "&amp;lt;" -> "&lt;", never double-decoded.
	return stored.replace(STORAGE_ENTITY_RE, (entity) =>
		STORAGE_ENTITIES[entity.toLowerCase()] ?? entity);
}

// Honor a language only if hljs has the grammar; the raw value is stored so a
// later registration can pick it up.
function resolveCodeBoxLanguage(language: unknown): string {
	return language && typeof language === 'string' && hljs.getLanguage(language)
		? language
		: 'plaintext';
}

const DEFAULT_THEMES = ['light', 'dark'];
const COMMON_LANGUAGES = {
	plaintext: 'Plaintext', apache: 'Apache', bash: 'Bash', cs: 'C#', cpp: 'C++', css: 'CSS', coffeescript: 'CoffeeScript', diff: 'Diff',
	go: 'Go', html: 'HTML, XML', http: 'HTTP', json: 'JSON', java: 'Java', javascript: 'JavaScript', kotlin: 'Kotlin',
	less: 'Less', lua: 'Lua', makefile: 'Makefile', markdown: 'Markdown', nginx: 'Nginx', objectivec: 'Objective-C',
	php: 'PHP', perl: 'Perl', properties: 'Properties', python: 'Python', ruby: 'Ruby', rust: 'Rust', scss: 'SCSS',
	sql: 'SQL', shell: 'Shell Session', swift: 'Swift', toml: 'TOML, also INI', typescript: 'TypeScript', yaml: 'YAML',
};

export class CodeBox {
	api: any;
	config: { themeName: any; themeURL: any; useDefaultTheme: any; };
	readOnly: boolean;
	data: { code: string; format: 'text'; language: string; theme: string; };
	highlighted = false;
	highlightScriptID: string;
	highlightCSSID: string;
	highlightCSSLinkID: string;
	codeArea: HTMLDivElement;
	selectInput: HTMLInputElement;
	selectDropIcon: HTMLElement;

	constructor({ data, api, config, readOnly }) {
		this.api = api;
		this.readOnly = readOnly;
		this.config = {
			themeName: config.themeName && typeof config.themeName === 'string' ? config.themeName : '',
			themeURL: config.themeURL && typeof config.themeURL === 'string' ? config.themeURL : '',
			useDefaultTheme: (config.useDefaultTheme && typeof config.useDefaultTheme === 'string'
				&& DEFAULT_THEMES.includes(config.useDefaultTheme.toLowerCase())) ? config.useDefaultTheme : 'dark',
		};
		const rawCode = data.code && typeof data.code === 'string' ? data.code : '';
		this.data = {
			code: data.format === 'text' ? decodeFromStorage(rawCode) : legacyHTMLToPlainText(rawCode),
			format: 'text',
			language: data.language && typeof data.language === 'string' ? data.language : 'plaintext',
			theme: data.theme && typeof data.theme === 'string' ? data.theme : this._getThemeURLFromConfig(),
		};
		this.highlightScriptID = 'highlightJSScriptElement';
		this.highlightCSSID = 'highlightJSCSSElement';
		this.highlightCSSLinkID = 'highlightJSCSSLinkElement';
		this.codeArea = document.createElement('div');
		this.selectInput = document.createElement('input');
		this.selectDropIcon = document.createElement('i');

		this._injectHighlightJSCSSElement();

		this.api.listeners.on(window, 'click', this._closeAllLanguageSelects, true);
	}

	static get isReadOnlySupported() {
		return true
	}

	static get sanitize() {
		return {
			code: true,
			format: false,
			language: false,
			theme: false,
		}
	}

	static get toolbox() {
		const app = createApp({
			render: () => h(Code, { size: 18, strokeWidth: 1.5, color: 'currentColor' }),
		});

		const div = document.createElement('div');
		app.mount(div);

		return {
			title: 'CodeBox',
			icon: div.innerHTML
		};
	}

	static get displayInToolbox() {
		return true;
	}

	static get enableLineBreaks() {
		return true;
	}

	render() {
		const codeAreaHolder = document.createElement('pre');
		const languageSelect = this._createLanguageSelectElement();

		codeAreaHolder.setAttribute('class', 'codeBoxHolder');
		this.codeArea.setAttribute('class', `codeBoxTextArea ${this.config.useDefaultTheme} ${this.data.language}`);
		this.codeArea.textContent = this.data.code;

		if (!this.readOnly) {
			// plaintext-only strips rich formatting; editing works on plain source so
			// save() never stores hljs spans. Paste handler covers engines lacking it.
			this.codeArea.setAttribute('contenteditable', 'plaintext-only');
			this.api.listeners.on(this.codeArea, 'paste', event => this._handleCodeAreaPaste(event), false);
			this.api.listeners.on(this.codeArea, 'focus', () => this._syncFromSource(), false);
			this.api.listeners.on(this.codeArea, 'input', () => this._captureSource(), false);
			this.api.listeners.on(this.codeArea, 'blur', event => this._onBlur(event), false);
		}

		codeAreaHolder.appendChild(this.codeArea);
		!this.readOnly && codeAreaHolder.appendChild(languageSelect);

		// Highlight on load in both modes; edit mode strips it back on focus.
		if (this.data.code) this._highlightCodeArea();

		return codeAreaHolder;
	}

	save(blockContent) {
		// Canonical plain source, entity-escaped for storage — never the highlighted DOM.
		return Object.assign({}, this.data, {
			code: escapeForStorage(this.data.code),
			theme: this._getThemeURLFromConfig(),
		});
	}

	validate(savedData) {
		if (!savedData.code.trim()) return false;
		return true;
	}

	destroy() {
		this.api.listeners.off(window, 'click', this._closeAllLanguageSelects, true);
		this.api.listeners.off(this.codeArea, 'focus', () => this._syncFromSource(), false);
		this.api.listeners.off(this.codeArea, 'input', () => this._captureSource(), false);
		this.api.listeners.off(this.codeArea, 'blur', event => this._onBlur(event), false);
		this.api.listeners.off(this.codeArea, 'paste', event => this._handleCodeAreaPaste(event), false);
		this.api.listeners.off(this.selectInput, 'click', event => this._handleSelectInputClick(event), false);
	}

	_createLanguageSelectElement() {
		const selectHolder = document.createElement('div');
		const selectPreview = document.createElement('div');
		const languages = Object.entries(COMMON_LANGUAGES);

		selectHolder.setAttribute('class', 'codeBoxSelectDiv');

		this.selectDropIcon.setAttribute('class', `codeBoxSelectDropIcon ${this.config.useDefaultTheme}`);
		this.selectDropIcon.innerHTML = '&#8595;';
		this.selectInput.setAttribute('class', `codeBoxSelectInput ${this.config.useDefaultTheme}`);
		this.selectInput.setAttribute('type', 'text');
		this.selectInput.setAttribute('readonly', 'true');
		this.selectInput.value =
			(COMMON_LANGUAGES as Record<string, string>)[this.data.language] ?? this.data.language;
		this.api.listeners.on(this.selectInput, 'click', event => this._handleSelectInputClick(event), false);

		selectPreview.setAttribute('class', 'codeBoxSelectPreview');

		languages.forEach(language => {
			const selectItem = document.createElement('p');
			selectItem.setAttribute('class', `codeBoxSelectItem ${this.config.useDefaultTheme}`);
			selectItem.setAttribute('data-key', language[0]);
			selectItem.textContent = language[1];
			this.api.listeners.on(selectItem, 'click', event => this._handleSelectItemClick(event, language), false);

			selectPreview.appendChild(selectItem);
		});

		selectHolder.appendChild(this.selectDropIcon);
		selectHolder.appendChild(this.selectInput);
		selectHolder.appendChild(selectPreview);

		return selectHolder;
	}

	_captureSource() {
		// innerText keeps rendered line breaks; textContent is the jsdom fallback.
		this.data.code = this.codeArea.innerText ?? this.codeArea.textContent ?? '';
	}

	_syncFromSource() {
		// On focus, strip highlight markup and restore the caret.
		if (!this.highlighted) return;
		const offset = this._getCaretOffset();
		this.codeArea.textContent = this.data.code;
		this.highlighted = false;
		this._setCaretOffset(offset);
	}

	_getCaretOffset(): number | null {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return null;
		const range = selection.getRangeAt(0);
		if (!this.codeArea.contains(range.endContainer)) return null;
		// Highlight spans add no characters, so the char offset maps onto plain source.
		const preCaret = range.cloneRange();
		preCaret.selectNodeContents(this.codeArea);
		preCaret.setEnd(range.endContainer, range.endOffset);
		return preCaret.toString().length;
	}

	_setCaretOffset(offset: number | null) {
		if (offset == null) return;
		const selection = window.getSelection();
		if (!selection) return;
		const walker = document.createTreeWalker(this.codeArea, NodeFilter.SHOW_TEXT);
		let remaining = offset;
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const length = node.textContent?.length ?? 0;
			if (remaining <= length) {
				const range = document.createRange();
				range.setStart(node, remaining);
				range.collapse(true);
				selection.removeAllRanges();
				selection.addRange(range);
				return;
			}
			remaining -= length;
		}
		// Past the end: caret to end.
		const range = document.createRange();
		range.selectNodeContents(this.codeArea);
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	_onBlur(event) {
		this._captureSource();
		this._highlightCodeArea(event);
	}

	_highlightCodeArea(event?) {
		// Highlight by the chosen language only; hljs.highlight escapes the source.
		const result = hljs.highlight(this.data.code, { language: resolveCodeBoxLanguage(this.data.language) });
		this.codeArea.innerHTML = result.value;
		this.codeArea.classList.add('hljs');
		this.highlighted = true;
	}

	_handleCodeAreaPaste(event) {
		// Insert the plain-text payload only — no outside styling.
		event.preventDefault();
		event.stopPropagation();
		const text = event.clipboardData?.getData('text/plain') ?? '';
		if (text) {
			// execCommand preserves native undo where supported.
			const inserted = typeof document.execCommand === 'function'
				&& document.execCommand('insertText', false, text);
			if (!inserted) this._insertTextAtCaret(text);
		}
		this._captureSource();
	}

	_insertTextAtCaret(text: string) {
		const selection = window.getSelection();
		const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
		if (!selection || !range || !this.codeArea.contains(range.startContainer)) {
			this.codeArea.appendChild(document.createTextNode(text));
			return;
		}
		range.deleteContents();
		const node = document.createTextNode(text);
		range.insertNode(node);
		range.setStartAfter(node);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
	}

	_handleSelectInputClick(event) {
		event.target.nextSibling.classList.toggle('codeBoxShow');
	}

	_handleSelectItemClick(event, language) {
		event.target.parentNode.parentNode.querySelector('.codeBoxSelectInput').value = language[1];
		event.target.parentNode.classList.remove('codeBoxShow');
		this.codeArea.removeAttribute('class');
		this.data.language = language[0];
		this.codeArea.setAttribute('class', `codeBoxTextArea ${this.config.useDefaultTheme} ${this.data.language}`);

		this._highlightCodeArea();
	}

	_closeAllLanguageSelects() {
		const selectPreviews = document.querySelectorAll('.codeBoxSelectPreview');
		for (let i = 0, len = selectPreviews.length; i < len; i++) selectPreviews[i].classList.remove('codeBoxShow');
	}

	_injectHighlightJSCSSElement() {
		const head = document.querySelector('head');

		// Default theme is a bundled <style>; custom themes get a separate <link> id
		// so instances with different configs don't evict each other.
		if (!this.config.themeName && !this.config.themeURL) {
			const existing = document.querySelector(`#${this.highlightCSSID}`);
			if (existing?.tagName === 'STYLE') return;
			existing?.remove(); // stale <link> from the old CDN theme
			const style = document.createElement('style');
			style.setAttribute('id', this.highlightCSSID);
			style.textContent = CODEBOX_THEME_CSS;
			if (head) head.appendChild(style);
			return;
		}

		const highlightJSCSSURL = this._getThemeURLFromConfig();
		const existingLink = document.querySelector(`#${this.highlightCSSLinkID}`);
		if (existingLink?.tagName === 'LINK') {
			existingLink.setAttribute('href', highlightJSCSSURL);
			return;
		}
		const link = document.createElement('link');
		link.setAttribute('rel', 'stylesheet');
		link.setAttribute('href', highlightJSCSSURL);
		link.setAttribute('id', this.highlightCSSLinkID);
		if (head) head.appendChild(link);
	}

	_getThemeURLFromConfig() {
		let themeURL = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@9.18.1/build/styles/atom-one-${this.config.useDefaultTheme}.min.css`;

		if (this.config.themeName) themeURL = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@9.18.1/build/styles/${this.config.themeName}.min.css`;
		if (this.config.themeURL) themeURL = this.config.themeURL;

		return themeURL;
	}
}


export default CodeBox;