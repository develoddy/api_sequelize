import { Op } from 'sequelize';
import moment from 'moment';
import { sequelize } from '../database/database.js';
import { BankAccount } from '../models/BankAccount.js';
import { Income } from '../models/Income.js';
import { Expense } from '../models/Expense.js';
import { Debt } from '../models/Debt.js';
import { Asset } from '../models/Asset.js';
import { Liability } from '../models/Liability.js';
import { 
    calculateMonthlyBalance,
    calculateDebtRatio,
    calculateSavingsRate,
    classifyFinancialHealth,
    getFinancialSummary,
    getInternalTransfersSummary
} from '../services/financial-analysis.service.js';

// ============================================
// BANK ACCOUNTS - Cuentas Bancarias
// ============================================

export const listBankAccounts = async (req, res) => {
    try {
        console.log('🏦 [Finance] GET /bank-accounts hit');
        const userId = req.user.id;
        console.log('  User ID:', userId);
        console.log('  Query:', req.query);
        
        const accounts = await BankAccount.findAll({
            where: { user_id: userId },
            order: [['is_active', 'DESC'], ['createdAt', 'DESC']]
        });
        
        console.log('  ✅ Found', accounts.length, 'bank accounts');

        res.status(200).json({
            success: true,
            data: accounts
        });
    } catch (error) {
        console.error('❌ [Finance ERROR] listing bank accounts:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener cuentas bancarias',
            error: error.message
        });
    }
};

export const getBankAccount = async (req, res) => {
    try {
        console.log('🏦 [Finance] GET /bank-accounts/:id hit');
        const { id } = req.params;
        const userId = req.user.id;
        console.log('  User ID:', userId);
        console.log('  Account ID:', id);

        const account = await BankAccount.findOne({
            where: { id, user_id: userId }
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta bancaria no encontrada'
            });
        }

        res.status(200).json({
            success: true,
            data: account
        });
    } catch (error) {
        console.error('Error getting bank account:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener cuenta bancaria',
            error: error.message
        });
    }
};

export const createBankAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const accountData = {
            ...req.body,
            user_id: userId
        };

        const account = await BankAccount.create(accountData);

        res.status(201).json({
            success: true,
            message: 'Cuenta bancaria creada exitosamente',
            data: account
        });
    } catch (error) {
        console.error('Error creating bank account:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear cuenta bancaria',
            error: error.message
        });
    }
};

export const updateBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const account = await BankAccount.findOne({
            where: { id, user_id: userId }
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta bancaria no encontrada'
            });
        }

        await account.update(req.body);

        res.status(200).json({
            success: true,
            message: 'Cuenta bancaria actualizada exitosamente',
            data: account
        });
    } catch (error) {
        console.error('Error updating bank account:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar cuenta bancaria',
            error: error.message
        });
    }
};

export const deleteBankAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const account = await BankAccount.findOne({
            where: { id, user_id: userId }
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: 'Cuenta bancaria no encontrada'
            });
        }

        await account.destroy();

        res.status(200).json({
            success: true,
            message: 'Cuenta bancaria eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error deleting bank account:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar cuenta bancaria',
            error: error.message
        });
    }
};

// ============================================
// INCOMES - Ingresos
// ============================================

export const listIncomes = async (req, res) => {
    try {
        console.log('💰 [Finance] GET /incomes hit');
        const userId = req.user.id;
        const { startDate, endDate, category } = req.query;
        console.log('  User ID:', userId);
        console.log('  Query params:', req.query);

        let whereClause = { user_id: userId };

        if (startDate && endDate) {
            whereClause.date = {
                [Op.between]: [startDate, endDate]
            };
        }

        if (category) {
            whereClause.category = category;
        }

        const incomes = await Income.findAll({
            where: whereClause,
            include: [
                {
                    model: BankAccount,
                    as: 'bankAccount',
                    attributes: ['id', 'name', 'bank_name']
                }
            ],
            order: [['date', 'DESC']]
        });

        console.log('  ✅ Found', incomes.length, 'incomes');
        
        res.status(200).json({
            success: true,
            data: incomes
        });
    } catch (error) {
        console.error('❌ [Finance ERROR] listing incomes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener ingresos',
            error: error.message
        });
    }
};

export const getIncome = async (req, res) => {
    try {
        console.log('💰 [Finance] GET /incomes/:id hit');
        const { id } = req.params;
        const userId = req.user.id;
        console.log('  User ID:', userId);
        console.log('  Income ID:', id);

        const income = await Income.findOne({
            where: { id, user_id: userId },
            include: [
                {
                    model: BankAccount,
                    as: 'bankAccount',
                    attributes: ['id', 'name', 'bank_name']
                }
            ]
        });

        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Ingreso no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: income
        });
    } catch (error) {
        console.error('Error getting income:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener ingreso',
            error: error.message
        });
    }
};

export const createIncome = async (req, res) => {
    try {
        const userId = req.user.id;
        const incomeData = {
            ...req.body,
            user_id: userId
        };

        const income = await Income.create(incomeData);

        // Si tiene cuenta bancaria asociada, actualizar balance
        if (income.bank_account_id) {
            const account = await BankAccount.findByPk(income.bank_account_id);
            if (account) {
                await account.update({
                    balance: parseFloat(account.balance) + parseFloat(income.amount)
                });
            }
        }

        res.status(201).json({
            success: true,
            message: 'Ingreso registrado exitosamente',
            data: income
        });
    } catch (error) {
        console.error('Error creating income:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar ingreso',
            error: error.message
        });
    }
};

export const updateIncome = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const income = await Income.findOne({
            where: { id, user_id: userId }
        });

        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Ingreso no encontrado'
            });
        }

        const oldAmount = parseFloat(income.amount);
        const newAmount = parseFloat(req.body.amount || income.amount);
        const difference = newAmount - oldAmount;

        await income.update(req.body);

        // Actualizar balance de cuenta bancaria si cambió el monto
        if (difference !== 0 && income.bank_account_id) {
            const account = await BankAccount.findByPk(income.bank_account_id);
            if (account) {
                await account.update({
                    balance: parseFloat(account.balance) + difference
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Ingreso actualizado exitosamente',
            data: income
        });
    } catch (error) {
        console.error('Error updating income:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar ingreso',
            error: error.message
        });
    }
};

export const deleteIncome = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const income = await Income.findOne({
            where: { id, user_id: userId }
        });

        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Ingreso no encontrado'
            });
        }

        // Actualizar balance de cuenta bancaria
        if (income.bank_account_id) {
            const account = await BankAccount.findByPk(income.bank_account_id);
            if (account) {
                await account.update({
                    balance: parseFloat(account.balance) - parseFloat(income.amount)
                });
            }
        }

        await income.destroy();

        res.status(200).json({
            success: true,
            message: 'Ingreso eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error deleting income:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar ingreso',
            error: error.message
        });
    }
};

// ============================================
// EXPENSES - Gastos
// ============================================

export const listExpenses = async (req, res) => {
    try {
        console.log('💳 [Finance] GET /expenses hit');
        const userId = req.user.id;
        const { startDate, endDate, category, is_essential } = req.query;
        console.log('  User ID:', userId);
        console.log('  Query params:', req.query);

        let whereClause = { user_id: userId };

        if (startDate && endDate) {
            whereClause.date = {
                [Op.between]: [startDate, endDate]
            };
        }

        if (category) {
            whereClause.category = category;
        }

        if (is_essential !== undefined) {
            whereClause.is_essential = is_essential === 'true';
        }

        const expenses = await Expense.findAll({
            where: whereClause,
            include: [
                {
                    model: BankAccount,
                    as: 'bankAccount',
                    attributes: ['id', 'name', 'bank_name']
                }
            ],
            order: [['date', 'DESC']]
        });

        console.log('  ✅ Found', expenses.length, 'expenses');
        
        res.status(200).json({
            success: true,
            data: expenses
        });
    } catch (error) {
        console.error('❌ [Finance ERROR] listing expenses:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener gastos',
            error: error.message
        });
    }
};

export const getExpense = async (req, res) => {
    try {
        console.log('💳 [Finance] GET /expenses/:id hit');
        const { id } = req.params;
        const userId = req.user.id;
        console.log('  User ID:', userId);
        console.log('  Expense ID:', id);

        const expense = await Expense.findOne({
            where: { id, user_id: userId },
            include: [
                {
                    model: BankAccount,
                    as: 'bankAccount',
                    attributes: ['id', 'name', 'bank_name']
                }
            ]
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Gasto no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: expense
        });
    } catch (error) {
        console.error('Error getting expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener gasto',
            error: error.message
        });
    }
};

export const createExpense = async (req, res) => {
    try {
        const userId = req.user.id;
        const expenseData = {
            ...req.body,
            user_id: userId
        };

        const expense = await Expense.create(expenseData);

        // Si tiene cuenta bancaria asociada, actualizar balance
        if (expense.bank_account_id) {
            const account = await BankAccount.findByPk(expense.bank_account_id);
            if (account) {
                await account.update({
                    balance: parseFloat(account.balance) - parseFloat(expense.amount)
                });
            }
        }

        res.status(201).json({
            success: true,
            message: 'Gasto registrado exitosamente',
            data: expense
        });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar gasto',
            error: error.message
        });
    }
};

export const updateExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const expense = await Expense.findOne({
            where: { id, user_id: userId }
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Gasto no encontrado'
            });
        }

        const oldAmount = parseFloat(expense.amount);
        const newAmount = parseFloat(req.body.amount || expense.amount);
        const difference = newAmount - oldAmount;

        await expense.update(req.body);

        // Actualizar balance de cuenta bancaria si cambió el monto
        if (difference !== 0 && expense.bank_account_id) {
            const account = await BankAccount.findByPk(expense.bank_account_id);
            if (account) {
                await account.update({
                    balance: parseFloat(account.balance) - difference
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Gasto actualizado exitosamente',
            data: expense
        });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar gasto',
            error: error.message
        });
    }
};

export const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const expense = await Expense.findOne({
            where: { id, user_id: userId }
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Gasto no encontrado'
            });
        }

        // Actualizar balance de cuenta bancaria
        if (expense.bank_account_id) {
            const account = await BankAccount.findByPk(expense.bank_account_id);
            if (account) {
                await account.update({
                    balance: parseFloat(account.balance) + parseFloat(expense.amount)
                });
            }
        }

        await expense.destroy();

        res.status(200).json({
            success: true,
            message: 'Gasto eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar gasto',
            error: error.message
        });
    }
};

// ============================================
// DEBTS - Deudas
// ============================================

export const listDebts = async (req, res) => {
    try {
        console.log('📝 [Finance] GET /debts hit');
        const userId = req.user.id;
        const { status } = req.query;
        console.log('  User ID:', userId);
        console.log('  Query params:', req.query);

        let whereClause = { user_id: userId };

        if (status) {
            whereClause.status = status;
        }

        const debts = await Debt.findAll({
            where: whereClause,
            include: [
                {
                    model: BankAccount,
                    as: 'bankAccount',
                    attributes: ['id', 'name', 'bank_name', 'account_type']
                }
            ],
            order: [['priority', 'DESC'], ['due_date', 'ASC']]
        });

        console.log('  ✅ Found', debts.length, 'debts');
        
        res.status(200).json({
            success: true,
            data: debts
        });
    } catch (error) {
        console.error('❌ [Finance ERROR] listing debts:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener deudas',
            error: error.message
        });
    }
};

export const getDebt = async (req, res) => {
    try {
        console.log('📝 [Finance] GET /debts/:id hit');
        const { id } = req.params;
        const userId = req.user.id;
        console.log('  User ID:', userId);
        console.log('  Debt ID:', id);

        const debt = await Debt.findOne({
            where: { id, user_id: userId },
            include: [
                {
                    model: BankAccount,
                    as: 'bankAccount',
                    attributes: ['id', 'name', 'bank_name', 'account_type']
                }
            ]
        });

        if (!debt) {
            return res.status(404).json({
                success: false,
                message: 'Deuda no encontrada'
            });
        }

        res.status(200).json({
            success: true,
            data: debt
        });
    } catch (error) {
        console.error('Error getting debt:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener deuda',
            error: error.message
        });
    }
};

export const createDebt = async (req, res) => {
    try {
        const userId = req.user.id;
        const debtData = {
            ...req.body,
            user_id: userId
        };

        const debt = await Debt.create(debtData);

        res.status(201).json({
            success: true,
            message: 'Deuda registrada exitosamente',
            data: debt
        });
    } catch (error) {
        console.error('Error creating debt:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar deuda',
            error: error.message
        });
    }
};

export const updateDebt = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const debt = await Debt.findOne({
            where: { id, user_id: userId }
        });

        if (!debt) {
            return res.status(404).json({
                success: false,
                message: 'Deuda no encontrada'
            });
        }

        await debt.update(req.body);

        res.status(200).json({
            success: true,
            message: 'Deuda actualizada exitosamente',
            data: debt
        });
    } catch (error) {
        console.error('Error updating debt:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar deuda',
            error: error.message
        });
    }
};

export const deleteDebt = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const debt = await Debt.findOne({
            where: { id, user_id: userId }
        });

        if (!debt) {
            return res.status(404).json({
                success: false,
                message: 'Deuda no encontrada'
            });
        }

        await debt.destroy();

        res.status(200).json({
            success: true,
            message: 'Deuda eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error deleting debt:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar deuda',
            error: error.message
        });
    }
};

// ============================================
// INTERNAL TRANSFERS - Transferencias Internas
// ============================================

/**
 * Crear transferencia interna entre cuentas del mismo usuario
 * 
 * Esta operación:
 * 1. Crea un expense en la cuenta origen (resta dinero)
 * 2. Crea un income en la cuenta destino (suma dinero)
 * 3. Vincula ambas transacciones
 * 4. Actualiza balances de ambas cuentas
 * 5. Todo en transacción atómica (rollback si falla)
 */
export const createInternalTransfer = async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
        const userId = req.user.id;
        const {
            source_account_id,
            target_account_id,
            amount,
            description,
            date,
            is_recurring = false,
            recurrence_type = 'none',
            notes,
            is_external = false,
            external_recipient = null
        } = req.body;

        // Validación de datos
        if (!source_account_id) {
            return res.status(400).json({
                success: false,
                message: 'Debe especificar cuenta origen'
            });
        }

        if (!is_external && !target_account_id) {
            return res.status(400).json({
                success: false,
                message: 'Debe especificar cuenta destino para transferencias internas'
            });
        }

        if (!is_external && source_account_id === target_account_id) {
            return res.status(400).json({
                success: false,
                message: 'La cuenta origen y destino no pueden ser la misma'
            });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El monto debe ser mayor a 0'
            });
        }

        // Verificar cuenta origen
        const sourceAccount = await BankAccount.findOne({
            where: { id: source_account_id, user_id: userId },
            transaction: t
        });

        if (!sourceAccount) {
            await t.rollback();
            return res.status(404).json({
                success: false,
                message: 'Cuenta origen no encontrada o no te pertenece'
            });
        }

        // Si es transferencia interna, verificar cuenta destino
        let targetAccount = null;
        if (!is_external) {
            targetAccount = await BankAccount.findOne({
                where: { id: target_account_id, user_id: userId },
                transaction: t
            });

            if (!targetAccount) {
                await t.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Cuenta destino no encontrada o no te pertenece'
                });
            }
        }

        // Verificar que la cuenta origen tenga saldo suficiente
        if (parseFloat(sourceAccount.balance) < parseFloat(amount)) {
            await t.rollback();
            return res.status(400).json({
                success: false,
                message: `Saldo insuficiente en ${sourceAccount.name}. Saldo disponible: ${sourceAccount.balance} ${sourceAccount.currency}`
            });
        }

        // === TRANSFERENCIA EXTERNA ===
        if (is_external) {
            // Solo crear EXPENSE (el dinero sale del sistema)
            const expense = await Expense.create({
                user_id: userId,
                bank_account_id: source_account_id,
                target_account_id: null,
                category: 'other', // No es internal_transfer
                amount: amount,
                currency: sourceAccount.currency,
                description: description || `Transferencia externa${external_recipient ? ` a ${external_recipient}` : ''}`,
                date: date || moment().format('YYYY-MM-DD'),
                is_recurring: is_recurring,
                recurrence_type: recurrence_type,
                is_essential: false,
                payment_method: 'bank_transfer',
                tags: 'transferencia_externa',
                notes: notes || `Transferencia externa desde ${sourceAccount.name}${external_recipient ? ` a ${external_recipient}` : ''}`
            }, { transaction: t });

            // Actualizar balance de cuenta origen
            const newSourceBalance = parseFloat(sourceAccount.balance) - parseFloat(amount);
            await sourceAccount.update({
                balance: newSourceBalance.toFixed(2)
            }, { transaction: t });

            await t.commit();

            return res.status(201).json({
                success: true,
                message: `Transferencia externa realizada: ${amount} ${sourceAccount.currency} desde ${sourceAccount.name}`,
                data: {
                    expense: expense,
                    sourceAccount: {
                        id: sourceAccount.id,
                        name: sourceAccount.name,
                        previousBalance: sourceAccount.balance,
                        newBalance: newSourceBalance.toFixed(2)
                    },
                    type: 'external'
                }
            });
        }

        // === TRANSFERENCIA INTERNA ===
        // 1️⃣ Crear EXPENSE en cuenta origen (salida de dinero)
        const expense = await Expense.create({
            user_id: userId,
            bank_account_id: source_account_id,
            target_account_id: target_account_id,
            category: 'internal_transfer',
            amount: amount,
            currency: sourceAccount.currency,
            description: description || `Transferencia a ${targetAccount.name}`,
            date: date || moment().format('YYYY-MM-DD'),
            is_recurring: is_recurring,
            recurrence_type: recurrence_type,
            is_essential: false,
            payment_method: 'bank_transfer',
            tags: 'transferencia_interna,automática',
            notes: notes || `Transferencia desde ${sourceAccount.name} a ${targetAccount.name}`
        }, { transaction: t });

        // 2️⃣ Crear INCOME en cuenta destino (entrada de dinero)
        const income = await Income.create({
            user_id: userId,
            bank_account_id: target_account_id,
            source_account_id: source_account_id,
            category: 'internal_transfer',
            amount: amount,
            currency: targetAccount.currency,
            description: description || `Transferencia desde ${sourceAccount.name}`,
            date: date || moment().format('YYYY-MM-DD'),
            is_recurring: is_recurring,
            recurrence_type: recurrence_type,
            tags: 'transferencia_interna,automática',
            notes: notes || `Transferencia desde ${sourceAccount.name} a ${targetAccount.name}`
        }, { transaction: t });

        // 3️⃣ Vincular ambas transacciones
        await expense.update({
            linked_transaction_id: income.id
        }, { transaction: t });

        await income.update({
            linked_transaction_id: expense.id
        }, { transaction: t });

        // 4️⃣ Actualizar balances de las cuentas
        const newSourceBalance = parseFloat(sourceAccount.balance) - parseFloat(amount);
        const newTargetBalance = parseFloat(targetAccount.balance) + parseFloat(amount);

        await sourceAccount.update({
            balance: newSourceBalance.toFixed(2)
        }, { transaction: t });

        await targetAccount.update({
            balance: newTargetBalance.toFixed(2)
        }, { transaction: t });

        // Commit de la transacción
        await t.commit();

        res.status(201).json({
            success: true,
            message: `Transferencia interna realizada: ${amount} ${sourceAccount.currency} de ${sourceAccount.name} a ${targetAccount.name}`,
            data: {
                expense: expense,
                income: income,
                sourceAccount: {
                    id: sourceAccount.id,
                    name: sourceAccount.name,
                    previousBalance: sourceAccount.balance,
                    newBalance: newSourceBalance.toFixed(2)
                },
                targetAccount: {
                    id: targetAccount.id,
                    name: targetAccount.name,
                    previousBalance: targetAccount.balance,
                    newBalance: newTargetBalance.toFixed(2)
                },
                type: 'internal'
            }
        });
    } catch (error) {
        await t.rollback();
        console.error('Error creating internal transfer:', error);
        res.status(500).json({
            success: false,
            message: 'Error al realizar la transferencia interna',
            error: error.message
        });
    }
};

// ============================================
// FINANCIAL ANALYSIS - Análisis Financiero
// ============================================

export const getMonthlyBalance = async (req, res) => {
    try {
        const userId = req.user.id;
        const { month } = req.query;
        const targetMonth = month || moment().format('YYYY-MM');

        const balance = await calculateMonthlyBalance(userId, targetMonth, { Income, Expense });

        res.status(200).json({
            success: true,
            data: balance
        });
    } catch (error) {
        console.error('Error calculating monthly balance:', error);
        res.status(500).json({
            success: false,
            message: 'Error al calcular balance mensual',
            error: error.message
        });
    }
};

export const getDebtRatio = async (req, res) => {
    try {
        const userId = req.user.id;

        const debtRatio = await calculateDebtRatio(userId, { Debt, Income });

        res.status(200).json({
            success: true,
            data: debtRatio
        });
    } catch (error) {
        console.error('Error calculating debt ratio:', error);
        res.status(500).json({
            success: false,
            message: 'Error al calcular debt ratio',
            error: error.message
        });
    }
};

export const getSavingsRate = async (req, res) => {
    try {
        const userId = req.user.id;
        const { month } = req.query;
        const targetMonth = month || moment().format('YYYY-MM');

        const savingsRate = await calculateSavingsRate(userId, targetMonth, { Income, Expense });

        res.status(200).json({
            success: true,
            data: savingsRate
        });
    } catch (error) {
        console.error('Error calculating savings rate:', error);
        res.status(500).json({
            success: false,
            message: 'Error al calcular savings rate',
            error: error.message
        });
    }
};

export const getFinancialHealth = async (req, res) => {
    try {
        const userId = req.user.id;
        const { month } = req.query;
        const targetMonth = month || moment().format('YYYY-MM');

        const models = { Income, Expense, Debt, BankAccount };
        const healthStatus = await classifyFinancialHealth(userId, targetMonth, models);

        res.status(200).json({
            success: true,
            data: healthStatus
        });
    } catch (error) {
        console.error('Error classifying financial health:', error);
        res.status(500).json({
            success: false,
            message: 'Error al clasificar salud financiera',
            error: error.message
        });
    }
};

export const getFinancialDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const { month } = req.query;
        const targetMonth = month || moment().format('YYYY-MM');

        const models = { Income, Expense, Debt, BankAccount };
        const summary = await getFinancialSummary(userId, targetMonth, models);

        // 🔍 DEBUG: Log para verificar valores
        console.log('📊 FINANCIAL DASHBOARD DEBUG:');
        console.log('  Month:', targetMonth);
        console.log('  DTI:', summary.debtInfo.debtToIncomeRatio);
        console.log('  Debt Burden:', summary.debtInfo.debtBurden);
        console.log('  Monthly Income:', summary.debtInfo.monthlyIncome);
        console.log('  Total Monthly Payment:', summary.debtInfo.totalMonthlyPayment);
        console.log('  Health Status:', summary.healthStatus.status);
        console.log('  Health Score:', summary.healthStatus.healthScore);

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Error getting financial dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener dashboard financiero',
            error: error.message
        });
    }
};

export const getInternalTransfers = async (req, res) => {
    try {
        const userId = req.user.id;
        const { month } = req.query;
        const targetMonth = month || moment().format('YYYY-MM');

        const transfers = await getInternalTransfersSummary(userId, targetMonth, {
            Expense,
            Income,
            BankAccount
        });

        res.status(200).json({
            success: true,
            data: transfers
        });
    } catch (error) {
        console.error('Error getting internal transfers:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener transferencias internas',
            error: error.message
        });
    }
};

// ============================================
// ASSETS - Activos (Patrimonio)
// ============================================

export const listAssets = async (req, res) => {
    try {
        console.log('💰 [Finance] GET /assets hit');
        const userId = req.user.id;
        
        const assets = await Asset.findAll({
            where: { user_id: userId },
            include: [{
                model: BankAccount,
                as: 'bankAccount',
                attributes: ['id', 'name', 'bank_name']
            }],
            order: [['is_active', 'DESC'], ['current_value', 'DESC']]
        });
        
        console.log('  ✅ Found', assets.length, 'assets');

        res.status(200).json({
            success: true,
            data: assets
        });
    } catch (error) {
        console.error('❌ [Finance ERROR] listing assets:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener activos',
            error: error.message
        });
    }
};

export const getAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const asset = await Asset.findOne({
            where: { id, user_id: userId },
            include: [{
                model: BankAccount,
                as: 'bankAccount'
            }]
        });

        if (!asset) {
            return res.status(404).json({
                success: false,
                message: 'Activo no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: asset
        });
    } catch (error) {
        console.error('Error getting asset:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener activo',
            error: error.message
        });
    }
};

export const createAsset = async (req, res) => {
    try {
        console.log('💰 [Finance] POST /assets hit');
        const userId = req.user.id;
        const { name, type, current_value, bank_account_id, purchase_date, notes } = req.body;

        const newAsset = await Asset.create({
            user_id: userId,
            name,
            type,
            current_value,
            bank_account_id,
            purchase_date,
            notes
        });

        console.log('  ✅ Created asset:', newAsset.id);

        res.status(201).json({
            success: true,
            message: 'Activo creado exitosamente',
            data: newAsset
        });
    } catch (error) {
        console.error('❌ [Finance ERROR] creating asset:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear activo',
            error: error.message
        });
    }
};

export const updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { name, type, current_value, bank_account_id, purchase_date, notes, is_active } = req.body;

        const asset = await Asset.findOne({
            where: { id, user_id: userId }
        });

        if (!asset) {
            return res.status(404).json({
                success: false,
                message: 'Activo no encontrado'
            });
        }

        await asset.update({
            name,
            type,
            current_value,
            bank_account_id,
            purchase_date,
            notes,
            is_active
        });

        res.status(200).json({
            success: true,
            message: 'Activo actualizado exitosamente',
            data: asset
        });
    } catch (error) {
        console.error('Error updating asset:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar activo',
            error: error.message
        });
    }
};

export const deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const asset = await Asset.findOne({
            where: { id, user_id: userId }
        });

        if (!asset) {
            return res.status(404).json({
                success: false,
                message: 'Activo no encontrado'
            });
        }

        await asset.destroy();

        res.status(200).json({
            success: true,
            message: 'Activo eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error deleting asset:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar activo',
            error: error.message
        });
    }
};

// ============================================
// LIABILITIES - Pasivos (Patrimonio)
// ============================================

export const listLiabilities = async (req, res) => {
    try {
        console.log('📉 [Finance] GET /liabilities hit');
        const userId = req.user.id;
        
        const liabilities = await Liability.findAll({
            where: { user_id: userId },
            order: [['is_active', 'DESC'], ['remaining_amount', 'DESC']]
        });
        
        console.log('  ✅ Found', liabilities.length, 'liabilities');

        res.status(200).json({
            success: true,
            data: liabilities
        });
    } catch (error) {
        console.error('❌ [Finance ERROR] listing liabilities:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener pasivos',
            error: error.message
        });
    }
};

export const getLiability = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const liability = await Liability.findOne({
            where: { id, user_id: userId }
        });

        if (!liability) {
            return res.status(404).json({
                success: false,
                message: 'Pasivo no encontrado'
            });
        }

        res.status(200).json({
            success: true,
            data: liability
        });
    } catch (error) {
        console.error('Error getting liability:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener pasivo',
            error: error.message
        });
    }
};

export const createLiability = async (req, res) => {
    try {
        console.log('📉 [Finance] POST /liabilities hit');
        const userId = req.user.id;
        const { name, type, total_amount, remaining_amount, monthly_payment, interest_rate, start_date, due_date, notes } = req.body;

        const newLiability = await Liability.create({
            user_id: userId,
            name,
            type,
            total_amount,
            remaining_amount,
            monthly_payment,
            interest_rate,
            start_date,
            due_date,
            notes
        });

        console.log('  ✅ Created liability:', newLiability.id);

        res.status(201).json({
            success: true,
            message: 'Pasivo creado exitosamente',
            data: newLiability
        });
    } catch (error) {
        console.error('❌ [Finance ERROR] creating liability:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear pasivo',
            error: error.message
        });
    }
};

export const updateLiability = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { name, type, total_amount, remaining_amount, monthly_payment, interest_rate, start_date, due_date, notes, is_active } = req.body;

        const liability = await Liability.findOne({
            where: { id, user_id: userId }
        });

        if (!liability) {
            return res.status(404).json({
                success: false,
                message: 'Pasivo no encontrado'
            });
        }

        await liability.update({
            name,
            type,
            total_amount,
            remaining_amount,
            monthly_payment,
            interest_rate,
            start_date,
            due_date,
            notes,
            is_active
        });

        res.status(200).json({
            success: true,
            message: 'Pasivo actualizado exitosamente',
            data: liability
        });
    } catch (error) {
        console.error('Error updating liability:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar pasivo',
            error: error.message
        });
    }
};

export const deleteLiability = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const liability = await Liability.findOne({
            where: { id, user_id: userId }
        });

        if (!liability) {
            return res.status(404).json({
                success: false,
                message: 'Pasivo no encontrado'
            });
        }

        await liability.destroy();

        res.status(200).json({
            success: true,
            message: 'Pasivo eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error deleting liability:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar pasivo',
            error: error.message
        });
    }
};

// ============================================
// NET WORTH - Patrimonio Neto
// ============================================

export const getNetWorth = async (req, res) => {
    try {
        console.log('💎 [Finance] GET /net-worth hit');
        const userId = req.user.id;
        
        // Obtener todos los activos activos
        const assets = await Asset.findAll({
            where: { 
                user_id: userId,
                is_active: true 
            }
        });

        // Obtener todos los balances de cuentas bancarias (activos tipo cash)
        const bankAccounts = await BankAccount.findAll({
            where: { 
                user_id: userId,
                is_active: true 
            },
            attributes: ['id', 'name', 'balance']
        });

        // Obtener todos los pasivos activos
        const liabilities = await Liability.findAll({
            where: { 
                user_id: userId,
                is_active: true 
            }
        });

        // Calcular total de activos (assets explícitos)
        const totalExplicitAssets = assets.reduce((sum, asset) => {
            return sum + parseFloat(asset.current_value || 0);
        }, 0);

        // Calcular total de cuentas bancarias (activos cash implícitos)
        const totalBankBalance = bankAccounts.reduce((sum, account) => {
            return sum + parseFloat(account.balance || 0);
        }, 0);

        // Total activos = explícitos + saldos bancarios
        const totalAssets = totalExplicitAssets + totalBankBalance;

        // Calcular total de pasivos
        const totalLiabilities = liabilities.reduce((sum, liability) => {
            return sum + parseFloat(liability.remaining_amount || 0);
        }, 0);

        // Calcular patrimonio neto
        const netWorth = totalAssets - totalLiabilities;

        // Desglose por tipo de activo
        const assetsByType = assets.reduce((acc, asset) => {
            const type = asset.type || 'other';
            if (!acc[type]) acc[type] = 0;
            acc[type] += parseFloat(asset.current_value || 0);
            return acc;
        }, {});

        // Agregar cuentas bancarias como tipo 'cash'
        assetsByType.cash = (assetsByType.cash || 0) + totalBankBalance;

        // Desglose por tipo de pasivo
        const liabilitiesByType = liabilities.reduce((acc, liability) => {
            const type = liability.type || 'other';
            if (!acc[type]) acc[type] = 0;
            acc[type] += parseFloat(liability.remaining_amount || 0);
            return acc;
        }, {});

        console.log('  ✅ Net Worth calculated:', netWorth);
        console.log('     Total Assets:', totalAssets);
        console.log('     Total Liabilities:', totalLiabilities);

        res.status(200).json({
            success: true,
            data: {
                netWorth: parseFloat(netWorth.toFixed(2)),
                totalAssets: parseFloat(totalAssets.toFixed(2)),
                totalLiabilities: parseFloat(totalLiabilities.toFixed(2)),
                breakdown: {
                    assets: {
                        explicit: parseFloat(totalExplicitAssets.toFixed(2)),
                        bankAccounts: parseFloat(totalBankBalance.toFixed(2)),
                        byType: assetsByType
                    },
                    liabilities: {
                        byType: liabilitiesByType
                    }
                },
                counts: {
                    assets: assets.length,
                    bankAccounts: bankAccounts.length,
                    liabilities: liabilities.length
                }
            }
        });
    } catch (error) {
        console.error('❌ [Finance ERROR] calculating net worth:', error);
        res.status(500).json({
            success: false,
            message: 'Error al calcular patrimonio neto',
            error: error.message
        });
    }
};

export default {
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
};
