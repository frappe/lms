import {
	a as b0,
	r as Vu,
	b as Gu,
	ae as R0,
	k as K,
	w as p0,
	D as b,
	s as k,
	u as D,
	A as C,
	E as F,
	F as q,
	y as I,
	z as R,
	$ as Z,
	K as cu,
	L as ou,
	C as U,
	af as P0,
	a8 as $0,
	j as O0,
	ag as j0,
	ah as U0,
	P as Z0,
	X as H0,
	B as V0,
	a2 as G0,
	Z as Q0,
} from "./frappe-ui.a747cf9c.js";
import { C as W0, _ as J0 } from "./CourseOutline.2110618a.js";
import { _ as Y0 } from "./UserAvatar.3cd4adb4.js";
import { t as X0, c as K0 } from "./index.6f049c1a.js";
import { c as Cu } from "./index.51e5b051.js";
const ue = Cu("CheckCircleIcon", [
		["path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14", key: "g774vq" }],
		["polyline", { points: "22 4 12 14.01 9 11.01", key: "6xbx8j" }],
	]),
	ee = Cu("ChevronLeftIcon", [
		["path", { d: "m15 18-6-6 6-6", key: "1wnfg3" }],
	]),
	Qu = Cu("MinusCircleIcon", [
		["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
		["line", { x1: "8", x2: "16", y1: "12", y2: "12", key: "1jonct" }],
	]),
	te = Cu("XCircleIcon", [
		["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
		["path", { d: "m15 9-6 6", key: "1uzhvr" }],
		["path", { d: "m9 9 6 6", key: "z0biqf" }],
	]),
	Wu = {};
function re(u) {
	let e = Wu[u];
	if (e) return e;
	e = Wu[u] = [];
	for (let t = 0; t < 128; t++) {
		const n = String.fromCharCode(t);
		e.push(n);
	}
	for (let t = 0; t < u.length; t++) {
		const n = u.charCodeAt(t);
		e[n] = "%" + ("0" + n.toString(16).toUpperCase()).slice(-2);
	}
	return e;
}
function tu(u, e) {
	typeof e != "string" && (e = tu.defaultChars);
	const t = re(e);
	return u.replace(/(%[a-f0-9]{2})+/gi, function (n) {
		let c = "";
		for (let r = 0, i = n.length; r < i; r += 3) {
			const o = parseInt(n.slice(r + 1, r + 3), 16);
			if (o < 128) {
				c += t[o];
				continue;
			}
			if ((o & 224) === 192 && r + 3 < i) {
				const a = parseInt(n.slice(r + 4, r + 6), 16);
				if ((a & 192) === 128) {
					const s = ((o << 6) & 1984) | (a & 63);
					s < 128
						? (c += "\uFFFD\uFFFD")
						: (c += String.fromCharCode(s)),
						(r += 3);
					continue;
				}
			}
			if ((o & 240) === 224 && r + 6 < i) {
				const a = parseInt(n.slice(r + 4, r + 6), 16),
					s = parseInt(n.slice(r + 7, r + 9), 16);
				if ((a & 192) === 128 && (s & 192) === 128) {
					const l =
						((o << 12) & 61440) | ((a << 6) & 4032) | (s & 63);
					l < 2048 || (l >= 55296 && l <= 57343)
						? (c += "\uFFFD\uFFFD\uFFFD")
						: (c += String.fromCharCode(l)),
						(r += 6);
					continue;
				}
			}
			if ((o & 248) === 240 && r + 9 < i) {
				const a = parseInt(n.slice(r + 4, r + 6), 16),
					s = parseInt(n.slice(r + 7, r + 9), 16),
					l = parseInt(n.slice(r + 10, r + 12), 16);
				if (
					(a & 192) === 128 &&
					(s & 192) === 128 &&
					(l & 192) === 128
				) {
					let f =
						((o << 18) & 1835008) |
						((a << 12) & 258048) |
						((s << 6) & 4032) |
						(l & 63);
					f < 65536 || f > 1114111
						? (c += "\uFFFD\uFFFD\uFFFD\uFFFD")
						: ((f -= 65536),
						  (c += String.fromCharCode(
								55296 + (f >> 10),
								56320 + (f & 1023)
						  ))),
						(r += 9);
					continue;
				}
			}
			c += "\uFFFD";
		}
		return c;
	});
}
tu.defaultChars = ";/?:@&=+$,#";
tu.componentChars = "";
const Ju = {};
function ne(u) {
	let e = Ju[u];
	if (e) return e;
	e = Ju[u] = [];
	for (let t = 0; t < 128; t++) {
		const n = String.fromCharCode(t);
		/^[0-9a-z]$/i.test(n)
			? e.push(n)
			: e.push("%" + ("0" + t.toString(16).toUpperCase()).slice(-2));
	}
	for (let t = 0; t < u.length; t++) e[u.charCodeAt(t)] = u[t];
	return e;
}
function du(u, e, t) {
	typeof e != "string" && ((t = e), (e = du.defaultChars)),
		typeof t == "undefined" && (t = !0);
	const n = ne(e);
	let c = "";
	for (let r = 0, i = u.length; r < i; r++) {
		const o = u.charCodeAt(r);
		if (
			t &&
			o === 37 &&
			r + 2 < i &&
			/^[0-9a-f]{2}$/i.test(u.slice(r + 1, r + 3))
		) {
			(c += u.slice(r, r + 3)), (r += 2);
			continue;
		}
		if (o < 128) {
			c += n[o];
			continue;
		}
		if (o >= 55296 && o <= 57343) {
			if (o >= 55296 && o <= 56319 && r + 1 < i) {
				const a = u.charCodeAt(r + 1);
				if (a >= 56320 && a <= 57343) {
					(c += encodeURIComponent(u[r] + u[r + 1])), r++;
					continue;
				}
			}
			c += "%EF%BF%BD";
			continue;
		}
		c += encodeURIComponent(u[r]);
	}
	return c;
}
du.defaultChars = ";/?:@&=+$,-_.!~*'()#";
du.componentChars = "-_.!~*'()";
function Pu(u) {
	let e = "";
	return (
		(e += u.protocol || ""),
		(e += u.slashes ? "//" : ""),
		(e += u.auth ? u.auth + "@" : ""),
		u.hostname && u.hostname.indexOf(":") !== -1
			? (e += "[" + u.hostname + "]")
			: (e += u.hostname || ""),
		(e += u.port ? ":" + u.port : ""),
		(e += u.pathname || ""),
		(e += u.search || ""),
		(e += u.hash || ""),
		e
	);
}
function ku() {
	(this.protocol = null),
		(this.slashes = null),
		(this.auth = null),
		(this.port = null),
		(this.hostname = null),
		(this.hash = null),
		(this.search = null),
		(this.pathname = null);
}
const ce = /^([a-z0-9.+-]+:)/i,
	oe = /:[0-9]*$/,
	ie = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,
	ae = [
		"<",
		">",
		'"',
		"`",
		" ",
		"\r",
		`
`,
		"	",
	],
	se = ["{", "}", "|", "\\", "^", "`"].concat(ae),
	le = ["'"].concat(se),
	Yu = ["%", "/", "?", ";", "#"].concat(le),
	Xu = ["/", "?", "#"],
	fe = 255,
	Ku = /^[+a-z0-9A-Z_-]{0,63}$/,
	de = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
	u0 = { javascript: !0, "javascript:": !0 },
	e0 = {
		http: !0,
		https: !0,
		ftp: !0,
		gopher: !0,
		file: !0,
		"http:": !0,
		"https:": !0,
		"ftp:": !0,
		"gopher:": !0,
		"file:": !0,
	};
function $u(u, e) {
	if (u && u instanceof ku) return u;
	const t = new ku();
	return t.parse(u, e), t;
}
ku.prototype.parse = function (u, e) {
	let t,
		n,
		c,
		r = u;
	if (((r = r.trim()), !e && u.split("#").length === 1)) {
		const s = ie.exec(r);
		if (s)
			return (this.pathname = s[1]), s[2] && (this.search = s[2]), this;
	}
	let i = ce.exec(r);
	if (
		(i &&
			((i = i[0]),
			(t = i.toLowerCase()),
			(this.protocol = i),
			(r = r.substr(i.length))),
		(e || i || r.match(/^\/\/[^@\/]+@[^@\/]+/)) &&
			((c = r.substr(0, 2) === "//"),
			c && !(i && u0[i]) && ((r = r.substr(2)), (this.slashes = !0))),
		!u0[i] && (c || (i && !e0[i])))
	) {
		let s = -1;
		for (let d = 0; d < Xu.length; d++)
			(n = r.indexOf(Xu[d])), n !== -1 && (s === -1 || n < s) && (s = n);
		let l, f;
		s === -1 ? (f = r.lastIndexOf("@")) : (f = r.lastIndexOf("@", s)),
			f !== -1 &&
				((l = r.slice(0, f)), (r = r.slice(f + 1)), (this.auth = l)),
			(s = -1);
		for (let d = 0; d < Yu.length; d++)
			(n = r.indexOf(Yu[d])), n !== -1 && (s === -1 || n < s) && (s = n);
		s === -1 && (s = r.length), r[s - 1] === ":" && s--;
		const p = r.slice(0, s);
		(r = r.slice(s)),
			this.parseHost(p),
			(this.hostname = this.hostname || "");
		const h =
			this.hostname[0] === "[" &&
			this.hostname[this.hostname.length - 1] === "]";
		if (!h) {
			const d = this.hostname.split(/\./);
			for (let y = 0, g = d.length; y < g; y++) {
				const w = d[y];
				if (!!w && !w.match(Ku)) {
					let v = "";
					for (let x = 0, A = w.length; x < A; x++)
						w.charCodeAt(x) > 127 ? (v += "x") : (v += w[x]);
					if (!v.match(Ku)) {
						const x = d.slice(0, y),
							A = d.slice(y + 1),
							_ = w.match(de);
						_ && (x.push(_[1]), A.unshift(_[2])),
							A.length && (r = A.join(".") + r),
							(this.hostname = x.join("."));
						break;
					}
				}
			}
		}
		this.hostname.length > fe && (this.hostname = ""),
			h &&
				(this.hostname = this.hostname.substr(
					1,
					this.hostname.length - 2
				));
	}
	const o = r.indexOf("#");
	o !== -1 && ((this.hash = r.substr(o)), (r = r.slice(0, o)));
	const a = r.indexOf("?");
	return (
		a !== -1 && ((this.search = r.substr(a)), (r = r.slice(0, a))),
		r && (this.pathname = r),
		e0[t] && this.hostname && !this.pathname && (this.pathname = ""),
		this
	);
};
ku.prototype.parseHost = function (u) {
	let e = oe.exec(u);
	e &&
		((e = e[0]),
		e !== ":" && (this.port = e.substr(1)),
		(u = u.substr(0, u.length - e.length))),
		u && (this.hostname = u);
};
const he = Object.freeze(
		Object.defineProperty(
			{ __proto__: null, decode: tu, encode: du, format: Pu, parse: $u },
			Symbol.toStringTag,
			{ value: "Module" }
		)
	),
	be =
		/[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/,
	pe = /[\0-\x1F\x7F-\x9F]/,
	_e =
		/[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/,
	_0 =
		/[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDEAD\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/,
	me = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/,
	xe = Object.freeze(
		Object.defineProperty(
			{ __proto__: null, Any: be, Cc: pe, Cf: _e, P: _0, Z: me },
			Symbol.toStringTag,
			{ value: "Module" }
		)
	),
	ke = new Uint16Array(
		'\u1D41<\xD5\u0131\u028A\u049D\u057B\u05D0\u0675\u06DE\u07A2\u07D6\u080F\u0A4A\u0A91\u0DA1\u0E6D\u0F09\u0F26\u10CA\u1228\u12E1\u1415\u149D\u14C3\u14DF\u1525\0\0\0\0\0\0\u156B\u16CD\u198D\u1C12\u1DDD\u1F7E\u2060\u21B0\u228D\u23C0\u23FB\u2442\u2824\u2912\u2D08\u2E48\u2FCE\u3016\u32BA\u3639\u37AC\u38FE\u3A28\u3A71\u3AE0\u3B2E\u0800EMabcfglmnoprstu\\bfms\x7F\x84\x8B\x90\x95\x98\xA6\xB3\xB9\xC8\xCFlig\u803B\xC6\u40C6P\u803B&\u4026cute\u803B\xC1\u40C1reve;\u4102\u0100iyx}rc\u803B\xC2\u40C2;\u4410r;\uC000\u{1D504}rave\u803B\xC0\u40C0pha;\u4391acr;\u4100d;\u6A53\u0100gp\x9D\xA1on;\u4104f;\uC000\u{1D538}plyFunction;\u6061ing\u803B\xC5\u40C5\u0100cs\xBE\xC3r;\uC000\u{1D49C}ign;\u6254ilde\u803B\xC3\u40C3ml\u803B\xC4\u40C4\u0400aceforsu\xE5\xFB\xFE\u0117\u011C\u0122\u0127\u012A\u0100cr\xEA\xF2kslash;\u6216\u0176\xF6\xF8;\u6AE7ed;\u6306y;\u4411\u0180crt\u0105\u010B\u0114ause;\u6235noullis;\u612Ca;\u4392r;\uC000\u{1D505}pf;\uC000\u{1D539}eve;\u42D8c\xF2\u0113mpeq;\u624E\u0700HOacdefhilorsu\u014D\u0151\u0156\u0180\u019E\u01A2\u01B5\u01B7\u01BA\u01DC\u0215\u0273\u0278\u027Ecy;\u4427PY\u803B\xA9\u40A9\u0180cpy\u015D\u0162\u017Aute;\u4106\u0100;i\u0167\u0168\u62D2talDifferentialD;\u6145leys;\u612D\u0200aeio\u0189\u018E\u0194\u0198ron;\u410Cdil\u803B\xC7\u40C7rc;\u4108nint;\u6230ot;\u410A\u0100dn\u01A7\u01ADilla;\u40B8terDot;\u40B7\xF2\u017Fi;\u43A7rcle\u0200DMPT\u01C7\u01CB\u01D1\u01D6ot;\u6299inus;\u6296lus;\u6295imes;\u6297o\u0100cs\u01E2\u01F8kwiseContourIntegral;\u6232eCurly\u0100DQ\u0203\u020FoubleQuote;\u601Duote;\u6019\u0200lnpu\u021E\u0228\u0247\u0255on\u0100;e\u0225\u0226\u6237;\u6A74\u0180git\u022F\u0236\u023Aruent;\u6261nt;\u622FourIntegral;\u622E\u0100fr\u024C\u024E;\u6102oduct;\u6210nterClockwiseContourIntegral;\u6233oss;\u6A2Fcr;\uC000\u{1D49E}p\u0100;C\u0284\u0285\u62D3ap;\u624D\u0580DJSZacefios\u02A0\u02AC\u02B0\u02B4\u02B8\u02CB\u02D7\u02E1\u02E6\u0333\u048D\u0100;o\u0179\u02A5trahd;\u6911cy;\u4402cy;\u4405cy;\u440F\u0180grs\u02BF\u02C4\u02C7ger;\u6021r;\u61A1hv;\u6AE4\u0100ay\u02D0\u02D5ron;\u410E;\u4414l\u0100;t\u02DD\u02DE\u6207a;\u4394r;\uC000\u{1D507}\u0100af\u02EB\u0327\u0100cm\u02F0\u0322ritical\u0200ADGT\u0300\u0306\u0316\u031Ccute;\u40B4o\u0174\u030B\u030D;\u42D9bleAcute;\u42DDrave;\u4060ilde;\u42DCond;\u62C4ferentialD;\u6146\u0470\u033D\0\0\0\u0342\u0354\0\u0405f;\uC000\u{1D53B}\u0180;DE\u0348\u0349\u034D\u40A8ot;\u60DCqual;\u6250ble\u0300CDLRUV\u0363\u0372\u0382\u03CF\u03E2\u03F8ontourIntegra\xEC\u0239o\u0274\u0379\0\0\u037B\xBB\u0349nArrow;\u61D3\u0100eo\u0387\u03A4ft\u0180ART\u0390\u0396\u03A1rrow;\u61D0ightArrow;\u61D4e\xE5\u02CAng\u0100LR\u03AB\u03C4eft\u0100AR\u03B3\u03B9rrow;\u67F8ightArrow;\u67FAightArrow;\u67F9ight\u0100AT\u03D8\u03DErrow;\u61D2ee;\u62A8p\u0241\u03E9\0\0\u03EFrrow;\u61D1ownArrow;\u61D5erticalBar;\u6225n\u0300ABLRTa\u0412\u042A\u0430\u045E\u047F\u037Crrow\u0180;BU\u041D\u041E\u0422\u6193ar;\u6913pArrow;\u61F5reve;\u4311eft\u02D2\u043A\0\u0446\0\u0450ightVector;\u6950eeVector;\u695Eector\u0100;B\u0459\u045A\u61BDar;\u6956ight\u01D4\u0467\0\u0471eeVector;\u695Fector\u0100;B\u047A\u047B\u61C1ar;\u6957ee\u0100;A\u0486\u0487\u62A4rrow;\u61A7\u0100ct\u0492\u0497r;\uC000\u{1D49F}rok;\u4110\u0800NTacdfglmopqstux\u04BD\u04C0\u04C4\u04CB\u04DE\u04E2\u04E7\u04EE\u04F5\u0521\u052F\u0536\u0552\u055D\u0560\u0565G;\u414AH\u803B\xD0\u40D0cute\u803B\xC9\u40C9\u0180aiy\u04D2\u04D7\u04DCron;\u411Arc\u803B\xCA\u40CA;\u442Dot;\u4116r;\uC000\u{1D508}rave\u803B\xC8\u40C8ement;\u6208\u0100ap\u04FA\u04FEcr;\u4112ty\u0253\u0506\0\0\u0512mallSquare;\u65FBerySmallSquare;\u65AB\u0100gp\u0526\u052Aon;\u4118f;\uC000\u{1D53C}silon;\u4395u\u0100ai\u053C\u0549l\u0100;T\u0542\u0543\u6A75ilde;\u6242librium;\u61CC\u0100ci\u0557\u055Ar;\u6130m;\u6A73a;\u4397ml\u803B\xCB\u40CB\u0100ip\u056A\u056Fsts;\u6203onentialE;\u6147\u0280cfios\u0585\u0588\u058D\u05B2\u05CCy;\u4424r;\uC000\u{1D509}lled\u0253\u0597\0\0\u05A3mallSquare;\u65FCerySmallSquare;\u65AA\u0370\u05BA\0\u05BF\0\0\u05C4f;\uC000\u{1D53D}All;\u6200riertrf;\u6131c\xF2\u05CB\u0600JTabcdfgorst\u05E8\u05EC\u05EF\u05FA\u0600\u0612\u0616\u061B\u061D\u0623\u066C\u0672cy;\u4403\u803B>\u403Emma\u0100;d\u05F7\u05F8\u4393;\u43DCreve;\u411E\u0180eiy\u0607\u060C\u0610dil;\u4122rc;\u411C;\u4413ot;\u4120r;\uC000\u{1D50A};\u62D9pf;\uC000\u{1D53E}eater\u0300EFGLST\u0635\u0644\u064E\u0656\u065B\u0666qual\u0100;L\u063E\u063F\u6265ess;\u62DBullEqual;\u6267reater;\u6AA2ess;\u6277lantEqual;\u6A7Eilde;\u6273cr;\uC000\u{1D4A2};\u626B\u0400Aacfiosu\u0685\u068B\u0696\u069B\u069E\u06AA\u06BE\u06CARDcy;\u442A\u0100ct\u0690\u0694ek;\u42C7;\u405Eirc;\u4124r;\u610ClbertSpace;\u610B\u01F0\u06AF\0\u06B2f;\u610DizontalLine;\u6500\u0100ct\u06C3\u06C5\xF2\u06A9rok;\u4126mp\u0144\u06D0\u06D8ownHum\xF0\u012Fqual;\u624F\u0700EJOacdfgmnostu\u06FA\u06FE\u0703\u0707\u070E\u071A\u071E\u0721\u0728\u0744\u0778\u078B\u078F\u0795cy;\u4415lig;\u4132cy;\u4401cute\u803B\xCD\u40CD\u0100iy\u0713\u0718rc\u803B\xCE\u40CE;\u4418ot;\u4130r;\u6111rave\u803B\xCC\u40CC\u0180;ap\u0720\u072F\u073F\u0100cg\u0734\u0737r;\u412AinaryI;\u6148lie\xF3\u03DD\u01F4\u0749\0\u0762\u0100;e\u074D\u074E\u622C\u0100gr\u0753\u0758ral;\u622Bsection;\u62C2isible\u0100CT\u076C\u0772omma;\u6063imes;\u6062\u0180gpt\u077F\u0783\u0788on;\u412Ef;\uC000\u{1D540}a;\u4399cr;\u6110ilde;\u4128\u01EB\u079A\0\u079Ecy;\u4406l\u803B\xCF\u40CF\u0280cfosu\u07AC\u07B7\u07BC\u07C2\u07D0\u0100iy\u07B1\u07B5rc;\u4134;\u4419r;\uC000\u{1D50D}pf;\uC000\u{1D541}\u01E3\u07C7\0\u07CCr;\uC000\u{1D4A5}rcy;\u4408kcy;\u4404\u0380HJacfos\u07E4\u07E8\u07EC\u07F1\u07FD\u0802\u0808cy;\u4425cy;\u440Cppa;\u439A\u0100ey\u07F6\u07FBdil;\u4136;\u441Ar;\uC000\u{1D50E}pf;\uC000\u{1D542}cr;\uC000\u{1D4A6}\u0580JTaceflmost\u0825\u0829\u082C\u0850\u0863\u09B3\u09B8\u09C7\u09CD\u0A37\u0A47cy;\u4409\u803B<\u403C\u0280cmnpr\u0837\u083C\u0841\u0844\u084Dute;\u4139bda;\u439Bg;\u67EAlacetrf;\u6112r;\u619E\u0180aey\u0857\u085C\u0861ron;\u413Ddil;\u413B;\u441B\u0100fs\u0868\u0970t\u0500ACDFRTUVar\u087E\u08A9\u08B1\u08E0\u08E6\u08FC\u092F\u095B\u0390\u096A\u0100nr\u0883\u088FgleBracket;\u67E8row\u0180;BR\u0899\u089A\u089E\u6190ar;\u61E4ightArrow;\u61C6eiling;\u6308o\u01F5\u08B7\0\u08C3bleBracket;\u67E6n\u01D4\u08C8\0\u08D2eeVector;\u6961ector\u0100;B\u08DB\u08DC\u61C3ar;\u6959loor;\u630Aight\u0100AV\u08EF\u08F5rrow;\u6194ector;\u694E\u0100er\u0901\u0917e\u0180;AV\u0909\u090A\u0910\u62A3rrow;\u61A4ector;\u695Aiangle\u0180;BE\u0924\u0925\u0929\u62B2ar;\u69CFqual;\u62B4p\u0180DTV\u0937\u0942\u094CownVector;\u6951eeVector;\u6960ector\u0100;B\u0956\u0957\u61BFar;\u6958ector\u0100;B\u0965\u0966\u61BCar;\u6952ight\xE1\u039Cs\u0300EFGLST\u097E\u098B\u0995\u099D\u09A2\u09ADqualGreater;\u62DAullEqual;\u6266reater;\u6276ess;\u6AA1lantEqual;\u6A7Dilde;\u6272r;\uC000\u{1D50F}\u0100;e\u09BD\u09BE\u62D8ftarrow;\u61DAidot;\u413F\u0180npw\u09D4\u0A16\u0A1Bg\u0200LRlr\u09DE\u09F7\u0A02\u0A10eft\u0100AR\u09E6\u09ECrrow;\u67F5ightArrow;\u67F7ightArrow;\u67F6eft\u0100ar\u03B3\u0A0Aight\xE1\u03BFight\xE1\u03CAf;\uC000\u{1D543}er\u0100LR\u0A22\u0A2CeftArrow;\u6199ightArrow;\u6198\u0180cht\u0A3E\u0A40\u0A42\xF2\u084C;\u61B0rok;\u4141;\u626A\u0400acefiosu\u0A5A\u0A5D\u0A60\u0A77\u0A7C\u0A85\u0A8B\u0A8Ep;\u6905y;\u441C\u0100dl\u0A65\u0A6FiumSpace;\u605Flintrf;\u6133r;\uC000\u{1D510}nusPlus;\u6213pf;\uC000\u{1D544}c\xF2\u0A76;\u439C\u0480Jacefostu\u0AA3\u0AA7\u0AAD\u0AC0\u0B14\u0B19\u0D91\u0D97\u0D9Ecy;\u440Acute;\u4143\u0180aey\u0AB4\u0AB9\u0ABEron;\u4147dil;\u4145;\u441D\u0180gsw\u0AC7\u0AF0\u0B0Eative\u0180MTV\u0AD3\u0ADF\u0AE8ediumSpace;\u600Bhi\u0100cn\u0AE6\u0AD8\xEB\u0AD9eryThi\xEE\u0AD9ted\u0100GL\u0AF8\u0B06reaterGreate\xF2\u0673essLes\xF3\u0A48Line;\u400Ar;\uC000\u{1D511}\u0200Bnpt\u0B22\u0B28\u0B37\u0B3Areak;\u6060BreakingSpace;\u40A0f;\u6115\u0680;CDEGHLNPRSTV\u0B55\u0B56\u0B6A\u0B7C\u0BA1\u0BEB\u0C04\u0C5E\u0C84\u0CA6\u0CD8\u0D61\u0D85\u6AEC\u0100ou\u0B5B\u0B64ngruent;\u6262pCap;\u626DoubleVerticalBar;\u6226\u0180lqx\u0B83\u0B8A\u0B9Bement;\u6209ual\u0100;T\u0B92\u0B93\u6260ilde;\uC000\u2242\u0338ists;\u6204reater\u0380;EFGLST\u0BB6\u0BB7\u0BBD\u0BC9\u0BD3\u0BD8\u0BE5\u626Fqual;\u6271ullEqual;\uC000\u2267\u0338reater;\uC000\u226B\u0338ess;\u6279lantEqual;\uC000\u2A7E\u0338ilde;\u6275ump\u0144\u0BF2\u0BFDownHump;\uC000\u224E\u0338qual;\uC000\u224F\u0338e\u0100fs\u0C0A\u0C27tTriangle\u0180;BE\u0C1A\u0C1B\u0C21\u62EAar;\uC000\u29CF\u0338qual;\u62ECs\u0300;EGLST\u0C35\u0C36\u0C3C\u0C44\u0C4B\u0C58\u626Equal;\u6270reater;\u6278ess;\uC000\u226A\u0338lantEqual;\uC000\u2A7D\u0338ilde;\u6274ested\u0100GL\u0C68\u0C79reaterGreater;\uC000\u2AA2\u0338essLess;\uC000\u2AA1\u0338recedes\u0180;ES\u0C92\u0C93\u0C9B\u6280qual;\uC000\u2AAF\u0338lantEqual;\u62E0\u0100ei\u0CAB\u0CB9verseElement;\u620CghtTriangle\u0180;BE\u0CCB\u0CCC\u0CD2\u62EBar;\uC000\u29D0\u0338qual;\u62ED\u0100qu\u0CDD\u0D0CuareSu\u0100bp\u0CE8\u0CF9set\u0100;E\u0CF0\u0CF3\uC000\u228F\u0338qual;\u62E2erset\u0100;E\u0D03\u0D06\uC000\u2290\u0338qual;\u62E3\u0180bcp\u0D13\u0D24\u0D4Eset\u0100;E\u0D1B\u0D1E\uC000\u2282\u20D2qual;\u6288ceeds\u0200;EST\u0D32\u0D33\u0D3B\u0D46\u6281qual;\uC000\u2AB0\u0338lantEqual;\u62E1ilde;\uC000\u227F\u0338erset\u0100;E\u0D58\u0D5B\uC000\u2283\u20D2qual;\u6289ilde\u0200;EFT\u0D6E\u0D6F\u0D75\u0D7F\u6241qual;\u6244ullEqual;\u6247ilde;\u6249erticalBar;\u6224cr;\uC000\u{1D4A9}ilde\u803B\xD1\u40D1;\u439D\u0700Eacdfgmoprstuv\u0DBD\u0DC2\u0DC9\u0DD5\u0DDB\u0DE0\u0DE7\u0DFC\u0E02\u0E20\u0E22\u0E32\u0E3F\u0E44lig;\u4152cute\u803B\xD3\u40D3\u0100iy\u0DCE\u0DD3rc\u803B\xD4\u40D4;\u441Eblac;\u4150r;\uC000\u{1D512}rave\u803B\xD2\u40D2\u0180aei\u0DEE\u0DF2\u0DF6cr;\u414Cga;\u43A9cron;\u439Fpf;\uC000\u{1D546}enCurly\u0100DQ\u0E0E\u0E1AoubleQuote;\u601Cuote;\u6018;\u6A54\u0100cl\u0E27\u0E2Cr;\uC000\u{1D4AA}ash\u803B\xD8\u40D8i\u016C\u0E37\u0E3Cde\u803B\xD5\u40D5es;\u6A37ml\u803B\xD6\u40D6er\u0100BP\u0E4B\u0E60\u0100ar\u0E50\u0E53r;\u603Eac\u0100ek\u0E5A\u0E5C;\u63DEet;\u63B4arenthesis;\u63DC\u0480acfhilors\u0E7F\u0E87\u0E8A\u0E8F\u0E92\u0E94\u0E9D\u0EB0\u0EFCrtialD;\u6202y;\u441Fr;\uC000\u{1D513}i;\u43A6;\u43A0usMinus;\u40B1\u0100ip\u0EA2\u0EADncareplan\xE5\u069Df;\u6119\u0200;eio\u0EB9\u0EBA\u0EE0\u0EE4\u6ABBcedes\u0200;EST\u0EC8\u0EC9\u0ECF\u0EDA\u627Aqual;\u6AAFlantEqual;\u627Cilde;\u627Eme;\u6033\u0100dp\u0EE9\u0EEEuct;\u620Fortion\u0100;a\u0225\u0EF9l;\u621D\u0100ci\u0F01\u0F06r;\uC000\u{1D4AB};\u43A8\u0200Ufos\u0F11\u0F16\u0F1B\u0F1FOT\u803B"\u4022r;\uC000\u{1D514}pf;\u611Acr;\uC000\u{1D4AC}\u0600BEacefhiorsu\u0F3E\u0F43\u0F47\u0F60\u0F73\u0FA7\u0FAA\u0FAD\u1096\u10A9\u10B4\u10BEarr;\u6910G\u803B\xAE\u40AE\u0180cnr\u0F4E\u0F53\u0F56ute;\u4154g;\u67EBr\u0100;t\u0F5C\u0F5D\u61A0l;\u6916\u0180aey\u0F67\u0F6C\u0F71ron;\u4158dil;\u4156;\u4420\u0100;v\u0F78\u0F79\u611Cerse\u0100EU\u0F82\u0F99\u0100lq\u0F87\u0F8Eement;\u620Builibrium;\u61CBpEquilibrium;\u696Fr\xBB\u0F79o;\u43A1ght\u0400ACDFTUVa\u0FC1\u0FEB\u0FF3\u1022\u1028\u105B\u1087\u03D8\u0100nr\u0FC6\u0FD2gleBracket;\u67E9row\u0180;BL\u0FDC\u0FDD\u0FE1\u6192ar;\u61E5eftArrow;\u61C4eiling;\u6309o\u01F5\u0FF9\0\u1005bleBracket;\u67E7n\u01D4\u100A\0\u1014eeVector;\u695Dector\u0100;B\u101D\u101E\u61C2ar;\u6955loor;\u630B\u0100er\u102D\u1043e\u0180;AV\u1035\u1036\u103C\u62A2rrow;\u61A6ector;\u695Biangle\u0180;BE\u1050\u1051\u1055\u62B3ar;\u69D0qual;\u62B5p\u0180DTV\u1063\u106E\u1078ownVector;\u694FeeVector;\u695Cector\u0100;B\u1082\u1083\u61BEar;\u6954ector\u0100;B\u1091\u1092\u61C0ar;\u6953\u0100pu\u109B\u109Ef;\u611DndImplies;\u6970ightarrow;\u61DB\u0100ch\u10B9\u10BCr;\u611B;\u61B1leDelayed;\u69F4\u0680HOacfhimoqstu\u10E4\u10F1\u10F7\u10FD\u1119\u111E\u1151\u1156\u1161\u1167\u11B5\u11BB\u11BF\u0100Cc\u10E9\u10EEHcy;\u4429y;\u4428FTcy;\u442Ccute;\u415A\u0280;aeiy\u1108\u1109\u110E\u1113\u1117\u6ABCron;\u4160dil;\u415Erc;\u415C;\u4421r;\uC000\u{1D516}ort\u0200DLRU\u112A\u1134\u113E\u1149ownArrow\xBB\u041EeftArrow\xBB\u089AightArrow\xBB\u0FDDpArrow;\u6191gma;\u43A3allCircle;\u6218pf;\uC000\u{1D54A}\u0272\u116D\0\0\u1170t;\u621Aare\u0200;ISU\u117B\u117C\u1189\u11AF\u65A1ntersection;\u6293u\u0100bp\u118F\u119Eset\u0100;E\u1197\u1198\u628Fqual;\u6291erset\u0100;E\u11A8\u11A9\u6290qual;\u6292nion;\u6294cr;\uC000\u{1D4AE}ar;\u62C6\u0200bcmp\u11C8\u11DB\u1209\u120B\u0100;s\u11CD\u11CE\u62D0et\u0100;E\u11CD\u11D5qual;\u6286\u0100ch\u11E0\u1205eeds\u0200;EST\u11ED\u11EE\u11F4\u11FF\u627Bqual;\u6AB0lantEqual;\u627Dilde;\u627FTh\xE1\u0F8C;\u6211\u0180;es\u1212\u1213\u1223\u62D1rset\u0100;E\u121C\u121D\u6283qual;\u6287et\xBB\u1213\u0580HRSacfhiors\u123E\u1244\u1249\u1255\u125E\u1271\u1276\u129F\u12C2\u12C8\u12D1ORN\u803B\xDE\u40DEADE;\u6122\u0100Hc\u124E\u1252cy;\u440By;\u4426\u0100bu\u125A\u125C;\u4009;\u43A4\u0180aey\u1265\u126A\u126Fron;\u4164dil;\u4162;\u4422r;\uC000\u{1D517}\u0100ei\u127B\u1289\u01F2\u1280\0\u1287efore;\u6234a;\u4398\u0100cn\u128E\u1298kSpace;\uC000\u205F\u200ASpace;\u6009lde\u0200;EFT\u12AB\u12AC\u12B2\u12BC\u623Cqual;\u6243ullEqual;\u6245ilde;\u6248pf;\uC000\u{1D54B}ipleDot;\u60DB\u0100ct\u12D6\u12DBr;\uC000\u{1D4AF}rok;\u4166\u0AE1\u12F7\u130E\u131A\u1326\0\u132C\u1331\0\0\0\0\0\u1338\u133D\u1377\u1385\0\u13FF\u1404\u140A\u1410\u0100cr\u12FB\u1301ute\u803B\xDA\u40DAr\u0100;o\u1307\u1308\u619Fcir;\u6949r\u01E3\u1313\0\u1316y;\u440Eve;\u416C\u0100iy\u131E\u1323rc\u803B\xDB\u40DB;\u4423blac;\u4170r;\uC000\u{1D518}rave\u803B\xD9\u40D9acr;\u416A\u0100di\u1341\u1369er\u0100BP\u1348\u135D\u0100ar\u134D\u1350r;\u405Fac\u0100ek\u1357\u1359;\u63DFet;\u63B5arenthesis;\u63DDon\u0100;P\u1370\u1371\u62C3lus;\u628E\u0100gp\u137B\u137Fon;\u4172f;\uC000\u{1D54C}\u0400ADETadps\u1395\u13AE\u13B8\u13C4\u03E8\u13D2\u13D7\u13F3rrow\u0180;BD\u1150\u13A0\u13A4ar;\u6912ownArrow;\u61C5ownArrow;\u6195quilibrium;\u696Eee\u0100;A\u13CB\u13CC\u62A5rrow;\u61A5own\xE1\u03F3er\u0100LR\u13DE\u13E8eftArrow;\u6196ightArrow;\u6197i\u0100;l\u13F9\u13FA\u43D2on;\u43A5ing;\u416Ecr;\uC000\u{1D4B0}ilde;\u4168ml\u803B\xDC\u40DC\u0480Dbcdefosv\u1427\u142C\u1430\u1433\u143E\u1485\u148A\u1490\u1496ash;\u62ABar;\u6AEBy;\u4412ash\u0100;l\u143B\u143C\u62A9;\u6AE6\u0100er\u1443\u1445;\u62C1\u0180bty\u144C\u1450\u147Aar;\u6016\u0100;i\u144F\u1455cal\u0200BLST\u1461\u1465\u146A\u1474ar;\u6223ine;\u407Ceparator;\u6758ilde;\u6240ThinSpace;\u600Ar;\uC000\u{1D519}pf;\uC000\u{1D54D}cr;\uC000\u{1D4B1}dash;\u62AA\u0280cefos\u14A7\u14AC\u14B1\u14B6\u14BCirc;\u4174dge;\u62C0r;\uC000\u{1D51A}pf;\uC000\u{1D54E}cr;\uC000\u{1D4B2}\u0200fios\u14CB\u14D0\u14D2\u14D8r;\uC000\u{1D51B};\u439Epf;\uC000\u{1D54F}cr;\uC000\u{1D4B3}\u0480AIUacfosu\u14F1\u14F5\u14F9\u14FD\u1504\u150F\u1514\u151A\u1520cy;\u442Fcy;\u4407cy;\u442Ecute\u803B\xDD\u40DD\u0100iy\u1509\u150Drc;\u4176;\u442Br;\uC000\u{1D51C}pf;\uC000\u{1D550}cr;\uC000\u{1D4B4}ml;\u4178\u0400Hacdefos\u1535\u1539\u153F\u154B\u154F\u155D\u1560\u1564cy;\u4416cute;\u4179\u0100ay\u1544\u1549ron;\u417D;\u4417ot;\u417B\u01F2\u1554\0\u155BoWidt\xE8\u0AD9a;\u4396r;\u6128pf;\u6124cr;\uC000\u{1D4B5}\u0BE1\u1583\u158A\u1590\0\u15B0\u15B6\u15BF\0\0\0\0\u15C6\u15DB\u15EB\u165F\u166D\0\u1695\u169B\u16B2\u16B9\0\u16BEcute\u803B\xE1\u40E1reve;\u4103\u0300;Ediuy\u159C\u159D\u15A1\u15A3\u15A8\u15AD\u623E;\uC000\u223E\u0333;\u623Frc\u803B\xE2\u40E2te\u80BB\xB4\u0306;\u4430lig\u803B\xE6\u40E6\u0100;r\xB2\u15BA;\uC000\u{1D51E}rave\u803B\xE0\u40E0\u0100ep\u15CA\u15D6\u0100fp\u15CF\u15D4sym;\u6135\xE8\u15D3ha;\u43B1\u0100ap\u15DFc\u0100cl\u15E4\u15E7r;\u4101g;\u6A3F\u0264\u15F0\0\0\u160A\u0280;adsv\u15FA\u15FB\u15FF\u1601\u1607\u6227nd;\u6A55;\u6A5Clope;\u6A58;\u6A5A\u0380;elmrsz\u1618\u1619\u161B\u161E\u163F\u164F\u1659\u6220;\u69A4e\xBB\u1619sd\u0100;a\u1625\u1626\u6221\u0461\u1630\u1632\u1634\u1636\u1638\u163A\u163C\u163E;\u69A8;\u69A9;\u69AA;\u69AB;\u69AC;\u69AD;\u69AE;\u69AFt\u0100;v\u1645\u1646\u621Fb\u0100;d\u164C\u164D\u62BE;\u699D\u0100pt\u1654\u1657h;\u6222\xBB\xB9arr;\u637C\u0100gp\u1663\u1667on;\u4105f;\uC000\u{1D552}\u0380;Eaeiop\u12C1\u167B\u167D\u1682\u1684\u1687\u168A;\u6A70cir;\u6A6F;\u624Ad;\u624Bs;\u4027rox\u0100;e\u12C1\u1692\xF1\u1683ing\u803B\xE5\u40E5\u0180cty\u16A1\u16A6\u16A8r;\uC000\u{1D4B6};\u402Amp\u0100;e\u12C1\u16AF\xF1\u0288ilde\u803B\xE3\u40E3ml\u803B\xE4\u40E4\u0100ci\u16C2\u16C8onin\xF4\u0272nt;\u6A11\u0800Nabcdefiklnoprsu\u16ED\u16F1\u1730\u173C\u1743\u1748\u1778\u177D\u17E0\u17E6\u1839\u1850\u170D\u193D\u1948\u1970ot;\u6AED\u0100cr\u16F6\u171Ek\u0200ceps\u1700\u1705\u170D\u1713ong;\u624Cpsilon;\u43F6rime;\u6035im\u0100;e\u171A\u171B\u623Dq;\u62CD\u0176\u1722\u1726ee;\u62BDed\u0100;g\u172C\u172D\u6305e\xBB\u172Drk\u0100;t\u135C\u1737brk;\u63B6\u0100oy\u1701\u1741;\u4431quo;\u601E\u0280cmprt\u1753\u175B\u1761\u1764\u1768aus\u0100;e\u010A\u0109ptyv;\u69B0s\xE9\u170Cno\xF5\u0113\u0180ahw\u176F\u1771\u1773;\u43B2;\u6136een;\u626Cr;\uC000\u{1D51F}g\u0380costuvw\u178D\u179D\u17B3\u17C1\u17D5\u17DB\u17DE\u0180aiu\u1794\u1796\u179A\xF0\u0760rc;\u65EFp\xBB\u1371\u0180dpt\u17A4\u17A8\u17ADot;\u6A00lus;\u6A01imes;\u6A02\u0271\u17B9\0\0\u17BEcup;\u6A06ar;\u6605riangle\u0100du\u17CD\u17D2own;\u65BDp;\u65B3plus;\u6A04e\xE5\u1444\xE5\u14ADarow;\u690D\u0180ako\u17ED\u1826\u1835\u0100cn\u17F2\u1823k\u0180lst\u17FA\u05AB\u1802ozenge;\u69EBriangle\u0200;dlr\u1812\u1813\u1818\u181D\u65B4own;\u65BEeft;\u65C2ight;\u65B8k;\u6423\u01B1\u182B\0\u1833\u01B2\u182F\0\u1831;\u6592;\u65914;\u6593ck;\u6588\u0100eo\u183E\u184D\u0100;q\u1843\u1846\uC000=\u20E5uiv;\uC000\u2261\u20E5t;\u6310\u0200ptwx\u1859\u185E\u1867\u186Cf;\uC000\u{1D553}\u0100;t\u13CB\u1863om\xBB\u13CCtie;\u62C8\u0600DHUVbdhmptuv\u1885\u1896\u18AA\u18BB\u18D7\u18DB\u18EC\u18FF\u1905\u190A\u1910\u1921\u0200LRlr\u188E\u1890\u1892\u1894;\u6557;\u6554;\u6556;\u6553\u0280;DUdu\u18A1\u18A2\u18A4\u18A6\u18A8\u6550;\u6566;\u6569;\u6564;\u6567\u0200LRlr\u18B3\u18B5\u18B7\u18B9;\u655D;\u655A;\u655C;\u6559\u0380;HLRhlr\u18CA\u18CB\u18CD\u18CF\u18D1\u18D3\u18D5\u6551;\u656C;\u6563;\u6560;\u656B;\u6562;\u655Fox;\u69C9\u0200LRlr\u18E4\u18E6\u18E8\u18EA;\u6555;\u6552;\u6510;\u650C\u0280;DUdu\u06BD\u18F7\u18F9\u18FB\u18FD;\u6565;\u6568;\u652C;\u6534inus;\u629Flus;\u629Eimes;\u62A0\u0200LRlr\u1919\u191B\u191D\u191F;\u655B;\u6558;\u6518;\u6514\u0380;HLRhlr\u1930\u1931\u1933\u1935\u1937\u1939\u193B\u6502;\u656A;\u6561;\u655E;\u653C;\u6524;\u651C\u0100ev\u0123\u1942bar\u803B\xA6\u40A6\u0200ceio\u1951\u1956\u195A\u1960r;\uC000\u{1D4B7}mi;\u604Fm\u0100;e\u171A\u171Cl\u0180;bh\u1968\u1969\u196B\u405C;\u69C5sub;\u67C8\u016C\u1974\u197El\u0100;e\u1979\u197A\u6022t\xBB\u197Ap\u0180;Ee\u012F\u1985\u1987;\u6AAE\u0100;q\u06DC\u06DB\u0CE1\u19A7\0\u19E8\u1A11\u1A15\u1A32\0\u1A37\u1A50\0\0\u1AB4\0\0\u1AC1\0\0\u1B21\u1B2E\u1B4D\u1B52\0\u1BFD\0\u1C0C\u0180cpr\u19AD\u19B2\u19DDute;\u4107\u0300;abcds\u19BF\u19C0\u19C4\u19CA\u19D5\u19D9\u6229nd;\u6A44rcup;\u6A49\u0100au\u19CF\u19D2p;\u6A4Bp;\u6A47ot;\u6A40;\uC000\u2229\uFE00\u0100eo\u19E2\u19E5t;\u6041\xEE\u0693\u0200aeiu\u19F0\u19FB\u1A01\u1A05\u01F0\u19F5\0\u19F8s;\u6A4Don;\u410Ddil\u803B\xE7\u40E7rc;\u4109ps\u0100;s\u1A0C\u1A0D\u6A4Cm;\u6A50ot;\u410B\u0180dmn\u1A1B\u1A20\u1A26il\u80BB\xB8\u01ADptyv;\u69B2t\u8100\xA2;e\u1A2D\u1A2E\u40A2r\xE4\u01B2r;\uC000\u{1D520}\u0180cei\u1A3D\u1A40\u1A4Dy;\u4447ck\u0100;m\u1A47\u1A48\u6713ark\xBB\u1A48;\u43C7r\u0380;Ecefms\u1A5F\u1A60\u1A62\u1A6B\u1AA4\u1AAA\u1AAE\u65CB;\u69C3\u0180;el\u1A69\u1A6A\u1A6D\u42C6q;\u6257e\u0261\u1A74\0\0\u1A88rrow\u0100lr\u1A7C\u1A81eft;\u61BAight;\u61BB\u0280RSacd\u1A92\u1A94\u1A96\u1A9A\u1A9F\xBB\u0F47;\u64C8st;\u629Birc;\u629Aash;\u629Dnint;\u6A10id;\u6AEFcir;\u69C2ubs\u0100;u\u1ABB\u1ABC\u6663it\xBB\u1ABC\u02EC\u1AC7\u1AD4\u1AFA\0\u1B0Aon\u0100;e\u1ACD\u1ACE\u403A\u0100;q\xC7\xC6\u026D\u1AD9\0\0\u1AE2a\u0100;t\u1ADE\u1ADF\u402C;\u4040\u0180;fl\u1AE8\u1AE9\u1AEB\u6201\xEE\u1160e\u0100mx\u1AF1\u1AF6ent\xBB\u1AE9e\xF3\u024D\u01E7\u1AFE\0\u1B07\u0100;d\u12BB\u1B02ot;\u6A6Dn\xF4\u0246\u0180fry\u1B10\u1B14\u1B17;\uC000\u{1D554}o\xE4\u0254\u8100\xA9;s\u0155\u1B1Dr;\u6117\u0100ao\u1B25\u1B29rr;\u61B5ss;\u6717\u0100cu\u1B32\u1B37r;\uC000\u{1D4B8}\u0100bp\u1B3C\u1B44\u0100;e\u1B41\u1B42\u6ACF;\u6AD1\u0100;e\u1B49\u1B4A\u6AD0;\u6AD2dot;\u62EF\u0380delprvw\u1B60\u1B6C\u1B77\u1B82\u1BAC\u1BD4\u1BF9arr\u0100lr\u1B68\u1B6A;\u6938;\u6935\u0270\u1B72\0\0\u1B75r;\u62DEc;\u62DFarr\u0100;p\u1B7F\u1B80\u61B6;\u693D\u0300;bcdos\u1B8F\u1B90\u1B96\u1BA1\u1BA5\u1BA8\u622Arcap;\u6A48\u0100au\u1B9B\u1B9Ep;\u6A46p;\u6A4Aot;\u628Dr;\u6A45;\uC000\u222A\uFE00\u0200alrv\u1BB5\u1BBF\u1BDE\u1BE3rr\u0100;m\u1BBC\u1BBD\u61B7;\u693Cy\u0180evw\u1BC7\u1BD4\u1BD8q\u0270\u1BCE\0\0\u1BD2re\xE3\u1B73u\xE3\u1B75ee;\u62CEedge;\u62CFen\u803B\xA4\u40A4earrow\u0100lr\u1BEE\u1BF3eft\xBB\u1B80ight\xBB\u1BBDe\xE4\u1BDD\u0100ci\u1C01\u1C07onin\xF4\u01F7nt;\u6231lcty;\u632D\u0980AHabcdefhijlorstuwz\u1C38\u1C3B\u1C3F\u1C5D\u1C69\u1C75\u1C8A\u1C9E\u1CAC\u1CB7\u1CFB\u1CFF\u1D0D\u1D7B\u1D91\u1DAB\u1DBB\u1DC6\u1DCDr\xF2\u0381ar;\u6965\u0200glrs\u1C48\u1C4D\u1C52\u1C54ger;\u6020eth;\u6138\xF2\u1133h\u0100;v\u1C5A\u1C5B\u6010\xBB\u090A\u016B\u1C61\u1C67arow;\u690Fa\xE3\u0315\u0100ay\u1C6E\u1C73ron;\u410F;\u4434\u0180;ao\u0332\u1C7C\u1C84\u0100gr\u02BF\u1C81r;\u61CAtseq;\u6A77\u0180glm\u1C91\u1C94\u1C98\u803B\xB0\u40B0ta;\u43B4ptyv;\u69B1\u0100ir\u1CA3\u1CA8sht;\u697F;\uC000\u{1D521}ar\u0100lr\u1CB3\u1CB5\xBB\u08DC\xBB\u101E\u0280aegsv\u1CC2\u0378\u1CD6\u1CDC\u1CE0m\u0180;os\u0326\u1CCA\u1CD4nd\u0100;s\u0326\u1CD1uit;\u6666amma;\u43DDin;\u62F2\u0180;io\u1CE7\u1CE8\u1CF8\u40F7de\u8100\xF7;o\u1CE7\u1CF0ntimes;\u62C7n\xF8\u1CF7cy;\u4452c\u026F\u1D06\0\0\u1D0Arn;\u631Eop;\u630D\u0280lptuw\u1D18\u1D1D\u1D22\u1D49\u1D55lar;\u4024f;\uC000\u{1D555}\u0280;emps\u030B\u1D2D\u1D37\u1D3D\u1D42q\u0100;d\u0352\u1D33ot;\u6251inus;\u6238lus;\u6214quare;\u62A1blebarwedg\xE5\xFAn\u0180adh\u112E\u1D5D\u1D67ownarrow\xF3\u1C83arpoon\u0100lr\u1D72\u1D76ef\xF4\u1CB4igh\xF4\u1CB6\u0162\u1D7F\u1D85karo\xF7\u0F42\u026F\u1D8A\0\0\u1D8Ern;\u631Fop;\u630C\u0180cot\u1D98\u1DA3\u1DA6\u0100ry\u1D9D\u1DA1;\uC000\u{1D4B9};\u4455l;\u69F6rok;\u4111\u0100dr\u1DB0\u1DB4ot;\u62F1i\u0100;f\u1DBA\u1816\u65BF\u0100ah\u1DC0\u1DC3r\xF2\u0429a\xF2\u0FA6angle;\u69A6\u0100ci\u1DD2\u1DD5y;\u445Fgrarr;\u67FF\u0900Dacdefglmnopqrstux\u1E01\u1E09\u1E19\u1E38\u0578\u1E3C\u1E49\u1E61\u1E7E\u1EA5\u1EAF\u1EBD\u1EE1\u1F2A\u1F37\u1F44\u1F4E\u1F5A\u0100Do\u1E06\u1D34o\xF4\u1C89\u0100cs\u1E0E\u1E14ute\u803B\xE9\u40E9ter;\u6A6E\u0200aioy\u1E22\u1E27\u1E31\u1E36ron;\u411Br\u0100;c\u1E2D\u1E2E\u6256\u803B\xEA\u40EAlon;\u6255;\u444Dot;\u4117\u0100Dr\u1E41\u1E45ot;\u6252;\uC000\u{1D522}\u0180;rs\u1E50\u1E51\u1E57\u6A9Aave\u803B\xE8\u40E8\u0100;d\u1E5C\u1E5D\u6A96ot;\u6A98\u0200;ils\u1E6A\u1E6B\u1E72\u1E74\u6A99nters;\u63E7;\u6113\u0100;d\u1E79\u1E7A\u6A95ot;\u6A97\u0180aps\u1E85\u1E89\u1E97cr;\u4113ty\u0180;sv\u1E92\u1E93\u1E95\u6205et\xBB\u1E93p\u01001;\u1E9D\u1EA4\u0133\u1EA1\u1EA3;\u6004;\u6005\u6003\u0100gs\u1EAA\u1EAC;\u414Bp;\u6002\u0100gp\u1EB4\u1EB8on;\u4119f;\uC000\u{1D556}\u0180als\u1EC4\u1ECE\u1ED2r\u0100;s\u1ECA\u1ECB\u62D5l;\u69E3us;\u6A71i\u0180;lv\u1EDA\u1EDB\u1EDF\u43B5on\xBB\u1EDB;\u43F5\u0200csuv\u1EEA\u1EF3\u1F0B\u1F23\u0100io\u1EEF\u1E31rc\xBB\u1E2E\u0269\u1EF9\0\0\u1EFB\xED\u0548ant\u0100gl\u1F02\u1F06tr\xBB\u1E5Dess\xBB\u1E7A\u0180aei\u1F12\u1F16\u1F1Als;\u403Dst;\u625Fv\u0100;D\u0235\u1F20D;\u6A78parsl;\u69E5\u0100Da\u1F2F\u1F33ot;\u6253rr;\u6971\u0180cdi\u1F3E\u1F41\u1EF8r;\u612Fo\xF4\u0352\u0100ah\u1F49\u1F4B;\u43B7\u803B\xF0\u40F0\u0100mr\u1F53\u1F57l\u803B\xEB\u40EBo;\u60AC\u0180cip\u1F61\u1F64\u1F67l;\u4021s\xF4\u056E\u0100eo\u1F6C\u1F74ctatio\xEE\u0559nential\xE5\u0579\u09E1\u1F92\0\u1F9E\0\u1FA1\u1FA7\0\0\u1FC6\u1FCC\0\u1FD3\0\u1FE6\u1FEA\u2000\0\u2008\u205Allingdotse\xF1\u1E44y;\u4444male;\u6640\u0180ilr\u1FAD\u1FB3\u1FC1lig;\u8000\uFB03\u0269\u1FB9\0\0\u1FBDg;\u8000\uFB00ig;\u8000\uFB04;\uC000\u{1D523}lig;\u8000\uFB01lig;\uC000fj\u0180alt\u1FD9\u1FDC\u1FE1t;\u666Dig;\u8000\uFB02ns;\u65B1of;\u4192\u01F0\u1FEE\0\u1FF3f;\uC000\u{1D557}\u0100ak\u05BF\u1FF7\u0100;v\u1FFC\u1FFD\u62D4;\u6AD9artint;\u6A0D\u0100ao\u200C\u2055\u0100cs\u2011\u2052\u03B1\u201A\u2030\u2038\u2045\u2048\0\u2050\u03B2\u2022\u2025\u2027\u202A\u202C\0\u202E\u803B\xBD\u40BD;\u6153\u803B\xBC\u40BC;\u6155;\u6159;\u615B\u01B3\u2034\0\u2036;\u6154;\u6156\u02B4\u203E\u2041\0\0\u2043\u803B\xBE\u40BE;\u6157;\u615C5;\u6158\u01B6\u204C\0\u204E;\u615A;\u615D8;\u615El;\u6044wn;\u6322cr;\uC000\u{1D4BB}\u0880Eabcdefgijlnorstv\u2082\u2089\u209F\u20A5\u20B0\u20B4\u20F0\u20F5\u20FA\u20FF\u2103\u2112\u2138\u0317\u213E\u2152\u219E\u0100;l\u064D\u2087;\u6A8C\u0180cmp\u2090\u2095\u209Dute;\u41F5ma\u0100;d\u209C\u1CDA\u43B3;\u6A86reve;\u411F\u0100iy\u20AA\u20AErc;\u411D;\u4433ot;\u4121\u0200;lqs\u063E\u0642\u20BD\u20C9\u0180;qs\u063E\u064C\u20C4lan\xF4\u0665\u0200;cdl\u0665\u20D2\u20D5\u20E5c;\u6AA9ot\u0100;o\u20DC\u20DD\u6A80\u0100;l\u20E2\u20E3\u6A82;\u6A84\u0100;e\u20EA\u20ED\uC000\u22DB\uFE00s;\u6A94r;\uC000\u{1D524}\u0100;g\u0673\u061Bmel;\u6137cy;\u4453\u0200;Eaj\u065A\u210C\u210E\u2110;\u6A92;\u6AA5;\u6AA4\u0200Eaes\u211B\u211D\u2129\u2134;\u6269p\u0100;p\u2123\u2124\u6A8Arox\xBB\u2124\u0100;q\u212E\u212F\u6A88\u0100;q\u212E\u211Bim;\u62E7pf;\uC000\u{1D558}\u0100ci\u2143\u2146r;\u610Am\u0180;el\u066B\u214E\u2150;\u6A8E;\u6A90\u8300>;cdlqr\u05EE\u2160\u216A\u216E\u2173\u2179\u0100ci\u2165\u2167;\u6AA7r;\u6A7Aot;\u62D7Par;\u6995uest;\u6A7C\u0280adels\u2184\u216A\u2190\u0656\u219B\u01F0\u2189\0\u218Epro\xF8\u209Er;\u6978q\u0100lq\u063F\u2196les\xF3\u2088i\xED\u066B\u0100en\u21A3\u21ADrtneqq;\uC000\u2269\uFE00\xC5\u21AA\u0500Aabcefkosy\u21C4\u21C7\u21F1\u21F5\u21FA\u2218\u221D\u222F\u2268\u227Dr\xF2\u03A0\u0200ilmr\u21D0\u21D4\u21D7\u21DBrs\xF0\u1484f\xBB\u2024il\xF4\u06A9\u0100dr\u21E0\u21E4cy;\u444A\u0180;cw\u08F4\u21EB\u21EFir;\u6948;\u61ADar;\u610Firc;\u4125\u0180alr\u2201\u220E\u2213rts\u0100;u\u2209\u220A\u6665it\xBB\u220Alip;\u6026con;\u62B9r;\uC000\u{1D525}s\u0100ew\u2223\u2229arow;\u6925arow;\u6926\u0280amopr\u223A\u223E\u2243\u225E\u2263rr;\u61FFtht;\u623Bk\u0100lr\u2249\u2253eftarrow;\u61A9ightarrow;\u61AAf;\uC000\u{1D559}bar;\u6015\u0180clt\u226F\u2274\u2278r;\uC000\u{1D4BD}as\xE8\u21F4rok;\u4127\u0100bp\u2282\u2287ull;\u6043hen\xBB\u1C5B\u0AE1\u22A3\0\u22AA\0\u22B8\u22C5\u22CE\0\u22D5\u22F3\0\0\u22F8\u2322\u2367\u2362\u237F\0\u2386\u23AA\u23B4cute\u803B\xED\u40ED\u0180;iy\u0771\u22B0\u22B5rc\u803B\xEE\u40EE;\u4438\u0100cx\u22BC\u22BFy;\u4435cl\u803B\xA1\u40A1\u0100fr\u039F\u22C9;\uC000\u{1D526}rave\u803B\xEC\u40EC\u0200;ino\u073E\u22DD\u22E9\u22EE\u0100in\u22E2\u22E6nt;\u6A0Ct;\u622Dfin;\u69DCta;\u6129lig;\u4133\u0180aop\u22FE\u231A\u231D\u0180cgt\u2305\u2308\u2317r;\u412B\u0180elp\u071F\u230F\u2313in\xE5\u078Ear\xF4\u0720h;\u4131f;\u62B7ed;\u41B5\u0280;cfot\u04F4\u232C\u2331\u233D\u2341are;\u6105in\u0100;t\u2338\u2339\u621Eie;\u69DDdo\xF4\u2319\u0280;celp\u0757\u234C\u2350\u235B\u2361al;\u62BA\u0100gr\u2355\u2359er\xF3\u1563\xE3\u234Darhk;\u6A17rod;\u6A3C\u0200cgpt\u236F\u2372\u2376\u237By;\u4451on;\u412Ff;\uC000\u{1D55A}a;\u43B9uest\u803B\xBF\u40BF\u0100ci\u238A\u238Fr;\uC000\u{1D4BE}n\u0280;Edsv\u04F4\u239B\u239D\u23A1\u04F3;\u62F9ot;\u62F5\u0100;v\u23A6\u23A7\u62F4;\u62F3\u0100;i\u0777\u23AElde;\u4129\u01EB\u23B8\0\u23BCcy;\u4456l\u803B\xEF\u40EF\u0300cfmosu\u23CC\u23D7\u23DC\u23E1\u23E7\u23F5\u0100iy\u23D1\u23D5rc;\u4135;\u4439r;\uC000\u{1D527}ath;\u4237pf;\uC000\u{1D55B}\u01E3\u23EC\0\u23F1r;\uC000\u{1D4BF}rcy;\u4458kcy;\u4454\u0400acfghjos\u240B\u2416\u2422\u2427\u242D\u2431\u2435\u243Bppa\u0100;v\u2413\u2414\u43BA;\u43F0\u0100ey\u241B\u2420dil;\u4137;\u443Ar;\uC000\u{1D528}reen;\u4138cy;\u4445cy;\u445Cpf;\uC000\u{1D55C}cr;\uC000\u{1D4C0}\u0B80ABEHabcdefghjlmnoprstuv\u2470\u2481\u2486\u248D\u2491\u250E\u253D\u255A\u2580\u264E\u265E\u2665\u2679\u267D\u269A\u26B2\u26D8\u275D\u2768\u278B\u27C0\u2801\u2812\u0180art\u2477\u247A\u247Cr\xF2\u09C6\xF2\u0395ail;\u691Barr;\u690E\u0100;g\u0994\u248B;\u6A8Bar;\u6962\u0963\u24A5\0\u24AA\0\u24B1\0\0\0\0\0\u24B5\u24BA\0\u24C6\u24C8\u24CD\0\u24F9ute;\u413Amptyv;\u69B4ra\xEE\u084Cbda;\u43BBg\u0180;dl\u088E\u24C1\u24C3;\u6991\xE5\u088E;\u6A85uo\u803B\xAB\u40ABr\u0400;bfhlpst\u0899\u24DE\u24E6\u24E9\u24EB\u24EE\u24F1\u24F5\u0100;f\u089D\u24E3s;\u691Fs;\u691D\xEB\u2252p;\u61ABl;\u6939im;\u6973l;\u61A2\u0180;ae\u24FF\u2500\u2504\u6AABil;\u6919\u0100;s\u2509\u250A\u6AAD;\uC000\u2AAD\uFE00\u0180abr\u2515\u2519\u251Drr;\u690Crk;\u6772\u0100ak\u2522\u252Cc\u0100ek\u2528\u252A;\u407B;\u405B\u0100es\u2531\u2533;\u698Bl\u0100du\u2539\u253B;\u698F;\u698D\u0200aeuy\u2546\u254B\u2556\u2558ron;\u413E\u0100di\u2550\u2554il;\u413C\xEC\u08B0\xE2\u2529;\u443B\u0200cqrs\u2563\u2566\u256D\u257Da;\u6936uo\u0100;r\u0E19\u1746\u0100du\u2572\u2577har;\u6967shar;\u694Bh;\u61B2\u0280;fgqs\u258B\u258C\u0989\u25F3\u25FF\u6264t\u0280ahlrt\u2598\u25A4\u25B7\u25C2\u25E8rrow\u0100;t\u0899\u25A1a\xE9\u24F6arpoon\u0100du\u25AF\u25B4own\xBB\u045Ap\xBB\u0966eftarrows;\u61C7ight\u0180ahs\u25CD\u25D6\u25DErrow\u0100;s\u08F4\u08A7arpoon\xF3\u0F98quigarro\xF7\u21F0hreetimes;\u62CB\u0180;qs\u258B\u0993\u25FAlan\xF4\u09AC\u0280;cdgs\u09AC\u260A\u260D\u261D\u2628c;\u6AA8ot\u0100;o\u2614\u2615\u6A7F\u0100;r\u261A\u261B\u6A81;\u6A83\u0100;e\u2622\u2625\uC000\u22DA\uFE00s;\u6A93\u0280adegs\u2633\u2639\u263D\u2649\u264Bppro\xF8\u24C6ot;\u62D6q\u0100gq\u2643\u2645\xF4\u0989gt\xF2\u248C\xF4\u099Bi\xED\u09B2\u0180ilr\u2655\u08E1\u265Asht;\u697C;\uC000\u{1D529}\u0100;E\u099C\u2663;\u6A91\u0161\u2669\u2676r\u0100du\u25B2\u266E\u0100;l\u0965\u2673;\u696Alk;\u6584cy;\u4459\u0280;acht\u0A48\u2688\u268B\u2691\u2696r\xF2\u25C1orne\xF2\u1D08ard;\u696Bri;\u65FA\u0100io\u269F\u26A4dot;\u4140ust\u0100;a\u26AC\u26AD\u63B0che\xBB\u26AD\u0200Eaes\u26BB\u26BD\u26C9\u26D4;\u6268p\u0100;p\u26C3\u26C4\u6A89rox\xBB\u26C4\u0100;q\u26CE\u26CF\u6A87\u0100;q\u26CE\u26BBim;\u62E6\u0400abnoptwz\u26E9\u26F4\u26F7\u271A\u272F\u2741\u2747\u2750\u0100nr\u26EE\u26F1g;\u67ECr;\u61FDr\xEB\u08C1g\u0180lmr\u26FF\u270D\u2714eft\u0100ar\u09E6\u2707ight\xE1\u09F2apsto;\u67FCight\xE1\u09FDparrow\u0100lr\u2725\u2729ef\xF4\u24EDight;\u61AC\u0180afl\u2736\u2739\u273Dr;\u6985;\uC000\u{1D55D}us;\u6A2Dimes;\u6A34\u0161\u274B\u274Fst;\u6217\xE1\u134E\u0180;ef\u2757\u2758\u1800\u65CAnge\xBB\u2758ar\u0100;l\u2764\u2765\u4028t;\u6993\u0280achmt\u2773\u2776\u277C\u2785\u2787r\xF2\u08A8orne\xF2\u1D8Car\u0100;d\u0F98\u2783;\u696D;\u600Eri;\u62BF\u0300achiqt\u2798\u279D\u0A40\u27A2\u27AE\u27BBquo;\u6039r;\uC000\u{1D4C1}m\u0180;eg\u09B2\u27AA\u27AC;\u6A8D;\u6A8F\u0100bu\u252A\u27B3o\u0100;r\u0E1F\u27B9;\u601Arok;\u4142\u8400<;cdhilqr\u082B\u27D2\u2639\u27DC\u27E0\u27E5\u27EA\u27F0\u0100ci\u27D7\u27D9;\u6AA6r;\u6A79re\xE5\u25F2mes;\u62C9arr;\u6976uest;\u6A7B\u0100Pi\u27F5\u27F9ar;\u6996\u0180;ef\u2800\u092D\u181B\u65C3r\u0100du\u2807\u280Dshar;\u694Ahar;\u6966\u0100en\u2817\u2821rtneqq;\uC000\u2268\uFE00\xC5\u281E\u0700Dacdefhilnopsu\u2840\u2845\u2882\u288E\u2893\u28A0\u28A5\u28A8\u28DA\u28E2\u28E4\u0A83\u28F3\u2902Dot;\u623A\u0200clpr\u284E\u2852\u2863\u287Dr\u803B\xAF\u40AF\u0100et\u2857\u2859;\u6642\u0100;e\u285E\u285F\u6720se\xBB\u285F\u0100;s\u103B\u2868to\u0200;dlu\u103B\u2873\u2877\u287Bow\xEE\u048Cef\xF4\u090F\xF0\u13D1ker;\u65AE\u0100oy\u2887\u288Cmma;\u6A29;\u443Cash;\u6014asuredangle\xBB\u1626r;\uC000\u{1D52A}o;\u6127\u0180cdn\u28AF\u28B4\u28C9ro\u803B\xB5\u40B5\u0200;acd\u1464\u28BD\u28C0\u28C4s\xF4\u16A7ir;\u6AF0ot\u80BB\xB7\u01B5us\u0180;bd\u28D2\u1903\u28D3\u6212\u0100;u\u1D3C\u28D8;\u6A2A\u0163\u28DE\u28E1p;\u6ADB\xF2\u2212\xF0\u0A81\u0100dp\u28E9\u28EEels;\u62A7f;\uC000\u{1D55E}\u0100ct\u28F8\u28FDr;\uC000\u{1D4C2}pos\xBB\u159D\u0180;lm\u2909\u290A\u290D\u43BCtimap;\u62B8\u0C00GLRVabcdefghijlmoprstuvw\u2942\u2953\u297E\u2989\u2998\u29DA\u29E9\u2A15\u2A1A\u2A58\u2A5D\u2A83\u2A95\u2AA4\u2AA8\u2B04\u2B07\u2B44\u2B7F\u2BAE\u2C34\u2C67\u2C7C\u2CE9\u0100gt\u2947\u294B;\uC000\u22D9\u0338\u0100;v\u2950\u0BCF\uC000\u226B\u20D2\u0180elt\u295A\u2972\u2976ft\u0100ar\u2961\u2967rrow;\u61CDightarrow;\u61CE;\uC000\u22D8\u0338\u0100;v\u297B\u0C47\uC000\u226A\u20D2ightarrow;\u61CF\u0100Dd\u298E\u2993ash;\u62AFash;\u62AE\u0280bcnpt\u29A3\u29A7\u29AC\u29B1\u29CCla\xBB\u02DEute;\u4144g;\uC000\u2220\u20D2\u0280;Eiop\u0D84\u29BC\u29C0\u29C5\u29C8;\uC000\u2A70\u0338d;\uC000\u224B\u0338s;\u4149ro\xF8\u0D84ur\u0100;a\u29D3\u29D4\u666El\u0100;s\u29D3\u0B38\u01F3\u29DF\0\u29E3p\u80BB\xA0\u0B37mp\u0100;e\u0BF9\u0C00\u0280aeouy\u29F4\u29FE\u2A03\u2A10\u2A13\u01F0\u29F9\0\u29FB;\u6A43on;\u4148dil;\u4146ng\u0100;d\u0D7E\u2A0Aot;\uC000\u2A6D\u0338p;\u6A42;\u443Dash;\u6013\u0380;Aadqsx\u0B92\u2A29\u2A2D\u2A3B\u2A41\u2A45\u2A50rr;\u61D7r\u0100hr\u2A33\u2A36k;\u6924\u0100;o\u13F2\u13F0ot;\uC000\u2250\u0338ui\xF6\u0B63\u0100ei\u2A4A\u2A4Ear;\u6928\xED\u0B98ist\u0100;s\u0BA0\u0B9Fr;\uC000\u{1D52B}\u0200Eest\u0BC5\u2A66\u2A79\u2A7C\u0180;qs\u0BBC\u2A6D\u0BE1\u0180;qs\u0BBC\u0BC5\u2A74lan\xF4\u0BE2i\xED\u0BEA\u0100;r\u0BB6\u2A81\xBB\u0BB7\u0180Aap\u2A8A\u2A8D\u2A91r\xF2\u2971rr;\u61AEar;\u6AF2\u0180;sv\u0F8D\u2A9C\u0F8C\u0100;d\u2AA1\u2AA2\u62FC;\u62FAcy;\u445A\u0380AEadest\u2AB7\u2ABA\u2ABE\u2AC2\u2AC5\u2AF6\u2AF9r\xF2\u2966;\uC000\u2266\u0338rr;\u619Ar;\u6025\u0200;fqs\u0C3B\u2ACE\u2AE3\u2AEFt\u0100ar\u2AD4\u2AD9rro\xF7\u2AC1ightarro\xF7\u2A90\u0180;qs\u0C3B\u2ABA\u2AEAlan\xF4\u0C55\u0100;s\u0C55\u2AF4\xBB\u0C36i\xED\u0C5D\u0100;r\u0C35\u2AFEi\u0100;e\u0C1A\u0C25i\xE4\u0D90\u0100pt\u2B0C\u2B11f;\uC000\u{1D55F}\u8180\xAC;in\u2B19\u2B1A\u2B36\u40ACn\u0200;Edv\u0B89\u2B24\u2B28\u2B2E;\uC000\u22F9\u0338ot;\uC000\u22F5\u0338\u01E1\u0B89\u2B33\u2B35;\u62F7;\u62F6i\u0100;v\u0CB8\u2B3C\u01E1\u0CB8\u2B41\u2B43;\u62FE;\u62FD\u0180aor\u2B4B\u2B63\u2B69r\u0200;ast\u0B7B\u2B55\u2B5A\u2B5Flle\xEC\u0B7Bl;\uC000\u2AFD\u20E5;\uC000\u2202\u0338lint;\u6A14\u0180;ce\u0C92\u2B70\u2B73u\xE5\u0CA5\u0100;c\u0C98\u2B78\u0100;e\u0C92\u2B7D\xF1\u0C98\u0200Aait\u2B88\u2B8B\u2B9D\u2BA7r\xF2\u2988rr\u0180;cw\u2B94\u2B95\u2B99\u619B;\uC000\u2933\u0338;\uC000\u219D\u0338ghtarrow\xBB\u2B95ri\u0100;e\u0CCB\u0CD6\u0380chimpqu\u2BBD\u2BCD\u2BD9\u2B04\u0B78\u2BE4\u2BEF\u0200;cer\u0D32\u2BC6\u0D37\u2BC9u\xE5\u0D45;\uC000\u{1D4C3}ort\u026D\u2B05\0\0\u2BD6ar\xE1\u2B56m\u0100;e\u0D6E\u2BDF\u0100;q\u0D74\u0D73su\u0100bp\u2BEB\u2BED\xE5\u0CF8\xE5\u0D0B\u0180bcp\u2BF6\u2C11\u2C19\u0200;Ees\u2BFF\u2C00\u0D22\u2C04\u6284;\uC000\u2AC5\u0338et\u0100;e\u0D1B\u2C0Bq\u0100;q\u0D23\u2C00c\u0100;e\u0D32\u2C17\xF1\u0D38\u0200;Ees\u2C22\u2C23\u0D5F\u2C27\u6285;\uC000\u2AC6\u0338et\u0100;e\u0D58\u2C2Eq\u0100;q\u0D60\u2C23\u0200gilr\u2C3D\u2C3F\u2C45\u2C47\xEC\u0BD7lde\u803B\xF1\u40F1\xE7\u0C43iangle\u0100lr\u2C52\u2C5Ceft\u0100;e\u0C1A\u2C5A\xF1\u0C26ight\u0100;e\u0CCB\u2C65\xF1\u0CD7\u0100;m\u2C6C\u2C6D\u43BD\u0180;es\u2C74\u2C75\u2C79\u4023ro;\u6116p;\u6007\u0480DHadgilrs\u2C8F\u2C94\u2C99\u2C9E\u2CA3\u2CB0\u2CB6\u2CD3\u2CE3ash;\u62ADarr;\u6904p;\uC000\u224D\u20D2ash;\u62AC\u0100et\u2CA8\u2CAC;\uC000\u2265\u20D2;\uC000>\u20D2nfin;\u69DE\u0180Aet\u2CBD\u2CC1\u2CC5rr;\u6902;\uC000\u2264\u20D2\u0100;r\u2CCA\u2CCD\uC000<\u20D2ie;\uC000\u22B4\u20D2\u0100At\u2CD8\u2CDCrr;\u6903rie;\uC000\u22B5\u20D2im;\uC000\u223C\u20D2\u0180Aan\u2CF0\u2CF4\u2D02rr;\u61D6r\u0100hr\u2CFA\u2CFDk;\u6923\u0100;o\u13E7\u13E5ear;\u6927\u1253\u1A95\0\0\0\0\0\0\0\0\0\0\0\0\0\u2D2D\0\u2D38\u2D48\u2D60\u2D65\u2D72\u2D84\u1B07\0\0\u2D8D\u2DAB\0\u2DC8\u2DCE\0\u2DDC\u2E19\u2E2B\u2E3E\u2E43\u0100cs\u2D31\u1A97ute\u803B\xF3\u40F3\u0100iy\u2D3C\u2D45r\u0100;c\u1A9E\u2D42\u803B\xF4\u40F4;\u443E\u0280abios\u1AA0\u2D52\u2D57\u01C8\u2D5Alac;\u4151v;\u6A38old;\u69BClig;\u4153\u0100cr\u2D69\u2D6Dir;\u69BF;\uC000\u{1D52C}\u036F\u2D79\0\0\u2D7C\0\u2D82n;\u42DBave\u803B\xF2\u40F2;\u69C1\u0100bm\u2D88\u0DF4ar;\u69B5\u0200acit\u2D95\u2D98\u2DA5\u2DA8r\xF2\u1A80\u0100ir\u2D9D\u2DA0r;\u69BEoss;\u69BBn\xE5\u0E52;\u69C0\u0180aei\u2DB1\u2DB5\u2DB9cr;\u414Dga;\u43C9\u0180cdn\u2DC0\u2DC5\u01CDron;\u43BF;\u69B6pf;\uC000\u{1D560}\u0180ael\u2DD4\u2DD7\u01D2r;\u69B7rp;\u69B9\u0380;adiosv\u2DEA\u2DEB\u2DEE\u2E08\u2E0D\u2E10\u2E16\u6228r\xF2\u1A86\u0200;efm\u2DF7\u2DF8\u2E02\u2E05\u6A5Dr\u0100;o\u2DFE\u2DFF\u6134f\xBB\u2DFF\u803B\xAA\u40AA\u803B\xBA\u40BAgof;\u62B6r;\u6A56lope;\u6A57;\u6A5B\u0180clo\u2E1F\u2E21\u2E27\xF2\u2E01ash\u803B\xF8\u40F8l;\u6298i\u016C\u2E2F\u2E34de\u803B\xF5\u40F5es\u0100;a\u01DB\u2E3As;\u6A36ml\u803B\xF6\u40F6bar;\u633D\u0AE1\u2E5E\0\u2E7D\0\u2E80\u2E9D\0\u2EA2\u2EB9\0\0\u2ECB\u0E9C\0\u2F13\0\0\u2F2B\u2FBC\0\u2FC8r\u0200;ast\u0403\u2E67\u2E72\u0E85\u8100\xB6;l\u2E6D\u2E6E\u40B6le\xEC\u0403\u0269\u2E78\0\0\u2E7Bm;\u6AF3;\u6AFDy;\u443Fr\u0280cimpt\u2E8B\u2E8F\u2E93\u1865\u2E97nt;\u4025od;\u402Eil;\u6030enk;\u6031r;\uC000\u{1D52D}\u0180imo\u2EA8\u2EB0\u2EB4\u0100;v\u2EAD\u2EAE\u43C6;\u43D5ma\xF4\u0A76ne;\u660E\u0180;tv\u2EBF\u2EC0\u2EC8\u43C0chfork\xBB\u1FFD;\u43D6\u0100au\u2ECF\u2EDFn\u0100ck\u2ED5\u2EDDk\u0100;h\u21F4\u2EDB;\u610E\xF6\u21F4s\u0480;abcdemst\u2EF3\u2EF4\u1908\u2EF9\u2EFD\u2F04\u2F06\u2F0A\u2F0E\u402Bcir;\u6A23ir;\u6A22\u0100ou\u1D40\u2F02;\u6A25;\u6A72n\u80BB\xB1\u0E9Dim;\u6A26wo;\u6A27\u0180ipu\u2F19\u2F20\u2F25ntint;\u6A15f;\uC000\u{1D561}nd\u803B\xA3\u40A3\u0500;Eaceinosu\u0EC8\u2F3F\u2F41\u2F44\u2F47\u2F81\u2F89\u2F92\u2F7E\u2FB6;\u6AB3p;\u6AB7u\xE5\u0ED9\u0100;c\u0ECE\u2F4C\u0300;acens\u0EC8\u2F59\u2F5F\u2F66\u2F68\u2F7Eppro\xF8\u2F43urlye\xF1\u0ED9\xF1\u0ECE\u0180aes\u2F6F\u2F76\u2F7Approx;\u6AB9qq;\u6AB5im;\u62E8i\xED\u0EDFme\u0100;s\u2F88\u0EAE\u6032\u0180Eas\u2F78\u2F90\u2F7A\xF0\u2F75\u0180dfp\u0EEC\u2F99\u2FAF\u0180als\u2FA0\u2FA5\u2FAAlar;\u632Eine;\u6312urf;\u6313\u0100;t\u0EFB\u2FB4\xEF\u0EFBrel;\u62B0\u0100ci\u2FC0\u2FC5r;\uC000\u{1D4C5};\u43C8ncsp;\u6008\u0300fiopsu\u2FDA\u22E2\u2FDF\u2FE5\u2FEB\u2FF1r;\uC000\u{1D52E}pf;\uC000\u{1D562}rime;\u6057cr;\uC000\u{1D4C6}\u0180aeo\u2FF8\u3009\u3013t\u0100ei\u2FFE\u3005rnion\xF3\u06B0nt;\u6A16st\u0100;e\u3010\u3011\u403F\xF1\u1F19\xF4\u0F14\u0A80ABHabcdefhilmnoprstux\u3040\u3051\u3055\u3059\u30E0\u310E\u312B\u3147\u3162\u3172\u318E\u3206\u3215\u3224\u3229\u3258\u326E\u3272\u3290\u32B0\u32B7\u0180art\u3047\u304A\u304Cr\xF2\u10B3\xF2\u03DDail;\u691Car\xF2\u1C65ar;\u6964\u0380cdenqrt\u3068\u3075\u3078\u307F\u308F\u3094\u30CC\u0100eu\u306D\u3071;\uC000\u223D\u0331te;\u4155i\xE3\u116Emptyv;\u69B3g\u0200;del\u0FD1\u3089\u308B\u308D;\u6992;\u69A5\xE5\u0FD1uo\u803B\xBB\u40BBr\u0580;abcfhlpstw\u0FDC\u30AC\u30AF\u30B7\u30B9\u30BC\u30BE\u30C0\u30C3\u30C7\u30CAp;\u6975\u0100;f\u0FE0\u30B4s;\u6920;\u6933s;\u691E\xEB\u225D\xF0\u272El;\u6945im;\u6974l;\u61A3;\u619D\u0100ai\u30D1\u30D5il;\u691Ao\u0100;n\u30DB\u30DC\u6236al\xF3\u0F1E\u0180abr\u30E7\u30EA\u30EEr\xF2\u17E5rk;\u6773\u0100ak\u30F3\u30FDc\u0100ek\u30F9\u30FB;\u407D;\u405D\u0100es\u3102\u3104;\u698Cl\u0100du\u310A\u310C;\u698E;\u6990\u0200aeuy\u3117\u311C\u3127\u3129ron;\u4159\u0100di\u3121\u3125il;\u4157\xEC\u0FF2\xE2\u30FA;\u4440\u0200clqs\u3134\u3137\u313D\u3144a;\u6937dhar;\u6969uo\u0100;r\u020E\u020Dh;\u61B3\u0180acg\u314E\u315F\u0F44l\u0200;ips\u0F78\u3158\u315B\u109Cn\xE5\u10BBar\xF4\u0FA9t;\u65AD\u0180ilr\u3169\u1023\u316Esht;\u697D;\uC000\u{1D52F}\u0100ao\u3177\u3186r\u0100du\u317D\u317F\xBB\u047B\u0100;l\u1091\u3184;\u696C\u0100;v\u318B\u318C\u43C1;\u43F1\u0180gns\u3195\u31F9\u31FCht\u0300ahlrst\u31A4\u31B0\u31C2\u31D8\u31E4\u31EErrow\u0100;t\u0FDC\u31ADa\xE9\u30C8arpoon\u0100du\u31BB\u31BFow\xEE\u317Ep\xBB\u1092eft\u0100ah\u31CA\u31D0rrow\xF3\u0FEAarpoon\xF3\u0551ightarrows;\u61C9quigarro\xF7\u30CBhreetimes;\u62CCg;\u42DAingdotse\xF1\u1F32\u0180ahm\u320D\u3210\u3213r\xF2\u0FEAa\xF2\u0551;\u600Foust\u0100;a\u321E\u321F\u63B1che\xBB\u321Fmid;\u6AEE\u0200abpt\u3232\u323D\u3240\u3252\u0100nr\u3237\u323Ag;\u67EDr;\u61FEr\xEB\u1003\u0180afl\u3247\u324A\u324Er;\u6986;\uC000\u{1D563}us;\u6A2Eimes;\u6A35\u0100ap\u325D\u3267r\u0100;g\u3263\u3264\u4029t;\u6994olint;\u6A12ar\xF2\u31E3\u0200achq\u327B\u3280\u10BC\u3285quo;\u603Ar;\uC000\u{1D4C7}\u0100bu\u30FB\u328Ao\u0100;r\u0214\u0213\u0180hir\u3297\u329B\u32A0re\xE5\u31F8mes;\u62CAi\u0200;efl\u32AA\u1059\u1821\u32AB\u65B9tri;\u69CEluhar;\u6968;\u611E\u0D61\u32D5\u32DB\u32DF\u332C\u3338\u3371\0\u337A\u33A4\0\0\u33EC\u33F0\0\u3428\u3448\u345A\u34AD\u34B1\u34CA\u34F1\0\u3616\0\0\u3633cute;\u415Bqu\xEF\u27BA\u0500;Eaceinpsy\u11ED\u32F3\u32F5\u32FF\u3302\u330B\u330F\u331F\u3326\u3329;\u6AB4\u01F0\u32FA\0\u32FC;\u6AB8on;\u4161u\xE5\u11FE\u0100;d\u11F3\u3307il;\u415Frc;\u415D\u0180Eas\u3316\u3318\u331B;\u6AB6p;\u6ABAim;\u62E9olint;\u6A13i\xED\u1204;\u4441ot\u0180;be\u3334\u1D47\u3335\u62C5;\u6A66\u0380Aacmstx\u3346\u334A\u3357\u335B\u335E\u3363\u336Drr;\u61D8r\u0100hr\u3350\u3352\xEB\u2228\u0100;o\u0A36\u0A34t\u803B\xA7\u40A7i;\u403Bwar;\u6929m\u0100in\u3369\xF0nu\xF3\xF1t;\u6736r\u0100;o\u3376\u2055\uC000\u{1D530}\u0200acoy\u3382\u3386\u3391\u33A0rp;\u666F\u0100hy\u338B\u338Fcy;\u4449;\u4448rt\u026D\u3399\0\0\u339Ci\xE4\u1464ara\xEC\u2E6F\u803B\xAD\u40AD\u0100gm\u33A8\u33B4ma\u0180;fv\u33B1\u33B2\u33B2\u43C3;\u43C2\u0400;deglnpr\u12AB\u33C5\u33C9\u33CE\u33D6\u33DE\u33E1\u33E6ot;\u6A6A\u0100;q\u12B1\u12B0\u0100;E\u33D3\u33D4\u6A9E;\u6AA0\u0100;E\u33DB\u33DC\u6A9D;\u6A9Fe;\u6246lus;\u6A24arr;\u6972ar\xF2\u113D\u0200aeit\u33F8\u3408\u340F\u3417\u0100ls\u33FD\u3404lsetm\xE9\u336Ahp;\u6A33parsl;\u69E4\u0100dl\u1463\u3414e;\u6323\u0100;e\u341C\u341D\u6AAA\u0100;s\u3422\u3423\u6AAC;\uC000\u2AAC\uFE00\u0180flp\u342E\u3433\u3442tcy;\u444C\u0100;b\u3438\u3439\u402F\u0100;a\u343E\u343F\u69C4r;\u633Ff;\uC000\u{1D564}a\u0100dr\u344D\u0402es\u0100;u\u3454\u3455\u6660it\xBB\u3455\u0180csu\u3460\u3479\u349F\u0100au\u3465\u346Fp\u0100;s\u1188\u346B;\uC000\u2293\uFE00p\u0100;s\u11B4\u3475;\uC000\u2294\uFE00u\u0100bp\u347F\u348F\u0180;es\u1197\u119C\u3486et\u0100;e\u1197\u348D\xF1\u119D\u0180;es\u11A8\u11AD\u3496et\u0100;e\u11A8\u349D\xF1\u11AE\u0180;af\u117B\u34A6\u05B0r\u0165\u34AB\u05B1\xBB\u117Car\xF2\u1148\u0200cemt\u34B9\u34BE\u34C2\u34C5r;\uC000\u{1D4C8}tm\xEE\xF1i\xEC\u3415ar\xE6\u11BE\u0100ar\u34CE\u34D5r\u0100;f\u34D4\u17BF\u6606\u0100an\u34DA\u34EDight\u0100ep\u34E3\u34EApsilo\xEE\u1EE0h\xE9\u2EAFs\xBB\u2852\u0280bcmnp\u34FB\u355E\u1209\u358B\u358E\u0480;Edemnprs\u350E\u350F\u3511\u3515\u351E\u3523\u352C\u3531\u3536\u6282;\u6AC5ot;\u6ABD\u0100;d\u11DA\u351Aot;\u6AC3ult;\u6AC1\u0100Ee\u3528\u352A;\u6ACB;\u628Alus;\u6ABFarr;\u6979\u0180eiu\u353D\u3552\u3555t\u0180;en\u350E\u3545\u354Bq\u0100;q\u11DA\u350Feq\u0100;q\u352B\u3528m;\u6AC7\u0100bp\u355A\u355C;\u6AD5;\u6AD3c\u0300;acens\u11ED\u356C\u3572\u3579\u357B\u3326ppro\xF8\u32FAurlye\xF1\u11FE\xF1\u11F3\u0180aes\u3582\u3588\u331Bppro\xF8\u331Aq\xF1\u3317g;\u666A\u0680123;Edehlmnps\u35A9\u35AC\u35AF\u121C\u35B2\u35B4\u35C0\u35C9\u35D5\u35DA\u35DF\u35E8\u35ED\u803B\xB9\u40B9\u803B\xB2\u40B2\u803B\xB3\u40B3;\u6AC6\u0100os\u35B9\u35BCt;\u6ABEub;\u6AD8\u0100;d\u1222\u35C5ot;\u6AC4s\u0100ou\u35CF\u35D2l;\u67C9b;\u6AD7arr;\u697Bult;\u6AC2\u0100Ee\u35E4\u35E6;\u6ACC;\u628Blus;\u6AC0\u0180eiu\u35F4\u3609\u360Ct\u0180;en\u121C\u35FC\u3602q\u0100;q\u1222\u35B2eq\u0100;q\u35E7\u35E4m;\u6AC8\u0100bp\u3611\u3613;\u6AD4;\u6AD6\u0180Aan\u361C\u3620\u362Drr;\u61D9r\u0100hr\u3626\u3628\xEB\u222E\u0100;o\u0A2B\u0A29war;\u692Alig\u803B\xDF\u40DF\u0BE1\u3651\u365D\u3660\u12CE\u3673\u3679\0\u367E\u36C2\0\0\0\0\0\u36DB\u3703\0\u3709\u376C\0\0\0\u3787\u0272\u3656\0\0\u365Bget;\u6316;\u43C4r\xEB\u0E5F\u0180aey\u3666\u366B\u3670ron;\u4165dil;\u4163;\u4442lrec;\u6315r;\uC000\u{1D531}\u0200eiko\u3686\u369D\u36B5\u36BC\u01F2\u368B\0\u3691e\u01004f\u1284\u1281a\u0180;sv\u3698\u3699\u369B\u43B8ym;\u43D1\u0100cn\u36A2\u36B2k\u0100as\u36A8\u36AEppro\xF8\u12C1im\xBB\u12ACs\xF0\u129E\u0100as\u36BA\u36AE\xF0\u12C1rn\u803B\xFE\u40FE\u01EC\u031F\u36C6\u22E7es\u8180\xD7;bd\u36CF\u36D0\u36D8\u40D7\u0100;a\u190F\u36D5r;\u6A31;\u6A30\u0180eps\u36E1\u36E3\u3700\xE1\u2A4D\u0200;bcf\u0486\u36EC\u36F0\u36F4ot;\u6336ir;\u6AF1\u0100;o\u36F9\u36FC\uC000\u{1D565}rk;\u6ADA\xE1\u3362rime;\u6034\u0180aip\u370F\u3712\u3764d\xE5\u1248\u0380adempst\u3721\u374D\u3740\u3751\u3757\u375C\u375Fngle\u0280;dlqr\u3730\u3731\u3736\u3740\u3742\u65B5own\xBB\u1DBBeft\u0100;e\u2800\u373E\xF1\u092E;\u625Cight\u0100;e\u32AA\u374B\xF1\u105Aot;\u65ECinus;\u6A3Alus;\u6A39b;\u69CDime;\u6A3Bezium;\u63E2\u0180cht\u3772\u377D\u3781\u0100ry\u3777\u377B;\uC000\u{1D4C9};\u4446cy;\u445Brok;\u4167\u0100io\u378B\u378Ex\xF4\u1777head\u0100lr\u3797\u37A0eftarro\xF7\u084Fightarrow\xBB\u0F5D\u0900AHabcdfghlmoprstuw\u37D0\u37D3\u37D7\u37E4\u37F0\u37FC\u380E\u381C\u3823\u3834\u3851\u385D\u386B\u38A9\u38CC\u38D2\u38EA\u38F6r\xF2\u03EDar;\u6963\u0100cr\u37DC\u37E2ute\u803B\xFA\u40FA\xF2\u1150r\u01E3\u37EA\0\u37EDy;\u445Eve;\u416D\u0100iy\u37F5\u37FArc\u803B\xFB\u40FB;\u4443\u0180abh\u3803\u3806\u380Br\xF2\u13ADlac;\u4171a\xF2\u13C3\u0100ir\u3813\u3818sht;\u697E;\uC000\u{1D532}rave\u803B\xF9\u40F9\u0161\u3827\u3831r\u0100lr\u382C\u382E\xBB\u0957\xBB\u1083lk;\u6580\u0100ct\u3839\u384D\u026F\u383F\0\0\u384Arn\u0100;e\u3845\u3846\u631Cr\xBB\u3846op;\u630Fri;\u65F8\u0100al\u3856\u385Acr;\u416B\u80BB\xA8\u0349\u0100gp\u3862\u3866on;\u4173f;\uC000\u{1D566}\u0300adhlsu\u114B\u3878\u387D\u1372\u3891\u38A0own\xE1\u13B3arpoon\u0100lr\u3888\u388Cef\xF4\u382Digh\xF4\u382Fi\u0180;hl\u3899\u389A\u389C\u43C5\xBB\u13FAon\xBB\u389Aparrows;\u61C8\u0180cit\u38B0\u38C4\u38C8\u026F\u38B6\0\0\u38C1rn\u0100;e\u38BC\u38BD\u631Dr\xBB\u38BDop;\u630Eng;\u416Fri;\u65F9cr;\uC000\u{1D4CA}\u0180dir\u38D9\u38DD\u38E2ot;\u62F0lde;\u4169i\u0100;f\u3730\u38E8\xBB\u1813\u0100am\u38EF\u38F2r\xF2\u38A8l\u803B\xFC\u40FCangle;\u69A7\u0780ABDacdeflnoprsz\u391C\u391F\u3929\u392D\u39B5\u39B8\u39BD\u39DF\u39E4\u39E8\u39F3\u39F9\u39FD\u3A01\u3A20r\xF2\u03F7ar\u0100;v\u3926\u3927\u6AE8;\u6AE9as\xE8\u03E1\u0100nr\u3932\u3937grt;\u699C\u0380eknprst\u34E3\u3946\u394B\u3952\u395D\u3964\u3996app\xE1\u2415othin\xE7\u1E96\u0180hir\u34EB\u2EC8\u3959op\xF4\u2FB5\u0100;h\u13B7\u3962\xEF\u318D\u0100iu\u3969\u396Dgm\xE1\u33B3\u0100bp\u3972\u3984setneq\u0100;q\u397D\u3980\uC000\u228A\uFE00;\uC000\u2ACB\uFE00setneq\u0100;q\u398F\u3992\uC000\u228B\uFE00;\uC000\u2ACC\uFE00\u0100hr\u399B\u399Fet\xE1\u369Ciangle\u0100lr\u39AA\u39AFeft\xBB\u0925ight\xBB\u1051y;\u4432ash\xBB\u1036\u0180elr\u39C4\u39D2\u39D7\u0180;be\u2DEA\u39CB\u39CFar;\u62BBq;\u625Alip;\u62EE\u0100bt\u39DC\u1468a\xF2\u1469r;\uC000\u{1D533}tr\xE9\u39AEsu\u0100bp\u39EF\u39F1\xBB\u0D1C\xBB\u0D59pf;\uC000\u{1D567}ro\xF0\u0EFBtr\xE9\u39B4\u0100cu\u3A06\u3A0Br;\uC000\u{1D4CB}\u0100bp\u3A10\u3A18n\u0100Ee\u3980\u3A16\xBB\u397En\u0100Ee\u3992\u3A1E\xBB\u3990igzag;\u699A\u0380cefoprs\u3A36\u3A3B\u3A56\u3A5B\u3A54\u3A61\u3A6Airc;\u4175\u0100di\u3A40\u3A51\u0100bg\u3A45\u3A49ar;\u6A5Fe\u0100;q\u15FA\u3A4F;\u6259erp;\u6118r;\uC000\u{1D534}pf;\uC000\u{1D568}\u0100;e\u1479\u3A66at\xE8\u1479cr;\uC000\u{1D4CC}\u0AE3\u178E\u3A87\0\u3A8B\0\u3A90\u3A9B\0\0\u3A9D\u3AA8\u3AAB\u3AAF\0\0\u3AC3\u3ACE\0\u3AD8\u17DC\u17DFtr\xE9\u17D1r;\uC000\u{1D535}\u0100Aa\u3A94\u3A97r\xF2\u03C3r\xF2\u09F6;\u43BE\u0100Aa\u3AA1\u3AA4r\xF2\u03B8r\xF2\u09EBa\xF0\u2713is;\u62FB\u0180dpt\u17A4\u3AB5\u3ABE\u0100fl\u3ABA\u17A9;\uC000\u{1D569}im\xE5\u17B2\u0100Aa\u3AC7\u3ACAr\xF2\u03CEr\xF2\u0A01\u0100cq\u3AD2\u17B8r;\uC000\u{1D4CD}\u0100pt\u17D6\u3ADCr\xE9\u17D4\u0400acefiosu\u3AF0\u3AFD\u3B08\u3B0C\u3B11\u3B15\u3B1B\u3B21c\u0100uy\u3AF6\u3AFBte\u803B\xFD\u40FD;\u444F\u0100iy\u3B02\u3B06rc;\u4177;\u444Bn\u803B\xA5\u40A5r;\uC000\u{1D536}cy;\u4457pf;\uC000\u{1D56A}cr;\uC000\u{1D4CE}\u0100cm\u3B26\u3B29y;\u444El\u803B\xFF\u40FF\u0500acdefhiosw\u3B42\u3B48\u3B54\u3B58\u3B64\u3B69\u3B6D\u3B74\u3B7A\u3B80cute;\u417A\u0100ay\u3B4D\u3B52ron;\u417E;\u4437ot;\u417C\u0100et\u3B5D\u3B61tr\xE6\u155Fa;\u43B6r;\uC000\u{1D537}cy;\u4436grarr;\u61DDpf;\uC000\u{1D56B}cr;\uC000\u{1D4CF}\u0100jn\u3B85\u3B87;\u600Dj;\u600C'
			.split("")
			.map((u) => u.charCodeAt(0))
	),
	ge = new Uint16Array(
		"\u0200aglq	\x1B\u026D\0\0p;\u4026os;\u4027t;\u403Et;\u403Cuot;\u4022"
			.split("")
			.map((u) => u.charCodeAt(0))
	);
var Su;
const ye = new Map([
		[0, 65533],
		[128, 8364],
		[130, 8218],
		[131, 402],
		[132, 8222],
		[133, 8230],
		[134, 8224],
		[135, 8225],
		[136, 710],
		[137, 8240],
		[138, 352],
		[139, 8249],
		[140, 338],
		[142, 381],
		[145, 8216],
		[146, 8217],
		[147, 8220],
		[148, 8221],
		[149, 8226],
		[150, 8211],
		[151, 8212],
		[152, 732],
		[153, 8482],
		[154, 353],
		[155, 8250],
		[156, 339],
		[158, 382],
		[159, 376],
	]),
	Ce =
		(Su = String.fromCodePoint) !== null && Su !== void 0
			? Su
			: function (u) {
					let e = "";
					return (
						u > 65535 &&
							((u -= 65536),
							(e += String.fromCharCode(
								((u >>> 10) & 1023) | 55296
							)),
							(u = 56320 | (u & 1023))),
						(e += String.fromCharCode(u)),
						e
					);
			  };
function De(u) {
	var e;
	return (u >= 55296 && u <= 57343) || u > 1114111
		? 65533
		: (e = ye.get(u)) !== null && e !== void 0
		? e
		: u;
}
var B;
(function (u) {
	(u[(u.NUM = 35)] = "NUM"),
		(u[(u.SEMI = 59)] = "SEMI"),
		(u[(u.EQUALS = 61)] = "EQUALS"),
		(u[(u.ZERO = 48)] = "ZERO"),
		(u[(u.NINE = 57)] = "NINE"),
		(u[(u.LOWER_A = 97)] = "LOWER_A"),
		(u[(u.LOWER_F = 102)] = "LOWER_F"),
		(u[(u.LOWER_X = 120)] = "LOWER_X"),
		(u[(u.LOWER_Z = 122)] = "LOWER_Z"),
		(u[(u.UPPER_A = 65)] = "UPPER_A"),
		(u[(u.UPPER_F = 70)] = "UPPER_F"),
		(u[(u.UPPER_Z = 90)] = "UPPER_Z");
})(B || (B = {}));
const Ae = 32;
var Y;
(function (u) {
	(u[(u.VALUE_LENGTH = 49152)] = "VALUE_LENGTH"),
		(u[(u.BRANCH_LENGTH = 16256)] = "BRANCH_LENGTH"),
		(u[(u.JUMP_TABLE = 127)] = "JUMP_TABLE");
})(Y || (Y = {}));
function Nu(u) {
	return u >= B.ZERO && u <= B.NINE;
}
function Ee(u) {
	return (
		(u >= B.UPPER_A && u <= B.UPPER_F) || (u >= B.LOWER_A && u <= B.LOWER_F)
	);
}
function Fe(u) {
	return (
		(u >= B.UPPER_A && u <= B.UPPER_Z) ||
		(u >= B.LOWER_A && u <= B.LOWER_Z) ||
		Nu(u)
	);
}
function we(u) {
	return u === B.EQUALS || Fe(u);
}
var T;
(function (u) {
	(u[(u.EntityStart = 0)] = "EntityStart"),
		(u[(u.NumericStart = 1)] = "NumericStart"),
		(u[(u.NumericDecimal = 2)] = "NumericDecimal"),
		(u[(u.NumericHex = 3)] = "NumericHex"),
		(u[(u.NamedEntity = 4)] = "NamedEntity");
})(T || (T = {}));
var J;
(function (u) {
	(u[(u.Legacy = 0)] = "Legacy"),
		(u[(u.Strict = 1)] = "Strict"),
		(u[(u.Attribute = 2)] = "Attribute");
})(J || (J = {}));
class ve {
	constructor(e, t, n) {
		(this.decodeTree = e),
			(this.emitCodePoint = t),
			(this.errors = n),
			(this.state = T.EntityStart),
			(this.consumed = 1),
			(this.result = 0),
			(this.treeIndex = 0),
			(this.excess = 1),
			(this.decodeMode = J.Strict);
	}
	startEntity(e) {
		(this.decodeMode = e),
			(this.state = T.EntityStart),
			(this.result = 0),
			(this.treeIndex = 0),
			(this.excess = 1),
			(this.consumed = 1);
	}
	write(e, t) {
		switch (this.state) {
			case T.EntityStart:
				return e.charCodeAt(t) === B.NUM
					? ((this.state = T.NumericStart),
					  (this.consumed += 1),
					  this.stateNumericStart(e, t + 1))
					: ((this.state = T.NamedEntity),
					  this.stateNamedEntity(e, t));
			case T.NumericStart:
				return this.stateNumericStart(e, t);
			case T.NumericDecimal:
				return this.stateNumericDecimal(e, t);
			case T.NumericHex:
				return this.stateNumericHex(e, t);
			case T.NamedEntity:
				return this.stateNamedEntity(e, t);
		}
	}
	stateNumericStart(e, t) {
		return t >= e.length
			? -1
			: (e.charCodeAt(t) | Ae) === B.LOWER_X
			? ((this.state = T.NumericHex),
			  (this.consumed += 1),
			  this.stateNumericHex(e, t + 1))
			: ((this.state = T.NumericDecimal), this.stateNumericDecimal(e, t));
	}
	addToNumericResult(e, t, n, c) {
		if (t !== n) {
			const r = n - t;
			(this.result =
				this.result * Math.pow(c, r) + parseInt(e.substr(t, r), c)),
				(this.consumed += r);
		}
	}
	stateNumericHex(e, t) {
		const n = t;
		for (; t < e.length; ) {
			const c = e.charCodeAt(t);
			if (Nu(c) || Ee(c)) t += 1;
			else
				return (
					this.addToNumericResult(e, n, t, 16),
					this.emitNumericEntity(c, 3)
				);
		}
		return this.addToNumericResult(e, n, t, 16), -1;
	}
	stateNumericDecimal(e, t) {
		const n = t;
		for (; t < e.length; ) {
			const c = e.charCodeAt(t);
			if (Nu(c)) t += 1;
			else
				return (
					this.addToNumericResult(e, n, t, 10),
					this.emitNumericEntity(c, 2)
				);
		}
		return this.addToNumericResult(e, n, t, 10), -1;
	}
	emitNumericEntity(e, t) {
		var n;
		if (this.consumed <= t)
			return (
				(n = this.errors) === null ||
					n === void 0 ||
					n.absenceOfDigitsInNumericCharacterReference(this.consumed),
				0
			);
		if (e === B.SEMI) this.consumed += 1;
		else if (this.decodeMode === J.Strict) return 0;
		return (
			this.emitCodePoint(De(this.result), this.consumed),
			this.errors &&
				(e !== B.SEMI &&
					this.errors.missingSemicolonAfterCharacterReference(),
				this.errors.validateNumericCharacterReference(this.result)),
			this.consumed
		);
	}
	stateNamedEntity(e, t) {
		const { decodeTree: n } = this;
		let c = n[this.treeIndex],
			r = (c & Y.VALUE_LENGTH) >> 14;
		for (; t < e.length; t++, this.excess++) {
			const i = e.charCodeAt(t);
			if (
				((this.treeIndex = Se(
					n,
					c,
					this.treeIndex + Math.max(1, r),
					i
				)),
				this.treeIndex < 0)
			)
				return this.result === 0 ||
					(this.decodeMode === J.Attribute && (r === 0 || we(i)))
					? 0
					: this.emitNotTerminatedNamedEntity();
			if (
				((c = n[this.treeIndex]),
				(r = (c & Y.VALUE_LENGTH) >> 14),
				r !== 0)
			) {
				if (i === B.SEMI)
					return this.emitNamedEntityData(
						this.treeIndex,
						r,
						this.consumed + this.excess
					);
				this.decodeMode !== J.Strict &&
					((this.result = this.treeIndex),
					(this.consumed += this.excess),
					(this.excess = 0));
			}
		}
		return -1;
	}
	emitNotTerminatedNamedEntity() {
		var e;
		const { result: t, decodeTree: n } = this,
			c = (n[t] & Y.VALUE_LENGTH) >> 14;
		return (
			this.emitNamedEntityData(t, c, this.consumed),
			(e = this.errors) === null ||
				e === void 0 ||
				e.missingSemicolonAfterCharacterReference(),
			this.consumed
		);
	}
	emitNamedEntityData(e, t, n) {
		const { decodeTree: c } = this;
		return (
			this.emitCodePoint(t === 1 ? c[e] & ~Y.VALUE_LENGTH : c[e + 1], n),
			t === 3 && this.emitCodePoint(c[e + 2], n),
			n
		);
	}
	end() {
		var e;
		switch (this.state) {
			case T.NamedEntity:
				return this.result !== 0 &&
					(this.decodeMode !== J.Attribute ||
						this.result === this.treeIndex)
					? this.emitNotTerminatedNamedEntity()
					: 0;
			case T.NumericDecimal:
				return this.emitNumericEntity(0, 2);
			case T.NumericHex:
				return this.emitNumericEntity(0, 3);
			case T.NumericStart:
				return (
					(e = this.errors) === null ||
						e === void 0 ||
						e.absenceOfDigitsInNumericCharacterReference(
							this.consumed
						),
					0
				);
			case T.EntityStart:
				return 0;
		}
	}
}
function m0(u) {
	let e = "";
	const t = new ve(u, (n) => (e += Ce(n)));
	return function (c, r) {
		let i = 0,
			o = 0;
		for (; (o = c.indexOf("&", o)) >= 0; ) {
			(e += c.slice(i, o)), t.startEntity(r);
			const s = t.write(c, o + 1);
			if (s < 0) {
				i = o + t.end();
				break;
			}
			(i = o + s), (o = s === 0 ? i + 1 : i);
		}
		const a = e + c.slice(i);
		return (e = ""), a;
	};
}
function Se(u, e, t, n) {
	const c = (e & Y.BRANCH_LENGTH) >> 7,
		r = e & Y.JUMP_TABLE;
	if (c === 0) return r !== 0 && n === r ? t : -1;
	if (r) {
		const a = n - r;
		return a < 0 || a >= c ? -1 : u[t + a] - 1;
	}
	let i = t,
		o = i + c - 1;
	for (; i <= o; ) {
		const a = (i + o) >>> 1,
			s = u[a];
		if (s < n) i = a + 1;
		else if (s > n) o = a - 1;
		else return u[a + c];
	}
	return -1;
}
const ze = m0(ke);
m0(ge);
function x0(u, e = J.Legacy) {
	return ze(u, e);
}
function qe(u) {
	return Object.prototype.toString.call(u);
}
function Ou(u) {
	return qe(u) === "[object String]";
}
const Te = Object.prototype.hasOwnProperty;
function Be(u, e) {
	return Te.call(u, e);
}
function Du(u) {
	return (
		Array.prototype.slice.call(arguments, 1).forEach(function (t) {
			if (!!t) {
				if (typeof t != "object")
					throw new TypeError(t + "must be object");
				Object.keys(t).forEach(function (n) {
					u[n] = t[n];
				});
			}
		}),
		u
	);
}
function k0(u, e, t) {
	return [].concat(u.slice(0, e), t, u.slice(e + 1));
}
function ju(u) {
	return !(
		(u >= 55296 && u <= 57343) ||
		(u >= 64976 && u <= 65007) ||
		(u & 65535) === 65535 ||
		(u & 65535) === 65534 ||
		(u >= 0 && u <= 8) ||
		u === 11 ||
		(u >= 14 && u <= 31) ||
		(u >= 127 && u <= 159) ||
		u > 1114111
	);
}
function gu(u) {
	if (u > 65535) {
		u -= 65536;
		const e = 55296 + (u >> 10),
			t = 56320 + (u & 1023);
		return String.fromCharCode(e, t);
	}
	return String.fromCharCode(u);
}
const g0 = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g,
	Ie = /&([a-z#][a-z0-9]{1,31});/gi,
	Me = new RegExp(g0.source + "|" + Ie.source, "gi"),
	Ne = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))$/i;
function Le(u, e) {
	if (e.charCodeAt(0) === 35 && Ne.test(e)) {
		const n =
			e[1].toLowerCase() === "x"
				? parseInt(e.slice(2), 16)
				: parseInt(e.slice(1), 10);
		return ju(n) ? gu(n) : u;
	}
	const t = x0(u);
	return t !== u ? t : u;
}
function Re(u) {
	return u.indexOf("\\") < 0 ? u : u.replace(g0, "$1");
}
function iu(u) {
	return u.indexOf("\\") < 0 && u.indexOf("&") < 0
		? u
		: u.replace(Me, function (e, t, n) {
				return t || Le(e, n);
		  });
}
const Pe = /[&<>"]/,
	$e = /[&<>"]/g,
	Oe = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function je(u) {
	return Oe[u];
}
function X(u) {
	return Pe.test(u) ? u.replace($e, je) : u;
}
const Ue = /[.?*+^$[\]\\(){}|-]/g;
function Ze(u) {
	return u.replace(Ue, "\\$&");
}
function S(u) {
	switch (u) {
		case 9:
		case 32:
			return !0;
	}
	return !1;
}
function au(u) {
	if (u >= 8192 && u <= 8202) return !0;
	switch (u) {
		case 9:
		case 10:
		case 11:
		case 12:
		case 13:
		case 32:
		case 160:
		case 5760:
		case 8239:
		case 8287:
		case 12288:
			return !0;
	}
	return !1;
}
function su(u) {
	return _0.test(u);
}
function lu(u) {
	switch (u) {
		case 33:
		case 34:
		case 35:
		case 36:
		case 37:
		case 38:
		case 39:
		case 40:
		case 41:
		case 42:
		case 43:
		case 44:
		case 45:
		case 46:
		case 47:
		case 58:
		case 59:
		case 60:
		case 61:
		case 62:
		case 63:
		case 64:
		case 91:
		case 92:
		case 93:
		case 94:
		case 95:
		case 96:
		case 123:
		case 124:
		case 125:
		case 126:
			return !0;
		default:
			return !1;
	}
}
function Au(u) {
	return (
		(u = u.trim().replace(/\s+/g, " ")),
		"\u1E9E".toLowerCase() === "\u1E7E" && (u = u.replace(/ẞ/g, "\xDF")),
		u.toLowerCase().toUpperCase()
	);
}
const He = { mdurl: he, ucmicro: xe },
	Ve = Object.freeze(
		Object.defineProperty(
			{
				__proto__: null,
				lib: He,
				assign: Du,
				isString: Ou,
				has: Be,
				unescapeMd: Re,
				unescapeAll: iu,
				isValidEntityCode: ju,
				fromCodePoint: gu,
				escapeHtml: X,
				arrayReplaceAt: k0,
				isSpace: S,
				isWhiteSpace: au,
				isMdAsciiPunct: lu,
				isPunctChar: su,
				escapeRE: Ze,
				normalizeReference: Au,
			},
			Symbol.toStringTag,
			{ value: "Module" }
		)
	);
function Ge(u, e, t) {
	let n, c, r, i;
	const o = u.posMax,
		a = u.pos;
	for (u.pos = e + 1, n = 1; u.pos < o; ) {
		if (((r = u.src.charCodeAt(u.pos)), r === 93 && (n--, n === 0))) {
			c = !0;
			break;
		}
		if (((i = u.pos), u.md.inline.skipToken(u), r === 91)) {
			if (i === u.pos - 1) n++;
			else if (t) return (u.pos = a), -1;
		}
	}
	let s = -1;
	return c && (s = u.pos), (u.pos = a), s;
}
function Qe(u, e, t) {
	let n,
		c = e;
	const r = { ok: !1, pos: 0, lines: 0, str: "" };
	if (u.charCodeAt(c) === 60) {
		for (c++; c < t; ) {
			if (((n = u.charCodeAt(c)), n === 10 || n === 60)) return r;
			if (n === 62)
				return (
					(r.pos = c + 1),
					(r.str = iu(u.slice(e + 1, c))),
					(r.ok = !0),
					r
				);
			if (n === 92 && c + 1 < t) {
				c += 2;
				continue;
			}
			c++;
		}
		return r;
	}
	let i = 0;
	for (
		;
		c < t && ((n = u.charCodeAt(c)), !(n === 32 || n < 32 || n === 127));

	) {
		if (n === 92 && c + 1 < t) {
			if (u.charCodeAt(c + 1) === 32) break;
			c += 2;
			continue;
		}
		if (n === 40 && (i++, i > 32)) return r;
		if (n === 41) {
			if (i === 0) break;
			i--;
		}
		c++;
	}
	return (
		e === c ||
			i !== 0 ||
			((r.str = iu(u.slice(e, c))), (r.pos = c), (r.ok = !0)),
		r
	);
}
function We(u, e, t) {
	let n,
		c,
		r = 0,
		i = e;
	const o = { ok: !1, pos: 0, lines: 0, str: "" };
	if (i >= t || ((c = u.charCodeAt(i)), c !== 34 && c !== 39 && c !== 40))
		return o;
	for (i++, c === 40 && (c = 41); i < t; ) {
		if (((n = u.charCodeAt(i)), n === c))
			return (
				(o.pos = i + 1),
				(o.lines = r),
				(o.str = iu(u.slice(e + 1, i))),
				(o.ok = !0),
				o
			);
		if (n === 40 && c === 41) return o;
		n === 10
			? r++
			: n === 92 && i + 1 < t && (i++, u.charCodeAt(i) === 10 && r++),
			i++;
	}
	return o;
}
const Je = Object.freeze(
		Object.defineProperty(
			{
				__proto__: null,
				parseLinkLabel: Ge,
				parseLinkDestination: Qe,
				parseLinkTitle: We,
			},
			Symbol.toStringTag,
			{ value: "Module" }
		)
	),
	G = {};
G.code_inline = function (u, e, t, n, c) {
	const r = u[e];
	return "<code" + c.renderAttrs(r) + ">" + X(r.content) + "</code>";
};
G.code_block = function (u, e, t, n, c) {
	const r = u[e];
	return (
		"<pre" +
		c.renderAttrs(r) +
		"><code>" +
		X(u[e].content) +
		`</code></pre>
`
	);
};
G.fence = function (u, e, t, n, c) {
	const r = u[e],
		i = r.info ? iu(r.info).trim() : "";
	let o = "",
		a = "";
	if (i) {
		const l = i.split(/(\s+)/g);
		(o = l[0]), (a = l.slice(2).join(""));
	}
	let s;
	if (
		(t.highlight
			? (s = t.highlight(r.content, o, a) || X(r.content))
			: (s = X(r.content)),
		s.indexOf("<pre") === 0)
	)
		return (
			s +
			`
`
		);
	if (i) {
		const l = r.attrIndex("class"),
			f = r.attrs ? r.attrs.slice() : [];
		l < 0
			? f.push(["class", t.langPrefix + o])
			: ((f[l] = f[l].slice()), (f[l][1] += " " + t.langPrefix + o));
		const p = { attrs: f };
		return `<pre><code${c.renderAttrs(p)}>${s}</code></pre>
`;
	}
	return `<pre><code${c.renderAttrs(r)}>${s}</code></pre>
`;
};
G.image = function (u, e, t, n, c) {
	const r = u[e];
	return (
		(r.attrs[r.attrIndex("alt")][1] = c.renderInlineAsText(
			r.children,
			t,
			n
		)),
		c.renderToken(u, e, t)
	);
};
G.hardbreak = function (u, e, t) {
	return t.xhtmlOut
		? `<br />
`
		: `<br>
`;
};
G.softbreak = function (u, e, t) {
	return t.breaks
		? t.xhtmlOut
			? `<br />
`
			: `<br>
`
		: `
`;
};
G.text = function (u, e) {
	return X(u[e].content);
};
G.html_block = function (u, e) {
	return u[e].content;
};
G.html_inline = function (u, e) {
	return u[e].content;
};
function ru() {
	this.rules = Du({}, G);
}
ru.prototype.renderAttrs = function (e) {
	let t, n, c;
	if (!e.attrs) return "";
	for (c = "", t = 0, n = e.attrs.length; t < n; t++)
		c += " " + X(e.attrs[t][0]) + '="' + X(e.attrs[t][1]) + '"';
	return c;
};
ru.prototype.renderToken = function (e, t, n) {
	const c = e[t];
	let r = "";
	if (c.hidden) return "";
	c.block &&
		c.nesting !== -1 &&
		t &&
		e[t - 1].hidden &&
		(r += `
`),
		(r += (c.nesting === -1 ? "</" : "<") + c.tag),
		(r += this.renderAttrs(c)),
		c.nesting === 0 && n.xhtmlOut && (r += " /");
	let i = !1;
	if (c.block && ((i = !0), c.nesting === 1 && t + 1 < e.length)) {
		const o = e[t + 1];
		(o.type === "inline" ||
			o.hidden ||
			(o.nesting === -1 && o.tag === c.tag)) &&
			(i = !1);
	}
	return (
		(r += i
			? `>
`
			: ">"),
		r
	);
};
ru.prototype.renderInline = function (u, e, t) {
	let n = "";
	const c = this.rules;
	for (let r = 0, i = u.length; r < i; r++) {
		const o = u[r].type;
		typeof c[o] != "undefined"
			? (n += c[o](u, r, e, t, this))
			: (n += this.renderToken(u, r, e));
	}
	return n;
};
ru.prototype.renderInlineAsText = function (u, e, t) {
	let n = "";
	for (let c = 0, r = u.length; c < r; c++)
		switch (u[c].type) {
			case "text":
				n += u[c].content;
				break;
			case "image":
				n += this.renderInlineAsText(u[c].children, e, t);
				break;
			case "html_inline":
			case "html_block":
				n += u[c].content;
				break;
			case "softbreak":
			case "hardbreak":
				n += `
`;
				break;
		}
	return n;
};
ru.prototype.render = function (u, e, t) {
	let n = "";
	const c = this.rules;
	for (let r = 0, i = u.length; r < i; r++) {
		const o = u[r].type;
		o === "inline"
			? (n += this.renderInline(u[r].children, e, t))
			: typeof c[o] != "undefined"
			? (n += c[o](u, r, e, t, this))
			: (n += this.renderToken(u, r, e, t));
	}
	return n;
};
function L() {
	(this.__rules__ = []), (this.__cache__ = null);
}
L.prototype.__find__ = function (u) {
	for (let e = 0; e < this.__rules__.length; e++)
		if (this.__rules__[e].name === u) return e;
	return -1;
};
L.prototype.__compile__ = function () {
	const u = this,
		e = [""];
	u.__rules__.forEach(function (t) {
		!t.enabled ||
			t.alt.forEach(function (n) {
				e.indexOf(n) < 0 && e.push(n);
			});
	}),
		(u.__cache__ = {}),
		e.forEach(function (t) {
			(u.__cache__[t] = []),
				u.__rules__.forEach(function (n) {
					!n.enabled ||
						(t && n.alt.indexOf(t) < 0) ||
						u.__cache__[t].push(n.fn);
				});
		});
};
L.prototype.at = function (u, e, t) {
	const n = this.__find__(u),
		c = t || {};
	if (n === -1) throw new Error("Parser rule not found: " + u);
	(this.__rules__[n].fn = e),
		(this.__rules__[n].alt = c.alt || []),
		(this.__cache__ = null);
};
L.prototype.before = function (u, e, t, n) {
	const c = this.__find__(u),
		r = n || {};
	if (c === -1) throw new Error("Parser rule not found: " + u);
	this.__rules__.splice(c, 0, {
		name: e,
		enabled: !0,
		fn: t,
		alt: r.alt || [],
	}),
		(this.__cache__ = null);
};
L.prototype.after = function (u, e, t, n) {
	const c = this.__find__(u),
		r = n || {};
	if (c === -1) throw new Error("Parser rule not found: " + u);
	this.__rules__.splice(c + 1, 0, {
		name: e,
		enabled: !0,
		fn: t,
		alt: r.alt || [],
	}),
		(this.__cache__ = null);
};
L.prototype.push = function (u, e, t) {
	const n = t || {};
	this.__rules__.push({ name: u, enabled: !0, fn: e, alt: n.alt || [] }),
		(this.__cache__ = null);
};
L.prototype.enable = function (u, e) {
	Array.isArray(u) || (u = [u]);
	const t = [];
	return (
		u.forEach(function (n) {
			const c = this.__find__(n);
			if (c < 0) {
				if (e) return;
				throw new Error("Rules manager: invalid rule name " + n);
			}
			(this.__rules__[c].enabled = !0), t.push(n);
		}, this),
		(this.__cache__ = null),
		t
	);
};
L.prototype.enableOnly = function (u, e) {
	Array.isArray(u) || (u = [u]),
		this.__rules__.forEach(function (t) {
			t.enabled = !1;
		}),
		this.enable(u, e);
};
L.prototype.disable = function (u, e) {
	Array.isArray(u) || (u = [u]);
	const t = [];
	return (
		u.forEach(function (n) {
			const c = this.__find__(n);
			if (c < 0) {
				if (e) return;
				throw new Error("Rules manager: invalid rule name " + n);
			}
			(this.__rules__[c].enabled = !1), t.push(n);
		}, this),
		(this.__cache__ = null),
		t
	);
};
L.prototype.getRules = function (u) {
	return (
		this.__cache__ === null && this.__compile__(), this.__cache__[u] || []
	);
};
function j(u, e, t) {
	(this.type = u),
		(this.tag = e),
		(this.attrs = null),
		(this.map = null),
		(this.nesting = t),
		(this.level = 0),
		(this.children = null),
		(this.content = ""),
		(this.markup = ""),
		(this.info = ""),
		(this.meta = null),
		(this.block = !1),
		(this.hidden = !1);
}
j.prototype.attrIndex = function (e) {
	if (!this.attrs) return -1;
	const t = this.attrs;
	for (let n = 0, c = t.length; n < c; n++) if (t[n][0] === e) return n;
	return -1;
};
j.prototype.attrPush = function (e) {
	this.attrs ? this.attrs.push(e) : (this.attrs = [e]);
};
j.prototype.attrSet = function (e, t) {
	const n = this.attrIndex(e),
		c = [e, t];
	n < 0 ? this.attrPush(c) : (this.attrs[n] = c);
};
j.prototype.attrGet = function (e) {
	const t = this.attrIndex(e);
	let n = null;
	return t >= 0 && (n = this.attrs[t][1]), n;
};
j.prototype.attrJoin = function (e, t) {
	const n = this.attrIndex(e);
	n < 0
		? this.attrPush([e, t])
		: (this.attrs[n][1] = this.attrs[n][1] + " " + t);
};
function y0(u, e, t) {
	(this.src = u),
		(this.env = t),
		(this.tokens = []),
		(this.inlineMode = !1),
		(this.md = e);
}
y0.prototype.Token = j;
const Ye = /\r\n?|\n/g,
	Xe = /\0/g;
function Ke(u) {
	let e;
	(e = u.src.replace(
		Ye,
		`
`
	)),
		(e = e.replace(Xe, "\uFFFD")),
		(u.src = e);
}
function ut(u) {
	let e;
	u.inlineMode
		? ((e = new u.Token("inline", "", 0)),
		  (e.content = u.src),
		  (e.map = [0, 1]),
		  (e.children = []),
		  u.tokens.push(e))
		: u.md.block.parse(u.src, u.md, u.env, u.tokens);
}
function et(u) {
	const e = u.tokens;
	for (let t = 0, n = e.length; t < n; t++) {
		const c = e[t];
		c.type === "inline" &&
			u.md.inline.parse(c.content, u.md, u.env, c.children);
	}
}
function tt(u) {
	return /^<a[>\s]/i.test(u);
}
function rt(u) {
	return /^<\/a\s*>/i.test(u);
}
function nt(u) {
	const e = u.tokens;
	if (!!u.md.options.linkify)
		for (let t = 0, n = e.length; t < n; t++) {
			if (e[t].type !== "inline" || !u.md.linkify.pretest(e[t].content))
				continue;
			let c = e[t].children,
				r = 0;
			for (let i = c.length - 1; i >= 0; i--) {
				const o = c[i];
				if (o.type === "link_close") {
					for (
						i--;
						c[i].level !== o.level && c[i].type !== "link_open";

					)
						i--;
					continue;
				}
				if (
					(o.type === "html_inline" &&
						(tt(o.content) && r > 0 && r--, rt(o.content) && r++),
					!(r > 0) &&
						o.type === "text" &&
						u.md.linkify.test(o.content))
				) {
					const a = o.content;
					let s = u.md.linkify.match(a);
					const l = [];
					let f = o.level,
						p = 0;
					s.length > 0 &&
						s[0].index === 0 &&
						i > 0 &&
						c[i - 1].type === "text_special" &&
						(s = s.slice(1));
					for (let h = 0; h < s.length; h++) {
						const d = s[h].url,
							y = u.md.normalizeLink(d);
						if (!u.md.validateLink(y)) continue;
						let g = s[h].text;
						s[h].schema
							? s[h].schema === "mailto:" && !/^mailto:/i.test(g)
								? (g = u.md
										.normalizeLinkText("mailto:" + g)
										.replace(/^mailto:/, ""))
								: (g = u.md.normalizeLinkText(g))
							: (g = u.md
									.normalizeLinkText("http://" + g)
									.replace(/^http:\/\//, ""));
						const w = s[h].index;
						if (w > p) {
							const _ = new u.Token("text", "", 0);
							(_.content = a.slice(p, w)),
								(_.level = f),
								l.push(_);
						}
						const v = new u.Token("link_open", "a", 1);
						(v.attrs = [["href", y]]),
							(v.level = f++),
							(v.markup = "linkify"),
							(v.info = "auto"),
							l.push(v);
						const x = new u.Token("text", "", 0);
						(x.content = g), (x.level = f), l.push(x);
						const A = new u.Token("link_close", "a", -1);
						(A.level = --f),
							(A.markup = "linkify"),
							(A.info = "auto"),
							l.push(A),
							(p = s[h].lastIndex);
					}
					if (p < a.length) {
						const h = new u.Token("text", "", 0);
						(h.content = a.slice(p)), (h.level = f), l.push(h);
					}
					e[t].children = c = k0(c, i, l);
				}
			}
		}
}
const C0 = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/,
	ct = /\((c|tm|r)\)/i,
	ot = /\((c|tm|r)\)/gi,
	it = { c: "\xA9", r: "\xAE", tm: "\u2122" };
function at(u, e) {
	return it[e.toLowerCase()];
}
function st(u) {
	let e = 0;
	for (let t = u.length - 1; t >= 0; t--) {
		const n = u[t];
		n.type === "text" && !e && (n.content = n.content.replace(ot, at)),
			n.type === "link_open" && n.info === "auto" && e--,
			n.type === "link_close" && n.info === "auto" && e++;
	}
}
function lt(u) {
	let e = 0;
	for (let t = u.length - 1; t >= 0; t--) {
		const n = u[t];
		n.type === "text" &&
			!e &&
			C0.test(n.content) &&
			(n.content = n.content
				.replace(/\+-/g, "\xB1")
				.replace(/\.{2,}/g, "\u2026")
				.replace(/([?!])…/g, "$1..")
				.replace(/([?!]){4,}/g, "$1$1$1")
				.replace(/,{2,}/g, ",")
				.replace(/(^|[^-])---(?=[^-]|$)/gm, "$1\u2014")
				.replace(/(^|\s)--(?=\s|$)/gm, "$1\u2013")
				.replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, "$1\u2013")),
			n.type === "link_open" && n.info === "auto" && e--,
			n.type === "link_close" && n.info === "auto" && e++;
	}
}
function ft(u) {
	let e;
	if (!!u.md.options.typographer)
		for (e = u.tokens.length - 1; e >= 0; e--)
			u.tokens[e].type === "inline" &&
				(ct.test(u.tokens[e].content) && st(u.tokens[e].children),
				C0.test(u.tokens[e].content) && lt(u.tokens[e].children));
}
const dt = /['"]/,
	t0 = /['"]/g,
	r0 = "\u2019";
function mu(u, e, t) {
	return u.slice(0, e) + t + u.slice(e + 1);
}
function ht(u, e) {
	let t;
	const n = [];
	for (let c = 0; c < u.length; c++) {
		const r = u[c],
			i = u[c].level;
		for (t = n.length - 1; t >= 0 && !(n[t].level <= i); t--);
		if (((n.length = t + 1), r.type !== "text")) continue;
		let o = r.content,
			a = 0,
			s = o.length;
		u: for (; a < s; ) {
			t0.lastIndex = a;
			const l = t0.exec(o);
			if (!l) break;
			let f = !0,
				p = !0;
			a = l.index + 1;
			const h = l[0] === "'";
			let d = 32;
			if (l.index - 1 >= 0) d = o.charCodeAt(l.index - 1);
			else
				for (
					t = c - 1;
					t >= 0 &&
					!(u[t].type === "softbreak" || u[t].type === "hardbreak");
					t--
				)
					if (!!u[t].content) {
						d = u[t].content.charCodeAt(u[t].content.length - 1);
						break;
					}
			let y = 32;
			if (a < s) y = o.charCodeAt(a);
			else
				for (
					t = c + 1;
					t < u.length &&
					!(u[t].type === "softbreak" || u[t].type === "hardbreak");
					t++
				)
					if (!!u[t].content) {
						y = u[t].content.charCodeAt(0);
						break;
					}
			const g = lu(d) || su(String.fromCharCode(d)),
				w = lu(y) || su(String.fromCharCode(y)),
				v = au(d),
				x = au(y);
			if (
				(x ? (f = !1) : w && (v || g || (f = !1)),
				v ? (p = !1) : g && (x || w || (p = !1)),
				y === 34 && l[0] === '"' && d >= 48 && d <= 57 && (p = f = !1),
				f && p && ((f = g), (p = w)),
				!f && !p)
			) {
				h && (r.content = mu(r.content, l.index, r0));
				continue;
			}
			if (p)
				for (t = n.length - 1; t >= 0; t--) {
					let A = n[t];
					if (n[t].level < i) break;
					if (A.single === h && n[t].level === i) {
						A = n[t];
						let _, m;
						h
							? ((_ = e.md.options.quotes[2]),
							  (m = e.md.options.quotes[3]))
							: ((_ = e.md.options.quotes[0]),
							  (m = e.md.options.quotes[1])),
							(r.content = mu(r.content, l.index, m)),
							(u[A.token].content = mu(
								u[A.token].content,
								A.pos,
								_
							)),
							(a += m.length - 1),
							A.token === c && (a += _.length - 1),
							(o = r.content),
							(s = o.length),
							(n.length = t);
						continue u;
					}
				}
			f
				? n.push({ token: c, pos: l.index, single: h, level: i })
				: p && h && (r.content = mu(r.content, l.index, r0));
		}
	}
}
function bt(u) {
	if (!!u.md.options.typographer)
		for (let e = u.tokens.length - 1; e >= 0; e--)
			u.tokens[e].type !== "inline" ||
				!dt.test(u.tokens[e].content) ||
				ht(u.tokens[e].children, u);
}
function pt(u) {
	let e, t;
	const n = u.tokens,
		c = n.length;
	for (let r = 0; r < c; r++) {
		if (n[r].type !== "inline") continue;
		const i = n[r].children,
			o = i.length;
		for (e = 0; e < o; e++)
			i[e].type === "text_special" && (i[e].type = "text");
		for (e = t = 0; e < o; e++)
			i[e].type === "text" && e + 1 < o && i[e + 1].type === "text"
				? (i[e + 1].content = i[e].content + i[e + 1].content)
				: (e !== t && (i[t] = i[e]), t++);
		e !== t && (i.length = t);
	}
}
const zu = [
	["normalize", Ke],
	["block", ut],
	["inline", et],
	["linkify", nt],
	["replacements", ft],
	["smartquotes", bt],
	["text_join", pt],
];
function Uu() {
	this.ruler = new L();
	for (let u = 0; u < zu.length; u++) this.ruler.push(zu[u][0], zu[u][1]);
}
Uu.prototype.process = function (u) {
	const e = this.ruler.getRules("");
	for (let t = 0, n = e.length; t < n; t++) e[t](u);
};
Uu.prototype.State = y0;
function Q(u, e, t, n) {
	(this.src = u),
		(this.md = e),
		(this.env = t),
		(this.tokens = n),
		(this.bMarks = []),
		(this.eMarks = []),
		(this.tShift = []),
		(this.sCount = []),
		(this.bsCount = []),
		(this.blkIndent = 0),
		(this.line = 0),
		(this.lineMax = 0),
		(this.tight = !1),
		(this.ddIndent = -1),
		(this.listIndent = -1),
		(this.parentType = "root"),
		(this.level = 0);
	const c = this.src;
	for (let r = 0, i = 0, o = 0, a = 0, s = c.length, l = !1; i < s; i++) {
		const f = c.charCodeAt(i);
		if (!l)
			if (S(f)) {
				o++, f === 9 ? (a += 4 - (a % 4)) : a++;
				continue;
			} else l = !0;
		(f === 10 || i === s - 1) &&
			(f !== 10 && i++,
			this.bMarks.push(r),
			this.eMarks.push(i),
			this.tShift.push(o),
			this.sCount.push(a),
			this.bsCount.push(0),
			(l = !1),
			(o = 0),
			(a = 0),
			(r = i + 1));
	}
	this.bMarks.push(c.length),
		this.eMarks.push(c.length),
		this.tShift.push(0),
		this.sCount.push(0),
		this.bsCount.push(0),
		(this.lineMax = this.bMarks.length - 1);
}
Q.prototype.push = function (u, e, t) {
	const n = new j(u, e, t);
	return (
		(n.block = !0),
		t < 0 && this.level--,
		(n.level = this.level),
		t > 0 && this.level++,
		this.tokens.push(n),
		n
	);
};
Q.prototype.isEmpty = function (e) {
	return this.bMarks[e] + this.tShift[e] >= this.eMarks[e];
};
Q.prototype.skipEmptyLines = function (e) {
	for (
		let t = this.lineMax;
		e < t && !(this.bMarks[e] + this.tShift[e] < this.eMarks[e]);
		e++
	);
	return e;
};
Q.prototype.skipSpaces = function (e) {
	for (let t = this.src.length; e < t; e++) {
		const n = this.src.charCodeAt(e);
		if (!S(n)) break;
	}
	return e;
};
Q.prototype.skipSpacesBack = function (e, t) {
	if (e <= t) return e;
	for (; e > t; ) if (!S(this.src.charCodeAt(--e))) return e + 1;
	return e;
};
Q.prototype.skipChars = function (e, t) {
	for (let n = this.src.length; e < n && this.src.charCodeAt(e) === t; e++);
	return e;
};
Q.prototype.skipCharsBack = function (e, t, n) {
	if (e <= n) return e;
	for (; e > n; ) if (t !== this.src.charCodeAt(--e)) return e + 1;
	return e;
};
Q.prototype.getLines = function (e, t, n, c) {
	if (e >= t) return "";
	const r = new Array(t - e);
	for (let i = 0, o = e; o < t; o++, i++) {
		let a = 0;
		const s = this.bMarks[o];
		let l = s,
			f;
		for (
			o + 1 < t || c ? (f = this.eMarks[o] + 1) : (f = this.eMarks[o]);
			l < f && a < n;

		) {
			const p = this.src.charCodeAt(l);
			if (S(p)) p === 9 ? (a += 4 - ((a + this.bsCount[o]) % 4)) : a++;
			else if (l - s < this.tShift[o]) a++;
			else break;
			l++;
		}
		a > n
			? (r[i] = new Array(a - n + 1).join(" ") + this.src.slice(l, f))
			: (r[i] = this.src.slice(l, f));
	}
	return r.join("");
};
Q.prototype.Token = j;
function qu(u, e) {
	const t = u.bMarks[e] + u.tShift[e],
		n = u.eMarks[e];
	return u.src.slice(t, n);
}
function n0(u) {
	const e = [],
		t = u.length;
	let n = 0,
		c = u.charCodeAt(n),
		r = !1,
		i = 0,
		o = "";
	for (; n < t; )
		c === 124 &&
			(r
				? ((o += u.substring(i, n - 1)), (i = n))
				: (e.push(o + u.substring(i, n)), (o = ""), (i = n + 1))),
			(r = c === 92),
			n++,
			(c = u.charCodeAt(n));
	return e.push(o + u.substring(i)), e;
}
function _t(u, e, t, n) {
	if (e + 2 > t) return !1;
	let c = e + 1;
	if (u.sCount[c] < u.blkIndent || u.sCount[c] - u.blkIndent >= 4) return !1;
	let r = u.bMarks[c] + u.tShift[c];
	if (r >= u.eMarks[c]) return !1;
	const i = u.src.charCodeAt(r++);
	if ((i !== 124 && i !== 45 && i !== 58) || r >= u.eMarks[c]) return !1;
	const o = u.src.charCodeAt(r++);
	if ((o !== 124 && o !== 45 && o !== 58 && !S(o)) || (i === 45 && S(o)))
		return !1;
	for (; r < u.eMarks[c]; ) {
		const x = u.src.charCodeAt(r);
		if (x !== 124 && x !== 45 && x !== 58 && !S(x)) return !1;
		r++;
	}
	let a = qu(u, e + 1),
		s = a.split("|");
	const l = [];
	for (let x = 0; x < s.length; x++) {
		const A = s[x].trim();
		if (!A) {
			if (x === 0 || x === s.length - 1) continue;
			return !1;
		}
		if (!/^:?-+:?$/.test(A)) return !1;
		A.charCodeAt(A.length - 1) === 58
			? l.push(A.charCodeAt(0) === 58 ? "center" : "right")
			: A.charCodeAt(0) === 58
			? l.push("left")
			: l.push("");
	}
	if (
		((a = qu(u, e).trim()),
		a.indexOf("|") === -1 || u.sCount[e] - u.blkIndent >= 4)
	)
		return !1;
	(s = n0(a)),
		s.length && s[0] === "" && s.shift(),
		s.length && s[s.length - 1] === "" && s.pop();
	const f = s.length;
	if (f === 0 || f !== l.length) return !1;
	if (n) return !0;
	const p = u.parentType;
	u.parentType = "table";
	const h = u.md.block.ruler.getRules("blockquote"),
		d = u.push("table_open", "table", 1),
		y = [e, 0];
	d.map = y;
	const g = u.push("thead_open", "thead", 1);
	g.map = [e, e + 1];
	const w = u.push("tr_open", "tr", 1);
	w.map = [e, e + 1];
	for (let x = 0; x < s.length; x++) {
		const A = u.push("th_open", "th", 1);
		l[x] && (A.attrs = [["style", "text-align:" + l[x]]]);
		const _ = u.push("inline", "", 0);
		(_.content = s[x].trim()),
			(_.children = []),
			u.push("th_close", "th", -1);
	}
	u.push("tr_close", "tr", -1), u.push("thead_close", "thead", -1);
	let v;
	for (c = e + 2; c < t && !(u.sCount[c] < u.blkIndent); c++) {
		let x = !1;
		for (let _ = 0, m = h.length; _ < m; _++)
			if (h[_](u, c, t, !0)) {
				x = !0;
				break;
			}
		if (x || ((a = qu(u, c).trim()), !a) || u.sCount[c] - u.blkIndent >= 4)
			break;
		if (
			((s = n0(a)),
			s.length && s[0] === "" && s.shift(),
			s.length && s[s.length - 1] === "" && s.pop(),
			c === e + 2)
		) {
			const _ = u.push("tbody_open", "tbody", 1);
			_.map = v = [e + 2, 0];
		}
		const A = u.push("tr_open", "tr", 1);
		A.map = [c, c + 1];
		for (let _ = 0; _ < f; _++) {
			const m = u.push("td_open", "td", 1);
			l[_] && (m.attrs = [["style", "text-align:" + l[_]]]);
			const E = u.push("inline", "", 0);
			(E.content = s[_] ? s[_].trim() : ""),
				(E.children = []),
				u.push("td_close", "td", -1);
		}
		u.push("tr_close", "tr", -1);
	}
	return (
		v && (u.push("tbody_close", "tbody", -1), (v[1] = c)),
		u.push("table_close", "table", -1),
		(y[1] = c),
		(u.parentType = p),
		(u.line = c),
		!0
	);
}
function mt(u, e, t) {
	if (u.sCount[e] - u.blkIndent < 4) return !1;
	let n = e + 1,
		c = n;
	for (; n < t; ) {
		if (u.isEmpty(n)) {
			n++;
			continue;
		}
		if (u.sCount[n] - u.blkIndent >= 4) {
			n++, (c = n);
			continue;
		}
		break;
	}
	u.line = c;
	const r = u.push("code_block", "code", 0);
	return (
		(r.content =
			u.getLines(e, c, 4 + u.blkIndent, !1) +
			`
`),
		(r.map = [e, u.line]),
		!0
	);
}
function xt(u, e, t, n) {
	let c = u.bMarks[e] + u.tShift[e],
		r = u.eMarks[e];
	if (u.sCount[e] - u.blkIndent >= 4 || c + 3 > r) return !1;
	const i = u.src.charCodeAt(c);
	if (i !== 126 && i !== 96) return !1;
	let o = c;
	c = u.skipChars(c, i);
	let a = c - o;
	if (a < 3) return !1;
	const s = u.src.slice(o, c),
		l = u.src.slice(c, r);
	if (i === 96 && l.indexOf(String.fromCharCode(i)) >= 0) return !1;
	if (n) return !0;
	let f = e,
		p = !1;
	for (
		;
		f++,
			!(
				f >= t ||
				((c = o = u.bMarks[f] + u.tShift[f]),
				(r = u.eMarks[f]),
				c < r && u.sCount[f] < u.blkIndent)
			);

	)
		if (
			u.src.charCodeAt(c) === i &&
			!(u.sCount[f] - u.blkIndent >= 4) &&
			((c = u.skipChars(c, i)),
			!(c - o < a) && ((c = u.skipSpaces(c)), !(c < r)))
		) {
			p = !0;
			break;
		}
	(a = u.sCount[e]), (u.line = f + (p ? 1 : 0));
	const h = u.push("fence", "code", 0);
	return (
		(h.info = l),
		(h.content = u.getLines(e + 1, f, a, !0)),
		(h.markup = s),
		(h.map = [e, u.line]),
		!0
	);
}
function kt(u, e, t, n) {
	let c = u.bMarks[e] + u.tShift[e],
		r = u.eMarks[e];
	const i = u.lineMax;
	if (u.sCount[e] - u.blkIndent >= 4 || u.src.charCodeAt(c) !== 62) return !1;
	if (n) return !0;
	const o = [],
		a = [],
		s = [],
		l = [],
		f = u.md.block.ruler.getRules("blockquote"),
		p = u.parentType;
	u.parentType = "blockquote";
	let h = !1,
		d;
	for (d = e; d < t; d++) {
		const x = u.sCount[d] < u.blkIndent;
		if (((c = u.bMarks[d] + u.tShift[d]), (r = u.eMarks[d]), c >= r)) break;
		if (u.src.charCodeAt(c++) === 62 && !x) {
			let _ = u.sCount[d] + 1,
				m,
				E;
			u.src.charCodeAt(c) === 32
				? (c++, _++, (E = !1), (m = !0))
				: u.src.charCodeAt(c) === 9
				? ((m = !0),
				  (u.bsCount[d] + _) % 4 === 3
						? (c++, _++, (E = !1))
						: (E = !0))
				: (m = !1);
			let z = _;
			for (o.push(u.bMarks[d]), u.bMarks[d] = c; c < r; ) {
				const M = u.src.charCodeAt(c);
				if (S(M))
					M === 9
						? (z += 4 - ((z + u.bsCount[d] + (E ? 1 : 0)) % 4))
						: z++;
				else break;
				c++;
			}
			(h = c >= r),
				a.push(u.bsCount[d]),
				(u.bsCount[d] = u.sCount[d] + 1 + (m ? 1 : 0)),
				s.push(u.sCount[d]),
				(u.sCount[d] = z - _),
				l.push(u.tShift[d]),
				(u.tShift[d] = c - u.bMarks[d]);
			continue;
		}
		if (h) break;
		let A = !1;
		for (let _ = 0, m = f.length; _ < m; _++)
			if (f[_](u, d, t, !0)) {
				A = !0;
				break;
			}
		if (A) {
			(u.lineMax = d),
				u.blkIndent !== 0 &&
					(o.push(u.bMarks[d]),
					a.push(u.bsCount[d]),
					l.push(u.tShift[d]),
					s.push(u.sCount[d]),
					(u.sCount[d] -= u.blkIndent));
			break;
		}
		o.push(u.bMarks[d]),
			a.push(u.bsCount[d]),
			l.push(u.tShift[d]),
			s.push(u.sCount[d]),
			(u.sCount[d] = -1);
	}
	const y = u.blkIndent;
	u.blkIndent = 0;
	const g = u.push("blockquote_open", "blockquote", 1);
	g.markup = ">";
	const w = [e, 0];
	(g.map = w), u.md.block.tokenize(u, e, d);
	const v = u.push("blockquote_close", "blockquote", -1);
	(v.markup = ">"), (u.lineMax = i), (u.parentType = p), (w[1] = u.line);
	for (let x = 0; x < l.length; x++)
		(u.bMarks[x + e] = o[x]),
			(u.tShift[x + e] = l[x]),
			(u.sCount[x + e] = s[x]),
			(u.bsCount[x + e] = a[x]);
	return (u.blkIndent = y), !0;
}
function gt(u, e, t, n) {
	const c = u.eMarks[e];
	if (u.sCount[e] - u.blkIndent >= 4) return !1;
	let r = u.bMarks[e] + u.tShift[e];
	const i = u.src.charCodeAt(r++);
	if (i !== 42 && i !== 45 && i !== 95) return !1;
	let o = 1;
	for (; r < c; ) {
		const s = u.src.charCodeAt(r++);
		if (s !== i && !S(s)) return !1;
		s === i && o++;
	}
	if (o < 3) return !1;
	if (n) return !0;
	u.line = e + 1;
	const a = u.push("hr", "hr", 0);
	return (
		(a.map = [e, u.line]),
		(a.markup = Array(o + 1).join(String.fromCharCode(i))),
		!0
	);
}
function c0(u, e) {
	const t = u.eMarks[e];
	let n = u.bMarks[e] + u.tShift[e];
	const c = u.src.charCodeAt(n++);
	if (c !== 42 && c !== 45 && c !== 43) return -1;
	if (n < t) {
		const r = u.src.charCodeAt(n);
		if (!S(r)) return -1;
	}
	return n;
}
function o0(u, e) {
	const t = u.bMarks[e] + u.tShift[e],
		n = u.eMarks[e];
	let c = t;
	if (c + 1 >= n) return -1;
	let r = u.src.charCodeAt(c++);
	if (r < 48 || r > 57) return -1;
	for (;;) {
		if (c >= n) return -1;
		if (((r = u.src.charCodeAt(c++)), r >= 48 && r <= 57)) {
			if (c - t >= 10) return -1;
			continue;
		}
		if (r === 41 || r === 46) break;
		return -1;
	}
	return c < n && ((r = u.src.charCodeAt(c)), !S(r)) ? -1 : c;
}
function yt(u, e) {
	const t = u.level + 2;
	for (let n = e + 2, c = u.tokens.length - 2; n < c; n++)
		u.tokens[n].level === t &&
			u.tokens[n].type === "paragraph_open" &&
			((u.tokens[n + 2].hidden = !0),
			(u.tokens[n].hidden = !0),
			(n += 2));
}
function Ct(u, e, t, n) {
	let c,
		r,
		i,
		o,
		a = e,
		s = !0;
	if (
		u.sCount[a] - u.blkIndent >= 4 ||
		(u.listIndent >= 0 &&
			u.sCount[a] - u.listIndent >= 4 &&
			u.sCount[a] < u.blkIndent)
	)
		return !1;
	let l = !1;
	n && u.parentType === "paragraph" && u.sCount[a] >= u.blkIndent && (l = !0);
	let f, p, h;
	if ((h = o0(u, a)) >= 0) {
		if (
			((f = !0),
			(i = u.bMarks[a] + u.tShift[a]),
			(p = Number(u.src.slice(i, h - 1))),
			l && p !== 1)
		)
			return !1;
	} else if ((h = c0(u, a)) >= 0) f = !1;
	else return !1;
	if (l && u.skipSpaces(h) >= u.eMarks[a]) return !1;
	if (n) return !0;
	const d = u.src.charCodeAt(h - 1),
		y = u.tokens.length;
	f
		? ((o = u.push("ordered_list_open", "ol", 1)),
		  p !== 1 && (o.attrs = [["start", p]]))
		: (o = u.push("bullet_list_open", "ul", 1));
	const g = [a, 0];
	(o.map = g), (o.markup = String.fromCharCode(d));
	let w = !1;
	const v = u.md.block.ruler.getRules("list"),
		x = u.parentType;
	for (u.parentType = "list"; a < t; ) {
		(r = h), (c = u.eMarks[a]);
		const A = u.sCount[a] + h - (u.bMarks[a] + u.tShift[a]);
		let _ = A;
		for (; r < c; ) {
			const O = u.src.charCodeAt(r);
			if (O === 9) _ += 4 - ((_ + u.bsCount[a]) % 4);
			else if (O === 32) _++;
			else break;
			r++;
		}
		const m = r;
		let E;
		m >= c ? (E = 1) : (E = _ - A), E > 4 && (E = 1);
		const z = A + E;
		(o = u.push("list_item_open", "li", 1)),
			(o.markup = String.fromCharCode(d));
		const M = [a, 0];
		(o.map = M), f && (o.info = u.src.slice(i, h - 1));
		const pu = u.tight,
			_u = u.tShift[a],
			nu = u.sCount[a],
			wu = u.listIndent;
		if (
			((u.listIndent = u.blkIndent),
			(u.blkIndent = z),
			(u.tight = !0),
			(u.tShift[a] = m - u.bMarks[a]),
			(u.sCount[a] = _),
			m >= c && u.isEmpty(a + 1)
				? (u.line = Math.min(u.line + 2, t))
				: u.md.block.tokenize(u, a, t, !0),
			(!u.tight || w) && (s = !1),
			(w = u.line - a > 1 && u.isEmpty(u.line - 1)),
			(u.blkIndent = u.listIndent),
			(u.listIndent = wu),
			(u.tShift[a] = _u),
			(u.sCount[a] = nu),
			(u.tight = pu),
			(o = u.push("list_item_close", "li", -1)),
			(o.markup = String.fromCharCode(d)),
			(a = u.line),
			(M[1] = a),
			a >= t ||
				u.sCount[a] < u.blkIndent ||
				u.sCount[a] - u.blkIndent >= 4)
		)
			break;
		let N = !1;
		for (let O = 0, vu = v.length; O < vu; O++)
			if (v[O](u, a, t, !0)) {
				N = !0;
				break;
			}
		if (N) break;
		if (f) {
			if (((h = o0(u, a)), h < 0)) break;
			i = u.bMarks[a] + u.tShift[a];
		} else if (((h = c0(u, a)), h < 0)) break;
		if (d !== u.src.charCodeAt(h - 1)) break;
	}
	return (
		f
			? (o = u.push("ordered_list_close", "ol", -1))
			: (o = u.push("bullet_list_close", "ul", -1)),
		(o.markup = String.fromCharCode(d)),
		(g[1] = a),
		(u.line = a),
		(u.parentType = x),
		s && yt(u, y),
		!0
	);
}
function Dt(u, e, t, n) {
	let c = 0,
		r = u.bMarks[e] + u.tShift[e],
		i = u.eMarks[e],
		o = e + 1;
	if (u.sCount[e] - u.blkIndent >= 4 || u.src.charCodeAt(r) !== 91) return !1;
	for (; ++r < i; )
		if (u.src.charCodeAt(r) === 93 && u.src.charCodeAt(r - 1) !== 92) {
			if (r + 1 === i || u.src.charCodeAt(r + 1) !== 58) return !1;
			break;
		}
	const a = u.lineMax,
		s = u.md.block.ruler.getRules("reference"),
		l = u.parentType;
	for (u.parentType = "reference"; o < a && !u.isEmpty(o); o++) {
		if (u.sCount[o] - u.blkIndent > 3 || u.sCount[o] < 0) continue;
		let _ = !1;
		for (let m = 0, E = s.length; m < E; m++)
			if (s[m](u, o, a, !0)) {
				_ = !0;
				break;
			}
		if (_) break;
	}
	const f = u.getLines(e, o, u.blkIndent, !1).trim();
	i = f.length;
	let p = -1;
	for (r = 1; r < i; r++) {
		const _ = f.charCodeAt(r);
		if (_ === 91) return !1;
		if (_ === 93) {
			p = r;
			break;
		} else
			_ === 10
				? c++
				: _ === 92 && (r++, r < i && f.charCodeAt(r) === 10 && c++);
	}
	if (p < 0 || f.charCodeAt(p + 1) !== 58) return !1;
	for (r = p + 2; r < i; r++) {
		const _ = f.charCodeAt(r);
		if (_ === 10) c++;
		else if (!S(_)) break;
	}
	const h = u.md.helpers.parseLinkDestination(f, r, i);
	if (!h.ok) return !1;
	const d = u.md.normalizeLink(h.str);
	if (!u.md.validateLink(d)) return !1;
	(r = h.pos), (c += h.lines);
	const y = r,
		g = c,
		w = r;
	for (; r < i; r++) {
		const _ = f.charCodeAt(r);
		if (_ === 10) c++;
		else if (!S(_)) break;
	}
	const v = u.md.helpers.parseLinkTitle(f, r, i);
	let x;
	for (
		r < i && w !== r && v.ok
			? ((x = v.str), (r = v.pos), (c += v.lines))
			: ((x = ""), (r = y), (c = g));
		r < i;

	) {
		const _ = f.charCodeAt(r);
		if (!S(_)) break;
		r++;
	}
	if (r < i && f.charCodeAt(r) !== 10 && x)
		for (x = "", r = y, c = g; r < i; ) {
			const _ = f.charCodeAt(r);
			if (!S(_)) break;
			r++;
		}
	if (r < i && f.charCodeAt(r) !== 10) return !1;
	const A = Au(f.slice(1, p));
	return A
		? (n ||
				(typeof u.env.references == "undefined" &&
					(u.env.references = {}),
				typeof u.env.references[A] == "undefined" &&
					(u.env.references[A] = { title: x, href: d }),
				(u.parentType = l),
				(u.line = e + c + 1)),
		  !0)
		: !1;
}
const At = [
		"address",
		"article",
		"aside",
		"base",
		"basefont",
		"blockquote",
		"body",
		"caption",
		"center",
		"col",
		"colgroup",
		"dd",
		"details",
		"dialog",
		"dir",
		"div",
		"dl",
		"dt",
		"fieldset",
		"figcaption",
		"figure",
		"footer",
		"form",
		"frame",
		"frameset",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"head",
		"header",
		"hr",
		"html",
		"iframe",
		"legend",
		"li",
		"link",
		"main",
		"menu",
		"menuitem",
		"nav",
		"noframes",
		"ol",
		"optgroup",
		"option",
		"p",
		"param",
		"section",
		"source",
		"summary",
		"table",
		"tbody",
		"td",
		"tfoot",
		"th",
		"thead",
		"title",
		"tr",
		"track",
		"ul",
	],
	Et = "[a-zA-Z_:][a-zA-Z0-9:._-]*",
	Ft = "[^\"'=<>`\\x00-\\x20]+",
	wt = "'[^']*'",
	vt = '"[^"]*"',
	St = "(?:" + Ft + "|" + wt + "|" + vt + ")",
	zt = "(?:\\s+" + Et + "(?:\\s*=\\s*" + St + ")?)",
	D0 = "<[A-Za-z][A-Za-z0-9\\-]*" + zt + "*\\s*\\/?>",
	A0 = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>",
	qt = "<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->",
	Tt = "<[?][\\s\\S]*?[?]>",
	Bt = "<![A-Z]+\\s+[^>]*>",
	It = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>",
	Mt = new RegExp(
		"^(?:" + D0 + "|" + A0 + "|" + qt + "|" + Tt + "|" + Bt + "|" + It + ")"
	),
	Nt = new RegExp("^(?:" + D0 + "|" + A0 + ")"),
	uu = [
		[
			/^<(script|pre|style|textarea)(?=(\s|>|$))/i,
			/<\/(script|pre|style|textarea)>/i,
			!0,
		],
		[/^<!--/, /-->/, !0],
		[/^<\?/, /\?>/, !0],
		[/^<![A-Z]/, />/, !0],
		[/^<!\[CDATA\[/, /\]\]>/, !0],
		[
			new RegExp("^</?(" + At.join("|") + ")(?=(\\s|/?>|$))", "i"),
			/^$/,
			!0,
		],
		[new RegExp(Nt.source + "\\s*$"), /^$/, !1],
	];
function Lt(u, e, t, n) {
	let c = u.bMarks[e] + u.tShift[e],
		r = u.eMarks[e];
	if (
		u.sCount[e] - u.blkIndent >= 4 ||
		!u.md.options.html ||
		u.src.charCodeAt(c) !== 60
	)
		return !1;
	let i = u.src.slice(c, r),
		o = 0;
	for (; o < uu.length && !uu[o][0].test(i); o++);
	if (o === uu.length) return !1;
	if (n) return uu[o][2];
	let a = e + 1;
	if (!uu[o][1].test(i)) {
		for (; a < t && !(u.sCount[a] < u.blkIndent); a++)
			if (
				((c = u.bMarks[a] + u.tShift[a]),
				(r = u.eMarks[a]),
				(i = u.src.slice(c, r)),
				uu[o][1].test(i))
			) {
				i.length !== 0 && a++;
				break;
			}
	}
	u.line = a;
	const s = u.push("html_block", "", 0);
	return (
		(s.map = [e, a]), (s.content = u.getLines(e, a, u.blkIndent, !0)), !0
	);
}
function Rt(u, e, t, n) {
	let c = u.bMarks[e] + u.tShift[e],
		r = u.eMarks[e];
	if (u.sCount[e] - u.blkIndent >= 4) return !1;
	let i = u.src.charCodeAt(c);
	if (i !== 35 || c >= r) return !1;
	let o = 1;
	for (i = u.src.charCodeAt(++c); i === 35 && c < r && o <= 6; )
		o++, (i = u.src.charCodeAt(++c));
	if (o > 6 || (c < r && !S(i))) return !1;
	if (n) return !0;
	r = u.skipSpacesBack(r, c);
	const a = u.skipCharsBack(r, 35, c);
	a > c && S(u.src.charCodeAt(a - 1)) && (r = a), (u.line = e + 1);
	const s = u.push("heading_open", "h" + String(o), 1);
	(s.markup = "########".slice(0, o)), (s.map = [e, u.line]);
	const l = u.push("inline", "", 0);
	(l.content = u.src.slice(c, r).trim()),
		(l.map = [e, u.line]),
		(l.children = []);
	const f = u.push("heading_close", "h" + String(o), -1);
	return (f.markup = "########".slice(0, o)), !0;
}
function Pt(u, e, t) {
	const n = u.md.block.ruler.getRules("paragraph");
	if (u.sCount[e] - u.blkIndent >= 4) return !1;
	const c = u.parentType;
	u.parentType = "paragraph";
	let r = 0,
		i,
		o = e + 1;
	for (; o < t && !u.isEmpty(o); o++) {
		if (u.sCount[o] - u.blkIndent > 3) continue;
		if (u.sCount[o] >= u.blkIndent) {
			let h = u.bMarks[o] + u.tShift[o];
			const d = u.eMarks[o];
			if (
				h < d &&
				((i = u.src.charCodeAt(h)),
				(i === 45 || i === 61) &&
					((h = u.skipChars(h, i)), (h = u.skipSpaces(h)), h >= d))
			) {
				r = i === 61 ? 1 : 2;
				break;
			}
		}
		if (u.sCount[o] < 0) continue;
		let p = !1;
		for (let h = 0, d = n.length; h < d; h++)
			if (n[h](u, o, t, !0)) {
				p = !0;
				break;
			}
		if (p) break;
	}
	if (!r) return !1;
	const a = u.getLines(e, o, u.blkIndent, !1).trim();
	u.line = o + 1;
	const s = u.push("heading_open", "h" + String(r), 1);
	(s.markup = String.fromCharCode(i)), (s.map = [e, u.line]);
	const l = u.push("inline", "", 0);
	(l.content = a), (l.map = [e, u.line - 1]), (l.children = []);
	const f = u.push("heading_close", "h" + String(r), -1);
	return (f.markup = String.fromCharCode(i)), (u.parentType = c), !0;
}
function $t(u, e, t) {
	const n = u.md.block.ruler.getRules("paragraph"),
		c = u.parentType;
	let r = e + 1;
	for (u.parentType = "paragraph"; r < t && !u.isEmpty(r); r++) {
		if (u.sCount[r] - u.blkIndent > 3 || u.sCount[r] < 0) continue;
		let s = !1;
		for (let l = 0, f = n.length; l < f; l++)
			if (n[l](u, r, t, !0)) {
				s = !0;
				break;
			}
		if (s) break;
	}
	const i = u.getLines(e, r, u.blkIndent, !1).trim();
	u.line = r;
	const o = u.push("paragraph_open", "p", 1);
	o.map = [e, u.line];
	const a = u.push("inline", "", 0);
	return (
		(a.content = i),
		(a.map = [e, u.line]),
		(a.children = []),
		u.push("paragraph_close", "p", -1),
		(u.parentType = c),
		!0
	);
}
const xu = [
	["table", _t, ["paragraph", "reference"]],
	["code", mt],
	["fence", xt, ["paragraph", "reference", "blockquote", "list"]],
	["blockquote", kt, ["paragraph", "reference", "blockquote", "list"]],
	["hr", gt, ["paragraph", "reference", "blockquote", "list"]],
	["list", Ct, ["paragraph", "reference", "blockquote"]],
	["reference", Dt],
	["html_block", Lt, ["paragraph", "reference", "blockquote"]],
	["heading", Rt, ["paragraph", "reference", "blockquote"]],
	["lheading", Pt],
	["paragraph", $t],
];
function Eu() {
	this.ruler = new L();
	for (let u = 0; u < xu.length; u++)
		this.ruler.push(xu[u][0], xu[u][1], { alt: (xu[u][2] || []).slice() });
}
Eu.prototype.tokenize = function (u, e, t) {
	const n = this.ruler.getRules(""),
		c = n.length,
		r = u.md.options.maxNesting;
	let i = e,
		o = !1;
	for (
		;
		i < t &&
		((u.line = i = u.skipEmptyLines(i)),
		!(i >= t || u.sCount[i] < u.blkIndent));

	) {
		if (u.level >= r) {
			u.line = t;
			break;
		}
		const a = u.line;
		let s = !1;
		for (let l = 0; l < c; l++)
			if (((s = n[l](u, i, t, !1)), s)) {
				if (a >= u.line)
					throw new Error("block rule didn't increment state.line");
				break;
			}
		if (!s) throw new Error("none of the block rules matched");
		(u.tight = !o),
			u.isEmpty(u.line - 1) && (o = !0),
			(i = u.line),
			i < t && u.isEmpty(i) && ((o = !0), i++, (u.line = i));
	}
};
Eu.prototype.parse = function (u, e, t, n) {
	if (!u) return;
	const c = new this.State(u, e, t, n);
	this.tokenize(c, c.line, c.lineMax);
};
Eu.prototype.State = Q;
function hu(u, e, t, n) {
	(this.src = u),
		(this.env = t),
		(this.md = e),
		(this.tokens = n),
		(this.tokens_meta = Array(n.length)),
		(this.pos = 0),
		(this.posMax = this.src.length),
		(this.level = 0),
		(this.pending = ""),
		(this.pendingLevel = 0),
		(this.cache = {}),
		(this.delimiters = []),
		(this._prev_delimiters = []),
		(this.backticks = {}),
		(this.backticksScanned = !1),
		(this.linkLevel = 0);
}
hu.prototype.pushPending = function () {
	const u = new j("text", "", 0);
	return (
		(u.content = this.pending),
		(u.level = this.pendingLevel),
		this.tokens.push(u),
		(this.pending = ""),
		u
	);
};
hu.prototype.push = function (u, e, t) {
	this.pending && this.pushPending();
	const n = new j(u, e, t);
	let c = null;
	return (
		t < 0 &&
			(this.level--, (this.delimiters = this._prev_delimiters.pop())),
		(n.level = this.level),
		t > 0 &&
			(this.level++,
			this._prev_delimiters.push(this.delimiters),
			(this.delimiters = []),
			(c = { delimiters: this.delimiters })),
		(this.pendingLevel = this.level),
		this.tokens.push(n),
		this.tokens_meta.push(c),
		n
	);
};
hu.prototype.scanDelims = function (u, e) {
	let t,
		n,
		c = !0,
		r = !0;
	const i = this.posMax,
		o = this.src.charCodeAt(u),
		a = u > 0 ? this.src.charCodeAt(u - 1) : 32;
	let s = u;
	for (; s < i && this.src.charCodeAt(s) === o; ) s++;
	const l = s - u,
		f = s < i ? this.src.charCodeAt(s) : 32,
		p = lu(a) || su(String.fromCharCode(a)),
		h = lu(f) || su(String.fromCharCode(f)),
		d = au(a),
		y = au(f);
	return (
		y ? (c = !1) : h && (d || p || (c = !1)),
		d ? (r = !1) : p && (y || h || (r = !1)),
		e ? ((t = c), (n = r)) : ((t = c && (!r || p)), (n = r && (!c || h))),
		{ can_open: t, can_close: n, length: l }
	);
};
hu.prototype.Token = j;
function Ot(u) {
	switch (u) {
		case 10:
		case 33:
		case 35:
		case 36:
		case 37:
		case 38:
		case 42:
		case 43:
		case 45:
		case 58:
		case 60:
		case 61:
		case 62:
		case 64:
		case 91:
		case 92:
		case 93:
		case 94:
		case 95:
		case 96:
		case 123:
		case 125:
		case 126:
			return !0;
		default:
			return !1;
	}
}
function jt(u, e) {
	let t = u.pos;
	for (; t < u.posMax && !Ot(u.src.charCodeAt(t)); ) t++;
	return t === u.pos
		? !1
		: (e || (u.pending += u.src.slice(u.pos, t)), (u.pos = t), !0);
}
const Ut = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i;
function Zt(u, e) {
	if (!u.md.options.linkify || u.linkLevel > 0) return !1;
	const t = u.pos,
		n = u.posMax;
	if (
		t + 3 > n ||
		u.src.charCodeAt(t) !== 58 ||
		u.src.charCodeAt(t + 1) !== 47 ||
		u.src.charCodeAt(t + 2) !== 47
	)
		return !1;
	const c = u.pending.match(Ut);
	if (!c) return !1;
	const r = c[1],
		i = u.md.linkify.matchAtStart(u.src.slice(t - r.length));
	if (!i) return !1;
	let o = i.url;
	if (o.length <= r.length) return !1;
	o = o.replace(/\*+$/, "");
	const a = u.md.normalizeLink(o);
	if (!u.md.validateLink(a)) return !1;
	if (!e) {
		u.pending = u.pending.slice(0, -r.length);
		const s = u.push("link_open", "a", 1);
		(s.attrs = [["href", a]]), (s.markup = "linkify"), (s.info = "auto");
		const l = u.push("text", "", 0);
		l.content = u.md.normalizeLinkText(o);
		const f = u.push("link_close", "a", -1);
		(f.markup = "linkify"), (f.info = "auto");
	}
	return (u.pos += o.length - r.length), !0;
}
function Ht(u, e) {
	let t = u.pos;
	if (u.src.charCodeAt(t) !== 10) return !1;
	const n = u.pending.length - 1,
		c = u.posMax;
	if (!e)
		if (n >= 0 && u.pending.charCodeAt(n) === 32)
			if (n >= 1 && u.pending.charCodeAt(n - 1) === 32) {
				let r = n - 1;
				for (; r >= 1 && u.pending.charCodeAt(r - 1) === 32; ) r--;
				(u.pending = u.pending.slice(0, r)),
					u.push("hardbreak", "br", 0);
			} else
				(u.pending = u.pending.slice(0, -1)),
					u.push("softbreak", "br", 0);
		else u.push("softbreak", "br", 0);
	for (t++; t < c && S(u.src.charCodeAt(t)); ) t++;
	return (u.pos = t), !0;
}
const Zu = [];
for (let u = 0; u < 256; u++) Zu.push(0);
"\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function (u) {
	Zu[u.charCodeAt(0)] = 1;
});
function Vt(u, e) {
	let t = u.pos;
	const n = u.posMax;
	if (u.src.charCodeAt(t) !== 92 || (t++, t >= n)) return !1;
	let c = u.src.charCodeAt(t);
	if (c === 10) {
		for (
			e || u.push("hardbreak", "br", 0), t++;
			t < n && ((c = u.src.charCodeAt(t)), !!S(c));

		)
			t++;
		return (u.pos = t), !0;
	}
	let r = u.src[t];
	if (c >= 55296 && c <= 56319 && t + 1 < n) {
		const o = u.src.charCodeAt(t + 1);
		o >= 56320 && o <= 57343 && ((r += u.src[t + 1]), t++);
	}
	const i = "\\" + r;
	if (!e) {
		const o = u.push("text_special", "", 0);
		c < 256 && Zu[c] !== 0 ? (o.content = r) : (o.content = i),
			(o.markup = i),
			(o.info = "escape");
	}
	return (u.pos = t + 1), !0;
}
function Gt(u, e) {
	let t = u.pos;
	if (u.src.charCodeAt(t) !== 96) return !1;
	const c = t;
	t++;
	const r = u.posMax;
	for (; t < r && u.src.charCodeAt(t) === 96; ) t++;
	const i = u.src.slice(c, t),
		o = i.length;
	if (u.backticksScanned && (u.backticks[o] || 0) <= c)
		return e || (u.pending += i), (u.pos += o), !0;
	let a = t,
		s;
	for (; (s = u.src.indexOf("`", a)) !== -1; ) {
		for (a = s + 1; a < r && u.src.charCodeAt(a) === 96; ) a++;
		const l = a - s;
		if (l === o) {
			if (!e) {
				const f = u.push("code_inline", "code", 0);
				(f.markup = i),
					(f.content = u.src
						.slice(t, s)
						.replace(/\n/g, " ")
						.replace(/^ (.+) $/, "$1"));
			}
			return (u.pos = a), !0;
		}
		u.backticks[l] = s;
	}
	return (u.backticksScanned = !0), e || (u.pending += i), (u.pos += o), !0;
}
function Qt(u, e) {
	const t = u.pos,
		n = u.src.charCodeAt(t);
	if (e || n !== 126) return !1;
	const c = u.scanDelims(u.pos, !0);
	let r = c.length;
	const i = String.fromCharCode(n);
	if (r < 2) return !1;
	let o;
	r % 2 && ((o = u.push("text", "", 0)), (o.content = i), r--);
	for (let a = 0; a < r; a += 2)
		(o = u.push("text", "", 0)),
			(o.content = i + i),
			u.delimiters.push({
				marker: n,
				length: 0,
				token: u.tokens.length - 1,
				end: -1,
				open: c.can_open,
				close: c.can_close,
			});
	return (u.pos += c.length), !0;
}
function i0(u, e) {
	let t;
	const n = [],
		c = e.length;
	for (let r = 0; r < c; r++) {
		const i = e[r];
		if (i.marker !== 126 || i.end === -1) continue;
		const o = e[i.end];
		(t = u.tokens[i.token]),
			(t.type = "s_open"),
			(t.tag = "s"),
			(t.nesting = 1),
			(t.markup = "~~"),
			(t.content = ""),
			(t = u.tokens[o.token]),
			(t.type = "s_close"),
			(t.tag = "s"),
			(t.nesting = -1),
			(t.markup = "~~"),
			(t.content = ""),
			u.tokens[o.token - 1].type === "text" &&
				u.tokens[o.token - 1].content === "~" &&
				n.push(o.token - 1);
	}
	for (; n.length; ) {
		const r = n.pop();
		let i = r + 1;
		for (; i < u.tokens.length && u.tokens[i].type === "s_close"; ) i++;
		i--,
			r !== i &&
				((t = u.tokens[i]),
				(u.tokens[i] = u.tokens[r]),
				(u.tokens[r] = t));
	}
}
function Wt(u) {
	const e = u.tokens_meta,
		t = u.tokens_meta.length;
	i0(u, u.delimiters);
	for (let n = 0; n < t; n++)
		e[n] && e[n].delimiters && i0(u, e[n].delimiters);
}
const E0 = { tokenize: Qt, postProcess: Wt };
function Jt(u, e) {
	const t = u.pos,
		n = u.src.charCodeAt(t);
	if (e || (n !== 95 && n !== 42)) return !1;
	const c = u.scanDelims(u.pos, n === 42);
	for (let r = 0; r < c.length; r++) {
		const i = u.push("text", "", 0);
		(i.content = String.fromCharCode(n)),
			u.delimiters.push({
				marker: n,
				length: c.length,
				token: u.tokens.length - 1,
				end: -1,
				open: c.can_open,
				close: c.can_close,
			});
	}
	return (u.pos += c.length), !0;
}
function a0(u, e) {
	const t = e.length;
	for (let n = t - 1; n >= 0; n--) {
		const c = e[n];
		if ((c.marker !== 95 && c.marker !== 42) || c.end === -1) continue;
		const r = e[c.end],
			i =
				n > 0 &&
				e[n - 1].end === c.end + 1 &&
				e[n - 1].marker === c.marker &&
				e[n - 1].token === c.token - 1 &&
				e[c.end + 1].token === r.token + 1,
			o = String.fromCharCode(c.marker),
			a = u.tokens[c.token];
		(a.type = i ? "strong_open" : "em_open"),
			(a.tag = i ? "strong" : "em"),
			(a.nesting = 1),
			(a.markup = i ? o + o : o),
			(a.content = "");
		const s = u.tokens[r.token];
		(s.type = i ? "strong_close" : "em_close"),
			(s.tag = i ? "strong" : "em"),
			(s.nesting = -1),
			(s.markup = i ? o + o : o),
			(s.content = ""),
			i &&
				((u.tokens[e[n - 1].token].content = ""),
				(u.tokens[e[c.end + 1].token].content = ""),
				n--);
	}
}
function Yt(u) {
	const e = u.tokens_meta,
		t = u.tokens_meta.length;
	a0(u, u.delimiters);
	for (let n = 0; n < t; n++)
		e[n] && e[n].delimiters && a0(u, e[n].delimiters);
}
const F0 = { tokenize: Jt, postProcess: Yt };
function Xt(u, e) {
	let t,
		n,
		c,
		r,
		i = "",
		o = "",
		a = u.pos,
		s = !0;
	if (u.src.charCodeAt(u.pos) !== 91) return !1;
	const l = u.pos,
		f = u.posMax,
		p = u.pos + 1,
		h = u.md.helpers.parseLinkLabel(u, u.pos, !0);
	if (h < 0) return !1;
	let d = h + 1;
	if (d < f && u.src.charCodeAt(d) === 40) {
		for (
			s = !1, d++;
			d < f && ((t = u.src.charCodeAt(d)), !(!S(t) && t !== 10));
			d++
		);
		if (d >= f) return !1;
		if (
			((a = d),
			(c = u.md.helpers.parseLinkDestination(u.src, d, u.posMax)),
			c.ok)
		) {
			for (
				i = u.md.normalizeLink(c.str),
					u.md.validateLink(i) ? (d = c.pos) : (i = ""),
					a = d;
				d < f && ((t = u.src.charCodeAt(d)), !(!S(t) && t !== 10));
				d++
			);
			if (
				((c = u.md.helpers.parseLinkTitle(u.src, d, u.posMax)),
				d < f && a !== d && c.ok)
			)
				for (
					o = c.str, d = c.pos;
					d < f && ((t = u.src.charCodeAt(d)), !(!S(t) && t !== 10));
					d++
				);
		}
		(d >= f || u.src.charCodeAt(d) !== 41) && (s = !0), d++;
	}
	if (s) {
		if (typeof u.env.references == "undefined") return !1;
		if (
			(d < f && u.src.charCodeAt(d) === 91
				? ((a = d + 1),
				  (d = u.md.helpers.parseLinkLabel(u, d)),
				  d >= 0 ? (n = u.src.slice(a, d++)) : (d = h + 1))
				: (d = h + 1),
			n || (n = u.src.slice(p, h)),
			(r = u.env.references[Au(n)]),
			!r)
		)
			return (u.pos = l), !1;
		(i = r.href), (o = r.title);
	}
	if (!e) {
		(u.pos = p), (u.posMax = h);
		const y = u.push("link_open", "a", 1),
			g = [["href", i]];
		(y.attrs = g),
			o && g.push(["title", o]),
			u.linkLevel++,
			u.md.inline.tokenize(u),
			u.linkLevel--,
			u.push("link_close", "a", -1);
	}
	return (u.pos = d), (u.posMax = f), !0;
}
function Kt(u, e) {
	let t,
		n,
		c,
		r,
		i,
		o,
		a,
		s,
		l = "";
	const f = u.pos,
		p = u.posMax;
	if (u.src.charCodeAt(u.pos) !== 33 || u.src.charCodeAt(u.pos + 1) !== 91)
		return !1;
	const h = u.pos + 2,
		d = u.md.helpers.parseLinkLabel(u, u.pos + 1, !1);
	if (d < 0) return !1;
	if (((r = d + 1), r < p && u.src.charCodeAt(r) === 40)) {
		for (
			r++;
			r < p && ((t = u.src.charCodeAt(r)), !(!S(t) && t !== 10));
			r++
		);
		if (r >= p) return !1;
		for (
			s = r,
				o = u.md.helpers.parseLinkDestination(u.src, r, u.posMax),
				o.ok &&
					((l = u.md.normalizeLink(o.str)),
					u.md.validateLink(l) ? (r = o.pos) : (l = "")),
				s = r;
			r < p && ((t = u.src.charCodeAt(r)), !(!S(t) && t !== 10));
			r++
		);
		if (
			((o = u.md.helpers.parseLinkTitle(u.src, r, u.posMax)),
			r < p && s !== r && o.ok)
		)
			for (
				a = o.str, r = o.pos;
				r < p && ((t = u.src.charCodeAt(r)), !(!S(t) && t !== 10));
				r++
			);
		else a = "";
		if (r >= p || u.src.charCodeAt(r) !== 41) return (u.pos = f), !1;
		r++;
	} else {
		if (typeof u.env.references == "undefined") return !1;
		if (
			(r < p && u.src.charCodeAt(r) === 91
				? ((s = r + 1),
				  (r = u.md.helpers.parseLinkLabel(u, r)),
				  r >= 0 ? (c = u.src.slice(s, r++)) : (r = d + 1))
				: (r = d + 1),
			c || (c = u.src.slice(h, d)),
			(i = u.env.references[Au(c)]),
			!i)
		)
			return (u.pos = f), !1;
		(l = i.href), (a = i.title);
	}
	if (!e) {
		n = u.src.slice(h, d);
		const y = [];
		u.md.inline.parse(n, u.md, u.env, y);
		const g = u.push("image", "img", 0),
			w = [
				["src", l],
				["alt", ""],
			];
		(g.attrs = w),
			(g.children = y),
			(g.content = n),
			a && w.push(["title", a]);
	}
	return (u.pos = r), (u.posMax = p), !0;
}
const ur =
		/^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/,
	er = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;
function tr(u, e) {
	let t = u.pos;
	if (u.src.charCodeAt(t) !== 60) return !1;
	const n = u.pos,
		c = u.posMax;
	for (;;) {
		if (++t >= c) return !1;
		const i = u.src.charCodeAt(t);
		if (i === 60) return !1;
		if (i === 62) break;
	}
	const r = u.src.slice(n + 1, t);
	if (er.test(r)) {
		const i = u.md.normalizeLink(r);
		if (!u.md.validateLink(i)) return !1;
		if (!e) {
			const o = u.push("link_open", "a", 1);
			(o.attrs = [["href", i]]),
				(o.markup = "autolink"),
				(o.info = "auto");
			const a = u.push("text", "", 0);
			a.content = u.md.normalizeLinkText(r);
			const s = u.push("link_close", "a", -1);
			(s.markup = "autolink"), (s.info = "auto");
		}
		return (u.pos += r.length + 2), !0;
	}
	if (ur.test(r)) {
		const i = u.md.normalizeLink("mailto:" + r);
		if (!u.md.validateLink(i)) return !1;
		if (!e) {
			const o = u.push("link_open", "a", 1);
			(o.attrs = [["href", i]]),
				(o.markup = "autolink"),
				(o.info = "auto");
			const a = u.push("text", "", 0);
			a.content = u.md.normalizeLinkText(r);
			const s = u.push("link_close", "a", -1);
			(s.markup = "autolink"), (s.info = "auto");
		}
		return (u.pos += r.length + 2), !0;
	}
	return !1;
}
function rr(u) {
	return /^<a[>\s]/i.test(u);
}
function nr(u) {
	return /^<\/a\s*>/i.test(u);
}
function cr(u) {
	const e = u | 32;
	return e >= 97 && e <= 122;
}
function or(u, e) {
	if (!u.md.options.html) return !1;
	const t = u.posMax,
		n = u.pos;
	if (u.src.charCodeAt(n) !== 60 || n + 2 >= t) return !1;
	const c = u.src.charCodeAt(n + 1);
	if (c !== 33 && c !== 63 && c !== 47 && !cr(c)) return !1;
	const r = u.src.slice(n).match(Mt);
	if (!r) return !1;
	if (!e) {
		const i = u.push("html_inline", "", 0);
		(i.content = r[0]),
			rr(i.content) && u.linkLevel++,
			nr(i.content) && u.linkLevel--;
	}
	return (u.pos += r[0].length), !0;
}
const ir = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i,
	ar = /^&([a-z][a-z0-9]{1,31});/i;
function sr(u, e) {
	const t = u.pos,
		n = u.posMax;
	if (u.src.charCodeAt(t) !== 38 || t + 1 >= n) return !1;
	if (u.src.charCodeAt(t + 1) === 35) {
		const r = u.src.slice(t).match(ir);
		if (r) {
			if (!e) {
				const i =
						r[1][0].toLowerCase() === "x"
							? parseInt(r[1].slice(1), 16)
							: parseInt(r[1], 10),
					o = u.push("text_special", "", 0);
				(o.content = ju(i) ? gu(i) : gu(65533)),
					(o.markup = r[0]),
					(o.info = "entity");
			}
			return (u.pos += r[0].length), !0;
		}
	} else {
		const r = u.src.slice(t).match(ar);
		if (r) {
			const i = x0(r[0]);
			if (i !== r[0]) {
				if (!e) {
					const o = u.push("text_special", "", 0);
					(o.content = i), (o.markup = r[0]), (o.info = "entity");
				}
				return (u.pos += r[0].length), !0;
			}
		}
	}
	return !1;
}
function s0(u) {
	const e = {},
		t = u.length;
	if (!t) return;
	let n = 0,
		c = -2;
	const r = [];
	for (let i = 0; i < t; i++) {
		const o = u[i];
		if (
			(r.push(0),
			(u[n].marker !== o.marker || c !== o.token - 1) && (n = i),
			(c = o.token),
			(o.length = o.length || 0),
			!o.close)
		)
			continue;
		e.hasOwnProperty(o.marker) || (e[o.marker] = [-1, -1, -1, -1, -1, -1]);
		const a = e[o.marker][(o.open ? 3 : 0) + (o.length % 3)];
		let s = n - r[n] - 1,
			l = s;
		for (; s > a; s -= r[s] + 1) {
			const f = u[s];
			if (f.marker === o.marker && f.open && f.end < 0) {
				let p = !1;
				if (
					((f.close || o.open) &&
						(f.length + o.length) % 3 === 0 &&
						(f.length % 3 !== 0 || o.length % 3 !== 0) &&
						(p = !0),
					!p)
				) {
					const h = s > 0 && !u[s - 1].open ? r[s - 1] + 1 : 0;
					(r[i] = i - s + h),
						(r[s] = h),
						(o.open = !1),
						(f.end = i),
						(f.close = !1),
						(l = -1),
						(c = -2);
					break;
				}
			}
		}
		l !== -1 && (e[o.marker][(o.open ? 3 : 0) + ((o.length || 0) % 3)] = l);
	}
}
function lr(u) {
	const e = u.tokens_meta,
		t = u.tokens_meta.length;
	s0(u.delimiters);
	for (let n = 0; n < t; n++) e[n] && e[n].delimiters && s0(e[n].delimiters);
}
function fr(u) {
	let e,
		t,
		n = 0;
	const c = u.tokens,
		r = u.tokens.length;
	for (e = t = 0; e < r; e++)
		c[e].nesting < 0 && n--,
			(c[e].level = n),
			c[e].nesting > 0 && n++,
			c[e].type === "text" && e + 1 < r && c[e + 1].type === "text"
				? (c[e + 1].content = c[e].content + c[e + 1].content)
				: (e !== t && (c[t] = c[e]), t++);
	e !== t && (c.length = t);
}
const Tu = [
		["text", jt],
		["linkify", Zt],
		["newline", Ht],
		["escape", Vt],
		["backticks", Gt],
		["strikethrough", E0.tokenize],
		["emphasis", F0.tokenize],
		["link", Xt],
		["image", Kt],
		["autolink", tr],
		["html_inline", or],
		["entity", sr],
	],
	Bu = [
		["balance_pairs", lr],
		["strikethrough", E0.postProcess],
		["emphasis", F0.postProcess],
		["fragments_join", fr],
	];
function bu() {
	this.ruler = new L();
	for (let u = 0; u < Tu.length; u++) this.ruler.push(Tu[u][0], Tu[u][1]);
	this.ruler2 = new L();
	for (let u = 0; u < Bu.length; u++) this.ruler2.push(Bu[u][0], Bu[u][1]);
}
bu.prototype.skipToken = function (u) {
	const e = u.pos,
		t = this.ruler.getRules(""),
		n = t.length,
		c = u.md.options.maxNesting,
		r = u.cache;
	if (typeof r[e] != "undefined") {
		u.pos = r[e];
		return;
	}
	let i = !1;
	if (u.level < c) {
		for (let o = 0; o < n; o++)
			if ((u.level++, (i = t[o](u, !0)), u.level--, i)) {
				if (e >= u.pos)
					throw new Error("inline rule didn't increment state.pos");
				break;
			}
	} else u.pos = u.posMax;
	i || u.pos++, (r[e] = u.pos);
};
bu.prototype.tokenize = function (u) {
	const e = this.ruler.getRules(""),
		t = e.length,
		n = u.posMax,
		c = u.md.options.maxNesting;
	for (; u.pos < n; ) {
		const r = u.pos;
		let i = !1;
		if (u.level < c) {
			for (let o = 0; o < t; o++)
				if (((i = e[o](u, !1)), i)) {
					if (r >= u.pos)
						throw new Error(
							"inline rule didn't increment state.pos"
						);
					break;
				}
		}
		if (i) {
			if (u.pos >= n) break;
			continue;
		}
		u.pending += u.src[u.pos++];
	}
	u.pending && u.pushPending();
};
bu.prototype.parse = function (u, e, t, n) {
	const c = new this.State(u, e, t, n);
	this.tokenize(c);
	const r = this.ruler2.getRules(""),
		i = r.length;
	for (let o = 0; o < i; o++) r[o](c);
};
bu.prototype.State = hu;
const dr =
		/[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/,
	hr = /[\0-\x1F\x7F-\x9F]/,
	br =
		/[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDEAD\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/,
	pr = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/;
function _r(u) {
	const e = {};
	(u = u || {}),
		(e.src_Any = dr.source),
		(e.src_Cc = hr.source),
		(e.src_Z = pr.source),
		(e.src_P = br.source),
		(e.src_ZPCc = [e.src_Z, e.src_P, e.src_Cc].join("|")),
		(e.src_ZCc = [e.src_Z, e.src_Cc].join("|"));
	const t = "[><\uFF5C]";
	return (
		(e.src_pseudo_letter =
			"(?:(?!" + t + "|" + e.src_ZPCc + ")" + e.src_Any + ")"),
		(e.src_ip4 =
			"(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)"),
		(e.src_auth = "(?:(?:(?!" + e.src_ZCc + "|[@/\\[\\]()]).)+@)?"),
		(e.src_port =
			"(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?"),
		(e.src_host_terminator =
			"(?=$|" +
			t +
			"|" +
			e.src_ZPCc +
			")(?!" +
			(u["---"] ? "-(?!--)|" : "-|") +
			"_|:\\d|\\.-|\\.(?!$|" +
			e.src_ZPCc +
			"))"),
		(e.src_path =
			"(?:[/?#](?:(?!" +
			e.src_ZCc +
			"|" +
			t +
			`|[()[\\]{}.,"'?!\\-;]).|\\[(?:(?!` +
			e.src_ZCc +
			"|\\]).)*\\]|\\((?:(?!" +
			e.src_ZCc +
			"|[)]).)*\\)|\\{(?:(?!" +
			e.src_ZCc +
			'|[}]).)*\\}|\\"(?:(?!' +
			e.src_ZCc +
			`|["]).)+\\"|\\'(?:(?!` +
			e.src_ZCc +
			"|[']).)+\\'|\\'(?=" +
			e.src_pseudo_letter +
			"|[-])|\\.{2,}[a-zA-Z0-9%/&]|\\.(?!" +
			e.src_ZCc +
			"|[.]|$)|" +
			(u["---"] ? "\\-(?!--(?:[^-]|$))(?:-*)|" : "\\-+|") +
			",(?!" +
			e.src_ZCc +
			"|$)|;(?!" +
			e.src_ZCc +
			"|$)|\\!+(?!" +
			e.src_ZCc +
			"|[!]|$)|\\?(?!" +
			e.src_ZCc +
			"|[?]|$))+|\\/)?"),
		(e.src_email_name =
			'[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]*'),
		(e.src_xn = "xn--[a-z0-9\\-]{1,59}"),
		(e.src_domain_root =
			"(?:" + e.src_xn + "|" + e.src_pseudo_letter + "{1,63})"),
		(e.src_domain =
			"(?:" +
			e.src_xn +
			"|(?:" +
			e.src_pseudo_letter +
			")|(?:" +
			e.src_pseudo_letter +
			"(?:-|" +
			e.src_pseudo_letter +
			"){0,61}" +
			e.src_pseudo_letter +
			"))"),
		(e.src_host =
			"(?:(?:(?:(?:" + e.src_domain + ")\\.)*" + e.src_domain + "))"),
		(e.tpl_host_fuzzy =
			"(?:" +
			e.src_ip4 +
			"|(?:(?:(?:" +
			e.src_domain +
			")\\.)+(?:%TLDS%)))"),
		(e.tpl_host_no_ip_fuzzy =
			"(?:(?:(?:" + e.src_domain + ")\\.)+(?:%TLDS%))"),
		(e.src_host_strict = e.src_host + e.src_host_terminator),
		(e.tpl_host_fuzzy_strict = e.tpl_host_fuzzy + e.src_host_terminator),
		(e.src_host_port_strict =
			e.src_host + e.src_port + e.src_host_terminator),
		(e.tpl_host_port_fuzzy_strict =
			e.tpl_host_fuzzy + e.src_port + e.src_host_terminator),
		(e.tpl_host_port_no_ip_fuzzy_strict =
			e.tpl_host_no_ip_fuzzy + e.src_port + e.src_host_terminator),
		(e.tpl_host_fuzzy_test =
			"localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:" +
			e.src_ZPCc +
			"|>|$))"),
		(e.tpl_email_fuzzy =
			"(^|" +
			t +
			'|"|\\(|' +
			e.src_ZCc +
			")(" +
			e.src_email_name +
			"@" +
			e.tpl_host_fuzzy_strict +
			")"),
		(e.tpl_link_fuzzy =
			"(^|(?![.:/\\-_@])(?:[$+<=>^`|\uFF5C]|" +
			e.src_ZPCc +
			"))((?![$+<=>^`|\uFF5C])" +
			e.tpl_host_port_fuzzy_strict +
			e.src_path +
			")"),
		(e.tpl_link_no_ip_fuzzy =
			"(^|(?![.:/\\-_@])(?:[$+<=>^`|\uFF5C]|" +
			e.src_ZPCc +
			"))((?![$+<=>^`|\uFF5C])" +
			e.tpl_host_port_no_ip_fuzzy_strict +
			e.src_path +
			")"),
		e
	);
}
function Lu(u) {
	return (
		Array.prototype.slice.call(arguments, 1).forEach(function (t) {
			!t ||
				Object.keys(t).forEach(function (n) {
					u[n] = t[n];
				});
		}),
		u
	);
}
function Fu(u) {
	return Object.prototype.toString.call(u);
}
function mr(u) {
	return Fu(u) === "[object String]";
}
function xr(u) {
	return Fu(u) === "[object Object]";
}
function kr(u) {
	return Fu(u) === "[object RegExp]";
}
function l0(u) {
	return Fu(u) === "[object Function]";
}
function gr(u) {
	return u.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}
const w0 = { fuzzyLink: !0, fuzzyEmail: !0, fuzzyIP: !1 };
function yr(u) {
	return Object.keys(u || {}).reduce(function (e, t) {
		return e || w0.hasOwnProperty(t);
	}, !1);
}
const Cr = {
		"http:": {
			validate: function (u, e, t) {
				const n = u.slice(e);
				return (
					t.re.http ||
						(t.re.http = new RegExp(
							"^\\/\\/" +
								t.re.src_auth +
								t.re.src_host_port_strict +
								t.re.src_path,
							"i"
						)),
					t.re.http.test(n) ? n.match(t.re.http)[0].length : 0
				);
			},
		},
		"https:": "http:",
		"ftp:": "http:",
		"//": {
			validate: function (u, e, t) {
				const n = u.slice(e);
				return (
					t.re.no_http ||
						(t.re.no_http = new RegExp(
							"^" +
								t.re.src_auth +
								"(?:localhost|(?:(?:" +
								t.re.src_domain +
								")\\.)+" +
								t.re.src_domain_root +
								")" +
								t.re.src_port +
								t.re.src_host_terminator +
								t.re.src_path,
							"i"
						)),
					t.re.no_http.test(n)
						? (e >= 3 && u[e - 3] === ":") ||
						  (e >= 3 && u[e - 3] === "/")
							? 0
							: n.match(t.re.no_http)[0].length
						: 0
				);
			},
		},
		"mailto:": {
			validate: function (u, e, t) {
				const n = u.slice(e);
				return (
					t.re.mailto ||
						(t.re.mailto = new RegExp(
							"^" +
								t.re.src_email_name +
								"@" +
								t.re.src_host_strict,
							"i"
						)),
					t.re.mailto.test(n) ? n.match(t.re.mailto)[0].length : 0
				);
			},
		},
	},
	Dr =
		"a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]",
	Ar =
		"biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|\u0440\u0444".split(
			"|"
		);
function Er(u) {
	(u.__index__ = -1), (u.__text_cache__ = "");
}
function Fr(u) {
	return function (e, t) {
		const n = e.slice(t);
		return u.test(n) ? n.match(u)[0].length : 0;
	};
}
function f0() {
	return function (u, e) {
		e.normalize(u);
	};
}
function yu(u) {
	const e = (u.re = _r(u.__opts__)),
		t = u.__tlds__.slice();
	u.onCompile(),
		u.__tlds_replaced__ || t.push(Dr),
		t.push(e.src_xn),
		(e.src_tlds = t.join("|"));
	function n(o) {
		return o.replace("%TLDS%", e.src_tlds);
	}
	(e.email_fuzzy = RegExp(n(e.tpl_email_fuzzy), "i")),
		(e.link_fuzzy = RegExp(n(e.tpl_link_fuzzy), "i")),
		(e.link_no_ip_fuzzy = RegExp(n(e.tpl_link_no_ip_fuzzy), "i")),
		(e.host_fuzzy_test = RegExp(n(e.tpl_host_fuzzy_test), "i"));
	const c = [];
	u.__compiled__ = {};
	function r(o, a) {
		throw new Error('(LinkifyIt) Invalid schema "' + o + '": ' + a);
	}
	Object.keys(u.__schemas__).forEach(function (o) {
		const a = u.__schemas__[o];
		if (a === null) return;
		const s = { validate: null, link: null };
		if (((u.__compiled__[o] = s), xr(a))) {
			kr(a.validate)
				? (s.validate = Fr(a.validate))
				: l0(a.validate)
				? (s.validate = a.validate)
				: r(o, a),
				l0(a.normalize)
					? (s.normalize = a.normalize)
					: a.normalize
					? r(o, a)
					: (s.normalize = f0());
			return;
		}
		if (mr(a)) {
			c.push(o);
			return;
		}
		r(o, a);
	}),
		c.forEach(function (o) {
			!u.__compiled__[u.__schemas__[o]] ||
				((u.__compiled__[o].validate =
					u.__compiled__[u.__schemas__[o]].validate),
				(u.__compiled__[o].normalize =
					u.__compiled__[u.__schemas__[o]].normalize));
		}),
		(u.__compiled__[""] = { validate: null, normalize: f0() });
	const i = Object.keys(u.__compiled__)
		.filter(function (o) {
			return o.length > 0 && u.__compiled__[o];
		})
		.map(gr)
		.join("|");
	(u.re.schema_test = RegExp(
		"(^|(?!_)(?:[><\uFF5C]|" + e.src_ZPCc + "))(" + i + ")",
		"i"
	)),
		(u.re.schema_search = RegExp(
			"(^|(?!_)(?:[><\uFF5C]|" + e.src_ZPCc + "))(" + i + ")",
			"ig"
		)),
		(u.re.schema_at_start = RegExp("^" + u.re.schema_search.source, "i")),
		(u.re.pretest = RegExp(
			"(" +
				u.re.schema_test.source +
				")|(" +
				u.re.host_fuzzy_test.source +
				")|@",
			"i"
		)),
		Er(u);
}
function wr(u, e) {
	const t = u.__index__,
		n = u.__last_index__,
		c = u.__text_cache__.slice(t, n);
	(this.schema = u.__schema__.toLowerCase()),
		(this.index = t + e),
		(this.lastIndex = n + e),
		(this.raw = c),
		(this.text = c),
		(this.url = c);
}
function Ru(u, e) {
	const t = new wr(u, e);
	return u.__compiled__[t.schema].normalize(t, u), t;
}
function P(u, e) {
	if (!(this instanceof P)) return new P(u, e);
	e || (yr(u) && ((e = u), (u = {}))),
		(this.__opts__ = Lu({}, w0, e)),
		(this.__index__ = -1),
		(this.__last_index__ = -1),
		(this.__schema__ = ""),
		(this.__text_cache__ = ""),
		(this.__schemas__ = Lu({}, Cr, u)),
		(this.__compiled__ = {}),
		(this.__tlds__ = Ar),
		(this.__tlds_replaced__ = !1),
		(this.re = {}),
		yu(this);
}
P.prototype.add = function (e, t) {
	return (this.__schemas__[e] = t), yu(this), this;
};
P.prototype.set = function (e) {
	return (this.__opts__ = Lu(this.__opts__, e)), this;
};
P.prototype.test = function (e) {
	if (((this.__text_cache__ = e), (this.__index__ = -1), !e.length))
		return !1;
	let t, n, c, r, i, o, a, s, l;
	if (this.re.schema_test.test(e)) {
		for (
			a = this.re.schema_search, a.lastIndex = 0;
			(t = a.exec(e)) !== null;

		)
			if (((r = this.testSchemaAt(e, t[2], a.lastIndex)), r)) {
				(this.__schema__ = t[2]),
					(this.__index__ = t.index + t[1].length),
					(this.__last_index__ = t.index + t[0].length + r);
				break;
			}
	}
	return (
		this.__opts__.fuzzyLink &&
			this.__compiled__["http:"] &&
			((s = e.search(this.re.host_fuzzy_test)),
			s >= 0 &&
				(this.__index__ < 0 || s < this.__index__) &&
				(n = e.match(
					this.__opts__.fuzzyIP
						? this.re.link_fuzzy
						: this.re.link_no_ip_fuzzy
				)) !== null &&
				((i = n.index + n[1].length),
				(this.__index__ < 0 || i < this.__index__) &&
					((this.__schema__ = ""),
					(this.__index__ = i),
					(this.__last_index__ = n.index + n[0].length)))),
		this.__opts__.fuzzyEmail &&
			this.__compiled__["mailto:"] &&
			((l = e.indexOf("@")),
			l >= 0 &&
				(c = e.match(this.re.email_fuzzy)) !== null &&
				((i = c.index + c[1].length),
				(o = c.index + c[0].length),
				(this.__index__ < 0 ||
					i < this.__index__ ||
					(i === this.__index__ && o > this.__last_index__)) &&
					((this.__schema__ = "mailto:"),
					(this.__index__ = i),
					(this.__last_index__ = o)))),
		this.__index__ >= 0
	);
};
P.prototype.pretest = function (e) {
	return this.re.pretest.test(e);
};
P.prototype.testSchemaAt = function (e, t, n) {
	return this.__compiled__[t.toLowerCase()]
		? this.__compiled__[t.toLowerCase()].validate(e, n, this)
		: 0;
};
P.prototype.match = function (e) {
	const t = [];
	let n = 0;
	this.__index__ >= 0 &&
		this.__text_cache__ === e &&
		(t.push(Ru(this, n)), (n = this.__last_index__));
	let c = n ? e.slice(n) : e;
	for (; this.test(c); )
		t.push(Ru(this, n)),
			(c = c.slice(this.__last_index__)),
			(n += this.__last_index__);
	return t.length ? t : null;
};
P.prototype.matchAtStart = function (e) {
	if (((this.__text_cache__ = e), (this.__index__ = -1), !e.length))
		return null;
	const t = this.re.schema_at_start.exec(e);
	if (!t) return null;
	const n = this.testSchemaAt(e, t[2], t[0].length);
	return n
		? ((this.__schema__ = t[2]),
		  (this.__index__ = t.index + t[1].length),
		  (this.__last_index__ = t.index + t[0].length + n),
		  Ru(this, 0))
		: null;
};
P.prototype.tlds = function (e, t) {
	return (
		(e = Array.isArray(e) ? e : [e]),
		t
			? ((this.__tlds__ = this.__tlds__
					.concat(e)
					.sort()
					.filter(function (n, c, r) {
						return n !== r[c - 1];
					})
					.reverse()),
			  yu(this),
			  this)
			: ((this.__tlds__ = e.slice()),
			  (this.__tlds_replaced__ = !0),
			  yu(this),
			  this)
	);
};
P.prototype.normalize = function (e) {
	e.schema || (e.url = "http://" + e.url),
		e.schema === "mailto:" &&
			!/^mailto:/i.test(e.url) &&
			(e.url = "mailto:" + e.url);
};
P.prototype.onCompile = function () {};
const eu = 2147483647,
	H = 36,
	Hu = 1,
	fu = 26,
	vr = 38,
	Sr = 700,
	v0 = 72,
	S0 = 128,
	z0 = "-",
	zr = /^xn--/,
	qr = /[^\0-\x7F]/,
	Tr = /[\x2E\u3002\uFF0E\uFF61]/g,
	Br = {
		overflow: "Overflow: input needs wider integers to process",
		"not-basic": "Illegal input >= 0x80 (not a basic code point)",
		"invalid-input": "Invalid input",
	},
	Iu = H - Hu,
	V = Math.floor,
	Mu = String.fromCharCode;
function W(u) {
	throw new RangeError(Br[u]);
}
function Ir(u, e) {
	const t = [];
	let n = u.length;
	for (; n--; ) t[n] = e(u[n]);
	return t;
}
function q0(u, e) {
	const t = u.split("@");
	let n = "";
	t.length > 1 && ((n = t[0] + "@"), (u = t[1])), (u = u.replace(Tr, "."));
	const c = u.split("."),
		r = Ir(c, e).join(".");
	return n + r;
}
function T0(u) {
	const e = [];
	let t = 0;
	const n = u.length;
	for (; t < n; ) {
		const c = u.charCodeAt(t++);
		if (c >= 55296 && c <= 56319 && t < n) {
			const r = u.charCodeAt(t++);
			(r & 64512) == 56320
				? e.push(((c & 1023) << 10) + (r & 1023) + 65536)
				: (e.push(c), t--);
		} else e.push(c);
	}
	return e;
}
const Mr = (u) => String.fromCodePoint(...u),
	Nr = function (u) {
		return u >= 48 && u < 58
			? 26 + (u - 48)
			: u >= 65 && u < 91
			? u - 65
			: u >= 97 && u < 123
			? u - 97
			: H;
	},
	d0 = function (u, e) {
		return u + 22 + 75 * (u < 26) - ((e != 0) << 5);
	},
	B0 = function (u, e, t) {
		let n = 0;
		for (
			u = t ? V(u / Sr) : u >> 1, u += V(u / e);
			u > (Iu * fu) >> 1;
			n += H
		)
			u = V(u / Iu);
		return V(n + ((Iu + 1) * u) / (u + vr));
	},
	I0 = function (u) {
		const e = [],
			t = u.length;
		let n = 0,
			c = S0,
			r = v0,
			i = u.lastIndexOf(z0);
		i < 0 && (i = 0);
		for (let o = 0; o < i; ++o)
			u.charCodeAt(o) >= 128 && W("not-basic"), e.push(u.charCodeAt(o));
		for (let o = i > 0 ? i + 1 : 0; o < t; ) {
			const a = n;
			for (let l = 1, f = H; ; f += H) {
				o >= t && W("invalid-input");
				const p = Nr(u.charCodeAt(o++));
				p >= H && W("invalid-input"),
					p > V((eu - n) / l) && W("overflow"),
					(n += p * l);
				const h = f <= r ? Hu : f >= r + fu ? fu : f - r;
				if (p < h) break;
				const d = H - h;
				l > V(eu / d) && W("overflow"), (l *= d);
			}
			const s = e.length + 1;
			(r = B0(n - a, s, a == 0)),
				V(n / s) > eu - c && W("overflow"),
				(c += V(n / s)),
				(n %= s),
				e.splice(n++, 0, c);
		}
		return String.fromCodePoint(...e);
	},
	M0 = function (u) {
		const e = [];
		u = T0(u);
		const t = u.length;
		let n = S0,
			c = 0,
			r = v0;
		for (const a of u) a < 128 && e.push(Mu(a));
		const i = e.length;
		let o = i;
		for (i && e.push(z0); o < t; ) {
			let a = eu;
			for (const l of u) l >= n && l < a && (a = l);
			const s = o + 1;
			a - n > V((eu - c) / s) && W("overflow"),
				(c += (a - n) * s),
				(n = a);
			for (const l of u)
				if ((l < n && ++c > eu && W("overflow"), l === n)) {
					let f = c;
					for (let p = H; ; p += H) {
						const h = p <= r ? Hu : p >= r + fu ? fu : p - r;
						if (f < h) break;
						const d = f - h,
							y = H - h;
						e.push(Mu(d0(h + (d % y), 0))), (f = V(d / y));
					}
					e.push(Mu(d0(f, 0))), (r = B0(c, s, o === i)), (c = 0), ++o;
				}
			++c, ++n;
		}
		return e.join("");
	},
	Lr = function (u) {
		return q0(u, function (e) {
			return zr.test(e) ? I0(e.slice(4).toLowerCase()) : e;
		});
	},
	Rr = function (u) {
		return q0(u, function (e) {
			return qr.test(e) ? "xn--" + M0(e) : e;
		});
	},
	N0 = {
		version: "2.3.1",
		ucs2: { decode: T0, encode: Mr },
		decode: I0,
		encode: M0,
		toASCII: Rr,
		toUnicode: Lr,
	},
	Pr = {
		options: {
			html: !1,
			xhtmlOut: !1,
			breaks: !1,
			langPrefix: "language-",
			linkify: !1,
			typographer: !1,
			quotes: "\u201C\u201D\u2018\u2019",
			highlight: null,
			maxNesting: 100,
		},
		components: { core: {}, block: {}, inline: {} },
	},
	$r = {
		options: {
			html: !1,
			xhtmlOut: !1,
			breaks: !1,
			langPrefix: "language-",
			linkify: !1,
			typographer: !1,
			quotes: "\u201C\u201D\u2018\u2019",
			highlight: null,
			maxNesting: 20,
		},
		components: {
			core: { rules: ["normalize", "block", "inline", "text_join"] },
			block: { rules: ["paragraph"] },
			inline: {
				rules: ["text"],
				rules2: ["balance_pairs", "fragments_join"],
			},
		},
	},
	Or = {
		options: {
			html: !0,
			xhtmlOut: !0,
			breaks: !1,
			langPrefix: "language-",
			linkify: !1,
			typographer: !1,
			quotes: "\u201C\u201D\u2018\u2019",
			highlight: null,
			maxNesting: 20,
		},
		components: {
			core: { rules: ["normalize", "block", "inline", "text_join"] },
			block: {
				rules: [
					"blockquote",
					"code",
					"fence",
					"heading",
					"hr",
					"html_block",
					"lheading",
					"list",
					"reference",
					"paragraph",
				],
			},
			inline: {
				rules: [
					"autolink",
					"backticks",
					"emphasis",
					"entity",
					"escape",
					"html_inline",
					"image",
					"link",
					"newline",
					"text",
				],
				rules2: ["balance_pairs", "emphasis", "fragments_join"],
			},
		},
	},
	jr = { default: Pr, zero: $r, commonmark: Or },
	Ur = /^(vbscript|javascript|file|data):/,
	Zr = /^data:image\/(gif|png|jpeg|webp);/;
function Hr(u) {
	const e = u.trim().toLowerCase();
	return Ur.test(e) ? Zr.test(e) : !0;
}
const L0 = ["http:", "https:", "mailto:"];
function Vr(u) {
	const e = $u(u, !0);
	if (e.hostname && (!e.protocol || L0.indexOf(e.protocol) >= 0))
		try {
			e.hostname = N0.toASCII(e.hostname);
		} catch (t) {}
	return du(Pu(e));
}
function Gr(u) {
	const e = $u(u, !0);
	if (e.hostname && (!e.protocol || L0.indexOf(e.protocol) >= 0))
		try {
			e.hostname = N0.toUnicode(e.hostname);
		} catch (t) {}
	return tu(Pu(e), tu.defaultChars + "%");
}
function $(u, e) {
	if (!(this instanceof $)) return new $(u, e);
	e || Ou(u) || ((e = u || {}), (u = "default")),
		(this.inline = new bu()),
		(this.block = new Eu()),
		(this.core = new Uu()),
		(this.renderer = new ru()),
		(this.linkify = new P()),
		(this.validateLink = Hr),
		(this.normalizeLink = Vr),
		(this.normalizeLinkText = Gr),
		(this.utils = Ve),
		(this.helpers = Du({}, Je)),
		(this.options = {}),
		this.configure(u),
		e && this.set(e);
}
$.prototype.set = function (u) {
	return Du(this.options, u), this;
};
$.prototype.configure = function (u) {
	const e = this;
	if (Ou(u)) {
		const t = u;
		if (((u = jr[t]), !u))
			throw new Error(
				'Wrong `markdown-it` preset "' + t + '", check name'
			);
	}
	if (!u) throw new Error("Wrong `markdown-it` preset, can't be empty");
	return (
		u.options && e.set(u.options),
		u.components &&
			Object.keys(u.components).forEach(function (t) {
				u.components[t].rules &&
					e[t].ruler.enableOnly(u.components[t].rules),
					u.components[t].rules2 &&
						e[t].ruler2.enableOnly(u.components[t].rules2);
			}),
		this
	);
};
$.prototype.enable = function (u, e) {
	let t = [];
	Array.isArray(u) || (u = [u]),
		["core", "block", "inline"].forEach(function (c) {
			t = t.concat(this[c].ruler.enable(u, !0));
		}, this),
		(t = t.concat(this.inline.ruler2.enable(u, !0)));
	const n = u.filter(function (c) {
		return t.indexOf(c) < 0;
	});
	if (n.length && !e)
		throw new Error("MarkdownIt. Failed to enable unknown rule(s): " + n);
	return this;
};
$.prototype.disable = function (u, e) {
	let t = [];
	Array.isArray(u) || (u = [u]),
		["core", "block", "inline"].forEach(function (c) {
			t = t.concat(this[c].ruler.disable(u, !0));
		}, this),
		(t = t.concat(this.inline.ruler2.disable(u, !0)));
	const n = u.filter(function (c) {
		return t.indexOf(c) < 0;
	});
	if (n.length && !e)
		throw new Error("MarkdownIt. Failed to disable unknown rule(s): " + n);
	return this;
};
$.prototype.use = function (u) {
	const e = [this].concat(Array.prototype.slice.call(arguments, 1));
	return u.apply(u, e), this;
};
$.prototype.parse = function (u, e) {
	if (typeof u != "string") throw new Error("Input data should be a String");
	const t = new this.core.State(u, this, e);
	return this.core.process(t), t.tokens;
};
$.prototype.render = function (u, e) {
	return (
		(e = e || {}), this.renderer.render(this.parse(u, e), this.options, e)
	);
};
$.prototype.parseInline = function (u, e) {
	const t = new this.core.State(u, this, e);
	return (t.inlineMode = !0), this.core.process(t), t.tokens;
};
$.prototype.renderInline = function (u, e) {
	return (
		(e = e || {}),
		this.renderer.render(this.parseInline(u, e), this.options, e)
	);
};
const Qr = { key: 0 },
	Wr = {
		class: "bg-blue-100 py-2 px-2 mb-4 rounded-md text-sm text-blue-800",
	},
	Jr = { class: "leading-relaxed" },
	Yr = { key: 0, class: "leading-relaxed" },
	Xr = { key: 1, class: "leading-relaxed" },
	Kr = { key: 2, class: "leading-relaxed" },
	un = { key: 0 },
	en = { class: "border text-center p-20 rounded-md" },
	tn = { class: "font-semibold text-lg" },
	rn = { key: 1 },
	nn = { key: 1 },
	cn = { key: 0, class: "border rounded-md p-5" },
	on = { class: "flex justify-between" },
	an = { class: "text-sm" },
	sn = { class: "mr-2" },
	ln = { class: "text-gray-900 text-sm font-semibold item-left" },
	fn = { class: "text-gray-900 font-semibold mt-2" },
	dn = {
		key: 0,
		class: "flex items-center bg-gray-200 rounded-md p-3 mt-4 w-full cursor-pointer focus:border-blue-600",
	},
	hn = ["name", "onChange"],
	bn = ["name", "onChange"],
	pn = { key: 0 },
	_n = { class: "ml-2" },
	mn = { key: 1, class: "mt-2 text-sm hidden" },
	xn = { class: "flex items-center justify-between mt-8" },
	kn = { key: 2, class: "border rounded-md p-20 text-center" },
	gn = { class: "text-lg font-semibold" },
	yn = { key: 3, class: "mt-10" },
	h0 = {
		__name: "Quiz",
		props: { quizName: { type: String, required: !0 } },
		setup(u) {
			const e = b0("$user"),
				t = Vu(0),
				n = Vu(""),
				c = Gu([0, 0, 0, 0]),
				r = Gu([]),
				i = u,
				o = R0({
					doctype: "LMS Quiz",
					name: i.quizName,
					cache: ["quiz", i.quizName],
					auto: !0,
				}),
				a = K({
					url: "frappe.client.get_list",
					makeParams(m) {
						var E, z;
						return {
							doctype: "LMS Quiz Submission",
							filters: {
								member: (E = e.data) == null ? void 0 : E.name,
								quiz: (z = o.doc) == null ? void 0 : z.name,
							},
							fields: [
								"name",
								"creation",
								"score",
								"score_out_of",
								"percentage",
								"passing_percentage",
							],
							order_by: "creation desc",
						};
					},
					auto: !0,
					transform(m) {
						m.forEach((E, z) => {
							(E.creation = X0(E.creation)), (E.idx = z + 1);
						});
					},
				}),
				s = K({
					url: "lms.lms.doctype.lms_quiz.lms_quiz.quiz_summary",
					makeParams(m) {
						return {
							quiz: o.doc.name,
							results: localStorage.getItem(o.doc.title),
						};
					},
				}),
				l = K({
					url: "lms.lms.utils.get_question_details",
					makeParams(m) {
						return { question: n.value };
					},
				});
			p0(t, (m) => {
				m > 0 &&
					((n.value = o.doc.questions[m - 1].question), l.reload());
			});
			const f = () => {
					(t.value = 1), localStorage.removeItem(o.doc.title);
				},
				p = (m) => {
					l.data.multiple || c.splice(0, c.length, 0, 0, 0, 0),
						(c[m - 1] = c[m - 1] ? 0 : 1);
				},
				h = () => {
					let m = [];
					return (
						c.forEach((E, z) => {
							c[z] && m.push(l.data[`option_${z + 1}`]);
						}),
						m
					);
				},
				d = () => {
					let m = h();
					if (!m.length) {
						K0({
							title: "Please select an option",
							icon: "alert-circle",
							iconClasses: "text-yellow-600 bg-yellow-100",
						});
						return;
					}
					K({
						url: "lms.lms.doctype.lms_quiz.lms_quiz.check_answer",
						params: {
							question: n.value,
							type: l.data.type,
							answers: JSON.stringify(m),
						},
						auto: !0,
						onSuccess(E) {
							c.forEach((z, M) => {
								z
									? (r[M] = z && E[M])
									: l.data[`is_correct_${M + 1}`]
									? (r[M] = 0)
									: (r[M] = void 0);
							}),
								y(),
								o.doc.show_answers || w();
						},
					});
				},
				y = () => {
					let m = JSON.parse(localStorage.getItem(o.doc.title)),
						E = {
							question_index: t.value,
							answers: h().join(),
							is_correct: r.filter((z) => z != null),
						};
					m ? m.push(E) : (m = [E]),
						localStorage.setItem(o.doc.title, JSON.stringify(m));
				},
				g = () => {
					o.doc.show_answers ? w() : d();
				},
				w = () => {
					t.value != o.doc.questions.length &&
						((t.value = t.value + 1),
						c.splice(0, c.length, 0, 0, 0, 0),
						(r.length = 0));
				},
				v = () => {
					if (!o.doc.show_answers) {
						d(),
							setTimeout(() => {
								x();
							}, 500);
						return;
					}
					x();
				},
				x = () => {
					s.reload().then(() => {
						a.reload();
					});
				},
				A = () => {
					(t.value = 0),
						c.splice(0, c.length, 0, 0, 0, 0),
						(r.length = 0),
						s.reset();
				},
				_ = () => [
					{ label: "No.", key: "idx" },
					{ label: "Date", key: "creation" },
					{ label: "Score", key: "score", align: "center" },
					{
						label: "Score out of",
						key: "score_out_of",
						align: "center",
					},
					{ label: "Percentage", key: "percentage", align: "center" },
				];
			return (m, E) => {
				var z, M, pu, _u;
				return b(o).doc
					? (k(),
					  D("div", Qr, [
							C("div", Wr, [
								C(
									"div",
									Jr,
									F(
										m
											.__(
												"This quiz consists of {0} questions."
											)
											.format(b(o).doc.questions.length)
									),
									1
								),
								b(o).doc.passing_percentage
									? (k(),
									  D(
											"div",
											Yr,
											F(
												m
													.__(
														"You will have to get {0}% correct answers in order to pass the quiz."
													)
													.format(
														b(o).doc
															.passing_percentage
													)
											),
											1
									  ))
									: q("", !0),
								b(o).doc.max_attempts
									? (k(),
									  D(
											"div",
											Xr,
											F(
												m
													.__(
														"You can attempt this quiz {0}."
													)
													.format(
														b(o).doc.max_attempts ==
															1
															? "1 time"
															: `${
																	b(o).doc
																		.max_attempts
															  } times`
													)
											),
											1
									  ))
									: q("", !0),
								b(o).doc.time
									? (k(),
									  D(
											"div",
											Kr,
											F(
												m
													.__(
														"The quiz has a time limit.For each question you will be given { 0} seconds."
													)
													.format(b(o).doc.time)
											),
											1
									  ))
									: q("", !0),
							]),
							t.value == 0
								? (k(),
								  D("div", un, [
										C("div", en, [
											C("div", tn, F(b(o).doc.title), 1),
											!b(o).doc.max_attempts ||
											((z = b(a).data) == null
												? void 0
												: z.length) <
												b(o).doc.max_attempts
												? (k(),
												  I(
														b(Z),
														{
															key: 0,
															onClick: f,
															class: "mt-2",
														},
														{
															default: R(() => [
																C(
																	"span",
																	null,
																	F(
																		m.__(
																			"Start"
																		)
																	),
																	1
																),
															]),
															_: 1,
														}
												  ))
												: (k(),
												  D(
														"div",
														rn,
														F(
															m.__(
																"You have already exceeded the maximum number of attempts allowed for this quiz."
															)
														),
														1
												  )),
										]),
								  ]))
								: b(s).data
								? (k(),
								  D("div", kn, [
										C(
											"div",
											gn,
											F(m.__("Quiz Summary")),
											1
										),
										C(
											"div",
											null,
											F(
												m
													.__(
														"You got {0}% correct answers with a score of {1} out of {2}"
													)
													.format(
														Math.ceil(
															b(s).data.percentage
														),
														b(s).data.score,
														b(s).data.score_out_of
													)
											),
											1
										),
										!b(o).doc.max_attempts ||
										((M = b(a)) == null
											? void 0
											: M.data.length) <
											b(o).doc.max_attempts
											? (k(),
											  I(
													b(Z),
													{
														key: 0,
														onClick:
															E[3] ||
															(E[3] = (nu) =>
																A()),
														class: "mt-2",
													},
													{
														default: R(() => [
															C(
																"span",
																null,
																F(
																	m.__(
																		"Try Again"
																	)
																),
																1
															),
														]),
														_: 1,
													}
											  ))
											: q("", !0),
								  ]))
								: (k(),
								  D("div", nn, [
										(k(!0),
										D(
											cu,
											null,
											ou(
												b(o).doc.questions,
												(nu, wu) => (
													k(),
													D("div", null, [
														wu == t.value - 1 &&
														b(l).data
															? (k(),
															  D("div", cn, [
																	C(
																		"div",
																		on,
																		[
																			C(
																				"div",
																				an,
																				[
																					C(
																						"span",
																						sn,
																						F(
																							m
																								.__(
																									"Question {0}"
																								)
																								.format(
																									t.value
																								)
																						) +
																							": ",
																						1
																					),
																					C(
																						"span",
																						null,
																						F(
																							b(
																								l
																							)
																								.data
																								.multiple
																								? m.__(
																										"Choose all answers that apply"
																								  )
																								: m.__(
																										"Choose one answer"
																								  )
																						),
																						1
																					),
																				]
																			),
																			C(
																				"div",
																				ln,
																				F(
																					nu.marks
																				) +
																					" " +
																					F(
																						nu.marks ==
																							1
																							? m.__(
																									"Mark"
																							  )
																							: m.__(
																									"Marks"
																							  )
																					),
																				1
																			),
																		]
																	),
																	C(
																		"div",
																		fn,
																		F(
																			b(l)
																				.data
																				.question
																		),
																		1
																	),
																	b(l).data
																		.type ==
																	"Choices"
																		? (k(),
																		  D(
																				cu,
																				{
																					key: 0,
																				},
																				ou(
																					4,
																					(
																						N
																					) =>
																						C(
																							"div",
																							null,
																							[
																								b(
																									l
																								)
																									.data[
																									`option_${N}`
																								]
																									? (k(),
																									  D(
																											"label",
																											dn,
																											[
																												!r.length &&
																												!b(
																													l
																												)
																													.data
																													.multiple
																													? (k(),
																													  D(
																															"input",
																															{
																																key: 0,
																																type: "radio",
																																name: encodeURIComponent(
																																	b(
																																		l
																																	)
																																		.data
																																		.question
																																),
																																class: "w-3.5 h-3.5 text-gray-900 focus:ring-gray-200",
																																onChange:
																																	(
																																		O
																																	) =>
																																		p(
																																			N
																																		),
																															},
																															null,
																															40,
																															hn
																													  ))
																													: !r.length &&
																													  b(
																															l
																													  )
																															.data
																															.multiple
																													? (k(),
																													  D(
																															"input",
																															{
																																key: 1,
																																type: "checkbox",
																																name: encodeURIComponent(
																																	b(
																																		l
																																	)
																																		.data
																																		.question
																																),
																																class: "w-3.5 h-3.5 text-gray-900 rounded-sm focus:ring-gray-200",
																																onChange:
																																	(
																																		O
																																	) =>
																																		p(
																																			N
																																		),
																															},
																															null,
																															40,
																															bn
																													  ))
																													: b(
																															o
																													  )
																															.doc
																															.show_answers
																													? (k(
																															!0
																													  ),
																													  D(
																															cu,
																															{
																																key: 2,
																															},
																															ou(
																																r,
																																(
																																	O,
																																	vu
																																) => (
																																	k(),
																																	D(
																																		"div",
																																		null,
																																		[
																																			N -
																																				1 ==
																																			vu
																																				? (k(),
																																				  D(
																																						"div",
																																						pn,
																																						[
																																							O
																																								? (k(),
																																								  I(
																																										b(
																																											ue
																																										),
																																										{
																																											key: 0,
																																											class: "w-4 h-4 text-green-500",
																																										}
																																								  ))
																																								: b(
																																										l
																																								  )
																																										.data[
																																										`is_correct_${N}`
																																								  ]
																																								? (k(),
																																								  I(
																																										b(
																																											Qu
																																										),
																																										{
																																											key: 1,
																																											class: "w-4 h-4 text-green-500",
																																										}
																																								  ))
																																								: O ==
																																								  0
																																								? (k(),
																																								  I(
																																										b(
																																											te
																																										),
																																										{
																																											key: 2,
																																											class: "w-4 h-4 text-red-500",
																																										}
																																								  ))
																																								: (k(),
																																								  I(
																																										b(
																																											Qu
																																										),
																																										{
																																											key: 3,
																																											class: "w-4 h-4",
																																										}
																																								  )),
																																						]
																																				  ))
																																				: q(
																																						"",
																																						!0
																																				  ),
																																		]
																																	)
																																)
																															),
																															256
																													  ))
																													: q(
																															"",
																															!0
																													  ),
																												C(
																													"span",
																													_n,
																													F(
																														b(
																															l
																														)
																															.data[
																															`option_${N}`
																														]
																													),
																													1
																												),
																											]
																									  ))
																									: q(
																											"",
																											!0
																									  ),
																								b(
																									l
																								)
																									.data[
																									`explanation_${N}`
																								]
																									? (k(),
																									  D(
																											"div",
																											mn,
																											F(
																												b(
																													l
																												)
																													.data[
																													`explanation_${N}`
																												]
																											),
																											1
																									  ))
																									: q(
																											"",
																											!0
																									  ),
																							]
																						)
																				),
																				64
																		  ))
																		: q(
																				"",
																				!0
																		  ),
																	C(
																		"div",
																		xn,
																		[
																			C(
																				"div",
																				null,
																				F(
																					m
																						.__(
																							"Question {0} of {1}"
																						)
																						.format(
																							t.value,
																							b(
																								o
																							)
																								.doc
																								.questions
																								.length
																						)
																				),
																				1
																			),
																			b(o)
																				.doc
																				.show_answers &&
																			!r.length
																				? (k(),
																				  I(
																						b(
																							Z
																						),
																						{
																							key: 0,
																							onClick:
																								E[0] ||
																								(E[0] =
																									(
																										N
																									) =>
																										d()),
																						},
																						{
																							default:
																								R(
																									() => [
																										C(
																											"span",
																											null,
																											F(
																												m.__(
																													"Check"
																												)
																											),
																											1
																										),
																									]
																								),
																							_: 1,
																						}
																				  ))
																				: t.value !=
																				  b(
																						o
																				  )
																						.doc
																						.questions
																						.length
																				? (k(),
																				  I(
																						b(
																							Z
																						),
																						{
																							key: 1,
																							onClick:
																								E[1] ||
																								(E[1] =
																									(
																										N
																									) =>
																										g()),
																						},
																						{
																							default:
																								R(
																									() => [
																										C(
																											"span",
																											null,
																											F(
																												m.__(
																													"Next"
																												)
																											),
																											1
																										),
																									]
																								),
																							_: 1,
																						}
																				  ))
																				: (k(),
																				  I(
																						b(
																							Z
																						),
																						{
																							key: 2,
																							onClick:
																								E[2] ||
																								(E[2] =
																									(
																										N
																									) =>
																										v()),
																						},
																						{
																							default:
																								R(
																									() => [
																										C(
																											"span",
																											null,
																											F(
																												m.__(
																													"Submit"
																												)
																											),
																											1
																										),
																									]
																								),
																							_: 1,
																						}
																				  )),
																		]
																	),
															  ]))
															: q("", !0),
													])
												)
											),
											256
										)),
								  ])),
							b(o).doc.show_submission_history &&
							((pu = b(a)) == null ? void 0 : pu.data)
								? (k(),
								  D("div", yn, [
										U(
											b(P0),
											{
												columns: _(),
												rows:
													(_u = b(a)) == null
														? void 0
														: _u.data,
												"row-key": "name",
												options: {
													selectable: !1,
													showTooltip: !1,
												},
											},
											null,
											8,
											["columns", "rows"]
										),
								  ]))
								: q("", !0),
					  ]))
					: q("", !0);
			};
		},
	};
const Cn = { key: 0, class: "h-screen text-base" },
	Dn = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	An = { class: "grid grid-cols-[70%,30%] h-full" },
	En = { key: 0, class: "border-r-2 text-center pt-10" },
	Fn = { class: "mb-4" },
	wn = { key: 1, class: "border-r-2 container pt-5 pb-10" },
	vn = { class: "flex items-center justify-between" },
	Sn = { class: "text-3xl font-semibold" },
	zn = { class: "flex items-center mt-2" },
	qn = { key: 0 },
	Tn = { key: 1 },
	Bn = { key: 2 },
	In = { class: "lesson-content mt-6" },
	Mn = { key: 0 },
	Nn = ["src"],
	Ln = { key: 0 },
	Rn = ["src"],
	Pn = { key: 1 },
	$n = { key: 1, class: "border rounded-md text-center py-20" },
	On = { key: 2 },
	jn = { controls: "", width: "100%", controlsList: "nodownload" },
	Un = ["src"],
	Zn = { key: 3 },
	Hn = ["src"],
	Vn = { key: 4 },
	Gn = { width: "100%", controls: "", controlsList: "nodownload" },
	Qn = ["src"],
	Wn = { key: 5 },
	Jn = ["src"],
	Yn = ["innerHTML"],
	Xn = { key: 1 },
	Kn = { key: 1, class: "border rounded-md text-center py-20" },
	uc = { class: "sticky top-10" },
	ec = { class: "bg-gray-50 p-5 border-b-2" },
	tc = { class: "text-lg font-semibold" },
	rc = { key: 0, class: "text-sm mt-3" },
	nc = { key: 1, class: "w-full bg-gray-200 rounded-full h-1 my-2" },
	lc = {
		__name: "Lesson",
		props: {
			courseName: { type: String, required: !0 },
			chapterNumber: { type: String, required: !0 },
			lessonNumber: { type: String, required: !0 },
		},
		setup(u) {
			const e = b0("$user"),
				t = $0(),
				n = new $({ html: !0, linkify: !0 }),
				c = u,
				r = K({
					url: "lms.lms.utils.get_lesson",
					cache: [
						"lesson",
						c.courseName,
						c.chapterNumber,
						c.lessonNumber,
					],
					makeParams(h) {
						return {
							course: c.courseName,
							chapter: h ? h.chapter : c.chapterNumber,
							lesson: h ? h.lesson : c.lessonNumber,
						};
					},
					auto: !0,
					onSuccess(h) {
						h.membership &&
							i.submit({
								name: h.membership.name,
								lesson_name: h.name,
							});
					},
				}),
				i = K({
					url: "frappe.client.set_value",
					makeParams(h) {
						return {
							doctype: "LMS Enrollment",
							name: h.name,
							fieldname: "current_lesson",
							value: h.lesson_name,
						};
					},
				}),
				o = K({
					url: "lms.lms.utils.get_course_details",
					cache: ["course", c.courseName],
					params: { course: c.courseName },
					auto: !0,
				}),
				a = O0(() => {
					var d, y;
					let h = [
						{ label: "All Courses", route: { name: "Courses" } },
					];
					return (
						h.push({
							label:
								(d = o == null ? void 0 : o.data) == null
									? void 0
									: d.title,
							route: {
								name: "CourseDetail",
								params: { course: c.courseName },
							},
						}),
						h.push({
							label:
								(y = r == null ? void 0 : r.data) == null
									? void 0
									: y.title,
							route: {
								name: "Lesson",
								params: {
									course: c.courseName,
									chapterNumber: c.chapterNumber,
									lessonNumber: c.lessonNumber,
								},
							},
						}),
						h
					);
				});
			j0(() => {
				localStorage.setItem("sidebar_is_collapsed", !0);
			}),
				U0(() => {
					localStorage.setItem("sidebar_is_collapsed", !1);
				}),
				p0(
					[() => t.params.chapterNumber, () => t.params.lessonNumber],
					([h, d], [y, g]) => {
						h && d && r.submit({ chapter: h, lesson: d });
					}
				);
			const s = (h) => (
					h.includes("{{") && (h = f(h)),
					`https://www.youtube.com/embed/${h}`
				),
				l = (h) => `${f(h)}#toolbar=0`,
				f = (h) => h.match(/\(["']([^"']+?)["']\)/)[1],
				p = () => {
					window.location.href = `/login?redirect_to=/courses/${c.courseName}/learn/${t.params.chapterNumber}-${t.params.lessonNumber}`;
				};
			return (h, d) => {
				const y = Z0("router-link");
				return b(r).data && b(o).data
					? (k(),
					  D("div", Cn, [
							C("header", Dn, [
								U(
									b(Q0),
									{ class: "h-7", items: a.value },
									null,
									8,
									["items"]
								),
							]),
							C("div", An, [
								b(r).data.no_preview
									? (k(),
									  D("div", En, [
											C(
												"p",
												Fn,
												F(
													h.__(
														"This lesson is not available for preview. Please enroll in the course to access it."
													)
												),
												1
											),
											U(
												y,
												{
													to: {
														name: "CourseDetail",
														params: {
															courseName:
																u.courseName,
														},
													},
												},
												{
													default: R(() => [
														U(
															b(Z),
															{
																variant:
																	"solid",
															},
															{
																default: R(
																	() => [
																		H0(
																			F(
																				h.__(
																					"Start Learning"
																				)
																			),
																			1
																		),
																	]
																),
																_: 1,
															}
														),
													]),
													_: 1,
												},
												8,
												["to"]
											),
									  ]))
									: (k(),
									  D("div", wn, [
											C("div", vn, [
												C(
													"div",
													Sn,
													F(b(r).data.title),
													1
												),
												C("div", null, [
													b(r).data.prev
														? (k(),
														  I(
																y,
																{
																	key: 0,
																	to: {
																		name: "Lesson",
																		params: {
																			courseName:
																				u.courseName,
																			chapterNumber:
																				b(
																					r
																				).data.prev.split(
																					"."
																				)[0],
																			lessonNumber:
																				b(
																					r
																				).data.prev.split(
																					"."
																				)[1],
																		},
																	},
																},
																{
																	default: R(
																		() => [
																			U(
																				b(
																					Z
																				),
																				{
																					class: "mr-2",
																				},
																				{
																					default:
																						R(
																							() => [
																								U(
																									b(
																										ee
																									),
																									{
																										class: "w-4 h-4 stroke-1",
																									}
																								),
																							]
																						),
																					_: 1,
																				}
																			),
																		]
																	),
																	_: 1,
																},
																8,
																["to"]
														  ))
														: q("", !0),
													b(r).data.next
														? (k(),
														  I(
																y,
																{
																	key: 1,
																	to: {
																		name: "Lesson",
																		params: {
																			courseName:
																				u.courseName,
																			chapterNumber:
																				b(
																					r
																				).data.next.split(
																					"."
																				)[0],
																			lessonNumber:
																				b(
																					r
																				).data.next.split(
																					"."
																				)[1],
																		},
																	},
																},
																{
																	default: R(
																		() => [
																			U(
																				b(
																					Z
																				),
																				null,
																				{
																					default:
																						R(
																							() => [
																								U(
																									b(
																										W0
																									),
																									{
																										class: "w-4 h-4 stroke-1",
																									}
																								),
																							]
																						),
																					_: 1,
																				}
																			),
																		]
																	),
																	_: 1,
																},
																8,
																["to"]
														  ))
														: q("", !0),
												]),
											]),
											C("div", zn, [
												C(
													"span",
													{
														class: V0([
															"mr-1",
															{
																"avatar-group overlap":
																	b(o).data
																		.instructors
																		.length >
																	1,
															},
														]),
													},
													[
														(k(!0),
														D(
															cu,
															null,
															ou(
																b(o).data
																	.instructors,
																(g) => (
																	k(),
																	I(
																		Y0,
																		{
																			user: g,
																		},
																		null,
																		8,
																		["user"]
																	)
																)
															),
															256
														)),
													],
													2
												),
												b(o).data.instructors.length ==
												1
													? (k(),
													  D(
															"span",
															qn,
															F(
																b(o).data
																	.instructors[0]
																	.full_name
															),
															1
													  ))
													: q("", !0),
												b(o).data.instructors.length ==
												2
													? (k(),
													  D(
															"span",
															Tn,
															F(
																b(o).data
																	.instructors[0]
																	.first_name
															) +
																" and " +
																F(
																	b(o).data
																		.instructors[1]
																		.first_name
																),
															1
													  ))
													: q("", !0),
												b(o).data.instructors.length > 2
													? (k(),
													  D(
															"span",
															Bn,
															F(
																b(o).data
																	.instructors[0]
																	.first_name
															) +
																" and " +
																F(
																	b(o).data
																		.instructors
																		.length -
																		1
																) +
																" others ",
															1
													  ))
													: q("", !0),
											]),
											C("div", In, [
												b(r).data.youtube
													? (k(),
													  D("div", Mn, [
															C(
																"iframe",
																{
																	class: "youtube-video",
																	src: s(
																		b(r)
																			.data
																			.youtube
																	),
																	width: "100%",
																	height: "400",
																	frameborder:
																		"0",
																	allowfullscreen:
																		"",
																},
																null,
																8,
																Nn
															),
													  ]))
													: q("", !0),
												(k(!0),
												D(
													cu,
													null,
													ou(
														b(r).data.body.split(`

`),
														(g) => (
															k(),
															D("div", null, [
																g.includes(
																	"{{ YouTubeVideo"
																)
																	? (k(),
																	  D(
																			"div",
																			Ln,
																			[
																				C(
																					"iframe",
																					{
																						class: "youtube-video",
																						src: s(
																							g
																						),
																						width: "100%",
																						height: "400",
																						frameborder:
																							"0",
																						allowfullscreen:
																							"",
																					},
																					null,
																					8,
																					Rn
																				),
																			]
																	  ))
																	: g.includes(
																			"{{ Quiz"
																	  )
																	? (k(),
																	  D(
																			"div",
																			Pn,
																			[
																				b(
																					e
																				)
																					.data
																					? (k(),
																					  I(
																							h0,
																							{
																								key: 0,
																								quizName:
																									f(
																										g
																									),
																							},
																							null,
																							8,
																							[
																								"quizName",
																							]
																					  ))
																					: (k(),
																					  D(
																							"div",
																							$n,
																							[
																								C(
																									"div",
																									null,
																									F(
																										h.__(
																											"Please login to access the quiz."
																										)
																									),
																									1
																								),
																								U(
																									b(
																										Z
																									),
																									{
																										onClick:
																											d[0] ||
																											(d[0] =
																												(
																													w
																												) =>
																													p()),
																										class: "mt-2",
																									},
																									{
																										default:
																											R(
																												() => [
																													C(
																														"span",
																														null,
																														F(
																															h.__(
																																"Login"
																															)
																														),
																														1
																													),
																												]
																											),
																										_: 1,
																									}
																								),
																							]
																					  )),
																			]
																	  ))
																	: g.includes(
																			"{{ Video"
																	  )
																	? (k(),
																	  D(
																			"div",
																			On,
																			[
																				C(
																					"video",
																					jn,
																					[
																						C(
																							"source",
																							{
																								src: f(
																									g
																								),
																								type: "video/mp4",
																							},
																							null,
																							8,
																							Un
																						),
																					]
																				),
																			]
																	  ))
																	: g.includes(
																			"{{ PDF"
																	  )
																	? (k(),
																	  D(
																			"div",
																			Zn,
																			[
																				C(
																					"iframe",
																					{
																						src: l(
																							g
																						),
																						width: "100%",
																						height: "400",
																						frameborder:
																							"0",
																						allowfullscreen:
																							"",
																					},
																					null,
																					8,
																					Hn
																				),
																			]
																	  ))
																	: g.includes(
																			"{{ Audio"
																	  )
																	? (k(),
																	  D(
																			"div",
																			Vn,
																			[
																				C(
																					"audio",
																					Gn,
																					[
																						C(
																							"source",
																							{
																								src: f(
																									g
																								),
																								type: "audio/mp3",
																							},
																							null,
																							8,
																							Qn
																						),
																					]
																				),
																			]
																	  ))
																	: g.includes(
																			"{{ Embed"
																	  )
																	? (k(),
																	  D(
																			"div",
																			Wn,
																			[
																				C(
																					"iframe",
																					{
																						width: "100%",
																						height: "400",
																						src: f(
																							g
																						),
																						frameborder:
																							"0",
																						allowfullscreen:
																							"",
																					},
																					`
							`,
																					8,
																					Jn
																				),
																			]
																	  ))
																	: (k(),
																	  D(
																			"div",
																			{
																				key: 6,
																				innerHTML:
																					b(
																						n
																					).render(
																						g
																					),
																			},
																			null,
																			8,
																			Yn
																	  )),
															])
														)
													),
													256
												)),
												b(r).data.quiz_id
													? (k(),
													  D("div", Xn, [
															b(e).data
																? (k(),
																  I(
																		h0,
																		{
																			key: 0,
																			quizName:
																				f(
																					h.block
																				),
																		},
																		null,
																		8,
																		[
																			"quizName",
																		]
																  ))
																: (k(),
																  D("div", Kn, [
																		C(
																			"div",
																			null,
																			F(
																				h.__(
																					"Please login to access the quiz."
																				)
																			),
																			1
																		),
																		U(
																			b(
																				Z
																			),
																			{
																				onClick:
																					d[1] ||
																					(d[1] =
																						(
																							g
																						) =>
																							p()),
																				class: "mt-2",
																			},
																			{
																				default:
																					R(
																						() => [
																							C(
																								"span",
																								null,
																								F(
																									h.__(
																										"Login"
																									)
																								),
																								1
																							),
																						]
																					),
																				_: 1,
																			}
																		),
																  ])),
													  ]))
													: q("", !0),
											]),
									  ])),
								C("div", uc, [
									C("div", ec, [
										C("div", tc, F(b(o).data.title), 1),
										b(e) && b(o).data.membership
											? (k(),
											  D(
													"div",
													rc,
													F(
														Math.ceil(
															b(o).data.membership
																.progress
														)
													) + "% completed ",
													1
											  ))
											: q("", !0),
										b(e) && b(o).data.membership
											? (k(),
											  D("div", nc, [
													C(
														"div",
														{
															class: "bg-gray-900 h-1 rounded-full",
															style: G0({
																width:
																	Math.ceil(
																		b(o)
																			.data
																			.membership
																			.progress
																	) + "%",
															}),
														},
														null,
														4
													),
											  ]))
											: q("", !0),
									]),
									(k(),
									I(
										J0,
										{
											courseName: u.courseName,
											key: u.chapterNumber,
										},
										null,
										8,
										["courseName"]
									)),
								]),
							]),
					  ]))
					: q("", !0);
			};
		},
	};
export { lc as default };
