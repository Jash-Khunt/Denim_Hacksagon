import {pool} from "../lib/db.js";

// Employee: own payroll history (include salary from profile_info)
export const getMyPayroll = async (req, res) => {
  const empId  = req.user.emp_id;
  try {
    const result = await pool.query(
      `SELECT p.*, pi.salary
       FROM payroll p
       LEFT JOIN profile_info pi ON p.emp_id = pi.emp_id
       WHERE p.emp_id = $1 
       ORDER BY p.paid_date DESC`,
      [empId]
    );
    
    // Also get current salary info
    const salaryResult = await pool.query(
      `SELECT salary FROM profile_info WHERE emp_id = $1`,
      [empId]
    );
    
    res.json({ 
      payroll: result.rows,
      currentSalary: salaryResult.rows[0]?.salary || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
};

// Admin: all payroll with salary info
export const getAllPayroll = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, e.name AS emp_name, pi.department, pi.salary
       FROM payroll p
       JOIN employee e ON p.emp_id = e.emp_id
       LEFT JOIN profile_info pi ON e.emp_id = pi.emp_id
       ORDER BY p.paid_date DESC`
    );
    res.json({ payroll: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payroll" });
  }
};

// Get employee payroll summary (all employees with salary + payment status)
export const getPayrollSummary = async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    const result = await pool.query(
      `SELECT 
        e.emp_id, 
        e.name, 
        e.email,
        pi.department,
        COALESCE(pi.salary, 0) AS annual_salary,
        COALESCE(pi.salary / 12, 0) AS monthly_salary,
        p.paid_status AS current_month_status,
        p.paid_date
       FROM employee e
       LEFT JOIN profile_info pi ON e.emp_id = pi.emp_id
       LEFT JOIN payroll p ON e.emp_id = p.emp_id 
         AND EXTRACT(MONTH FROM p.paid_date) = $1 
         AND EXTRACT(YEAR FROM p.paid_date) = $2
       WHERE e.hr_id = $3
       ORDER BY e.name ASC`,
      [currentMonth, currentYear, req.user.hr_id]
    );
    
    const totalMonthly = result.rows.reduce((sum, r) => sum + parseFloat(r.monthly_salary || 0), 0);
    const paidCount = result.rows.filter(r => r.current_month_status === 'Paid').length;
    const pendingCount = result.rows.filter(r => r.current_month_status !== 'Paid').length;
    
    res.json({ 
      employees: result.rows,
      summary: {
        totalEmployees: result.rows.length,
        totalMonthlyPayroll: Math.round(totalMonthly),
        paidThisMonth: paidCount,
        pendingThisMonth: pendingCount,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payroll summary" });
  }
};

// Update employee salary (admin)
export const updateSalary = async (req, res) => {
  const { id } = req.params; // employee ID
  const { salary } = req.body;

  try {
    await pool.query(
      `UPDATE profile_info SET salary=$1 WHERE emp_id=$2`,
      [salary, id]
    );
    res.json({ message: "Salary updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update salary" });
  }
};

// Process payroll (admin) - mark all employees as paid for the given month
export const processPayroll = async (req, res) => {
  const { month, year } = req.body;

  try {
    // Fetch all employees under this HR
    const employees = await pool.query(
      `SELECT e.emp_id FROM employee e WHERE e.hr_id = $1`,
      [req.user.hr_id]
    );

    let processed = 0;
    for (const emp of employees.rows) {
      // Check if already paid
      const check = await pool.query(
        `SELECT * FROM payroll WHERE emp_id=$1 AND EXTRACT(MONTH FROM paid_date)=$2 AND EXTRACT(YEAR FROM paid_date)=$3`,
        [emp.emp_id, month, year]
      );

      if (check.rows.length === 0) {
        await pool.query(
          `INSERT INTO payroll(emp_id, paid_date, paid_status) VALUES($1, $2, 'Paid')`,
          [emp.emp_id, `${year}-${String(month).padStart(2, '0')}-28`]
        );
        processed++;
      }
    }

    res.json({ message: `Payroll processed for ${processed} employees` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process payroll" });
  }
};

// Pay individual employee manually with custom amount
export const payIndividual = async (req, res) => {
  const { empId, amount, month, year, note } = req.body;

  try {
    const paidDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    
    // Check if already paid this month
    const check = await pool.query(
      `SELECT * FROM payroll WHERE emp_id=$1 AND EXTRACT(MONTH FROM paid_date)=$2 AND EXTRACT(YEAR FROM paid_date)=$3`,
      [empId, month, year]
    );

    if (check.rows.length > 0) {
      // Update existing record
      await pool.query(
        `UPDATE payroll SET paid_status='Paid', paid_date=$1 WHERE emp_id=$2 AND EXTRACT(MONTH FROM paid_date)=$3 AND EXTRACT(YEAR FROM paid_date)=$4`,
        [paidDate, empId, month, year]
      );
    } else {
      // Insert new record
      await pool.query(
        `INSERT INTO payroll(emp_id, paid_date, paid_status) VALUES($1, $2, 'Paid')`,
        [empId, paidDate]
      );
    }

    res.json({ message: `Payment of ₹${amount} processed for employee` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process individual payment" });
  }
};
