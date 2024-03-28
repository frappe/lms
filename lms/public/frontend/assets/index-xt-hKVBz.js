var ut = Object.defineProperty,
	lt = Object.defineProperties;
var ft = Object.getOwnPropertyDescriptors;
var oe = Object.getOwnPropertySymbols;
var Le = Object.prototype.hasOwnProperty,
	Ee = Object.prototype.propertyIsEnumerable;
var ke = (e, t, a) =>
		t in e
			? ut(e, t, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: a,
			  })
			: (e[t] = a),
	X = (e, t) => {
		for (var a in t || (t = {})) Le.call(t, a) && ke(e, a, t[a]);
		if (oe) for (var a of oe(t)) Ee.call(t, a) && ke(e, a, t[a]);
		return e;
	},
	_e = (e, t) => lt(e, ft(t));
var xe = (e, t) => {
	var a = {};
	for (var r in e) Le.call(e, r) && t.indexOf(r) < 0 && (a[r] = e[r]);
	if (e != null && oe)
		for (var r of oe(e)) t.indexOf(r) < 0 && Ee.call(e, r) && (a[r] = e[r]);
	return a;
};
var Oe = (e, t, a) =>
	new Promise((r, n) => {
		var s = (c) => {
				try {
					i(a.next(c));
				} catch (u) {
					n(u);
				}
			},
			o = (c) => {
				try {
					i(a.throw(c));
				} catch (u) {
					n(u);
				}
			},
			i = (c) =>
				c.done ? r(c.value) : Promise.resolve(c.value).then(s, o);
		i((a = a.apply(e, t)).next());
	});
import {
	e as Be,
	r as ne,
	m as Re,
	i as dt,
	w as ht,
	a as Fe,
	b as ae,
	c as He,
	t as pt,
	d as mt,
	g as vt,
	o as _t,
	n as yt,
	h as gt,
	f as At,
	j as se,
	k as ue,
	l as wt,
	p as $t,
	_ as C,
	q as ee,
	D as St,
	E as Mt,
	s as bt,
	u as Dt,
	v as je,
	x as M,
	y as O,
	z as Ct,
	A as kt,
	B as Lt,
	C as $e,
	F as he,
	G as pe,
	H as $,
	I as R,
	J as T,
	K as g,
	L as Ve,
	M as Ye,
	N as Et,
	O as le,
	P as Ue,
	T as xt,
	Q as Se,
	R as We,
	S as Ot,
	U as Tt,
	V as It,
	W as Pt,
	X as Nt,
	Y as Bt,
	Z as Rt,
	$ as Ft,
	a0 as Ht,
	a1 as jt,
	a2 as Vt,
	a3 as Yt,
} from "./frappe-ui-n1bXVQkV.js";
(function () {
	const t = document.createElement("link").relList;
	if (t && t.supports && t.supports("modulepreload")) return;
	for (const n of document.querySelectorAll('link[rel="modulepreload"]'))
		r(n);
	new MutationObserver((n) => {
		for (const s of n)
			if (s.type === "childList")
				for (const o of s.addedNodes)
					o.tagName === "LINK" && o.rel === "modulepreload" && r(o);
	}).observe(document, { childList: !0, subtree: !0 });
	function a(n) {
		const s = {};
		return (
			n.integrity && (s.integrity = n.integrity),
			n.referrerPolicy && (s.referrerPolicy = n.referrerPolicy),
			n.crossOrigin === "use-credentials"
				? (s.credentials = "include")
				: n.crossOrigin === "anonymous"
				? (s.credentials = "omit")
				: (s.credentials = "same-origin"),
			s
		);
	}
	function r(n) {
		if (n.ep) return;
		n.ep = !0;
		const s = a(n);
		fetch(n.href, s);
	}
})();
/*!
 * pinia v2.1.7
 * (c) 2023 Eduardo San Martin Morote
 * @license MIT
 */ let ze;
const me = (e) => (ze = e),
	Je = Symbol();
function ge(e) {
	return (
		e &&
		typeof e == "object" &&
		Object.prototype.toString.call(e) === "[object Object]" &&
		typeof e.toJSON != "function"
	);
}
var te;
(function (e) {
	(e.direct = "direct"),
		(e.patchObject = "patch object"),
		(e.patchFunction = "patch function");
})(te || (te = {}));
function Ut() {
	const e = Be(!0),
		t = e.run(() => ne({}));
	let a = [],
		r = [];
	const n = Re({
		install(s) {
			me(n),
				(n._a = s),
				s.provide(Je, n),
				(s.config.globalProperties.$pinia = n),
				r.forEach((o) => a.push(o)),
				(r = []);
		},
		use(s) {
			return !this._a && !dt ? r.push(s) : a.push(s), this;
		},
		_p: a,
		_a: null,
		_e: e,
		_s: new Map(),
		state: t,
	});
	return n;
}
const Ke = () => {};
function Te(e, t, a, r = Ke) {
	e.push(t);
	const n = () => {
		const s = e.indexOf(t);
		s > -1 && (e.splice(s, 1), r());
	};
	return !a && vt() && _t(n), n;
}
function J(e, ...t) {
	e.slice().forEach((a) => {
		a(...t);
	});
}
const Wt = (e) => e();
function Ae(e, t) {
	e instanceof Map && t instanceof Map && t.forEach((a, r) => e.set(r, a)),
		e instanceof Set && t instanceof Set && t.forEach(e.add, e);
	for (const a in t) {
		if (!t.hasOwnProperty(a)) continue;
		const r = t[a],
			n = e[a];
		ge(n) && ge(r) && e.hasOwnProperty(a) && !ae(r) && !He(r)
			? (e[a] = Ae(n, r))
			: (e[a] = r);
	}
	return e;
}
const zt = Symbol();
function Jt(e) {
	return !ge(e) || !e.hasOwnProperty(zt);
}
const { assign: F } = Object;
function Kt(e) {
	return !!(ae(e) && e.effect);
}
function Zt(e, t, a, r) {
	const { state: n, actions: s, getters: o } = t,
		i = a.state.value[e];
	let c;
	function u() {
		i || (a.state.value[e] = n ? n() : {});
		const l = At(a.state.value[e]);
		return F(
			l,
			s,
			Object.keys(o || {}).reduce(
				(m, f) => (
					(m[f] = Re(
						se(() => {
							me(a);
							const y = a._s.get(e);
							return o[f].call(y, y);
						})
					)),
					m
				),
				{}
			)
		);
	}
	return (c = Ze(e, u, t, a, r, !0)), c;
}
function Ze(e, t, a = {}, r, n, s) {
	let o;
	const i = F({ actions: {} }, a),
		c = { deep: !0 };
	let u,
		l,
		m = [],
		f = [],
		y;
	const S = r.state.value[e];
	!s && !S && (r.state.value[e] = {}), ne({});
	let k;
	function D(_) {
		let p;
		(u = l = !1),
			typeof _ == "function"
				? (_(r.state.value[e]),
				  (p = { type: te.patchFunction, storeId: e, events: y }))
				: (Ae(r.state.value[e], _),
				  (p = {
						type: te.patchObject,
						payload: _,
						storeId: e,
						events: y,
				  }));
		const I = (k = Symbol());
		yt().then(() => {
			k === I && (u = !0);
		}),
			(l = !0),
			J(m, p, r.state.value[e]);
	}
	const L = s
		? function () {
				const { state: p } = a,
					I = p ? p() : {};
				this.$patch((j) => {
					F(j, I);
				});
		  }
		: Ke;
	function A() {
		o.stop(), (m = []), (f = []), r._s.delete(e);
	}
	function h(_, p) {
		return function () {
			me(r);
			const I = Array.from(arguments),
				j = [],
				q = [];
			function it(E) {
				j.push(E);
			}
			function ct(E) {
				q.push(E);
			}
			J(f, { args: I, name: _, store: w, after: it, onError: ct });
			let Q;
			try {
				Q = p.apply(this && this.$id === e ? this : w, I);
			} catch (E) {
				throw (J(q, E), E);
			}
			return Q instanceof Promise
				? Q.then((E) => (J(j, E), E)).catch(
						(E) => (J(q, E), Promise.reject(E))
				  )
				: (J(j, Q), Q);
		};
	}
	const b = {
			_p: r,
			$id: e,
			$onAction: Te.bind(null, f),
			$patch: D,
			$reset: L,
			$subscribe(_, p = {}) {
				const I = Te(m, _, p.detached, () => j()),
					j = o.run(() =>
						ht(
							() => r.state.value[e],
							(q) => {
								(p.flush === "sync" ? l : u) &&
									_(
										{
											storeId: e,
											type: te.direct,
											events: y,
										},
										q
									);
							},
							F({}, c, p)
						)
					);
				return I;
			},
			$dispose: A,
		},
		w = Fe(b);
	r._s.set(e, w);
	const G = ((r._a && r._a.runWithContext) || Wt)(() =>
		r._e.run(() => (o = Be()).run(t))
	);
	for (const _ in G) {
		const p = G[_];
		if ((ae(p) && !Kt(p)) || He(p))
			s ||
				(S && Jt(p) && (ae(p) ? (p.value = S[_]) : Ae(p, S[_])),
				(r.state.value[e][_] = p));
		else if (typeof p == "function") {
			const I = h(_, p);
			(G[_] = I), (i.actions[_] = p);
		}
	}
	return (
		F(w, G),
		F(pt(w), G),
		Object.defineProperty(w, "$state", {
			get: () => r.state.value[e],
			set: (_) => {
				D((p) => {
					F(p, _);
				});
			},
		}),
		r._p.forEach((_) => {
			F(
				w,
				o.run(() => _({ store: w, app: r._a, pinia: r, options: i }))
			);
		}),
		S && s && a.hydrate && a.hydrate(w.$state, S),
		(u = !0),
		(l = !0),
		w
	);
}
function Ge(e, t, a) {
	let r, n;
	const s = typeof t == "function";
	typeof e == "string" ? ((r = e), (n = s ? a : t)) : ((n = e), (r = e.id));
	function o(i, c) {
		const u = gt();
		return (
			(i = i || (u ? mt(Je, null) : null)),
			i && me(i),
			(i = ze),
			i._s.has(r) || (s ? Ze(r, t, n, i) : Zt(r, n, i)),
			i._s.get(r)
		);
	}
	return (o.$id = r), o;
}
const Me = Ge("lms-users", () => ({
		userResource: ue({
			url: "lms.lms.api.get_user_info",
			onError(t) {
				t &&
					t.exc_type === "AuthenticationError" &&
					router.push("/login");
			},
		}),
	})),
	fe = Ge("lms-session", () => {
		let { userResource: e } = Me();
		function t() {
			let i = new URLSearchParams(
				document.cookie.split("; ").join("&")
			).get("user_id");
			return i === "Guest" && (i = null), i;
		}
		let a = ne(t());
		const r = se(() => !!a.value),
			n = ue({
				url: "login",
				onError() {
					throw new Error("Invalid email or password");
				},
				onSuccess() {
					e.reload(),
						(a.value = t()),
						n.reset(),
						be.replace({ path: "/" });
				},
			}),
			s = ue({
				url: "logout",
				onSuccess() {
					e.reset(), (a.value = null), window.location.reload();
				},
			});
		return { user: a, isLoggedIn: r, login: n, logout: s };
	}),
	Gt = [
		{
			path: "/",
			name: "Home",
			component: () =>
				C(
					() => import("./Home-dYmUETrl.js"),
					__vite__mapDeps([0, 1, 2])
				),
		},
		{
			path: "/courses",
			name: "Courses",
			component: () =>
				C(
					() => import("./Courses-ysBRUCIO.js"),
					__vite__mapDeps([3, 1, 2, 4, 5, 6, 7, 8])
				),
		},
		{
			path: "/courses/:courseName",
			name: "CourseDetail",
			component: () =>
				C(
					() => import("./CourseDetail-V5AjKcOc.js"),
					__vite__mapDeps([9, 1, 2, 6, 10, 11, 12, 5, 13])
				),
			props: !0,
		},
		{
			path: "/courses/:courseName/learn/:chapterNumber-:lessonNumber",
			name: "Lesson",
			component: () =>
				C(
					() => import("./Lesson-_6tXx-Z1.js"),
					__vite__mapDeps([14, 1, 2, 10, 11, 12, 5, 15, 16])
				),
			props: !0,
		},
		{
			path: "/batches",
			name: "Batches",
			component: () =>
				C(
					() => import("./Batches-CJG8qsGy.js"),
					__vite__mapDeps([17, 1, 2, 18, 8, 19])
				),
		},
		{
			path: "/batches/details/:batchName",
			name: "BatchDetail",
			component: () =>
				C(
					() => import("./BatchDetail-Bb9JTSid.js"),
					__vite__mapDeps([20, 1, 2, 18, 4, 5, 6, 7, 21])
				),
			props: !0,
		},
		{
			path: "/batches/:batchName",
			name: "Batch",
			component: () =>
				C(
					() => import("./Batch-UFfl4NY5.js"),
					__vite__mapDeps([
						22, 1, 2, 4, 5, 6, 7, 18, 8, 23, 15, 24, 25,
					])
				),
			props: !0,
		},
		{
			path: "/billing/:type/:name",
			name: "Billing",
			component: () =>
				C(
					() => import("./Billing-kqTZfaAQ.js"),
					__vite__mapDeps([26, 1, 2, 23, 8])
				),
			props: !0,
		},
		{
			path: "/statistics",
			name: "Statistics",
			component: () =>
				C(
					() => import("./Statistics-HRvuiWCP.js"),
					__vite__mapDeps([27, 1, 2, 24])
				),
		},
		{
			path: "/user/:userName",
			name: "Profile",
			component: () =>
				C(
					() => import("./Profile-dLRFEpeq.js"),
					__vite__mapDeps([28, 1, 2])
				),
			props: !0,
		},
		{
			path: "/job-openings",
			name: "Jobs",
			component: () =>
				C(
					() => import("./Jobs-RxlTvly_.js"),
					__vite__mapDeps([29, 1, 2, 30, 8])
				),
		},
		{
			path: "/job-openings/:job",
			name: "JobDetail",
			component: () =>
				C(
					() => import("./JobDetail-1dm4725M.js"),
					__vite__mapDeps([31, 1, 2, 11, 30])
				),
			props: !0,
		},
		{
			path: "/courses/:courseName/edit",
			name: "CreateCourse",
			component: () =>
				C(
					() => import("./CreateCourse-PkCZOpbW.js"),
					__vite__mapDeps([32, 1, 2, 23, 8, 10, 11, 12])
				),
			props: !0,
		},
	];
let be = wt({ history: $t("/"), routes: Gt });
be.beforeEach((e, t, a) =>
	Oe(void 0, null, function* () {
		const { userResource: r } = Me();
		let { isLoggedIn: n } = fe();
		try {
			n && (yield r.reload());
		} catch (s) {
			n = !1;
		}
		return a();
	})
);
let qt = ne([]),
	Qt = {
		name: "Dialogs",
		render() {
			return qt.value.map((e) =>
				ee(
					St,
					{
						options: e,
						modelValue: e.show,
						"onUpdate:modelValue": (t) => (e.show = t),
					},
					() => [
						ee(
							"p",
							{ class: "text-p-base text-gray-700" },
							e.message
						),
						ee(Mt, { class: "mt-2", message: e.error }),
					]
				)
			);
		},
	};
function Xt() {
	const e = Fe({ width: window.innerWidth, height: window.innerHeight }),
		t = () => {
			(e.width = window.innerWidth), (e.height = window.innerHeight);
		};
	return (
		bt(() => {
			window.addEventListener("resize", t);
		}),
		Dt(() => {
			window.removeEventListener("resize", t);
		}),
		e
	);
}
const er = {},
	tr = {
		width: "118",
		height: "118",
		viewBox: "0 0 118 118",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
	},
	rr = Ct(
		'<path d="M93.9278 0H23.1013C10.3428 0 0 10.3428 0 23.1013V93.9278C0 106.686 10.3428 117.029 23.1013 117.029H93.9278C106.686 117.029 117.029 106.686 117.029 93.9278V23.1013C117.029 10.3428 106.686 0 93.9278 0Z" fill="url(#paint0_radial_174_336)"></path><path d="M93.9278 0H23.1013C10.3428 0 0 10.3428 0 23.1013V93.9278C0 106.686 10.3428 117.029 23.1013 117.029H93.9278C106.686 117.029 117.029 106.686 117.029 93.9278V23.1013C117.029 10.3428 106.686 0 93.9278 0Z" fill="#0B3D3D" fill-opacity="0.8"></path><path d="M95.1879 33.1294L91.4077 32.0268C80.1721 28.7716 67.9389 30.9242 58.5409 37.7496C52.083 33.0769 43.9975 30.5042 36.1746 30.5042H21.8938V41.0048H36.2796C42.2649 41.0048 48.1978 42.9999 52.923 46.6226L58.5934 50.9279L64.2637 46.6226C70.144 42.1599 77.5469 40.2698 84.7923 41.2673V76.1818C75.5518 75.2367 66.2063 77.7044 58.6459 83.2172C51.0854 77.7044 41.6349 75.2367 32.4994 76.1818V52.8705H21.9988V86.4724H95.3454V33.1294H95.1879Z" fill="#58FF9B"></path><defs><radialGradient id="paint0_radial_174_336" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117.24 -101.5) rotate(105.042) scale(226.282)"><stop offset="0.445162" stop-color="#1F7676"></stop><stop offset="1" stop-color="#0A4B4B"></stop></radialGradient></defs>',
		4
	),
	ar = [rr];
function nr(e, t) {
	return M(), O("svg", tr, ar);
}
const sr = je(er, [["render", nr]]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ var ie = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	"stroke-width": 2,
	"stroke-linecap": "round",
	"stroke-linejoin": "round",
};
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const or = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
	H =
		(e, t) =>
		(l, { attrs: c, slots: u }) => {
			var m = l,
				{
					size: a,
					strokeWidth: r = 2,
					absoluteStrokeWidth: n,
					color: s,
					class: o,
				} = m,
				i = xe(m, [
					"size",
					"strokeWidth",
					"absoluteStrokeWidth",
					"color",
					"class",
				]);
			return ee(
				"svg",
				X(
					_e(
						X(
							_e(X({}, ie), {
								width: a || ie.width,
								height: a || ie.height,
								stroke: s || ie.stroke,
								"stroke-width": n
									? (Number(r) * 24) / Number(a)
									: r,
							}),
							c
						),
						{ class: ["lucide", `lucide-${or(e)}`] }
					),
					i
				),
				[...t.map((f) => ee(...f)), ...(u.default ? [u.default()] : [])]
			);
		};
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const ir = H("BookOpenIcon", [
	["path", { d: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", key: "vv98re" }],
	[
		"path",
		{ d: "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z", key: "1cyq3y" },
	],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const cr = H("BriefcaseIcon", [
	[
		"rect",
		{
			width: "20",
			height: "14",
			x: "2",
			y: "7",
			rx: "2",
			ry: "2",
			key: "eto64e",
		},
	],
	[
		"path",
		{ d: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16", key: "zwj3tp" },
	],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const ur = H("ChevronDownIcon", [
	["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const lr = H("LogInIcon", [
	["path", { d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4", key: "u53s6r" }],
	["polyline", { points: "10 17 15 12 10 7", key: "1ail0h" }],
	["line", { x1: "15", x2: "3", y1: "12", y2: "12", key: "v6grx8" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const fr = H("LogOutIcon", [
	["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", key: "1uf3rs" }],
	["polyline", { points: "16 17 21 12 16 7", key: "1gabdz" }],
	["line", { x1: "21", x2: "9", y1: "12", y2: "12", key: "1uyos4" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const dr = H("TrendingUpIcon", [
	["polyline", { points: "22 7 13.5 15.5 8.5 10.5 2 17", key: "126l90" }],
	["polyline", { points: "16 7 22 7 22 13", key: "kwv8wd" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const hr = H("UserIcon", [
	["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", key: "975kel" }],
	["circle", { cx: "12", cy: "7", r: "4", key: "17ys0d" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const pr = H("UsersIcon", [
	["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
	["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
	["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
	["path", { d: "M16 3.13a4 4 0 0 1 0 7.75", key: "1da9ce" }],
]);
function ya(e) {
	kt(X({ position: "bottom-right" }, e));
}
function ga(e) {
	return Lt(e).value;
}
function Aa(e) {
	if (!e) return "";
	const [t, a] = e.split(":").map(Number),
		r = new Date(0, 0, 0, t, a);
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "numeric",
		hour12: !0,
	}).format(r);
}
function wa(e, t) {
	return e
		? e.toLocaleString("en-IN", {
				maximumFractionDigits: 0,
				style: "currency",
				currency: t,
		  })
		: "";
}
function mr(e) {
	return e
		? e
				.toLowerCase()
				.split(" ")
				.map(function (t) {
					return t.charAt(0).toUpperCase().concat(t.substr(1));
				})
				.join(" ")
		: "";
}
function $a(e) {
	let t = parseInt(e);
	return t > 1048576
		? (t / 1048576).toFixed(2) + "M"
		: t > 1024
		? (t / 1024).toFixed(2) + "K"
		: t;
}
function Sa() {
	return [
		"Pacific/Midway",
		"Pacific/Pago_Pago",
		"Pacific/Honolulu",
		"America/Anchorage",
		"America/Vancouver",
		"America/Los_Angeles",
		"America/Tijuana",
		"America/Edmonton",
		"America/Denver",
		"America/Phoenix",
		"America/Mazatlan",
		"America/Winnipeg",
		"America/Regina",
		"America/Chicago",
		"America/Mexico_City",
		"America/Guatemala",
		"America/El_Salvador",
		"America/Managua",
		"America/Costa_Rica",
		"America/Montreal",
		"America/New_York",
		"America/Indianapolis",
		"America/Panama",
		"America/Bogota",
		"America/Lima",
		"America/Halifax",
		"America/Puerto_Rico",
		"America/Caracas",
		"America/Santiago",
		"America/St_Johns",
		"America/Montevideo",
		"America/Araguaina",
		"America/Argentina/Buenos_Aires",
		"America/Godthab",
		"America/Sao_Paulo",
		"Atlantic/Azores",
		"Canada/Atlantic",
		"Atlantic/Cape_Verde",
		"UTC",
		"Etc/Greenwich",
		"Europe/Belgrade",
		"CET",
		"Atlantic/Reykjavik",
		"Europe/Dublin",
		"Europe/London",
		"Europe/Lisbon",
		"Africa/Casablanca",
		"Africa/Nouakchott",
		"Europe/Oslo",
		"Europe/Copenhagen",
		"Europe/Brussels",
		"Europe/Berlin",
		"Europe/Helsinki",
		"Europe/Amsterdam",
		"Europe/Rome",
		"Europe/Stockholm",
		"Europe/Vienna",
		"Europe/Luxembourg",
		"Europe/Paris",
		"Europe/Zurich",
		"Europe/Madrid",
		"Africa/Bangui",
		"Africa/Algiers",
		"Africa/Tunis",
		"Africa/Harare",
		"Africa/Nairobi",
		"Europe/Warsaw",
		"Europe/Prague",
		"Europe/Budapest",
		"Europe/Sofia",
		"Europe/Istanbul",
		"Europe/Athens",
		"Europe/Bucharest",
		"Asia/Nicosia",
		"Asia/Beirut",
		"Asia/Damascus",
		"Asia/Jerusalem",
		"Asia/Amman",
		"Africa/Tripoli",
		"Africa/Cairo",
		"Africa/Johannesburg",
		"Europe/Moscow",
		"Asia/Baghdad",
		"Asia/Kuwait",
		"Asia/Riyadh",
		"Asia/Bahrain",
		"Asia/Qatar",
		"Asia/Aden",
		"Asia/Tehran",
		"Africa/Khartoum",
		"Africa/Djibouti",
		"Africa/Mogadishu",
		"Asia/Dubai",
		"Asia/Muscat",
		"Asia/Baku",
		"Asia/Kabul",
		"Asia/Yekaterinburg",
		"Asia/Tashkent",
		"Asia/Calcutta",
		"Asia/Kathmandu",
		"Asia/Novosibirsk",
		"Asia/Almaty",
		"Asia/Dacca",
		"Asia/Krasnoyarsk",
		"Asia/Dhaka",
		"Asia/Bangkok",
		"Asia/Saigon",
		"Asia/Jakarta",
		"Asia/Irkutsk",
		"Asia/Shanghai",
		"Asia/Hong_Kong",
		"Asia/Taipei",
		"Asia/Kuala_Lumpur",
		"Asia/Singapore",
		"Australia/Perth",
		"Asia/Yakutsk",
		"Asia/Seoul",
		"Asia/Tokyo",
		"Australia/Darwin",
		"Australia/Adelaide",
		"Asia/Vladivostok",
		"Pacific/Port_Moresby",
		"Australia/Brisbane",
		"Australia/Sydney",
		"Australia/Hobart",
		"Asia/Magadan",
		"SST",
		"Pacific/Noumea",
		"Asia/Kamchatka",
		"Pacific/Fiji",
		"Pacific/Auckland",
		"Asia/Kolkata",
		"Europe/Kiev",
		"America/Tegucigalpa",
		"Pacific/Apia",
	];
}
function qe() {
	return [
		{
			label: "Courses",
			icon: ir,
			to: "Courses",
			activeFor: ["Courses", "CourseDetail", "Lesson"],
		},
		{
			label: "Batches",
			icon: pr,
			to: "Batches",
			activeFor: ["Batches", "BatchDetail", "Batch"],
		},
		{
			label: "Jobs",
			icon: cr,
			to: "Jobs",
			activeFor: ["Jobs", "JobDetail"],
		},
		{ label: "Statistics", icon: dr, to: "Statistics" },
	];
}
const vr = $(
		"div",
		{ class: "text-base font-medium text-gray-900 leading-none" },
		" Learning ",
		-1
	),
	_r = { key: 0, class: "mt-1 text-sm text-gray-700 leading-none" },
	yr = {
		__name: "UserDropdown",
		props: { isCollapsed: { type: Boolean, default: !1 } },
		setup(e) {
			const t = $e(),
				{ logout: a, user: r } = fe();
			let { isLoggedIn: n } = fe();
			const s = [
				{
					icon: hr,
					label: "My Profile",
					onClick: () => {
						var o;
						t.push(
							`/user/${
								(o = r.data) == null ? void 0 : o.username
							}`
						);
					},
					condition: () => n,
				},
				{
					icon: fr,
					label: "Log out",
					onClick: () => {
						a.submit().then(() => {
							n = !1;
						});
					},
					condition: () => n,
				},
				{
					icon: lr,
					label: "Log in",
					onClick: () => {
						window.location.href = "/login";
					},
					condition: () => !n,
				},
			];
			return (o, i) => (
				M(),
				he(
					g(Et),
					{ options: s },
					{
						default: pe(({ open: c }) => [
							$(
								"button",
								{
									class: R([
										"flex h-12 py-2 items-center rounded-md duration-300 ease-in-out",
										e.isCollapsed
											? "px-0 w-auto"
											: c
											? "bg-white shadow-sm px-2 w-52"
											: "hover:bg-gray-200 px-2 w-52",
									]),
								},
								[
									T(sr, {
										class: "w-8 h-8 rounded flex-shrink-0",
									}),
									$(
										"div",
										{
											class: R([
												"flex flex-1 flex-col text-left duration-300 ease-in-out",
												e.isCollapsed
													? "opacity-0 ml-0 w-0 overflow-hidden"
													: "opacity-100 ml-2 w-auto",
											]),
										},
										[
											vr,
											g(r)
												? (M(),
												  O(
														"div",
														_r,
														Ve(
															g(mr)(
																g(r).split(
																	"@"
																)[0]
															)
														),
														1
												  ))
												: Ye("", !0),
										],
										2
									),
									$(
										"div",
										{
											class: R([
												"duration-300 ease-in-out",
												e.isCollapsed
													? "opacity-0 ml-0 w-0 overflow-hidden"
													: "opacity-100 ml-2 w-auto",
											]),
										},
										[
											T(g(ur), {
												class: "h-4 w-4 text-gray-700",
											}),
										],
										2
									),
								],
								2
							),
						]),
						_: 1,
					}
				)
			);
		},
	},
	gr = {},
	Ar = {
		width: "18",
		height: "18",
		viewBox: "0 0 18 18",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
	},
	wr = $(
		"path",
		{
			d: "M10.875 9.06223L3 9.06232",
			stroke: "currentColor",
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
		},
		null,
		-1
	),
	$r = $(
		"path",
		{
			d: "M6.74537 5.31699L3 9.06236L6.74527 12.8076",
			stroke: "currentColor",
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
		},
		null,
		-1
	),
	Sr = $(
		"path",
		{
			d: "M14.1423 4L14.1423 14.125",
			stroke: "currentColor",
			"stroke-linecap": "round",
		},
		null,
		-1
	),
	Mr = [wr, $r, Sr];
function br(e, t) {
	return M(), O("svg", Ar, Mr);
}
const Dr = je(gr, [["render", br]]),
	Cr = { class: "grid h-5 w-6 flex-shrink-0 place-items-center" },
	Ie = {
		__name: "SidebarLink",
		props: {
			icon: { type: Function },
			label: { type: String, default: "" },
			to: { type: String, default: "" },
			activeFor: { type: Array, default: [] },
			isCollapsed: { type: Boolean, default: !1 },
		},
		setup(e) {
			const t = $e(),
				a = e;
			function r() {
				t.push({ name: a.to });
			}
			let n = se(() => a.activeFor.includes(t.currentRoute.value.name));
			return (s, o) => (
				M(),
				O(
					"button",
					{
						class: R([
							"flex h-7 cursor-pointer items-center rounded text-gray-800 duration-300 ease-in-out focus:outline-none focus:transition-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-gray-400",
							g(n) ? "bg-white shadow-sm" : "hover:bg-gray-100",
						]),
						onClick: r,
					},
					[
						$(
							"div",
							{
								class: R([
									"flex items-center duration-300 ease-in-out",
									e.isCollapsed ? "p-1" : "px-2 py-1",
								]),
							},
							[
								T(
									g(xt),
									{ text: e.label, placement: "right" },
									{
										default: pe(() => [
											le(s.$slots, "icon", {}, () => [
												$("span", Cr, [
													(M(),
													he(Ue(e.icon), {
														class: "h-5 w-5 stroke-1.5 text-gray-800",
													})),
												]),
											]),
										]),
										_: 3,
									},
									8,
									["text"]
								),
								$(
									"span",
									{
										class: R([
											"flex-shrink-0 text-base duration-300 ease-in-out",
											e.isCollapsed
												? "ml-0 w-0 overflow-hidden opacity-0"
												: "ml-2 w-auto opacity-100",
										]),
									},
									Ve(e.label),
									3
								),
							],
							2
						),
					],
					2
				)
			);
		},
	},
	kr = { class: "flex flex-col overflow-y-auto" },
	Lr = { class: "grid h-5 w-6 flex-shrink-0 place-items-center" },
	Er = {
		__name: "AppSidebar",
		setup(e) {
			const t = qe();
			let r = ne(Ot("sidebar_is_collapsed", !1));
			return (n, s) => (
				M(),
				O(
					"div",
					{
						class: R([
							"flex h-full flex-col justify-between transition-all duration-300 ease-in-out bg-gray-50",
							g(r) ? "w-14" : "w-56",
						]),
					},
					[
						$(
							"div",
							{
								class: R([
									"flex flex-col overflow-hidden",
									g(r) ? "items-center" : "",
								]),
							},
							[
								T(
									yr,
									{ class: "p-2", isCollapsed: g(r) },
									null,
									8,
									["isCollapsed"]
								),
								$("div", kr, [
									(M(!0),
									O(
										Se,
										null,
										We(
											g(t),
											(o) => (
												M(),
												he(
													Ie,
													{
														icon: o.icon,
														label: o.label,
														to: o.to,
														activeFor: o.activeFor,
														isCollapsed: g(r),
														class: "mx-2 my-0.5",
													},
													null,
													8,
													[
														"icon",
														"label",
														"to",
														"activeFor",
														"isCollapsed",
													]
												)
											)
										),
										256
									)),
								]),
							],
							2
						),
						T(
							Ie,
							{
								label: g(r) ? "Expand" : "Collapse",
								isCollapsed: g(r),
								onClick:
									s[0] ||
									(s[0] = (o) =>
										ae(r)
											? (r.value = !g(r))
											: (r = !g(r))),
								class: "m-2",
							},
							{
								icon: pe(() => [
									$("span", Lr, [
										T(
											Dr,
											{
												class: R([
													"h-4.5 w-4.5 text-gray-700 duration-300 ease-in-out",
													{
														"[transform:rotateY(180deg)]":
															g(r),
													},
												]),
											},
											null,
											8,
											["class"]
										),
									]),
								]),
								_: 1,
							},
							8,
							["label", "isCollapsed"]
						),
					],
					2
				)
			);
		},
	},
	xr = { class: "relative flex h-full flex-col" },
	Or = { class: "h-full flex-1" },
	Tr = { class: "flex h-full" },
	Ir = {
		class: "relative block min-h-0 flex-shrink-0 overflow-hidden hover:overflow-auto",
	},
	Pr = { class: "w-full overflow-auto", id: "scrollContainer" },
	Nr = {
		__name: "DesktopLayout",
		setup(e) {
			return (t, a) => (
				M(),
				O("div", xr, [
					$("div", Or, [
						$("div", Tr, [
							$("div", Ir, [le(t.$slots, "sidebar"), T(Er)]),
							$("div", Pr, [le(t.$slots, "default")]),
						]),
					]),
				])
			);
		},
	},
	Br = { class: "flex h-full flex-col" },
	Rr = { class: "h-full overflow-auto", id: "scrollContainer" },
	Fr = ["onClick"],
	Hr = {
		__name: "MobileLayout",
		setup(e) {
			const t = $e(),
				a = se(() => qe()),
				r = (n) => {
					t.push({ name: n.to });
				};
			return (n, s) => (
				M(),
				O("div", Br, [
					$("div", Rr, [le(n.$slots, "default")]),
					a.value
						? (M(),
						  O(
								"div",
								{
									key: 0,
									class: "grid grid-cols-5 border-t border-gray-300 standalone:pb-4",
									style: Tt({
										gridTemplateColumns: `repeat(${a.value.length}, minmax(0, 1fr))`,
									}),
								},
								[
									(M(!0),
									O(
										Se,
										null,
										We(
											a.value,
											(o) => (
												M(),
												O(
													"button",
													{
														key: o.label,
														class: "flex flex-col items-center justify-center py-3 transition active:scale-95",
														onClick: (i) => r(o),
													},
													[
														(M(),
														he(Ue(o.icon), {
															class: "h-6 w-6 stroke-1.5 text-gray-700",
														})),
													],
													8,
													Fr
												)
											)
										),
										128
									)),
								],
								4
						  ))
						: Ye("", !0),
				])
			);
		},
	},
	jr = {
		__name: "App",
		setup(e) {
			const t = Xt(),
				a = se(() => (t.width < 640 ? Hr : Nr));
			return (r, n) => {
				const s = Pt("router-view");
				return (
					M(),
					O(
						Se,
						null,
						[
							T(g(a), null, { default: pe(() => [T(s)]), _: 1 }),
							T(g(Qt)),
							T(g(It)),
						],
						64
					)
				);
			};
		},
	};
var Qe = 60,
	Xe = Qe * 60,
	et = Xe * 24,
	Vr = et * 7,
	Z = 1e3,
	ye = Qe * Z,
	Pe = Xe * Z,
	Yr = et * Z,
	Ur = Vr * Z,
	De = "millisecond",
	V = "second",
	Y = "minute",
	U = "hour",
	N = "day",
	ce = "week",
	x = "month",
	tt = "quarter",
	B = "year",
	K = "date",
	rt = "YYYY-MM-DDTHH:mm:ssZ",
	Ne = "Invalid Date",
	Wr =
		/^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/,
	zr =
		/\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g;
const Jr = {
	name: "en",
	weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split(
		"_"
	),
	months: "January_February_March_April_May_June_July_August_September_October_November_December".split(
		"_"
	),
	ordinal: function (t) {
		var a = ["th", "st", "nd", "rd"],
			r = t % 100;
		return "[" + t + (a[(r - 20) % 10] || a[r] || a[0]) + "]";
	},
};
var we = function (t, a, r) {
		var n = String(t);
		return !n || n.length >= a
			? t
			: "" + Array(a + 1 - n.length).join(r) + t;
	},
	Kr = function (t) {
		var a = -t.utcOffset(),
			r = Math.abs(a),
			n = Math.floor(r / 60),
			s = r % 60;
		return (a <= 0 ? "+" : "-") + we(n, 2, "0") + ":" + we(s, 2, "0");
	},
	Zr = function e(t, a) {
		if (t.date() < a.date()) return -e(a, t);
		var r = (a.year() - t.year()) * 12 + (a.month() - t.month()),
			n = t.clone().add(r, x),
			s = a - n < 0,
			o = t.clone().add(r + (s ? -1 : 1), x);
		return +(-(r + (a - n) / (s ? n - o : o - n)) || 0);
	},
	Gr = function (t) {
		return t < 0 ? Math.ceil(t) || 0 : Math.floor(t);
	},
	qr = function (t) {
		var a = {
			M: x,
			y: B,
			w: ce,
			d: N,
			D: K,
			h: U,
			m: Y,
			s: V,
			ms: De,
			Q: tt,
		};
		return (
			a[t] ||
			String(t || "")
				.toLowerCase()
				.replace(/s$/, "")
		);
	},
	Qr = function (t) {
		return t === void 0;
	};
const Xr = { s: we, z: Kr, m: Zr, a: Gr, p: qr, u: Qr };
var re = "en",
	W = {};
W[re] = Jr;
var at = "$isDayjsObject",
	Ce = function (t) {
		return t instanceof ve || !!(t && t[at]);
	},
	de = function e(t, a, r) {
		var n;
		if (!t) return re;
		if (typeof t == "string") {
			var s = t.toLowerCase();
			W[s] && (n = s), a && ((W[s] = a), (n = s));
			var o = t.split("-");
			if (!n && o.length > 1) return e(o[0]);
		} else {
			var i = t.name;
			(W[i] = t), (n = i);
		}
		return !r && n && (re = n), n || (!r && re);
	},
	v = function (t, a) {
		if (Ce(t)) return t.clone();
		var r = typeof a == "object" ? a : {};
		return (r.date = t), (r.args = arguments), new ve(r);
	},
	ea = function (t, a) {
		return v(t, { locale: a.$L, utc: a.$u, x: a.$x, $offset: a.$offset });
	},
	d = Xr;
d.l = de;
d.i = Ce;
d.w = ea;
var ta = function (t) {
		var a = t.date,
			r = t.utc;
		if (a === null) return new Date(NaN);
		if (d.u(a)) return new Date();
		if (a instanceof Date) return new Date(a);
		if (typeof a == "string" && !/Z$/i.test(a)) {
			var n = a.match(Wr);
			if (n) {
				var s = n[2] - 1 || 0,
					o = (n[7] || "0").substring(0, 3);
				return r
					? new Date(
							Date.UTC(
								n[1],
								s,
								n[3] || 1,
								n[4] || 0,
								n[5] || 0,
								n[6] || 0,
								o
							)
					  )
					: new Date(
							n[1],
							s,
							n[3] || 1,
							n[4] || 0,
							n[5] || 0,
							n[6] || 0,
							o
					  );
			}
		}
		return new Date(a);
	},
	ve = (function () {
		function e(a) {
			(this.$L = de(a.locale, null, !0)),
				this.parse(a),
				(this.$x = this.$x || a.x || {}),
				(this[at] = !0);
		}
		var t = e.prototype;
		return (
			(t.parse = function (r) {
				(this.$d = ta(r)), this.init();
			}),
			(t.init = function () {
				var r = this.$d;
				(this.$y = r.getFullYear()),
					(this.$M = r.getMonth()),
					(this.$D = r.getDate()),
					(this.$W = r.getDay()),
					(this.$H = r.getHours()),
					(this.$m = r.getMinutes()),
					(this.$s = r.getSeconds()),
					(this.$ms = r.getMilliseconds());
			}),
			(t.$utils = function () {
				return d;
			}),
			(t.isValid = function () {
				return this.$d.toString() !== Ne;
			}),
			(t.isSame = function (r, n) {
				var s = v(r);
				return this.startOf(n) <= s && s <= this.endOf(n);
			}),
			(t.isAfter = function (r, n) {
				return v(r) < this.startOf(n);
			}),
			(t.isBefore = function (r, n) {
				return this.endOf(n) < v(r);
			}),
			(t.$g = function (r, n, s) {
				return d.u(r) ? this[n] : this.set(s, r);
			}),
			(t.unix = function () {
				return Math.floor(this.valueOf() / 1e3);
			}),
			(t.valueOf = function () {
				return this.$d.getTime();
			}),
			(t.startOf = function (r, n) {
				var s = this,
					o = d.u(n) ? !0 : n,
					i = d.p(r),
					c = function (L, A) {
						var h = d.w(
							s.$u ? Date.UTC(s.$y, A, L) : new Date(s.$y, A, L),
							s
						);
						return o ? h : h.endOf(N);
					},
					u = function (L, A) {
						var h = [0, 0, 0, 0],
							b = [23, 59, 59, 999];
						return d.w(
							s
								.toDate()
								[L].apply(s.toDate("s"), (o ? h : b).slice(A)),
							s
						);
					},
					l = this.$W,
					m = this.$M,
					f = this.$D,
					y = "set" + (this.$u ? "UTC" : "");
				switch (i) {
					case B:
						return o ? c(1, 0) : c(31, 11);
					case x:
						return o ? c(1, m) : c(0, m + 1);
					case ce: {
						var S = this.$locale().weekStart || 0,
							k = (l < S ? l + 7 : l) - S;
						return c(o ? f - k : f + (6 - k), m);
					}
					case N:
					case K:
						return u(y + "Hours", 0);
					case U:
						return u(y + "Minutes", 1);
					case Y:
						return u(y + "Seconds", 2);
					case V:
						return u(y + "Milliseconds", 3);
					default:
						return this.clone();
				}
			}),
			(t.endOf = function (r) {
				return this.startOf(r, !1);
			}),
			(t.$set = function (r, n) {
				var s,
					o = d.p(r),
					i = "set" + (this.$u ? "UTC" : ""),
					c = ((s = {}),
					(s[N] = i + "Date"),
					(s[K] = i + "Date"),
					(s[x] = i + "Month"),
					(s[B] = i + "FullYear"),
					(s[U] = i + "Hours"),
					(s[Y] = i + "Minutes"),
					(s[V] = i + "Seconds"),
					(s[De] = i + "Milliseconds"),
					s)[o],
					u = o === N ? this.$D + (n - this.$W) : n;
				if (o === x || o === B) {
					var l = this.clone().set(K, 1);
					l.$d[c](u),
						l.init(),
						(this.$d = l.set(
							K,
							Math.min(this.$D, l.daysInMonth())
						).$d);
				} else c && this.$d[c](u);
				return this.init(), this;
			}),
			(t.set = function (r, n) {
				return this.clone().$set(r, n);
			}),
			(t.get = function (r) {
				return this[d.p(r)]();
			}),
			(t.add = function (r, n) {
				var s = this,
					o;
				r = Number(r);
				var i = d.p(n),
					c = function (f) {
						var y = v(s);
						return d.w(y.date(y.date() + Math.round(f * r)), s);
					};
				if (i === x) return this.set(x, this.$M + r);
				if (i === B) return this.set(B, this.$y + r);
				if (i === N) return c(1);
				if (i === ce) return c(7);
				var u =
						((o = {}), (o[Y] = ye), (o[U] = Pe), (o[V] = Z), o)[
							i
						] || 1,
					l = this.$d.getTime() + r * u;
				return d.w(l, this);
			}),
			(t.subtract = function (r, n) {
				return this.add(r * -1, n);
			}),
			(t.format = function (r) {
				var n = this,
					s = this.$locale();
				if (!this.isValid()) return s.invalidDate || Ne;
				var o = r || rt,
					i = d.z(this),
					c = this.$H,
					u = this.$m,
					l = this.$M,
					m = s.weekdays,
					f = s.months,
					y = s.meridiem,
					S = function (h, b, w, z) {
						return (h && (h[b] || h(n, o))) || w[b].slice(0, z);
					},
					k = function (h) {
						return d.s(c % 12 || 12, h, "0");
					},
					D =
						y ||
						function (A, h, b) {
							var w = A < 12 ? "AM" : "PM";
							return b ? w.toLowerCase() : w;
						},
					L = function (h) {
						switch (h) {
							case "YY":
								return String(n.$y).slice(-2);
							case "YYYY":
								return d.s(n.$y, 4, "0");
							case "M":
								return l + 1;
							case "MM":
								return d.s(l + 1, 2, "0");
							case "MMM":
								return S(s.monthsShort, l, f, 3);
							case "MMMM":
								return S(f, l);
							case "D":
								return n.$D;
							case "DD":
								return d.s(n.$D, 2, "0");
							case "d":
								return String(n.$W);
							case "dd":
								return S(s.weekdaysMin, n.$W, m, 2);
							case "ddd":
								return S(s.weekdaysShort, n.$W, m, 3);
							case "dddd":
								return m[n.$W];
							case "H":
								return String(c);
							case "HH":
								return d.s(c, 2, "0");
							case "h":
								return k(1);
							case "hh":
								return k(2);
							case "a":
								return D(c, u, !0);
							case "A":
								return D(c, u, !1);
							case "m":
								return String(u);
							case "mm":
								return d.s(u, 2, "0");
							case "s":
								return String(n.$s);
							case "ss":
								return d.s(n.$s, 2, "0");
							case "SSS":
								return d.s(n.$ms, 3, "0");
							case "Z":
								return i;
						}
						return null;
					};
				return o.replace(zr, function (A, h) {
					return h || L(A) || i.replace(":", "");
				});
			}),
			(t.utcOffset = function () {
				return -Math.round(this.$d.getTimezoneOffset() / 15) * 15;
			}),
			(t.diff = function (r, n, s) {
				var o = this,
					i = d.p(n),
					c = v(r),
					u = (c.utcOffset() - this.utcOffset()) * ye,
					l = this - c,
					m = function () {
						return d.m(o, c);
					},
					f;
				switch (i) {
					case B:
						f = m() / 12;
						break;
					case x:
						f = m();
						break;
					case tt:
						f = m() / 3;
						break;
					case ce:
						f = (l - u) / Ur;
						break;
					case N:
						f = (l - u) / Yr;
						break;
					case U:
						f = l / Pe;
						break;
					case Y:
						f = l / ye;
						break;
					case V:
						f = l / Z;
						break;
					default:
						f = l;
						break;
				}
				return s ? f : d.a(f);
			}),
			(t.daysInMonth = function () {
				return this.endOf(x).$D;
			}),
			(t.$locale = function () {
				return W[this.$L];
			}),
			(t.locale = function (r, n) {
				if (!r) return this.$L;
				var s = this.clone(),
					o = de(r, n, !0);
				return o && (s.$L = o), s;
			}),
			(t.clone = function () {
				return d.w(this.$d, this);
			}),
			(t.toDate = function () {
				return new Date(this.valueOf());
			}),
			(t.toJSON = function () {
				return this.isValid() ? this.toISOString() : null;
			}),
			(t.toISOString = function () {
				return this.$d.toISOString();
			}),
			(t.toString = function () {
				return this.$d.toUTCString();
			}),
			e
		);
	})(),
	nt = ve.prototype;
v.prototype = nt;
[
	["$ms", De],
	["$s", V],
	["$m", Y],
	["$H", U],
	["$W", N],
	["$M", x],
	["$y", B],
	["$D", K],
].forEach(function (e) {
	nt[e[1]] = function (t) {
		return this.$g(t, e[0], e[1]);
	};
});
v.extend = function (e, t) {
	return e.$i || (e(t, ve, v), (e.$i = !0)), v;
};
v.locale = de;
v.isDayjs = Ce;
v.unix = function (e) {
	return v(e * 1e3);
};
v.en = W[re];
v.Ls = W;
v.p = {};
const ra = function (e, t, a) {
	e = e || {};
	var r = t.prototype,
		n = {
			future: "in %s",
			past: "%s ago",
			s: "a few seconds",
			m: "a minute",
			mm: "%d minutes",
			h: "an hour",
			hh: "%d hours",
			d: "a day",
			dd: "%d days",
			M: "a month",
			MM: "%d months",
			y: "a year",
			yy: "%d years",
		};
	(a.en.relativeTime = n),
		(r.fromToBase = function (i, c, u, l, m) {
			for (
				var f = u.$locale().relativeTime || n,
					y = e.thresholds || [
						{ l: "s", r: 44, d: V },
						{ l: "m", r: 89 },
						{ l: "mm", r: 44, d: Y },
						{ l: "h", r: 89 },
						{ l: "hh", r: 21, d: U },
						{ l: "d", r: 35 },
						{ l: "dd", r: 25, d: N },
						{ l: "M", r: 45 },
						{ l: "MM", r: 10, d: x },
						{ l: "y", r: 17 },
						{ l: "yy", d: B },
					],
					S = y.length,
					k,
					D,
					L,
					A = 0;
				A < S;
				A += 1
			) {
				var h = y[A];
				h.d && (k = l ? a(i).diff(u, h.d, !0) : u.diff(i, h.d, !0));
				var b = (e.rounding || Math.round)(Math.abs(k));
				if (((L = k > 0), b <= h.r || !h.r)) {
					b <= 1 && A > 0 && (h = y[A - 1]);
					var w = f[h.l];
					m && (b = m("" + b)),
						typeof w == "string"
							? (D = w.replace("%d", b))
							: (D = w(b, c, h.l, L));
					break;
				}
			}
			if (c) return D;
			var z = L ? f.future : f.past;
			return typeof z == "function" ? z(D) : z.replace("%s", D);
		});
	function s(i, c, u, l) {
		return r.fromToBase(i, c, u, l);
	}
	(r.to = function (i, c) {
		return s(i, c, this, !0);
	}),
		(r.from = function (i, c) {
			return s(i, c, this);
		});
	var o = function (c) {
		return c.$u ? a.utc() : a();
	};
	(r.toNow = function (i) {
		return this.to(o(this), i);
	}),
		(r.fromNow = function (i) {
			return this.from(o(this), i);
		});
};
var aa = function (t) {
		return t.replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g, function (a, r, n) {
			return r || n.slice(1);
		});
	},
	st = {
		LTS: "h:mm:ss A",
		LT: "h:mm A",
		L: "MM/DD/YYYY",
		LL: "MMMM D, YYYY",
		LLL: "MMMM D, YYYY h:mm A",
		LLLL: "dddd, MMMM D, YYYY h:mm A",
	},
	na = function (t, a) {
		return t.replace(
			/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,
			function (r, n, s) {
				var o = s && s.toUpperCase();
				return n || a[s] || st[s] || aa(a[o]);
			}
		);
	};
const sa = function (e, t, a) {
		var r = t.prototype,
			n = r.format;
		(a.en.formats = st),
			(r.format = function (s) {
				s === void 0 && (s = rt);
				var o = this.$locale(),
					i = o.formats,
					c = i === void 0 ? {} : i,
					u = na(s, c);
				return n.call(this, u);
			});
	},
	oa = function (e, t, a) {
		a.updateLocale = function (r, n) {
			var s = a.Ls,
				o = s[r];
			if (o) {
				var i = n ? Object.keys(n) : [];
				return (
					i.forEach(function (c) {
						o[c] = n[c];
					}),
					o
				);
			}
		};
	},
	ia = function (e, t, a) {
		var r = t.prototype;
		r.isToday = function () {
			var n = "YYYY-MM-DD",
				s = a();
			return this.format(n) === s.format(n);
		};
	},
	ca = function (e, t) {
		t.prototype.isSameOrBefore = function (a, r) {
			return this.isSame(a, r) || this.isBefore(a, r);
		};
	},
	ua = function (e, t) {
		t.prototype.isSameOrAfter = function (a, r) {
			return this.isSame(a, r) || this.isAfter(a, r);
		};
	};
v.extend(oa);
v.extend(ra);
v.extend(sa);
v.extend(ia);
v.extend(ca);
v.extend(ua);
function la(e) {
	(e.config.globalProperties.__ = fa), window.translatedMessages || da();
}
function fa(e) {
	let a = (window.translatedMessages || {})[e] || e;
	return /{\d+}/.test(e)
		? {
				format: function (...n) {
					return a.replace(/{(\d+)}/g, function (s, o) {
						return typeof n[o] != "undefined" ? n[o] : s;
					});
				},
		  }
		: a;
}
function da(e) {
	ue({
		url: "lms.lms.api.get_translations",
		cache: "translations",
		auto: !0,
		transform: (t) => {
			window.translatedMessages = t;
		},
	});
}
const ha = 9e3;
function pa() {
	let e = window.location.hostname,
		t = window.site_name || e,
		a = window.location.port ? `:${ha}` : "",
		n = `${a ? "http" : "https"}://${e}${a}/${t}`,
		s = Nt(n, { withCredentials: !0, reconnectionAttempts: 5 });
	return (
		s.on("refetch_resource", (o) => {
			if (o.cache_key) {
				let i = Bt(o.cache_key) || Rt(o.cache_key);
				i && i.reload();
			}
		}),
		s
	);
}
let ma = Ut(),
	P = Ft(jr);
Vt("resourceFetcher", Yt);
P.use(Ht);
P.use(ma);
P.use(be);
P.use(la);
P.use(jt);
P.provide("$dayjs", v);
P.provide("$socket", pa());
P.mount("#app");
const { userResource: ot } = Me();
fe();
P.provide("$user", ot);
P.config.globalProperties.$user = ot;
export {
	ir as B,
	ur as C,
	lr as L,
	pr as U,
	H as a,
	wa as b,
	ya as c,
	$a as d,
	mr as e,
	Aa as f,
	Sa as g,
	fe as s,
	ga as t,
};
function __vite__mapDeps(indexes) {
	if (!__vite__mapDeps.viteFileDeps) {
		__vite__mapDeps.viteFileDeps = [
			"assets/Home-dYmUETrl.js",
			"assets/frappe-ui-n1bXVQkV.js",
			"assets/frappe-ui-dYBF8eAq.css",
			"assets/Courses-ysBRUCIO.js",
			"assets/CourseCard-I7Cj-Ne7.js",
			"assets/UserAvatar-3mSOKoKa.js",
			"assets/star-O1ih2gFp.js",
			"assets/CourseCard-Ld7NFsgL.css",
			"assets/plus-w56hNznP.js",
			"assets/CourseDetail-V5AjKcOc.js",
			"assets/CourseOutline-mDbSZeRP.js",
			"assets/file-text-dAqD9clk.js",
			"assets/CourseOutline-qvlFmNZy.css",
			"assets/CourseDetail-SyEqAeUc.css",
			"assets/Lesson-_6tXx-Z1.js",
			"assets/Discussions-MQ_bdV9n.js",
			"assets/Lesson--a_FsKFL.css",
			"assets/Batches-CJG8qsGy.js",
			"assets/clock-nM1CyeA6.js",
			"assets/Batches-1PjOhl-q.css",
			"assets/BatchDetail-Bb9JTSid.js",
			"assets/BatchDetail-AhnKex4u.css",
			"assets/Batch-UFfl4NY5.js",
			"assets/Link-xVzNCgtj.js",
			"assets/book-open-check-c5K78KcT.js",
			"assets/Batch-oDSZMopQ.css",
			"assets/Billing-kqTZfaAQ.js",
			"assets/Statistics-HRvuiWCP.js",
			"assets/Profile-dLRFEpeq.js",
			"assets/Jobs-RxlTvly_.js",
			"assets/map-pin-Ko1oZ6mp.js",
			"assets/JobDetail-1dm4725M.js",
			"assets/CreateCourse-PkCZOpbW.js",
		];
	}
	return indexes.map((i) => __vite__mapDeps.viteFileDeps[i]);
}
//# sourceMappingURL=index-xt-hKVBz.js.map
