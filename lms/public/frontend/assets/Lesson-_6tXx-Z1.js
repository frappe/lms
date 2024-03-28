import {
	d as pe,
	r as Gu,
	a as Qu,
	ad as Oe,
	k as K,
	w as _e,
	K as b,
	x as g,
	y as E,
	H as C,
	L as F,
	M as z,
	F as M,
	G as P,
	a7 as Z,
	Q as cu,
	R as ou,
	J as U,
	ae as je,
	af as Ue,
	j as Ze,
	I as He,
	U as Ve,
	W as Ge,
	a6 as Qe,
	a4 as We,
} from "./frappe-ui-n1bXVQkV.js";
import { _ as Je, C as Ye } from "./CourseOutline-mDbSZeRP.js";
import { _ as Xe } from "./UserAvatar-3mSOKoKa.js";
import { a as Pu, t as Ke, c as u0 } from "./index-xt-hKVBz.js";
import { _ as e0, C as t0 } from "./Discussions-MQ_bdV9n.js";
import "./file-text-dAqD9clk.js";
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const r0 = Pu("CheckCircleIcon", [
	["path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14", key: "g774vq" }],
	["path", { d: "m9 11 3 3L22 4", key: "1pflzl" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const Wu = Pu("MinusCircleIcon", [
	["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
	["path", { d: "M8 12h8", key: "1wcyev" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const n0 = Pu("XCircleIcon", [
		["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
		["path", { d: "m15 9-6 6", key: "1uzhvr" }],
		["path", { d: "m9 9 6 6", key: "z0biqf" }],
	]),
	Ju = {};
function c0(u) {
	let e = Ju[u];
	if (e) return e;
	e = Ju[u] = [];
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
	const t = c0(e);
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
					s < 128 ? (c += "��") : (c += String.fromCharCode(s)),
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
						? (c += "���")
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
						? (c += "����")
						: ((f -= 65536),
						  (c += String.fromCharCode(
								55296 + (f >> 10),
								56320 + (f & 1023)
						  ))),
						(r += 9);
					continue;
				}
			}
			c += "�";
		}
		return c;
	});
}
tu.defaultChars = ";/?:@&=+$,#";
tu.componentChars = "";
const Yu = {};
function o0(u) {
	let e = Yu[u];
	if (e) return e;
	e = Yu[u] = [];
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
	const n = o0(e);
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
function Bu(u) {
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
const i0 = /^([a-z0-9.+-]+:)/i,
	a0 = /:[0-9]*$/,
	s0 = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,
	l0 = [
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
	f0 = ["{", "}", "|", "\\", "^", "`"].concat(l0),
	d0 = ["'"].concat(f0),
	Xu = ["%", "/", "?", ";", "#"].concat(d0),
	Ku = ["/", "?", "#"],
	h0 = 255,
	ue = /^[+a-z0-9A-Z_-]{0,63}$/,
	b0 = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
	ee = { javascript: !0, "javascript:": !0 },
	te = {
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
		const s = s0.exec(r);
		if (s)
			return (this.pathname = s[1]), s[2] && (this.search = s[2]), this;
	}
	let i = i0.exec(r);
	if (
		(i &&
			((i = i[0]),
			(t = i.toLowerCase()),
			(this.protocol = i),
			(r = r.substr(i.length))),
		(e || i || r.match(/^\/\/[^@\/]+@[^@\/]+/)) &&
			((c = r.substr(0, 2) === "//"),
			c && !(i && ee[i]) && ((r = r.substr(2)), (this.slashes = !0))),
		!ee[i] && (c || (i && !te[i])))
	) {
		let s = -1;
		for (let d = 0; d < Ku.length; d++)
			(n = r.indexOf(Ku[d])), n !== -1 && (s === -1 || n < s) && (s = n);
		let l, f;
		s === -1 ? (f = r.lastIndexOf("@")) : (f = r.lastIndexOf("@", s)),
			f !== -1 &&
				((l = r.slice(0, f)), (r = r.slice(f + 1)), (this.auth = l)),
			(s = -1);
		for (let d = 0; d < Xu.length; d++)
			(n = r.indexOf(Xu[d])), n !== -1 && (s === -1 || n < s) && (s = n);
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
			for (let _ = 0, y = d.length; _ < y; _++) {
				const D = d[_];
				if (D && !D.match(ue)) {
					let A = "";
					for (let k = 0, w = D.length; k < w; k++)
						D.charCodeAt(k) > 127 ? (A += "x") : (A += D[k]);
					if (!A.match(ue)) {
						const k = d.slice(0, _),
							w = d.slice(_ + 1),
							m = D.match(b0);
						m && (k.push(m[1]), w.unshift(m[2])),
							w.length && (r = w.join(".") + r),
							(this.hostname = k.join("."));
						break;
					}
				}
			}
		}
		this.hostname.length > h0 && (this.hostname = ""),
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
		te[t] && this.hostname && !this.pathname && (this.pathname = ""),
		this
	);
};
ku.prototype.parseHost = function (u) {
	let e = a0.exec(u);
	e &&
		((e = e[0]),
		e !== ":" && (this.port = e.substr(1)),
		(u = u.substr(0, u.length - e.length))),
		u && (this.hostname = u);
};
const p0 = Object.freeze(
		Object.defineProperty(
			{ __proto__: null, decode: tu, encode: du, format: Bu, parse: $u },
			Symbol.toStringTag,
			{ value: "Module" }
		)
	),
	me =
		/[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/,
	xe = /[\0-\x1F\x7F-\x9F]/,
	_0 =
		/[\xAD\u0600-\u0605\u061C\u06DD\u070F\u0890\u0891\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD80D[\uDC30-\uDC3F]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/,
	Ou =
		/[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061D-\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1B7D\u1B7E\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u2E52-\u2E5D\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDEAD\uDF55-\uDF59\uDF86-\uDF89]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5A\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDEB9\uDF3C-\uDF3E]|\uD806[\uDC3B\uDD44-\uDD46\uDDE2\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2\uDF00-\uDF09]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8\uDF43-\uDF4F\uDFFF]|\uD809[\uDC70-\uDC74]|\uD80B[\uDFF1\uDFF2]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A\uDFE2]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/,
	ke = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/,
	m0 = Object.freeze(
		Object.defineProperty(
			{ __proto__: null, Any: me, Cc: xe, Cf: _0, P: Ou, Z: ke },
			Symbol.toStringTag,
			{ value: "Module" }
		)
	),
	x0 = new Uint16Array(
		'ᵁ<Õıʊҝջאٵ۞ޢߖࠏ੊ઑඡ๭༉༦჊ረዡᐕᒝᓃᓟᔥ\0\0\0\0\0\0ᕫᛍᦍᰒᷝ὾⁠↰⊍⏀⏻⑂⠤⤒ⴈ⹈⿎〖㊺㘹㞬㣾㨨㩱㫠㬮ࠀEMabcfglmnoprstu\\bfms¦³¹ÈÏlig耻Æ䃆P耻&䀦cute耻Á䃁reve;䄂Āiyx}rc耻Â䃂;䐐r;쀀𝔄rave耻À䃀pha;䎑acr;䄀d;橓Āgp¡on;䄄f;쀀𝔸plyFunction;恡ing耻Å䃅Ācs¾Ãr;쀀𝒜ign;扔ilde耻Ã䃃ml耻Ä䃄ЀaceforsuåûþėĜĢħĪĀcrêòkslash;或Ŷöø;櫧ed;挆y;䐑ƀcrtąċĔause;戵noullis;愬a;䎒r;쀀𝔅pf;쀀𝔹eve;䋘còēmpeq;扎܀HOacdefhilorsuōőŖƀƞƢƵƷƺǜȕɳɸɾcy;䐧PY耻©䂩ƀcpyŝŢźute;䄆Ā;iŧŨ拒talDifferentialD;慅leys;愭ȀaeioƉƎƔƘron;䄌dil耻Ç䃇rc;䄈nint;戰ot;䄊ĀdnƧƭilla;䂸terDot;䂷òſi;䎧rcleȀDMPTǇǋǑǖot;抙inus;抖lus;投imes;抗oĀcsǢǸkwiseContourIntegral;戲eCurlyĀDQȃȏoubleQuote;思uote;怙ȀlnpuȞȨɇɕonĀ;eȥȦ户;橴ƀgitȯȶȺruent;扡nt;戯ourIntegral;戮ĀfrɌɎ;愂oduct;成nterClockwiseContourIntegral;戳oss;樯cr;쀀𝒞pĀ;Cʄʅ拓ap;才րDJSZacefiosʠʬʰʴʸˋ˗ˡ˦̳ҍĀ;oŹʥtrahd;椑cy;䐂cy;䐅cy;䐏ƀgrsʿ˄ˇger;怡r;憡hv;櫤Āayː˕ron;䄎;䐔lĀ;t˝˞戇a;䎔r;쀀𝔇Āaf˫̧Ācm˰̢riticalȀADGT̖̜̀̆cute;䂴oŴ̋̍;䋙bleAcute;䋝rave;䁠ilde;䋜ond;拄ferentialD;慆Ѱ̽\0\0\0͔͂\0Ѕf;쀀𝔻ƀ;DE͈͉͍䂨ot;惜qual;扐blèCDLRUVͣͲ΂ϏϢϸontourIntegraìȹoɴ͹\0\0ͻ»͉nArrow;懓Āeo·ΤftƀARTΐΖΡrrow;懐ightArrow;懔eåˊngĀLRΫτeftĀARγιrrow;柸ightArrow;柺ightArrow;柹ightĀATϘϞrrow;懒ee;抨pɁϩ\0\0ϯrrow;懑ownArrow;懕erticalBar;戥ǹABLRTaВЪаўѿͼrrowƀ;BUНОТ憓ar;椓pArrow;懵reve;䌑eft˒к\0ц\0ѐightVector;楐eeVector;楞ectorĀ;Bљњ憽ar;楖ightǔѧ\0ѱeeVector;楟ectorĀ;BѺѻ懁ar;楗eeĀ;A҆҇护rrow;憧ĀctҒҗr;쀀𝒟rok;䄐ࠀNTacdfglmopqstuxҽӀӄӋӞӢӧӮӵԡԯԶՒ՝ՠեG;䅊H耻Ð䃐cute耻É䃉ƀaiyӒӗӜron;䄚rc耻Ê䃊;䐭ot;䄖r;쀀𝔈rave耻È䃈ement;戈ĀapӺӾcr;䄒tyɓԆ\0\0ԒmallSquare;旻erySmallSquare;斫ĀgpԦԪon;䄘f;쀀𝔼silon;䎕uĀaiԼՉlĀ;TՂՃ橵ilde;扂librium;懌Āci՗՚r;愰m;橳a;䎗ml耻Ë䃋Āipժկsts;戃onentialE;慇ʀcfiosօֈ֍ֲ׌y;䐤r;쀀𝔉lledɓ֗\0\0֣mallSquare;旼erySmallSquare;斪Ͱֺ\0ֿ\0\0ׄf;쀀𝔽All;戀riertrf;愱cò׋؀JTabcdfgorstר׬ׯ׺؀ؒؖ؛؝أ٬ٲcy;䐃耻>䀾mmaĀ;d׷׸䎓;䏜reve;䄞ƀeiy؇،ؐdil;䄢rc;䄜;䐓ot;䄠r;쀀𝔊;拙pf;쀀𝔾eater̀EFGLSTصلَٖٛ٦qualĀ;Lؾؿ扥ess;招ullEqual;执reater;檢ess;扷lantEqual;橾ilde;扳cr;쀀𝒢;扫ЀAacfiosuڅڋږڛڞڪھۊRDcy;䐪Āctڐڔek;䋇;䁞irc;䄤r;愌lbertSpace;愋ǰگ\0ڲf;愍izontalLine;攀Āctۃۅòکrok;䄦mpńېۘownHumðįqual;扏܀EJOacdfgmnostuۺ۾܃܇܎ܚܞܡܨ݄ݸދޏޕcy;䐕lig;䄲cy;䐁cute耻Í䃍Āiyܓܘrc耻Î䃎;䐘ot;䄰r;愑rave耻Ì䃌ƀ;apܠܯܿĀcgܴܷr;䄪inaryI;慈lieóϝǴ݉\0ݢĀ;eݍݎ戬Āgrݓݘral;戫section;拂isibleĀCTݬݲomma;恣imes;恢ƀgptݿރވon;䄮f;쀀𝕀a;䎙cr;愐ilde;䄨ǫޚ\0ޞcy;䐆l耻Ï䃏ʀcfosuެ޷޼߂ߐĀiyޱ޵rc;䄴;䐙r;쀀𝔍pf;쀀𝕁ǣ߇\0ߌr;쀀𝒥rcy;䐈kcy;䐄΀HJacfosߤߨ߽߬߱ࠂࠈcy;䐥cy;䐌ppa;䎚Āey߶߻dil;䄶;䐚r;쀀𝔎pf;쀀𝕂cr;쀀𝒦րJTaceflmostࠥࠩࠬࡐࡣ঳সে্਷ੇcy;䐉耻<䀼ʀcmnpr࠷࠼ࡁࡄࡍute;䄹bda;䎛g;柪lacetrf;愒r;憞ƀaeyࡗ࡜ࡡron;䄽dil;䄻;䐛Āfsࡨ॰tԀACDFRTUVarࡾࢩࢱࣦ࣠ࣼयज़ΐ४Ānrࢃ࢏gleBracket;柨rowƀ;BR࢙࢚࢞憐ar;懤ightArrow;懆eiling;挈oǵࢷ\0ࣃbleBracket;柦nǔࣈ\0࣒eeVector;楡ectorĀ;Bࣛࣜ懃ar;楙loor;挊ightĀAV࣯ࣵrrow;憔ector;楎Āerँगeƀ;AVउऊऐ抣rrow;憤ector;楚iangleƀ;BEतथऩ抲ar;槏qual;抴pƀDTVषूौownVector;楑eeVector;楠ectorĀ;Bॖॗ憿ar;楘ectorĀ;B॥०憼ar;楒ightáΜs̀EFGLSTॾঋকঝঢভqualGreater;拚ullEqual;扦reater;扶ess;檡lantEqual;橽ilde;扲r;쀀𝔏Ā;eঽা拘ftarrow;懚idot;䄿ƀnpw৔ਖਛgȀLRlr৞৷ਂਐeftĀAR০৬rrow;柵ightArrow;柷ightArrow;柶eftĀarγਊightáοightáϊf;쀀𝕃erĀLRਢਬeftArrow;憙ightArrow;憘ƀchtਾੀੂòࡌ;憰rok;䅁;扪Ѐacefiosuਗ਼੝੠੷੼અઋ઎p;椅y;䐜Ādl੥੯iumSpace;恟lintrf;愳r;쀀𝔐nusPlus;戓pf;쀀𝕄cò੶;䎜ҀJacefostuણધભીଔଙඑ඗ඞcy;䐊cute;䅃ƀaey઴હાron;䅇dil;䅅;䐝ƀgswે૰଎ativeƀMTV૓૟૨ediumSpace;怋hiĀcn૦૘ë૙eryThiî૙tedĀGL૸ଆreaterGreateòٳessLesóੈLine;䀊r;쀀𝔑ȀBnptଢନଷ଺reak;恠BreakingSpace;䂠f;愕ڀ;CDEGHLNPRSTV୕ୖ୪୼஡௫ఄ౞಄ದ೘ൡඅ櫬Āou୛୤ngruent;扢pCap;扭oubleVerticalBar;戦ƀlqxஃஊ஛ement;戉ualĀ;Tஒஓ扠ilde;쀀≂̸ists;戄reater΀;EFGLSTஶஷ஽௉௓௘௥扯qual;扱ullEqual;쀀≧̸reater;쀀≫̸ess;批lantEqual;쀀⩾̸ilde;扵umpń௲௽ownHump;쀀≎̸qual;쀀≏̸eĀfsఊధtTriangleƀ;BEచఛడ拪ar;쀀⧏̸qual;括s̀;EGLSTవశ఼ౄోౘ扮qual;扰reater;扸ess;쀀≪̸lantEqual;쀀⩽̸ilde;扴estedĀGL౨౹reaterGreater;쀀⪢̸essLess;쀀⪡̸recedesƀ;ESಒಓಛ技qual;쀀⪯̸lantEqual;拠ĀeiಫಹverseElement;戌ghtTriangleƀ;BEೋೌ೒拫ar;쀀⧐̸qual;拭ĀquೝഌuareSuĀbp೨೹setĀ;E೰ೳ쀀⊏̸qual;拢ersetĀ;Eഃആ쀀⊐̸qual;拣ƀbcpഓതൎsetĀ;Eഛഞ쀀⊂⃒qual;抈ceedsȀ;ESTലള഻െ抁qual;쀀⪰̸lantEqual;拡ilde;쀀≿̸ersetĀ;E൘൛쀀⊃⃒qual;抉ildeȀ;EFT൮൯൵ൿ扁qual;扄ullEqual;扇ilde;扉erticalBar;戤cr;쀀𝒩ilde耻Ñ䃑;䎝܀Eacdfgmoprstuvලෂ෉෕ෛ෠෧෼ขภยา฿ไlig;䅒cute耻Ó䃓Āiy෎ීrc耻Ô䃔;䐞blac;䅐r;쀀𝔒rave耻Ò䃒ƀaei෮ෲ෶cr;䅌ga;䎩cron;䎟pf;쀀𝕆enCurlyĀDQฎบoubleQuote;怜uote;怘;橔Āclวฬr;쀀𝒪ash耻Ø䃘iŬื฼de耻Õ䃕es;樷ml耻Ö䃖erĀBP๋๠Āar๐๓r;怾acĀek๚๜;揞et;掴arenthesis;揜Ҁacfhilors๿ງຊຏຒດຝະ໼rtialD;戂y;䐟r;쀀𝔓i;䎦;䎠usMinus;䂱Āipຢອncareplanåڝf;愙Ȁ;eio຺ູ໠໤檻cedesȀ;EST່້໏໚扺qual;檯lantEqual;扼ilde;找me;怳Ādp໩໮uct;戏ortionĀ;aȥ໹l;戝Āci༁༆r;쀀𝒫;䎨ȀUfos༑༖༛༟OT耻"䀢r;쀀𝔔pf;愚cr;쀀𝒬؀BEacefhiorsu༾གྷཇའཱིྦྷྪྭ႖ႩႴႾarr;椐G耻®䂮ƀcnrཎནབute;䅔g;柫rĀ;tཛྷཝ憠l;椖ƀaeyཧཬཱron;䅘dil;䅖;䐠Ā;vླྀཹ愜erseĀEUྂྙĀlq྇ྎement;戋uilibrium;懋pEquilibrium;楯r»ཹo;䎡ghtЀACDFTUVa࿁࿫࿳ဢဨၛႇϘĀnr࿆࿒gleBracket;柩rowƀ;BL࿜࿝࿡憒ar;懥eftArrow;懄eiling;按oǵ࿹\0စbleBracket;柧nǔည\0နeeVector;楝ectorĀ;Bဝသ懂ar;楕loor;挋Āerိ၃eƀ;AVဵံြ抢rrow;憦ector;楛iangleƀ;BEၐၑၕ抳ar;槐qual;抵pƀDTVၣၮၸownVector;楏eeVector;楜ectorĀ;Bႂႃ憾ar;楔ectorĀ;B႑႒懀ar;楓Āpuႛ႞f;愝ndImplies;楰ightarrow;懛ĀchႹႼr;愛;憱leDelayed;槴ڀHOacfhimoqstuფჱჷჽᄙᄞᅑᅖᅡᅧᆵᆻᆿĀCcჩხHcy;䐩y;䐨FTcy;䐬cute;䅚ʀ;aeiyᄈᄉᄎᄓᄗ檼ron;䅠dil;䅞rc;䅜;䐡r;쀀𝔖ortȀDLRUᄪᄴᄾᅉownArrow»ОeftArrow»࢚ightArrow»࿝pArrow;憑gma;䎣allCircle;战pf;쀀𝕊ɲᅭ\0\0ᅰt;戚areȀ;ISUᅻᅼᆉᆯ斡ntersection;抓uĀbpᆏᆞsetĀ;Eᆗᆘ抏qual;抑ersetĀ;Eᆨᆩ抐qual;抒nion;抔cr;쀀𝒮ar;拆ȀbcmpᇈᇛሉላĀ;sᇍᇎ拐etĀ;Eᇍᇕqual;抆ĀchᇠህeedsȀ;ESTᇭᇮᇴᇿ扻qual;檰lantEqual;扽ilde;承Tháྌ;我ƀ;esሒሓሣ拑rsetĀ;Eሜም抃qual;抇et»ሓրHRSacfhiorsሾቄ቉ቕ቞ቱቶኟዂወዑORN耻Þ䃞ADE;愢ĀHc቎ቒcy;䐋y;䐦Ābuቚቜ;䀉;䎤ƀaeyብቪቯron;䅤dil;䅢;䐢r;쀀𝔗Āeiቻ኉ǲኀ\0ኇefore;戴a;䎘Ācn኎ኘkSpace;쀀  Space;怉ldeȀ;EFTካኬኲኼ戼qual;扃ullEqual;扅ilde;扈pf;쀀𝕋ipleDot;惛Āctዖዛr;쀀𝒯rok;䅦ૡዷጎጚጦ\0ጬጱ\0\0\0\0\0ጸጽ፷ᎅ\0᏿ᐄᐊᐐĀcrዻጁute耻Ú䃚rĀ;oጇገ憟cir;楉rǣጓ\0጖y;䐎ve;䅬Āiyጞጣrc耻Û䃛;䐣blac;䅰r;쀀𝔘rave耻Ù䃙acr;䅪Ādiፁ፩erĀBPፈ፝Āarፍፐr;䁟acĀekፗፙ;揟et;掵arenthesis;揝onĀ;P፰፱拃lus;抎Āgp፻፿on;䅲f;쀀𝕌ЀADETadps᎕ᎮᎸᏄϨᏒᏗᏳrrowƀ;BDᅐᎠᎤar;椒ownArrow;懅ownArrow;憕quilibrium;楮eeĀ;AᏋᏌ报rrow;憥ownáϳerĀLRᏞᏨeftArrow;憖ightArrow;憗iĀ;lᏹᏺ䏒on;䎥ing;䅮cr;쀀𝒰ilde;䅨ml耻Ü䃜ҀDbcdefosvᐧᐬᐰᐳᐾᒅᒊᒐᒖash;披ar;櫫y;䐒ashĀ;lᐻᐼ抩;櫦Āerᑃᑅ;拁ƀbtyᑌᑐᑺar;怖Ā;iᑏᑕcalȀBLSTᑡᑥᑪᑴar;戣ine;䁼eparator;杘ilde;所ThinSpace;怊r;쀀𝔙pf;쀀𝕍cr;쀀𝒱dash;抪ʀcefosᒧᒬᒱᒶᒼirc;䅴dge;拀r;쀀𝔚pf;쀀𝕎cr;쀀𝒲Ȁfiosᓋᓐᓒᓘr;쀀𝔛;䎞pf;쀀𝕏cr;쀀𝒳ҀAIUacfosuᓱᓵᓹᓽᔄᔏᔔᔚᔠcy;䐯cy;䐇cy;䐮cute耻Ý䃝Āiyᔉᔍrc;䅶;䐫r;쀀𝔜pf;쀀𝕐cr;쀀𝒴ml;䅸ЀHacdefosᔵᔹᔿᕋᕏᕝᕠᕤcy;䐖cute;䅹Āayᕄᕉron;䅽;䐗ot;䅻ǲᕔ\0ᕛoWidtè૙a;䎖r;愨pf;愤cr;쀀𝒵௡ᖃᖊᖐ\0ᖰᖶᖿ\0\0\0\0ᗆᗛᗫᙟ᙭\0ᚕ᚛ᚲᚹ\0ᚾcute耻á䃡reve;䄃̀;Ediuyᖜᖝᖡᖣᖨᖭ戾;쀀∾̳;房rc耻â䃢te肻´̆;䐰lig耻æ䃦Ā;r²ᖺ;쀀𝔞rave耻à䃠ĀepᗊᗖĀfpᗏᗔsym;愵èᗓha;䎱ĀapᗟcĀclᗤᗧr;䄁g;樿ɤᗰ\0\0ᘊʀ;adsvᗺᗻᗿᘁᘇ戧nd;橕;橜lope;橘;橚΀;elmrszᘘᘙᘛᘞᘿᙏᙙ戠;榤e»ᘙsdĀ;aᘥᘦ戡ѡᘰᘲᘴᘶᘸᘺᘼᘾ;榨;榩;榪;榫;榬;榭;榮;榯tĀ;vᙅᙆ戟bĀ;dᙌᙍ抾;榝Āptᙔᙗh;戢»¹arr;捼Āgpᙣᙧon;䄅f;쀀𝕒΀;Eaeiop዁ᙻᙽᚂᚄᚇᚊ;橰cir;橯;扊d;手s;䀧roxĀ;e዁ᚒñᚃing耻å䃥ƀctyᚡᚦᚨr;쀀𝒶;䀪mpĀ;e዁ᚯñʈilde耻ã䃣ml耻ä䃤Āciᛂᛈoninôɲnt;樑ࠀNabcdefiklnoprsu᛭ᛱᜰ᜼ᝃᝈ᝸᝽០៦ᠹᡐᜍ᤽᥈ᥰot;櫭Ācrᛶ᜞kȀcepsᜀᜅᜍᜓong;扌psilon;䏶rime;怵imĀ;e᜚᜛戽q;拍Ŷᜢᜦee;抽edĀ;gᜬᜭ挅e»ᜭrkĀ;t፜᜷brk;掶Āoyᜁᝁ;䐱quo;怞ʀcmprtᝓ᝛ᝡᝤᝨausĀ;eĊĉptyv;榰séᜌnoõēƀahwᝯ᝱ᝳ;䎲;愶een;扬r;쀀𝔟g΀costuvwឍឝឳេ៕៛៞ƀaiuបពរðݠrc;旯p»፱ƀdptឤឨឭot;樀lus;樁imes;樂ɱឹ\0\0ើcup;樆ar;昅riangleĀdu៍្own;施p;斳plus;樄eåᑄåᒭarow;植ƀako៭ᠦᠵĀcn៲ᠣkƀlst៺֫᠂ozenge;槫riangleȀ;dlr᠒᠓᠘᠝斴own;斾eft;旂ight;斸k;搣Ʊᠫ\0ᠳƲᠯ\0ᠱ;斒;斑4;斓ck;斈ĀeoᠾᡍĀ;qᡃᡆ쀀=⃥uiv;쀀≡⃥t;挐Ȁptwxᡙᡞᡧᡬf;쀀𝕓Ā;tᏋᡣom»Ꮜtie;拈؀DHUVbdhmptuvᢅᢖᢪᢻᣗᣛᣬ᣿ᤅᤊᤐᤡȀLRlrᢎᢐᢒᢔ;敗;敔;敖;敓ʀ;DUduᢡᢢᢤᢦᢨ敐;敦;敩;敤;敧ȀLRlrᢳᢵᢷᢹ;敝;敚;敜;教΀;HLRhlrᣊᣋᣍᣏᣑᣓᣕ救;敬;散;敠;敫;敢;敟ox;槉ȀLRlrᣤᣦᣨᣪ;敕;敒;攐;攌ʀ;DUduڽ᣷᣹᣻᣽;敥;敨;攬;攴inus;抟lus;択imes;抠ȀLRlrᤙᤛᤝ᤟;敛;敘;攘;攔΀;HLRhlrᤰᤱᤳᤵᤷ᤻᤹攂;敪;敡;敞;攼;攤;攜Āevģ᥂bar耻¦䂦Ȁceioᥑᥖᥚᥠr;쀀𝒷mi;恏mĀ;e᜚᜜lƀ;bhᥨᥩᥫ䁜;槅sub;柈Ŭᥴ᥾lĀ;e᥹᥺怢t»᥺pƀ;Eeįᦅᦇ;檮Ā;qۜۛೡᦧ\0᧨ᨑᨕᨲ\0ᨷᩐ\0\0᪴\0\0᫁\0\0ᬡᬮ᭍᭒\0᯽\0ᰌƀcpr᦭ᦲ᧝ute;䄇̀;abcdsᦿᧀᧄ᧊᧕᧙戩nd;橄rcup;橉Āau᧏᧒p;橋p;橇ot;橀;쀀∩︀Āeo᧢᧥t;恁îړȀaeiu᧰᧻ᨁᨅǰ᧵\0᧸s;橍on;䄍dil耻ç䃧rc;䄉psĀ;sᨌᨍ橌m;橐ot;䄋ƀdmnᨛᨠᨦil肻¸ƭptyv;榲t脀¢;eᨭᨮ䂢räƲr;쀀𝔠ƀceiᨽᩀᩍy;䑇ckĀ;mᩇᩈ朓ark»ᩈ;䏇r΀;Ecefms᩟᩠ᩢᩫ᪤᪪᪮旋;槃ƀ;elᩩᩪᩭ䋆q;扗eɡᩴ\0\0᪈rrowĀlr᩼᪁eft;憺ight;憻ʀRSacd᪒᪔᪖᪚᪟»ཇ;擈st;抛irc;抚ash;抝nint;樐id;櫯cir;槂ubsĀ;u᪻᪼晣it»᪼ˬ᫇᫔᫺\0ᬊonĀ;eᫍᫎ䀺Ā;qÇÆɭ᫙\0\0᫢aĀ;t᫞᫟䀬;䁀ƀ;fl᫨᫩᫫戁îᅠeĀmx᫱᫶ent»᫩eóɍǧ᫾\0ᬇĀ;dኻᬂot;橭nôɆƀfryᬐᬔᬗ;쀀𝕔oäɔ脀©;sŕᬝr;愗Āaoᬥᬩrr;憵ss;朗Ācuᬲᬷr;쀀𝒸Ābpᬼ᭄Ā;eᭁᭂ櫏;櫑Ā;eᭉᭊ櫐;櫒dot;拯΀delprvw᭠᭬᭷ᮂᮬᯔ᯹arrĀlr᭨᭪;椸;椵ɰ᭲\0\0᭵r;拞c;拟arrĀ;p᭿ᮀ憶;椽̀;bcdosᮏᮐᮖᮡᮥᮨ截rcap;橈Āauᮛᮞp;橆p;橊ot;抍r;橅;쀀∪︀Ȁalrv᮵ᮿᯞᯣrrĀ;mᮼᮽ憷;椼yƀevwᯇᯔᯘqɰᯎ\0\0ᯒreã᭳uã᭵ee;拎edge;拏en耻¤䂤earrowĀlrᯮ᯳eft»ᮀight»ᮽeäᯝĀciᰁᰇoninôǷnt;戱lcty;挭ঀAHabcdefhijlorstuwz᰸᰻᰿ᱝᱩᱵᲊᲞᲬᲷ᳻᳿ᴍᵻᶑᶫᶻ᷆᷍rò΁ar;楥Ȁglrs᱈ᱍ᱒᱔ger;怠eth;愸òᄳhĀ;vᱚᱛ怐»ऊūᱡᱧarow;椏aã̕Āayᱮᱳron;䄏;䐴ƀ;ao̲ᱼᲄĀgrʿᲁr;懊tseq;橷ƀglmᲑᲔᲘ耻°䂰ta;䎴ptyv;榱ĀirᲣᲨsht;楿;쀀𝔡arĀlrᲳᲵ»ࣜ»သʀaegsv᳂͸᳖᳜᳠mƀ;oș᳊᳔ndĀ;ș᳑uit;晦amma;䏝in;拲ƀ;io᳧᳨᳸䃷de脀÷;o᳧ᳰntimes;拇nø᳷cy;䑒cɯᴆ\0\0ᴊrn;挞op;挍ʀlptuwᴘᴝᴢᵉᵕlar;䀤f;쀀𝕕ʀ;emps̋ᴭᴷᴽᵂqĀ;d͒ᴳot;扑inus;戸lus;戔quare;抡blebarwedgåúnƀadhᄮᵝᵧownarrowóᲃarpoonĀlrᵲᵶefôᲴighôᲶŢᵿᶅkaro÷གɯᶊ\0\0ᶎrn;挟op;挌ƀcotᶘᶣᶦĀryᶝᶡ;쀀𝒹;䑕l;槶rok;䄑Ādrᶰᶴot;拱iĀ;fᶺ᠖斿Āah᷀᷃ròЩaòྦangle;榦Āci᷒ᷕy;䑟grarr;柿ऀDacdefglmnopqrstuxḁḉḙḸոḼṉṡṾấắẽỡἪἷὄ὎὚ĀDoḆᴴoôᲉĀcsḎḔute耻é䃩ter;橮ȀaioyḢḧḱḶron;䄛rĀ;cḭḮ扖耻ê䃪lon;払;䑍ot;䄗ĀDrṁṅot;扒;쀀𝔢ƀ;rsṐṑṗ檚ave耻è䃨Ā;dṜṝ檖ot;檘Ȁ;ilsṪṫṲṴ檙nters;揧;愓Ā;dṹṺ檕ot;檗ƀapsẅẉẗcr;䄓tyƀ;svẒẓẕ戅et»ẓpĀ1;ẝẤĳạả;怄;怅怃ĀgsẪẬ;䅋p;怂ĀgpẴẸon;䄙f;쀀𝕖ƀalsỄỎỒrĀ;sỊị拕l;槣us;橱iƀ;lvỚớở䎵on»ớ;䏵ȀcsuvỪỳἋἣĀioữḱrc»Ḯɩỹ\0\0ỻíՈantĀglἂἆtr»ṝess»Ṻƀaeiἒ἖Ἒls;䀽st;扟vĀ;DȵἠD;橸parsl;槥ĀDaἯἳot;打rr;楱ƀcdiἾὁỸr;愯oô͒ĀahὉὋ;䎷耻ð䃰Āmrὓὗl耻ë䃫o;悬ƀcipὡὤὧl;䀡sôծĀeoὬὴctatioîՙnentialåչৡᾒ\0ᾞ\0ᾡᾧ\0\0ῆῌ\0ΐ\0ῦῪ \0 ⁚llingdotseñṄy;䑄male;晀ƀilrᾭᾳ῁lig;耀ﬃɩᾹ\0\0᾽g;耀ﬀig;耀ﬄ;쀀𝔣lig;耀ﬁlig;쀀fjƀaltῙ῜ῡt;晭ig;耀ﬂns;斱of;䆒ǰ΅\0ῳf;쀀𝕗ĀakֿῷĀ;vῼ´拔;櫙artint;樍Āao‌⁕Ācs‑⁒α‚‰‸⁅⁈\0⁐β•‥‧‪‬\0‮耻½䂽;慓耻¼䂼;慕;慙;慛Ƴ‴\0‶;慔;慖ʴ‾⁁\0\0⁃耻¾䂾;慗;慜5;慘ƶ⁌\0⁎;慚;慝8;慞l;恄wn;挢cr;쀀𝒻ࢀEabcdefgijlnorstv₂₉₟₥₰₴⃰⃵⃺⃿℃ℒℸ̗ℾ⅒↞Ā;lٍ₇;檌ƀcmpₐₕ₝ute;䇵maĀ;dₜ᳚䎳;檆reve;䄟Āiy₪₮rc;䄝;䐳ot;䄡Ȁ;lqsؾق₽⃉ƀ;qsؾٌ⃄lanô٥Ȁ;cdl٥⃒⃥⃕c;檩otĀ;o⃜⃝檀Ā;l⃢⃣檂;檄Ā;e⃪⃭쀀⋛︀s;檔r;쀀𝔤Ā;gٳ؛mel;愷cy;䑓Ȁ;Eajٚℌℎℐ;檒;檥;檤ȀEaesℛℝ℩ℴ;扩pĀ;p℣ℤ檊rox»ℤĀ;q℮ℯ檈Ā;q℮ℛim;拧pf;쀀𝕘Āci⅃ⅆr;愊mƀ;el٫ⅎ⅐;檎;檐茀>;cdlqr׮ⅠⅪⅮⅳⅹĀciⅥⅧ;檧r;橺ot;拗Par;榕uest;橼ʀadelsↄⅪ←ٖ↛ǰ↉\0↎proø₞r;楸qĀlqؿ↖lesó₈ií٫Āen↣↭rtneqq;쀀≩︀Å↪ԀAabcefkosy⇄⇇⇱⇵⇺∘∝∯≨≽ròΠȀilmr⇐⇔⇗⇛rsðᒄf»․ilôکĀdr⇠⇤cy;䑊ƀ;cwࣴ⇫⇯ir;楈;憭ar;意irc;䄥ƀalr∁∎∓rtsĀ;u∉∊晥it»∊lip;怦con;抹r;쀀𝔥sĀew∣∩arow;椥arow;椦ʀamopr∺∾≃≞≣rr;懿tht;戻kĀlr≉≓eftarrow;憩ightarrow;憪f;쀀𝕙bar;怕ƀclt≯≴≸r;쀀𝒽asè⇴rok;䄧Ābp⊂⊇ull;恃hen»ᱛૡ⊣\0⊪\0⊸⋅⋎\0⋕⋳\0\0⋸⌢⍧⍢⍿\0⎆⎪⎴cute耻í䃭ƀ;iyݱ⊰⊵rc耻î䃮;䐸Ācx⊼⊿y;䐵cl耻¡䂡ĀfrΟ⋉;쀀𝔦rave耻ì䃬Ȁ;inoܾ⋝⋩⋮Āin⋢⋦nt;樌t;戭fin;槜ta;愩lig;䄳ƀaop⋾⌚⌝ƀcgt⌅⌈⌗r;䄫ƀelpܟ⌏⌓inåގarôܠh;䄱f;抷ed;䆵ʀ;cfotӴ⌬⌱⌽⍁are;愅inĀ;t⌸⌹戞ie;槝doô⌙ʀ;celpݗ⍌⍐⍛⍡al;抺Āgr⍕⍙eróᕣã⍍arhk;樗rod;樼Ȁcgpt⍯⍲⍶⍻y;䑑on;䄯f;쀀𝕚a;䎹uest耻¿䂿Āci⎊⎏r;쀀𝒾nʀ;EdsvӴ⎛⎝⎡ӳ;拹ot;拵Ā;v⎦⎧拴;拳Ā;iݷ⎮lde;䄩ǫ⎸\0⎼cy;䑖l耻ï䃯̀cfmosu⏌⏗⏜⏡⏧⏵Āiy⏑⏕rc;䄵;䐹r;쀀𝔧ath;䈷pf;쀀𝕛ǣ⏬\0⏱r;쀀𝒿rcy;䑘kcy;䑔Ѐacfghjos␋␖␢␧␭␱␵␻ppaĀ;v␓␔䎺;䏰Āey␛␠dil;䄷;䐺r;쀀𝔨reen;䄸cy;䑅cy;䑜pf;쀀𝕜cr;쀀𝓀஀ABEHabcdefghjlmnoprstuv⑰⒁⒆⒍⒑┎┽╚▀♎♞♥♹♽⚚⚲⛘❝❨➋⟀⠁⠒ƀart⑷⑺⑼rò৆òΕail;椛arr;椎Ā;gঔ⒋;檋ar;楢ॣ⒥\0⒪\0⒱\0\0\0\0\0⒵Ⓔ\0ⓆⓈⓍ\0⓹ute;䄺mptyv;榴raîࡌbda;䎻gƀ;dlࢎⓁⓃ;榑åࢎ;檅uo耻«䂫rЀ;bfhlpst࢙ⓞⓦⓩ⓫⓮⓱⓵Ā;f࢝ⓣs;椟s;椝ë≒p;憫l;椹im;楳l;憢ƀ;ae⓿─┄檫il;椙Ā;s┉┊檭;쀀⪭︀ƀabr┕┙┝rr;椌rk;杲Āak┢┬cĀek┨┪;䁻;䁛Āes┱┳;榋lĀdu┹┻;榏;榍Ȁaeuy╆╋╖╘ron;䄾Ādi═╔il;䄼ìࢰâ┩;䐻Ȁcqrs╣╦╭╽a;椶uoĀ;rนᝆĀdu╲╷har;楧shar;楋h;憲ʀ;fgqs▋▌উ◳◿扤tʀahlrt▘▤▷◂◨rrowĀ;t࢙□aé⓶arpoonĀdu▯▴own»њp»०eftarrows;懇ightƀahs◍◖◞rrowĀ;sࣴࢧarpoonó྘quigarro÷⇰hreetimes;拋ƀ;qs▋ও◺lanôবʀ;cdgsব☊☍☝☨c;檨otĀ;o☔☕橿Ā;r☚☛檁;檃Ā;e☢☥쀀⋚︀s;檓ʀadegs☳☹☽♉♋pproøⓆot;拖qĀgq♃♅ôউgtò⒌ôছiíলƀilr♕࣡♚sht;楼;쀀𝔩Ā;Eজ♣;檑š♩♶rĀdu▲♮Ā;l॥♳;楪lk;斄cy;䑙ʀ;achtੈ⚈⚋⚑⚖rò◁orneòᴈard;楫ri;旺Āio⚟⚤dot;䅀ustĀ;a⚬⚭掰che»⚭ȀEaes⚻⚽⛉⛔;扨pĀ;p⛃⛄檉rox»⛄Ā;q⛎⛏檇Ā;q⛎⚻im;拦Ѐabnoptwz⛩⛴⛷✚✯❁❇❐Ānr⛮⛱g;柬r;懽rëࣁgƀlmr⛿✍✔eftĀar০✇ightá৲apsto;柼ightá৽parrowĀlr✥✩efô⓭ight;憬ƀafl✶✹✽r;榅;쀀𝕝us;樭imes;樴š❋❏st;戗áፎƀ;ef❗❘᠀旊nge»❘arĀ;l❤❥䀨t;榓ʀachmt❳❶❼➅➇ròࢨorneòᶌarĀ;d྘➃;業;怎ri;抿̀achiqt➘➝ੀ➢➮➻quo;怹r;쀀𝓁mƀ;egল➪➬;檍;檏Ābu┪➳oĀ;rฟ➹;怚rok;䅂萀<;cdhilqrࠫ⟒☹⟜⟠⟥⟪⟰Āci⟗⟙;檦r;橹reå◲mes;拉arr;楶uest;橻ĀPi⟵⟹ar;榖ƀ;ef⠀भ᠛旃rĀdu⠇⠍shar;楊har;楦Āen⠗⠡rtneqq;쀀≨︀Å⠞܀Dacdefhilnopsu⡀⡅⢂⢎⢓⢠⢥⢨⣚⣢⣤ઃ⣳⤂Dot;戺Ȁclpr⡎⡒⡣⡽r耻¯䂯Āet⡗⡙;時Ā;e⡞⡟朠se»⡟Ā;sျ⡨toȀ;dluျ⡳⡷⡻owîҌefôएðᏑker;斮Āoy⢇⢌mma;権;䐼ash;怔asuredangle»ᘦr;쀀𝔪o;愧ƀcdn⢯⢴⣉ro耻µ䂵Ȁ;acdᑤ⢽⣀⣄sôᚧir;櫰ot肻·Ƶusƀ;bd⣒ᤃ⣓戒Ā;uᴼ⣘;横ţ⣞⣡p;櫛ò−ðઁĀdp⣩⣮els;抧f;쀀𝕞Āct⣸⣽r;쀀𝓂pos»ᖝƀ;lm⤉⤊⤍䎼timap;抸ఀGLRVabcdefghijlmoprstuvw⥂⥓⥾⦉⦘⧚⧩⨕⨚⩘⩝⪃⪕⪤⪨⬄⬇⭄⭿⮮ⰴⱧⱼ⳩Āgt⥇⥋;쀀⋙̸Ā;v⥐௏쀀≫⃒ƀelt⥚⥲⥶ftĀar⥡⥧rrow;懍ightarrow;懎;쀀⋘̸Ā;v⥻ే쀀≪⃒ightarrow;懏ĀDd⦎⦓ash;抯ash;抮ʀbcnpt⦣⦧⦬⦱⧌la»˞ute;䅄g;쀀∠⃒ʀ;Eiop඄⦼⧀⧅⧈;쀀⩰̸d;쀀≋̸s;䅉roø඄urĀ;a⧓⧔普lĀ;s⧓ସǳ⧟\0⧣p肻 ଷmpĀ;e௹ఀʀaeouy⧴⧾⨃⨐⨓ǰ⧹\0⧻;橃on;䅈dil;䅆ngĀ;dൾ⨊ot;쀀⩭̸p;橂;䐽ash;怓΀;Aadqsxஒ⨩⨭⨻⩁⩅⩐rr;懗rĀhr⨳⨶k;椤Ā;oᏲᏰot;쀀≐̸uiöୣĀei⩊⩎ar;椨í஘istĀ;s஠டr;쀀𝔫ȀEest௅⩦⩹⩼ƀ;qs஼⩭௡ƀ;qs஼௅⩴lanô௢ií௪Ā;rஶ⪁»ஷƀAap⪊⪍⪑rò⥱rr;憮ar;櫲ƀ;svྍ⪜ྌĀ;d⪡⪢拼;拺cy;䑚΀AEadest⪷⪺⪾⫂⫅⫶⫹rò⥦;쀀≦̸rr;憚r;急Ȁ;fqs఻⫎⫣⫯tĀar⫔⫙rro÷⫁ightarro÷⪐ƀ;qs఻⪺⫪lanôౕĀ;sౕ⫴»శiíౝĀ;rవ⫾iĀ;eచథiäඐĀpt⬌⬑f;쀀𝕟膀¬;in⬙⬚⬶䂬nȀ;Edvஉ⬤⬨⬮;쀀⋹̸ot;쀀⋵̸ǡஉ⬳⬵;拷;拶iĀ;vಸ⬼ǡಸ⭁⭃;拾;拽ƀaor⭋⭣⭩rȀ;ast୻⭕⭚⭟lleì୻l;쀀⫽⃥;쀀∂̸lint;樔ƀ;ceಒ⭰⭳uåಥĀ;cಘ⭸Ā;eಒ⭽ñಘȀAait⮈⮋⮝⮧rò⦈rrƀ;cw⮔⮕⮙憛;쀀⤳̸;쀀↝̸ghtarrow»⮕riĀ;eೋೖ΀chimpqu⮽⯍⯙⬄୸⯤⯯Ȁ;cerല⯆ഷ⯉uå൅;쀀𝓃ortɭ⬅\0\0⯖ará⭖mĀ;e൮⯟Ā;q൴൳suĀbp⯫⯭å೸åഋƀbcp⯶ⰑⰙȀ;Ees⯿ⰀഢⰄ抄;쀀⫅̸etĀ;eഛⰋqĀ;qണⰀcĀ;eലⰗñസȀ;EesⰢⰣൟⰧ抅;쀀⫆̸etĀ;e൘ⰮqĀ;qൠⰣȀgilrⰽⰿⱅⱇìௗlde耻ñ䃱çృiangleĀlrⱒⱜeftĀ;eచⱚñదightĀ;eೋⱥñ೗Ā;mⱬⱭ䎽ƀ;esⱴⱵⱹ䀣ro;愖p;怇ҀDHadgilrsⲏⲔⲙⲞⲣⲰⲶⳓⳣash;抭arr;椄p;쀀≍⃒ash;抬ĀetⲨⲬ;쀀≥⃒;쀀>⃒nfin;槞ƀAetⲽⳁⳅrr;椂;쀀≤⃒Ā;rⳊⳍ쀀<⃒ie;쀀⊴⃒ĀAtⳘⳜrr;椃rie;쀀⊵⃒im;쀀∼⃒ƀAan⳰⳴ⴂrr;懖rĀhr⳺⳽k;椣Ā;oᏧᏥear;椧ቓ᪕\0\0\0\0\0\0\0\0\0\0\0\0\0ⴭ\0ⴸⵈⵠⵥ⵲ⶄᬇ\0\0ⶍⶫ\0ⷈⷎ\0ⷜ⸙⸫⸾⹃Ācsⴱ᪗ute耻ó䃳ĀiyⴼⵅrĀ;c᪞ⵂ耻ô䃴;䐾ʀabios᪠ⵒⵗǈⵚlac;䅑v;樸old;榼lig;䅓Ācr⵩⵭ir;榿;쀀𝔬ͯ⵹\0\0⵼\0ⶂn;䋛ave耻ò䃲;槁Ābmⶈ෴ar;榵Ȁacitⶕ⶘ⶥⶨrò᪀Āir⶝ⶠr;榾oss;榻nå๒;槀ƀaeiⶱⶵⶹcr;䅍ga;䏉ƀcdnⷀⷅǍron;䎿;榶pf;쀀𝕠ƀaelⷔ⷗ǒr;榷rp;榹΀;adiosvⷪⷫⷮ⸈⸍⸐⸖戨rò᪆Ȁ;efmⷷⷸ⸂⸅橝rĀ;oⷾⷿ愴f»ⷿ耻ª䂪耻º䂺gof;抶r;橖lope;橗;橛ƀclo⸟⸡⸧ò⸁ash耻ø䃸l;折iŬⸯ⸴de耻õ䃵esĀ;aǛ⸺s;樶ml耻ö䃶bar;挽ૡ⹞\0⹽\0⺀⺝\0⺢⺹\0\0⻋ຜ\0⼓\0\0⼫⾼\0⿈rȀ;astЃ⹧⹲຅脀¶;l⹭⹮䂶leìЃɩ⹸\0\0⹻m;櫳;櫽y;䐿rʀcimpt⺋⺏⺓ᡥ⺗nt;䀥od;䀮il;怰enk;怱r;쀀𝔭ƀimo⺨⺰⺴Ā;v⺭⺮䏆;䏕maô੶ne;明ƀ;tv⺿⻀⻈䏀chfork»´;䏖Āau⻏⻟nĀck⻕⻝kĀ;h⇴⻛;愎ö⇴sҀ;abcdemst⻳⻴ᤈ⻹⻽⼄⼆⼊⼎䀫cir;樣ir;樢Āouᵀ⼂;樥;橲n肻±ຝim;樦wo;樧ƀipu⼙⼠⼥ntint;樕f;쀀𝕡nd耻£䂣Ԁ;Eaceinosu່⼿⽁⽄⽇⾁⾉⾒⽾⾶;檳p;檷uå໙Ā;c໎⽌̀;acens່⽙⽟⽦⽨⽾pproø⽃urlyeñ໙ñ໎ƀaes⽯⽶⽺pprox;檹qq;檵im;拨iíໟmeĀ;s⾈ຮ怲ƀEas⽸⾐⽺ð⽵ƀdfp໬⾙⾯ƀals⾠⾥⾪lar;挮ine;挒urf;挓Ā;t໻⾴ï໻rel;抰Āci⿀⿅r;쀀𝓅;䏈ncsp;怈̀fiopsu⿚⋢⿟⿥⿫⿱r;쀀𝔮pf;쀀𝕢rime;恗cr;쀀𝓆ƀaeo⿸〉〓tĀei⿾々rnionóڰnt;樖stĀ;e【】䀿ñἙô༔઀ABHabcdefhilmnoprstux぀けさすムㄎㄫㅇㅢㅲㆎ㈆㈕㈤㈩㉘㉮㉲㊐㊰㊷ƀartぇおがròႳòϝail;検aròᱥar;楤΀cdenqrtとふへみわゔヌĀeuねぱ;쀀∽̱te;䅕iãᅮmptyv;榳gȀ;del࿑らるろ;榒;榥å࿑uo耻»䂻rր;abcfhlpstw࿜ガクシスゼゾダッデナp;極Ā;f࿠ゴs;椠;椳s;椞ë≝ð✮l;楅im;楴l;憣;憝Āaiパフil;椚oĀ;nホボ戶aló༞ƀabrョリヮrò៥rk;杳ĀakンヽcĀekヹ・;䁽;䁝Āes㄂㄄;榌lĀduㄊㄌ;榎;榐Ȁaeuyㄗㄜㄧㄩron;䅙Ādiㄡㄥil;䅗ì࿲âヺ;䑀Ȁclqsㄴㄷㄽㅄa;椷dhar;楩uoĀ;rȎȍh;憳ƀacgㅎㅟངlȀ;ipsླྀㅘㅛႜnåႻarôྩt;断ƀilrㅩဣㅮsht;楽;쀀𝔯ĀaoㅷㆆrĀduㅽㅿ»ѻĀ;l႑ㆄ;楬Ā;vㆋㆌ䏁;䏱ƀgns㆕ㇹㇼht̀ahlrstㆤㆰ㇂㇘㇤㇮rrowĀ;t࿜ㆭaéトarpoonĀduㆻㆿowîㅾp»႒eftĀah㇊㇐rrowó࿪arpoonóՑightarrows;應quigarro÷ニhreetimes;拌g;䋚ingdotseñἲƀahm㈍㈐㈓rò࿪aòՑ;怏oustĀ;a㈞㈟掱che»㈟mid;櫮Ȁabpt㈲㈽㉀㉒Ānr㈷㈺g;柭r;懾rëဃƀafl㉇㉊㉎r;榆;쀀𝕣us;樮imes;樵Āap㉝㉧rĀ;g㉣㉤䀩t;榔olint;樒arò㇣Ȁachq㉻㊀Ⴜ㊅quo;怺r;쀀𝓇Ābu・㊊oĀ;rȔȓƀhir㊗㊛㊠reåㇸmes;拊iȀ;efl㊪ၙᠡ㊫方tri;槎luhar;楨;愞ൡ㋕㋛㋟㌬㌸㍱\0㍺㎤\0\0㏬㏰\0㐨㑈㑚㒭㒱㓊㓱\0㘖\0\0㘳cute;䅛quï➺Ԁ;Eaceinpsyᇭ㋳㋵㋿㌂㌋㌏㌟㌦㌩;檴ǰ㋺\0㋼;檸on;䅡uåᇾĀ;dᇳ㌇il;䅟rc;䅝ƀEas㌖㌘㌛;檶p;檺im;择olint;樓iíሄ;䑁otƀ;be㌴ᵇ㌵担;橦΀Aacmstx㍆㍊㍗㍛㍞㍣㍭rr;懘rĀhr㍐㍒ë∨Ā;oਸ਼਴t耻§䂧i;䀻war;椩mĀin㍩ðnuóñt;朶rĀ;o㍶⁕쀀𝔰Ȁacoy㎂㎆㎑㎠rp;景Āhy㎋㎏cy;䑉;䑈rtɭ㎙\0\0㎜iäᑤaraì⹯耻­䂭Āgm㎨㎴maƀ;fv㎱㎲㎲䏃;䏂Ѐ;deglnprካ㏅㏉㏎㏖㏞㏡㏦ot;橪Ā;q኱ኰĀ;E㏓㏔檞;檠Ā;E㏛㏜檝;檟e;扆lus;樤arr;楲aròᄽȀaeit㏸㐈㐏㐗Āls㏽㐄lsetmé㍪hp;樳parsl;槤Ādlᑣ㐔e;挣Ā;e㐜㐝檪Ā;s㐢㐣檬;쀀⪬︀ƀflp㐮㐳㑂tcy;䑌Ā;b㐸㐹䀯Ā;a㐾㐿槄r;挿f;쀀𝕤aĀdr㑍ЂesĀ;u㑔㑕晠it»㑕ƀcsu㑠㑹㒟Āau㑥㑯pĀ;sᆈ㑫;쀀⊓︀pĀ;sᆴ㑵;쀀⊔︀uĀbp㑿㒏ƀ;esᆗᆜ㒆etĀ;eᆗ㒍ñᆝƀ;esᆨᆭ㒖etĀ;eᆨ㒝ñᆮƀ;afᅻ㒦ְrť㒫ֱ»ᅼaròᅈȀcemt㒹㒾㓂㓅r;쀀𝓈tmîñiì㐕aræᆾĀar㓎㓕rĀ;f㓔ឿ昆Āan㓚㓭ightĀep㓣㓪psiloîỠhé⺯s»⡒ʀbcmnp㓻㕞ሉ㖋㖎Ҁ;Edemnprs㔎㔏㔑㔕㔞㔣㔬㔱㔶抂;櫅ot;檽Ā;dᇚ㔚ot;櫃ult;櫁ĀEe㔨㔪;櫋;把lus;檿arr;楹ƀeiu㔽㕒㕕tƀ;en㔎㕅㕋qĀ;qᇚ㔏eqĀ;q㔫㔨m;櫇Ābp㕚㕜;櫕;櫓c̀;acensᇭ㕬㕲㕹㕻㌦pproø㋺urlyeñᇾñᇳƀaes㖂㖈㌛pproø㌚qñ㌗g;晪ڀ123;Edehlmnps㖩㖬㖯ሜ㖲㖴㗀㗉㗕㗚㗟㗨㗭耻¹䂹耻²䂲耻³䂳;櫆Āos㖹㖼t;檾ub;櫘Ā;dሢ㗅ot;櫄sĀou㗏㗒l;柉b;櫗arr;楻ult;櫂ĀEe㗤㗦;櫌;抋lus;櫀ƀeiu㗴㘉㘌tƀ;enሜ㗼㘂qĀ;qሢ㖲eqĀ;q㗧㗤m;櫈Ābp㘑㘓;櫔;櫖ƀAan㘜㘠㘭rr;懙rĀhr㘦㘨ë∮Ā;oਫ਩war;椪lig耻ß䃟௡㙑㙝㙠ዎ㙳㙹\0㙾㛂\0\0\0\0\0㛛㜃\0㜉㝬\0\0\0㞇ɲ㙖\0\0㙛get;挖;䏄rë๟ƀaey㙦㙫㙰ron;䅥dil;䅣;䑂lrec;挕r;쀀𝔱Ȁeiko㚆㚝㚵㚼ǲ㚋\0㚑eĀ4fኄኁaƀ;sv㚘㚙㚛䎸ym;䏑Ācn㚢㚲kĀas㚨㚮pproø዁im»ኬsðኞĀas㚺㚮ð዁rn耻þ䃾Ǭ̟㛆⋧es膀×;bd㛏㛐㛘䃗Ā;aᤏ㛕r;樱;樰ƀeps㛡㛣㜀á⩍Ȁ;bcf҆㛬㛰㛴ot;挶ir;櫱Ā;o㛹㛼쀀𝕥rk;櫚á㍢rime;怴ƀaip㜏㜒㝤dåቈ΀adempst㜡㝍㝀㝑㝗㝜㝟ngleʀ;dlqr㜰㜱㜶㝀㝂斵own»ᶻeftĀ;e⠀㜾ñम;扜ightĀ;e㊪㝋ñၚot;旬inus;樺lus;樹b;槍ime;樻ezium;揢ƀcht㝲㝽㞁Āry㝷㝻;쀀𝓉;䑆cy;䑛rok;䅧Āio㞋㞎xô᝷headĀlr㞗㞠eftarro÷ࡏightarrow»ཝऀAHabcdfghlmoprstuw㟐㟓㟗㟤㟰㟼㠎㠜㠣㠴㡑㡝㡫㢩㣌㣒㣪㣶ròϭar;楣Ācr㟜㟢ute耻ú䃺òᅐrǣ㟪\0㟭y;䑞ve;䅭Āiy㟵㟺rc耻û䃻;䑃ƀabh㠃㠆㠋ròᎭlac;䅱aòᏃĀir㠓㠘sht;楾;쀀𝔲rave耻ù䃹š㠧㠱rĀlr㠬㠮»ॗ»ႃlk;斀Āct㠹㡍ɯ㠿\0\0㡊rnĀ;e㡅㡆挜r»㡆op;挏ri;旸Āal㡖㡚cr;䅫肻¨͉Āgp㡢㡦on;䅳f;쀀𝕦̀adhlsuᅋ㡸㡽፲㢑㢠ownáᎳarpoonĀlr㢈㢌efô㠭ighô㠯iƀ;hl㢙㢚㢜䏅»ᏺon»㢚parrows;懈ƀcit㢰㣄㣈ɯ㢶\0\0㣁rnĀ;e㢼㢽挝r»㢽op;挎ng;䅯ri;旹cr;쀀𝓊ƀdir㣙㣝㣢ot;拰lde;䅩iĀ;f㜰㣨»᠓Āam㣯㣲rò㢨l耻ü䃼angle;榧ހABDacdeflnoprsz㤜㤟㤩㤭㦵㦸㦽㧟㧤㧨㧳㧹㧽㨁㨠ròϷarĀ;v㤦㤧櫨;櫩asèϡĀnr㤲㤷grt;榜΀eknprst㓣㥆㥋㥒㥝㥤㦖appá␕othinçẖƀhir㓫⻈㥙opô⾵Ā;hᎷ㥢ïㆍĀiu㥩㥭gmá㎳Ābp㥲㦄setneqĀ;q㥽㦀쀀⊊︀;쀀⫋︀setneqĀ;q㦏㦒쀀⊋︀;쀀⫌︀Āhr㦛㦟etá㚜iangleĀlr㦪㦯eft»थight»ၑy;䐲ash»ံƀelr㧄㧒㧗ƀ;beⷪ㧋㧏ar;抻q;扚lip;拮Ābt㧜ᑨaòᑩr;쀀𝔳tré㦮suĀbp㧯㧱»ജ»൙pf;쀀𝕧roð໻tré㦴Ācu㨆㨋r;쀀𝓋Ābp㨐㨘nĀEe㦀㨖»㥾nĀEe㦒㨞»㦐igzag;榚΀cefoprs㨶㨻㩖㩛㩔㩡㩪irc;䅵Ādi㩀㩑Ābg㩅㩉ar;機eĀ;qᗺ㩏;扙erp;愘r;쀀𝔴pf;쀀𝕨Ā;eᑹ㩦atèᑹcr;쀀𝓌ૣណ㪇\0㪋\0㪐㪛\0\0㪝㪨㪫㪯\0\0㫃㫎\0㫘ៜ៟tré៑r;쀀𝔵ĀAa㪔㪗ròσrò৶;䎾ĀAa㪡㪤ròθrò৫að✓is;拻ƀdptឤ㪵㪾Āfl㪺ឩ;쀀𝕩imåឲĀAa㫇㫊ròώròਁĀcq㫒ីr;쀀𝓍Āpt៖㫜ré។Ѐacefiosu㫰㫽㬈㬌㬑㬕㬛㬡cĀuy㫶㫻te耻ý䃽;䑏Āiy㬂㬆rc;䅷;䑋n耻¥䂥r;쀀𝔶cy;䑗pf;쀀𝕪cr;쀀𝓎Ācm㬦㬩y;䑎l耻ÿ䃿Ԁacdefhiosw㭂㭈㭔㭘㭤㭩㭭㭴㭺㮀cute;䅺Āay㭍㭒ron;䅾;䐷ot;䅼Āet㭝㭡træᕟa;䎶r;쀀𝔷cy;䐶grarr;懝pf;쀀𝕫cr;쀀𝓏Ājn㮅㮇;怍j;怌'
			.split("")
			.map((u) => u.charCodeAt(0))
	),
	k0 = new Uint16Array(
		"Ȁaglq	\x1Bɭ\0\0p;䀦os;䀧t;䀾t;䀼uot;䀢"
			.split("")
			.map((u) => u.charCodeAt(0))
	);
var Fu;
const g0 = new Map([
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
	y0 =
		(Fu = String.fromCodePoint) !== null && Fu !== void 0
			? Fu
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
function C0(u) {
	var e;
	return (u >= 55296 && u <= 57343) || u > 1114111
		? 65533
		: (e = g0.get(u)) !== null && e !== void 0
		? e
		: u;
}
var I;
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
})(I || (I = {}));
const A0 = 32;
var Y;
(function (u) {
	(u[(u.VALUE_LENGTH = 49152)] = "VALUE_LENGTH"),
		(u[(u.BRANCH_LENGTH = 16256)] = "BRANCH_LENGTH"),
		(u[(u.JUMP_TABLE = 127)] = "JUMP_TABLE");
})(Y || (Y = {}));
function Nu(u) {
	return u >= I.ZERO && u <= I.NINE;
}
function E0(u) {
	return (
		(u >= I.UPPER_A && u <= I.UPPER_F) || (u >= I.LOWER_A && u <= I.LOWER_F)
	);
}
function w0(u) {
	return (
		(u >= I.UPPER_A && u <= I.UPPER_Z) ||
		(u >= I.LOWER_A && u <= I.LOWER_Z) ||
		Nu(u)
	);
}
function D0(u) {
	return u === I.EQUALS || w0(u);
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
class v0 {
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
				return e.charCodeAt(t) === I.NUM
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
			: (e.charCodeAt(t) | A0) === I.LOWER_X
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
			if (Nu(c) || E0(c)) t += 1;
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
		if (e === I.SEMI) this.consumed += 1;
		else if (this.decodeMode === J.Strict) return 0;
		return (
			this.emitCodePoint(C0(this.result), this.consumed),
			this.errors &&
				(e !== I.SEMI &&
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
				((this.treeIndex = F0(
					n,
					c,
					this.treeIndex + Math.max(1, r),
					i
				)),
				this.treeIndex < 0)
			)
				return this.result === 0 ||
					(this.decodeMode === J.Attribute && (r === 0 || D0(i)))
					? 0
					: this.emitNotTerminatedNamedEntity();
			if (
				((c = n[this.treeIndex]),
				(r = (c & Y.VALUE_LENGTH) >> 14),
				r !== 0)
			) {
				if (i === I.SEMI)
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
function ge(u) {
	let e = "";
	const t = new v0(u, (n) => (e += y0(n)));
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
function F0(u, e, t, n) {
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
const S0 = ge(x0);
ge(k0);
function ye(u, e = J.Legacy) {
	return S0(u, e);
}
function z0(u) {
	return Object.prototype.toString.call(u);
}
function ju(u) {
	return z0(u) === "[object String]";
}
const q0 = Object.prototype.hasOwnProperty;
function T0(u, e) {
	return q0.call(u, e);
}
function Cu(u) {
	return (
		Array.prototype.slice.call(arguments, 1).forEach(function (t) {
			if (t) {
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
function Ce(u, e, t) {
	return [].concat(u.slice(0, e), t, u.slice(e + 1));
}
function Uu(u) {
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
const Ae = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g,
	I0 = /&([a-z#][a-z0-9]{1,31});/gi,
	M0 = new RegExp(Ae.source + "|" + I0.source, "gi"),
	N0 = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))$/i;
function L0(u, e) {
	if (e.charCodeAt(0) === 35 && N0.test(e)) {
		const n =
			e[1].toLowerCase() === "x"
				? parseInt(e.slice(2), 16)
				: parseInt(e.slice(1), 10);
		return Uu(n) ? gu(n) : u;
	}
	const t = ye(u);
	return t !== u ? t : u;
}
function R0(u) {
	return u.indexOf("\\") < 0 ? u : u.replace(Ae, "$1");
}
function iu(u) {
	return u.indexOf("\\") < 0 && u.indexOf("&") < 0
		? u
		: u.replace(M0, function (e, t, n) {
				return t || L0(e, n);
		  });
}
const P0 = /[&<>"]/,
	B0 = /[&<>"]/g,
	$0 = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function O0(u) {
	return $0[u];
}
function X(u) {
	return P0.test(u) ? u.replace(B0, O0) : u;
}
const j0 = /[.?*+^$[\]\\(){}|-]/g;
function U0(u) {
	return u.replace(j0, "\\$&");
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
	return Ou.test(u);
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
		"ẞ".toLowerCase() === "Ṿ" && (u = u.replace(/ẞ/g, "ß")),
		u.toLowerCase().toUpperCase()
	);
}
const Z0 = { mdurl: p0, ucmicro: m0 },
	H0 = Object.freeze(
		Object.defineProperty(
			{
				__proto__: null,
				arrayReplaceAt: Ce,
				assign: Cu,
				escapeHtml: X,
				escapeRE: U0,
				fromCodePoint: gu,
				has: T0,
				isMdAsciiPunct: lu,
				isPunctChar: su,
				isSpace: S,
				isString: ju,
				isValidEntityCode: Uu,
				isWhiteSpace: au,
				lib: Z0,
				normalizeReference: Au,
				unescapeAll: iu,
				unescapeMd: R0,
			},
			Symbol.toStringTag,
			{ value: "Module" }
		)
	);
function V0(u, e, t) {
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
function G0(u, e, t) {
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
function Q0(u, e, t) {
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
const W0 = Object.freeze(
		Object.defineProperty(
			{
				__proto__: null,
				parseLinkDestination: G0,
				parseLinkLabel: V0,
				parseLinkTitle: Q0,
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
	this.rules = Cu({}, G);
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
function R() {
	(this.__rules__ = []), (this.__cache__ = null);
}
R.prototype.__find__ = function (u) {
	for (let e = 0; e < this.__rules__.length; e++)
		if (this.__rules__[e].name === u) return e;
	return -1;
};
R.prototype.__compile__ = function () {
	const u = this,
		e = [""];
	u.__rules__.forEach(function (t) {
		t.enabled &&
			t.alt.forEach(function (n) {
				e.indexOf(n) < 0 && e.push(n);
			});
	}),
		(u.__cache__ = {}),
		e.forEach(function (t) {
			(u.__cache__[t] = []),
				u.__rules__.forEach(function (n) {
					n.enabled &&
						((t && n.alt.indexOf(t) < 0) ||
							u.__cache__[t].push(n.fn));
				});
		});
};
R.prototype.at = function (u, e, t) {
	const n = this.__find__(u),
		c = t || {};
	if (n === -1) throw new Error("Parser rule not found: " + u);
	(this.__rules__[n].fn = e),
		(this.__rules__[n].alt = c.alt || []),
		(this.__cache__ = null);
};
R.prototype.before = function (u, e, t, n) {
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
R.prototype.after = function (u, e, t, n) {
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
R.prototype.push = function (u, e, t) {
	const n = t || {};
	this.__rules__.push({ name: u, enabled: !0, fn: e, alt: n.alt || [] }),
		(this.__cache__ = null);
};
R.prototype.enable = function (u, e) {
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
R.prototype.enableOnly = function (u, e) {
	Array.isArray(u) || (u = [u]),
		this.__rules__.forEach(function (t) {
			t.enabled = !1;
		}),
		this.enable(u, e);
};
R.prototype.disable = function (u, e) {
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
R.prototype.getRules = function (u) {
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
function Ee(u, e, t) {
	(this.src = u),
		(this.env = t),
		(this.tokens = []),
		(this.inlineMode = !1),
		(this.md = e);
}
Ee.prototype.Token = j;
const J0 = /\r\n?|\n/g,
	Y0 = /\0/g;
function X0(u) {
	let e;
	(e = u.src.replace(
		J0,
		`
`
	)),
		(e = e.replace(Y0, "�")),
		(u.src = e);
}
function K0(u) {
	let e;
	u.inlineMode
		? ((e = new u.Token("inline", "", 0)),
		  (e.content = u.src),
		  (e.map = [0, 1]),
		  (e.children = []),
		  u.tokens.push(e))
		: u.md.block.parse(u.src, u.md, u.env, u.tokens);
}
function ut(u) {
	const e = u.tokens;
	for (let t = 0, n = e.length; t < n; t++) {
		const c = e[t];
		c.type === "inline" &&
			u.md.inline.parse(c.content, u.md, u.env, c.children);
	}
}
function et(u) {
	return /^<a[>\s]/i.test(u);
}
function tt(u) {
	return /^<\/a\s*>/i.test(u);
}
function rt(u) {
	const e = u.tokens;
	if (u.md.options.linkify)
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
						(et(o.content) && r > 0 && r--, tt(o.content) && r++),
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
							_ = u.md.normalizeLink(d);
						if (!u.md.validateLink(_)) continue;
						let y = s[h].text;
						s[h].schema
							? s[h].schema === "mailto:" && !/^mailto:/i.test(y)
								? (y = u.md
										.normalizeLinkText("mailto:" + y)
										.replace(/^mailto:/, ""))
								: (y = u.md.normalizeLinkText(y))
							: (y = u.md
									.normalizeLinkText("http://" + y)
									.replace(/^http:\/\//, ""));
						const D = s[h].index;
						if (D > p) {
							const m = new u.Token("text", "", 0);
							(m.content = a.slice(p, D)),
								(m.level = f),
								l.push(m);
						}
						const A = new u.Token("link_open", "a", 1);
						(A.attrs = [["href", _]]),
							(A.level = f++),
							(A.markup = "linkify"),
							(A.info = "auto"),
							l.push(A);
						const k = new u.Token("text", "", 0);
						(k.content = y), (k.level = f), l.push(k);
						const w = new u.Token("link_close", "a", -1);
						(w.level = --f),
							(w.markup = "linkify"),
							(w.info = "auto"),
							l.push(w),
							(p = s[h].lastIndex);
					}
					if (p < a.length) {
						const h = new u.Token("text", "", 0);
						(h.content = a.slice(p)), (h.level = f), l.push(h);
					}
					e[t].children = c = Ce(c, i, l);
				}
			}
		}
}
const we = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/,
	nt = /\((c|tm|r)\)/i,
	ct = /\((c|tm|r)\)/gi,
	ot = { c: "©", r: "®", tm: "™" };
function it(u, e) {
	return ot[e.toLowerCase()];
}
function at(u) {
	let e = 0;
	for (let t = u.length - 1; t >= 0; t--) {
		const n = u[t];
		n.type === "text" && !e && (n.content = n.content.replace(ct, it)),
			n.type === "link_open" && n.info === "auto" && e--,
			n.type === "link_close" && n.info === "auto" && e++;
	}
}
function st(u) {
	let e = 0;
	for (let t = u.length - 1; t >= 0; t--) {
		const n = u[t];
		n.type === "text" &&
			!e &&
			we.test(n.content) &&
			(n.content = n.content
				.replace(/\+-/g, "±")
				.replace(/\.{2,}/g, "…")
				.replace(/([?!])…/g, "$1..")
				.replace(/([?!]){4,}/g, "$1$1$1")
				.replace(/,{2,}/g, ",")
				.replace(/(^|[^-])---(?=[^-]|$)/gm, "$1—")
				.replace(/(^|\s)--(?=\s|$)/gm, "$1–")
				.replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, "$1–")),
			n.type === "link_open" && n.info === "auto" && e--,
			n.type === "link_close" && n.info === "auto" && e++;
	}
}
function lt(u) {
	let e;
	if (u.md.options.typographer)
		for (e = u.tokens.length - 1; e >= 0; e--)
			u.tokens[e].type === "inline" &&
				(nt.test(u.tokens[e].content) && at(u.tokens[e].children),
				we.test(u.tokens[e].content) && st(u.tokens[e].children));
}
const ft = /['"]/,
	re = /['"]/g,
	ne = "’";
function mu(u, e, t) {
	return u.slice(0, e) + t + u.slice(e + 1);
}
function dt(u, e) {
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
			re.lastIndex = a;
			const l = re.exec(o);
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
					if (u[t].content) {
						d = u[t].content.charCodeAt(u[t].content.length - 1);
						break;
					}
			let _ = 32;
			if (a < s) _ = o.charCodeAt(a);
			else
				for (
					t = c + 1;
					t < u.length &&
					!(u[t].type === "softbreak" || u[t].type === "hardbreak");
					t++
				)
					if (u[t].content) {
						_ = u[t].content.charCodeAt(0);
						break;
					}
			const y = lu(d) || su(String.fromCharCode(d)),
				D = lu(_) || su(String.fromCharCode(_)),
				A = au(d),
				k = au(_);
			if (
				(k ? (f = !1) : D && (A || y || (f = !1)),
				A ? (p = !1) : y && (k || D || (p = !1)),
				_ === 34 && l[0] === '"' && d >= 48 && d <= 57 && (p = f = !1),
				f && p && ((f = y), (p = D)),
				!f && !p)
			) {
				h && (r.content = mu(r.content, l.index, ne));
				continue;
			}
			if (p)
				for (t = n.length - 1; t >= 0; t--) {
					let w = n[t];
					if (n[t].level < i) break;
					if (w.single === h && n[t].level === i) {
						w = n[t];
						let m, x;
						h
							? ((m = e.md.options.quotes[2]),
							  (x = e.md.options.quotes[3]))
							: ((m = e.md.options.quotes[0]),
							  (x = e.md.options.quotes[1])),
							(r.content = mu(r.content, l.index, x)),
							(u[w.token].content = mu(
								u[w.token].content,
								w.pos,
								m
							)),
							(a += x.length - 1),
							w.token === c && (a += m.length - 1),
							(o = r.content),
							(s = o.length),
							(n.length = t);
						continue u;
					}
				}
			f
				? n.push({ token: c, pos: l.index, single: h, level: i })
				: p && h && (r.content = mu(r.content, l.index, ne));
		}
	}
}
function ht(u) {
	if (u.md.options.typographer)
		for (let e = u.tokens.length - 1; e >= 0; e--)
			u.tokens[e].type !== "inline" ||
				!ft.test(u.tokens[e].content) ||
				dt(u.tokens[e].children, u);
}
function bt(u) {
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
const Su = [
	["normalize", X0],
	["block", K0],
	["inline", ut],
	["linkify", rt],
	["replacements", lt],
	["smartquotes", ht],
	["text_join", bt],
];
function Zu() {
	this.ruler = new R();
	for (let u = 0; u < Su.length; u++) this.ruler.push(Su[u][0], Su[u][1]);
}
Zu.prototype.process = function (u) {
	const e = this.ruler.getRules("");
	for (let t = 0, n = e.length; t < n; t++) e[t](u);
};
Zu.prototype.State = Ee;
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
function zu(u, e) {
	const t = u.bMarks[e] + u.tShift[e],
		n = u.eMarks[e];
	return u.src.slice(t, n);
}
function ce(u) {
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
function pt(u, e, t, n) {
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
		const k = u.src.charCodeAt(r);
		if (k !== 124 && k !== 45 && k !== 58 && !S(k)) return !1;
		r++;
	}
	let a = zu(u, e + 1),
		s = a.split("|");
	const l = [];
	for (let k = 0; k < s.length; k++) {
		const w = s[k].trim();
		if (!w) {
			if (k === 0 || k === s.length - 1) continue;
			return !1;
		}
		if (!/^:?-+:?$/.test(w)) return !1;
		w.charCodeAt(w.length - 1) === 58
			? l.push(w.charCodeAt(0) === 58 ? "center" : "right")
			: w.charCodeAt(0) === 58
			? l.push("left")
			: l.push("");
	}
	if (
		((a = zu(u, e).trim()),
		a.indexOf("|") === -1 || u.sCount[e] - u.blkIndent >= 4)
	)
		return !1;
	(s = ce(a)),
		s.length && s[0] === "" && s.shift(),
		s.length && s[s.length - 1] === "" && s.pop();
	const f = s.length;
	if (f === 0 || f !== l.length) return !1;
	if (n) return !0;
	const p = u.parentType;
	u.parentType = "table";
	const h = u.md.block.ruler.getRules("blockquote"),
		d = u.push("table_open", "table", 1),
		_ = [e, 0];
	d.map = _;
	const y = u.push("thead_open", "thead", 1);
	y.map = [e, e + 1];
	const D = u.push("tr_open", "tr", 1);
	D.map = [e, e + 1];
	for (let k = 0; k < s.length; k++) {
		const w = u.push("th_open", "th", 1);
		l[k] && (w.attrs = [["style", "text-align:" + l[k]]]);
		const m = u.push("inline", "", 0);
		(m.content = s[k].trim()),
			(m.children = []),
			u.push("th_close", "th", -1);
	}
	u.push("tr_close", "tr", -1), u.push("thead_close", "thead", -1);
	let A;
	for (c = e + 2; c < t && !(u.sCount[c] < u.blkIndent); c++) {
		let k = !1;
		for (let m = 0, x = h.length; m < x; m++)
			if (h[m](u, c, t, !0)) {
				k = !0;
				break;
			}
		if (k || ((a = zu(u, c).trim()), !a) || u.sCount[c] - u.blkIndent >= 4)
			break;
		if (
			((s = ce(a)),
			s.length && s[0] === "" && s.shift(),
			s.length && s[s.length - 1] === "" && s.pop(),
			c === e + 2)
		) {
			const m = u.push("tbody_open", "tbody", 1);
			m.map = A = [e + 2, 0];
		}
		const w = u.push("tr_open", "tr", 1);
		w.map = [c, c + 1];
		for (let m = 0; m < f; m++) {
			const x = u.push("td_open", "td", 1);
			l[m] && (x.attrs = [["style", "text-align:" + l[m]]]);
			const v = u.push("inline", "", 0);
			(v.content = s[m] ? s[m].trim() : ""),
				(v.children = []),
				u.push("td_close", "td", -1);
		}
		u.push("tr_close", "tr", -1);
	}
	return (
		A && (u.push("tbody_close", "tbody", -1), (A[1] = c)),
		u.push("table_close", "table", -1),
		(_[1] = c),
		(u.parentType = p),
		(u.line = c),
		!0
	);
}
function _t(u, e, t) {
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
function mt(u, e, t, n) {
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
function xt(u, e, t, n) {
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
		const k = u.sCount[d] < u.blkIndent;
		if (((c = u.bMarks[d] + u.tShift[d]), (r = u.eMarks[d]), c >= r)) break;
		if (u.src.charCodeAt(c++) === 62 && !k) {
			let m = u.sCount[d] + 1,
				x,
				v;
			u.src.charCodeAt(c) === 32
				? (c++, m++, (v = !1), (x = !0))
				: u.src.charCodeAt(c) === 9
				? ((x = !0),
				  (u.bsCount[d] + m) % 4 === 3
						? (c++, m++, (v = !1))
						: (v = !0))
				: (x = !1);
			let q = m;
			for (o.push(u.bMarks[d]), u.bMarks[d] = c; c < r; ) {
				const N = u.src.charCodeAt(c);
				if (S(N))
					N === 9
						? (q += 4 - ((q + u.bsCount[d] + (v ? 1 : 0)) % 4))
						: q++;
				else break;
				c++;
			}
			(h = c >= r),
				a.push(u.bsCount[d]),
				(u.bsCount[d] = u.sCount[d] + 1 + (x ? 1 : 0)),
				s.push(u.sCount[d]),
				(u.sCount[d] = q - m),
				l.push(u.tShift[d]),
				(u.tShift[d] = c - u.bMarks[d]);
			continue;
		}
		if (h) break;
		let w = !1;
		for (let m = 0, x = f.length; m < x; m++)
			if (f[m](u, d, t, !0)) {
				w = !0;
				break;
			}
		if (w) {
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
	const _ = u.blkIndent;
	u.blkIndent = 0;
	const y = u.push("blockquote_open", "blockquote", 1);
	y.markup = ">";
	const D = [e, 0];
	(y.map = D), u.md.block.tokenize(u, e, d);
	const A = u.push("blockquote_close", "blockquote", -1);
	(A.markup = ">"), (u.lineMax = i), (u.parentType = p), (D[1] = u.line);
	for (let k = 0; k < l.length; k++)
		(u.bMarks[k + e] = o[k]),
			(u.tShift[k + e] = l[k]),
			(u.sCount[k + e] = s[k]),
			(u.bsCount[k + e] = a[k]);
	return (u.blkIndent = _), !0;
}
function kt(u, e, t, n) {
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
function oe(u, e) {
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
function ie(u, e) {
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
function gt(u, e) {
	const t = u.level + 2;
	for (let n = e + 2, c = u.tokens.length - 2; n < c; n++)
		u.tokens[n].level === t &&
			u.tokens[n].type === "paragraph_open" &&
			((u.tokens[n + 2].hidden = !0),
			(u.tokens[n].hidden = !0),
			(n += 2));
}
function yt(u, e, t, n) {
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
	if ((h = ie(u, a)) >= 0) {
		if (
			((f = !0),
			(i = u.bMarks[a] + u.tShift[a]),
			(p = Number(u.src.slice(i, h - 1))),
			l && p !== 1)
		)
			return !1;
	} else if ((h = oe(u, a)) >= 0) f = !1;
	else return !1;
	if (l && u.skipSpaces(h) >= u.eMarks[a]) return !1;
	if (n) return !0;
	const d = u.src.charCodeAt(h - 1),
		_ = u.tokens.length;
	f
		? ((o = u.push("ordered_list_open", "ol", 1)),
		  p !== 1 && (o.attrs = [["start", p]]))
		: (o = u.push("bullet_list_open", "ul", 1));
	const y = [a, 0];
	(o.map = y), (o.markup = String.fromCharCode(d));
	let D = !1;
	const A = u.md.block.ruler.getRules("list"),
		k = u.parentType;
	for (u.parentType = "list"; a < t; ) {
		(r = h), (c = u.eMarks[a]);
		const w = u.sCount[a] + h - (u.bMarks[a] + u.tShift[a]);
		let m = w;
		for (; r < c; ) {
			const O = u.src.charCodeAt(r);
			if (O === 9) m += 4 - ((m + u.bsCount[a]) % 4);
			else if (O === 32) m++;
			else break;
			r++;
		}
		const x = r;
		let v;
		x >= c ? (v = 1) : (v = m - w), v > 4 && (v = 1);
		const q = w + v;
		(o = u.push("list_item_open", "li", 1)),
			(o.markup = String.fromCharCode(d));
		const N = [a, 0];
		(o.map = N), f && (o.info = u.src.slice(i, h - 1));
		const pu = u.tight,
			_u = u.tShift[a],
			nu = u.sCount[a],
			Du = u.listIndent;
		if (
			((u.listIndent = u.blkIndent),
			(u.blkIndent = q),
			(u.tight = !0),
			(u.tShift[a] = x - u.bMarks[a]),
			(u.sCount[a] = m),
			x >= c && u.isEmpty(a + 1)
				? (u.line = Math.min(u.line + 2, t))
				: u.md.block.tokenize(u, a, t, !0),
			(!u.tight || D) && (s = !1),
			(D = u.line - a > 1 && u.isEmpty(u.line - 1)),
			(u.blkIndent = u.listIndent),
			(u.listIndent = Du),
			(u.tShift[a] = _u),
			(u.sCount[a] = nu),
			(u.tight = pu),
			(o = u.push("list_item_close", "li", -1)),
			(o.markup = String.fromCharCode(d)),
			(a = u.line),
			(N[1] = a),
			a >= t ||
				u.sCount[a] < u.blkIndent ||
				u.sCount[a] - u.blkIndent >= 4)
		)
			break;
		let L = !1;
		for (let O = 0, vu = A.length; O < vu; O++)
			if (A[O](u, a, t, !0)) {
				L = !0;
				break;
			}
		if (L) break;
		if (f) {
			if (((h = ie(u, a)), h < 0)) break;
			i = u.bMarks[a] + u.tShift[a];
		} else if (((h = oe(u, a)), h < 0)) break;
		if (d !== u.src.charCodeAt(h - 1)) break;
	}
	return (
		f
			? (o = u.push("ordered_list_close", "ol", -1))
			: (o = u.push("bullet_list_close", "ul", -1)),
		(o.markup = String.fromCharCode(d)),
		(y[1] = a),
		(u.line = a),
		(u.parentType = k),
		s && gt(u, _),
		!0
	);
}
function Ct(u, e, t, n) {
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
		let m = !1;
		for (let x = 0, v = s.length; x < v; x++)
			if (s[x](u, o, a, !0)) {
				m = !0;
				break;
			}
		if (m) break;
	}
	const f = u.getLines(e, o, u.blkIndent, !1).trim();
	i = f.length;
	let p = -1;
	for (r = 1; r < i; r++) {
		const m = f.charCodeAt(r);
		if (m === 91) return !1;
		if (m === 93) {
			p = r;
			break;
		} else
			m === 10
				? c++
				: m === 92 && (r++, r < i && f.charCodeAt(r) === 10 && c++);
	}
	if (p < 0 || f.charCodeAt(p + 1) !== 58) return !1;
	for (r = p + 2; r < i; r++) {
		const m = f.charCodeAt(r);
		if (m === 10) c++;
		else if (!S(m)) break;
	}
	const h = u.md.helpers.parseLinkDestination(f, r, i);
	if (!h.ok) return !1;
	const d = u.md.normalizeLink(h.str);
	if (!u.md.validateLink(d)) return !1;
	(r = h.pos), (c += h.lines);
	const _ = r,
		y = c,
		D = r;
	for (; r < i; r++) {
		const m = f.charCodeAt(r);
		if (m === 10) c++;
		else if (!S(m)) break;
	}
	const A = u.md.helpers.parseLinkTitle(f, r, i);
	let k;
	for (
		r < i && D !== r && A.ok
			? ((k = A.str), (r = A.pos), (c += A.lines))
			: ((k = ""), (r = _), (c = y));
		r < i;

	) {
		const m = f.charCodeAt(r);
		if (!S(m)) break;
		r++;
	}
	if (r < i && f.charCodeAt(r) !== 10 && k)
		for (k = "", r = _, c = y; r < i; ) {
			const m = f.charCodeAt(r);
			if (!S(m)) break;
			r++;
		}
	if (r < i && f.charCodeAt(r) !== 10) return !1;
	const w = Au(f.slice(1, p));
	return w
		? (n ||
				(typeof u.env.references == "undefined" &&
					(u.env.references = {}),
				typeof u.env.references[w] == "undefined" &&
					(u.env.references[w] = { title: k, href: d }),
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
	wt = "[^\"'=<>`\\x00-\\x20]+",
	Dt = "'[^']*'",
	vt = '"[^"]*"',
	Ft = "(?:" + wt + "|" + Dt + "|" + vt + ")",
	St = "(?:\\s+" + Et + "(?:\\s*=\\s*" + Ft + ")?)",
	De = "<[A-Za-z][A-Za-z0-9\\-]*" + St + "*\\s*\\/?>",
	ve = "<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>",
	zt = "<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->",
	qt = "<[?][\\s\\S]*?[?]>",
	Tt = "<![A-Z]+\\s+[^>]*>",
	It = "<!\\[CDATA\\[[\\s\\S]*?\\]\\]>",
	Mt = new RegExp(
		"^(?:" + De + "|" + ve + "|" + zt + "|" + qt + "|" + Tt + "|" + It + ")"
	),
	Nt = new RegExp("^(?:" + De + "|" + ve + ")"),
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
function Bt(u, e, t) {
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
	["table", pt, ["paragraph", "reference"]],
	["code", _t],
	["fence", mt, ["paragraph", "reference", "blockquote", "list"]],
	["blockquote", xt, ["paragraph", "reference", "blockquote", "list"]],
	["hr", kt, ["paragraph", "reference", "blockquote", "list"]],
	["list", yt, ["paragraph", "reference", "blockquote"]],
	["reference", Ct],
	["html_block", Lt, ["paragraph", "reference", "blockquote"]],
	["heading", Rt, ["paragraph", "reference", "blockquote"]],
	["lheading", Pt],
	["paragraph", Bt],
];
function Eu() {
	this.ruler = new R();
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
		_ = au(f);
	return (
		_ ? (c = !1) : h && (d || p || (c = !1)),
		d ? (r = !1) : p && (_ || h || (r = !1)),
		e ? ((t = c), (n = r)) : ((t = c && (!r || p)), (n = r && (!c || h))),
		{ can_open: t, can_close: n, length: l }
	);
};
hu.prototype.Token = j;
function $t(u) {
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
function Ot(u, e) {
	let t = u.pos;
	for (; t < u.posMax && !$t(u.src.charCodeAt(t)); ) t++;
	return t === u.pos
		? !1
		: (e || (u.pending += u.src.slice(u.pos, t)), (u.pos = t), !0);
}
const jt = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i;
function Ut(u, e) {
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
	const c = u.pending.match(jt);
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
function Zt(u, e) {
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
const Hu = [];
for (let u = 0; u < 256; u++) Hu.push(0);
"\\!\"#$%&'()*+,./:;<=>?@[]^_`{|}~-".split("").forEach(function (u) {
	Hu[u.charCodeAt(0)] = 1;
});
function Ht(u, e) {
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
		c < 256 && Hu[c] !== 0 ? (o.content = r) : (o.content = i),
			(o.markup = i),
			(o.info = "escape");
	}
	return (u.pos = t + 1), !0;
}
function Vt(u, e) {
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
function Gt(u, e) {
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
function ae(u, e) {
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
function Qt(u) {
	const e = u.tokens_meta,
		t = u.tokens_meta.length;
	ae(u, u.delimiters);
	for (let n = 0; n < t; n++)
		e[n] && e[n].delimiters && ae(u, e[n].delimiters);
}
const Fe = { tokenize: Gt, postProcess: Qt };
function Wt(u, e) {
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
function se(u, e) {
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
function Jt(u) {
	const e = u.tokens_meta,
		t = u.tokens_meta.length;
	se(u, u.delimiters);
	for (let n = 0; n < t; n++)
		e[n] && e[n].delimiters && se(u, e[n].delimiters);
}
const Se = { tokenize: Wt, postProcess: Jt };
function Yt(u, e) {
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
		const _ = u.push("link_open", "a", 1),
			y = [["href", i]];
		(_.attrs = y),
			o && y.push(["title", o]),
			u.linkLevel++,
			u.md.inline.tokenize(u),
			u.linkLevel--,
			u.push("link_close", "a", -1);
	}
	return (u.pos = d), (u.posMax = f), !0;
}
function Xt(u, e) {
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
		const _ = [];
		u.md.inline.parse(n, u.md, u.env, _);
		const y = u.push("image", "img", 0),
			D = [
				["src", l],
				["alt", ""],
			];
		(y.attrs = D),
			(y.children = _),
			(y.content = n),
			a && D.push(["title", a]);
	}
	return (u.pos = r), (u.posMax = p), !0;
}
const Kt =
		/^([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/,
	ur = /^([a-zA-Z][a-zA-Z0-9+.-]{1,31}):([^<>\x00-\x20]*)$/;
function er(u, e) {
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
	if (ur.test(r)) {
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
	if (Kt.test(r)) {
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
function tr(u) {
	return /^<a[>\s]/i.test(u);
}
function rr(u) {
	return /^<\/a\s*>/i.test(u);
}
function nr(u) {
	const e = u | 32;
	return e >= 97 && e <= 122;
}
function cr(u, e) {
	if (!u.md.options.html) return !1;
	const t = u.posMax,
		n = u.pos;
	if (u.src.charCodeAt(n) !== 60 || n + 2 >= t) return !1;
	const c = u.src.charCodeAt(n + 1);
	if (c !== 33 && c !== 63 && c !== 47 && !nr(c)) return !1;
	const r = u.src.slice(n).match(Mt);
	if (!r) return !1;
	if (!e) {
		const i = u.push("html_inline", "", 0);
		(i.content = r[0]),
			tr(i.content) && u.linkLevel++,
			rr(i.content) && u.linkLevel--;
	}
	return (u.pos += r[0].length), !0;
}
const or = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i,
	ir = /^&([a-z][a-z0-9]{1,31});/i;
function ar(u, e) {
	const t = u.pos,
		n = u.posMax;
	if (u.src.charCodeAt(t) !== 38 || t + 1 >= n) return !1;
	if (u.src.charCodeAt(t + 1) === 35) {
		const r = u.src.slice(t).match(or);
		if (r) {
			if (!e) {
				const i =
						r[1][0].toLowerCase() === "x"
							? parseInt(r[1].slice(1), 16)
							: parseInt(r[1], 10),
					o = u.push("text_special", "", 0);
				(o.content = Uu(i) ? gu(i) : gu(65533)),
					(o.markup = r[0]),
					(o.info = "entity");
			}
			return (u.pos += r[0].length), !0;
		}
	} else {
		const r = u.src.slice(t).match(ir);
		if (r) {
			const i = ye(r[0]);
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
function le(u) {
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
function sr(u) {
	const e = u.tokens_meta,
		t = u.tokens_meta.length;
	le(u.delimiters);
	for (let n = 0; n < t; n++) e[n] && e[n].delimiters && le(e[n].delimiters);
}
function lr(u) {
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
const qu = [
		["text", Ot],
		["linkify", Ut],
		["newline", Zt],
		["escape", Ht],
		["backticks", Vt],
		["strikethrough", Fe.tokenize],
		["emphasis", Se.tokenize],
		["link", Yt],
		["image", Xt],
		["autolink", er],
		["html_inline", cr],
		["entity", ar],
	],
	Tu = [
		["balance_pairs", sr],
		["strikethrough", Fe.postProcess],
		["emphasis", Se.postProcess],
		["fragments_join", lr],
	];
function bu() {
	this.ruler = new R();
	for (let u = 0; u < qu.length; u++) this.ruler.push(qu[u][0], qu[u][1]);
	this.ruler2 = new R();
	for (let u = 0; u < Tu.length; u++) this.ruler2.push(Tu[u][0], Tu[u][1]);
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
function fr(u) {
	const e = {};
	(u = u || {}),
		(e.src_Any = me.source),
		(e.src_Cc = xe.source),
		(e.src_Z = ke.source),
		(e.src_P = Ou.source),
		(e.src_ZPCc = [e.src_Z, e.src_P, e.src_Cc].join("|")),
		(e.src_ZCc = [e.src_Z, e.src_Cc].join("|"));
	const t = "[><｜]";
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
			"(^|(?![.:/\\-_@])(?:[$+<=>^`|｜]|" +
			e.src_ZPCc +
			"))((?![$+<=>^`|｜])" +
			e.tpl_host_port_fuzzy_strict +
			e.src_path +
			")"),
		(e.tpl_link_no_ip_fuzzy =
			"(^|(?![.:/\\-_@])(?:[$+<=>^`|｜]|" +
			e.src_ZPCc +
			"))((?![$+<=>^`|｜])" +
			e.tpl_host_port_no_ip_fuzzy_strict +
			e.src_path +
			")"),
		e
	);
}
function Lu(u) {
	return (
		Array.prototype.slice.call(arguments, 1).forEach(function (t) {
			t &&
				Object.keys(t).forEach(function (n) {
					u[n] = t[n];
				});
		}),
		u
	);
}
function wu(u) {
	return Object.prototype.toString.call(u);
}
function dr(u) {
	return wu(u) === "[object String]";
}
function hr(u) {
	return wu(u) === "[object Object]";
}
function br(u) {
	return wu(u) === "[object RegExp]";
}
function fe(u) {
	return wu(u) === "[object Function]";
}
function pr(u) {
	return u.replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
}
const ze = { fuzzyLink: !0, fuzzyEmail: !0, fuzzyIP: !1 };
function _r(u) {
	return Object.keys(u || {}).reduce(function (e, t) {
		return e || ze.hasOwnProperty(t);
	}, !1);
}
const mr = {
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
	xr =
		"a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]",
	kr =
		"biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф".split(
			"|"
		);
function gr(u) {
	(u.__index__ = -1), (u.__text_cache__ = "");
}
function yr(u) {
	return function (e, t) {
		const n = e.slice(t);
		return u.test(n) ? n.match(u)[0].length : 0;
	};
}
function de() {
	return function (u, e) {
		e.normalize(u);
	};
}
function yu(u) {
	const e = (u.re = fr(u.__opts__)),
		t = u.__tlds__.slice();
	u.onCompile(),
		u.__tlds_replaced__ || t.push(xr),
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
		if (((u.__compiled__[o] = s), hr(a))) {
			br(a.validate)
				? (s.validate = yr(a.validate))
				: fe(a.validate)
				? (s.validate = a.validate)
				: r(o, a),
				fe(a.normalize)
					? (s.normalize = a.normalize)
					: a.normalize
					? r(o, a)
					: (s.normalize = de());
			return;
		}
		if (dr(a)) {
			c.push(o);
			return;
		}
		r(o, a);
	}),
		c.forEach(function (o) {
			u.__compiled__[u.__schemas__[o]] &&
				((u.__compiled__[o].validate =
					u.__compiled__[u.__schemas__[o]].validate),
				(u.__compiled__[o].normalize =
					u.__compiled__[u.__schemas__[o]].normalize));
		}),
		(u.__compiled__[""] = { validate: null, normalize: de() });
	const i = Object.keys(u.__compiled__)
		.filter(function (o) {
			return o.length > 0 && u.__compiled__[o];
		})
		.map(pr)
		.join("|");
	(u.re.schema_test = RegExp(
		"(^|(?!_)(?:[><｜]|" + e.src_ZPCc + "))(" + i + ")",
		"i"
	)),
		(u.re.schema_search = RegExp(
			"(^|(?!_)(?:[><｜]|" + e.src_ZPCc + "))(" + i + ")",
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
		gr(u);
}
function Cr(u, e) {
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
	const t = new Cr(u, e);
	return u.__compiled__[t.schema].normalize(t, u), t;
}
function B(u, e) {
	if (!(this instanceof B)) return new B(u, e);
	e || (_r(u) && ((e = u), (u = {}))),
		(this.__opts__ = Lu({}, ze, e)),
		(this.__index__ = -1),
		(this.__last_index__ = -1),
		(this.__schema__ = ""),
		(this.__text_cache__ = ""),
		(this.__schemas__ = Lu({}, mr, u)),
		(this.__compiled__ = {}),
		(this.__tlds__ = kr),
		(this.__tlds_replaced__ = !1),
		(this.re = {}),
		yu(this);
}
B.prototype.add = function (e, t) {
	return (this.__schemas__[e] = t), yu(this), this;
};
B.prototype.set = function (e) {
	return (this.__opts__ = Lu(this.__opts__, e)), this;
};
B.prototype.test = function (e) {
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
B.prototype.pretest = function (e) {
	return this.re.pretest.test(e);
};
B.prototype.testSchemaAt = function (e, t, n) {
	return this.__compiled__[t.toLowerCase()]
		? this.__compiled__[t.toLowerCase()].validate(e, n, this)
		: 0;
};
B.prototype.match = function (e) {
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
B.prototype.matchAtStart = function (e) {
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
B.prototype.tlds = function (e, t) {
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
B.prototype.normalize = function (e) {
	e.schema || (e.url = "http://" + e.url),
		e.schema === "mailto:" &&
			!/^mailto:/i.test(e.url) &&
			(e.url = "mailto:" + e.url);
};
B.prototype.onCompile = function () {};
const eu = 2147483647,
	H = 36,
	Vu = 1,
	fu = 26,
	Ar = 38,
	Er = 700,
	qe = 72,
	Te = 128,
	Ie = "-",
	wr = /^xn--/,
	Dr = /[^\0-\x7F]/,
	vr = /[\x2E\u3002\uFF0E\uFF61]/g,
	Fr = {
		overflow: "Overflow: input needs wider integers to process",
		"not-basic": "Illegal input >= 0x80 (not a basic code point)",
		"invalid-input": "Invalid input",
	},
	Iu = H - Vu,
	V = Math.floor,
	Mu = String.fromCharCode;
function W(u) {
	throw new RangeError(Fr[u]);
}
function Sr(u, e) {
	const t = [];
	let n = u.length;
	for (; n--; ) t[n] = e(u[n]);
	return t;
}
function Me(u, e) {
	const t = u.split("@");
	let n = "";
	t.length > 1 && ((n = t[0] + "@"), (u = t[1])), (u = u.replace(vr, "."));
	const c = u.split("."),
		r = Sr(c, e).join(".");
	return n + r;
}
function Ne(u) {
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
const zr = (u) => String.fromCodePoint(...u),
	qr = function (u) {
		return u >= 48 && u < 58
			? 26 + (u - 48)
			: u >= 65 && u < 91
			? u - 65
			: u >= 97 && u < 123
			? u - 97
			: H;
	},
	he = function (u, e) {
		return u + 22 + 75 * (u < 26) - ((e != 0) << 5);
	},
	Le = function (u, e, t) {
		let n = 0;
		for (
			u = t ? V(u / Er) : u >> 1, u += V(u / e);
			u > (Iu * fu) >> 1;
			n += H
		)
			u = V(u / Iu);
		return V(n + ((Iu + 1) * u) / (u + Ar));
	},
	Re = function (u) {
		const e = [],
			t = u.length;
		let n = 0,
			c = Te,
			r = qe,
			i = u.lastIndexOf(Ie);
		i < 0 && (i = 0);
		for (let o = 0; o < i; ++o)
			u.charCodeAt(o) >= 128 && W("not-basic"), e.push(u.charCodeAt(o));
		for (let o = i > 0 ? i + 1 : 0; o < t; ) {
			const a = n;
			for (let l = 1, f = H; ; f += H) {
				o >= t && W("invalid-input");
				const p = qr(u.charCodeAt(o++));
				p >= H && W("invalid-input"),
					p > V((eu - n) / l) && W("overflow"),
					(n += p * l);
				const h = f <= r ? Vu : f >= r + fu ? fu : f - r;
				if (p < h) break;
				const d = H - h;
				l > V(eu / d) && W("overflow"), (l *= d);
			}
			const s = e.length + 1;
			(r = Le(n - a, s, a == 0)),
				V(n / s) > eu - c && W("overflow"),
				(c += V(n / s)),
				(n %= s),
				e.splice(n++, 0, c);
		}
		return String.fromCodePoint(...e);
	},
	Pe = function (u) {
		const e = [];
		u = Ne(u);
		const t = u.length;
		let n = Te,
			c = 0,
			r = qe;
		for (const a of u) a < 128 && e.push(Mu(a));
		const i = e.length;
		let o = i;
		for (i && e.push(Ie); o < t; ) {
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
						const h = p <= r ? Vu : p >= r + fu ? fu : p - r;
						if (f < h) break;
						const d = f - h,
							_ = H - h;
						e.push(Mu(he(h + (d % _), 0))), (f = V(d / _));
					}
					e.push(Mu(he(f, 0))), (r = Le(c, s, o === i)), (c = 0), ++o;
				}
			++c, ++n;
		}
		return e.join("");
	},
	Tr = function (u) {
		return Me(u, function (e) {
			return wr.test(e) ? Re(e.slice(4).toLowerCase()) : e;
		});
	},
	Ir = function (u) {
		return Me(u, function (e) {
			return Dr.test(e) ? "xn--" + Pe(e) : e;
		});
	},
	Be = {
		version: "2.3.1",
		ucs2: { decode: Ne, encode: zr },
		decode: Re,
		encode: Pe,
		toASCII: Ir,
		toUnicode: Tr,
	},
	Mr = {
		options: {
			html: !1,
			xhtmlOut: !1,
			breaks: !1,
			langPrefix: "language-",
			linkify: !1,
			typographer: !1,
			quotes: "“”‘’",
			highlight: null,
			maxNesting: 100,
		},
		components: { core: {}, block: {}, inline: {} },
	},
	Nr = {
		options: {
			html: !1,
			xhtmlOut: !1,
			breaks: !1,
			langPrefix: "language-",
			linkify: !1,
			typographer: !1,
			quotes: "“”‘’",
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
	Lr = {
		options: {
			html: !0,
			xhtmlOut: !0,
			breaks: !1,
			langPrefix: "language-",
			linkify: !1,
			typographer: !1,
			quotes: "“”‘’",
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
	Rr = { default: Mr, zero: Nr, commonmark: Lr },
	Pr = /^(vbscript|javascript|file|data):/,
	Br = /^data:image\/(gif|png|jpeg|webp);/;
function $r(u) {
	const e = u.trim().toLowerCase();
	return Pr.test(e) ? Br.test(e) : !0;
}
const $e = ["http:", "https:", "mailto:"];
function Or(u) {
	const e = $u(u, !0);
	if (e.hostname && (!e.protocol || $e.indexOf(e.protocol) >= 0))
		try {
			e.hostname = Be.toASCII(e.hostname);
		} catch (t) {}
	return du(Bu(e));
}
function jr(u) {
	const e = $u(u, !0);
	if (e.hostname && (!e.protocol || $e.indexOf(e.protocol) >= 0))
		try {
			e.hostname = Be.toUnicode(e.hostname);
		} catch (t) {}
	return tu(Bu(e), tu.defaultChars + "%");
}
function $(u, e) {
	if (!(this instanceof $)) return new $(u, e);
	e || ju(u) || ((e = u || {}), (u = "default")),
		(this.inline = new bu()),
		(this.block = new Eu()),
		(this.core = new Zu()),
		(this.renderer = new ru()),
		(this.linkify = new B()),
		(this.validateLink = $r),
		(this.normalizeLink = Or),
		(this.normalizeLinkText = jr),
		(this.utils = H0),
		(this.helpers = Cu({}, W0)),
		(this.options = {}),
		this.configure(u),
		e && this.set(e);
}
$.prototype.set = function (u) {
	return Cu(this.options, u), this;
};
$.prototype.configure = function (u) {
	const e = this;
	if (ju(u)) {
		const t = u;
		if (((u = Rr[t]), !u))
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
const Ur = { key: 0 },
	Zr = {
		class: "bg-blue-100 py-2 px-2 mb-4 rounded-md text-sm text-blue-800",
	},
	Hr = { class: "leading-relaxed" },
	Vr = { key: 0, class: "leading-relaxed" },
	Gr = { key: 1, class: "leading-relaxed" },
	Qr = { key: 2, class: "leading-relaxed" },
	Wr = { key: 0 },
	Jr = { class: "border text-center p-20 rounded-md" },
	Yr = { class: "font-semibold text-lg" },
	Xr = { key: 1 },
	Kr = { key: 1 },
	un = { key: 0, class: "border rounded-md p-5" },
	en = { class: "flex justify-between" },
	tn = { class: "text-sm" },
	rn = { class: "mr-2" },
	nn = { class: "text-gray-900 text-sm font-semibold item-left" },
	cn = { class: "text-gray-900 font-semibold mt-2" },
	on = {
		key: 0,
		class: "flex items-center bg-gray-200 rounded-md p-3 mt-4 w-full cursor-pointer focus:border-blue-600",
	},
	an = ["name", "onChange"],
	sn = ["name", "onChange"],
	ln = { key: 0 },
	fn = { class: "ml-2" },
	dn = { key: 1, class: "mt-2 text-sm hidden" },
	hn = { class: "flex items-center justify-between mt-8" },
	bn = { key: 2, class: "border rounded-md p-20 text-center" },
	pn = { class: "text-lg font-semibold" },
	_n = { key: 3, class: "mt-10" },
	be = {
		__name: "Quiz",
		props: { quizName: { type: String, required: !0 } },
		setup(u) {
			const e = pe("$user"),
				t = Gu(0),
				n = Gu(""),
				c = Qu([0, 0, 0, 0]),
				r = Qu([]),
				i = u,
				o = Oe({
					doctype: "LMS Quiz",
					name: i.quizName,
					cache: ["quiz", i.quizName],
					auto: !0,
				}),
				a = K({
					url: "frappe.client.get_list",
					makeParams(x) {
						var v, q;
						return {
							doctype: "LMS Quiz Submission",
							filters: {
								member: (v = e.data) == null ? void 0 : v.name,
								quiz: (q = o.doc) == null ? void 0 : q.name,
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
					transform(x) {
						x.forEach((v, q) => {
							(v.creation = Ke(v.creation)), (v.idx = q + 1);
						});
					},
				}),
				s = K({
					url: "lms.lms.doctype.lms_quiz.lms_quiz.quiz_summary",
					makeParams(x) {
						return {
							quiz: o.doc.name,
							results: localStorage.getItem(o.doc.title),
						};
					},
				}),
				l = K({
					url: "lms.lms.utils.get_question_details",
					makeParams(x) {
						return { question: n.value };
					},
				});
			_e(t, (x) => {
				x > 0 &&
					((n.value = o.doc.questions[x - 1].question), l.reload());
			});
			const f = () => {
					(t.value = 1), localStorage.removeItem(o.doc.title);
				},
				p = (x) => {
					l.data.multiple || c.splice(0, c.length, 0, 0, 0, 0),
						(c[x - 1] = c[x - 1] ? 0 : 1);
				},
				h = () => {
					let x = [];
					return (
						c.forEach((v, q) => {
							c[q] && x.push(l.data[`option_${q + 1}`]);
						}),
						x
					);
				},
				d = () => {
					let x = h();
					if (!x.length) {
						u0({
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
							answers: JSON.stringify(x),
						},
						auto: !0,
						onSuccess(v) {
							c.forEach((q, N) => {
								q
									? (r[N] = q && v[N])
									: l.data[`is_correct_${N + 1}`]
									? (r[N] = 0)
									: (r[N] = void 0);
							}),
								_(),
								o.doc.show_answers || D();
						},
					});
				},
				_ = () => {
					let x = JSON.parse(localStorage.getItem(o.doc.title)),
						v = {
							question_index: t.value,
							answers: h().join(),
							is_correct: r.filter((q) => q != null),
						};
					x ? x.push(v) : (x = [v]),
						localStorage.setItem(o.doc.title, JSON.stringify(x));
				},
				y = () => {
					o.doc.show_answers ? D() : d();
				},
				D = () => {
					t.value != o.doc.questions.length &&
						((t.value = t.value + 1),
						c.splice(0, c.length, 0, 0, 0, 0),
						(r.length = 0));
				},
				A = () => {
					if (!o.doc.show_answers) {
						d(),
							setTimeout(() => {
								k();
							}, 500);
						return;
					}
					k();
				},
				k = () => {
					s.reload().then(() => {
						a.reload();
					});
				},
				w = () => {
					(t.value = 0),
						c.splice(0, c.length, 0, 0, 0, 0),
						(r.length = 0),
						s.reset();
				},
				m = () => [
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
			return (x, v) => {
				var q, N, pu, _u;
				return b(o).doc
					? (g(),
					  E("div", Ur, [
							C("div", Zr, [
								C(
									"div",
									Hr,
									F(
										x
											.__(
												"This quiz consists of {0} questions."
											)
											.format(b(o).doc.questions.length)
									),
									1
								),
								b(o).doc.passing_percentage
									? (g(),
									  E(
											"div",
											Vr,
											F(
												x
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
									: z("", !0),
								b(o).doc.max_attempts
									? (g(),
									  E(
											"div",
											Gr,
											F(
												x
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
									: z("", !0),
								b(o).doc.time
									? (g(),
									  E(
											"div",
											Qr,
											F(
												x
													.__(
														"The quiz has a time limit.For each question you will be given { 0} seconds."
													)
													.format(b(o).doc.time)
											),
											1
									  ))
									: z("", !0),
							]),
							t.value == 0
								? (g(),
								  E("div", Wr, [
										C("div", Jr, [
											C("div", Yr, F(b(o).doc.title), 1),
											!b(o).doc.max_attempts ||
											((q = b(a).data) == null
												? void 0
												: q.length) <
												b(o).doc.max_attempts
												? (g(),
												  M(
														b(Z),
														{
															key: 0,
															onClick: f,
															class: "mt-2",
														},
														{
															default: P(() => [
																C(
																	"span",
																	null,
																	F(
																		x.__(
																			"Start"
																		)
																	),
																	1
																),
															]),
															_: 1,
														}
												  ))
												: (g(),
												  E(
														"div",
														Xr,
														F(
															x.__(
																"You have already exceeded the maximum number of attempts allowed for this quiz."
															)
														),
														1
												  )),
										]),
								  ]))
								: b(s).data
								? (g(),
								  E("div", bn, [
										C(
											"div",
											pn,
											F(x.__("Quiz Summary")),
											1
										),
										C(
											"div",
											null,
											F(
												x
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
										((N = b(a)) == null
											? void 0
											: N.data.length) <
											b(o).doc.max_attempts
											? (g(),
											  M(
													b(Z),
													{
														key: 0,
														onClick:
															v[3] ||
															(v[3] = (nu) =>
																w()),
														class: "mt-2",
													},
													{
														default: P(() => [
															C(
																"span",
																null,
																F(
																	x.__(
																		"Try Again"
																	)
																),
																1
															),
														]),
														_: 1,
													}
											  ))
											: z("", !0),
								  ]))
								: (g(),
								  E("div", Kr, [
										(g(!0),
										E(
											cu,
											null,
											ou(
												b(o).doc.questions,
												(nu, Du) => (
													g(),
													E("div", null, [
														Du == t.value - 1 &&
														b(l).data
															? (g(),
															  E("div", un, [
																	C(
																		"div",
																		en,
																		[
																			C(
																				"div",
																				tn,
																				[
																					C(
																						"span",
																						rn,
																						F(
																							x
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
																								? x.__(
																										"Choose all answers that apply"
																								  )
																								: x.__(
																										"Choose one answer"
																								  )
																						),
																						1
																					),
																				]
																			),
																			C(
																				"div",
																				nn,
																				F(
																					nu.marks
																				) +
																					" " +
																					F(
																						nu.marks ==
																							1
																							? x.__(
																									"Mark"
																							  )
																							: x.__(
																									"Marks"
																							  )
																					),
																				1
																			),
																		]
																	),
																	C(
																		"div",
																		cn,
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
																		? (g(),
																		  E(
																				cu,
																				{
																					key: 0,
																				},
																				ou(
																					4,
																					(
																						L
																					) =>
																						C(
																							"div",
																							null,
																							[
																								b(
																									l
																								)
																									.data[
																									`option_${L}`
																								]
																									? (g(),
																									  E(
																											"label",
																											on,
																											[
																												!r.length &&
																												!b(
																													l
																												)
																													.data
																													.multiple
																													? (g(),
																													  E(
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
																																			L
																																		),
																															},
																															null,
																															40,
																															an
																													  ))
																													: !r.length &&
																													  b(
																															l
																													  )
																															.data
																															.multiple
																													? (g(),
																													  E(
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
																																			L
																																		),
																															},
																															null,
																															40,
																															sn
																													  ))
																													: b(
																															o
																													  )
																															.doc
																															.show_answers
																													? (g(
																															!0
																													  ),
																													  E(
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
																																	g(),
																																	E(
																																		"div",
																																		null,
																																		[
																																			L -
																																				1 ==
																																			vu
																																				? (g(),
																																				  E(
																																						"div",
																																						ln,
																																						[
																																							O
																																								? (g(),
																																								  M(
																																										b(
																																											r0
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
																																										`is_correct_${L}`
																																								  ]
																																								? (g(),
																																								  M(
																																										b(
																																											Wu
																																										),
																																										{
																																											key: 1,
																																											class: "w-4 h-4 text-green-500",
																																										}
																																								  ))
																																								: O ==
																																								  0
																																								? (g(),
																																								  M(
																																										b(
																																											n0
																																										),
																																										{
																																											key: 2,
																																											class: "w-4 h-4 text-red-500",
																																										}
																																								  ))
																																								: (g(),
																																								  M(
																																										b(
																																											Wu
																																										),
																																										{
																																											key: 3,
																																											class: "w-4 h-4",
																																										}
																																								  )),
																																						]
																																				  ))
																																				: z(
																																						"",
																																						!0
																																				  ),
																																		]
																																	)
																																)
																															),
																															256
																													  ))
																													: z(
																															"",
																															!0
																													  ),
																												C(
																													"span",
																													fn,
																													F(
																														b(
																															l
																														)
																															.data[
																															`option_${L}`
																														]
																													),
																													1
																												),
																											]
																									  ))
																									: z(
																											"",
																											!0
																									  ),
																								b(
																									l
																								)
																									.data[
																									`explanation_${L}`
																								]
																									? (g(),
																									  E(
																											"div",
																											dn,
																											F(
																												b(
																													l
																												)
																													.data[
																													`explanation_${L}`
																												]
																											),
																											1
																									  ))
																									: z(
																											"",
																											!0
																									  ),
																							]
																						)
																				),
																				64
																		  ))
																		: z(
																				"",
																				!0
																		  ),
																	C(
																		"div",
																		hn,
																		[
																			C(
																				"div",
																				null,
																				F(
																					x
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
																				? (g(),
																				  M(
																						b(
																							Z
																						),
																						{
																							key: 0,
																							onClick:
																								v[0] ||
																								(v[0] =
																									(
																										L
																									) =>
																										d()),
																						},
																						{
																							default:
																								P(
																									() => [
																										C(
																											"span",
																											null,
																											F(
																												x.__(
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
																				? (g(),
																				  M(
																						b(
																							Z
																						),
																						{
																							key: 1,
																							onClick:
																								v[1] ||
																								(v[1] =
																									(
																										L
																									) =>
																										y()),
																						},
																						{
																							default:
																								P(
																									() => [
																										C(
																											"span",
																											null,
																											F(
																												x.__(
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
																				: (g(),
																				  M(
																						b(
																							Z
																						),
																						{
																							key: 2,
																							onClick:
																								v[2] ||
																								(v[2] =
																									(
																										L
																									) =>
																										A()),
																						},
																						{
																							default:
																								P(
																									() => [
																										C(
																											"span",
																											null,
																											F(
																												x.__(
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
															: z("", !0),
													])
												)
											),
											256
										)),
								  ])),
							b(o).doc.show_submission_history &&
							(pu = b(a)) != null &&
							pu.data
								? (g(),
								  E("div", _n, [
										U(
											b(je),
											{
												columns: m(),
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
								: z("", !0),
					  ]))
					: z("", !0);
			};
		},
	},
	mn = { key: 0, class: "h-screen text-base" },
	xn = {
		class: "sticky top-0 z-10 flex items-center justify-between border-b bg-white px-3 py-2.5 sm:px-5",
	},
	kn = { class: "grid grid-cols-[70%,30%] h-full" },
	gn = { key: 0, class: "border-r-2 text-center pt-10" },
	yn = { class: "mb-4" },
	Cn = { key: 1, class: "border-r-2 container pt-5 pb-10" },
	An = { class: "flex items-center justify-between" },
	En = { class: "text-3xl font-semibold" },
	wn = { class: "flex items-center mt-2" },
	Dn = { key: 0 },
	vn = { key: 1 },
	Fn = { key: 2 },
	Sn = {
		class: "ProseMirror prose prose-table:table-fixed prose-td:p-2 prose-th:p-2 prose-td:border prose-th:border prose-td:border-gray-300 prose-th:border-gray-300 prose-td:relative prose-th:relative prose-th:bg-gray-100 prose-sm max-w-none !whitespace-normal mt-6",
	},
	zn = { key: 0 },
	qn = ["src"],
	Tn = { key: 0 },
	In = ["src"],
	Mn = { key: 1 },
	Nn = { key: 1, class: "border rounded-md text-center py-20" },
	Ln = { key: 2 },
	Rn = { controls: "", width: "100%", controlsList: "nodownload" },
	Pn = ["src"],
	Bn = { key: 3 },
	$n = ["src"],
	On = { key: 4 },
	jn = { width: "100%", controls: "", controlsList: "nodownload" },
	Un = ["src"],
	Zn = { key: 5 },
	Hn = ["src"],
	Vn = ["innerHTML"],
	Gn = { key: 1 },
	Qn = { key: 1, class: "border rounded-md text-center py-20" },
	Wn = { class: "mt-20" },
	Jn = { class: "sticky top-10" },
	Yn = { class: "bg-gray-50 p-5 border-b-2" },
	Xn = { class: "text-lg font-semibold" },
	Kn = { key: 0, class: "text-sm mt-3" },
	uc = { key: 1, class: "w-full bg-gray-200 rounded-full h-1 my-2" },
	ic = {
		__name: "Lesson",
		props: {
			courseName: { type: String, required: !0 },
			chapterNumber: { type: String, required: !0 },
			lessonNumber: { type: String, required: !0 },
		},
		setup(u) {
			const e = pe("$user"),
				t = Ue(),
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
					makeParams(_) {
						return {
							course: c.courseName,
							chapter: _ ? _.chapter : c.chapterNumber,
							lesson: _ ? _.lesson : c.lessonNumber,
						};
					},
					auto: !0,
					onSuccess(_) {
						_.membership &&
							o.submit({
								name: _.membership.name,
								lesson_name: _.name,
							}),
							i(_);
					},
				}),
				i = (_) => {
					setTimeout(() => {
						_.progress || a.submit();
					}, 6e4);
				},
				o = K({
					url: "frappe.client.set_value",
					makeParams(_) {
						return {
							doctype: "LMS Enrollment",
							name: _.name,
							fieldname: "current_lesson",
							value: _.lesson_name,
						};
					},
				}),
				a = K({
					url: "lms.lms.doctype.course_lesson.course_lesson.save_progress",
					makeParams() {
						return { lesson: r.data.name, course: c.courseName };
					},
				}),
				s = Ze(() => {
					var y, D;
					let _ = [
						{ label: "All Courses", route: { name: "Courses" } },
					];
					return (
						_.push({
							label:
								(y = r == null ? void 0 : r.data) == null
									? void 0
									: y.course_title,
							route: {
								name: "CourseDetail",
								params: { course: c.courseName },
							},
						}),
						_.push({
							label:
								(D = r == null ? void 0 : r.data) == null
									? void 0
									: D.title,
							route: {
								name: "Lesson",
								params: {
									course: c.courseName,
									chapterNumber: c.chapterNumber,
									lessonNumber: c.lessonNumber,
								},
							},
						}),
						_
					);
				});
			_e(
				[() => t.params.chapterNumber, () => t.params.lessonNumber],
				([_, y], [D, A]) => {
					_ && y && r.submit({ chapter: _, lesson: y });
				}
			);
			const l = (_) => (
					_.includes("{{") && (_ = p(_)),
					`https://www.youtube.com/embed/${_}`
				),
				f = (_) => `${p(_)}#toolbar=0`,
				p = (_) => _.match(/\(["']([^"']+?)["']\)/)[1],
				h = () => {
					window.location.href = `/login?redirect_to=/courses/${c.courseName}/learn/${t.params.chapterNumber}-${t.params.lessonNumber}`;
				},
				d = () => {
					var _, y, D;
					return (
						((_ = r.data) == null ? void 0 : _.membership) ||
						((y = e.data) == null ? void 0 : y.is_moderator) ||
						((D = e.data) == null ? void 0 : D.is_instructor)
					);
				};
			return (_, y) => {
				const D = Ge("router-link");
				return b(r).data
					? (g(),
					  E("div", mn, [
							C("header", xn, [
								U(
									b(Qe),
									{ class: "h-7", items: s.value },
									null,
									8,
									["items"]
								),
							]),
							C("div", kn, [
								b(r).data.no_preview
									? (g(),
									  E("div", gn, [
											C(
												"p",
												yn,
												F(
													_.__(
														"This lesson is not available for preview. Please enroll in the course to access it."
													)
												),
												1
											),
											U(
												D,
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
													default: P(() => [
														U(
															b(Z),
															{
																variant:
																	"solid",
															},
															{
																default: P(
																	() => [
																		We(
																			F(
																				_.__(
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
									: (g(),
									  E("div", Cn, [
											C("div", An, [
												C(
													"div",
													En,
													F(b(r).data.title),
													1
												),
												C("div", null, [
													b(r).data.prev
														? (g(),
														  M(
																D,
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
																	default: P(
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
																						P(
																							() => [
																								U(
																									b(
																										t0
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
														: z("", !0),
													b(r).data.next
														? (g(),
														  M(
																D,
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
																	default: P(
																		() => [
																			U(
																				b(
																					Z
																				),
																				null,
																				{
																					default:
																						P(
																							() => [
																								U(
																									b(
																										Ye
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
														: z("", !0),
												]),
											]),
											C("div", wn, [
												C(
													"span",
													{
														class: He([
															"mr-1",
															{
																"avatar-group overlap":
																	b(r).data
																		.instructors
																		.length >
																	1,
															},
														]),
													},
													[
														(g(!0),
														E(
															cu,
															null,
															ou(
																b(r).data
																	.instructors,
																(A) => (
																	g(),
																	M(
																		Xe,
																		{
																			user: A,
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
												b(r).data.instructors.length ==
												1
													? (g(),
													  E(
															"span",
															Dn,
															F(
																b(r).data
																	.instructors[0]
																	.full_name
															),
															1
													  ))
													: z("", !0),
												b(r).data.instructors.length ==
												2
													? (g(),
													  E(
															"span",
															vn,
															F(
																b(r).data
																	.instructors[0]
																	.first_name
															) +
																" and " +
																F(
																	b(r).data
																		.instructors[1]
																		.first_name
																),
															1
													  ))
													: z("", !0),
												b(r).data.instructors.length > 2
													? (g(),
													  E(
															"span",
															Fn,
															F(
																b(r).data
																	.instructors[0]
																	.first_name
															) +
																" and " +
																F(
																	b(r).data
																		.instructors
																		.length -
																		1
																) +
																" others ",
															1
													  ))
													: z("", !0),
											]),
											C("div", Sn, [
												b(r).data.youtube
													? (g(),
													  E("div", zn, [
															C(
																"iframe",
																{
																	class: "youtube-video",
																	src: l(
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
																qn
															),
													  ]))
													: z("", !0),
												(g(!0),
												E(
													cu,
													null,
													ou(
														b(r).data.body.split(`


`),
														(A) => (
															g(),
															E("div", null, [
																A.includes(
																	"{{ YouTubeVideo"
																)
																	? (g(),
																	  E(
																			"div",
																			Tn,
																			[
																				C(
																					"iframe",
																					{
																						class: "youtube-video",
																						src: l(
																							A
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
																					In
																				),
																			]
																	  ))
																	: A.includes(
																			"{{ Quiz"
																	  )
																	? (g(),
																	  E(
																			"div",
																			Mn,
																			[
																				b(
																					e
																				)
																					.data
																					? (g(),
																					  M(
																							be,
																							{
																								key: 0,
																								quizName:
																									p(
																										A
																									),
																							},
																							null,
																							8,
																							[
																								"quizName",
																							]
																					  ))
																					: (g(),
																					  E(
																							"div",
																							Nn,
																							[
																								C(
																									"div",
																									null,
																									F(
																										_.__(
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
																											y[0] ||
																											(y[0] =
																												(
																													k
																												) =>
																													h()),
																										class: "mt-2",
																									},
																									{
																										default:
																											P(
																												() => [
																													C(
																														"span",
																														null,
																														F(
																															_.__(
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
																	: A.includes(
																			"{{ Video"
																	  )
																	? (g(),
																	  E(
																			"div",
																			Ln,
																			[
																				C(
																					"video",
																					Rn,
																					[
																						C(
																							"source",
																							{
																								src: p(
																									A
																								),
																								type: "video/mp4",
																							},
																							null,
																							8,
																							Pn
																						),
																					]
																				),
																			]
																	  ))
																	: A.includes(
																			"{{ PDF"
																	  )
																	? (g(),
																	  E(
																			"div",
																			Bn,
																			[
																				C(
																					"iframe",
																					{
																						src: f(
																							A
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
																					$n
																				),
																			]
																	  ))
																	: A.includes(
																			"{{ Audio"
																	  )
																	? (g(),
																	  E(
																			"div",
																			On,
																			[
																				C(
																					"audio",
																					jn,
																					[
																						C(
																							"source",
																							{
																								src: p(
																									A
																								),
																								type: "audio/mp3",
																							},
																							null,
																							8,
																							Un
																						),
																					]
																				),
																			]
																	  ))
																	: A.includes(
																			"{{ Embed"
																	  )
																	? (g(),
																	  E(
																			"div",
																			Zn,
																			[
																				C(
																					"iframe",
																					{
																						width: "100%",
																						height: "400",
																						src: p(
																							A
																						),
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
																	: (g(),
																	  E(
																			"div",
																			{
																				key: 6,
																				innerHTML:
																					b(
																						n
																					).render(
																						A
																					),
																			},
																			null,
																			8,
																			Vn
																	  )),
															])
														)
													),
													256
												)),
												b(r).data.quiz_id
													? (g(),
													  E("div", Gn, [
															b(e).data
																? (g(),
																  M(
																		be,
																		{
																			key: 0,
																			quizName:
																				p(
																					_.block
																				),
																		},
																		null,
																		8,
																		[
																			"quizName",
																		]
																  ))
																: (g(),
																  E("div", Qn, [
																		C(
																			"div",
																			null,
																			F(
																				_.__(
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
																					y[1] ||
																					(y[1] =
																						(
																							A
																						) =>
																							h()),
																				class: "mt-2",
																			},
																			{
																				default:
																					P(
																						() => [
																							C(
																								"span",
																								null,
																								F(
																									_.__(
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
													: z("", !0),
											]),
											C("div", Wn, [
												d()
													? (g(),
													  M(
															e0,
															{
																title: "Questions",
																doctype:
																	"Course Lesson",
																docname:
																	b(r).data
																		.name,
																key: b(r).data
																	.name,
															},
															null,
															8,
															["docname"]
													  ))
													: z("", !0),
											]),
									  ])),
								C("div", Jn, [
									C("div", Yn, [
										C(
											"div",
											Xn,
											F(b(r).data.course_title),
											1
										),
										b(e) && b(r).data.membership
											? (g(),
											  E(
													"div",
													Kn,
													F(
														Math.ceil(
															b(r).data.membership
																.progress
														)
													) + "% completed ",
													1
											  ))
											: z("", !0),
										b(e) && b(r).data.membership
											? (g(),
											  E("div", uc, [
													C(
														"div",
														{
															class: "bg-gray-900 h-1 rounded-full",
															style: Ve({
																width:
																	Math.ceil(
																		b(r)
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
											: z("", !0),
									]),
									(g(),
									M(
										Je,
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
					: z("", !0);
			};
		},
	};
export { ic as default };
//# sourceMappingURL=Lesson-_6tXx-Z1.js.map
