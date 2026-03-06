import { Router } from "express";
import auth from '../middlewares/auth.js';
import {
    // Bank Accounts
    listBankAccounts,
    getBankAccount,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
    // Incomes
    listIncomes,
    getIncome,
    createIncome,
    updateIncome,
    deleteIncome,
    // Expenses
    listExpenses,
    getExpense,
    createExpense,
    updateExpense,
    deleteExpense,
    // Debts
    listDebts,
    getDebt,
    createDebt,
    updateDebt,
    deleteDebt,
    // Internal Transfers
    createInternalTransfer,
    getInternalTransfers,
    // Analysis
    getMonthlyBalance,
    getDebtRatio,
    getSavingsRate,
    getFinancialHealth,
    getFinancialDashboard,
    // Assets (Patrimonio)
    listAssets,
    getAsset,
    createAsset,
    updateAsset,
    deleteAsset,
    // Liabilities (Patrimonio)
    listLiabilities,
    getLiability,
    createLiability,
    updateLiability,
    deleteLiability,
    // Net Worth
    getNetWorth
} from "../controllers/finance.controller.js";

const router = Router();

// ============================================
// BANK ACCOUNTS ROUTES
// ============================================
router.get('/bank-accounts', auth.verifyAdmin, listBankAccounts);
router.get('/bank-accounts/:id', auth.verifyAdmin, getBankAccount);
router.post('/bank-accounts', auth.verifyAdmin, createBankAccount);
router.put('/bank-accounts/:id', auth.verifyAdmin, updateBankAccount);
router.delete('/bank-accounts/:id', auth.verifyAdmin, deleteBankAccount);

// ============================================
// INCOMES ROUTES
// ============================================
router.get('/incomes', auth.verifyAdmin, listIncomes);
router.get('/incomes/:id', auth.verifyAdmin, getIncome);
router.post('/incomes', auth.verifyAdmin, createIncome);
router.put('/incomes/:id', auth.verifyAdmin, updateIncome);
router.delete('/incomes/:id', auth.verifyAdmin, deleteIncome);

// ============================================
// EXPENSES ROUTES
// ============================================
router.get('/expenses', auth.verifyAdmin, listExpenses);
router.get('/expenses/:id', auth.verifyAdmin, getExpense);
router.post('/expenses', auth.verifyAdmin, createExpense);
router.put('/expenses/:id', auth.verifyAdmin, updateExpense);
router.delete('/expenses/:id', auth.verifyAdmin, deleteExpense);

// ============================================
// DEBTS ROUTES
// ============================================
router.get('/debts', auth.verifyAdmin, listDebts);
router.get('/debts/:id', auth.verifyAdmin, getDebt);
router.post('/debts', auth.verifyAdmin, createDebt);
router.put('/debts/:id', auth.verifyAdmin, updateDebt);
router.delete('/debts/:id', auth.verifyAdmin, deleteDebt);

// ============================================
// INTERNAL TRANSFERS ROUTES
// ============================================
router.post('/transfer', auth.verifyAdmin, createInternalTransfer);
router.get('/internal-transfers', auth.verifyAdmin, getInternalTransfers);

// ============================================
// FINANCIAL ANALYSIS ROUTES
// ============================================
router.get('/analysis/monthly-balance', auth.verifyAdmin, getMonthlyBalance);
router.get('/analysis/debt-ratio', auth.verifyAdmin, getDebtRatio);
router.get('/analysis/savings-rate', auth.verifyAdmin, getSavingsRate);
router.get('/analysis/financial-health', auth.verifyAdmin, getFinancialHealth);
router.get('/analysis/dashboard', auth.verifyAdmin, getFinancialDashboard);

// ============================================
// ASSETS ROUTES (Patrimonio)
// ============================================
router.get('/assets', auth.verifyAdmin, listAssets);
router.get('/assets/:id', auth.verifyAdmin, getAsset);
router.post('/assets', auth.verifyAdmin, createAsset);
router.put('/assets/:id', auth.verifyAdmin, updateAsset);
router.delete('/assets/:id', auth.verifyAdmin, deleteAsset);

// ============================================
// LIABILITIES ROUTES (Patrimonio)
// ============================================
router.get('/liabilities', auth.verifyAdmin, listLiabilities);
router.get('/liabilities/:id', auth.verifyAdmin, getLiability);
router.post('/liabilities', auth.verifyAdmin, createLiability);
router.put('/liabilities/:id', auth.verifyAdmin, updateLiability);
router.delete('/liabilities/:id', auth.verifyAdmin, deleteLiability);

// ============================================
// NET WORTH ROUTE (Patrimonio Neto)
// ============================================
router.get('/net-worth', auth.verifyAdmin, getNetWorth);

export default router;
