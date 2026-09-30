const express = require("express");
const { authenticateAdmin, requireAdminRole } = require("../middlewares/adminMiddleware");
const { getRates, getRateById, createRate, updateRate, deleteRate } = require("../Controllers/adminRateController");

const router = express.Router();
router.use(authenticateAdmin, requireAdminRole("SUPER_ADMIN", "ADMIN"));
router.get("/", getRates);
router.get("/:id", getRateById);
router.post("/", createRate);
router.put("/:id", updateRate);
router.delete("/:id", deleteRate);
module.exports = router;
