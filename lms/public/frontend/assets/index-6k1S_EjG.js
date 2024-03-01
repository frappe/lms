var lt = Object.defineProperty,
	ft = Object.defineProperties;
var dt = Object.getOwnPropertyDescriptors;
var se = Object.getOwnPropertySymbols;
var Ee = Object.prototype.hasOwnProperty,
	xe = Object.prototype.propertyIsEnumerable;
var Le = (e, t, a) =>
		t in e
			? lt(e, t, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: a,
			  })
			: (e[t] = a),
	X = (e, t) => {
		for (var a in t || (t = {})) Ee.call(t, a) && Le(e, a, t[a]);
		if (se) for (var a of se(t)) xe.call(t, a) && Le(e, a, t[a]);
		return e;
	},
	ye = (e, t) => ft(e, dt(t));
var Oe = (e, t) => {
	var a = {};
	for (var r in e) Ee.call(e, r) && t.indexOf(r) < 0 && (a[r] = e[r]);
	if (e != null && se)
		for (var r of se(e)) t.indexOf(r) < 0 && xe.call(e, r) && (a[r] = e[r]);
	return a;
};
var Te = (e, t, a) =>
	new Promise((r, n) => {
		var o = (c) => {
				try {
					i(a.next(c));
				} catch (u) {
					n(u);
				}
			},
			s = (c) => {
				try {
					i(a.throw(c));
				} catch (u) {
					n(u);
				}
			},
			i = (c) =>
				c.done ? r(c.value) : Promise.resolve(c.value).then(o, s);
		i((a = a.apply(e, t)).next());
	});
import {
	e as Fe,
	r as ne,
	m as He,
	i as ht,
	w as pt,
	a as Ve,
	b as ae,
	c as je,
	t as mt,
	d as vt,
	g as _t,
	o as yt,
	n as gt,
	h as At,
	f as wt,
	j as oe,
	k as ue,
	l as $t,
	p as St,
	_ as D,
	q as ee,
	D as Mt,
	E as bt,
	s as Dt,
	u as Ct,
	v as Ye,
	x as M,
	y as O,
	z as kt,
	A as Lt,
	B as Et,
	C as Se,
	F as pe,
	G as me,
	H as $,
	I as R,
	J as T,
	K as g,
	L as le,
	M as Ue,
	N as xt,
	O as fe,
	P as We,
	T as Ot,
	Q as Me,
	R as ze,
	S as Tt,
	U as Ie,
	V as It,
	W as Pt,
	X as Nt,
	Y as Bt,
	Z as Rt,
	$ as Ft,
	a0 as Ht,
	a1 as Vt,
	a2 as jt,
	a3 as Yt,
	a4 as Ut,
} from "./frappe-ui-LT4YqXtx.js";
(function () {
	const t = document.createElement("link").relList;
	if (t && t.supports && t.supports("modulepreload")) return;
	for (const n of document.querySelectorAll('link[rel="modulepreload"]'))
		r(n);
	new MutationObserver((n) => {
		for (const o of n)
			if (o.type === "childList")
				for (const s of o.addedNodes)
					s.tagName === "LINK" && s.rel === "modulepreload" && r(s);
	}).observe(document, { childList: !0, subtree: !0 });
	function a(n) {
		const o = {};
		return (
			n.integrity && (o.integrity = n.integrity),
			n.referrerPolicy && (o.referrerPolicy = n.referrerPolicy),
			n.crossOrigin === "use-credentials"
				? (o.credentials = "include")
				: n.crossOrigin === "anonymous"
				? (o.credentials = "omit")
				: (o.credentials = "same-origin"),
			o
		);
	}
	function r(n) {
		if (n.ep) return;
		n.ep = !0;
		const o = a(n);
		fetch(n.href, o);
	}
})();
/*!
 * pinia v2.1.7
 * (c) 2023 Eduardo San Martin Morote
 * @license MIT
 */ let Je;
const ve = (e) => (Je = e),
	Ke = Symbol();
function Ae(e) {
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
function Wt() {
	const e = Fe(!0),
		t = e.run(() => ne({}));
	let a = [],
		r = [];
	const n = He({
		install(o) {
			ve(n),
				(n._a = o),
				o.provide(Ke, n),
				(o.config.globalProperties.$pinia = n),
				r.forEach((s) => a.push(s)),
				(r = []);
		},
		use(o) {
			return !this._a && !ht ? r.push(o) : a.push(o), this;
		},
		_p: a,
		_a: null,
		_e: e,
		_s: new Map(),
		state: t,
	});
	return n;
}
const Ze = () => {};
function Pe(e, t, a, r = Ze) {
	e.push(t);
	const n = () => {
		const o = e.indexOf(t);
		o > -1 && (e.splice(o, 1), r());
	};
	return !a && _t() && yt(n), n;
}
function J(e, ...t) {
	e.slice().forEach((a) => {
		a(...t);
	});
}
const zt = (e) => e();
function we(e, t) {
	e instanceof Map && t instanceof Map && t.forEach((a, r) => e.set(r, a)),
		e instanceof Set && t instanceof Set && t.forEach(e.add, e);
	for (const a in t) {
		if (!t.hasOwnProperty(a)) continue;
		const r = t[a],
			n = e[a];
		Ae(n) && Ae(r) && e.hasOwnProperty(a) && !ae(r) && !je(r)
			? (e[a] = we(n, r))
			: (e[a] = r);
	}
	return e;
}
const Jt = Symbol();
function Kt(e) {
	return !Ae(e) || !e.hasOwnProperty(Jt);
}
const { assign: F } = Object;
function Zt(e) {
	return !!(ae(e) && e.effect);
}
function Gt(e, t, a, r) {
	const { state: n, actions: o, getters: s } = t,
		i = a.state.value[e];
	let c;
	function u() {
		i || (a.state.value[e] = n ? n() : {});
		const l = wt(a.state.value[e]);
		return F(
			l,
			o,
			Object.keys(s || {}).reduce(
				(m, f) => (
					(m[f] = He(
						oe(() => {
							ve(a);
							const y = a._s.get(e);
							return s[f].call(y, y);
						})
					)),
					m
				),
				{}
			)
		);
	}
	return (c = Ge(e, u, t, a, r, !0)), c;
}
function Ge(e, t, a = {}, r, n, o) {
	let s;
	const i = F({ actions: {} }, a),
		c = { deep: !0 };
	let u,
		l,
		m = [],
		f = [],
		y;
	const S = r.state.value[e];
	!o && !S && (r.state.value[e] = {}), ne({});
	let k;
	function C(_) {
		let p;
		(u = l = !1),
			typeof _ == "function"
				? (_(r.state.value[e]),
				  (p = { type: te.patchFunction, storeId: e, events: y }))
				: (we(r.state.value[e], _),
				  (p = {
						type: te.patchObject,
						payload: _,
						storeId: e,
						events: y,
				  }));
		const I = (k = Symbol());
		gt().then(() => {
			k === I && (u = !0);
		}),
			(l = !0),
			J(m, p, r.state.value[e]);
	}
	const L = o
		? function () {
				const { state: p } = a,
					I = p ? p() : {};
				this.$patch((V) => {
					F(V, I);
				});
		  }
		: Ze;
	function A() {
		s.stop(), (m = []), (f = []), r._s.delete(e);
	}
	function h(_, p) {
		return function () {
			ve(r);
			const I = Array.from(arguments),
				V = [],
				q = [];
			function ct(E) {
				V.push(E);
			}
			function ut(E) {
				q.push(E);
			}
			J(f, { args: I, name: _, store: w, after: ct, onError: ut });
			let Q;
			try {
				Q = p.apply(this && this.$id === e ? this : w, I);
			} catch (E) {
				throw (J(q, E), E);
			}
			return Q instanceof Promise
				? Q.then((E) => (J(V, E), E)).catch(
						(E) => (J(q, E), Promise.reject(E))
				  )
				: (J(V, Q), Q);
		};
	}
	const b = {
			_p: r,
			$id: e,
			$onAction: Pe.bind(null, f),
			$patch: C,
			$reset: L,
			$subscribe(_, p = {}) {
				const I = Pe(m, _, p.detached, () => V()),
					V = s.run(() =>
						pt(
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
		w = Ve(b);
	r._s.set(e, w);
	const G = ((r._a && r._a.runWithContext) || zt)(() =>
		r._e.run(() => (s = Fe()).run(t))
	);
	for (const _ in G) {
		const p = G[_];
		if ((ae(p) && !Zt(p)) || je(p))
			o ||
				(S && Kt(p) && (ae(p) ? (p.value = S[_]) : we(p, S[_])),
				(r.state.value[e][_] = p));
		else if (typeof p == "function") {
			const I = h(_, p);
			(G[_] = I), (i.actions[_] = p);
		}
	}
	return (
		F(w, G),
		F(mt(w), G),
		Object.defineProperty(w, "$state", {
			get: () => r.state.value[e],
			set: (_) => {
				C((p) => {
					F(p, _);
				});
			},
		}),
		r._p.forEach((_) => {
			F(
				w,
				s.run(() => _({ store: w, app: r._a, pinia: r, options: i }))
			);
		}),
		S && o && a.hydrate && a.hydrate(w.$state, S),
		(u = !0),
		(l = !0),
		w
	);
}
function qe(e, t, a) {
	let r, n;
	const o = typeof t == "function";
	typeof e == "string" ? ((r = e), (n = o ? a : t)) : ((n = e), (r = e.id));
	function s(i, c) {
		const u = At();
		return (
			(i = i || (u ? vt(Ke, null) : null)),
			i && ve(i),
			(i = Je),
			i._s.has(r) || (o ? Ge(r, t, n, i) : Gt(r, n, i)),
			i._s.get(r)
		);
	}
	return (s.$id = r), s;
}
const be = qe("lms-users", () => ({
		userResource: ue({
			url: "lms.lms.api.get_user_info",
			onError(t) {
				t &&
					t.exc_type === "AuthenticationError" &&
					router.push("/login");
			},
		}),
	})),
	de = qe("lms-session", () => {
		let { userResource: e } = be();
		function t() {
			let i = new URLSearchParams(
				document.cookie.split("; ").join("&")
			).get("user_id");
			return i === "Guest" && (i = null), i;
		}
		let a = ne(t());
		const r = oe(() => !!a.value),
			n = ue({
				url: "login",
				onError() {
					throw new Error("Invalid email or password");
				},
				onSuccess() {
					e.reload(),
						(a.value = t()),
						n.reset(),
						De.replace({ path: "/" });
				},
			}),
			o = ue({
				url: "logout",
				onSuccess() {
					e.reset(), (a.value = null), window.location.reload();
				},
			});
		return { user: a, isLoggedIn: r, login: n, logout: o };
	}),
	qt = [
		{
			path: "/",
			name: "Home",
			component: () =>
				D(
					() => import("./Home-gvvenAgK.js"),
					__vite__mapDeps([0, 1, 2])
				),
		},
		{
			path: "/courses",
			name: "Courses",
			component: () =>
				D(
					() => import("./Courses-lYNeP5iT.js"),
					__vite__mapDeps([3, 1, 2, 4, 5, 6, 7, 8])
				),
		},
		{
			path: "/courses/:courseName",
			name: "CourseDetail",
			component: () =>
				D(
					() => import("./CourseDetail-01NBXo60.js"),
					__vite__mapDeps([9, 1, 2, 6, 10, 11, 12, 5, 13])
				),
			props: !0,
		},
		{
			path: "/courses/:courseName/learn/:chapterNumber-:lessonNumber",
			name: "Lesson",
			component: () =>
				D(
					() => import("./Lesson-N9cRSew3.js"),
					__vite__mapDeps([14, 1, 2, 10, 11, 12, 5, 15, 16])
				),
			props: !0,
		},
		{
			path: "/batches",
			name: "Batches",
			component: () =>
				D(
					() => import("./Batches-irCWn_Pc.js"),
					__vite__mapDeps([17, 1, 2, 18, 8, 19])
				),
		},
		{
			path: "/batches/details/:batchName",
			name: "BatchDetail",
			component: () =>
				D(
					() => import("./BatchDetail-gQdB1fdL.js"),
					__vite__mapDeps([20, 1, 2, 18, 4, 5, 6, 7, 21])
				),
			props: !0,
		},
		{
			path: "/batches/:batchName",
			name: "Batch",
			component: () =>
				D(
					() => import("./Batch-VUgAxRGV.js"),
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
				D(
					() => import("./Billing-tJdywChZ.js"),
					__vite__mapDeps([26, 1, 2, 23, 8])
				),
			props: !0,
		},
		{
			path: "/statistics",
			name: "Statistics",
			component: () =>
				D(
					() => import("./Statistics-4cZ7lNfr.js"),
					__vite__mapDeps([27, 1, 2, 24])
				),
		},
		{
			path: "/user/:userName",
			name: "Profile",
			component: () =>
				D(
					() => import("./Profile-CyaIIe8W.js"),
					__vite__mapDeps([28, 1, 2])
				),
			props: !0,
		},
		{
			path: "/job-openings",
			name: "Jobs",
			component: () =>
				D(
					() => import("./Jobs-SThJmQa_.js"),
					__vite__mapDeps([29, 1, 2, 30, 8])
				),
		},
		{
			path: "/job-openings/:job",
			name: "JobDetail",
			component: () =>
				D(
					() => import("./JobDetail-c-bT6KGV.js"),
					__vite__mapDeps([31, 1, 2, 11, 30])
				),
			props: !0,
		},
		{
			path: "/courses/:courseName/edit",
			name: "CreateCourse",
			component: () =>
				D(
					() => import("./CreateCourse-0E2-P7Ge.js"),
					__vite__mapDeps([32, 1, 2, 23, 8, 11])
				),
			props: !0,
		},
		{
			path: "/courses/:courseName/outline",
			name: "CourseOutline",
			component: () =>
				D(
					() => import("./CreateOutline-3tnu6Qkz.js"),
					__vite__mapDeps([33, 1, 2])
				),
			props: !0,
		},
	];
let De = $t({ history: St("/"), routes: qt });
De.beforeEach((e, t, a) =>
	Te(void 0, null, function* () {
		const { userResource: r } = be();
		let { isLoggedIn: n } = de();
		try {
			n && (yield r.reload());
		} catch (o) {
			n = !1;
		}
		return a();
	})
);
let Qt = ne([]),
	Xt = {
		name: "Dialogs",
		render() {
			return Qt.value.map((e) =>
				ee(
					Mt,
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
						ee(bt, { class: "mt-2", message: e.error }),
					]
				)
			);
		},
	};
function er() {
	const e = Ve({ width: window.innerWidth, height: window.innerHeight }),
		t = () => {
			(e.width = window.innerWidth), (e.height = window.innerHeight);
		};
	return (
		Dt(() => {
			window.addEventListener("resize", t);
		}),
		Ct(() => {
			window.removeEventListener("resize", t);
		}),
		e
	);
}
const tr = {},
	rr = {
		width: "118",
		height: "118",
		viewBox: "0 0 118 118",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
	},
	ar = kt(
		'<path d="M93.9278 0H23.1013C10.3428 0 0 10.3428 0 23.1013V93.9278C0 106.686 10.3428 117.029 23.1013 117.029H93.9278C106.686 117.029 117.029 106.686 117.029 93.9278V23.1013C117.029 10.3428 106.686 0 93.9278 0Z" fill="url(#paint0_radial_174_336)"></path><path d="M93.9278 0H23.1013C10.3428 0 0 10.3428 0 23.1013V93.9278C0 106.686 10.3428 117.029 23.1013 117.029H93.9278C106.686 117.029 117.029 106.686 117.029 93.9278V23.1013C117.029 10.3428 106.686 0 93.9278 0Z" fill="#0B3D3D" fill-opacity="0.8"></path><path d="M95.1879 33.1294L91.4077 32.0268C80.1721 28.7716 67.9389 30.9242 58.5409 37.7496C52.083 33.0769 43.9975 30.5042 36.1746 30.5042H21.8938V41.0048H36.2796C42.2649 41.0048 48.1978 42.9999 52.923 46.6226L58.5934 50.9279L64.2637 46.6226C70.144 42.1599 77.5469 40.2698 84.7923 41.2673V76.1818C75.5518 75.2367 66.2063 77.7044 58.6459 83.2172C51.0854 77.7044 41.6349 75.2367 32.4994 76.1818V52.8705H21.9988V86.4724H95.3454V33.1294H95.1879Z" fill="#58FF9B"></path><defs><radialGradient id="paint0_radial_174_336" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117.24 -101.5) rotate(105.042) scale(226.282)"><stop offset="0.445162" stop-color="#1F7676"></stop><stop offset="1" stop-color="#0A4B4B"></stop></radialGradient></defs>',
		4
	),
	nr = [ar];
function or(e, t) {
	return M(), O("svg", rr, nr);
}
const sr = Ye(tr, [["render", or]]);
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
 */ const ir = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
	H =
		(e, t) =>
		(l, { attrs: c, slots: u }) => {
			var m = l,
				{
					size: a,
					strokeWidth: r = 2,
					absoluteStrokeWidth: n,
					color: o,
					class: s,
				} = m,
				i = Oe(m, [
					"size",
					"strokeWidth",
					"absoluteStrokeWidth",
					"color",
					"class",
				]);
			return ee(
				"svg",
				X(
					ye(
						X(
							ye(X({}, ie), {
								width: a || ie.width,
								height: a || ie.height,
								stroke: o || ie.stroke,
								"stroke-width": n
									? (Number(r) * 24) / Number(a)
									: r,
							}),
							c
						),
						{ class: ["lucide", `lucide-${ir(e)}`] }
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
 */ const cr = H("BookOpenIcon", [
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
 */ const ur = H("BriefcaseIcon", [
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
 */ const lr = H("ChevronDownIcon", [
	["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const fr = H("LogInIcon", [
	["path", { d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4", key: "u53s6r" }],
	["polyline", { points: "10 17 15 12 10 7", key: "1ail0h" }],
	["line", { x1: "15", x2: "3", y1: "12", y2: "12", key: "v6grx8" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const dr = H("LogOutIcon", [
	["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", key: "1uf3rs" }],
	["polyline", { points: "16 17 21 12 16 7", key: "1gabdz" }],
	["line", { x1: "21", x2: "9", y1: "12", y2: "12", key: "1uyos4" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const hr = H("TrendingUpIcon", [
	["polyline", { points: "22 7 13.5 15.5 8.5 10.5 2 17", key: "126l90" }],
	["polyline", { points: "16 7 22 7 22 13", key: "kwv8wd" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const pr = H("UserIcon", [
	["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", key: "975kel" }],
	["circle", { cx: "12", cy: "7", r: "4", key: "17ys0d" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const mr = H("UsersIcon", [
	["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" }],
	["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
	["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
	["path", { d: "M16 3.13a4 4 0 0 1 0 7.75", key: "1da9ce" }],
]);
function ga(e) {
	Lt(X({ position: "bottom-right" }, e));
}
function Aa(e) {
	return Et(e).value;
}
function wa(e) {
	if (!e) return "";
	const [t, a] = e.split(":").map(Number),
		r = new Date(0, 0, 0, t, a);
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "numeric",
		hour12: !0,
	}).format(r);
}
function $a(e, t) {
	return e
		? e.toLocaleString("en-IN", {
				maximumFractionDigits: 0,
				style: "currency",
				currency: t,
		  })
		: "";
}
function vr(e) {
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
function Sa(e) {
	let t = parseInt(e);
	return t > 1048576
		? (t / 1048576).toFixed(2) + "M"
		: t > 1024
		? (t / 1024).toFixed(2) + "K"
		: t;
}
function Ma() {
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
function Qe() {
	return [
		{
			label: "Courses",
			icon: cr,
			to: "Courses",
			activeFor: ["Courses", "CourseDetail", "Lesson"],
		},
		{
			label: "Batches",
			icon: mr,
			to: "Batches",
			activeFor: ["Batches", "BatchDetail", "Batch"],
		},
		{
			label: "Jobs",
			icon: ur,
			to: "Jobs",
			activeFor: ["Jobs", "JobDetail"],
		},
		{ label: "Statistics", icon: hr, to: "Statistics" },
	];
}
const _r = $(
		"div",
		{ class: "text-base font-medium text-gray-900 leading-none" },
		" Learning ",
		-1
	),
	yr = { key: 0, class: "mt-1 text-sm text-gray-700 leading-none" },
	gr = {
		__name: "UserDropdown",
		props: { isCollapsed: { type: Boolean, default: !1 } },
		setup(e) {
			const t = Se(),
				{ logout: a, user: r } = de();
			let { isLoggedIn: n } = de();
			const o = [
				{
					icon: pr,
					label: "My Profile",
					onClick: () => {
						var s;
						t.push(
							`/user/${
								(s = r.data) == null ? void 0 : s.username
							}`
						);
					},
					condition: () => n,
				},
				{
					icon: dr,
					label: "Log out",
					onClick: () => {
						a.submit().then(() => {
							n = !1;
						});
					},
					condition: () => n,
				},
				{
					icon: fr,
					label: "Log in",
					onClick: () => {
						window.location.href = "/login";
					},
					condition: () => !n,
				},
			];
			return (s, i) => (
				M(),
				pe(
					g(xt),
					{ options: o },
					{
						default: me(({ open: c }) => [
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
											_r,
											g(r)
												? (M(),
												  O(
														"div",
														yr,
														le(
															g(vr)(
																g(r).split(
																	"@"
																)[0]
															)
														),
														1
												  ))
												: Ue("", !0),
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
											T(g(lr), {
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
	Ar = {},
	wr = {
		width: "18",
		height: "18",
		viewBox: "0 0 18 18",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
	},
	$r = $(
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
	Sr = $(
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
	Mr = $(
		"path",
		{
			d: "M14.1423 4L14.1423 14.125",
			stroke: "currentColor",
			"stroke-linecap": "round",
		},
		null,
		-1
	),
	br = [$r, Sr, Mr];
function Dr(e, t) {
	return M(), O("svg", wr, br);
}
const Cr = Ye(Ar, [["render", Dr]]),
	kr = { class: "grid h-5 w-6 flex-shrink-0 place-items-center" },
	Ne = {
		__name: "SidebarLink",
		props: {
			icon: { type: Function },
			label: { type: String, default: "" },
			to: { type: String, default: "" },
			activeFor: { type: Array, default: [] },
			isCollapsed: { type: Boolean, default: !1 },
		},
		setup(e) {
			const t = Se(),
				a = e;
			function r() {
				t.push({ name: a.to });
			}
			let n = oe(() => a.activeFor.includes(t.currentRoute.value.name));
			return (o, s) => (
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
									g(Ot),
									{ text: e.label, placement: "right" },
									{
										default: me(() => [
											fe(o.$slots, "icon", {}, () => [
												$("span", kr, [
													(M(),
													pe(We(e.icon), {
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
									le(e.label),
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
	Lr = { class: "flex flex-col overflow-y-auto" },
	Er = { class: "grid h-5 w-6 flex-shrink-0 place-items-center" },
	xr = {
		__name: "AppSidebar",
		setup(e) {
			const t = Qe();
			let r = ne(Tt("sidebar_is_collapsed", !1));
			return (n, o) => (
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
									gr,
									{ class: "p-2", isCollapsed: g(r) },
									null,
									8,
									["isCollapsed"]
								),
								$("div", Lr, [
									(M(!0),
									O(
										Me,
										null,
										ze(
											g(t),
											(s) => (
												M(),
												pe(
													Ne,
													{
														icon: s.icon,
														label: s.label,
														to: s.to,
														activeFor: s.activeFor,
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
							Ne,
							{
								label: g(r) ? "Expand" : "Collapse",
								isCollapsed: g(r),
								onClick:
									o[0] ||
									(o[0] = (s) =>
										ae(r)
											? (r.value = !g(r))
											: (r = !g(r))),
								class: "m-2",
							},
							{
								icon: me(() => [
									$("span", Er, [
										T(
											Cr,
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
	Or = { class: "relative flex h-full flex-col" },
	Tr = { class: "h-full flex-1" },
	Ir = { class: "flex h-full" },
	Pr = {
		class: "relative block min-h-0 flex-shrink-0 overflow-hidden hover:overflow-auto",
	},
	Nr = { class: "w-full overflow-auto", id: "scrollContainer" },
	Br = {
		__name: "DesktopLayout",
		setup(e) {
			return (t, a) => (
				M(),
				O("div", Or, [
					$("div", Tr, [
						$("div", Ir, [
							$("div", Pr, [fe(t.$slots, "sidebar"), T(xr)]),
							$("div", Nr, [fe(t.$slots, "default")]),
						]),
					]),
				])
			);
		},
	},
	Rr = { class: "flex h-full flex-col" },
	Fr = { class: "h-full overflow-auto", id: "scrollContainer" },
	Hr = ["onClick"],
	Vr = {
		__name: "MobileLayout",
		setup(e) {
			const t = Se(),
				a = oe(() => Qe());
			console.log(a.value);
			const r = (n) => {
				t.push({ name: n.to });
			};
			return (n, o) => (
				M(),
				O("div", Rr, [
					$("div", Fr, [fe(n.$slots, "default")]),
					Ie(" " + le(a.value) + " ", 1),
					a.value
						? (M(),
						  O(
								"div",
								{
									key: 0,
									class: "grid grid-cols-5 border-t border-gray-300 standalone:pb-4",
									style: It({
										gridTemplateColumns: `repeat(${a.value.length}, minmax(0, 1fr))`,
									}),
								},
								[
									(M(!0),
									O(
										Me,
										null,
										ze(
											a.value,
											(s) => (
												M(),
												O(
													"button",
													{
														key: s.label,
														class: "flex flex-col items-center justify-center py-3 transition active:scale-95",
														onClick: (i) => r(s),
													},
													[
														Ie(
															le(s.label) + " ",
															1
														),
														(M(),
														pe(We(s.icon), {
															class: "h-6 w-6",
														})),
													],
													8,
													Hr
												)
											)
										),
										128
									)),
								],
								4
						  ))
						: Ue("", !0),
				])
			);
		},
	},
	jr = {
		__name: "App",
		setup(e) {
			const t = er(),
				a = oe(() => (t.width < 640 ? Vr : Br));
			return (r, n) => {
				const o = Nt("router-view");
				return (
					M(),
					O(
						Me,
						null,
						[
							T(g(a), null, { default: me(() => [T(o)]), _: 1 }),
							T(g(Xt)),
							T(g(Pt)),
						],
						64
					)
				);
			};
		},
	};
var Xe = 60,
	et = Xe * 60,
	tt = et * 24,
	Yr = tt * 7,
	Z = 1e3,
	ge = Xe * Z,
	Be = et * Z,
	Ur = tt * Z,
	Wr = Yr * Z,
	Ce = "millisecond",
	j = "second",
	Y = "minute",
	U = "hour",
	N = "day",
	ce = "week",
	x = "month",
	rt = "quarter",
	B = "year",
	K = "date",
	at = "YYYY-MM-DDTHH:mm:ssZ",
	Re = "Invalid Date",
	zr =
		/^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/,
	Jr =
		/\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g;
const Kr = {
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
var $e = function (t, a, r) {
		var n = String(t);
		return !n || n.length >= a
			? t
			: "" + Array(a + 1 - n.length).join(r) + t;
	},
	Zr = function (t) {
		var a = -t.utcOffset(),
			r = Math.abs(a),
			n = Math.floor(r / 60),
			o = r % 60;
		return (a <= 0 ? "+" : "-") + $e(n, 2, "0") + ":" + $e(o, 2, "0");
	},
	Gr = function e(t, a) {
		if (t.date() < a.date()) return -e(a, t);
		var r = (a.year() - t.year()) * 12 + (a.month() - t.month()),
			n = t.clone().add(r, x),
			o = a - n < 0,
			s = t.clone().add(r + (o ? -1 : 1), x);
		return +(-(r + (a - n) / (o ? n - s : s - n)) || 0);
	},
	qr = function (t) {
		return t < 0 ? Math.ceil(t) || 0 : Math.floor(t);
	},
	Qr = function (t) {
		var a = {
			M: x,
			y: B,
			w: ce,
			d: N,
			D: K,
			h: U,
			m: Y,
			s: j,
			ms: Ce,
			Q: rt,
		};
		return (
			a[t] ||
			String(t || "")
				.toLowerCase()
				.replace(/s$/, "")
		);
	},
	Xr = function (t) {
		return t === void 0;
	};
const ea = { s: $e, z: Zr, m: Gr, a: qr, p: Qr, u: Xr };
var re = "en",
	W = {};
W[re] = Kr;
var nt = "$isDayjsObject",
	ke = function (t) {
		return t instanceof _e || !!(t && t[nt]);
	},
	he = function e(t, a, r) {
		var n;
		if (!t) return re;
		if (typeof t == "string") {
			var o = t.toLowerCase();
			W[o] && (n = o), a && ((W[o] = a), (n = o));
			var s = t.split("-");
			if (!n && s.length > 1) return e(s[0]);
		} else {
			var i = t.name;
			(W[i] = t), (n = i);
		}
		return !r && n && (re = n), n || (!r && re);
	},
	v = function (t, a) {
		if (ke(t)) return t.clone();
		var r = typeof a == "object" ? a : {};
		return (r.date = t), (r.args = arguments), new _e(r);
	},
	ta = function (t, a) {
		return v(t, { locale: a.$L, utc: a.$u, x: a.$x, $offset: a.$offset });
	},
	d = ea;
d.l = he;
d.i = ke;
d.w = ta;
var ra = function (t) {
		var a = t.date,
			r = t.utc;
		if (a === null) return new Date(NaN);
		if (d.u(a)) return new Date();
		if (a instanceof Date) return new Date(a);
		if (typeof a == "string" && !/Z$/i.test(a)) {
			var n = a.match(zr);
			if (n) {
				var o = n[2] - 1 || 0,
					s = (n[7] || "0").substring(0, 3);
				return r
					? new Date(
							Date.UTC(
								n[1],
								o,
								n[3] || 1,
								n[4] || 0,
								n[5] || 0,
								n[6] || 0,
								s
							)
					  )
					: new Date(
							n[1],
							o,
							n[3] || 1,
							n[4] || 0,
							n[5] || 0,
							n[6] || 0,
							s
					  );
			}
		}
		return new Date(a);
	},
	_e = (function () {
		function e(a) {
			(this.$L = he(a.locale, null, !0)),
				this.parse(a),
				(this.$x = this.$x || a.x || {}),
				(this[nt] = !0);
		}
		var t = e.prototype;
		return (
			(t.parse = function (r) {
				(this.$d = ra(r)), this.init();
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
				return this.$d.toString() !== Re;
			}),
			(t.isSame = function (r, n) {
				var o = v(r);
				return this.startOf(n) <= o && o <= this.endOf(n);
			}),
			(t.isAfter = function (r, n) {
				return v(r) < this.startOf(n);
			}),
			(t.isBefore = function (r, n) {
				return this.endOf(n) < v(r);
			}),
			(t.$g = function (r, n, o) {
				return d.u(r) ? this[n] : this.set(o, r);
			}),
			(t.unix = function () {
				return Math.floor(this.valueOf() / 1e3);
			}),
			(t.valueOf = function () {
				return this.$d.getTime();
			}),
			(t.startOf = function (r, n) {
				var o = this,
					s = d.u(n) ? !0 : n,
					i = d.p(r),
					c = function (L, A) {
						var h = d.w(
							o.$u ? Date.UTC(o.$y, A, L) : new Date(o.$y, A, L),
							o
						);
						return s ? h : h.endOf(N);
					},
					u = function (L, A) {
						var h = [0, 0, 0, 0],
							b = [23, 59, 59, 999];
						return d.w(
							o
								.toDate()
								[L].apply(o.toDate("s"), (s ? h : b).slice(A)),
							o
						);
					},
					l = this.$W,
					m = this.$M,
					f = this.$D,
					y = "set" + (this.$u ? "UTC" : "");
				switch (i) {
					case B:
						return s ? c(1, 0) : c(31, 11);
					case x:
						return s ? c(1, m) : c(0, m + 1);
					case ce: {
						var S = this.$locale().weekStart || 0,
							k = (l < S ? l + 7 : l) - S;
						return c(s ? f - k : f + (6 - k), m);
					}
					case N:
					case K:
						return u(y + "Hours", 0);
					case U:
						return u(y + "Minutes", 1);
					case Y:
						return u(y + "Seconds", 2);
					case j:
						return u(y + "Milliseconds", 3);
					default:
						return this.clone();
				}
			}),
			(t.endOf = function (r) {
				return this.startOf(r, !1);
			}),
			(t.$set = function (r, n) {
				var o,
					s = d.p(r),
					i = "set" + (this.$u ? "UTC" : ""),
					c = ((o = {}),
					(o[N] = i + "Date"),
					(o[K] = i + "Date"),
					(o[x] = i + "Month"),
					(o[B] = i + "FullYear"),
					(o[U] = i + "Hours"),
					(o[Y] = i + "Minutes"),
					(o[j] = i + "Seconds"),
					(o[Ce] = i + "Milliseconds"),
					o)[s],
					u = s === N ? this.$D + (n - this.$W) : n;
				if (s === x || s === B) {
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
				var o = this,
					s;
				r = Number(r);
				var i = d.p(n),
					c = function (f) {
						var y = v(o);
						return d.w(y.date(y.date() + Math.round(f * r)), o);
					};
				if (i === x) return this.set(x, this.$M + r);
				if (i === B) return this.set(B, this.$y + r);
				if (i === N) return c(1);
				if (i === ce) return c(7);
				var u =
						((s = {}), (s[Y] = ge), (s[U] = Be), (s[j] = Z), s)[
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
					o = this.$locale();
				if (!this.isValid()) return o.invalidDate || Re;
				var s = r || at,
					i = d.z(this),
					c = this.$H,
					u = this.$m,
					l = this.$M,
					m = o.weekdays,
					f = o.months,
					y = o.meridiem,
					S = function (h, b, w, z) {
						return (h && (h[b] || h(n, s))) || w[b].slice(0, z);
					},
					k = function (h) {
						return d.s(c % 12 || 12, h, "0");
					},
					C =
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
								return S(o.monthsShort, l, f, 3);
							case "MMMM":
								return S(f, l);
							case "D":
								return n.$D;
							case "DD":
								return d.s(n.$D, 2, "0");
							case "d":
								return String(n.$W);
							case "dd":
								return S(o.weekdaysMin, n.$W, m, 2);
							case "ddd":
								return S(o.weekdaysShort, n.$W, m, 3);
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
								return C(c, u, !0);
							case "A":
								return C(c, u, !1);
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
				return s.replace(Jr, function (A, h) {
					return h || L(A) || i.replace(":", "");
				});
			}),
			(t.utcOffset = function () {
				return -Math.round(this.$d.getTimezoneOffset() / 15) * 15;
			}),
			(t.diff = function (r, n, o) {
				var s = this,
					i = d.p(n),
					c = v(r),
					u = (c.utcOffset() - this.utcOffset()) * ge,
					l = this - c,
					m = function () {
						return d.m(s, c);
					},
					f;
				switch (i) {
					case B:
						f = m() / 12;
						break;
					case x:
						f = m();
						break;
					case rt:
						f = m() / 3;
						break;
					case ce:
						f = (l - u) / Wr;
						break;
					case N:
						f = (l - u) / Ur;
						break;
					case U:
						f = l / Be;
						break;
					case Y:
						f = l / ge;
						break;
					case j:
						f = l / Z;
						break;
					default:
						f = l;
						break;
				}
				return o ? f : d.a(f);
			}),
			(t.daysInMonth = function () {
				return this.endOf(x).$D;
			}),
			(t.$locale = function () {
				return W[this.$L];
			}),
			(t.locale = function (r, n) {
				if (!r) return this.$L;
				var o = this.clone(),
					s = he(r, n, !0);
				return s && (o.$L = s), o;
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
	ot = _e.prototype;
v.prototype = ot;
[
	["$ms", Ce],
	["$s", j],
	["$m", Y],
	["$H", U],
	["$W", N],
	["$M", x],
	["$y", B],
	["$D", K],
].forEach(function (e) {
	ot[e[1]] = function (t) {
		return this.$g(t, e[0], e[1]);
	};
});
v.extend = function (e, t) {
	return e.$i || (e(t, _e, v), (e.$i = !0)), v;
};
v.locale = he;
v.isDayjs = ke;
v.unix = function (e) {
	return v(e * 1e3);
};
v.en = W[re];
v.Ls = W;
v.p = {};
const aa = function (e, t, a) {
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
						{ l: "s", r: 44, d: j },
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
					C,
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
							? (C = w.replace("%d", b))
							: (C = w(b, c, h.l, L));
					break;
				}
			}
			if (c) return C;
			var z = L ? f.future : f.past;
			return typeof z == "function" ? z(C) : z.replace("%s", C);
		});
	function o(i, c, u, l) {
		return r.fromToBase(i, c, u, l);
	}
	(r.to = function (i, c) {
		return o(i, c, this, !0);
	}),
		(r.from = function (i, c) {
			return o(i, c, this);
		});
	var s = function (c) {
		return c.$u ? a.utc() : a();
	};
	(r.toNow = function (i) {
		return this.to(s(this), i);
	}),
		(r.fromNow = function (i) {
			return this.from(s(this), i);
		});
};
var na = function (t) {
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
	oa = function (t, a) {
		return t.replace(
			/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,
			function (r, n, o) {
				var s = o && o.toUpperCase();
				return n || a[o] || st[o] || na(a[s]);
			}
		);
	};
const sa = function (e, t, a) {
		var r = t.prototype,
			n = r.format;
		(a.en.formats = st),
			(r.format = function (o) {
				o === void 0 && (o = at);
				var s = this.$locale(),
					i = s.formats,
					c = i === void 0 ? {} : i,
					u = oa(o, c);
				return n.call(this, u);
			});
	},
	ia = function (e, t, a) {
		a.updateLocale = function (r, n) {
			var o = a.Ls,
				s = o[r];
			if (s) {
				var i = n ? Object.keys(n) : [];
				return (
					i.forEach(function (c) {
						s[c] = n[c];
					}),
					s
				);
			}
		};
	},
	ca = function (e, t, a) {
		var r = t.prototype;
		r.isToday = function () {
			var n = "YYYY-MM-DD",
				o = a();
			return this.format(n) === o.format(n);
		};
	},
	ua = function (e, t) {
		t.prototype.isSameOrBefore = function (a, r) {
			return this.isSame(a, r) || this.isBefore(a, r);
		};
	},
	la = function (e, t) {
		t.prototype.isSameOrAfter = function (a, r) {
			return this.isSame(a, r) || this.isAfter(a, r);
		};
	};
v.extend(ia);
v.extend(aa);
v.extend(sa);
v.extend(ca);
v.extend(ua);
v.extend(la);
function fa(e) {
	(e.config.globalProperties.__ = da), window.translatedMessages || ha();
}
function da(e) {
	let a = (window.translatedMessages || {})[e] || e;
	return /{\d+}/.test(e)
		? {
				format: function (...n) {
					return a.replace(/{(\d+)}/g, function (o, s) {
						return typeof n[s] != "undefined" ? n[s] : o;
					});
				},
		  }
		: a;
}
function ha(e) {
	ue({
		url: "lms.lms.api.get_translations",
		cache: "translations",
		auto: !0,
		transform: (t) => {
			window.translatedMessages = t;
		},
	});
}
const pa = 9e3;
function ma() {
	let e = window.location.hostname,
		t = window.site_name || e,
		a = window.location.port ? `:${pa}` : "",
		n = `${a ? "http" : "https"}://${e}${a}/${t}`,
		o = Bt(n, { withCredentials: !0, reconnectionAttempts: 5 });
	return (
		o.on("refetch_resource", (s) => {
			if (s.cache_key) {
				let i = Rt(s.cache_key) || Ft(s.cache_key);
				i && i.reload();
			}
		}),
		o
	);
}
let va = Wt(),
	P = Ht(jr);
Yt("resourceFetcher", Ut);
P.use(Vt);
P.use(va);
P.use(De);
P.use(fa);
P.use(jt);
P.provide("$dayjs", v);
P.provide("$socket", ma());
P.mount("#app");
const { userResource: it } = be();
de();
P.provide("$user", it);
P.config.globalProperties.$user = it;
export {
	cr as B,
	lr as C,
	fr as L,
	mr as U,
	H as a,
	$a as b,
	ga as c,
	Sa as d,
	vr as e,
	wa as f,
	Ma as g,
	de as s,
	Aa as t,
};
function __vite__mapDeps(indexes) {
	if (!__vite__mapDeps.viteFileDeps) {
		__vite__mapDeps.viteFileDeps = [
			"assets/Home-gvvenAgK.js",
			"assets/frappe-ui-LT4YqXtx.js",
			"assets/frappe-ui-dYBF8eAq.css",
			"assets/Courses-lYNeP5iT.js",
			"assets/CourseCard-RMpjQ-rq.js",
			"assets/UserAvatar-A3tEMZXD.js",
			"assets/star--IkSKstT.js",
			"assets/CourseCard-Ld7NFsgL.css",
			"assets/plus-0JOmes86.js",
			"assets/CourseDetail-01NBXo60.js",
			"assets/CourseOutline-AirCiy-C.js",
			"assets/file-text-w2g11TfY.js",
			"assets/CourseOutline-qvlFmNZy.css",
			"assets/CourseDetail-SyEqAeUc.css",
			"assets/Lesson-N9cRSew3.js",
			"assets/Discussions-3EqlwpPS.js",
			"assets/Lesson--a_FsKFL.css",
			"assets/Batches-irCWn_Pc.js",
			"assets/clock-q4vfplv-.js",
			"assets/Batches-1PjOhl-q.css",
			"assets/BatchDetail-gQdB1fdL.js",
			"assets/BatchDetail-AhnKex4u.css",
			"assets/Batch-VUgAxRGV.js",
			"assets/Link-rwTAUhIL.js",
			"assets/book-open-check-_W-8v7wc.js",
			"assets/Batch-oDSZMopQ.css",
			"assets/Billing-tJdywChZ.js",
			"assets/Statistics-4cZ7lNfr.js",
			"assets/Profile-CyaIIe8W.js",
			"assets/Jobs-SThJmQa_.js",
			"assets/map-pin-yIki2ElO.js",
			"assets/JobDetail-c-bT6KGV.js",
			"assets/CreateCourse-0E2-P7Ge.js",
			"assets/CreateOutline-3tnu6Qkz.js",
		];
	}
	return indexes.map((i) => __vite__mapDeps.viteFileDeps[i]);
}
//# sourceMappingURL=index-6k1S_EjG.js.map
