import {
	x as r,
	F as s,
	au as t,
	K as u,
	ar as l,
	M as n,
} from "./frappe-ui-LT4YqXtx.js";
const i = {
	__name: "UserAvatar",
	props: { user: { type: Object, default: null }, size: { type: String } },
	setup(e) {
		return (a, m) =>
			e.user
				? (r(),
				  s(
						u(l),
						t(
							{
								key: 0,
								class: "avatar border border-gray-300",
								label: e.user.full_name,
								image: e.user.user_image,
								size: e.size,
							},
							a.$attrs
						),
						null,
						16,
						["label", "image", "size"]
				  ))
				: n("", !0);
	},
};
export { i as _ };
//# sourceMappingURL=UserAvatar-A3tEMZXD.js.map
