import { Code } from "lucide-vue-next"
import { h, createApp } from "vue"
// `lib/core` registers no languages, so every highlight call was a no-op; the
// full build fixes that but bundles ~190 languages. Register only the ones the
// picker offers (COMMON_LANGUAGES below) under their picker key, so bare-class
// detection matches and apache/nginx/toml/http — which `lib/common` omits —
// still highlight, without the long-tail bloat.
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

// Register under canonical hljs names. Each module also declares its own aliases
// (csharp -> `cs`, xml -> `html`, ini -> `toml`), so the picker keys used as the
// block's class still resolve, and grammars that embed a sublanguage by its
// canonical name (e.g. a ```xml markdown fence) find it too. `none` stays
// unregistered so it falls through to hljs auto-detection.
const HLJS_LANGUAGES: Record<string, any> = {
	apache, bash, csharp, cpp, css, coffeescript, diff, go, xml, http,
	json, java, javascript, kotlin, less, lua, makefile, markdown, nginx,
	objectivec, php, perl, properties, python, ruby, rust, scss, sql, shell,
	swift, ini, typescript, yaml, plaintext,
};
for (const [name, language] of Object.entries(HLJS_LANGUAGES)) {
	hljs.registerLanguage(name, language);
}


const DEFAULT_THEMES = ['light', 'dark'];
const COMMON_LANGUAGES = {
	none: 'Auto-detect', apache: 'Apache', bash: 'Bash', cs: 'C#', cpp: 'C++', css: 'CSS', coffeescript: 'CoffeeScript', diff: 'Diff',
	go: 'Go', html: 'HTML, XML', http: 'HTTP', json: 'JSON', java: 'Java', javascript: 'JavaScript', kotlin: 'Kotlin',
	less: 'Less', lua: 'Lua', makefile: 'Makefile', markdown: 'Markdown', nginx: 'Nginx', objectivec: 'Objective-C',
	php: 'PHP', perl: 'Perl', properties: 'Properties', python: 'Python', ruby: 'Ruby', rust: 'Rust', scss: 'SCSS',
	sql: 'SQL', shell: 'Shell Session', swift: 'Swift', toml: 'TOML, also INI', typescript: 'TypeScript', yaml: 'YAML',
	plaintext: 'Plaintext'
};

export class CodeBox {
	api: any;
	config: { themeName: any; themeURL: any; useDefaultTheme: any; };
	readOnly: boolean;
	data: { code: any; language: any; theme: any; };
	highlightScriptID: string;
	highlightCSSID: string;
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
		this.data = {
			code: data.code && typeof data.code === 'string' ? data.code : '',
			language: data.language && typeof data.language === 'string' ? data.language : 'Auto-detect',
			theme: data.theme && typeof data.theme === 'string' ? data.theme : this._getThemeURLFromConfig(),
		};
		this.highlightScriptID = 'highlightJSScriptElement';
		this.highlightCSSID = 'highlightJSCSSElement';
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
		this.codeArea.setAttribute('contenteditable', 'true');
		this.codeArea.innerHTML = this.data.code;
		this.api.listeners.on(this.codeArea, 'paste', event => this._handleCodeAreaPaste(event), false);

		if (!this.readOnly) {
			// `this.data.code` is the canonical un-highlighted source. Keep editing on
			// clean source (focus strips display markup, input re-captures it) so
			// save() never serializes hljs spans back into the stored code.
			this.api.listeners.on(this.codeArea, 'focus', () => this._syncFromSource(), false);
			this.api.listeners.on(this.codeArea, 'input', () => this._captureSource(), false);
			this.api.listeners.on(this.codeArea, 'blur', event => this._onBlur(event), false);
		}

		codeAreaHolder.appendChild(this.codeArea);
		!this.readOnly && codeAreaHolder.appendChild(languageSelect);

		// Highlight saved blocks on load only in read-only (student) view. In edit
		// mode the block is contenteditable, so highlighting is applied on blur /
		// language change as display-only markup that save() never reads.
		if (this.readOnly && this.data.code) this._highlightCodeArea();

		return codeAreaHolder;
	}

	save(blockContent) {
		// Return the canonical source, never the highlighted DOM. `this.data.code`
		// is kept in sync by _captureSource on every edit and on blur.
		return Object.assign(this.data, { theme: this._getThemeURLFromConfig() });
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
		this.selectInput.value = this.data.language;
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
		// Canonical source is the un-highlighted innerHTML. Editing always happens on
		// clean source (see _syncFromSource), so this never captures hljs markup.
		this.data.code = this.codeArea.innerHTML;
	}

	_syncFromSource() {
		// On focus, drop any display-only highlight markup so both the edit surface
		// and the innerHTML that _captureSource reads stay on clean source. Preserve
		// the caret across the rewrite so clicking into a highlighted block doesn't
		// jump the cursor to the start.
		if (this.codeArea.innerHTML === this.data.code) return;
		const offset = this._getCaretOffset();
		this.codeArea.innerHTML = this.data.code;
		this._setCaretOffset(offset);
	}

	_getCaretOffset(): number | null {
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return null;
		const range = selection.getRangeAt(0);
		if (!this.codeArea.contains(range.endContainer)) return null;
		// Character count from the block's start to the caret. Highlight spans add
		// no characters, so this offset maps cleanly onto the un-highlighted source.
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
		// Offset past the end (e.g. empty block): place the caret at the end.
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
		// hljs skips elements it has already highlighted; saved blocks are
		// re-highlighted on every render and after every edit.
		this.codeArea.removeAttribute('data-highlighted');
		hljs.highlightElement(this.codeArea);
	}

	_handleCodeAreaPaste(event) {
		event.stopPropagation();
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
		const highlightJSCSSElement = document.querySelector(`#${this.highlightCSSID}`);
		let highlightJSCSSURL = this._getThemeURLFromConfig();
		if (!highlightJSCSSElement) {
			const link = document.createElement('link');
			const head = document.querySelector('head');
			link.setAttribute('rel', 'stylesheet');
			link.setAttribute('href', highlightJSCSSURL);
			link.setAttribute('id', this.highlightCSSID);

			if (head) head.appendChild(link);
		}
		else highlightJSCSSElement.setAttribute('href', highlightJSCSSURL);
	}

	_getThemeURLFromConfig() {
		let themeURL = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@9.18.1/build/styles/atom-one-${this.config.useDefaultTheme}.min.css`;

		if (this.config.themeName) themeURL = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@9.18.1/build/styles/${this.config.themeName}.min.css`;
		if (this.config.themeURL) themeURL = this.config.themeURL;

		return themeURL;
	}
}


export default CodeBox;