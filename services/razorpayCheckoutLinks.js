import { db } from "../src/prisma/db.js";
import { tenantDb } from "./tenantDb.js";
import { reattribute } from "./ingestion.js";

function isWithinSession(session, paymentAt) {
    const paidAt = Date.parse(paymentAt);
    return Number.isFinite(paidAt) &&
        paidAt >= Date.parse(session.createdAt) &&
        paidAt <= Date.parse(session.expiresAt);
}

export async function resolveRazorpayCheckoutToken(workspaceId, paymentId, paymentAt, client = db) {
    if (!paymentId || !paymentAt || !Number.isFinite(Date.parse(paymentAt))) return null;
    const t = tenantDb(client, workspaceId);
    const link = await t.RazorpayCheckoutPayment.where({ paymentId }).first();
    if (!link) return null;
    const session = await t.CheckoutSession.where({ id: link.checkoutSessionId }).first();
    return session && isWithinSession(session, paymentAt) ? session.token : null;
}

async function attachTokenToExistingOrder(t, workspaceId, paymentId, session) {
    const order = await t.Order.where({ externalId: paymentId }).first();
    if (!order || !order.connectorId) return false;
    const connector = await t.Connector.where({ id: order.connectorId }).first();
    if (connector?.type !== "razorpay") return false;
    if (order.checkoutToken && order.checkoutToken !== session.token) return { conflict: true };

    if (!order.checkoutToken) {
        await t.Order.where({ id: order.id }).update({ checkoutToken: session.token });
    }
    const result = await reattribute(workspaceId, { orderId: order.id });
    return { attributed: result?.matchMethod === "token" };
}

export async function registerRazorpayCheckoutPayment(workspaceId, token, paymentId) {
    const t = tenantDb(db, workspaceId);
    const session = await t.CheckoutSession.where({ token }).first();
    if (!session) return { code: "not_found" };
    if (Date.now() > Date.parse(session.expiresAt)) return { code: "expired" };

    const order = await t.Order.where({ externalId: paymentId }).first();
    if (order?.connectorId) {
        const connector = await t.Connector.where({ id: order.connectorId }).first();
        if (connector?.type === "razorpay" && order.checkoutToken && order.checkoutToken !== session.token) {
            return { code: "conflict" };
        }
    }

    const existing = await t.RazorpayCheckoutPayment.where({ paymentId }).first();
    if (existing && existing.checkoutSessionId !== session.id) return { code: "conflict" };

    let created = false;
    if (!existing) {
        try {
            await t.RazorpayCheckoutPayment.create({ checkoutSessionId: session.id, paymentId });
            created = true;
        } catch (error) {
            if (error?.code !== "23505") throw error;
            const raced = await t.RazorpayCheckoutPayment.where({ paymentId }).first();
            if (!raced) throw error;
            if (raced.checkoutSessionId !== session.id) return { code: "conflict" };
        }
    }

    const attached = await attachTokenToExistingOrder(t, workspaceId, paymentId, session);
    if (attached?.conflict) return { code: "conflict" };
    return {
        created,
        checkoutSessionId: session.id,
        orderAttributed: Boolean(attached?.attributed),
    };
}

export async function attachRazorpayPaymentToOrder(workspaceId, paymentId, token) {
    const t = tenantDb(db, workspaceId);
    const session = await t.CheckoutSession.where({ token }).first();
    if (!session) return false;
    const link = await t.RazorpayCheckoutPayment.where({ paymentId }).first();
    if (!link || link.checkoutSessionId !== session.id) return false;
    const result = await attachTokenToExistingOrder(t, workspaceId, paymentId, session);
    return Boolean(result && !result.conflict && result.attributed);
}
