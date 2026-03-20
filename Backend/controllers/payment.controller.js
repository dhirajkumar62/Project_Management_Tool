const Razorpay = require("razorpay");
const crypto = require("crypto");
const Payment = require("../models/payment.model");

let razorpay;
try {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || "dummy_key",
        key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy_secret"
    });
} catch (error) {
    console.log("Razorpay initialization error. Please set RAZORPAY env variables.");
}

// @desc    Create a new Razorpay order
// @route   POST /api/payment/create-order
// @access  Public (for demo purposes)
exports.createOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount) {
            return res.status(400).json({ success: false, message: "Amount is required" });
        }

        const options = {
            amount: amount * 100, // convert rupees to paisa
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        // Track the order in DB with initial status
        await Payment.create({
            userId: req.user ? req.user._id : null,
            orderId: order.id,
            amount: amount,
            status: "created"
        });

        res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        console.error("Razorpay order creation error:", error);
        res.status(500).json({ success: false, message: "Order creation failed" });
    }
};

// @desc    Verify Razorpay payment signature
// @route   POST /api/payment/verify
// @access  Public
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const generated_signature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generated_signature === razorpay_signature) {
            // Update payment status in DB
            await Payment.findOneAndUpdate(
                { orderId: razorpay_order_id },
                {
                    paymentId: razorpay_payment_id,
                    status: "verified"
                }
            );

            res.status(200).json({ success: true, message: "Payment verified successfully" });
        } else {
            // Update payment status as failed (or log it)
            await Payment.findOneAndUpdate(
                { orderId: razorpay_order_id },
                { status: "failed" }
            );
            res.status(400).json({ success: false, message: "Invalid payment signature" });
        }
    } catch (error) {
        console.error("Razorpay verification error:", error);
        res.status(500).json({ success: false, message: "Payment verification failed" });
    }
};

// @desc    Get Razorpay Key ID for frontend initialization
// @route   GET /api/payment/get-key
// @access  Public
exports.getKey = (req, res) => {
    res.status(200).json({ key: process.env.RAZORPAY_KEY_ID || "dummy_key_for_testing" });
};
