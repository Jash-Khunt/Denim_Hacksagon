import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLeave } from '@/contexts/LeaveContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { LeaveType, LeaveStatus } from '@/types';

const StatusIcon = ({ status }: { status: string }) => {
  const normalized = status?.toLowerCase();
  switch (normalized) {
    case 'approved':
      return <CheckCircle2 className="w-5 h-5 text-success" />;
    case 'rejected':
      return <XCircle className="w-5 h-5 text-destructive" />;
    default:
      return <AlertCircle className="w-5 h-5 text-warning" />;
  }
};

const leaveTypeLabels: Record<string, string> = {
  paid: 'Paid Leave',
  Paid: 'Paid Leave',
  sick: 'Sick Leave',
  Sick: 'Sick Leave',
  unpaid: 'Unpaid Leave',
  Unpaid: 'Unpaid Leave',
  'Half-Day': 'Half Day',
};

const Leave = () => {
  const { user } = useAuth();
  const { myLeaves, isLoading, createLeaveRequest, fetchMyLeaves } = useLeave();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: '' as LeaveType,
    startDate: '',
    endDate: '',
    remarks: '',
  });

  useEffect(() => {
    fetchMyLeaves();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const success = await createLeaveRequest({
      leaveType: formData.type,
      startDate: formData.startDate,
      endDate: formData.endDate,
      remarks: formData.remarks,
    });
    setIsSubmitting(false);
    if (success) {
      setIsDialogOpen(false);
      setFormData({ type: '' as LeaveType, startDate: '', endDate: '', remarks: '' });
      fetchMyLeaves(); // Refresh
    }
  };

  // Count leaves by status
  const pendingCount = myLeaves.filter((l: any) => (l.status || '').toLowerCase() === 'pending').length;
  const approvedCount = myLeaves.filter((l: any) => (l.status || '').toLowerCase() === 'approved').length;
  const rejectedCount = myLeaves.filter((l: any) => (l.status || '').toLowerCase() === 'rejected').length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-center text-3xl font-bold">Leave Requests</h1>
          <p className="text-center text-muted-foreground mt-1">Manage your time-off requests</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Request Leave</DialogTitle>
              <DialogDescription>
                Fill in the details for your leave request
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: LeaveType) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.startDate}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  placeholder="Provide reason for leave request..."
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Request
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leave Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Pending</h3>
              <AlertCircle className="w-5 h-5 text-warning" />
            </div>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Approved</h3>
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div className="text-2xl font-bold text-success">{approvedCount}</div>
            <p className="text-sm text-muted-foreground">Approved requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Rejected</h3>
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div className="text-2xl font-bold text-destructive">{rejectedCount}</div>
            <p className="text-sm text-muted-foreground">Rejected requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Leave History */}
      <Card>
        <CardHeader>
          <CardTitle>Leave History</CardTitle>
          <CardDescription>Your recent leave requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : myLeaves.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No leave requests yet. Submit your first request!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myLeaves.map((request: any) => (
                <div
                  key={request.request_id || request.id}
                  className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-xl border border-border hover:bg-muted/50 transition-colors gap-4"
                >
                <div className="flex items-start gap-4">
                  <StatusIcon status={request.status} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{leaveTypeLabels[request.leave_type || request.type] || request.leave_type || request.type}</h4>
                      <span className={`status-badge status-${(request.status || '').toLowerCase()}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(request.start_date || request.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {(request.start_date || request.startDate) !== (request.end_date || request.endDate) && (
                          <> - {new Date(request.end_date || request.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Applied: {new Date(request.created_at || request.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {request.admin_comment && (
                      <p className="text-sm mt-2 p-2 bg-muted rounded-lg">
                        <span className="font-medium">Admin: </span>
                        {request.admin_comment}
                      </p>
                    )}
                  </div>
                </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leave;
