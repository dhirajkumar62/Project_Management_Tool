const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false // Making optional for simple testing flow based on req snippet
    },
    orderId: {
        type: String,
        required: true
    },
    paymentId: {
        type: String,
        required: false
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["created", "verified", "failed"],
        default: "created"
    }
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
