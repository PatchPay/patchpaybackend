const test = require("node:test");
const assert = require("node:assert/strict");
const Wallet = require("../models/Wallet");
const walletService = require("../services/wallet.service");

test("wallet credits update internal and available balances atomically", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  const originalFind = Wallet.findByPk;
  let updateArgs;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (...args) => { updateArgs = args; return [1, [{ id: 7 }]]; };
    await walletService.creditWallet({ walletId: 7, amount: "12.34", transaction: {} });
    assert.equal(updateArgs[0].balance, "balance + 12.34");
    assert.equal(updateArgs[0].availableBalance, "available_balance + 12.34");
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
    Wallet.findByPk = originalFind;
  }
});

test("completed wallet debits enforce total and available funds", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  let updateArgs;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (...args) => { updateArgs = args; return [1, [{ id: 7 }]]; };
    await walletService.debitWallet({ walletId: 7, amount: "5.00", transaction: {} });
    assert.equal(updateArgs[0].balance, "balance - 5.00");
    assert.equal(updateArgs[0].availableBalance, "available_balance - 5.00");
    assert.equal(updateArgs[1].where.balance[require("sequelize").Op.gte], "5.00");
    assert.equal(updateArgs[1].where.availableBalance[require("sequelize").Op.gte], "5.00");
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
  }
});

test("pending withdrawal reserves available balance without changing total balance", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  const originalFind = Wallet.findByPk;
  let updateArgs;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (...args) => { updateArgs = args; return [1]; };
    Wallet.findByPk = async () => ({ id: 7, balance: "5000.00", availableBalance: "1970.00" });
    const wallet = await walletService.reserveWalletBalance({ walletId: 7, amount: "3030.00", transaction: {} });
    assert.equal(updateArgs[0].availableBalance, "available_balance - 3030.00");
    assert.equal("balance" in updateArgs[0], false);
    assert.equal(wallet.balance, "5000.00");
    assert.equal(wallet.availableBalance, "1970.00");
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
    Wallet.findByPk = originalFind;
  }
});

test("escrow funding holds funds, release consumes the hold, and refund restores availability", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  const originalFind = Wallet.findByPk;
  const updates = [];
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (values, options) => {
      updates.push({ values, options });
      return [1];
    };
    Wallet.findByPk = async () => ({ id: 7, balance: "15000.00", availableBalance: "10000.00" });

    await walletService.reserveWalletBalance({ walletId: 7, amount: "5000.00", transaction: {} });
    assert.deepEqual(updates[0].values, { availableBalance: "available_balance - 5000.00" });
    assert.equal(updates[0].options.where.availableBalance[require("sequelize").Op.gte], "5000.00");

    await walletService.settleWalletReservation({ walletId: 7, amount: "5000.00", transaction: {} });
    assert.deepEqual(updates[1].values, { balance: "balance - 5000.00" });
    assert.equal("availableBalance" in updates[1].values, false);

    await walletService.releaseWalletReservation({ walletId: 7, amount: "5000.00", transaction: {} });
    assert.deepEqual(updates[2].values, { availableBalance: "available_balance + 5000.00" });
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
    Wallet.findByPk = originalFind;
  }
});

test("spending more than the post-escrow available balance is rejected", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async () => [0];
    await assert.rejects(
      walletService.debitWallet({ walletId: 7, amount: "7000.00", transaction: {} }),
      (error) => error.statusCode === 400 && error.message === "Insufficient balance",
    );
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
  }
});

test("successful withdrawal settlement reduces total balance only", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  const originalFind = Wallet.findByPk;
  let updateArgs;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (...args) => { updateArgs = args; return [1]; };
    Wallet.findByPk = async () => ({ id: 7, balance: "1970.00", availableBalance: "1970.00" });
    await walletService.settleWalletReservation({ walletId: 7, amount: "3030.00", transaction: {} });
    assert.equal(updateArgs[0].balance, "balance - 3030.00");
    assert.equal("availableBalance" in updateArgs[0], false);
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
    Wallet.findByPk = originalFind;
  }
});

test("failed withdrawal releases available funds without changing total balance", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  const originalFind = Wallet.findByPk;
  let updateArgs;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (...args) => { updateArgs = args; return [1]; };
    Wallet.findByPk = async () => ({ id: 7, balance: "5000.00", availableBalance: "5000.00" });
    const wallet = await walletService.releaseWalletReservation({ walletId: 7, amount: "3030.00", transaction: {} });
    assert.equal(updateArgs[0].availableBalance, "available_balance + 3030.00");
    assert.equal("balance" in updateArgs[0], false);
    assert.equal(wallet.balance, "5000.00");
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
    Wallet.findByPk = originalFind;
  }
});

test("refund credits restore internal funds without increasing available balance", async () => {
  const originalLiteral = Wallet.sequelize.literal;
  const originalUpdate = Wallet.update;
  let updateArgs;
  try {
    Wallet.sequelize.literal = (sql) => sql;
    Wallet.update = async (...args) => { updateArgs = args; return [1, [{ id: 7 }]]; };
    await walletService.creditWallet({ walletId: 7, amount: "2.50", transaction: {}, creditAvailable: false });
    assert.equal(updateArgs[0].balance, "balance + 2.50");
    assert.equal("availableBalance" in updateArgs[0], false);
  } finally {
    Wallet.sequelize.literal = originalLiteral;
    Wallet.update = originalUpdate;
  }
});
