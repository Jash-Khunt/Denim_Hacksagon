import { useState, useEffect } from 'react';
import { useLeave } from '@/contexts/LeaveContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Search,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Loader2,
} from 'lucide-react';
import { LeaveType, LeaveStatus } from '@/types';

const leaveTypeLabels: Record<string, string> = {
  paid: 'Paid Leave',
  Paid: 'Paid Leave',
  sick: 'Sick Leave',
  Sick: 'Sick Leave',
  unpaid: 'Unpaid Leave',
  Unpaid: 'Unpaid Leave',
  'Half-Day': 'Half Day',
};

const LeaveApprovals = () => {
  const { toast } = useToast();
  const { leaves, isLoading, fetchAllLeaves, approveLeave, rejectLeave } = useLeave();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchAllLeaves();
  }, []);

  const pendingRequests = leaves.filter((r: any) => (r.status || '').toLowerCase() === 'pending');
  const processedRequests = leaves.filter((r: any) => (r.status || '').toLowerCase() !== 'pending');

  const filteredPending = pendingRequests.filter((r: any) =>
    (r.user_name || r.userName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredProcessed = processedRequests.filter((r: any) =>
    (r.user_name || r.userName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(true);
    let success: boolean;
    if (action === 'approve') {
      success = await approveLeave(id, comment);
    } else {
      success = await rejectLeave(id, comment);
    }
    setActionLoading(false);
    if (success) {
      setSelectedRequest(null);
      setComment('');
      fetchAllLeaves(); // Refresh
    }
  };

  const getDaysDiff = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const RequestCard = ({ request, showActions = true }: { request: any; showActions?: boolean }) => (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-xl border border-border hover:bg-muted/50 transition-colors gap-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-medium text-primary">
            {(request.user_name || request.userName || 'U').split(' ').map((n: string) => n[0]).join('')}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{request.user_name || request.userName || 'Employee'}</h4>
            <span className={`status-badge status-${(request.status || '').toLowerCase()}`}>
              {request.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {leaveTypeLabels[request.leave_type || request.type] || request.leave_type || request.type}
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(request.start_date || request.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {(request.start_date || request.startDate) !== (request.end_date || request.endDate) && (
                <> - {new Date(request.end_date || request.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
              )}
              <span className="ml-1">
                ({getDaysDiff(request.start_date || request.startDate, request.end_date || request.endDate)} days)
              </span>
            </span>
          </div>
          {request.admin_comment && (
            <p className="text-sm mt-2 p-2 bg-muted rounded-lg">
              <span className="font-medium">Comment: </span>
              {request.admin_comment}
            </p>
          )}
        </div>
      </div>
      {showActions && (request.status || '').toLowerCase() === 'pending' && (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setSelectedRequest({ ...request, _action: 'reject' })}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Reject
          </Button>
          <Button 
            size="sm" 
            className="bg-success hover:bg-success/90"
            onClick={() => setSelectedRequest({ ...request, _action: 'approve' })}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Approve
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leave Approvals</h1>
          <p className="text-muted-foreground mt-1">Review and manage employee leave requests</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-warning/10">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingRequests.length}</p>
              <p className="text-sm text-muted-foreground">Pending Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{leaves.filter((r: any) => (r.status || '').toLowerCase() === 'approved').length}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-info/10">
              <User className="w-6 h-6 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{leaves.filter((r: any) => (r.status || '').toLowerCase() === 'rejected').length}</p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests */}
      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({filteredPending.length})
          </TabsTrigger>
          <TabsTrigger value="processed">
            Processed ({filteredProcessed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>Requests awaiting your decision</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPending.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No pending requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPending.map((request: any) => (
                    <RequestCard key={request.request_id || request.id} request={request} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processed">
          <Card>
            <CardHeader>
              <CardTitle>Processed Requests</CardTitle>
              <CardDescription>Previously reviewed requests</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProcessed.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No processed requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProcessed.map((request: any) => (
                    <RequestCard key={request.request_id || request.id} request={request} showActions={false} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedRequest?._action === 'approve' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?._action === 'approve'
                ? 'You are about to approve this leave request.'
                : 'You are about to reject this leave request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-lg bg-muted">
              <p className="font-medium">{selectedRequest?.user_name || selectedRequest?.userName}</p>
              <p className="text-sm text-muted-foreground">
                {selectedRequest && leaveTypeLabels[selectedRequest.leave_type || selectedRequest.type]} · {' '}
                {selectedRequest && getDaysDiff(
                  selectedRequest.start_date || selectedRequest.startDate,
                  selectedRequest.end_date || selectedRequest.endDate
                )} days
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Add a comment (optional)</label>
              <Textarea
                placeholder="Enter your comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Cancel
              </Button>
              <Button
                variant={selectedRequest?._action === 'approve' ? 'default' : 'destructive'}
                disabled={actionLoading}
                onClick={() => selectedRequest && handleAction(
                  selectedRequest.request_id || selectedRequest.id, 
                  selectedRequest._action
                )}
              >
                {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedRequest?._action === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeaveApprovals;
