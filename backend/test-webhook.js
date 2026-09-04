const crypto = require('crypto');

const secret = "revenue_recovery_secret_2026"; // Must match RAZORPAY_WEBHOOK_SECRET in .env
const targetUrl = "http://127.0.0.1:8080/webhooks/razorpay";

// Standard Razorpay payment.failed payload
const payload = {
    entity: "event",
    account_id: "acc_TestAccount123",
    event: "payment.failed",
    contains: ["payment"],
    payload: {
        payment: {
            entity: {
                id: "pay_XYZ123456",
                amount: 50000, // 500.00 INR
                currency: "INR",
                status: "failed",
                order_id: "order_ABC987654",
                error_code: "BAD_REQUEST_ERROR",
                error_description: "Payment failed due to insufficient balance.",
                error_source: "issuer",
                error_reason: "insufficient_balance",
                contact: "+919876543210"
            }
        }
    },
    created_at: Math.floor(Date.now() / 1000)
};

const body = JSON.stringify(payload);
const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

console.log("🚀 Firing simulated Razorpay webhook...");

fetch(targetUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': signature
    },
    body: body
})
    .then(res => {
        console.log(`📡 Response Status: ${res.status}`);
        return res.text();
    })
    .then(text => console.log(`📝 Response Body: ${text}`))
    .catch(err => console.error("❌ Error:", err));