var lt = Object.defineProperty,
	ft = Object.defineProperties;
var dt = Object.getOwnPropertyDescriptors;
var oe = Object.getOwnPropertySymbols;
var Le = Object.prototype.hasOwnProperty,
	Ee = Object.prototype.propertyIsEnumerable;
var ke = (e, a, t) =>
		a in e
			? lt(e, a, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: t,
			  })
			: (e[a] = t),
	Q = (e, a) => {
		for (var t in a || (a = {})) Le.call(a, t) && ke(e, t, a[t]);
		if (oe) for (var t of oe(a)) Ee.call(a, t) && ke(e, t, a[t]);
		return e;
	},
	ge = (e, a) => ft(e, dt(a));
var xe = (e, a) => {
	var t = {};
	for (var r in e) Le.call(e, r) && a.indexOf(r) < 0 && (t[r] = e[r]);
	if (e != null && oe)
		for (var r of oe(e)) a.indexOf(r) < 0 && Ee.call(e, r) && (t[r] = e[r]);
	return t;
};
var Oe = (e, a, t) =>
	new Promise((r, n) => {
		var s = (c) => {
				try {
					i(t.next(c));
				} catch (u) {
					n(u);
				}
			},
			o = (c) => {
				try {
					i(t.throw(c));
				} catch (u) {
					n(u);
				}
			},
			i = (c) =>
				c.done ? r(c.value) : Promise.resolve(c.value).then(s, o);
		i((t = t.apply(e, a)).next());
	});
import {
	e as Re,
	r as ae,
	m as He,
	i as ht,
	h as mt,
	a as pt,
	w as vt,
	b as Ye,
	c as re,
	d as je,
	t as _t,
	g as gt,
	o as yt,
	n as At,
	f as wt,
	j as ne,
	k as ue,
	l as $t,
	p as St,
	_ as P,
	q as X,
	E as Mt,
	D as bt,
	s as Dt,
	u as Ct,
	v as Ve,
	x as M,
	y as x,
	z as kt,
	A as me,
	B as pe,
	C as R,
	F as O,
	G as w,
	H as le,
	I as Fe,
	J as $,
	K as Lt,
	L as Ue,
	M as We,
	N as fe,
	T as Et,
	O as xt,
	P as Ot,
	Q as Se,
	R as ze,
	S as Tt,
	U as Te,
	V as It,
	W as Pt,
	X as Nt,
	Y as Bt,
	Z as Rt,
	$ as Ht,
	a0 as Yt,
	a1 as jt,
	a2 as Vt,
	a3 as Ft,
	a4 as Ut,
} from "./frappe-ui-iPT8hMkb.js";
(function () {
	const a = document.createElement("link").relList;
	if (a && a.supports && a.supports("modulepreload")) return;
	for (const n of document.querySelectorAll('link[rel="modulepreload"]'))
		r(n);
	new MutationObserver((n) => {
		for (const s of n)
			if (s.type === "childList")
				for (const o of s.addedNodes)
					o.tagName === "LINK" && o.rel === "modulepreload" && r(o);
	}).observe(document, { childList: !0, subtree: !0 });
	function t(n) {
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
		const s = t(n);
		fetch(n.href, s);
	}
})();
/*!
 * pinia v2.1.7
 * (c) 2023 Eduardo San Martin Morote
 * @license MIT
 */ let Ke;
const ve = (e) => (Ke = e),
	Je = Symbol();
function Ae(e) {
	return (
		e &&
		typeof e == "object" &&
		Object.prototype.toString.call(e) === "[object Object]" &&
		typeof e.toJSON != "function"
	);
}
var ee;
(function (e) {
	(e.direct = "direct"),
		(e.patchObject = "patch object"),
		(e.patchFunction = "patch function");
})(ee || (ee = {}));
function Wt() {
	const e = Re(!0),
		a = e.run(() => ae({}));
	let t = [],
		r = [];
	const n = He({
		install(s) {
			ve(n),
				(n._a = s),
				s.provide(Je, n),
				(s.config.globalProperties.$pinia = n),
				r.forEach((o) => t.push(o)),
				(r = []);
		},
		use(s) {
			return !this._a && !ht ? r.push(s) : t.push(s), this;
		},
		_p: t,
		_a: null,
		_e: e,
		_s: new Map(),
		state: a,
	});
	return n;
}
const Ze = () => {};
function Ie(e, a, t, r = Ze) {
	e.push(a);
	const n = () => {
		const s = e.indexOf(a);
		s > -1 && (e.splice(s, 1), r());
	};
	return !t && gt() && yt(n), n;
}
function z(e, ...a) {
	e.slice().forEach((t) => {
		t(...a);
	});
}
const zt = (e) => e();
function we(e, a) {
	e instanceof Map && a instanceof Map && a.forEach((t, r) => e.set(r, t)),
		e instanceof Set && a instanceof Set && a.forEach(e.add, e);
	for (const t in a) {
		if (!a.hasOwnProperty(t)) continue;
		const r = a[t],
			n = e[t];
		Ae(n) && Ae(r) && e.hasOwnProperty(t) && !re(r) && !je(r)
			? (e[t] = we(n, r))
			: (e[t] = r);
	}
	return e;
}
const Kt = Symbol();
function Jt(e) {
	return !Ae(e) || !e.hasOwnProperty(Kt);
}
const { assign: H } = Object;
function Zt(e) {
	return !!(re(e) && e.effect);
}
function Gt(e, a, t, r) {
	const { state: n, actions: s, getters: o } = a,
		i = t.state.value[e];
	let c;
	function u() {
		i || (t.state.value[e] = n ? n() : {});
		const l = wt(t.state.value[e]);
		return H(
			l,
			s,
			Object.keys(o || {}).reduce(
				(p, f) => (
					(p[f] = He(
						ne(() => {
							ve(t);
							const g = t._s.get(e);
							return o[f].call(g, g);
						})
					)),
					p
				),
				{}
			)
		);
	}
	return (c = Ge(e, u, a, t, r, !0)), c;
}
function Ge(e, a, t = {}, r, n, s) {
	let o;
	const i = H({ actions: {} }, t),
		c = { deep: !0 };
	let u,
		l,
		p = [],
		f = [],
		g;
	const S = r.state.value[e];
	!s && !S && (r.state.value[e] = {}), ae({});
	let C;
	function D(_) {
		let m;
		(u = l = !1),
			typeof _ == "function"
				? (_(r.state.value[e]),
				  (m = { type: ee.patchFunction, storeId: e, events: g }))
				: (we(r.state.value[e], _),
				  (m = {
						type: ee.patchObject,
						payload: _,
						storeId: e,
						events: g,
				  }));
		const T = (C = Symbol());
		At().then(() => {
			C === T && (u = !0);
		}),
			(l = !0),
			z(p, m, r.state.value[e]);
	}
	const k = s
		? function () {
				const { state: m } = t,
					T = m ? m() : {};
				this.$patch((Y) => {
					H(Y, T);
				});
		  }
		: Ze;
	function y() {
		o.stop(), (p = []), (f = []), r._s.delete(e);
	}
	function h(_, m) {
		return function () {
			ve(r);
			const T = Array.from(arguments),
				Y = [],
				G = [];
			function ct(L) {
				Y.push(L);
			}
			function ut(L) {
				G.push(L);
			}
			z(f, { args: T, name: _, store: A, after: ct, onError: ut });
			let q;
			try {
				q = m.apply(this && this.$id === e ? this : A, T);
			} catch (L) {
				throw (z(G, L), L);
			}
			return q instanceof Promise
				? q
						.then((L) => (z(Y, L), L))
						.catch((L) => (z(G, L), Promise.reject(L)))
				: (z(Y, q), q);
		};
	}
	const b = {
			_p: r,
			$id: e,
			$onAction: Ie.bind(null, f),
			$patch: D,
			$reset: k,
			$subscribe(_, m = {}) {
				const T = Ie(p, _, m.detached, () => Y()),
					Y = o.run(() =>
						vt(
							() => r.state.value[e],
							(G) => {
								(m.flush === "sync" ? l : u) &&
									_(
										{
											storeId: e,
											type: ee.direct,
											events: g,
										},
										G
									);
							},
							H({}, c, m)
						)
					);
				return T;
			},
			$dispose: y,
		},
		A = Ye(b);
	r._s.set(e, A);
	const Z = ((r._a && r._a.runWithContext) || zt)(() =>
		r._e.run(() => (o = Re()).run(a))
	);
	for (const _ in Z) {
		const m = Z[_];
		if ((re(m) && !Zt(m)) || je(m))
			s ||
				(S && Jt(m) && (re(m) ? (m.value = S[_]) : we(m, S[_])),
				(r.state.value[e][_] = m));
		else if (typeof m == "function") {
			const T = h(_, m);
			(Z[_] = T), (i.actions[_] = m);
		}
	}
	return (
		H(A, Z),
		H(_t(A), Z),
		Object.defineProperty(A, "$state", {
			get: () => r.state.value[e],
			set: (_) => {
				D((m) => {
					H(m, _);
				});
			},
		}),
		r._p.forEach((_) => {
			H(
				A,
				o.run(() => _({ store: A, app: r._a, pinia: r, options: i }))
			);
		}),
		S && s && t.hydrate && t.hydrate(A.$state, S),
		(u = !0),
		(l = !0),
		A
	);
}
function qe(e, a, t) {
	let r, n;
	const s = typeof a == "function";
	typeof e == "string" ? ((r = e), (n = s ? t : a)) : ((n = e), (r = e.id));
	function o(i, c) {
		const u = mt();
		return (
			(i = i || (u ? pt(Je, null) : null)),
			i && ve(i),
			(i = Ke),
			i._s.has(r) || (s ? Ge(r, a, n, i) : Gt(r, n, i)),
			i._s.get(r)
		);
	}
	return (o.$id = r), o;
}
const Me = qe("lms-users", () => ({
		userResource: ue({
			url: "lms.lms.api.get_user_info",
			onError(a) {
				a &&
					a.exc_type === "AuthenticationError" &&
					router.push("/login");
			},
		}),
	})),
	de = qe("lms-session", () => {
		let { userResource: e } = Me();
		function a() {
			let i = new URLSearchParams(
				document.cookie.split("; ").join("&")
			).get("user_id");
			return i === "Guest" && (i = null), i;
		}
		let t = ae(a());
		const r = ne(() => !!t.value),
			n = ue({
				url: "login",
				onError() {
					throw new Error("Invalid email or password");
				},
				onSuccess() {
					e.reload(),
						(t.value = a()),
						n.reset(),
						be.replace({ path: "/" });
				},
			}),
			s = ue({
				url: "logout",
				onSuccess() {
					e.reset(), (t.value = null), window.location.reload();
				},
			});
		return { user: t, isLoggedIn: r, login: n, logout: s };
	}),
	qt = [
		{
			path: "/",
			name: "Home",
			component: () =>
				P(
					() => import("./Home-x768lxic.js"),
					__vite__mapDeps([0, 1, 2])
				),
		},
		{
			path: "/courses",
			name: "Courses",
			component: () =>
				P(
					() => import("./Courses-hTDCCPUa.js"),
					__vite__mapDeps([3, 1, 2, 4, 5, 6, 7, 8])
				),
		},
		{
			path: "/courses/:courseName",
			name: "CourseDetail",
			component: () =>
				P(
					() => import("./CourseDetail-hyS6u7Jr.js"),
					__vite__mapDeps([9, 1, 2, 6, 10, 11, 5, 12])
				),
			props: !0,
		},
		{
			path: "/courses/:courseName/learn/:chapterNumber-:lessonNumber",
			name: "Lesson",
			component: () =>
				P(
					() => import("./Lesson-DbPY_b_T.js"),
					__vite__mapDeps([13, 1, 2, 10, 11, 5, 14, 15])
				),
			props: !0,
		},
		{
			path: "/batches",
			name: "Batches",
			component: () =>
				P(
					() => import("./Batches-gDWZzuli.js"),
					__vite__mapDeps([16, 1, 2, 17, 8, 18])
				),
		},
		{
			path: "/batches/details/:batchName",
			name: "BatchDetail",
			component: () =>
				P(
					() => import("./BatchDetail-MDvOC8VN.js"),
					__vite__mapDeps([19, 1, 2, 17, 4, 5, 6, 7, 20])
				),
			props: !0,
		},
		{
			path: "/batches/:batchName",
			name: "Batch",
			component: () =>
				P(
					() => import("./Batch--wtfybfQ.js"),
					__vite__mapDeps([
						21, 1, 2, 4, 5, 6, 7, 17, 8, 22, 14, 23, 24,
					])
				),
			props: !0,
		},
		{
			path: "/billing/:type/:name",
			name: "Billing",
			component: () =>
				P(
					() => import("./Billing-hBjAglsj.js"),
					__vite__mapDeps([25, 1, 2, 22, 8])
				),
			props: !0,
		},
		{
			path: "/statistics",
			name: "Statistics",
			component: () =>
				P(
					() => import("./Statistics-Z-8FWaV4.js"),
					__vite__mapDeps([26, 1, 2, 23])
				),
		},
	];
let be = $t({ history: St("/"), routes: qt });
be.beforeEach((e, a, t) =>
	Oe(void 0, null, function* () {
		const { userResource: r } = Me();
		let { isLoggedIn: n } = de();
		try {
			n && (yield r.reload());
		} catch (s) {
			n = !1;
		}
		return t();
	})
);
let Qt = ae([]),
	Xt = {
		name: "Dialogs",
		render() {
			return Qt.value.map((e) =>
				X(
					bt,
					{
						options: e,
						modelValue: e.show,
						"onUpdate:modelValue": (a) => (e.show = a),
					},
					() => [
						X(
							"p",
							{ class: "text-p-base text-gray-700" },
							e.message
						),
						X(Mt, { class: "mt-2", message: e.error }),
					]
				)
			);
		},
	};
function er() {
	const e = Ye({ width: window.innerWidth, height: window.innerHeight }),
		a = () => {
			(e.width = window.innerWidth), (e.height = window.innerHeight);
		};
	return (
		Dt(() => {
			window.addEventListener("resize", a);
		}),
		Ct(() => {
			window.removeEventListener("resize", a);
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
function sr(e, a) {
	return M(), x("svg", rr, nr);
}
const or = Ve(tr, [["render", sr]]);
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
	se =
		(e, a) =>
		(l, { attrs: c, slots: u }) => {
			var p = l,
				{
					size: t,
					strokeWidth: r = 2,
					absoluteStrokeWidth: n,
					color: s,
					class: o,
				} = p,
				i = xe(p, [
					"size",
					"strokeWidth",
					"absoluteStrokeWidth",
					"color",
					"class",
				]);
			return X(
				"svg",
				Q(
					ge(
						Q(
							ge(Q({}, ie), {
								width: t || ie.width,
								height: t || ie.height,
								stroke: s || ie.stroke,
								"stroke-width": n
									? (Number(r) * 24) / Number(t)
									: r,
							}),
							c
						),
						{ class: ["lucide", `lucide-${ir(e)}`] }
					),
					i
				),
				[...a.map((f) => X(...f)), ...(u.default ? [u.default()] : [])]
			);
		};
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const cr = se("BookOpenIcon", [
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
 */ const ur = se("BriefcaseIcon", [
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
 */ const lr = se("ChevronDownIcon", [
	["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const fr = se("TrendingUpIcon", [
	["polyline", { points: "22 7 13.5 15.5 8.5 10.5 2 17", key: "126l90" }],
	["polyline", { points: "16 7 22 7 22 13", key: "kwv8wd" }],
]);
/**
 * @license lucide-vue-next v0.309.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */ const dr = se("UsersIcon", [
		[
			"path",
			{ d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" },
		],
		["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
		["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
		["path", { d: "M16 3.13a4 4 0 0 1 0 7.75", key: "1da9ce" }],
	]),
	hr = $(
		"div",
		{ class: "text-base font-medium text-gray-900 leading-none" },
		" LMS ",
		-1
	),
	mr = { key: 0, class: "mt-1 text-sm text-gray-700 leading-none" },
	pr = {
		__name: "UserDropdown",
		props: { isCollapsed: { type: Boolean, default: !1 } },
		setup(e) {
			const { logout: a, user: t } = de();
			let { isLoggedIn: r } = de();
			const n = [
				{
					icon: "log-out",
					label: "Log out",
					onClick: () => {
						a.submit().then(() => {
							r = !1;
						});
					},
					condition: () => r,
				},
				{
					icon: "log-in",
					label: "Log in",
					onClick: () => {
						window.location.href = "/login";
					},
					condition: () => !r,
				},
			];
			function s(o) {
				return o
					? o
							.toLowerCase()
							.split(" ")
							.map(function (i) {
								return i
									.charAt(0)
									.toUpperCase()
									.concat(i.substr(1));
							})
							.join(" ")
					: "";
			}
			return (o, i) => (
				M(),
				me(
					w(Lt),
					{ options: n },
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
									O(or, {
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
											hr,
											w(t)
												? (M(),
												  x(
														"div",
														mr,
														le(
															s(
																w(t).split(
																	"@"
																)[0]
															)
														),
														1
												  ))
												: Fe("", !0),
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
											O(w(lr), {
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
	vr = {},
	_r = {
		width: "18",
		height: "18",
		viewBox: "0 0 18 18",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
	},
	gr = $(
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
	yr = $(
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
	Ar = $(
		"path",
		{
			d: "M14.1423 4L14.1423 14.125",
			stroke: "currentColor",
			"stroke-linecap": "round",
		},
		null,
		-1
	),
	wr = [gr, yr, Ar];
function $r(e, a) {
	return M(), x("svg", _r, wr);
}
const Sr = Ve(vr, [["render", $r]]),
	Mr = { class: "grid h-5 w-6 flex-shrink-0 place-items-center" },
	Pe = {
		__name: "SidebarLink",
		props: {
			icon: { type: Function },
			label: { type: String, default: "" },
			to: { type: String, default: "" },
			isCollapsed: { type: Boolean, default: !1 },
		},
		setup(e) {
			const a = Ue(),
				t = e;
			function r() {
				a.push({ name: t.to });
			}
			let n = ne(() => a.currentRoute.value.name === t.to);
			return (s, o) => (
				M(),
				x(
					"button",
					{
						class: R([
							"flex h-7 cursor-pointer items-center rounded text-gray-800 duration-300 ease-in-out focus:outline-none focus:transition-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-gray-400",
							w(n) ? "bg-white shadow-sm" : "hover:bg-gray-100",
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
								O(
									w(Et),
									{ text: e.label, placement: "right" },
									{
										default: pe(() => [
											fe(s.$slots, "icon", {}, () => [
												$("span", Mr, [
													(M(),
													me(We(e.icon), {
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
	};
function pa(e) {
	xt(Q({ position: "bottom-right" }, e));
}
function va(e) {
	return Ot(e).value;
}
function _a(e) {
	if (!e) return "";
	const [a, t] = e.split(":").map(Number),
		r = new Date(0, 0, 0, a, t);
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "numeric",
		hour12: !0,
	}).format(r);
}
function ga(e, a) {
	return e
		? e.toLocaleString("en-IN", {
				maximumFractionDigits: 0,
				style: "currency",
				currency: a,
		  })
		: "";
}
function ya() {
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
		{ label: "Courses", icon: cr, to: "Courses" },
		{ label: "Batches", icon: dr, to: "Batches" },
		{ label: "Statistics", icon: fr, to: "Statistics" },
		{ label: "Jobs", icon: ur, to: "Jobs" },
	];
}
const br = { class: "flex flex-col overflow-y-auto" },
	Dr = { class: "grid h-5 w-6 flex-shrink-0 place-items-center" },
	Cr = {
		__name: "AppSidebar",
		setup(e) {
			const a = Qe();
			let r = ae(Tt("sidebar_is_collapsed", !1));
			return (n, s) => (
				M(),
				x(
					"div",
					{
						class: R([
							"flex h-full flex-col justify-between transition-all duration-300 ease-in-out bg-gray-50",
							w(r) ? "w-14" : "w-56",
						]),
					},
					[
						$(
							"div",
							{
								class: R([
									"flex flex-col overflow-hidden",
									w(r) ? "items-center" : "",
								]),
							},
							[
								O(
									pr,
									{ class: "p-2", isCollapsed: w(r) },
									null,
									8,
									["isCollapsed"]
								),
								$("div", br, [
									(M(!0),
									x(
										Se,
										null,
										ze(
											w(a),
											(o) => (
												M(),
												me(
													Pe,
													{
														icon: o.icon,
														label: o.label,
														to: o.to,
														isCollapsed: w(r),
														class: "mx-2 my-0.5",
													},
													null,
													8,
													[
														"icon",
														"label",
														"to",
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
						O(
							Pe,
							{
								label: w(r) ? "Expand" : "Collapse",
								isCollapsed: w(r),
								onClick:
									s[0] ||
									(s[0] = (o) =>
										re(r)
											? (r.value = !w(r))
											: (r = !w(r))),
								class: "m-2",
							},
							{
								icon: pe(() => [
									$("span", Dr, [
										O(
											Sr,
											{
												class: R([
													"h-4.5 w-4.5 text-gray-700 duration-300 ease-in-out",
													{
														"[transform:rotateY(180deg)]":
															w(r),
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
	kr = { class: "relative flex h-full flex-col" },
	Lr = { class: "h-full flex-1" },
	Er = { class: "flex h-full" },
	xr = {
		class: "relative block min-h-0 flex-shrink-0 overflow-hidden hover:overflow-auto",
	},
	Or = { class: "w-full overflow-auto", id: "scrollContainer" },
	Tr = {
		__name: "DesktopLayout",
		setup(e) {
			return (a, t) => (
				M(),
				x("div", kr, [
					$("div", Lr, [
						$("div", Er, [
							$("div", xr, [fe(a.$slots, "sidebar"), O(Cr)]),
							$("div", Or, [fe(a.$slots, "default")]),
						]),
					]),
				])
			);
		},
	},
	Ir = { class: "flex h-full flex-col" },
	Pr = { class: "h-full overflow-auto", id: "scrollContainer" },
	Nr = ["onClick"],
	Br = {
		__name: "MobileLayout",
		setup(e) {
			const a = Ue(),
				t = ne(() => Qe());
			console.log(t.value);
			const r = (n) => {
				a.push({ name: n.to });
			};
			return (n, s) => (
				M(),
				x("div", Ir, [
					$("div", Pr, [fe(n.$slots, "default")]),
					Te(" " + le(t.value) + " ", 1),
					t.value
						? (M(),
						  x(
								"div",
								{
									key: 0,
									class: "grid grid-cols-5 border-t border-gray-300 standalone:pb-4",
									style: It({
										gridTemplateColumns: `repeat(${t.value.length}, minmax(0, 1fr))`,
									}),
								},
								[
									(M(!0),
									x(
										Se,
										null,
										ze(
											t.value,
											(o) => (
												M(),
												x(
													"button",
													{
														key: o.label,
														class: "flex flex-col items-center justify-center py-3 transition active:scale-95",
														onClick: (i) => r(o),
													},
													[
														Te(
															le(o.label) + " ",
															1
														),
														(M(),
														me(We(o.icon), {
															class: "h-6 w-6",
														})),
													],
													8,
													Nr
												)
											)
										),
										128
									)),
								],
								4
						  ))
						: Fe("", !0),
				])
			);
		},
	},
	Rr = {
		__name: "App",
		setup(e) {
			const a = er(),
				t = ne(() => (a.width < 640 ? Br : Tr));
			return (r, n) => {
				const s = Pt("router-view");
				return (
					M(),
					x(
						Se,
						null,
						[
							O(w(t), null, { default: pe(() => [O(s)]), _: 1 }),
							O(w(Xt)),
							O(w(Nt)),
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
	Hr = tt * 7,
	J = 1e3,
	ye = Xe * J,
	Ne = et * J,
	Yr = tt * J,
	jr = Hr * J,
	De = "millisecond",
	j = "second",
	V = "minute",
	F = "hour",
	N = "day",
	ce = "week",
	E = "month",
	rt = "quarter",
	B = "year",
	K = "date",
	at = "YYYY-MM-DDTHH:mm:ssZ",
	Be = "Invalid Date",
	Vr =
		/^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/,
	Fr =
		/\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g;
const Ur = {
	name: "en",
	weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split(
		"_"
	),
	months: "January_February_March_April_May_June_July_August_September_October_November_December".split(
		"_"
	),
	ordinal: function (a) {
		var t = ["th", "st", "nd", "rd"],
			r = a % 100;
		return "[" + a + (t[(r - 20) % 10] || t[r] || t[0]) + "]";
	},
};
var $e = function (a, t, r) {
		var n = String(a);
		return !n || n.length >= t
			? a
			: "" + Array(t + 1 - n.length).join(r) + a;
	},
	Wr = function (a) {
		var t = -a.utcOffset(),
			r = Math.abs(t),
			n = Math.floor(r / 60),
			s = r % 60;
		return (t <= 0 ? "+" : "-") + $e(n, 2, "0") + ":" + $e(s, 2, "0");
	},
	zr = function e(a, t) {
		if (a.date() < t.date()) return -e(t, a);
		var r = (t.year() - a.year()) * 12 + (t.month() - a.month()),
			n = a.clone().add(r, E),
			s = t - n < 0,
			o = a.clone().add(r + (s ? -1 : 1), E);
		return +(-(r + (t - n) / (s ? n - o : o - n)) || 0);
	},
	Kr = function (a) {
		return a < 0 ? Math.ceil(a) || 0 : Math.floor(a);
	},
	Jr = function (a) {
		var t = {
			M: E,
			y: B,
			w: ce,
			d: N,
			D: K,
			h: F,
			m: V,
			s: j,
			ms: De,
			Q: rt,
		};
		return (
			t[a] ||
			String(a || "")
				.toLowerCase()
				.replace(/s$/, "")
		);
	},
	Zr = function (a) {
		return a === void 0;
	};
const Gr = { s: $e, z: Wr, m: zr, a: Kr, p: Jr, u: Zr };
var te = "en",
	U = {};
U[te] = Ur;
var nt = "$isDayjsObject",
	Ce = function (a) {
		return a instanceof _e || !!(a && a[nt]);
	},
	he = function e(a, t, r) {
		var n;
		if (!a) return te;
		if (typeof a == "string") {
			var s = a.toLowerCase();
			U[s] && (n = s), t && ((U[s] = t), (n = s));
			var o = a.split("-");
			if (!n && o.length > 1) return e(o[0]);
		} else {
			var i = a.name;
			(U[i] = a), (n = i);
		}
		return !r && n && (te = n), n || (!r && te);
	},
	v = function (a, t) {
		if (Ce(a)) return a.clone();
		var r = typeof t == "object" ? t : {};
		return (r.date = a), (r.args = arguments), new _e(r);
	},
	qr = function (a, t) {
		return v(a, { locale: t.$L, utc: t.$u, x: t.$x, $offset: t.$offset });
	},
	d = Gr;
d.l = he;
d.i = Ce;
d.w = qr;
var Qr = function (a) {
		var t = a.date,
			r = a.utc;
		if (t === null) return new Date(NaN);
		if (d.u(t)) return new Date();
		if (t instanceof Date) return new Date(t);
		if (typeof t == "string" && !/Z$/i.test(t)) {
			var n = t.match(Vr);
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
		return new Date(t);
	},
	_e = (function () {
		function e(t) {
			(this.$L = he(t.locale, null, !0)),
				this.parse(t),
				(this.$x = this.$x || t.x || {}),
				(this[nt] = !0);
		}
		var a = e.prototype;
		return (
			(a.parse = function (r) {
				(this.$d = Qr(r)), this.init();
			}),
			(a.init = function () {
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
			(a.$utils = function () {
				return d;
			}),
			(a.isValid = function () {
				return this.$d.toString() !== Be;
			}),
			(a.isSame = function (r, n) {
				var s = v(r);
				return this.startOf(n) <= s && s <= this.endOf(n);
			}),
			(a.isAfter = function (r, n) {
				return v(r) < this.startOf(n);
			}),
			(a.isBefore = function (r, n) {
				return this.endOf(n) < v(r);
			}),
			(a.$g = function (r, n, s) {
				return d.u(r) ? this[n] : this.set(s, r);
			}),
			(a.unix = function () {
				return Math.floor(this.valueOf() / 1e3);
			}),
			(a.valueOf = function () {
				return this.$d.getTime();
			}),
			(a.startOf = function (r, n) {
				var s = this,
					o = d.u(n) ? !0 : n,
					i = d.p(r),
					c = function (k, y) {
						var h = d.w(
							s.$u ? Date.UTC(s.$y, y, k) : new Date(s.$y, y, k),
							s
						);
						return o ? h : h.endOf(N);
					},
					u = function (k, y) {
						var h = [0, 0, 0, 0],
							b = [23, 59, 59, 999];
						return d.w(
							s
								.toDate()
								[k].apply(s.toDate("s"), (o ? h : b).slice(y)),
							s
						);
					},
					l = this.$W,
					p = this.$M,
					f = this.$D,
					g = "set" + (this.$u ? "UTC" : "");
				switch (i) {
					case B:
						return o ? c(1, 0) : c(31, 11);
					case E:
						return o ? c(1, p) : c(0, p + 1);
					case ce: {
						var S = this.$locale().weekStart || 0,
							C = (l < S ? l + 7 : l) - S;
						return c(o ? f - C : f + (6 - C), p);
					}
					case N:
					case K:
						return u(g + "Hours", 0);
					case F:
						return u(g + "Minutes", 1);
					case V:
						return u(g + "Seconds", 2);
					case j:
						return u(g + "Milliseconds", 3);
					default:
						return this.clone();
				}
			}),
			(a.endOf = function (r) {
				return this.startOf(r, !1);
			}),
			(a.$set = function (r, n) {
				var s,
					o = d.p(r),
					i = "set" + (this.$u ? "UTC" : ""),
					c = ((s = {}),
					(s[N] = i + "Date"),
					(s[K] = i + "Date"),
					(s[E] = i + "Month"),
					(s[B] = i + "FullYear"),
					(s[F] = i + "Hours"),
					(s[V] = i + "Minutes"),
					(s[j] = i + "Seconds"),
					(s[De] = i + "Milliseconds"),
					s)[o],
					u = o === N ? this.$D + (n - this.$W) : n;
				if (o === E || o === B) {
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
			(a.set = function (r, n) {
				return this.clone().$set(r, n);
			}),
			(a.get = function (r) {
				return this[d.p(r)]();
			}),
			(a.add = function (r, n) {
				var s = this,
					o;
				r = Number(r);
				var i = d.p(n),
					c = function (f) {
						var g = v(s);
						return d.w(g.date(g.date() + Math.round(f * r)), s);
					};
				if (i === E) return this.set(E, this.$M + r);
				if (i === B) return this.set(B, this.$y + r);
				if (i === N) return c(1);
				if (i === ce) return c(7);
				var u =
						((o = {}), (o[V] = ye), (o[F] = Ne), (o[j] = J), o)[
							i
						] || 1,
					l = this.$d.getTime() + r * u;
				return d.w(l, this);
			}),
			(a.subtract = function (r, n) {
				return this.add(r * -1, n);
			}),
			(a.format = function (r) {
				var n = this,
					s = this.$locale();
				if (!this.isValid()) return s.invalidDate || Be;
				var o = r || at,
					i = d.z(this),
					c = this.$H,
					u = this.$m,
					l = this.$M,
					p = s.weekdays,
					f = s.months,
					g = s.meridiem,
					S = function (h, b, A, W) {
						return (h && (h[b] || h(n, o))) || A[b].slice(0, W);
					},
					C = function (h) {
						return d.s(c % 12 || 12, h, "0");
					},
					D =
						g ||
						function (y, h, b) {
							var A = y < 12 ? "AM" : "PM";
							return b ? A.toLowerCase() : A;
						},
					k = function (h) {
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
								return S(s.weekdaysMin, n.$W, p, 2);
							case "ddd":
								return S(s.weekdaysShort, n.$W, p, 3);
							case "dddd":
								return p[n.$W];
							case "H":
								return String(c);
							case "HH":
								return d.s(c, 2, "0");
							case "h":
								return C(1);
							case "hh":
								return C(2);
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
				return o.replace(Fr, function (y, h) {
					return h || k(y) || i.replace(":", "");
				});
			}),
			(a.utcOffset = function () {
				return -Math.round(this.$d.getTimezoneOffset() / 15) * 15;
			}),
			(a.diff = function (r, n, s) {
				var o = this,
					i = d.p(n),
					c = v(r),
					u = (c.utcOffset() - this.utcOffset()) * ye,
					l = this - c,
					p = function () {
						return d.m(o, c);
					},
					f;
				switch (i) {
					case B:
						f = p() / 12;
						break;
					case E:
						f = p();
						break;
					case rt:
						f = p() / 3;
						break;
					case ce:
						f = (l - u) / jr;
						break;
					case N:
						f = (l - u) / Yr;
						break;
					case F:
						f = l / Ne;
						break;
					case V:
						f = l / ye;
						break;
					case j:
						f = l / J;
						break;
					default:
						f = l;
						break;
				}
				return s ? f : d.a(f);
			}),
			(a.daysInMonth = function () {
				return this.endOf(E).$D;
			}),
			(a.$locale = function () {
				return U[this.$L];
			}),
			(a.locale = function (r, n) {
				if (!r) return this.$L;
				var s = this.clone(),
					o = he(r, n, !0);
				return o && (s.$L = o), s;
			}),
			(a.clone = function () {
				return d.w(this.$d, this);
			}),
			(a.toDate = function () {
				return new Date(this.valueOf());
			}),
			(a.toJSON = function () {
				return this.isValid() ? this.toISOString() : null;
			}),
			(a.toISOString = function () {
				return this.$d.toISOString();
			}),
			(a.toString = function () {
				return this.$d.toUTCString();
			}),
			e
		);
	})(),
	st = _e.prototype;
v.prototype = st;
[
	["$ms", De],
	["$s", j],
	["$m", V],
	["$H", F],
	["$W", N],
	["$M", E],
	["$y", B],
	["$D", K],
].forEach(function (e) {
	st[e[1]] = function (a) {
		return this.$g(a, e[0], e[1]);
	};
});
v.extend = function (e, a) {
	return e.$i || (e(a, _e, v), (e.$i = !0)), v;
};
v.locale = he;
v.isDayjs = Ce;
v.unix = function (e) {
	return v(e * 1e3);
};
v.en = U[te];
v.Ls = U;
v.p = {};
const Xr = function (e, a, t) {
	e = e || {};
	var r = a.prototype,
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
	(t.en.relativeTime = n),
		(r.fromToBase = function (i, c, u, l, p) {
			for (
				var f = u.$locale().relativeTime || n,
					g = e.thresholds || [
						{ l: "s", r: 44, d: j },
						{ l: "m", r: 89 },
						{ l: "mm", r: 44, d: V },
						{ l: "h", r: 89 },
						{ l: "hh", r: 21, d: F },
						{ l: "d", r: 35 },
						{ l: "dd", r: 25, d: N },
						{ l: "M", r: 45 },
						{ l: "MM", r: 10, d: E },
						{ l: "y", r: 17 },
						{ l: "yy", d: B },
					],
					S = g.length,
					C,
					D,
					k,
					y = 0;
				y < S;
				y += 1
			) {
				var h = g[y];
				h.d && (C = l ? t(i).diff(u, h.d, !0) : u.diff(i, h.d, !0));
				var b = (e.rounding || Math.round)(Math.abs(C));
				if (((k = C > 0), b <= h.r || !h.r)) {
					b <= 1 && y > 0 && (h = g[y - 1]);
					var A = f[h.l];
					p && (b = p("" + b)),
						typeof A == "string"
							? (D = A.replace("%d", b))
							: (D = A(b, c, h.l, k));
					break;
				}
			}
			if (c) return D;
			var W = k ? f.future : f.past;
			return typeof W == "function" ? W(D) : W.replace("%s", D);
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
		return c.$u ? t.utc() : t();
	};
	(r.toNow = function (i) {
		return this.to(o(this), i);
	}),
		(r.fromNow = function (i) {
			return this.from(o(this), i);
		});
};
var ea = function (a) {
		return a.replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g, function (t, r, n) {
			return r || n.slice(1);
		});
	},
	ot = {
		LTS: "h:mm:ss A",
		LT: "h:mm A",
		L: "MM/DD/YYYY",
		LL: "MMMM D, YYYY",
		LLL: "MMMM D, YYYY h:mm A",
		LLLL: "dddd, MMMM D, YYYY h:mm A",
	},
	ta = function (a, t) {
		return a.replace(
			/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,
			function (r, n, s) {
				var o = s && s.toUpperCase();
				return n || t[s] || ot[s] || ea(t[o]);
			}
		);
	};
const ra = function (e, a, t) {
		var r = a.prototype,
			n = r.format;
		(t.en.formats = ot),
			(r.format = function (s) {
				s === void 0 && (s = at);
				var o = this.$locale(),
					i = o.formats,
					c = i === void 0 ? {} : i,
					u = ta(s, c);
				return n.call(this, u);
			});
	},
	aa = function (e, a, t) {
		t.updateLocale = function (r, n) {
			var s = t.Ls,
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
	na = function (e, a, t) {
		var r = a.prototype;
		r.isToday = function () {
			var n = "YYYY-MM-DD",
				s = t();
			return this.format(n) === s.format(n);
		};
	},
	sa = function (e, a) {
		a.prototype.isSameOrBefore = function (t, r) {
			return this.isSame(t, r) || this.isBefore(t, r);
		};
	},
	oa = function (e, a) {
		a.prototype.isSameOrAfter = function (t, r) {
			return this.isSame(t, r) || this.isAfter(t, r);
		};
	};
v.extend(aa);
v.extend(Xr);
v.extend(ra);
v.extend(na);
v.extend(sa);
v.extend(oa);
function ia(e) {
	(e.config.globalProperties.__ = ca), window.translatedMessages || ua();
}
function ca(e) {
	let t = (window.translatedMessages || {})[e] || e;
	return /{\d+}/.test(e)
		? {
				format: function (...n) {
					return t.replace(/{(\d+)}/g, function (s, o) {
						return typeof n[o] != "undefined" ? n[o] : s;
					});
				},
		  }
		: t;
}
function ua(e) {
	ue({
		url: "lms.lms.api.get_translations",
		cache: "translations",
		auto: !0,
		transform: (a) => {
			window.translatedMessages = a;
		},
	});
}
const la = 9e3;
function fa() {
	let e = window.location.hostname,
		a = window.site_name || e,
		t = window.location.port ? `:${la}` : "",
		n = `${t ? "http" : "https"}://${e}${t}/${a}`,
		s = Bt(n, { withCredentials: !0, reconnectionAttempts: 5 });
	return (
		s.on("refetch_resource", (o) => {
			if (o.cache_key) {
				let i = Rt(o.cache_key) || Ht(o.cache_key);
				i && i.reload();
			}
		}),
		s
	);
}
let da = Wt(),
	I = Yt(Rr);
Ft("resourceFetcher", Ut);
I.use(jt);
I.use(da);
I.use(be);
I.use(ia);
I.use(Vt);
I.provide("$dayjs", v);
I.provide("$socket", fa());
I.mount("#app");
const { userResource: it } = Me();
de();
I.provide("$user", it);
I.config.globalProperties.$user = it;
export {
	cr as B,
	lr as C,
	dr as U,
	se as a,
	ga as b,
	pa as c,
	_a as f,
	ya as g,
	de as s,
	va as t,
};
function __vite__mapDeps(indexes) {
	if (!__vite__mapDeps.viteFileDeps) {
		__vite__mapDeps.viteFileDeps = [
			"assets/Home-x768lxic.js",
			"assets/frappe-ui-iPT8hMkb.js",
			"assets/frappe-ui-f0ZsshpU.css",
			"assets/Courses-hTDCCPUa.js",
			"assets/CourseCard-1i2yp1tI.js",
			"assets/UserAvatar-nJqmkBPv.js",
			"assets/star-xishKgdq.js",
			"assets/CourseCard-w2R5j-Mr.css",
			"assets/plus-_m-8cMp1.js",
			"assets/CourseDetail-hyS6u7Jr.js",
			"assets/CourseOutline-7cUm8E8p.js",
			"assets/CourseOutline-S7REli5R.css",
			"assets/CourseDetail-SyEqAeUc.css",
			"assets/Lesson-DbPY_b_T.js",
			"assets/Discussions-0iopHFAD.js",
			"assets/Lesson-EmJokeso.css",
			"assets/Batches-gDWZzuli.js",
			"assets/clock-z0R6Od6V.js",
			"assets/Batches-1PjOhl-q.css",
			"assets/BatchDetail-MDvOC8VN.js",
			"assets/BatchDetail-AhnKex4u.css",
			"assets/Batch--wtfybfQ.js",
			"assets/Link-4jJRdvJb.js",
			"assets/book-open-check-5hpjM2tX.js",
			"assets/Batch-oDSZMopQ.css",
			"assets/Billing-hBjAglsj.js",
			"assets/Statistics-Z-8FWaV4.js",
		];
	}
	return indexes.map((i) => __vite__mapDeps.viteFileDeps[i]);
}
//# sourceMappingURL=index-qZ7Yta4u.js.map
