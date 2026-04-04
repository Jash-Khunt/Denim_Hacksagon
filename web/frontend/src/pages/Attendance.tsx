import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAttendance } from '@/contexts/AttendanceContext';
import { useLeave } from '@/contexts/LeaveContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { 
  Clock, LogIn, LogOut, Calendar, Loader2, ArrowLeft, Users, User as UserIcon, Plus,
  CheckCircle, XCircle, AlertCircle, Search,
} from 'lucide-react';
import { LeaveType } from '@/types';

// ==================== HELPERS ====================
const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateStr = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) return getLocalDateString(val);
  const s = val.toString();
  if (s.includes('T')) return s.split('T')[0];
  if (s.length >= 10) return s.substring(0, 10);
  return s;
};

const StatusBadge = ({ status }: { status: string }) => {
  const normalized = status?.toLowerCase() || 'absent';
  const statusStyles: Record<string, string> = {
    present: 'status-present',
    absent: 'status-absent',
    approved: 'status-approved',
    rejected: 'status-rejected',
    pending: 'status-pending',
    leave: 'status-leave',
  };
  return (
    <span className={`status-badge ${statusStyles[normalized] || 'status-absent'} capitalize`}>
      {normalized}
    </span>
  );
};

const leaveTypeLabels: Record<string, string> = {
  paid: 'Paid Leave', Paid: 'Paid Leave',
  sick: 'Sick Leave', Sick: 'Sick Leave',
  unpaid: 'Unpaid Leave', Unpaid: 'Unpaid Leave',
};

// ==================== EMPLOYEE VIEW ====================
const EmployeeView = () => {
  const {
    attendanceRecords, stats, todayStatus, isLoading: attLoading,
    checkIn, checkOut, fetchStats, fetchDailyAttendance, fetchTodayStatus,
  } = useAttendance();
  const {
    myLeaves, isLoading: leaveLoading, createLeaveRequest, fetchMyLeaves,
  } = useLeave();

  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: '' as LeaveType, startDate: '', endDate: '', remarks: '' });

  useEffect(() => {
    fetchStats();
    fetchDailyAttendance();
    fetchTodayStatus();
    fetchMyLeaves();
  }, []);

  const isCheckedIn = todayStatus?.isCheckedIn ?? false;
  const checkInTime = todayStatus?.checkInTime ?? null;

  const handleCheckIn = async () => {
    const success = await checkIn();
    if (success) { fetchStats(); fetchDailyAttendance(); fetchTodayStatus(); }
  };
  const handleCheckOut = async () => {
    const success = await checkOut();
    if (success) { fetchStats(); fetchDailyAttendance(); fetchTodayStatus(); }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await createLeaveRequest({
      leaveType: leaveForm.type, startDate: leaveForm.startDate,
      endDate: leaveForm.endDate, remarks: leaveForm.remarks,
    });
    setIsSubmitting(false);
    if (success) {
      setLeaveDialogOpen(false);
      setLeaveForm({ type: '' as LeaveType, startDate: '', endDate: '', remarks: '' });
      fetchMyLeaves();
    }
  };

  // Build calendar modifiers from attendance records
  const presentDates: Date[] = [];
  const absentDates: Date[] = [];
  const leaveDates: Date[] = [];
  attendanceRecords.forEach((r: any) => {
    const ds = toDateStr(r.attendance_date || r.date);
    if (!ds) return;
    const [y, m, d] = ds.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const status = (r.status || '').toLowerCase();
    if (status === 'present') presentDates.push(date);
    else if (status === 'leave') leaveDates.push(date);
    else absentDates.push(date);
  });

  // Also mark leave request dates
  myLeaves.forEach((l: any) => {
    if ((l.status || '').toLowerCase() === 'approved') {
      const start = new Date(l.start_date || l.startDate);
      const end = new Date(l.end_date || l.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        leaveDates.push(new Date(d));
      }
    }
  });

  const pendingLeaves = myLeaves.filter((l: any) => (l.status || '').toLowerCase() === 'pending').length;
  const approvedLeaves = myLeaves.filter((l: any) => (l.status || '').toLowerCase() === 'approved').length;

  return (
    <>
      {/* Check In/Out Card */}
      <Card className="border-2 border-dashed">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${isCheckedIn ? 'bg-success/10' : 'bg-muted'}`}>
                <Clock className={`w-8 h-8 ${isCheckedIn ? 'text-success' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {isCheckedIn ? "You're checked in" : "Ready to start your day?"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isCheckedIn
                    ? `Checked in at ${checkInTime}`
                    : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
            {isCheckedIn ? (
              <Button size="lg" variant="destructive" onClick={handleCheckOut} disabled={attLoading}>
                {attLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <LogOut className="w-5 h-5 mr-2" />}
                Check Out
              </Button>
            ) : (
              <Button size="lg" onClick={handleCheckIn} disabled={attLoading}>
                {attLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <LogIn className="w-5 h-5 mr-2" />}
                Check In
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-success">{stats?.present || 0}</p>
          <p className="text-xs text-muted-foreground">Present</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{stats?.absent || 0}</p>
          <p className="text-xs text-muted-foreground">Absent</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-warning">{pendingLeaves}</p>
          <p className="text-xs text-muted-foreground">Leave Pending</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-info">{approvedLeaves}</p>
          <p className="text-xs text-muted-foreground">Leave Approved</p>
        </CardContent></Card>
      </div>

      {/* Calendar + Leave Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[500px]">
        {/* Calendar */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Attendance Calendar</CardTitle>
            <CardDescription> 🟢 Present 🔴 Absent 🔵 Leave</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <DayPicker
              mode="single"
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              modifiers={{
                present: presentDates,
                absent: absentDates,
                leave: leaveDates,
                today: [new Date()],
              }}
              modifiersClassNames={{
                present: 'rdp-day--present',
                absent: 'rdp-day--absent',
                leave: 'rdp-day--leave',
                today: 'rdp-day--today-ring',
              }}
              showOutsideDays
            />
          </CardContent>
        </Card>

        {/* Leave Requests */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Leave Requests</CardTitle>
              <CardDescription>Your recent requests</CardDescription>
            </div>
            <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" />New</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                  <DialogTitle>Request Leave</DialogTitle>
                  <DialogDescription>Fill in the details for your leave request</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleLeaveSubmit} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label>Leave Type</Label>
                    <Select value={leaveForm.type} onValueChange={(v: LeaveType) => setLeaveForm({ ...leaveForm, type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid Leave</SelectItem>
                        <SelectItem value="sick">Sick Leave</SelectItem>
                        <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Start</Label>
                      <Input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>End</Label>
                      <Input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} min={leaveForm.startDate} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Textarea placeholder="Reason..." value={leaveForm.remarks} onChange={e => setLeaveForm({ ...leaveForm, remarks: e.target.value })} rows={2} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setLeaveDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Submit
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            {leaveLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : myLeaves.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No leave requests yet
              </div>
            ) : (
              <div className="space-y-3">
                {myLeaves.slice(0, 10).map((req: any) => (
                  <div key={req.request_id || req.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="mt-0.5">
                      {(req.status || '').toLowerCase() === 'approved' ? <CheckCircle className="w-4 h-4 text-success" /> :
                       (req.status || '').toLowerCase() === 'rejected' ? <XCircle className="w-4 h-4 text-destructive" /> :
                       <AlertCircle className="w-4 h-4 text-warning" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium truncate">{leaveTypeLabels[req.leave_type || req.type] || req.leave_type}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.start_date || req.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {(req.start_date || req.startDate) !== (req.end_date || req.endDate) && (
                          <> - {new Date(req.end_date || req.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

// ==================== HR VIEW ====================
const HRView = () => {
  const {
    isLoading: attLoading, hrEmployees, hrEmployeeDaily,
    fetchHREmployeesAttendance, fetchHREmployeeDaily,
  } = useAttendance();
  const {
    leaves, isLoading: leaveLoading, fetchAllLeaves, approveLeave, rejectLeave,
  } = useLeave();

  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState('attendance');
  const [searchQuery, setSearchQuery] = useState('');
  const [comment, setComment] = useState('');
  const [actionTarget, setActionTarget] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchHREmployeesAttendance();
    fetchAllLeaves();
  }, []);

  const handleSelectEmployee = async (emp: any) => {
    setSelectedEmployee(emp);
    await fetchHREmployeeDaily(emp.emp_id);
  };

  const handleLeaveAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(true);
    const success = action === 'approve' ? await approveLeave(id, comment) : await rejectLeave(id, comment);
    setActionLoading(false);
    if (success) { setActionTarget(null); setComment(''); fetchAllLeaves(); }
  };

  // Attendance calendar for selected employee
  const empPresentDates: Date[] = [];
  const empAbsentDates: Date[] = [];
  const empLeaveDates: Date[] = [];
  hrEmployeeDaily.forEach((r: any) => {
    const ds = toDateStr(r.attendance_date || r.date);
    if (!ds) return;
    const [y, m, d] = ds.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const status = (r.status || '').toLowerCase();
    if (status === 'present') empPresentDates.push(date);
    else if (status === 'leave') empLeaveDates.push(date);
    else empAbsentDates.push(date);
  });

  const presentCount = hrEmployees.filter(e => e.attendance_status?.toLowerCase() === 'present').length;
  const absentCount = hrEmployees.length - presentCount;
  const pendingLeaves = leaves.filter((r: any) => (r.status || '').toLowerCase() === 'pending');
  const processedLeaves = leaves.filter((r: any) => (r.status || '').toLowerCase() !== 'pending');

  const filteredPending = pendingLeaves.filter((r: any) =>
    (r.user_name || r.userName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Employee detail view
  if (selectedEmployee) {
    return (
      <>
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => setSelectedEmployee(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">{selectedEmployee.name}</h2>
            <p className="text-sm text-muted-foreground">{selectedEmployee.department || 'No department'} • {selectedEmployee.email}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Attendance Calendar</CardTitle>
            <CardDescription>🟢 Present · 🔴 Absent · 🔵 Leave</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <DayPicker
              mode="single"
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              modifiers={{ present: empPresentDates, absent: empAbsentDates, leave: empLeaveDates, today: [new Date()] }}
              modifiersClassNames={{
                present: 'rdp-day--present', absent: 'rdp-day--absent',
                leave: 'rdp-day--leave', today: 'rdp-day--today-ring',
              }}
              showOutsideDays

            />
          </CardContent>
        </Card>

        {/* Recent records table */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Recent Records</CardTitle>
          </CardHeader>
          <CardContent>
            {hrEmployeeDaily.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground text-sm">No records</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead>
                <tbody>
                  {hrEmployeeDaily.slice(0, 15).map((r: any) => (
                    <tr key={r.attendance_id || r.id}>
                      <td className="font-medium">{new Date(r.attendance_date || r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                      <td>{r.check_in || '-'}</td>
                      <td>{r.check_out || '-'}</td>
                      <td><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="attendance">Attendance ({hrEmployees.length})</TabsTrigger>
        <TabsTrigger value="leave-pending">Leave Pending ({pendingLeaves.length})</TabsTrigger>
        <TabsTrigger value="leave-history">Leave History ({processedLeaves.length})</TabsTrigger>
      </TabsList>

      {/* ATTENDANCE TAB */}
      <TabsContent value="attendance">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xl font-bold">{hrEmployees.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><LogIn className="w-5 h-5 text-success" /></div>
            <div><p className="text-xl font-bold text-success">{presentCount}</p><p className="text-xs text-muted-foreground">Present</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><LogOut className="w-5 h-5 text-destructive" /></div>
            <div><p className="text-xl font-bold text-destructive">{absentCount}</p><p className="text-xs text-muted-foreground">Absent</p></div>
          </CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance</CardTitle>
            <CardDescription>Click an employee to view their calendar</CardDescription>
          </CardHeader>
          <CardContent>
            {attLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Dept</th><th>In</th><th>Out</th><th>Status</th></tr></thead>
                <tbody>
                  {hrEmployees.map((emp: any) => (
                    <tr key={emp.emp_id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleSelectEmployee(emp)}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <UserIcon className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div><p className="font-medium text-sm">{emp.name}</p><p className="text-xs text-muted-foreground">{emp.email}</p></div>
                        </div>
                      </td>
                      <td className="text-sm">{emp.department || '-'}</td>
                      <td className="text-sm">{emp.check_in || '-'}</td>
                      <td className="text-sm">{emp.check_out || '-'}</td>
                      <td><StatusBadge status={emp.attendance_status || 'absent'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* LEAVE PENDING TAB */}
      <TabsContent value="leave-pending">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            {leaveLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : filteredPending.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No pending requests</p></div>
            ) : (
              <div className="divide-y">
                {filteredPending.map((req: any) => (
                  <div key={req.request_id || req.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-primary">
                          {(req.user_name || req.userName || 'U').split(' ').map((n: string) => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{req.user_name || req.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {leaveTypeLabels[req.leave_type || req.type] || req.leave_type} · {' '}
                          {new Date(req.start_date || req.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {(req.start_date || req.startDate) !== (req.end_date || req.endDate) && (
                            <> - {new Date(req.end_date || req.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-12 md:ml-0">
                      <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setActionTarget({ ...req, _action: 'reject' })}>
                        <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                      </Button>
                      <Button size="sm" className="bg-success hover:bg-success/90"
                        onClick={() => setActionTarget({ ...req, _action: 'approve' })}>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* LEAVE HISTORY TAB */}
      <TabsContent value="leave-history">
        <Card>
          <CardContent className="p-0">
            {processedLeaves.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><p>No processed requests</p></div>
            ) : (
              <div className="divide-y">
                {processedLeaves.map((req: any) => (
                  <div key={req.request_id || req.id} className="flex items-center justify-between p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-primary">
                          {(req.user_name || req.userName || 'U').split(' ').map((n: string) => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{req.user_name || req.userName}</p>
                        <p className="text-xs text-muted-foreground">
                          {leaveTypeLabels[req.leave_type || req.type] || req.leave_type} · {' '}
                          {new Date(req.start_date || req.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Approve/Reject Dialog */}
      <Dialog open={!!actionTarget} onOpenChange={() => setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTarget?._action === 'approve' ? 'Approve' : 'Reject'} Leave</DialogTitle>
            <DialogDescription>For {actionTarget?.user_name || actionTarget?.userName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="p-3 rounded-lg bg-muted text-sm">
              {actionTarget && leaveTypeLabels[actionTarget.leave_type || actionTarget.type]} · {' '}
              {actionTarget && new Date(actionTarget.start_date || actionTarget.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {actionTarget && (actionTarget.start_date || actionTarget.startDate) !== (actionTarget.end_date || actionTarget.endDate) && (
                <> - {new Date(actionTarget.end_date || actionTarget.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Comment (optional)</Label>
              <Textarea placeholder="Add a comment..." value={comment} onChange={e => setComment(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActionTarget(null)}>Cancel</Button>
              <Button
                variant={actionTarget?._action === 'approve' ? 'default' : 'destructive'}
                disabled={actionLoading}
                onClick={() => actionTarget && handleLeaveAction(actionTarget.request_id || actionTarget.id, actionTarget._action)}
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {actionTarget?._action === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
};

// ==================== MAIN PAGE ====================
const Attendance = () => {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const isHR = user?.role === 'hr';

  return (
    <div className="space-y-6 animate-fade-in">
      {isEmployee && <EmployeeView />}
      {isHR && <HRView />}
    </div>
  );
};

export default Attendance;
