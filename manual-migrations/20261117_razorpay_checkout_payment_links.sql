-- Link a Razorpay payment ID to the checkout session that produced it.
CREATE TABLE IF NOT EXISTS "public"."RazorpayCheckoutPayment" (
  "id" text NOT NULL,
  "workspaceId" text NOT NULL,
  "checkoutSessionId" text NOT NULL,
  "paymentId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "RazorpayCheckoutPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RazorpayCheckoutPayment_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE,
  CONSTRAINT "RazorpayCheckoutPayment_checkoutSessionId_fkey"
    FOREIGN KEY ("checkoutSessionId") REFERENCES "public"."CheckoutSession"("id") ON DELETE CASCADE,
  CONSTRAINT "RazorpayCheckoutPayment_workspaceId_paymentId_key" UNIQUE ("workspaceId", "paymentId")
);

CREATE INDEX IF NOT EXISTS "rzp_checkout_ws_idx"
  ON "public"."RazorpayCheckoutPayment" ("workspaceId");
CREATE INDEX IF NOT EXISTS "rzp_checkout_session_idx"
  ON "public"."RazorpayCheckoutPayment" ("checkoutSessionId");
