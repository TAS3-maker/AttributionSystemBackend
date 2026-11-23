import test from "node:test";
import assert from "node:assert/strict";

const { resolveRazorpayCheckoutToken } = await import("../services/razorpayCheckoutLinks.js");

function fakeModel(row) {
    return {
        where(filters = {}) {
            const query = {
                where(extra = {}) {
                    filters = { ...filters, ...extra };
                    return query;
                },
                async first() {
                    return Object.entries(filters).every(([key, value]) => row?.[key] === value) ? row : null;
                },
            };
            return query;
        },
    };
}

function fakeClient() {
    return {
        orm: {
            public: {
                RazorpayCheckoutPayment: fakeModel({ workspaceId: "ws1", paymentId: "pay_1", checkoutSessionId: "cs_1" }),
                CheckoutSession: fakeModel({
                    workspaceId: "ws1",
                    id: "cs_1",
                    token: "checkout-token",
                    createdAt: "2026-01-01T00:00:00.000Z",
                    expiresAt: "2026-01-08T00:00:00.000Z",
                }),
            },
        },
    };
}

test("Razorpay payment mapping resolves only for payment times inside the session window", async () => {
    const client = fakeClient();

    assert.equal(
        await resolveRazorpayCheckoutToken("ws1", "pay_1", "2026-01-04T00:00:00.000Z", client),
        "checkout-token",
    );
    assert.equal(
        await resolveRazorpayCheckoutToken("ws1", "pay_1", "2025-12-31T23:59:59.999Z", client),
        null,
    );
    assert.equal(
        await resolveRazorpayCheckoutToken("ws1", "pay_1", "2026-01-08T00:00:00.001Z", client),
        null,
    );
});
