export interface Coupon {
    name: string;
    enabled: boolean;
    code: string;
    discount_type: 'Percentage' | 'Fixed Amount';
    percentage_discount?: number;
    fixed_amount_discount?: number;
    expires_on?: string;
    description?: string;
    usage_limit?: number;
    redemptions_count: number;
    applicable_items: ApplicableItem[];
}

export type ApplicableItem = {
    reference_doctype: "LMS Course" | "LMS Batch";
    reference_name: string;
    name: string;
    parent: string;
    parenttype: "LMS Coupon";
    parentfield: "applicable_items";
}

export interface Coupons {
    data: Coupon[];
    update: (args: { filters: any[] }) => void;
    insert: { submit: (params: Coupon, options: { onSuccess: (data: Coupon) => void; onError?: (err: any) => void }) => void };
    setValue: { submit: (params: Coupon, options: { onSuccess: (data: Coupon) => void; onError?: (err: any) => void }) => void };
    reload: () => void;
}