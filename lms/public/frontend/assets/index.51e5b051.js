var nt = Object.defineProperty,
	st = Object.defineProperties;
var ot = Object.getOwnPropertyDescriptors;
var se = Object.getOwnPropertySymbols;
var Ce = Object.prototype.hasOwnProperty,
	xe = Object.prototype.propertyIsEnumerable;
var be = (r, n, t) =>
		n in r
			? nt(r, n, {
					enumerable: !0,
					configurable: !0,
					writable: !0,
					value: t,
			  })
			: (r[n] = t),
	oe = (r, n) => {
		for (var t in n || (n = {})) Ce.call(n, t) && be(r, t, n[t]);
		if (se) for (var t of se(n)) xe.call(n, t) && be(r, t, n[t]);
		return r;
	},
	pe = (r, n) => st(r, ot(n));
var Le = (r, n) => {
	var t = {};
	for (var e in r) Ce.call(r, e) && n.indexOf(e) < 0 && (t[e] = r[e]);
	if (r != null && se)
		for (var e of se(r)) n.indexOf(e) < 0 && xe.call(r, e) && (t[e] = r[e]);
	return t;
};
var ke = (r, n, t) =>
	new Promise((e, s) => {
		var o = (c) => {
				try {
					i(t.next(c));
				} catch (u) {
					s(u);
				}
			},
			a = (c) => {
				try {
					i(t.throw(c));
				} catch (u) {
					s(u);
				}
			},
			i = (c) =>
				c.done ? e(c.value) : Promise.resolve(c.value).then(o, a);
		i((t = t.apply(r, n)).next());
	});
import {
	e as Te,
	r as re,
	m as Ne,
	i as at,
	h as it,
	a as ct,
	w as ut,
	b as lt,
	c as te,
	d as Ye,
	t as ft,
	g as dt,
	o as ht,
	n as pt,
	f as vt,
	j as $e,
	k as ce,
	l as mt,
	p as _t,
	_ as F,
	q as je,
	s as I,
	u as H,
	v as yt,
	x as Q,
	y as He,
	z as fe,
	A as w,
	B as j,
	C as O,
	D as M,
	E as Pe,
	F as gt,
	G as $t,
	H as wt,
	I as me,
	J as St,
	T as Mt,
	K as Fe,
	L as Dt,
	M as bt,
	N as Ct,
	O as xt,
	P as Lt,
	Q as kt,
	R as Ot,
	S as Et,
	U as It,
	V as At,
	W as Tt,
} from "./frappe-ui.a747cf9c.js";
(function () {
	const n = document.createElement("link").relList;
	if (n && n.supports && n.supports("modulepreload")) return;
	for (const s of document.querySelectorAll('link[rel="modulepreload"]'))
		e(s);
	new MutationObserver((s) => {
		for (const o of s)
			if (o.type === "childList")
				for (const a of o.addedNodes)
					a.tagName === "LINK" && a.rel === "modulepreload" && e(a);
	}).observe(document, { childList: !0, subtree: !0 });
	function t(s) {
		const o = {};
		return (
			s.integrity && (o.integrity = s.integrity),
			s.referrerpolicy && (o.referrerPolicy = s.referrerpolicy),
			s.crossorigin === "use-credentials"
				? (o.credentials = "include")
				: s.crossorigin === "anonymous"
				? (o.credentials = "omit")
				: (o.credentials = "same-origin"),
			o
		);
	}
	function e(s) {
		if (s.ep) return;
		s.ep = !0;
		const o = t(s);
		fetch(s.href, o);
	}
})();
/*!
 * pinia v2.1.7
 * (c) 2023 Eduardo San Martin Morote
 * @license MIT
 */ let Re;
const de = (r) => (Re = r),
	Ue = Symbol();
function _e(r) {
	return (
		r &&
		typeof r == "object" &&
		Object.prototype.toString.call(r) === "[object Object]" &&
		typeof r.toJSON != "function"
	);
}
var X;
(function (r) {
	(r.direct = "direct"),
		(r.patchObject = "patch object"),
		(r.patchFunction = "patch function");
})(X || (X = {}));
function Nt() {
	const r = Te(!0),
		n = r.run(() => re({}));
	let t = [],
		e = [];
	const s = Ne({
		install(o) {
			de(s),
				(s._a = o),
				o.provide(Ue, s),
				(o.config.globalProperties.$pinia = s),
				e.forEach((a) => t.push(a)),
				(e = []);
		},
		use(o) {
			return !this._a && !at ? e.push(o) : t.push(o), this;
		},
		_p: t,
		_a: null,
		_e: r,
		_s: new Map(),
		state: n,
	});
	return s;
}
const Ve = () => {};
function Oe(r, n, t, e = Ve) {
	r.push(n);
	const s = () => {
		const o = r.indexOf(n);
		o > -1 && (r.splice(o, 1), e());
	};
	return !t && dt() && ht(s), s;
}
function z(r, ...n) {
	r.slice().forEach((t) => {
		t(...n);
	});
}
const Yt = (r) => r();
function ye(r, n) {
	r instanceof Map && n instanceof Map && n.forEach((t, e) => r.set(e, t)),
		r instanceof Set && n instanceof Set && n.forEach(r.add, r);
	for (const t in n) {
		if (!n.hasOwnProperty(t)) continue;
		const e = n[t],
			s = r[t];
		_e(s) && _e(e) && r.hasOwnProperty(t) && !te(e) && !Ye(e)
			? (r[t] = ye(s, e))
			: (r[t] = e);
	}
	return r;
}
const jt = Symbol();
function Ht(r) {
	return !_e(r) || !r.hasOwnProperty(jt);
}
const { assign: Y } = Object;
function Pt(r) {
	return !!(te(r) && r.effect);
}
function Ft(r, n, t, e) {
	const { state: s, actions: o, getters: a } = n,
		i = t.state.value[r];
	let c;
	function u() {
		i || (t.state.value[r] = s ? s() : {});
		const l = vt(t.state.value[r]);
		return Y(
			l,
			o,
			Object.keys(a || {}).reduce(
				(v, f) => (
					(v[f] = Ne(
						$e(() => {
							de(t);
							const y = t._s.get(r);
							return a[f].call(y, y);
						})
					)),
					v
				),
				{}
			)
		);
	}
	return (c = Be(r, u, n, t, e, !0)), c;
}
function Be(r, n, t = {}, e, s, o) {
	let a;
	const i = Y({ actions: {} }, t),
		c = { deep: !0 };
	let u,
		l,
		v = [],
		f = [],
		y;
	const S = e.state.value[r];
	!o && !S && (e.state.value[r] = {}), re({});
	let C;
	function b(m) {
		let p;
		(u = l = !1),
			typeof m == "function"
				? (m(e.state.value[r]),
				  (p = { type: X.patchFunction, storeId: r, events: y }))
				: (ye(e.state.value[r], m),
				  (p = {
						type: X.patchObject,
						payload: m,
						storeId: r,
						events: y,
				  }));
		const E = (C = Symbol());
		pt().then(() => {
			C === E && (u = !0);
		}),
			(l = !0),
			z(v, p, e.state.value[r]);
	}
	const x = o
		? function () {
				const { state: p } = t,
					E = p ? p() : {};
				this.$patch((P) => {
					Y(P, E);
				});
		  }
		: Ve;
	function g() {
		a.stop(), (v = []), (f = []), e._s.delete(r);
	}
	function h(m, p) {
		return function () {
			de(e);
			const E = Array.from(arguments),
				P = [],
				G = [];
			function tt(L) {
				P.push(L);
			}
			function rt(L) {
				G.push(L);
			}
			z(f, { args: E, name: m, store: $, after: tt, onError: rt });
			let K;
			try {
				K = p.apply(this && this.$id === r ? this : $, E);
			} catch (L) {
				throw (z(G, L), L);
			}
			return K instanceof Promise
				? K.then((L) => (z(P, L), L)).catch(
						(L) => (z(G, L), Promise.reject(L))
				  )
				: (z(P, K), K);
		};
	}
	const D = {
			_p: e,
			$id: r,
			$onAction: Oe.bind(null, f),
			$patch: b,
			$reset: x,
			$subscribe(m, p = {}) {
				const E = Oe(v, m, p.detached, () => P()),
					P = a.run(() =>
						ut(
							() => e.state.value[r],
							(G) => {
								(p.flush === "sync" ? l : u) &&
									m(
										{
											storeId: r,
											type: X.direct,
											events: y,
										},
										G
									);
							},
							Y({}, c, p)
						)
					);
				return E;
			},
			$dispose: g,
		},
		$ = lt(D);
	e._s.set(r, $);
	const q = ((e._a && e._a.runWithContext) || Yt)(() =>
		e._e.run(() => (a = Te()).run(n))
	);
	for (const m in q) {
		const p = q[m];
		if ((te(p) && !Pt(p)) || Ye(p))
			o ||
				(S && Ht(p) && (te(p) ? (p.value = S[m]) : ye(p, S[m])),
				(e.state.value[r][m] = p));
		else if (typeof p == "function") {
			const E = h(m, p);
			(q[m] = E), (i.actions[m] = p);
		}
	}
	return (
		Y($, q),
		Y(ft($), q),
		Object.defineProperty($, "$state", {
			get: () => e.state.value[r],
			set: (m) => {
				b((p) => {
					Y(p, m);
				});
			},
		}),
		e._p.forEach((m) => {
			Y(
				$,
				a.run(() => m({ store: $, app: e._a, pinia: e, options: i }))
			);
		}),
		S && o && t.hydrate && t.hydrate($.$state, S),
		(u = !0),
		(l = !0),
		$
	);
}
function We(r, n, t) {
	let e, s;
	const o = typeof n == "function";
	typeof r == "string" ? ((e = r), (s = o ? t : n)) : ((s = r), (e = r.id));
	function a(i, c) {
		const u = it();
		return (
			(i = i || (u ? ct(Ue, null) : null)),
			i && de(i),
			(i = Re),
			i._s.has(e) || (o ? Be(e, n, s, i) : Ft(e, s, i)),
			i._s.get(e)
		);
	}
	return (a.$id = e), a;
}
const we = We("lms-users", () => ({
		userResource: ce({
			url: "lms.lms.api.get_user_info",
			onError(n) {
				n &&
					n.exc_type === "AuthenticationError" &&
					router.push("/login");
			},
		}),
	})),
	ue = We("lms-session", () => {
		let { userResource: r } = we();
		function n() {
			let i = new URLSearchParams(
				document.cookie.split("; ").join("&")
			).get("user_id");
			return i === "Guest" && (i = null), i;
		}
		let t = re(n());
		const e = $e(() => !!t.value),
			s = ce({
				url: "login",
				onError() {
					throw new Error("Invalid email or password");
				},
				onSuccess() {
					r.reload(),
						(t.value = n()),
						s.reset(),
						Se.replace({ path: "/" });
				},
			}),
			o = ce({
				url: "logout",
				onSuccess() {
					r.reset(), (t.value = null), window.location.reload();
				},
			});
		return { user: t, isLoggedIn: e, login: s, logout: o };
	}),
	Rt = [
		{
			path: "/",
			name: "Home",
			component: () =>
				F(
					() => import("./Home.28a136f6.js"),
					[
						"assets/Home.28a136f6.js",
						"assets/frappe-ui.a747cf9c.js",
						"assets/frappe-ui.7692ed2d.css",
					]
				),
		},
		{
			path: "/courses",
			name: "Courses",
			component: () =>
				F(
					() => import("./Courses.52ce2794.js"),
					[
						"assets/Courses.52ce2794.js",
						"assets/frappe-ui.a747cf9c.js",
						"assets/frappe-ui.7692ed2d.css",
						"assets/CourseCard.bf057db6.js",
						"assets/UserAvatar.3cd4adb4.js",
						"assets/star.d358f014.js",
						"assets/CourseCard.04c5bb55.css",
						"assets/plus.d245902e.js",
					]
				),
		},
		{
			path: "/courses/:courseName",
			name: "CourseDetail",
			component: () =>
				F(
					() => import("./CourseDetail.e391d1e0.js"),
					[
						"assets/CourseDetail.e391d1e0.js",
						"assets/frappe-ui.a747cf9c.js",
						"assets/frappe-ui.7692ed2d.css",
						"assets/index.6f049c1a.js",
						"assets/star.d358f014.js",
						"assets/CourseOutline.2110618a.js",
						"assets/CourseOutline.6dd858fb.css",
						"assets/UserAvatar.3cd4adb4.js",
						"assets/CourseDetail.6888eccf.css",
					]
				),
			props: !0,
		},
		{
			path: "/courses/:courseName/learn/:chapterNumber-:lessonNumber",
			name: "Lesson",
			component: () =>
				F(
					() => import("./Lesson.19d410ae.js"),
					[
						"assets/Lesson.19d410ae.js",
						"assets/frappe-ui.a747cf9c.js",
						"assets/frappe-ui.7692ed2d.css",
						"assets/CourseOutline.2110618a.js",
						"assets/CourseOutline.6dd858fb.css",
						"assets/UserAvatar.3cd4adb4.js",
						"assets/index.6f049c1a.js",
						"assets/Lesson.3532a62c.css",
					]
				),
			props: !0,
		},
		{
			path: "/batches",
			name: "Batches",
			component: () =>
				F(
					() => import("./Batches.6064501b.js"),
					[
						"assets/Batches.6064501b.js",
						"assets/frappe-ui.a747cf9c.js",
						"assets/frappe-ui.7692ed2d.css",
						"assets/index.6f049c1a.js",
						"assets/clock.b36d19aa.js",
						"assets/plus.d245902e.js",
						"assets/Batches.70c9cf07.css",
					]
				),
		},
		{
			path: "/batches/details/:batchName",
			name: "BatchDetail",
			component: () =>
				F(
					() => import("./BatchDetail.9bef2d15.js"),
					[
						"assets/BatchDetail.9bef2d15.js",
						"assets/frappe-ui.a747cf9c.js",
						"assets/frappe-ui.7692ed2d.css",
						"assets/index.6f049c1a.js",
						"assets/clock.b36d19aa.js",
						"assets/CourseCard.bf057db6.js",
						"assets/UserAvatar.3cd4adb4.js",
						"assets/star.d358f014.js",
						"assets/CourseCard.04c5bb55.css",
						"assets/BatchDetail.f109aa14.css",
					]
				),
			props: !0,
		},
		{
			path: "/batches/:batchName",
			name: "Batch",
			component: () =>
				F(
					() => import("./Batch.3bb9da4e.js"),
					[
						"assets/Batch.3bb9da4e.js",
						"assets/frappe-ui.a747cf9c.js",
						"assets/frappe-ui.7692ed2d.css",
						"assets/index.6f049c1a.js",
						"assets/CourseCard.bf057db6.js",
						"assets/UserAvatar.3cd4adb4.js",
						"assets/star.d358f014.js",
						"assets/CourseCard.04c5bb55.css",
						"assets/clock.b36d19aa.js",
					]
				),
			props: !0,
		},
	];
let Se = mt({ history: _t("/"), routes: Rt });
Se.beforeEach((r, n, t) =>
	ke(void 0, null, function* () {
		const { userResource: e } = we();
		let { isLoggedIn: s } = ue();
		try {
			s && (yield e.reload());
		} catch (o) {
			s = !1;
		}
		return t();
	})
);
const Ut = {},
	Vt = {
		width: "118",
		height: "118",
		viewBox: "0 0 118 118",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
	},
	Bt = yt(
		'<path d="M93.9278 0H23.1013C10.3428 0 0 10.3428 0 23.1013V93.9278C0 106.686 10.3428 117.029 23.1013 117.029H93.9278C106.686 117.029 117.029 106.686 117.029 93.9278V23.1013C117.029 10.3428 106.686 0 93.9278 0Z" fill="url(#paint0_radial_174_336)"></path><path d="M93.9278 0H23.1013C10.3428 0 0 10.3428 0 23.1013V93.9278C0 106.686 10.3428 117.029 23.1013 117.029H93.9278C106.686 117.029 117.029 106.686 117.029 93.9278V23.1013C117.029 10.3428 106.686 0 93.9278 0Z" fill="#0B3D3D" fill-opacity="0.8"></path><path d="M95.1879 33.1294L91.4077 32.0268C80.1721 28.7716 67.9389 30.9242 58.5409 37.7496C52.083 33.0769 43.9975 30.5042 36.1746 30.5042H21.8938V41.0048H36.2796C42.2649 41.0048 48.1978 42.9999 52.923 46.6226L58.5934 50.9279L64.2637 46.6226C70.144 42.1599 77.5469 40.2698 84.7923 41.2673V76.1818C75.5518 75.2367 66.2063 77.7044 58.6459 83.2172C51.0854 77.7044 41.6349 75.2367 32.4994 76.1818V52.8705H21.9988V86.4724H95.3454V33.1294H95.1879Z" fill="#58FF9B"></path><defs><radialGradient id="paint0_radial_174_336" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(117.24 -101.5) rotate(105.042) scale(226.282)"><stop offset="0.445162" stop-color="#1F7676"></stop><stop offset="1" stop-color="#0A4B4B"></stop></radialGradient></defs>',
		4
	),
	Wt = [Bt];
function zt(r, n) {
	return I(), H("svg", Vt, Wt);
}
const Jt = je(Ut, [["render", zt]]);
var ae = {
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
const Zt = (r) => r.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
	ne =
		(r, n) =>
		(u, { attrs: i, slots: c }) => {
			var l = u,
				{
					size: t,
					strokeWidth: e = 2,
					absoluteStrokeWidth: s,
					color: o,
				} = l,
				a = Le(l, [
					"size",
					"strokeWidth",
					"absoluteStrokeWidth",
					"color",
				]);
			return Q(
				"svg",
				oe(
					pe(
						oe(
							pe(oe({}, ae), {
								width: t || ae.width,
								height: t || ae.height,
								stroke: o || ae.stroke,
								"stroke-width": s
									? (Number(e) * 24) / Number(t)
									: e,
							}),
							i
						),
						{
							class: [
								"lucide",
								`lucide-${Zt(r)}`,
								(i == null ? void 0 : i.class) || "",
							],
						}
					),
					a
				),
				[...n.map((v) => Q(...v)), ...(c.default ? [c.default()] : [])]
			);
		},
	qt = ne("BookOpenIcon", [
		[
			"path",
			{ d: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", key: "vv98re" },
		],
		[
			"path",
			{ d: "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z", key: "1cyq3y" },
		],
	]),
	Gt = ne("BriefcaseIcon", [
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
	]),
	Kt = ne("ChevronDownIcon", [
		["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }],
	]),
	Qt = ne("TrendingUpIcon", [
		["polyline", { points: "22 7 13.5 15.5 8.5 10.5 2 17", key: "126l90" }],
		["polyline", { points: "16 7 22 7 22 13", key: "kwv8wd" }],
	]),
	Xt = ne("UsersIcon", [
		[
			"path",
			{ d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "1yyitq" },
		],
		["circle", { cx: "9", cy: "7", r: "4", key: "nufk8" }],
		["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87", key: "kshegd" }],
		["path", { d: "M16 3.13a4 4 0 0 1 0 7.75", key: "1da9ce" }],
	]),
	er = w(
		"div",
		{ class: "text-base font-medium text-gray-900 leading-none" },
		" LMS ",
		-1
	),
	tr = { key: 0, class: "mt-1 text-sm text-gray-700 leading-none" },
	rr = {
		__name: "UserDropdown",
		props: { isCollapsed: { type: Boolean, default: !1 } },
		setup(r) {
			const { logout: n, user: t } = ue();
			let { isLoggedIn: e } = ue();
			const s = [
				{
					icon: "log-out",
					label: "Log out",
					onClick: () => {
						n.submit().then(() => {
							e = !1;
						});
					},
					condition: () => e,
				},
				{
					icon: "log-in",
					label: "Log in",
					onClick: () => {
						window.location.href = "/login";
					},
					condition: () => !e,
				},
			];
			function o(a) {
				return a
					? a
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
			return (a, i) => (
				I(),
				He(
					M($t),
					{ options: s },
					{
						default: fe(({ open: c }) => [
							w(
								"button",
								{
									class: j([
										"flex h-12 py-2 items-center rounded-md duration-300 ease-in-out",
										r.isCollapsed
											? "px-0 w-auto"
											: c
											? "bg-white shadow-sm px-2 w-52"
											: "hover:bg-gray-200 px-2 w-52",
									]),
								},
								[
									O(Jt, {
										class: "w-8 h-8 rounded flex-shrink-0",
									}),
									w(
										"div",
										{
											class: j([
												"flex flex-1 flex-col text-left duration-300 ease-in-out",
												r.isCollapsed
													? "opacity-0 ml-0 w-0 overflow-hidden"
													: "opacity-100 ml-2 w-auto",
											]),
										},
										[
											er,
											M(t)
												? (I(),
												  H(
														"div",
														tr,
														Pe(
															o(
																M(t).split(
																	"@"
																)[0]
															)
														),
														1
												  ))
												: gt("", !0),
										],
										2
									),
									w(
										"div",
										{
											class: j([
												"duration-300 ease-in-out",
												r.isCollapsed
													? "opacity-0 ml-0 w-0 overflow-hidden"
													: "opacity-100 ml-2 w-auto",
											]),
										},
										[
											O(M(Kt), {
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
	nr = {},
	sr = {
		width: "18",
		height: "18",
		viewBox: "0 0 18 18",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
	},
	or = w(
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
	ar = w(
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
	ir = w(
		"path",
		{
			d: "M14.1423 4L14.1423 14.125",
			stroke: "currentColor",
			"stroke-linecap": "round",
		},
		null,
		-1
	),
	cr = [or, ar, ir];
function ur(r, n) {
	return I(), H("svg", sr, cr);
}
const lr = je(nr, [["render", ur]]),
	fr = { class: "grid h-5 w-6 flex-shrink-0 place-items-center" },
	Ee = {
		__name: "SidebarLink",
		props: {
			icon: { type: Function },
			label: { type: String, default: "" },
			to: { type: String, default: "" },
			isCollapsed: { type: Boolean, default: !1 },
		},
		setup(r) {
			const n = wt(),
				t = r;
			function e() {
				n.push({ name: t.to });
			}
			let s = $e(() => n.currentRoute.value.name === t.to);
			return (o, a) => (
				I(),
				H(
					"button",
					{
						class: j([
							"flex h-7 cursor-pointer items-center rounded text-gray-800 duration-300 ease-in-out focus:outline-none focus:transition-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-gray-400",
							M(s) ? "bg-white shadow-sm" : "hover:bg-gray-100",
						]),
						onClick: e,
					},
					[
						w(
							"div",
							{
								class: j([
									"flex items-center duration-300 ease-in-out",
									r.isCollapsed ? "p-1" : "px-2 py-1",
								]),
							},
							[
								O(
									M(Mt),
									{ text: r.label, placement: "right" },
									{
										default: fe(() => [
											me(o.$slots, "icon", {}, () => [
												w("span", fr, [
													(I(),
													He(St(r.icon), {
														class: "h-4 w-4 stroke-1.5 text-gray-700",
													})),
												]),
											]),
										]),
										_: 3,
									},
									8,
									["text"]
								),
								w(
									"span",
									{
										class: j([
											"flex-shrink-0 text-base duration-300 ease-in-out",
											r.isCollapsed
												? "ml-0 w-0 overflow-hidden opacity-0"
												: "ml-2 w-auto opacity-100",
										]),
									},
									Pe(r.label),
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
	dr = { class: "flex flex-col overflow-hidden" },
	hr = { class: "flex flex-col overflow-y-auto" },
	pr = { class: "grid h-5 w-6 flex-shrink-0 place-items-center" },
	vr = {
		__name: "AppSidebar",
		setup(r) {
			const n = [
				{ label: "Courses", icon: qt, to: "Courses" },
				{ label: "Batches", icon: Xt, to: "Batches" },
				{ label: "Statistics", icon: Qt, to: "Statistics" },
				{ label: "Jobs", icon: Gt, to: "Jobs" },
			];
			let e = re((() => bt("sidebar_is_collapsed", !1))());
			return (s, o) => (
				I(),
				H(
					"div",
					{
						class: j([
							"flex h-full flex-col justify-between transition-all duration-300 ease-in-out bg-gray-50",
							M(e) ? "w-12" : "w-56",
						]),
					},
					[
						w("div", dr, [
							O(
								rr,
								{ class: "p-2", isCollapsed: M(e) },
								null,
								8,
								["isCollapsed"]
							),
							w("div", hr, [
								(I(),
								H(
									Fe,
									null,
									Dt(n, (a) =>
										O(
											Ee,
											{
												icon: a.icon,
												label: a.label,
												to: a.to,
												isCollapsed: M(e),
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
									),
									64
								)),
							]),
						]),
						O(
							Ee,
							{
								label: M(e) ? "Expand" : "Collapse",
								isCollapsed: M(e),
								onClick:
									o[0] ||
									(o[0] = (a) =>
										te(e)
											? (e.value = !M(e))
											: (e = !M(e))),
								class: "m-2",
							},
							{
								icon: fe(() => [
									w("span", pr, [
										O(
											lr,
											{
												class: j([
													"h-4.5 w-4.5 text-gray-700 duration-300 ease-in-out",
													{
														"[transform:rotateY(180deg)]":
															M(e),
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
	mr = { class: "relative flex h-full flex-col" },
	_r = { class: "h-full flex-1" },
	yr = { class: "flex h-full" },
	gr = {
		class: "relative block min-h-0 flex-shrink-0 overflow-hidden hover:overflow-auto",
	},
	$r = { class: "w-full overflow-auto", id: "scrollContainer" },
	wr = {
		__name: "DesktopLayout",
		setup(r) {
			return (n, t) => (
				I(),
				H("div", mr, [
					w("div", _r, [
						w("div", yr, [
							w("div", gr, [me(n.$slots, "sidebar"), O(vr)]),
							w("div", $r, [me(n.$slots, "default")]),
						]),
					]),
				])
			);
		},
	};
let Sr = re([]),
	Mr = {
		name: "Dialogs",
		render() {
			return Sr.value.map((r) =>
				Q(
					xt,
					{
						options: r,
						modelValue: r.show,
						"onUpdate:modelValue": (n) => (r.show = n),
					},
					() => [
						Q(
							"p",
							{ class: "text-p-base text-gray-700" },
							r.message
						),
						Q(Ct, { class: "mt-2", message: r.error }),
					]
				)
			);
		},
	};
const Dr = {
	__name: "App",
	setup(r) {
		return (n, t) => {
			const e = Lt("router-view");
			return (
				I(),
				H(
					Fe,
					null,
					[
						O(wr, null, { default: fe(() => [O(e)]), _: 1 }),
						O(M(Mr)),
						O(M(kt)),
					],
					64
				)
			);
		};
	},
};
var ze = 60,
	Je = ze * 60,
	Ze = Je * 24,
	br = Ze * 7,
	Z = 1e3,
	ve = ze * Z,
	Ie = Je * Z,
	Cr = Ze * Z,
	xr = br * Z,
	Me = "millisecond",
	R = "second",
	U = "minute",
	V = "hour",
	A = "day",
	ie = "week",
	k = "month",
	qe = "quarter",
	T = "year",
	J = "date",
	Ge = "YYYY-MM-DDTHH:mm:ssZ",
	Ae = "Invalid Date",
	Lr =
		/^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/,
	kr =
		/\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g;
const Or = {
	name: "en",
	weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split(
		"_"
	),
	months: "January_February_March_April_May_June_July_August_September_October_November_December".split(
		"_"
	),
	ordinal: function (n) {
		var t = ["th", "st", "nd", "rd"],
			e = n % 100;
		return "[" + n + (t[(e - 20) % 10] || t[e] || t[0]) + "]";
	},
};
var ge = function (n, t, e) {
		var s = String(n);
		return !s || s.length >= t
			? n
			: "" + Array(t + 1 - s.length).join(e) + n;
	},
	Er = function (n) {
		var t = -n.utcOffset(),
			e = Math.abs(t),
			s = Math.floor(e / 60),
			o = e % 60;
		return (t <= 0 ? "+" : "-") + ge(s, 2, "0") + ":" + ge(o, 2, "0");
	},
	Ir = function r(n, t) {
		if (n.date() < t.date()) return -r(t, n);
		var e = (t.year() - n.year()) * 12 + (t.month() - n.month()),
			s = n.clone().add(e, k),
			o = t - s < 0,
			a = n.clone().add(e + (o ? -1 : 1), k);
		return +(-(e + (t - s) / (o ? s - a : a - s)) || 0);
	},
	Ar = function (n) {
		return n < 0 ? Math.ceil(n) || 0 : Math.floor(n);
	},
	Tr = function (n) {
		var t = {
			M: k,
			y: T,
			w: ie,
			d: A,
			D: J,
			h: V,
			m: U,
			s: R,
			ms: Me,
			Q: qe,
		};
		return (
			t[n] ||
			String(n || "")
				.toLowerCase()
				.replace(/s$/, "")
		);
	},
	Nr = function (n) {
		return n === void 0;
	};
const Yr = { s: ge, z: Er, m: Ir, a: Ar, p: Tr, u: Nr };
var ee = "en",
	B = {};
B[ee] = Or;
var Ke = "$isDayjsObject",
	De = function (n) {
		return n instanceof he || !!(n && n[Ke]);
	},
	le = function r(n, t, e) {
		var s;
		if (!n) return ee;
		if (typeof n == "string") {
			var o = n.toLowerCase();
			B[o] && (s = o), t && ((B[o] = t), (s = o));
			var a = n.split("-");
			if (!s && a.length > 1) return r(a[0]);
		} else {
			var i = n.name;
			(B[i] = n), (s = i);
		}
		return !e && s && (ee = s), s || (!e && ee);
	},
	_ = function (n, t) {
		if (De(n)) return n.clone();
		var e = typeof t == "object" ? t : {};
		return (e.date = n), (e.args = arguments), new he(e);
	},
	jr = function (n, t) {
		return _(n, { locale: t.$L, utc: t.$u, x: t.$x, $offset: t.$offset });
	},
	d = Yr;
d.l = le;
d.i = De;
d.w = jr;
var Hr = function (n) {
		var t = n.date,
			e = n.utc;
		if (t === null) return new Date(NaN);
		if (d.u(t)) return new Date();
		if (t instanceof Date) return new Date(t);
		if (typeof t == "string" && !/Z$/i.test(t)) {
			var s = t.match(Lr);
			if (s) {
				var o = s[2] - 1 || 0,
					a = (s[7] || "0").substring(0, 3);
				return e
					? new Date(
							Date.UTC(
								s[1],
								o,
								s[3] || 1,
								s[4] || 0,
								s[5] || 0,
								s[6] || 0,
								a
							)
					  )
					: new Date(
							s[1],
							o,
							s[3] || 1,
							s[4] || 0,
							s[5] || 0,
							s[6] || 0,
							a
					  );
			}
		}
		return new Date(t);
	},
	he = (function () {
		function r(t) {
			(this.$L = le(t.locale, null, !0)),
				this.parse(t),
				(this.$x = this.$x || t.x || {}),
				(this[Ke] = !0);
		}
		var n = r.prototype;
		return (
			(n.parse = function (e) {
				(this.$d = Hr(e)), this.init();
			}),
			(n.init = function () {
				var e = this.$d;
				(this.$y = e.getFullYear()),
					(this.$M = e.getMonth()),
					(this.$D = e.getDate()),
					(this.$W = e.getDay()),
					(this.$H = e.getHours()),
					(this.$m = e.getMinutes()),
					(this.$s = e.getSeconds()),
					(this.$ms = e.getMilliseconds());
			}),
			(n.$utils = function () {
				return d;
			}),
			(n.isValid = function () {
				return this.$d.toString() !== Ae;
			}),
			(n.isSame = function (e, s) {
				var o = _(e);
				return this.startOf(s) <= o && o <= this.endOf(s);
			}),
			(n.isAfter = function (e, s) {
				return _(e) < this.startOf(s);
			}),
			(n.isBefore = function (e, s) {
				return this.endOf(s) < _(e);
			}),
			(n.$g = function (e, s, o) {
				return d.u(e) ? this[s] : this.set(o, e);
			}),
			(n.unix = function () {
				return Math.floor(this.valueOf() / 1e3);
			}),
			(n.valueOf = function () {
				return this.$d.getTime();
			}),
			(n.startOf = function (e, s) {
				var o = this,
					a = d.u(s) ? !0 : s,
					i = d.p(e),
					c = function (x, g) {
						var h = d.w(
							o.$u ? Date.UTC(o.$y, g, x) : new Date(o.$y, g, x),
							o
						);
						return a ? h : h.endOf(A);
					},
					u = function (x, g) {
						var h = [0, 0, 0, 0],
							D = [23, 59, 59, 999];
						return d.w(
							o
								.toDate()
								[x].apply(o.toDate("s"), (a ? h : D).slice(g)),
							o
						);
					},
					l = this.$W,
					v = this.$M,
					f = this.$D,
					y = "set" + (this.$u ? "UTC" : "");
				switch (i) {
					case T:
						return a ? c(1, 0) : c(31, 11);
					case k:
						return a ? c(1, v) : c(0, v + 1);
					case ie: {
						var S = this.$locale().weekStart || 0,
							C = (l < S ? l + 7 : l) - S;
						return c(a ? f - C : f + (6 - C), v);
					}
					case A:
					case J:
						return u(y + "Hours", 0);
					case V:
						return u(y + "Minutes", 1);
					case U:
						return u(y + "Seconds", 2);
					case R:
						return u(y + "Milliseconds", 3);
					default:
						return this.clone();
				}
			}),
			(n.endOf = function (e) {
				return this.startOf(e, !1);
			}),
			(n.$set = function (e, s) {
				var o,
					a = d.p(e),
					i = "set" + (this.$u ? "UTC" : ""),
					c = ((o = {}),
					(o[A] = i + "Date"),
					(o[J] = i + "Date"),
					(o[k] = i + "Month"),
					(o[T] = i + "FullYear"),
					(o[V] = i + "Hours"),
					(o[U] = i + "Minutes"),
					(o[R] = i + "Seconds"),
					(o[Me] = i + "Milliseconds"),
					o)[a],
					u = a === A ? this.$D + (s - this.$W) : s;
				if (a === k || a === T) {
					var l = this.clone().set(J, 1);
					l.$d[c](u),
						l.init(),
						(this.$d = l.set(
							J,
							Math.min(this.$D, l.daysInMonth())
						).$d);
				} else c && this.$d[c](u);
				return this.init(), this;
			}),
			(n.set = function (e, s) {
				return this.clone().$set(e, s);
			}),
			(n.get = function (e) {
				return this[d.p(e)]();
			}),
			(n.add = function (e, s) {
				var o = this,
					a;
				e = Number(e);
				var i = d.p(s),
					c = function (f) {
						var y = _(o);
						return d.w(y.date(y.date() + Math.round(f * e)), o);
					};
				if (i === k) return this.set(k, this.$M + e);
				if (i === T) return this.set(T, this.$y + e);
				if (i === A) return c(1);
				if (i === ie) return c(7);
				var u =
						((a = {}), (a[U] = ve), (a[V] = Ie), (a[R] = Z), a)[
							i
						] || 1,
					l = this.$d.getTime() + e * u;
				return d.w(l, this);
			}),
			(n.subtract = function (e, s) {
				return this.add(e * -1, s);
			}),
			(n.format = function (e) {
				var s = this,
					o = this.$locale();
				if (!this.isValid()) return o.invalidDate || Ae;
				var a = e || Ge,
					i = d.z(this),
					c = this.$H,
					u = this.$m,
					l = this.$M,
					v = o.weekdays,
					f = o.months,
					y = o.meridiem,
					S = function (h, D, $, W) {
						return (h && (h[D] || h(s, a))) || $[D].slice(0, W);
					},
					C = function (h) {
						return d.s(c % 12 || 12, h, "0");
					},
					b =
						y ||
						function (g, h, D) {
							var $ = g < 12 ? "AM" : "PM";
							return D ? $.toLowerCase() : $;
						},
					x = function (h) {
						switch (h) {
							case "YY":
								return String(s.$y).slice(-2);
							case "YYYY":
								return d.s(s.$y, 4, "0");
							case "M":
								return l + 1;
							case "MM":
								return d.s(l + 1, 2, "0");
							case "MMM":
								return S(o.monthsShort, l, f, 3);
							case "MMMM":
								return S(f, l);
							case "D":
								return s.$D;
							case "DD":
								return d.s(s.$D, 2, "0");
							case "d":
								return String(s.$W);
							case "dd":
								return S(o.weekdaysMin, s.$W, v, 2);
							case "ddd":
								return S(o.weekdaysShort, s.$W, v, 3);
							case "dddd":
								return v[s.$W];
							case "H":
								return String(c);
							case "HH":
								return d.s(c, 2, "0");
							case "h":
								return C(1);
							case "hh":
								return C(2);
							case "a":
								return b(c, u, !0);
							case "A":
								return b(c, u, !1);
							case "m":
								return String(u);
							case "mm":
								return d.s(u, 2, "0");
							case "s":
								return String(s.$s);
							case "ss":
								return d.s(s.$s, 2, "0");
							case "SSS":
								return d.s(s.$ms, 3, "0");
							case "Z":
								return i;
						}
						return null;
					};
				return a.replace(kr, function (g, h) {
					return h || x(g) || i.replace(":", "");
				});
			}),
			(n.utcOffset = function () {
				return -Math.round(this.$d.getTimezoneOffset() / 15) * 15;
			}),
			(n.diff = function (e, s, o) {
				var a = this,
					i = d.p(s),
					c = _(e),
					u = (c.utcOffset() - this.utcOffset()) * ve,
					l = this - c,
					v = function () {
						return d.m(a, c);
					},
					f;
				switch (i) {
					case T:
						f = v() / 12;
						break;
					case k:
						f = v();
						break;
					case qe:
						f = v() / 3;
						break;
					case ie:
						f = (l - u) / xr;
						break;
					case A:
						f = (l - u) / Cr;
						break;
					case V:
						f = l / Ie;
						break;
					case U:
						f = l / ve;
						break;
					case R:
						f = l / Z;
						break;
					default:
						f = l;
						break;
				}
				return o ? f : d.a(f);
			}),
			(n.daysInMonth = function () {
				return this.endOf(k).$D;
			}),
			(n.$locale = function () {
				return B[this.$L];
			}),
			(n.locale = function (e, s) {
				if (!e) return this.$L;
				var o = this.clone(),
					a = le(e, s, !0);
				return a && (o.$L = a), o;
			}),
			(n.clone = function () {
				return d.w(this.$d, this);
			}),
			(n.toDate = function () {
				return new Date(this.valueOf());
			}),
			(n.toJSON = function () {
				return this.isValid() ? this.toISOString() : null;
			}),
			(n.toISOString = function () {
				return this.$d.toISOString();
			}),
			(n.toString = function () {
				return this.$d.toUTCString();
			}),
			r
		);
	})(),
	Qe = he.prototype;
_.prototype = Qe;
[
	["$ms", Me],
	["$s", R],
	["$m", U],
	["$H", V],
	["$W", A],
	["$M", k],
	["$y", T],
	["$D", J],
].forEach(function (r) {
	Qe[r[1]] = function (n) {
		return this.$g(n, r[0], r[1]);
	};
});
_.extend = function (r, n) {
	return r.$i || (r(n, he, _), (r.$i = !0)), _;
};
_.locale = le;
_.isDayjs = De;
_.unix = function (r) {
	return _(r * 1e3);
};
_.en = B[ee];
_.Ls = B;
_.p = {};
const Pr = function (r, n, t) {
	r = r || {};
	var e = n.prototype,
		s = {
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
	(t.en.relativeTime = s),
		(e.fromToBase = function (i, c, u, l, v) {
			for (
				var f = u.$locale().relativeTime || s,
					y = r.thresholds || [
						{ l: "s", r: 44, d: R },
						{ l: "m", r: 89 },
						{ l: "mm", r: 44, d: U },
						{ l: "h", r: 89 },
						{ l: "hh", r: 21, d: V },
						{ l: "d", r: 35 },
						{ l: "dd", r: 25, d: A },
						{ l: "M", r: 45 },
						{ l: "MM", r: 10, d: k },
						{ l: "y", r: 17 },
						{ l: "yy", d: T },
					],
					S = y.length,
					C,
					b,
					x,
					g = 0;
				g < S;
				g += 1
			) {
				var h = y[g];
				h.d && (C = l ? t(i).diff(u, h.d, !0) : u.diff(i, h.d, !0));
				var D = (r.rounding || Math.round)(Math.abs(C));
				if (((x = C > 0), D <= h.r || !h.r)) {
					D <= 1 && g > 0 && (h = y[g - 1]);
					var $ = f[h.l];
					v && (D = v("" + D)),
						typeof $ == "string"
							? (b = $.replace("%d", D))
							: (b = $(D, c, h.l, x));
					break;
				}
			}
			if (c) return b;
			var W = x ? f.future : f.past;
			return typeof W == "function" ? W(b) : W.replace("%s", b);
		});
	function o(i, c, u, l) {
		return e.fromToBase(i, c, u, l);
	}
	(e.to = function (i, c) {
		return o(i, c, this, !0);
	}),
		(e.from = function (i, c) {
			return o(i, c, this);
		});
	var a = function (c) {
		return c.$u ? t.utc() : t();
	};
	(e.toNow = function (i) {
		return this.to(a(this), i);
	}),
		(e.fromNow = function (i) {
			return this.from(a(this), i);
		});
};
var Fr = function (n) {
		return n.replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g, function (t, e, s) {
			return e || s.slice(1);
		});
	},
	Xe = {
		LTS: "h:mm:ss A",
		LT: "h:mm A",
		L: "MM/DD/YYYY",
		LL: "MMMM D, YYYY",
		LLL: "MMMM D, YYYY h:mm A",
		LLLL: "dddd, MMMM D, YYYY h:mm A",
	},
	Rr = function (n, t) {
		return n.replace(
			/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g,
			function (e, s, o) {
				var a = o && o.toUpperCase();
				return s || t[o] || Xe[o] || Fr(t[a]);
			}
		);
	};
const Ur = function (r, n, t) {
		var e = n.prototype,
			s = e.format;
		(t.en.formats = Xe),
			(e.format = function (o) {
				o === void 0 && (o = Ge);
				var a = this.$locale(),
					i = a.formats,
					c = i === void 0 ? {} : i,
					u = Rr(o, c);
				return s.call(this, u);
			});
	},
	Vr = function (r, n, t) {
		t.updateLocale = function (e, s) {
			var o = t.Ls,
				a = o[e];
			if (!!a) {
				var i = s ? Object.keys(s) : [];
				return (
					i.forEach(function (c) {
						a[c] = s[c];
					}),
					a
				);
			}
		};
	},
	Br = function (r, n, t) {
		var e = n.prototype;
		e.isToday = function () {
			var s = "YYYY-MM-DD",
				o = t();
			return this.format(s) === o.format(s);
		};
	};
_.extend(Vr);
_.extend(Pr);
_.extend(Ur);
_.extend(Br);
function Wr(r) {
	(r.config.globalProperties.__ = zr), window.translatedMessages || Jr();
}
function zr(r) {
	let t = (window.translatedMessages || {})[r] || r;
	return /{\d+}/.test(r)
		? {
				format: function (...s) {
					return t.replace(/{(\d+)}/g, function (o, a) {
						return typeof s[a] != "undefined" ? s[a] : o;
					});
				},
		  }
		: t;
}
function Jr(r) {
	ce({
		url: "lms.lms.api.get_translations",
		cache: "translations",
		auto: !0,
		transform: (n) => {
			window.translatedMessages = n;
		},
	});
}
let Zr = Nt(),
	N = Ot(Dr);
At("resourceFetcher", Tt);
N.use(Et);
N.use(Zr);
N.use(Se);
N.use(Wr);
N.use(It);
N.provide("$dayjs", _);
N.mount("#app");
const { userResource: et } = we();
ue();
N.provide("$user", et);
N.config.globalProperties.$user = et;
export { qt as B, Xt as U, ne as c, ue as s };
