const crypto = require('crypto');
const secret = "revenue_recovery_secret_2026"; // Must match .env
const targetUrl = "http://127.0.0.1:8080/webhooks/razorpay";

const failures = [
    { code: 'insufficient_balance', desc: 'Payment failed due to insufficient balance.' },
    { code: 'gateway_timeout', desc: 'The payment gateway timed out.' },
    { code: 'card_declined', desc: 'The issuing bank declined the card.' },
    { code: 'authentication_failed', desc: '3D Secure authentication failed.' },
    { code: 'insufficient_balance', desc: 'Not enough funds in account.' }
];

function createPayload(event, amount, code, desc, orderId, linkId) {
    if (event === 'payment.failed') {
        return {
            event: "payment.failed",
            payload: {
                payment: {
                    entity: { id: `pay_${Date.now()}`, amount, currency: "INR", status: "failed", order_id: orderId, error_code: code, error_description: desc, contact: "+919876543210" }
                }
            }
        };
    } else {
        return {
            event: "payment_link.paid",
            payload: {
                payment_link: {
                    entity: { id: linkId, amount, amount_paid: amount, status: "paid", reference_id: orderId }
                }
            }
        };
    }
}

async function sendWebhook(payload) {
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    try {
        await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature },
            body
        });
    } catch (e) {
        console.error("Failed to send webhook");
    }
}

async function runSimulation() {
    console.log("🚀 Starting Batch Simulation...");
    let orderCounter = 1000;

    for (let i = 0; i < 20; i++) {
        const orderId = `order_SIM${orderCounter++}`;
        const amount = Math.floor(Math.random() * 50000) + 10000; // 100 to 500 INR
        const error = failures[i % failures.length];

        console.log(`[Batch] 📉 Firing failure for ${orderId} (${error.code})`);
        await sendWebhook(createPayload('payment.failed', amount, error.code, error.desc, orderId));
        await new Promise(r => setTimeout(r, 1000)); // Wait for AI router to process

        // Simulate 40% of users successfully paying the recovery link
        if (Math.random() > 0.6) {
            console.log(`[Batch] 💸 User paid recovery link for ${orderId}! Closing loop...`);
            // Note: In reality, we'd pull the actual generated link ID, but we simulate a match via reference_id
            await sendWebhook(createPayload('payment_link.paid', amount, null, null, orderId, `plink_SIM${Date.now()}`));
            await new Promise(r => setTimeout(r, 500));
        }
    }

    console.log("✅ Batch Simulation Complete.");
    console.log("📊 View metrics at: http://localhost:8080/api/metrics");
}

runSimulation();