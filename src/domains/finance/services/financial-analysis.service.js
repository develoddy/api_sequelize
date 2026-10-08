/**
 * SERVICIO DE ANÁLISIS FINANCIERO
 * 
 * Este servicio proporciona funciones para analizar la salud financiera
 * de un usuario basándose en sus ingresos, gastos, deudas y cuentas bancarias.
 * 
 * Métricas calculadas:
 * - Balance mensual (ingresos - gastos)
 * - Debt ratio (deudas totales / ingresos mensuales)
 * - Savings rate (ahorros / ingresos totales)
 * - Estado financiero (verde/amarillo/rojo)
 */

import { Op } from 'sequelize';
import moment from 'moment';

/**
 * Calcula el balance mensual de un usuario
 * @param {number} userId - ID del usuario
 * @param {string} month - Mes en formato YYYY-MM
 * @param {Object} models - Objetos de modelos Sequelize
 * @returns {Object} Balance mensual con detalles
 */
export async function calculateMonthlyBalance(userId, month, { Income, Expense }) {
    const startDate = moment(month, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
    const endDate = moment(month, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');

    // Obtener ingresos del mes (EXCLUYENDO transferencias internas)
    const incomes = await Income.findAll({
        where: {
            user_id: userId,
            category: { [Op.ne]: 'internal_transfer' }, // Excluir transferencias internas
            date: {
                [Op.between]: [startDate, endDate]
            }
        }
    });

    // Obtener gastos del mes (EXCLUYENDO transferencias internas)
    const expenses = await Expense.findAll({
        where: {
            user_id: userId,
            category: { [Op.ne]: 'internal_transfer' }, // Excluir transferencias internas
            date: {
                [Op.between]: [startDate, endDate]
            }
        }
    });

    // Calcular totales
    const totalIncome = incomes.reduce((sum, income) => 
        sum + parseFloat(income.amount), 0
    );

    const totalExpenses = expenses.reduce((sum, expense) => 
        sum + parseFloat(expense.amount), 0
    );

    const balance = totalIncome - totalExpenses;

    // Calcular por categorías
    const incomeByCategory = {};
    incomes.forEach(income => {
        incomeByCategory[income.category] = 
            (incomeByCategory[income.category] || 0) + parseFloat(income.amount);
    });

    const expensesByCategory = {};
    expenses.forEach(expense => {
        expensesByCategory[expense.category] = 
            (expensesByCategory[expense.category] || 0) + parseFloat(expense.amount);
    });

    // Separar gastos esenciales vs no esenciales
    const essentialExpenses = expenses
        .filter(e => e.is_essential)
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    const nonEssentialExpenses = expenses
        .filter(e => !e.is_essential)
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    return {
        month,
        totalIncome: parseFloat(totalIncome.toFixed(2)),
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        balance: parseFloat(balance.toFixed(2)),
        incomeByCategory,
        expensesByCategory,
        essentialExpenses: parseFloat(essentialExpenses.toFixed(2)),
        nonEssentialExpenses: parseFloat(nonEssentialExpenses.toFixed(2)),
        transactionCount: {
            incomes: incomes.length,
            expenses: expenses.length
        },
        note: 'Transferencias internas excluidas de cálculos'
    };
}

/**
 * Calcula el debt ratio (ratio de deuda)
 * 
 * ⚠️ IMPORTANTE: El DTI (Debt-to-Income Ratio) es el % de ingreso que va a pagos de deuda.
 * 
 * Formula DTI: (Pagos Mensuales de Deuda / Ingreso Mensual) × 100
 * 
 * Clasificación estándar:
 * - < 20%: Excelente
 * - 20-35%: Saludable
 * - 36-43%: Zona de riesgo
 * - > 43%: Alto riesgo
 * 
 * También calcula el "debt burden" (cuántos MESES tardas en pagar la deuda)
 * Formula: Total de deudas restantes / Pagos mensuales totales
 * 
 * @param {number} userId - ID del usuario
 * @param {string} month - Mes actual para calcular ingresos (formato YYYY-MM)
 * @param {Object} models - Objetos de modelos Sequelize
 * @returns {Object} Debt ratio con detalles
 */
export async function calculateDebtRatio(userId, month, { Debt, Income }) {
    const currentMonth = month || moment().format('YYYY-MM');
    
    // Obtener todas las deudas activas
    const debts = await Debt.findAll({
        where: {
            user_id: userId,
            status: 'active'
        }
    });

    const totalDebt = debts.reduce((sum, debt) => 
        sum + parseFloat(debt.remaining_balance), 0
    );

    const totalMonthlyPayment = debts.reduce((sum, debt) => 
        sum + parseFloat(debt.monthly_payment || 0), 0
    );

    // 🔧 CORRECCIÓN: Calcular ingresos del mes actual (EXCLUYENDO transferencias internas)
    const startDate = moment(currentMonth, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
    const endDate = moment(currentMonth, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');

    const incomes = await Income.findAll({
        where: {
            user_id: userId,
            category: { [Op.ne]: 'internal_transfer' }, // Excluir transferencias internas
            date: {
                [Op.between]: [startDate, endDate]
            }
        }
    });

    const monthlyIncome = incomes.reduce((sum, income) => 
        sum + parseFloat(income.amount), 0
    );

    // Calcular DTI (Debt-to-Income Ratio) - MÉTRICA PRINCIPAL
    // Este es el porcentaje de ingreso mensual que va a pagos de deuda
    const debtToIncomeRatio = monthlyIncome > 0 
        ? (totalMonthlyPayment / monthlyIncome) * 100 
        : 0;

    // 🔧 CORRECCIÓN: Debt Burden = Tiempo en MESES para pagar la deuda
    // Formula: Deuda total / Pago mensual = Meses restantes
    const debtBurden = totalMonthlyPayment > 0 
        ? (totalDebt / totalMonthlyPayment) 
        : 0;

    // Calcular deuda por tipo
    const debtByType = {};
    debts.forEach(debt => {
        debtByType[debt.debt_type] = 
            (debtByType[debt.debt_type] || 0) + parseFloat(debt.remaining_balance);
    });

    return {
        totalDebt: parseFloat(totalDebt.toFixed(2)),
        totalMonthlyPayment: parseFloat(totalMonthlyPayment.toFixed(2)),
        monthlyIncome: parseFloat(monthlyIncome.toFixed(2)),
        debtToIncomeRatio: parseFloat(debtToIncomeRatio.toFixed(2)), // % (ej: 5.77%)
        debtBurden: parseFloat(debtBurden.toFixed(2)), // Meses para pagar (ej: 8.33)
        debtByType,
        activeDebtsCount: debts.length
    };
}

/**
 * Calcula la tasa de ahorro (savings rate)
 * Formula: (Ingresos - Gastos) / Ingresos * 100
 * 
 * @param {number} userId - ID del usuario
 * @param {string} month - Mes en formato YYYY-MM
 * @param {Object} models - Objetos de modelos Sequelize
 * @returns {Object} Savings rate con detalles
 */
export async function calculateSavingsRate(userId, month, { Income, Expense }) {
    const balance = await calculateMonthlyBalance(userId, month, { Income, Expense });

    if (balance.totalIncome === 0) {
        return {
            month,
            savingsRate: 0,
            totalSavings: 0,
            totalIncome: 0,
            totalExpenses: 0,
            message: 'No hay ingresos registrados para este mes'
        };
    }

    const savingsRate = (balance.balance / balance.totalIncome) * 100;

    return {
        month,
        savingsRate: parseFloat(savingsRate.toFixed(2)),
        totalSavings: balance.balance,
        totalIncome: balance.totalIncome,
        totalExpenses: balance.totalExpenses
    };
}

/**
 * Clasifica la salud financiera según reglas definidas
 * 
 * REGLAS ACTUALIZADAS (basadas en estándares financieros):
 * 
 * - VERDE (Saludable):
 *   * Savings rate >= 20%
 *   * DTI (Debt-to-Income Ratio) < 20% ✅ CORREGIDO
 *   * Debt burden < 12 meses
 * 
 * - AMARILLO (Precaución):
 *   * Savings rate entre 10-20%
 *   * DTI entre 20-36% ✅ CORREGIDO
 *   * Debt burden entre 12-24 meses
 * 
 * - ROJO (Riesgo):
 *   * Savings rate < 10%
 *   * DTI > 36% (considerado riesgoso por bancos) ✅ CORREGIDO
 *   * Debt burden > 24 meses
 * 
 * @param {number} userId - ID del usuario
 * @param {string} month - Mes en formato YYYY-MM (default: mes actual)
 * @param {Object} models - Objetos de modelos Sequelize
 * @returns {Object} Estado financiero con clasificación y recomendaciones
 */
export async function classifyFinancialHealth(userId, month, models) {
    const currentMonth = month || moment().format('YYYY-MM');
    
    // Obtener todas las métricas
    const savingsData = await calculateSavingsRate(userId, currentMonth, models);
    const debtData = await calculateDebtRatio(userId, currentMonth, models);
    const monthlyBalance = await calculateMonthlyBalance(userId, currentMonth, models);

    const { savingsRate } = savingsData;
    const { debtToIncomeRatio, debtBurden } = debtData; // Ahora debtToIncomeRatio es % correcto

    // Sistema de puntuación
    let healthScore = 100;
    const issues = [];
    const recommendations = [];

    // Evaluar savings rate
    if (savingsRate < 10) {
        healthScore -= 30;
        issues.push('Tasa de ahorro muy baja');
        recommendations.push('Intenta reducir gastos no esenciales para aumentar tu tasa de ahorro al menos al 15%');
    } else if (savingsRate < 20) {
        healthScore -= 15;
        issues.push('Tasa de ahorro podría mejorar');
        recommendations.push('Establece un objetivo de ahorro del 20% de tus ingresos');
    }

    // Evaluar DTI (Debt-to-Income Ratio) - AHORA CORRECTO EN %
    if (debtToIncomeRatio > 36) {
        healthScore -= 35;
        issues.push('Ratio de deuda muy alto (DTI > 36%)');
        recommendations.push(`Tu DTI es ${debtToIncomeRatio.toFixed(1)}%. Los bancos consideran riesgoso más del 36%. Considera refinanciar o consolidar deudas`);
    } else if (debtToIncomeRatio > 20) {
        healthScore -= 20;
        issues.push('Ratio de deuda elevado (DTI entre 20-36%)');
        recommendations.push(`Tu DTI es ${debtToIncomeRatio.toFixed(1)}%. Intenta reducir tus pagos mensuales de deuda por debajo del 20%`);
    }

    // Evaluar debt burden (meses para pagar toda la deuda con pagos actuales)
    if (debtBurden > 60) {
        healthScore -= 20;
        issues.push('Plazo de deuda muy largo (más de 5 años)');
        recommendations.push(`Tardarás ${debtBurden.toFixed(0)} meses en pagar tu deuda. Aumenta tus pagos mensuales si es posible`);
    } else if (debtBurden > 24) {
        healthScore -= 10;
        issues.push('Plazo de deuda considerable (más de 2 años)');
        recommendations.push(`Tardarás ${debtBurden.toFixed(0)} meses en pagar tu deuda. Considera aumentar tus pagos mensuales`);
    }

    // Evaluar balance mensual
    if (monthlyBalance.balance < 0) {
        healthScore -= 20;
        issues.push('Balance mensual negativo');
        recommendations.push('Estás gastando más de lo que ganas. Revisa y recorta gastos no esenciales urgentemente');
    }

    // Determinar clasificación de salud
    let status;
    let statusColor;
    let statusDescription;

    if (healthScore >= 80) {
        status = 'VERDE';
        statusColor = 'success';
        statusDescription = 'Tu salud financiera es excelente. Mantén estos buenos hábitos.';
    } else if (healthScore >= 60) {
        status = 'AMARILLO';
        statusColor = 'warning';
        statusDescription = 'Tu salud financiera necesita atención. Sigue las recomendaciones para mejorar.';
    } else {
        status = 'ROJO';
        statusColor = 'danger';
        statusDescription = 'Tu situación financiera requiere acción inmediata. Considera buscar asesoría profesional.';
    }

    return {
        status,
        statusColor,
        statusDescription,
        healthScore,
        metrics: {
            savingsRate: savingsData.savingsRate,
            debtToIncomeRatio: debtData.debtToIncomeRatio, // Ahora es % (10%, 35%, etc)
            debtBurden: debtData.debtBurden, // Meses de ingreso (2.43, 5.5, etc)
            monthlyBalance: monthlyBalance.balance
        },
        issues,
        recommendations,
        evaluatedMonth: currentMonth,
        evaluatedAt: moment().format('YYYY-MM-DD HH:mm:ss')
    };
}

/**
 * Calcula métricas financieras por cuenta bancaria
 * 
 * @param {number} userId - ID del usuario
 * @param {string} month - Mes en formato YYYY-MM
 * @param {Object} models - Objetos de modelos Sequelize
 * @returns {Array} Array de cuentas con sus métricas
 */
export async function calculateBankAccountMetrics(userId, month, { BankAccount, Income, Expense, Debt }) {
    const startDate = moment(month, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
    const endDate = moment(month, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');

    // Obtener todas las cuentas bancarias activas
    const accounts = await BankAccount.findAll({
        where: { 
            user_id: userId,
            is_active: true 
        },
        order: [['name', 'ASC']]
    });

    // Calcular métricas para cada cuenta
    const accountMetrics = await Promise.all(accounts.map(async (account) => {
        // Ingresos del mes para esta cuenta (EXCLUYENDO transferencias internas)
        const incomes = await Income.findAll({
            where: {
                user_id: userId,
                bank_account_id: account.id,
                category: { [Op.ne]: 'internal_transfer' },
                date: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });

        const totalIncome = incomes.reduce((sum, income) => 
            sum + parseFloat(income.amount), 0
        );

        // Gastos del mes para esta cuenta (EXCLUYENDO transferencias internas)
        const expenses = await Expense.findAll({
            where: {
                user_id: userId,
                bank_account_id: account.id,
                category: { [Op.ne]: 'internal_transfer' },
                date: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });

        const totalExpenses = expenses.reduce((sum, expense) => 
            sum + parseFloat(expense.amount), 0
        );

        // Gastos por categoría
        const expensesByCategory = {};
        expenses.forEach(expense => {
            const cat = expense.category;
            if (!expensesByCategory[cat]) {
                expensesByCategory[cat] = {
                    total: 0,
                    count: 0,
                    essential: 0,
                    nonEssential: 0
                };
            }
            expensesByCategory[cat].total += parseFloat(expense.amount);
            expensesByCategory[cat].count += 1;
            
            if (expense.is_essential) {
                expensesByCategory[cat].essential += parseFloat(expense.amount);
            } else {
                expensesByCategory[cat].nonEssential += parseFloat(expense.amount);
            }
        });

        // Ingresos por categoría
        const incomeByCategory = {};
        incomes.forEach(income => {
            incomeByCategory[income.category] = 
                (incomeByCategory[income.category] || 0) + parseFloat(income.amount);
        });

        // Gastos esenciales vs no esenciales
        const essentialExpenses = expenses
            .filter(e => e.is_essential)
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);
        
        const nonEssentialExpenses = expenses
            .filter(e => !e.is_essential)
            .reduce((sum, e) => sum + parseFloat(e.amount), 0);

        // Pagos de deuda mensuales para esta cuenta
        const debts = await Debt.findAll({
            where: {
                user_id: userId,
                bank_account_id: account.id,
                status: 'active'
            }
        });

        const totalDebtPayments = debts.reduce((sum, debt) => 
            sum + parseFloat(debt.monthly_payment), 0
        );

        // Balance del mes para esta cuenta (ingresos - gastos - pagos de deuda)
        const monthlyBalance = totalIncome - totalExpenses - totalDebtPayments;
        
        // Transferencias internas: salidas (expenses) y entradas (incomes)
        const internalTransfersOut = await Expense.findAll({
            where: {
                user_id: userId,
                bank_account_id: account.id,
                category: 'internal_transfer',
                date: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });

        const internalTransfersIn = await Income.findAll({
            where: {
                user_id: userId,
                bank_account_id: account.id,
                category: 'internal_transfer',
                date: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });

        const totalTransferredOut = internalTransfersOut.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalTransferredIn = internalTransfersIn.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        
        return {
            accountId: account.id,
            accountName: account.name,
            bankName: account.bank_name,
            accountType: account.account_type,
            currency: account.currency,
            currentBalance: parseFloat(account.balance),
            monthlyMetrics: {
                totalIncome: parseFloat(totalIncome.toFixed(2)),
                totalExpenses: parseFloat(totalExpenses.toFixed(2)),
                totalDebtPayments: parseFloat(totalDebtPayments.toFixed(2)),
                monthlyBalance: parseFloat(monthlyBalance.toFixed(2)),
                essentialExpenses: parseFloat(essentialExpenses.toFixed(2)),
                nonEssentialExpenses: parseFloat(nonEssentialExpenses.toFixed(2)),
                incomeCount: incomes.length,
                expenseCount: expenses.length,
                debtCount: debts.length,
                // Transferencias internas (impacto neto = 0)
                transferredOut: parseFloat(totalTransferredOut.toFixed(2)),
                transferredIn: parseFloat(totalTransferredIn.toFixed(2)),
                transfersCount: internalTransfersOut.length + internalTransfersIn.length
            },
            incomeByCategory,
            expensesByCategory,
            debtsByType: debts.reduce((acc, debt) => {
                acc[debt.debt_type] = (acc[debt.debt_type] || 0) + parseFloat(debt.monthly_payment);
                return acc;
            }, {})
        };
    }));

    return accountMetrics;
}

/**
 * Obtiene un resumen financiero completo del usuario
 * 
 * @param {number} userId - ID del usuario
 * @param {string} month - Mes en formato YYYY-MM (default: mes actual)
 * @param {Object} models - Objetos de modelos Sequelize
 * @returns {Object} Resumen financiero completo
 */
export async function getFinancialSummary(userId, month, models) {
    const currentMonth = month || moment().format('YYYY-MM');
    
    const [monthlyBalance, debtInfo, savingsInfo, healthStatus, bankAccounts, accountMetrics] = await Promise.all([
        calculateMonthlyBalance(userId, currentMonth, models),
        calculateDebtRatio(userId, currentMonth, models),
        calculateSavingsRate(userId, currentMonth, models),
        classifyFinancialHealth(userId, currentMonth, models),
        models.BankAccount.findAll({
            where: { user_id: userId, is_active: true }
        }),
        calculateBankAccountMetrics(userId, currentMonth, models)
    ]);

    const totalBankBalance = bankAccounts.reduce((sum, account) => 
        sum + parseFloat(account.balance), 0
    );

    return {
        summary: {
            month: currentMonth,
            totalBankBalance: parseFloat(totalBankBalance.toFixed(2)),
            monthlyBalance: monthlyBalance.balance,
            totalIncome: monthlyBalance.totalIncome,
            totalExpenses: monthlyBalance.totalExpenses,
            totalDebt: debtInfo.totalDebt,
            savingsRate: savingsInfo.savingsRate
        },
        monthlyBalance,
        debtInfo,
        savingsInfo,
        healthStatus,
        bankAccounts: bankAccounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            bank_name: acc.bank_name,
            account_type: acc.account_type,
            balance: parseFloat(acc.balance),
            currency: acc.currency
        })),
        accountMetrics // Nueva sección con métricas detalladas por cuenta
    };
}

/**
 * Obtiene resumen de transferencias internas del mes
 * 
 * @param {number} userId - ID del usuario
 * @param {string} month - Mes en formato YYYY-MM (default: mes actual)
 * @param {Object} models - Objetos de modelos Sequelize
 * @returns {Object} Resumen de transferencias internas
 */
export async function getInternalTransfersSummary(userId, month, models) {
    const currentMonth = month || moment().format('YYYY-MM');
    const startDate = moment(currentMonth, 'YYYY-MM').startOf('month').format('YYYY-MM-DD');
    const endDate = moment(currentMonth, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');

    // Obtener todas las transferencias salientes (expenses)
    const transfersOut = await models.Expense.findAll({
        where: {
            user_id: userId,
            category: 'internal_transfer',
            date: {
                [Op.between]: [startDate, endDate]
            }
        },
        include: [
            {
                model: models.BankAccount,
                as: 'bankAccount',
                attributes: ['id', 'name', 'bank_name', 'account_type']
            },
            {
                model: models.BankAccount,
                as: 'targetAccount',
                attributes: ['id', 'name', 'bank_name', 'account_type']
            }
        ],
        order: [['date', 'DESC']]
    });

    const totalTransferred = transfersOut.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Agrupar por ruta (origen → destino)
    const transferRoutes = {};
    transfersOut.forEach(transfer => {
        const sourceName = transfer.bankAccount?.name || 'Cuenta desconocida';
        const targetName = transfer.targetAccount?.name || 'Cuenta desconocida';
        const route = `${sourceName} → ${targetName}`;
        
        if (!transferRoutes[route]) {
            transferRoutes[route] = {
                sourceAccount: transfer.bankAccount,
                targetAccount: transfer.targetAccount,
                totalAmount: 0,
                count: 0,
                transfers: []
            };
        }
        
        transferRoutes[route].totalAmount += parseFloat(transfer.amount);
        transferRoutes[route].count += 1;
        transferRoutes[route].transfers.push({
            id: transfer.id,
            amount: parseFloat(transfer.amount),
            date: transfer.date,
            description: transfer.description,
            currency: transfer.currency
        });
    });

    return {
        month: currentMonth,
        totalTransferred: parseFloat(totalTransferred.toFixed(2)),
        transferCount: transfersOut.length,
        transferRoutes,
        transfers: transfersOut.map(t => ({
            id: t.id,
            amount: parseFloat(t.amount),
            date: t.date,
            description: t.description,
            currency: t.currency,
            sourceAccount: t.bankAccount,
            targetAccount: t.targetAccount,
            linkedTransactionId: t.linked_transaction_id
        }))
    };
}

export default {
    calculateMonthlyBalance,
    calculateDebtRatio,
    calculateSavingsRate,
    classifyFinancialHealth,
    getFinancialSummary,
    calculateBankAccountMetrics,
    getInternalTransfersSummary
};
