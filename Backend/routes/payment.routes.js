const express = require("express");
const { createOrder, verifyPayment, getKey } = require("../controllers/payment.controller");
const router = express.Router();

router.post("/create-order", createOrder);
router.post("/verify", verifyPayment);
router.get("/get-key", getKey);

module.exports = router;
