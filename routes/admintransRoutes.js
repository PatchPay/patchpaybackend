const express = require("express")

const router = express.Router()

const {
    authenticateAdmin
} = require('../middlewares/adminMiddleware.js')

const {
    getAllTransactions
} = require("../Controllers/admintransaction.js")


router.get("/all", authenticateAdmin, getAllTransactions)


module.exports = router;