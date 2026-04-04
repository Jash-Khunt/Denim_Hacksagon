import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePayroll } from '@/contexts/PayrollContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  Search,
  Edit,
  Loader2,
  Users,
  CheckCircle,
  Clock,
  IndianRupee,
  Wallet,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { payrollAPI } from '@/services/api';

const months = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const Payroll = () => {
  const { user } = useAuth();
  const {
    myPayroll,
    payrollSummary,
    currentSalary,
    isLoading,
    fetchMyPayroll,
    fetchPayrollSummary,
    updateSalary,
    processPayroll
  } = usePayroll();

  const isHr = user?.role === 'hr';

  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [editedSalary, setEditedSalary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));

  // Pay individual state
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payMonth, setPayMonth] = useState(String(new Date().getMonth() + 1));
  const [payYear, setPayYear] = useState(String(new Date().getFullYear()));
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (isHr) {
      fetchPayrollSummary();
    } else {
      fetchMyPayroll();
    }
  }, [isHr]);

  const handleEditClick = (employee: any) => {
    setSelectedEmployee(employee);
    setEditedSalary((employee.annual_salary || 0).toString());
    setEditDialogOpen(true);
  };

  const handleSaveSalary = async () => {
    if (!selectedEmployee) return;

    const newSalary = parseInt(editedSalary);
    if (isNaN(newSalary) || newSalary <= 0) {
      toast.error('Please enter a valid salary amount');
      return;
    }

    setIsSaving(true);
    const success = await updateSalary(selectedEmployee.emp_id, newSalary);
    setIsSaving(false);

    if (success) {
      setEditDialogOpen(false);
      setSelectedEmployee(null);
      setEditedSalary('');
      fetchPayrollSummary();
    }
  };

  const handleProcessPayroll = async () => {
    const success = await processPayroll({
      month: selectedMonth,
      year: parseInt(selectedYear)
    });
    if (success) {
      setProcessDialogOpen(false);
    }
  };

  const handlePayClick = (employee: any) => {
    setPayTarget(employee);
    setPayAmount(Math.round(parseFloat(employee.monthly_salary || 0)).toString());
    setPayMonth(String(new Date().getMonth() + 1));
    setPayYear(String(new Date().getFullYear()));
    setPayNote('');
    setPayDialogOpen(true);
  };

  const handlePayIndividual = async () => {
    if (!payTarget || !payAmount) return;
    const amount = parseInt(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setIsPaying(true);
    try {
      await payrollAPI.payIndividual({
        empId: payTarget.emp_id,
        amount,
        month: parseInt(payMonth),
        year: parseInt(payYear),
        note: payNote || undefined,
      });
      toast.success(`₹${amount.toLocaleString('en-IN')} paid to ${payTarget.name}`);
      setPayDialogOpen(false);
      setPayTarget(null);
      fetchPayrollSummary();
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  };

  const summary = payrollSummary?.summary || {};
  const summaryEmployees = payrollSummary?.employees || [];

  const filteredEmployees = summaryEmployees.filter((emp: any) =>
    (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ========================
  // HR VIEW
  // ========================
  if (isHr) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalEmployees || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <IndianRupee className="w-6 h-6 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₹{(summary.totalMonthlyPayroll || 0).toLocaleString('en-IN')}</p>
                  <p className="text-sm text-muted-foreground">Monthly Payroll</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.paidThisMonth || 0}</p>
                  <p className="text-sm text-muted-foreground">Paid This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.pendingThisMonth || 0}</p>
                  <p className="text-sm text-muted-foreground">Pending This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employee Payroll Table */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setProcessDialogOpen(true)} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
              Process Payroll
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No employees found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Annual Salary</th>
                      <th>Monthly Salary</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee: any) => (
                      <tr key={employee.emp_id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {(employee.name || 'U').split(' ').map((n: string) => n[0]).join('')}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">{employee.name}</span>
                              <p className="text-xs text-muted-foreground">{employee.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>{employee.department || 'N/A'}</td>
                        <td className="font-medium">
                          ₹{parseFloat(employee.annual_salary || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="font-medium">
                          ₹{Math.round(parseFloat(employee.monthly_salary || 0)).toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span className={`status-badge ${employee.current_month_status === 'Paid'
                              ? 'status-approved'
                              : 'status-pending'
                            }`}>
                            {employee.current_month_status === 'Paid' ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {employee.current_month_status !== 'Paid' && (
                              <Button variant="default" size="sm" className="bg-success hover:bg-success/90" onClick={(e) => { e.stopPropagation(); handlePayClick(employee); }}>
                                <CreditCard className="w-3.5 h-3.5 mr-1" />Pay
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditClick(employee); }}>
                              <Edit className="w-3.5 h-3.5 mr-1" />Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Salary Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Employee Salary</DialogTitle>
              <DialogDescription>
                Update the annual salary for {selectedEmployee?.name}
              </DialogDescription>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="font-medium">{selectedEmployee.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedEmployee.department || 'No department'}</p>
                  <p className="text-sm text-muted-foreground">
                    Current: ₹{parseFloat(selectedEmployee.annual_salary || 0).toLocaleString('en-IN')}/year
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary">New Annual Salary (₹)</Label>
                  <Input
                    id="salary"
                    type="number"
                    value={editedSalary}
                    onChange={(e) => setEditedSalary(e.target.value)}
                    placeholder="Enter annual salary"
                  />
                  <p className="text-sm text-muted-foreground">
                    Monthly: ₹{editedSalary ? Math.round(parseInt(editedSalary) / 12).toLocaleString('en-IN') : '0'}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSalary} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Process Payroll Dialog */}
        <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Process Payroll</DialogTitle>
              <DialogDescription>
                Mark all employees as paid for the selected month
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  This will mark <strong>{summary.pendingThisMonth || 0} pending employees</strong> as paid for{' '}
                  {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProcessDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleProcessPayroll} disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Process Payroll
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pay Individual Dialog */}
        <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pay Employee</DialogTitle>
              <DialogDescription>
                Manual payment for {payTarget?.name}
              </DialogDescription>
            </DialogHeader>
            {payTarget && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="font-medium">{payTarget.name}</p>
                  <p className="text-sm text-muted-foreground">{payTarget.department || 'No department'}</p>
                  <p className="text-sm text-muted-foreground">
                    Monthly: ₹{Math.round(parseFloat(payTarget.monthly_salary || 0)).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Payment Amount (₹)</Label>
                  <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Enter amount" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select value={payMonth} onValueChange={setPayMonth}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {months.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Input type="number" value={payYear} onChange={e => setPayYear(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="E.g. bonus, advance..." />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
              <Button onClick={handlePayIndividual} disabled={isPaying} className="bg-success hover:bg-success/90">
                {isPaying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ========================
  // EMPLOYEE VIEW
  // ========================
  const annualSalary = currentSalary || (user as any)?.salary || 0;
  const monthlySalary = Math.round(annualSalary / 12);
  const basic = monthlySalary * 0.5;
  const hra = basic * 0.5;
  const pfDeduction = basic * 0.12;
  const profTax = 200;
  const totalDeductions = pfDeduction + profTax;
  const netPay = monthlySalary - totalDeductions;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Salary Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 rounded-xl bg-primary/10">
                <IndianRupee className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Annual Salary (CTC)</p>
                <p className="text-2xl font-bold">₹{annualSalary.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 rounded-xl bg-info/10">
                <DollarSign className="w-6 h-6 text-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Gross</p>
                <p className="text-2xl font-bold">₹{monthlySalary.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 rounded-xl bg-success/10">
                <Wallet className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net In-Hand</p>
                <p className="text-2xl font-bold text-success">₹{Math.round(netPay).toLocaleString('en-IN')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salary Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Earnings</CardTitle>
            <CardDescription>Monthly salary components</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span>Basic Salary (50%)</span>
              <span className="font-mono">₹{Math.round(basic).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>HRA (50% of Basic)</span>
              <span className="font-mono">₹{Math.round(hra).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>Other Allowances</span>
              <span className="font-mono">₹{Math.round(monthlySalary - basic - hra).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-2 font-bold">
              <span>Gross Salary</span>
              <span className="font-mono">₹{monthlySalary.toLocaleString('en-IN')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deductions</CardTitle>
            <CardDescription>Monthly deductions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span>PF (12% of Basic)</span>
              <span className="font-mono text-destructive">-₹{Math.round(pfDeduction).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span>Professional Tax</span>
              <span className="font-mono text-destructive">-₹{profTax}</span>
            </div>
            <div className="flex justify-between py-2 font-bold">
              <span>Total Deductions</span>
              <span className="font-mono text-destructive">-₹{Math.round(totalDeductions).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-3 mt-2 border-t-2 text-lg font-bold">
              <span>Net Pay</span>
              <span className="font-mono text-success">₹{Math.round(netPay).toLocaleString('en-IN')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Your previous salary payments</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : myPayroll.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No payroll records found yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pay Period</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myPayroll.map((record: any, index: number) => (
                    <tr key={index}>
                      <td className="font-medium">
                        {record.paid_date
                          ? new Date(record.paid_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                          : 'N/A'
                        }
                      </td>
                      <td className="font-medium">
                        ₹{Math.round(parseFloat(record.salary || annualSalary) / 12).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`status-badge ${(record.paid_status || '').toLowerCase() === 'paid'
                            ? 'status-approved'
                            : 'status-pending'
                          }`}>
                          {record.paid_status || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Payroll;
