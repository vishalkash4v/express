var express = require('express');
var router = express.Router();
var Expense = require('../models/Expense');
var Participant = require('../models/Participant');
var { authenticateToken } = require('../middleware/auth');
var { isTripMember } = require('../middleware/tripAuth');
var { connectDB } = require('../utils/db');

// All routes require authentication
router.use(authenticateToken);

// Calculate settlement for a trip
router.get('/:tripId/settlement', isTripMember, async function(req, res) {
  try {
    await connectDB();
    const { tripId } = req.params;

    // Get all participants
    const participants = await Participant.find({ tripId });
    const participantMap = new Map();
    participants.forEach(p => {
      participantMap.set(p._id.toString(), {
        id: p._id.toString(),
        name: p.name,
        paid: 0,
        share: 0,
        balance: 0
      });
    });

    // Get all expenses
    const expenses = await Expense.find({ tripId });

    // Calculate paid amounts and shares
    expenses.forEach(expense => {
      const paidById = expense.paidBy.toString();
      if (participantMap.has(paidById)) {
        participantMap.get(paidById).paid += expense.amount;
      }

      // Calculate share based on split type
      let shares = {};
      const splitType = expense.splitType || 'EQUAL';
      const splitDetails = expense.splitDetails || {};

      switch (splitType) {
        case 'EQUAL':
          // Equal split among all participants
          const equalShare = expense.amount / participants.length;
          participants.forEach(p => {
            shares[p._id.toString()] = equalShare;
          });
          break;

        case 'CUSTOM':
          // Custom amounts per participant
          shares = splitDetails;
          break;

        case 'PERCENTAGE':
          // Percentage split
          Object.keys(splitDetails).forEach(pid => {
            if (participantMap.has(pid)) {
              shares[pid] = expense.amount * (splitDetails[pid] / 100);
            }
          });
          break;

        case 'EXCLUDE':
          // Split among participants not in exclusion list
          const excludedIds = Array.isArray(splitDetails) ? splitDetails : [];
          const includedParticipants = participants.filter(p => !excludedIds.includes(p._id.toString()));
          if (includedParticipants.length > 0) {
            const equalShareExclude = expense.amount / includedParticipants.length;
            includedParticipants.forEach(p => {
              shares[p._id.toString()] = equalShareExclude;
            });
          }
          break;
      }

      // Add shares to participant totals
      Object.keys(shares).forEach(pid => {
        if (participantMap.has(pid)) {
          participantMap.get(pid).share += shares[pid];
        }
      });
    });

    // Calculate balances
    const balances = [];
    participantMap.forEach((p, id) => {
      p.balance = p.share - p.paid;
      balances.push(p);
    });

    // Calculate optimized settlement (minimum transactions)
    const settlement = calculateSettlement(balances);

    // Calculate totals
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaid = balances.reduce((sum, p) => sum + p.paid, 0);
    const totalShare = balances.reduce((sum, p) => sum + p.share, 0);

    res.json({
      success: true,
      data: {
        participants: balances,
        settlement: settlement,
        summary: {
          totalExpenses,
          totalPaid,
          totalShare,
          currency: expenses[0]?.tripId?.currency || 'INR'
        }
      }
    });
  } catch (error) {
    console.error('Calculate settlement error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate settlement'
    });
  }
});

// Optimize settlement to minimum number of transactions
function calculateSettlement(balances) {
  const transactions = [];
  const balancesCopy = balances.map(p => ({ ...p }));

  // Sort by balance (debtors first, then creditors)
  balancesCopy.sort((a, b) => a.balance - b.balance);

  let i = 0; // Debtor index (negative balance)
  let j = balancesCopy.length - 1; // Creditor index (positive balance)

  while (i < j) {
    const debtor = balancesCopy[i];
    const creditor = balancesCopy[j];

    if (Math.abs(debtor.balance) < 0.01 && Math.abs(creditor.balance) < 0.01) {
      break;
    }

    if (debtor.balance >= 0 || creditor.balance <= 0) {
      break;
    }

    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

    transactions.push({
      from: debtor.id,
      fromName: debtor.name,
      to: creditor.id,
      toName: creditor.name,
      amount: parseFloat(amount.toFixed(2))
    });

    debtor.balance += amount;
    creditor.balance -= amount;

    if (Math.abs(debtor.balance) < 0.01) {
      i++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      j--;
    }
  }

  return transactions;
}

module.exports = router;
