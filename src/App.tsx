/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { API_URL } from './config';
import {
  LayoutDashboard,
  Building2,
  Users,
  ClipboardList,
  LogOut,
  Plus,
  Trash2,
  ShieldCheck,
  ChevronRight,
  Search,
  Bell,
  Clock,
  ImageIcon,
  XCircle,
  CheckCircle2,
  ExternalLink,
  Camera,
  Upload,
  FileDown,
  UserPlus,
  X,
  Info,
  AlertTriangle,
  Loader2,
  CalendarRange
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---
interface YearStats {
  total_students: number;
  total_classes: number;
  taskStats: { id: string; title: string; submitted: number; verified: number; pending: number; rejected: number; }[];
  classStats: { id: string; name: string; total_students: number; participating_students: number; }[];
  year: number;
}

interface User {
  id: number;
  username: string;
  role: 'SUPREME_ADMIN' | 'HOD' | 'CLASS_ADVISOR' | 'STUDENT';
  full_name: string;
  department_id: number | null;
  department_name?: string;
  class_id?: number | null;
  class_name?: string;
  email?: string;
  register_number?: string;
  is_coordinator?: boolean;
  is_year_coordinator?: boolean;
  year_scope?: number | null;
  must_change_password?: boolean;
  is_active?: boolean;
}

interface Department {
  id: number;
  name: string;
}

interface Class {
  id: number;
  name: string;
  department_id: number;
  department_name?: string;
  year?: number;
  batch?: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  category?: string;
  external_link?: string;
  deadline?: string;
  screenshot_instruction?: string;
  custom_field_label?: string;
  creator_name: string;
  department_name: string | null;
  class_ids: number[];
  status: 'OPEN' | 'CLOSED';
  created_at: string;
  submission_status?: string;
  submission_count?: number;
}

interface Submission {
  id: number;
  task_id: number;
  task_title: string;
  user_id: number;
  student_name?: string;
  register_number?: string;
  custom_field_value?: string;
  status: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  screenshot_url: string;
  verification_note?: string;
  rejection_reason?: string;
  submitted_at: string;
  verified_at?: string;
  resubmission_count?: number;
  class_name?: string;
  class_year?: number;
  class_ids?: number[];
  task_category?: string;
}

interface Notification {
  id: number;
  message: string;
  type: 'VERIFIED' | 'REJECTED' | 'TASK_CREATED';
  is_read: boolean;
  created_at: string;
}

interface HODStats {
  taskStats: {
    id: number;
    title: string;
    submitted: number;
    verified: number;
    pending: number;
    rejected: number;
    class_breakdown: {
      class_name: string;
      total_students: number;
      completed: number;
      not_completed: number;
    }[];
  }[];
  classStats: {
    name: string;
    total_students: number;
    participating_students: number;
  }[];
}

interface AdvisorStats {
  taskStats: {
    id: number;
    title: string;
    submitted: number;
    verified: number;
    pending: number;
    rejected: number;
  }[];
  studentStats: {
    full_name: string;
    completed_tasks: number;
    total_tasks: number;
  }[];
}

interface StudentStats {
  total_tasks: number;
  verified_tasks: number;
  submitted_tasks: number;
  rejected_tasks: number;
}

interface CoordinatorStats {
  taskStats: {
    id: number;
    title: string;
    submitted: number;
    verified: number;
    pending: number;
    rejected: number;
  }[];
  studentStats: {
    full_name: string;
    completed_tasks: number;
    total_tasks: number;
  }[];
}

import * as XLSX from 'xlsx';

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' }) => {
  const variants = {
    primary: 'bg-black text-white hover:bg-zinc-800',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'hover:bg-zinc-100 text-zinc-600',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700'
  };
  return (
    <button
      className={cn('px-4 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50', variants[variant], className)}
      {...props}
    />
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn('w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all', className)}
    {...props}
  />
);

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm', className)} {...props}>
    {children}
  </div>
);

const CircularProgress = ({ value, total, label, color = "text-indigo-600", size = "lg" }: { value: number; total: number; label: string; color?: string; size?: 'sm' | 'lg' }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const radius = size === 'lg' ? 36 : 18;
  const strokeWidth = size === 'lg' ? 8 : 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const dim = size === 'lg' ? 96 : 48;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", size === 'lg' ? "w-24 h-24" : "w-12 h-12")}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${dim} ${dim}`}>
          <circle cx={dim / 2} cy={dim / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-zinc-100" />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: offset }}
            className={cn("transition-all duration-1000 ease-out", color)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold text-zinc-900", size === 'lg' ? "text-lg" : "text-[10px]")}>{Math.round(percentage)}%</span>
        </div>
      </div>
      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{label}</span>
    </div>
  );
};

const SimpleBarChart = ({ data, label, color = "bg-indigo-500" }: { data: { label: string; value: number; total: number }[]; label: string; color?: string }) => {
  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-2 border-b border-zinc-100 pb-2">{label}</h4>
      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {data.map((item, i) => {
          const percentage = item.total > 0 ? (item.value / item.total) * 100 : 0;
          return (
            <div key={i} className="group">
              <div className="flex justify-between items-center mb-1.5 text-[11px] font-bold text-zinc-700">
                <span className="truncate mr-4">{item.label}</span>
                <span className="text-zinc-400 font-mono text-[10px] whitespace-nowrap">{item.value}/{item.total}</span>
              </div>
              <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
                <div
                  className={cn("h-full transition-all duration-1000 ease-out rounded-full shadow-sm", color)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- UI Polish Components ---
export type ToastType = 'success' | 'error' | 'info';
export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

const ToastContainer = ({ toasts, removeToast }: { toasts: ToastMessage[], removeToast: (id: string) => void }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className={cn(
              "p-4 rounded-xl shadow-lg border flex items-start gap-3 w-80 pointer-events-auto backdrop-blur-md",
              toast.type === 'success' ? "bg-emerald-50/90 border-emerald-200 text-emerald-800" :
                toast.type === 'error' ? "bg-red-50/90 border-red-200 text-red-800" :
                  "bg-blue-50/90 border-blue-200 text-blue-800"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> :
                toast.type === 'error' ? <XCircle size={18} className="text-red-500" /> :
                  <Info size={18} className="text-blue-500" />}
            </div>
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="shrink-0 text-zinc-400 hover:text-black transition-colors">
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse bg-zinc-200 rounded-lg", className)} />
);

const EmptyState = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-zinc-200 rounded-3xl bg-zinc-50/50">
    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-zinc-400 mb-4 shadow-sm">
      <Icon size={32} />
    </div>
    <h3 className="text-xl font-bold text-zinc-900 mb-2">{title}</h3>
    <p className="text-zinc-500 max-w-sm">{description}</p>
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<string>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  // Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // Login State
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginRole, setLoginRole] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Data State
  const [departments, setDepartments] = useState<Department[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [hodStats, setHodStats] = useState<HODStats | null>(null);
  const [advisorStats, setAdvisorStats] = useState<AdvisorStats | null>(null);
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null);
  const [coordinatorStats, setCoordinatorStats] = useState<CoordinatorStats | null>(null);
  const [yearStats, setYearStats] = useState<YearStats | null>(null);
  const [myClass, setMyClass] = useState<Class | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [reportFilters, setReportFilters] = useState({ classId: '', year: '', category: '', taskId: '', status: '' });
  const [expandedClass, setExpandedClass] = useState<number | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

  // Forms
  const [newDept, setNewDept] = useState('');
  const [newClass, setNewClass] = useState({ name: '', department_id: '', year: '', batch: '' });
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    department_id: '',
    class_id: '',
    email: '',
    register_number: '',
    is_year_coordinator: false,
    year_scope: ''
  });
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'Competition',
    external_link: '',
    deadline: '',
    screenshot_instruction: '',
    custom_field_label: '',
    department_id: '',
    class_ids: []
  });
  const [uploading, setUploading] = useState<number | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showTaskPreview, setShowTaskPreview] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALL'>('PENDING');
  const [verificationClassFilter, setVerificationClassFilter] = useState('');
  const [verificationTaskFilter, setVerificationTaskFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState<'ALL' | 'ACTIVE' | 'COORDINATORS'>('ALL');
  const [showFooterModal, setShowFooterModal] = useState<'PRIVACY' | 'TERMS' | 'SUPPORT' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [submissionSearchTerm, setSubmissionSearchTerm] = useState('');
  const [submissionPage, setSubmissionPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedSubmissions, setSelectedSubmissions] = useState<number[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState<number | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [analyzerClassFilter, setAnalyzerClassFilter] = useState('');
  const [analyzerTaskFilter, setAnalyzerTaskFilter] = useState('');
  const [analyzerStatusFilter, setAnalyzerStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [adminDeptFilter, setAdminDeptFilter] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File>>({});
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isDraggingScreenshot, setIsDraggingScreenshot] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');

  useEffect(() => {
    if (token) {
      fetchInitialData();
      // Poll for live updates every 60 seconds (reduced from 30s to cut re-renders)
      const interval = setInterval(() => {
        fetchTasks();
        fetchSubmissions();
        fetchNotifications();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchInitialData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      // Fire all requests in parallel
      const [deptsRes, classesRes, usersRes, tasksRes, submissionsRes, notificationsRes] = await Promise.all([
        fetch(`${API_URL}/api/departments`, { headers }),
        fetch(`${API_URL}/api/classes`, { headers }),
        fetch(`${API_URL}/api/users`, { headers }),
        fetch(`${API_URL}/api/tasks`, { headers }),
        fetch(`${API_URL}/api/submissions`, { headers }),
        fetch(`${API_URL}/api/notifications`, { headers })
      ]);

      // Parse JSON in parallel too
      const [depts, classes, users, tasks, submissions, notifications] = await Promise.all([
        deptsRes.ok ? deptsRes.json() : Promise.resolve(null),
        classesRes.ok ? classesRes.json() : Promise.resolve(null),
        usersRes.ok ? usersRes.json() : Promise.resolve(null),
        tasksRes.ok ? tasksRes.json() : Promise.resolve(null),
        submissionsRes.ok ? submissionsRes.json() : Promise.resolve(null),
        notificationsRes.ok ? notificationsRes.json() : Promise.resolve(null),
      ]);

      if (depts) setDepartments(depts);
      if (classes) setClasses(classes);
      if (users) setUsers(users);
      if (tasks) setTasks(tasks);
      if (submissions) setSubmissions(submissions);
      if (notifications) setNotifications(notifications);

      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);

        // Refresh user data from server to avoid stale session flags
        try {
          const meRes = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (meRes.ok) {
            const freshUser = await meRes.json();
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
            if (freshUser.must_change_password) setShowPasswordModal(true);
            if (freshUser.role === 'HOD') fetchHODStats();
            if (freshUser.role === 'CLASS_ADVISOR' || (freshUser.role === 'STUDENT' && freshUser.is_coordinator)) {
              if (freshUser.role === 'CLASS_ADVISOR') fetchAdvisorStats();
              if (freshUser.role === 'STUDENT' && freshUser.is_coordinator) fetchCoordinatorStats();
              fetchMyClass();
            }
            if (freshUser.role === 'STUDENT') fetchStudentStats();
            if (freshUser.is_year_coordinator) fetchYearStats();
          } else {
            // Fallback to saved user if refresh fails
            setUser(parsedUser);
            if (parsedUser.must_change_password) setShowPasswordModal(true);
          }
        } catch (err) {
          setUser(parsedUser);
        }
      }
      setIsLoading(false);
    } catch (e) {
      console.error('Failed to fetch data', e);
      addToast('Failed to load application data. Check your connection.', 'error');
      setIsLoading(false);
    }
  };

  // Targeted refresh helpers - fetch only what changed
  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tasks`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTasks(await res.json());
    } catch (e) { }
  };

  const fetchSubmissions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/submissions`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSubmissions(await res.json());
    } catch (e) { }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (e) { }
  };

  const fetchHODStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats/hod`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setHodStats(await res.json());
    } catch (e) { }
  };

  const fetchAdvisorStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats/advisor`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAdvisorStats(await res.json());
    } catch (e) { }
  };

  const fetchCoordinatorStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats/coordinator`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCoordinatorStats(await res.json());
    } catch (e) { }
  };

  const fetchMyClass = async () => {
    try {
      const res = await fetch(`${API_URL}/api/my-class`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMyClass(await res.json());
    } catch (e) { }
  };

  const fetchYearStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats/year`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setYearStats(await res.json());
    } catch (e) { }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setNotifications(await res.json());
    } catch (e) { }
  };

  const markNotificationsRead = async () => {
    try {
      await fetch(`${API_URL}/api/notifications/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (e) { }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newPassword })
    });
    if (res.ok) {
      setShowPasswordModal(false);
      setNewPassword('');
      // Update local user state
      if (user) {
        const updated = { ...user, must_change_password: false };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
      }
    }
  };

  const toggleCoordinator = async (id: number, currentStatus: boolean) => {
    const res = await fetch(`${API_URL}/api/users/${id}/coordinator`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_coordinator: !currentStatus })
    });
    if (res.ok) {
      // Only re-fetch users — no need to reload everything
      fetchUsers();
    } else {
      const data = await res.json();
      addToast(data.error, 'error');
    }
  };

  const toggleUserStatus = async (id: number, currentStatus: boolean) => {
    const res = await fetch(`${API_URL}/api/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: !currentStatus })
    });
    if (res.ok) {
      // Only re-fetch users — no need to reload everything
      fetchUsers();
    }
  };

  const toggleYearCoordinator = async (id: number, isYearCoord: boolean, currentYear?: number) => {
    let year_scope = currentYear;
    let is_year_coordinator = !isYearCoord;

    if (is_year_coordinator) {
      const year = prompt('Enter the Year Scope (1-4):', currentYear?.toString() || '1');
      if (year === null) return;
      const yrNum = parseInt(year);
      if (isNaN(yrNum) || yrNum < 1 || yrNum > 4) {
        addToast('Invalid year scope. Please enter 1-4.', 'error');
        return;
      }
      year_scope = yrNum;
    }

    const res = await fetch(`${API_URL}/api/users/${id}/year-coordinator`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_year_coordinator, year_scope })
    });

    if (res.ok) {
      fetchUsers();
      addToast(is_year_coordinator ? 'Year Coordinator assigned successfully.' : 'Year Coordinator role removed.', 'success');
    } else {
      const data = await res.json();
      addToast(data.error || 'Failed to update Year Coordinator status', 'error');
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        // Map columns: Register Number, Name, Email
        const students = data.map(row => {
          const findKey = (variations: string[]) => {
            const key = Object.keys(row).find(k => {
              const normalizedKey = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
              const normalizedVariations = variations.map(v => v.toLowerCase().replace(/[^a-z0-9]/g, ''));
              return normalizedVariations.includes(normalizedKey);
            });
            return key ? row[key] : null;
          };

          return {
            register_number: findKey(['register number', 'reg no', 'register_number', 'reg_no', 'roll no', 'regnumber']),
            name: findKey(['name', 'student name', 'full name', 'fullname', 'student_name']),
            email: findKey(['email', 'email address', 'email_address', 'mail'])
          };
        }).filter(s => s.register_number && s.name);

        if (students.length === 0) {
          alert('No valid student data found in Excel! Ensure columns are named "Register Number" and "Name".');
          return;
        }

        const res = await fetch(`${API_URL}/api/students/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ students })
        });

        if (res.ok) {
          const result = await res.json();
          addToast(`Imported ${result.success} students. Failed/Duplicates: ${result.failed}`, 'success');
          fetchInitialData();
        } else {
          const err = await res.json();
          addToast(`Server error: ${err.error || 'Failed to import students'}`, 'error');
        }
      } catch (err) {
        console.error("Excel parse error", err);
        addToast('Invalid Excel file format.', 'error');
      } finally {
        // Reset file input to allow re-uploading the same file if needed
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const fetchStudentStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats/student`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setStudentStats(await res.json());
    } catch (e) { }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...loginData, role: loginRole })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        if (data.user.must_change_password) {
          setShowPasswordModal(true);
        }
        setView('dashboard');
      } else {
        setError(data.error || 'Failed to login');
      }
    } catch (e) {
      setError('Connection failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setLoginRole(null);
    setLoginData({ username: '', password: '' });
    setView('dashboard');
  };

  const createDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newDept })
    });
    if (res.ok) {
      setNewDept('');
      fetchInitialData();
    }
  };

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();

    // For advisors updating their class, we merge changes with existing data
    const payload = (isAdvisor && myClass) ? {
      name: newClass.name || myClass.name,
      year: newClass.year || myClass.year,
      batch: newClass.batch || myClass.batch,
    } : newClass;

    const res = await fetch(`${API_URL}/api/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setNewClass({ name: '', department_id: '', year: '', batch: '' });
      // Only re-fetch classes and my-class, not everything
      const [classesRes] = await Promise.all([
        fetch(`${API_URL}/api/classes`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (classesRes.ok) setClasses(await classesRes.json());
      fetchMyClass();
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    let role = 'STUDENT';
    if (user?.role === 'SUPREME_ADMIN') role = 'HOD';
    else if (user?.role === 'HOD') role = 'CLASS_ADVISOR';

    // Sanitize: convert empty strings to null so PostgreSQL doesn't store ''
    const payload = {
      ...newUser,
      role,
      department_id: newUser.department_id || null,
      class_id: newUser.class_id || null,
      register_number: newUser.register_number || null,
      email: newUser.email || null,
    };

    const res = await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setNewUser({ username: '', password: '', full_name: '', department_id: '', class_id: '', email: '', register_number: '' });
      fetchInitialData();
      addToast(`${role === 'HOD' ? 'HOD' : role === 'CLASS_ADVISOR' ? 'Advisor' : 'Student'} account created successfully!`, 'success');
    } else {
      const data = await res.json();
      addToast(data.error || 'Failed to create user', 'error');
    }
  };

  const handleTaskPreview = (e: React.FormEvent) => {
    e.preventDefault();
    setShowTaskPreview(true);
  };

  const createTask = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newTask)
      });
      if (res.ok) {
        setNewTask({ title: '', description: '', category: 'Competition', external_link: '', deadline: '', screenshot_instruction: '', custom_field_label: '', department_id: '', class_ids: [] });
        setShowTaskPreview(false);
        addToast('Task created successfully!', 'success');
        fetchTasks();
      } else {
        const data = await res.json();
        addToast(`Failed to create task: ${data.error}`, 'error');
        setShowTaskPreview(false);
      }
    } catch (e) {
      addToast('Network error while creating task. Please try again.', 'error');
      setShowTaskPreview(false);
    }
  };

  const resetPassword = async (id: number) => {
    if (!confirm('Reset this user\'s password to their Register Number/Username? They will be prompted to change it on next login.')) return;
    const res = await fetch(`${API_URL}/api/users/${id}/reset-password`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      addToast(data.message || 'Password reset successful', 'success');
    } else {
      const data = await res.json();
      addToast(data.error || 'Failed to reset password', 'error');
    }
  };

  const submitTask = async (taskId: number) => {
    const fileForTask = selectedFiles[taskId];
    if (!fileForTask) return addToast('Please select a screenshot', 'error');
    if (!customFieldValue) return addToast('Please fill the custom field', 'error');

    setUploading(taskId);

    // Client-side compression
    const compressImage = (file: File): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
              if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) resolve(blob); else reject(new Error('Canvas failed'));
            }, 'image/jpeg', 0.8);
          };
          img.onerror = reject;
        };
        reader.onerror = reject;
      });
    };

    try {
      let fileToUpload: Blob | File = fileForTask;
      if (fileForTask.type.startsWith('image/')) {
        addToast('Compressing image...', 'info');
        fileToUpload = await compressImage(fileForTask);
      }

      const formData = new FormData();
      formData.append('task_id', taskId.toString());
      formData.append('screenshot', fileToUpload, fileForTask.name);
      formData.append('custom_field_value', customFieldValue);

      const res = await fetch(`${API_URL}/api/submissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        setSelectedFiles(prev => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        setCustomFieldValue('');
        addToast('Task submitted successfully!', 'success');
        // Only refresh submissions after submitting
        fetchSubmissions();
      } else {
        const data = await res.json();
        addToast(`Submission failed: ${data.error}`, 'error');
      }
    } catch (e) {
      addToast('Network error during submission', 'error');
    }
    setUploading(null);
  };

  const verifySubmission = async (id: number, status: string) => {
    await fetch(`${API_URL}/api/submissions/${id}/verify`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        status,
        verification_note: status === 'VERIFIED' ? verificationNote : null,
        rejection_reason: status === 'REJECTED' ? rejectionReason : null
      })
    });
    setVerificationNote('');
    setRejectionReason('');
    setShowRejectionModal(null);
    // Only refresh submissions after verify/reject
    fetchSubmissions();
  };

  const handleFileUpload = (taskId: number, file: File | null) => {
    if (file) {
      // Add a 5MB size limit restriction as requested
      if (file.size > 5 * 1024 * 1024) {
        addToast('Image size exceeds 5MB limit. Please select a smaller file.', 'error');
        return;
      }
      setSelectedFiles(prev => ({ ...prev, [taskId]: file }));
    }
  };

  const toggleTaskStatus = async (id: number, currentStatus: string) => {
    const status = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const res = await fetch(`${API_URL}/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      fetchTasks(); // Only refresh tasks list
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update task status');
    }
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Hard delete this task? This cannot be undone.')) return;
    const res = await fetch(`${API_URL}/api/tasks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      // Optimistically remove from list, then refresh tasks only
      setTasks(prev => prev.filter(t => t.id !== id));
      fetchSubmissions(); // refresh submissions too since task's subs are deleted
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete task');
    }
  };

  const exportToExcel = async (filters?: { classId?: string; year?: string; category?: string; taskId?: string; status?: string; }) => {
    if (!hodStats) return;

    // Get all dept students
    const deptStudents = users.filter(u => {
      if (u.role !== 'STUDENT') return false;
      if (filters?.classId) return u.class_id?.toString() === filters.classId;
      return hodStats.classStats.some((c: any) => c.id.toString() === u.class_id?.toString());
    });

    // Handle the "Not Submitted" case specially
    if (filters?.status === 'NOT_SUBMITTED') {
      // Find students with no submission for the given task (or no submissions at all)
      const rowsNotSubmitted = deptStudents.flatMap(student => {
        const taskList = filters?.taskId
          ? tasks.filter(t => t.id?.toString() === filters.taskId)
          : tasks.filter(t => {
            const isDept = t.department_id === user?.department_id;
            const isGlobal = t.department_id === null && (!(t.class_ids || []).length);
            return isDept || isGlobal;
          });
        return taskList.flatMap(task => {
          const hasSub = submissions.some(s =>
            s.student_name === student.full_name && s.task_id?.toString() === task.id?.toString()
          );
          if (!hasSub) {
            const cls = hodStats.classStats.find((c: any) => c.id.toString() === student.class_id?.toString());
            return [{
              'Student Name': student.full_name,
              'Register Number': student.register_number,
              'Class': cls?.name || '—',
              'Task Title': task.title,
              'Category': task.category || '—',
              'Status': 'NOT SUBMITTED',
              'Submitted At': '—',
            }];
          }
          return [];
        });
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsNotSubmitted.length ? rowsNotSubmitted : [{ 'Info': 'No pending students found.' }]), 'Not Submitted Students');
      XLSX.writeFile(wb, `HOD_Report_NotSubmitted_${new Date().toISOString().slice(0, 10)}.xlsx`);
      return;
    }

    let filteredSubmissions = submissions.filter(s => {
      const task = tasks.find(t => t.id === s.task_id);
      if (!task) return false;
      const isDeptTask = task.department_id === user?.department_id;
      const isGlobalTask = task.department_id === null && (!(task.class_ids || []).length);
      if (!isDeptTask && !isGlobalTask) return false;
      if (filters?.classId && s.class_id?.toString() !== filters.classId) return false;
      if (filters?.taskId && s.task_id?.toString() !== filters.taskId) return false;
      if (filters?.year && s.class_year?.toString() !== filters.year) return false;
      if (filters?.category && s.task_category !== filters.category) return false;
      if (filters?.status && s.status !== filters.status) return false;
      return true;
    });

    const detailedData = filteredSubmissions.map(s => ({
      'Student Name': s.student_name,
      'Register Number': s.register_number,
      'Class': s.class_name,
      'Year': s.class_year,
      'Task Title': s.task_title,
      'Category': s.task_category,
      'Status': s.status,
      'Submitted At': s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : 'N/A'
    }));

    const taskData = hodStats.taskStats.map(t => ({
      'Task Title': t.title,
      'Submitted': t.submitted,
      'Verified': t.verified,
      'Pending': t.pending,
      'Rejected': t.rejected
    }));

    const classData = hodStats.classStats.map(c => ({
      'Class Name': c.name,
      'Total Students': c.total_students,
      'Participating Students': c.participating_students,
      'Participation Rate': c.total_students > 0 ? `${((c.participating_students / c.total_students) * 100).toFixed(1)}%` : '0%'
    }));

    const wb = XLSX.utils.book_new();
    const wsDetailed = XLSX.utils.json_to_sheet(detailedData);
    const wsTasks = XLSX.utils.json_to_sheet(taskData);
    const wsClasses = XLSX.utils.json_to_sheet(classData);

    XLSX.utils.book_append_sheet(wb, wsDetailed, "Detailed Report");
    XLSX.utils.book_append_sheet(wb, wsTasks, "Task Summary");
    XLSX.utils.book_append_sheet(wb, wsClasses, "Class Summary");

    const fileName = filters ? `Filtered_Report_${new Date().toISOString().split('T')[0]}.xlsx` : `Department_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    setShowExportModal(false);
  };

  // Class-scoped export for Class Advisors and Coordinators
  const exportToExcelForClass = async (filters?: { taskId?: string; status?: string; category?: string; }) => {
    const classId = user?.class_id;
    if (!classId) return;

    const classStudents = users.filter(u => u.role === 'STUDENT' && u.class_id?.toString() === classId.toString());
    const className = classStudents[0]?.class_name || user?.class_name || `Class_${classId}`;

    // Handle NOT_SUBMITTED case
    if (filters?.status === 'NOT_SUBMITTED') {
      const taskList = filters?.taskId
        ? tasks.filter(t => t.id?.toString() === filters.taskId)
        : tasks;
      const rows = classStudents.flatMap(student =>
        taskList.flatMap(task => {
          const hasSub = submissions.some(s =>
            s.student_name === student.full_name && s.task_id?.toString() === task.id?.toString()
          );
          if (!hasSub) {
            return [{ 'Student Name': student.full_name, 'Register Number': student.register_number, 'Class': className, 'Task Title': task.title, 'Category': task.category || '—', 'Status': 'NOT SUBMITTED', 'Submitted At': '—' }];
          }
          return [];
        })
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No pending students found.' }]), 'Not Submitted');
      XLSX.writeFile(wb, `${className}_NotSubmitted_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setShowExportModal(false);
      return;
    }

    let filteredSubs = submissions.filter(s => {
      if (s.class_id?.toString() !== classId.toString()) return false;
      if (filters?.taskId && s.task_id?.toString() !== filters.taskId) return false;
      if (filters?.status && s.status !== filters.status) return false;
      if (filters?.category && (s as any).task_category !== filters.category) return false;
      return true;
    });

    const detailed = filteredSubs.map(s => ({
      'Student Name': s.student_name,
      'Register Number': s.register_number,
      'Class': s.class_name || className,
      'Task Title': s.task_title,
      'Status': s.status,
      'Submitted At': s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : 'N/A',
    }));

    const taskSummary = tasks.map(t => {
      const taskSubs = filteredSubs.filter(s => s.task_id === t.id);
      return {
        'Task Title': t.title,
        'Category': t.category || '—',
        'Submitted': taskSubs.filter(s => s.status === 'SUBMITTED').length,
        'Verified': taskSubs.filter(s => s.status === 'VERIFIED').length,
        'Rejected': taskSubs.filter(s => s.status === 'REJECTED').length,
      };
    }).filter(r => r.Submitted + r.Verified + r.Rejected > 0);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailed.length ? detailed : [{ Info: 'No submissions found.' }]), 'Detailed Report');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taskSummary.length ? taskSummary : [{ Info: 'No tasks found.' }]), 'Task Summary');
    XLSX.writeFile(wb, `${className}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportModal(false);
  };

  if (!token) {
    const roles = [
      { id: 'STUDENT', title: 'Student', icon: <Users className="w-6 h-6" />, desc: 'Submit and track your academic tasks' },
      { id: 'STUDENT_COORDINATOR', title: 'Coordinator', icon: <Users className="w-6 h-6 text-amber-500" />, desc: 'Verify tasks for your class' },
      { id: 'CLASS_ADVISOR', title: 'Class Advisor', icon: <ClipboardList className="w-6 h-6" />, desc: 'Manage class tasks and students' },
      { id: 'HOD', title: 'Department HOD', icon: <Building2 className="w-6 h-6" />, desc: 'Oversee department progress' },
      { id: 'SUPREME_ADMIN', title: 'Supreme Admin', icon: <ShieldCheck className="w-6 h-6" />, desc: 'System-wide resource management' },
    ];

    return (
      <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-4xl"
        >
          <div className="flex flex-col items-center mb-12">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-xl">
              <ShieldCheck className="text-white w-8 h-8" />
            </div>
            <h1 className="text-4xl font-black text-zinc-900 tracking-tight">Academic Portal v2</h1>
            <p className="text-zinc-500 mt-2 text-lg">VSBEC Task Management System</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key="login-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-md mx-auto w-full"
            >
              <Card className="p-8">
                <div className="mb-8 text-center">
                  <h2 className="text-2xl font-bold text-zinc-900">Portal Login</h2>
                  <p className="text-zinc-500 text-sm mt-1">Please enter your credentials</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-zinc-700 mb-1 block">Email Address / Username</label>
                    <Input
                      placeholder="e.g. user@gmail.com"
                      value={loginData.username}
                      onChange={e => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-zinc-700 mb-1 block">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={e => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        required
                        className="pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-red-500 text-sm font-medium"
                    >
                      {error}
                    </motion.p>
                  )}
                  <Button className="w-full py-3 text-lg mt-2">Sign In</Button>
                </form>
              </Card>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  const isAdmin = user?.role === 'SUPREME_ADMIN';
  const isHOD = user?.role === 'HOD';

  const UnifiedAnalyzer = ({ role, title }: { role: string, title: string }) => {
    // Determine context
    const isGlobal = role === 'SUPREME_ADMIN';
    const isDept = role === 'HOD';
    const isYear = role === 'YEAR_COORDINATOR';
    const isCls = role === 'CLASS_ADVISOR' || role === 'COORDINATOR';

    const currentDeptId = isGlobal ? adminDeptFilter : user?.department_id?.toString();
    const currentYearScope = isYear ? Number(user?.year_scope) : null;
    const currentClassId = isCls ? (user?.class_id || myClass?.id)?.toString() : analyzerClassFilter;

    const deptStudents = users.filter(u => {
      if (u.role !== 'STUDENT') return false;
      if (isCls) return u.class_id?.toString() === currentClassId;
      if (isYear) {
        const studentClass = classes.find(c => c.id.toString() === u.class_id?.toString());
        return u.department_id?.toString() === currentDeptId && Number(studentClass?.year) === currentYearScope;
      }
      if (currentDeptId) return u.department_id?.toString() === currentDeptId;
      return true;
    }).filter(u => {
      if (!isCls && !isYear && analyzerClassFilter) return u.class_id?.toString() === analyzerClassFilter;
      if (isYear && analyzerClassFilter) return u.class_id?.toString() === analyzerClassFilter;
      return true;
    });

    const enriched = deptStudents.map(student => {
      let submissionStatus = 'PENDING';
      let submissionLabel = 'Not Registered';
      const clsName = classes.find(c => c.id.toString() === student.class_id?.toString())?.name || '—';
      let missingTasks: any[] = [];

      if (analyzerTaskFilter) {
        const sub = submissions.find(s =>
          s.user_id?.toString() === student.id?.toString() &&
          s.task_id?.toString() === analyzerTaskFilter
        );
        if (sub) {
          submissionStatus = sub.status;
          submissionLabel = sub.status === 'VERIFIED' ? 'Verified' : sub.status === 'REJECTED' ? 'Rejected' : 'Submitted';
        }
      } else {
        const studentSubs = submissions.filter(s => s.user_id?.toString() === student.id?.toString());
        const visibleTasks = tasks.filter(t => {
          // If we are filtering by a specific class in the analyzer, show tasks for that class OR dept-wide OR global
          if (analyzerClassFilter) {
            if ((t.class_ids || []).some(cid => cid.toString() === analyzerClassFilter)) return true;
            if (t.department_id && t.department_id.toString() === student.department_id?.toString() && (!(t.class_ids || []).length)) return true;
            if (!t.department_id && (!(t.class_ids || []).length)) return true;
            return false;
          }
          // Default logic for "All Classes" or specific Advisor context
          if (Array.isArray(t.class_ids) && t.class_ids.length > 0 && !t.class_ids.some(cid => cid.toString() === student.class_id?.toString())) return false;
          if (t.department_id && t.department_id.toString() !== student.department_id?.toString() && (!(t.class_ids || []).length)) return false;
          return true;
        });

        const visibleTaskIds = new Set(visibleTasks.map(t => (t as any)._id?.toString() || (t as any).id?.toString()));
        const studentSubsInContext = studentSubs.filter(s => visibleTaskIds.has(s.task_id?.toString()));
        const totalTasks = visibleTasks.length;
        const doneTaskIds = new Set(studentSubsInContext.filter(s => s.status === 'VERIFIED' || s.status === 'SUBMITTED').map(s => s.task_id?.toString()));
        const doneCount = doneTaskIds.size;

        missingTasks = visibleTasks.filter(t => !doneTaskIds.has((t as any)._id?.toString() || (t as any).id?.toString()));

        submissionLabel = `${doneCount} / ${totalTasks} Events`;
        if (totalTasks === 0) {
          submissionStatus = 'PENDING';
        } else if (doneCount === totalTasks) {
          submissionStatus = 'VERIFIED';
        } else if (doneCount > 0) {
          submissionStatus = 'SUBMITTED';
        } else {
          submissionStatus = 'PENDING';
        }
      }

      return { ...student, submissionStatus, submissionLabel, clsName, missingTasks };
    });

    const filtered = enriched.filter(s => {
      if (analyzerStatusFilter === 'COMPLETED') return s.submissionStatus === 'VERIFIED' || s.submissionStatus === 'SUBMITTED';
      if (analyzerStatusFilter === 'PENDING') return s.submissionStatus === 'PENDING';
      return true;
    });

    const completedCount = enriched.filter(s => s.submissionStatus === 'VERIFIED' || s.submissionStatus === 'SUBMITTED').length;
    const pendingCount = enriched.filter(s => s.submissionStatus === 'PENDING').length;

    return (
      <Card className="p-0 overflow-hidden rounded-[2.5rem] border-zinc-100 shadow-xl bg-white mt-10">
        <div className="p-8 border-b border-zinc-100 bg-zinc-50/50">
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{title}</h3>
          <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-1">Track student progress and events</p>
        </div>

        <div className="px-8 pt-6 pb-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white border-b border-zinc-100">
          {isGlobal && (
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">Department</label>
              <select
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold"
                value={adminDeptFilter}
                onChange={e => setAdminDeptFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id.toString()}>{d.name}</option>)}
              </select>
            </div>
          )}
          {!isCls && (
            <div>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">Class</label>
              <select
                className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold"
                value={analyzerClassFilter}
                onChange={e => setAnalyzerClassFilter(e.target.value)}
              >
                <option value="">All Classes</option>
                {classes.filter(c => {
                  if (currentDeptId && c.department_id?.toString() !== currentDeptId) return false;
                  if (isYear && Number(c.year) !== currentYearScope) return false;
                  return true;
                }).map(c => (
                  <option key={c.id} value={c.id.toString()}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className={cn(isGlobal ? "md:col-span-1" : isCls ? "md:col-span-2" : "md:col-span-1")}>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">Event</label>
            <select
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold"
              value={analyzerTaskFilter}
              onChange={e => setAnalyzerTaskFilter(e.target.value)}
            >
              <option value="">All Events</option>
              {tasks.filter(t => {
                const isDeptMatch = !currentDeptId || t.department_id?.toString() === currentDeptId || !t.department_id;
                if (!isDeptMatch) return false;
                if (currentClassId) {
                  if ((t.class_ids || []).some(cid => cid.toString() === currentClassId)) return true;
                  if (t.department_id && t.department_id.toString() === currentDeptId && (!(t.class_ids || []).length)) return true;
                  if (!t.department_id && (!(t.class_ids || []).length)) return true;
                  return false;
                }
                return true;
              }).map(t => (
                <option key={t.id} value={t.id.toString()}>{t.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">Status</label>
            <select
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold"
              value={analyzerStatusFilter}
              onChange={e => setAnalyzerStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Students</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Not Registered</option>
            </select>
          </div>
        </div>

        {/* Visualization Section */}
        <div className="px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-zinc-50/20 border-b border-zinc-100">
          <div className="lg:col-span-1 flex justify-center items-center bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm">
            <CircularProgress
              value={completedCount}
              total={enriched.length}
              label="Overall Completion"
              color="text-emerald-500"
              size="lg"
            />
          </div>
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm min-h-[200px]">
            {analyzerTaskFilter ? (
              <SimpleBarChart
                label="Class-wise Completion"
                color="bg-emerald-500"
                data={(() => {
                  const classMap = new Map();
                  enriched.forEach(s => {
                    const cls = s.clsName || 'Unknown';
                    if (!classMap.has(cls)) classMap.set(cls, { value: 0, total: 0 });
                    const stats = classMap.get(cls);
                    stats.total++;
                    if (s.submissionStatus === 'VERIFIED' || s.submissionStatus === 'SUBMITTED') stats.value++;
                  });
                  return Array.from(classMap.entries()).map(([label, stats]) => ({ label, ...stats }));
                })()}
              />
            ) : (
              <SimpleBarChart
                label="Event-wise Performance"
                color="bg-indigo-500"
                data={tasks.filter(t => {
                  const isDeptMatch = !currentDeptId || t.department_id?.toString() === currentDeptId || !t.department_id;
                  if (!isDeptMatch) return false;
                  if (currentClassId) return (t.class_ids || []).some(cid => cid.toString() === currentClassId);
                  return true;
                }).slice(0, 10).map(t => {
                  const taskSubmissions = submissions.filter(s => s.task_id?.toString() === t.id.toString());
                  const relevantStudents = enriched.filter(s => {
                    if (t.class_ids?.length > 0) return t.class_ids.some(cid => cid.toString() === s.class_id?.toString());
                    if (t.department_id) return t.department_id.toString() === s.department_id?.toString();
                    return true;
                  });
                  const done = relevantStudents.filter(s => {
                    const sub = taskSubmissions.find(sub => sub.user_id?.toString() === s.id.toString());
                    return sub && (sub.status === 'VERIFIED' || sub.status === 'SUBMITTED');
                  }).length;
                  return { label: t.title, value: done, total: Math.max(relevantStudents.length, done) };
                })}
              />
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="px-8 py-3 flex flex-wrap gap-3 border-b border-zinc-100 bg-zinc-50/30">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-zinc-200">
              <span className="text-[11px] font-black">{enriched.length} Students</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <span className="text-[11px] font-black text-emerald-700">{completedCount} Done</span>
            </div>
            <div className="flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
              <span className="text-[11px] font-black text-red-700">{pendingCount} Not Register</span>
            </div>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/40">
                <th className="px-8 py-3 text-[10px] uppercase font-black text-zinc-400">Student</th>
                <th className="px-4 py-3 text-[10px] uppercase font-black text-zinc-400 text-center">Status</th>
                <th className="px-8 py-3 text-[10px] uppercase font-black text-zinc-400 text-right">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map(student => {
                const isCompleted = student.submissionStatus === 'VERIFIED' || student.submissionStatus === 'SUBMITTED';
                return (
                  <tr key={student.id} className="hover:bg-zinc-50/50 transition-colors text-sm">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900">{student.full_name}</span>
                        {!analyzerClassFilter && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-500 text-[9px] font-black rounded uppercase border border-indigo-100">
                            {student.clsName}
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-400 font-mono italic">{student.register_number}</span>
                      </div>
                      {!analyzerTaskFilter && student.missingTasks && student.missingTasks.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="text-[9px] text-zinc-400 font-bold uppercase mr-1">Missing:</span>
                          {student.missingTasks.slice(0, 3).map((t: any) => (
                            <span key={t.id} className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded text-[9px] font-medium">{t.title}</span>
                          ))}
                          {student.missingTasks.length > 3 && <span className="text-[9px] text-zinc-400">+{student.missingTasks.length - 3} more</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border",
                        student.submissionStatus === 'VERIFIED' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                          student.submissionStatus === 'SUBMITTED' ? "bg-amber-50 text-amber-700 border-amber-100" :
                            "bg-red-50 text-red-600 border-red-100"
                      )}>
                        {student.submissionStatus === 'SUBMITTED' && !analyzerTaskFilter ? 'In Progress' :
                          student.submissionStatus === 'SUBMITTED' && analyzerTaskFilter ? 'Submitted' :
                            student.submissionLabel}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right font-black text-zinc-400">
                      {(() => {
                        if (analyzerTaskFilter) return isCompleted ? '100%' : '0%';
                        const parts = student.submissionLabel.split('/');
                        if (parts.length < 2) return '0%';
                        const done = parseInt(parts[0].trim());
                        const total = parseInt(parts[1].trim().split(' ')[0]);
                        if (isNaN(done) || isNaN(total) || total === 0) return '0%';
                        return `${Math.min(100, Math.round((done / total) * 100))}%`;
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const isAdvisor = user?.role === 'CLASS_ADVISOR';
  const isStudent = user?.role === 'STUDENT';
  const isCoordinator = user?.role === 'STUDENT' && user?.is_coordinator;

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#F5F5F4] font-sans text-zinc-900 overflow-hidden">
        <div className="w-64 bg-white border-r border-zinc-200 flex flex-col">
          <div className="p-6 border-b border-zinc-100 mb-4">
            <Skeleton className="h-8 w-3/4" />
          </div>
          <div className="px-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="flex-1 p-8 flex flex-col gap-6">
          <Skeleton className="h-12 w-48 mb-2" />
          <div className="grid grid-cols-4 gap-6">
            <Skeleton className="h-32 w-full rounded-2xl bg-white border border-zinc-200" />
            <Skeleton className="h-32 w-full rounded-2xl bg-white border border-zinc-200" />
            <Skeleton className="h-32 w-full rounded-2xl bg-white border border-zinc-200" />
            <Skeleton className="h-32 w-full rounded-2xl bg-white border border-zinc-200" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl bg-white border border-zinc-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F5F5F4] flex overflow-hidden">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectionModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-4">Reject Submission</h2>
              <textarea
                className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all min-h-[100px] mb-4"
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                required
              />
              <div className="flex gap-4">
                <Button variant="ghost" className="flex-1" onClick={() => setShowRejectionModal(null)}>Cancel</Button>
                <Button variant="danger" className="flex-1" onClick={() => verifySubmission(showRejectionModal, 'REJECTED')}>Reject</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTaskPreview && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl relative"
            >
              <button
                onClick={() => setShowTaskPreview(false)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                <XCircle size={24} />
              </button>
              <h2 className="text-2xl font-bold mb-2">Live Preview</h2>
              <p className="text-zinc-500 text-sm mb-6">This is exactly what students will see.</p>

              <Card className="border-2 border-zinc-100 bg-zinc-50/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">
                      {newTask.category}
                    </span>
                    <h3 className="text-xl font-bold text-zinc-900">{newTask.title || "Untitled Task"}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-400 uppercase font-bold">Deadline</p>
                    <p className="text-sm font-medium text-red-500">
                      {newTask.deadline ? new Date(newTask.deadline).toLocaleString() : "No deadline set"}
                    </p>
                  </div>
                </div>
                <p className="text-zinc-600 text-sm mb-6 whitespace-pre-wrap">{newTask.description || "No description provided."}</p>

                {newTask.external_link && (
                  <div className="mb-6">
                    <a
                      href={newTask.external_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium"
                    >
                      <ExternalLink size={16} /> Visit External Link
                    </a>
                  </div>
                )}

                <div className="bg-white p-6 rounded-xl border border-zinc-200 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-zinc-700 mb-2 block">
                      {newTask.custom_field_label || "Custom Field"}
                    </label>
                    <Input placeholder={`Enter ${newTask.custom_field_label || "value"}...`} disabled />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-zinc-700 mb-2 block">
                      {newTask.screenshot_instruction || "Upload Screenshot"}
                    </label>
                    <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 flex flex-col items-center justify-center text-zinc-400 bg-zinc-50">
                      <Upload size={32} className="mb-2" />
                      <p className="text-sm">Click or drag to upload screenshot</p>
                    </div>
                  </div>
                  <Button className="w-full" disabled>Submit Task</Button>
                </div>
              </Card>

              <div className="mt-8 flex gap-4">
                <Button variant="secondary" className="flex-1" onClick={() => setShowTaskPreview(false)}>Back to Edit</Button>
                <Button className="flex-1" onClick={() => { createTask(); setShowTaskPreview(false); }}>Publish Task</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center mb-4">
                  <ShieldCheck size={32} />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900">Change Password</h2>
                <p className="text-zinc-500 mt-2">For security reasons, you must change your default password on first login.</p>
              </div>
              <form onSubmit={changePassword} className="space-y-4">
                <Input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
                <Button className="w-full py-3 text-lg">Update Password</Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-6 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white w-4 h-4" />
            </div>
            <span className={cn(
              "font-bold px-2 py-0.5 rounded text-xs tracking-wider",
              user?.is_year_coordinator
                ? "bg-indigo-100 text-indigo-700"
                : "text-zinc-900"
            )}>
              {isAdmin ? 'SUPREME' : isHOD ? 'HOD PORTAL' : user?.is_year_coordinator ? 'YEAR COORD' : isAdvisor ? 'ADVISOR' : isCoordinator ? 'COORDINATOR' : 'STUDENT'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active={view === 'dashboard'}
            onClick={() => setView('dashboard')}
          />

          {isAdmin && (
            <>
              <SidebarItem
                icon={<Building2 size={20} />}
                label="Departments"
                active={view === 'departments'}
                onClick={() => setView('departments')}
              />
              <SidebarItem
                icon={<Users size={20} />}
                label="HOD Accounts"
                active={view === 'users'}
                onClick={() => setView('users')}
              />
            </>
          )}

          {isHOD && (
            <>
              <SidebarItem
                icon={<Building2 size={20} />}
                label="Classes"
                active={view === 'classes'}
                onClick={() => setView('classes')}
              />
              <SidebarItem
                icon={<Users size={20} />}
                label="Class Advisors"
                active={view === 'users'}
                onClick={() => setView('users')}
              />
            </>
          )}

          {isAdvisor && (
            <>
              <SidebarItem
                icon={<Building2 size={20} />}
                label="My Class"
                active={view === 'my-class'}
                onClick={() => setView('my-class')}
              />
              <SidebarItem
                icon={<Users size={20} />}
                label="Students"
                active={view === 'users'}
                onClick={() => setView('users')}
              />
            </>
          )}

          <SidebarItem
            icon={<ClipboardList size={20} />}
            label="Tasks"
            active={view === 'tasks'}
            onClick={() => setView('tasks')}
          />

          {(isAdvisor || isHOD || isAdmin || isCoordinator) && (
            <SidebarItem
              icon={<ShieldCheck size={20} />}
              label="Verifications"
              active={view === 'verifications'}
              onClick={() => setView('verifications')}
            />
          )}

          {isStudent && (
            <>
              <SidebarItem
                icon={<CheckCircle2 size={20} />}
                label="My Submissions"
                active={view === 'submissions'}
                onClick={() => setView('submissions')}
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="px-4 py-2 mb-4">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Logged in as</p>
            <p className="text-sm font-medium text-zinc-900 truncate">{user?.full_name}</p>
            <p className="text-[10px] text-zinc-500">
              {user?.is_year_coordinator ? `Year ${user.year_scope} Coordinator` : user?.role}
              {user?.department_name ? ` • ${user.department_name}` : ''}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <header className="bg-white border-b border-zinc-200 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-10 w-full shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 capitalize">{view}</h2>
            <p className="text-sm text-zinc-500">Academic Management System</p>
          </div>
          <div className="flex items-center gap-4">
            {isHOD && (
              <Button variant="success" className="flex items-center gap-2" onClick={() => setShowExportModal(true)}>
                <FileDown size={18} /> Export Custom Report
              </Button>
            )}
            {(isAdvisor || isCoordinator) && (
              <Button variant="success" className="flex items-center gap-2" onClick={() => setShowExportModal(true)}>
                <FileDown size={18} /> Export Class Report
              </Button>
            )}
            <div className="flex-1" />
            <div className="relative group">
              <button
                className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors relative"
                onClick={markNotificationsRead}
              >
                <Bell size={20} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>
              <div className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-4">
                <h3 className="text-sm font-bold mb-3">Notifications</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-4">No notifications yet</p>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={cn("p-3 rounded-lg text-xs", n.is_read ? "bg-zinc-50" : "bg-blue-50 border border-blue-100")}>
                        <p className="text-zinc-900 mb-1">{n.message}</p>
                        <p className="text-[10px] text-zinc-400">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {isAdmin ? (
                  <UnifiedAnalyzer role="SUPREME_ADMIN" title="Global System Analyzer" />
                ) : isHOD ? (
                  <div className="flex flex-col gap-10">
                    {/* Premium Header Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Building2 size={24} />
                          </div>
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-widest">Departments</span>
                        </div>
                        <p className="text-3xl font-black text-zinc-900">{hodStats?.total_classes || 0}</p>
                        <p className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-tighter">Active Dept. Classes</p>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                            <Users size={24} />
                          </div>
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-widest">Advisors</span>
                        </div>
                        <p className="text-3xl font-black text-zinc-900">{hodStats?.total_advisors || 0}</p>
                        <p className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-tighter">Dept. Class Advisors</p>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                            <Users size={24} />
                          </div>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-widest">Students</span>
                        </div>
                        <p className="text-3xl font-black text-zinc-900">{hodStats?.total_students || 0}</p>
                        <p className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-tighter">Total Dept. Enrollment</p>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                            <ClipboardList size={24} />
                          </div>
                          <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-full uppercase tracking-widest">Tasks</span>
                        </div>
                        <p className="text-3xl font-black text-zinc-900">{hodStats?.taskStats?.length || 0}</p>
                        <p className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-tighter">Tasks Under Oversight</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                      {/* Left Column: Quick Actions & Overview */}
                      <div className="lg:col-span-4 space-y-10">
                        <Card className="bg-zinc-900 border-none text-white p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
                          <div className="relative z-10">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 mb-8 flex items-center gap-3">
                              <ShieldCheck size={20} className="text-blue-400" /> Command Center
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                              <button onClick={() => setView('classes')} className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group/btn">
                                <div className="flex items-center gap-4">
                                  <Building2 size={20} className="text-blue-400" />
                                  <span className="text-sm font-bold">Manage Classes</span>
                                </div>
                                <ChevronRight size={16} className="text-zinc-600 group-hover/btn:translate-x-1 transition-transform" />
                              </button>
                              <button onClick={() => setView('users')} className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group/btn">
                                <div className="flex items-center gap-4">
                                  <Users size={20} className="text-emerald-400" />
                                  <span className="text-sm font-bold">Advisors & Students</span>
                                </div>
                                <ChevronRight size={16} className="text-zinc-600 group-hover/btn:translate-x-1 transition-transform" />
                              </button>
                              <button onClick={() => setView('tasks')} className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group/btn">
                                <div className="flex items-center gap-4">
                                  <ClipboardList size={20} className="text-orange-400" />
                                  <span className="text-sm font-bold">Dept. Task Master</span>
                                </div>
                                <ChevronRight size={16} className="text-zinc-600 group-hover/btn:translate-x-1 transition-transform" />
                              </button>
                              <button onClick={() => setShowExportModal(true)} className="w-full flex items-center justify-between p-4 bg-blue-600 hover:bg-blue-500 rounded-2xl transition-all border border-blue-400/20 group/btn mt-4">
                                <div className="flex items-center gap-4">
                                  <FileDown size={20} className="text-white" />
                                  <span className="text-sm font-bold">Generate Reports</span>
                                </div>
                                <ChevronRight size={16} className="text-white/50 group-hover/btn:translate-x-1 transition-transform" />
                              </button>
                            </div>
                          </div>
                        </Card>

                      </div>

                      {/* Right Column: Unified Department Analyzer */}
                      <div className="lg:col-span-8 space-y-8">
                        <UnifiedAnalyzer role="HOD" title="Department Analyzer" />
                      </div>
                    </div>
                  </div>
                ) : user?.is_year_coordinator ? (
                  <div className="flex flex-col gap-10">
                    {/* Coordinator Header Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Building2 size={24} />
                          </div>
                          <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-widest">Year Classes</span>
                        </div>
                        <p className="text-3xl font-black text-zinc-900">{yearStats?.total_classes || 0}</p>
                        <p className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-tighter">Oversight for Year {user.year_scope}</p>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                            <Users size={24} />
                          </div>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full uppercase tracking-widest">Year Enrollment</span>
                        </div>
                        <p className="text-3xl font-black text-zinc-900">{yearStats?.total_students || 0}</p>
                        <p className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-tighter">Total Students in Year</p>
                      </div>

                      <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 group-hover:scale-110 transition-transform">
                            <ClipboardList size={24} />
                          </div>
                          <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-full uppercase tracking-widest">Year Events</span>
                        </div>
                        <p className="text-3xl font-black text-zinc-900">{yearStats?.taskStats?.length || 0}</p>
                        <p className="text-xs font-bold text-zinc-400 mt-1 uppercase tracking-tighter">Active Year-wide Tasks</p>
                      </div>
                    </div>

                    <UnifiedAnalyzer role="YEAR_COORDINATOR" title={`Year ${user.year_scope} Oversight Analyzer`} />

                    {/* Secondary Class View if Advisor */}
                    {isAdvisor && (
                      <div className="mt-10 pt-10 border-t border-zinc-200">
                        <div className="flex items-center gap-4 mb-8">
                          <div className="w-1 h-8 bg-zinc-300 rounded-full" />
                          <h3 className="text-xl font-bold text-zinc-600">My Class Dashboard</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <StatCard title="Class Students" value={users.filter(u => u.role === 'STUDENT' && u.class_id?.toString() === user?.class_id?.toString()).length} icon={<Users />} color="bg-blue-500" />
                          <StatCard title="Submitted" value={new Set(submissions.filter(s => s.status === 'SUBMITTED' && s.class_id?.toString() === user?.class_id?.toString()).map(s => `${s.user_id}-${s.task_id}`)).size} icon={<Clock />} color="bg-orange-500" />
                          <StatCard title="Verified" value={new Set(submissions.filter(s => s.status === 'VERIFIED' && s.class_id?.toString() === user?.class_id?.toString()).map(s => `${s.user_id}-${s.task_id}`)).size} icon={<CheckCircle2 />} color="bg-emerald-500" />
                        </div>
                        <div className="mt-8">
                          <UnifiedAnalyzer role="CLASS_ADVISOR" title="Class Performance Analyzer" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : isAdvisor ? (
                  <div className="flex flex-col gap-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <StatCard title="Class Students" value={users.filter(u => u.role === 'STUDENT' && u.class_id?.toString() === user?.class_id?.toString()).length} icon={<Users />} color="bg-blue-500" />
                      <StatCard title="Submitted" value={new Set(submissions.filter(s => s.status === 'SUBMITTED' && s.class_id?.toString() === user?.class_id?.toString()).map(s => `${s.user_id}-${s.task_id}`)).size} icon={<Clock />} color="bg-orange-500" />
                      <StatCard title="Verified" value={new Set(submissions.filter(s => s.status === 'VERIFIED' && s.class_id?.toString() === user?.class_id?.toString()).map(s => `${s.user_id}-${s.task_id}`)).size} icon={<CheckCircle2 />} color="bg-emerald-500" />
                    </div>
                    <UnifiedAnalyzer role="CLASS_ADVISOR" title="Class Performance Analyzer" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <StatCard title="Total Assigned Tasks" value={studentStats?.total_tasks || 0} icon={<ClipboardList />} color="bg-blue-500" />
                      <StatCard title="Submitted" value={studentStats?.submitted_tasks || 0} icon={<Clock />} color="bg-orange-500" />
                      <StatCard title="Verified" value={studentStats?.verified_tasks || 0} icon={<CheckCircle2 />} color="bg-emerald-500" />
                    </div>
                    {isCoordinator && (
                      <div className="space-y-6">
                        <div
                          className="bg-zinc-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer hover:bg-black transition-all group"
                          onClick={() => setView('verifications')}
                        >
                          <div className="flex items-center gap-6 text-center md:text-left">
                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                              <ShieldCheck size={32} className="text-white" />
                            </div>
                            <div>
                              <h3 className="text-2xl font-bold">Coordinator Workspace</h3>
                              <p className="text-zinc-400">Manage and verify peer submissions for your class.</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-center md:items-end">
                            <span className="text-4xl font-black">{submissions.filter(s => s.status === 'SUBMITTED' && s.class_id === user?.class_id).length}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Pending Tasks</span>
                          </div>
                        </div>
                        <UnifiedAnalyzer role="COORDINATOR" title="Class Achievement Analyzer" />
                      </div>
                    )}
                  </div>
                )}

                {/* Removed redundant HOD Stats section */}

                <Card>
                  <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    {tasks.slice(0, 5).map(task => (
                      <div key={task.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
                        <div>
                          <p className="font-medium text-zinc-900">{task.title}</p>
                          <p className="text-xs text-zinc-500">
                            {Array.isArray(task.class_ids) && task.class_ids.length > 0
                              ? task.class_ids.map(id => classes.find(c => c.id.toString() === id.toString())?.name || id).join(', ')
                              : (task.department_name || 'Global Task')
                            } • {new Date(task.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium",
                          task.status === 'OPEN' ? "bg-emerald-50 text-emerald-600" : "bg-zinc-200 text-zinc-600"
                        )}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {view === 'departments' && isAdmin && (
              <motion.div
                key="departments"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <h3 className="text-lg font-semibold mb-4">Create New Department</h3>
                  <form onSubmit={createDepartment} className="flex gap-4">
                    <Input
                      placeholder="e.g. Computer Science & Engineering"
                      value={newDept}
                      onChange={e => setNewDept(e.target.value)}
                      required
                    />
                    <Button className="whitespace-nowrap flex items-center gap-2">
                      <Plus size={18} /> Create
                    </Button>
                  </form>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map(dept => (
                    <Card key={dept.id} className="flex items-center justify-between group">
                      <div>
                        <p className="font-bold text-zinc-900">{dept.name}</p>
                        <p className="text-xs text-zinc-500">ID: {dept.id}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Delete department?')) {
                            fetch(`${API_URL}/api/departments/${dept.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(() => fetchInitialData());
                          }
                        }}
                        className="p-2 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'classes' && isHOD && (
              <motion.div
                key="classes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <h3 className="text-lg font-bold mb-4">Add New Class</h3>
                  <form onSubmit={createClass} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Class Name</label>
                        <Input
                          placeholder="e.g. CSE-A"
                          value={newClass.name}
                          onChange={e => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Year</label>
                        <Input
                          type="number"
                          placeholder="e.g. 3"
                          value={newClass.year}
                          onChange={e => setNewClass(prev => ({ ...prev, year: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Batch Period</label>
                        <Input
                          placeholder="e.g. 2023-2027"
                          value={newClass.batch}
                          onChange={e => setNewClass(prev => ({ ...prev, batch: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <Button className="w-full flex items-center justify-center gap-2">
                      <Plus size={18} /> Add New Class to Department
                    </Button>
                  </form>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map(c => (
                    <Card key={c.id} className="relative overflow-hidden group border-zinc-200 hover:border-blue-500 transition-colors">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 -mr-4 -mt-4 rounded-full" />
                      <div className="flex flex-col h-full">
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                            <Building2 size={20} />
                          </div>
                          <button
                            onClick={() => {
                              if (confirm('Are you sure? This will delete all students and tasks associated with this class.')) {
                                fetch(`${API_URL}/api/classes/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(() => fetchInitialData());
                              }
                            }}
                            className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <h4 className="font-black text-lg text-zinc-900 mb-1">{c.name}</h4>
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-tight">
                          <span>Year {c.year}</span>
                          <span className="w-1 h-1 bg-zinc-300 rounded-full" />
                          <span>{c.batch}</span>
                        </div>
                        <div className="mt-auto pt-6 flex items-center justify-between text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          <span>Class ID: {c.id}</span>
                          <span className="px-2 py-0.5 bg-zinc-100 rounded text-zinc-500">Department Pool</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'my-class' && isAdvisor && (
              <motion.div
                key="my-class"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <Card>
                  <h3 className="text-lg font-semibold mb-4">Class Details</h3>
                  <form onSubmit={createClass} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Class Name</label>
                        <Input
                          placeholder="e.g. CSE-A"
                          value={newClass.name || myClass?.name || ''}
                          onChange={e => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Year</label>
                        <Input
                          type="number"
                          placeholder="e.g. 3"
                          value={newClass.year || myClass?.year || ''}
                          onChange={e => setNewClass(prev => ({ ...prev, year: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Batch</label>
                        <Input
                          placeholder="e.g. 2023-2027"
                          value={newClass.batch || myClass?.batch || ''}
                          onChange={e => setNewClass(prev => ({ ...prev, batch: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <Button className="flex items-center gap-2">
                      <Plus size={18} /> Update Class Info
                    </Button>
                  </form>
                </Card>

                {myClass && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Class Name" value={myClass.name as any} icon={<Building2 />} color="bg-blue-500" />
                    <StatCard title="Year" value={myClass.year as any} icon={<ClipboardList />} color="bg-emerald-500" />
                    <StatCard title="Batch" value={myClass.batch as any} icon={<Users />} color="bg-purple-500" />
                  </div>
                )}
              </motion.div>
            )}

            {view === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                  <h3 className="text-xl font-bold text-zinc-900">
                    {isAdmin ? 'All Users' : isHOD ? 'Class Advisors & Students' : 'Students'}
                  </h3>
                  {/* SA Filters */}
                  {isAdmin && (
                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                      <select
                        className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-black/10"
                        value={userRoleFilter}
                        onChange={e => { setUserRoleFilter(e.target.value); setUserPage(1); }}
                      >
                        <option value="">All Roles</option>
                        <option value="HOD">HOD</option>
                        <option value="CLASS_ADVISOR">Class Advisor</option>
                        <option value="STUDENT">Student</option>
                      </select>
                      <select
                        className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-black/10"
                        value={userDeptFilter}
                        onChange={e => { setUserDeptFilter(e.target.value); setUserPage(1); }}
                      >
                        <option value="">All Departments</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {isHOD && (
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                      <div className="bg-zinc-100 p-1 rounded-xl flex">
                        {['ALL', 'CLASS_ADVISOR', 'STUDENT'].map(filter => (
                          <button
                            key={filter}
                            onClick={() => setStudentFilter(filter as any)}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex-1",
                              studentFilter === filter ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                            )}
                          >
                            {filter === 'CLASS_ADVISOR' ? 'Advisors' : filter === 'STUDENT' ? 'Students' : 'All'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {isAdvisor && (
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                      <div className="bg-zinc-100 p-1 rounded-xl flex">
                        {['ALL', 'ACTIVE', 'COORDINATORS'].map(filter => (
                          <button
                            key={filter}
                            onClick={() => setStudentFilter(filter as any)}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex-1",
                              studentFilter === filter ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                            )}
                          >
                            {filter.charAt(0) + filter.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                      <label
                        className={cn(
                          "cursor-pointer flex-shrink-0 relative group border-2 border-dashed rounded-xl transition-all",
                          isDraggingExcel ? "border-blue-500 bg-blue-50 scale-105" : "border-transparent"
                        )}
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingExcel(true); }}
                        onDragLeave={() => setIsDraggingExcel(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingExcel(false);
                          const file = e.dataTransfer.files[0];
                          if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                            handleBulkImport({ target: { files: [file] } } as any);
                          } else {
                            alert('Please drop a valid Excel file (.xlsx or .xls)');
                          }
                        }}
                      >
                        <input type="file" accept=".xlsx, .xls" className="hidden" onClick={(e: any) => { e.target.value = ''; }} onChange={handleBulkImport} />
                        <div className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 px-4 py-2 rounded-lg font-medium transition-all active:scale-95 flex items-center justify-center gap-2 w-full h-full pr-10 relative overflow-visible">
                          <Upload size={18} /> Import Excel
                          <div
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-blue-500 transition-colors"
                            title="Excel Format Rules: Must have columns 'Register Number' and 'Name'. Optional 'Email'. Register numbers should be plain text, avoid scientific notation."
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); alert("Excel Rules:\n1. Column headers must include 'Register Number' (or Reg No) and 'Name'.\n2. Do NOT add trailing spaces or zeroes to IDs.\n3. Make sure ID columns are formatted as Text in Excel to prevent auto-zeroes."); }}
                          >
                            <Info size={16} />
                          </div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      placeholder={`Search ${isAdmin ? 'HODs' : isHOD ? 'Advisors or Students' : 'Students'} by name or registration number...`}
                      className="pl-10"
                      value={searchTerm}
                      onChange={e => { setSearchTerm(e.target.value); setUserPage(1); }}
                    />
                  </div>
                </div>

                <Card>
                  <h3 className="text-lg font-semibold mb-4">
                    {isAdvisor ? 'Add Student' : `Create ${isAdmin ? 'HOD' : 'Advisor'} Account`}
                  </h3>
                  <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder={isAdvisor ? "Register Number" : "Username"}
                      value={newUser.username}
                      onChange={e => setNewUser(prev => ({ ...prev, username: e.target.value, register_number: isAdvisor ? e.target.value : '' }))}
                      required
                    />
                    {!isAdvisor && (
                      <Input
                        type="password"
                        placeholder="Password"
                        value={newUser.password}
                        onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                        required
                      />
                    )}
                    <Input
                      placeholder="Full Name"
                      value={newUser.full_name}
                      onChange={e => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
                      required
                    />
                    {isAdvisor && (
                      <Input
                        type="email"
                        placeholder="Email Address"
                        value={newUser.email}
                        onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    )}
                    {isAdmin ? (
                      <select
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all bg-white"
                        value={newUser.department_id}
                        onChange={e => setNewUser(prev => ({ ...prev, department_id: e.target.value }))}
                        required
                      >
                        <option value="">Select Department</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    ) : isHOD ? (
                      <select
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all bg-white"
                        value={newUser.class_id}
                        onChange={e => setNewUser(prev => ({ ...prev, class_id: e.target.value }))}
                        required
                      >
                        <option value="">Select Class</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : null}

                    {isHOD && newUser.role === 'CLASS_ADVISOR' && (
                      <div className="md:col-span-2 p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <label className="text-sm font-bold text-zinc-900">Assign as Year Coordinator</label>
                            <p className="text-xs text-zinc-500">Enable this to allow this advisor to post tasks for an entire year.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNewUser(prev => ({ ...prev, is_year_coordinator: !prev.is_year_coordinator }))}
                            className={cn(
                              "w-12 h-6 rounded-full transition-colors relative",
                              newUser.is_year_coordinator ? "bg-black" : "bg-zinc-200"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              newUser.is_year_coordinator ? "right-1" : "left-1"
                            )} />
                          </button>
                        </div>

                        {newUser.is_year_coordinator && (
                          <div className="pt-2 border-t border-zinc-200">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-2">Coordinator Year</label>
                            <Input
                              type="number"
                              placeholder="e.g. 3"
                              value={newUser.year_scope}
                              onChange={e => setNewUser(prev => ({ ...prev, year_scope: e.target.value }))}
                              required={newUser.is_year_coordinator}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <Button className="md:col-span-2 flex items-center justify-center gap-2">
                      <Plus size={18} /> {isAdvisor ? 'Add Student' : 'Create Account'}
                    </Button>
                  </form>
                </Card>

                <Card className="overflow-hidden p-0">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b border-zinc-200">
                      <tr>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          {isAdvisor ? 'Register No' : 'Username'}
                        </th>
                        {isAdvisor && <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Email</th>}
                        {!isAdvisor && <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{isAdmin ? 'Department' : 'Class'}</th>}
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {(() => {
                        const filtered = users
                          .filter(u => {
                            if (isAdmin) {
                              if (userRoleFilter && u.role !== userRoleFilter) return false;
                              if (userDeptFilter && u.department_id?.toString() !== userDeptFilter.toString()) return false;
                              return u.role !== 'SUPREME_ADMIN'; // Don't show SA itself
                            }
                            if (isAdvisor) {
                              if (studentFilter === 'ACTIVE') return u.is_active;
                              if (studentFilter === 'COORDINATORS') return u.is_coordinator;
                            } else if (isHOD) {
                              if (studentFilter === 'CLASS_ADVISOR') return u.role === 'CLASS_ADVISOR';
                              if (studentFilter === 'STUDENT') return u.role === 'STUDENT';
                            }
                            return true;
                          })
                          .filter(u => {
                            if (!searchTerm) return true;
                            const query = searchTerm.toLowerCase();
                            return u.full_name?.toLowerCase().includes(query) || (u.register_number || u.username).toLowerCase().includes(query) || u.department_name?.toLowerCase().includes(query);
                          });

                        const totalPages = Math.ceil(filtered.length / itemsPerPage);
                        const paginated = filtered.slice((userPage - 1) * itemsPerPage, userPage * itemsPerPage);

                        return (
                          <>
                            {paginated.map(u => (
                              <tr key={u.id} className={cn("hover:bg-zinc-50 transition-colors", !u.is_active && "opacity-50 grayscale")}>
                                <td className="px-6 py-4 font-medium text-zinc-900">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {u.full_name}
                                    {u.is_year_coordinator && (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm animate-in fade-in zoom-in duration-300">
                                        <CalendarRange size={12} />
                                        Year {u.year_scope} Overall Coord
                                      </span>
                                    )}
                                    {!!u.is_coordinator && (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase whitespace-nowrap">Class Coord</span>
                                    )}
                                    {isAdmin && (
                                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap",
                                        u.role === 'HOD' ? 'bg-blue-100 text-blue-700' :
                                          u.role === 'CLASS_ADVISOR' ? 'bg-purple-100 text-purple-700' :
                                            'bg-zinc-100 text-zinc-600'
                                      )}>{u.role === 'CLASS_ADVISOR' ? 'Advisor' : u.role}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-zinc-500">{u.register_number || u.username}</td>
                                {isAdvisor && <td className="px-6 py-4 text-zinc-500">{u.email}</td>}
                                {!isAdvisor && (
                                  <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-zinc-100 rounded text-xs text-zinc-600">
                                      {isAdmin ? (u.department_name || '—') : u.class_name}
                                    </span>
                                  </td>
                                )}
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight",
                                    u.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                  )}>
                                    {u.is_active ? 'Active' : 'Deactivated'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    {isAdvisor && (
                                      <Button
                                        variant="ghost"
                                        className={cn("p-2", u.is_coordinator ? "text-amber-600" : "text-zinc-400")}
                                        onClick={() => toggleCoordinator(u.id, u.is_coordinator || false)}
                                        title={u.is_coordinator ? "Remove Coordinator" : "Make Coordinator"}
                                      >
                                        <ShieldCheck size={18} />
                                      </Button>
                                    )}
                                    {isHOD && u.role === 'CLASS_ADVISOR' && (
                                      <Button
                                        variant="ghost"
                                        className={cn("p-2", u.is_year_coordinator ? "text-indigo-600" : "text-zinc-400")}
                                        onClick={() => toggleYearCoordinator(u.id, u.is_year_coordinator || false, u.year_scope)}
                                        title={u.is_year_coordinator ? "Remove Year Coordinator" : "Assign Year Coordinator"}
                                      >
                                        <CalendarRange size={18} />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      className="p-2 text-zinc-400 hover:text-blue-600"
                                      onClick={() => resetPassword(u.id)}
                                      title="Reset Password"
                                    >
                                      <ShieldCheck size={18} className="text-blue-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      className="p-2 text-zinc-400 hover:text-blue-600"
                                      onClick={() => toggleUserStatus(u.id, u.is_active !== false)}
                                      title={u.is_active !== false ? "Deactivate" : "Activate"}
                                    >
                                      {u.is_active !== false ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                                    </Button>
                                    <button
                                      onClick={async () => {
                                        const roleLabel = u.role === 'CLASS_ADVISOR' ? 'Advisor' : u.role === 'HOD' ? 'HOD' : 'User';
                                        if (confirm(`Delete ${roleLabel} ${u.full_name}? This cannot be undone.`)) {
                                          const res = await fetch(`${API_URL}/api/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                                          if (res.ok) {
                                            fetchInitialData();
                                            addToast(`${roleLabel} deleted successfully.`, 'success');
                                          } else {
                                            const data = await res.json();
                                            addToast(data.error || 'Failed to delete user', 'error');
                                          }
                                        }
                                      }}
                                      className="p-2 transition-colors text-zinc-400 hover:text-red-500"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {filtered.length > itemsPerPage && (
                              <tr>
                                <td colSpan={6} className="px-6 py-4">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-zinc-500">
                                      Showing {(userPage - 1) * itemsPerPage + 1} to {Math.min(userPage * itemsPerPage, filtered.length)} of {filtered.length} entries
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="secondary"
                                        className="px-3 py-1 text-xs"
                                        disabled={userPage === 1}
                                        onClick={() => setUserPage(prev => prev - 1)}
                                      >
                                        Previous
                                      </Button>
                                      <div className="flex gap-1">
                                        {Array.from({ length: totalPages }).map((_, i) => (
                                          <button
                                            key={i}
                                            onClick={() => setUserPage(i + 1)}
                                            className={cn(
                                              "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                              userPage === i + 1 ? "bg-black text-white" : "text-zinc-500 hover:bg-zinc-100"
                                            )}
                                          >
                                            {i + 1}
                                          </button>
                                        ))}
                                      </div>
                                      <Button
                                        variant="secondary"
                                        className="px-3 py-1 text-xs"
                                        disabled={userPage === totalPages}
                                        onClick={() => setUserPage(prev => prev + 1)}
                                      >
                                        Next
                                      </Button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {filtered.length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-sm">
                                  No matching records found.
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </Card>
              </motion.div>
            )}

            {view === 'tasks' && (
              <motion.div
                key="tasks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {(isAdmin || isHOD || isAdvisor || isCoordinator) && (
                  <Card className={cn(
                    "p-8 rounded-[2rem] shadow-sm border transition-all mb-8",
                    user?.is_year_coordinator ? "border-indigo-100 bg-indigo-50/10" : "border-zinc-100 bg-white"
                  )}>
                    <h3 className={cn(
                      "text-xl font-black mb-8 uppercase tracking-tight flex items-center gap-3",
                      user?.is_year_coordinator ? "text-indigo-900" : "text-zinc-900"
                    )}>
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        user?.is_year_coordinator ? "bg-indigo-600 text-white" : "bg-black text-white"
                      )}>
                        <Plus size={20} />
                      </div>
                      {user?.is_year_coordinator ? `Post Year ${user.year_scope} Task` : 'Post New Task'}
                    </h3>
                    <form onSubmit={handleTaskPreview} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Task Title"
                          value={newTask.title}
                          onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                          required
                        />
                        <select
                          className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all bg-white"
                          value={newTask.category}
                          onChange={e => setNewTask(prev => ({ ...prev, category: e.target.value }))}
                          required
                        >
                          <option value="Competition">🏆 Competition</option>
                          <option value="Course">📚 Course</option>
                          <option value="Workshop">🏫 Workshop</option>
                          <option value="College Work">📋 College Work</option>
                        </select>
                        <Input
                          placeholder="External Link (Optional)"
                          value={newTask.external_link}
                          onChange={e => setNewTask(prev => ({ ...prev, external_link: e.target.value }))}
                        />
                        <Input
                          type="datetime-local"
                          value={newTask.deadline}
                          onChange={e => setNewTask(prev => ({ ...prev, deadline: e.target.value }))}
                          required
                        />
                        <Input
                          placeholder="Screenshot Instruction (e.g. Upload registration page)"
                          value={newTask.screenshot_instruction}
                          onChange={e => setNewTask(prev => ({ ...prev, screenshot_instruction: e.target.value }))}
                          required
                        />
                        <Input
                          placeholder="Custom Verification Field Label (e.g. Team ID)"
                          value={newTask.custom_field_label}
                          onChange={e => setNewTask(prev => ({ ...prev, custom_field_label: e.target.value }))}
                          required
                        />

                        {isAdmin && (
                          <select
                            className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all bg-white"
                            value={newTask.department_id || ''}
                            onChange={e => setNewTask(prev => ({ ...prev, department_id: e.target.value, class_ids: [] }))}
                          >
                            <option value="">Global Task (Visible to All)</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        )}

                        {user?.is_year_coordinator && (
                          <div className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                            <p className="text-sm font-bold text-indigo-700 mb-1 flex items-center gap-2">
                              📅 Year {user.year_scope} Coordinator Scope
                            </p>
                            <p className="text-xs text-indigo-600">
                              This task will be automatically assigned to all classes in Year {user.year_scope}.
                            </p>
                          </div>
                        )}

                        {(isAdmin || isHOD || user?.is_year_coordinator) && (
                          <div className="w-full bg-white border border-zinc-200 rounded-lg p-3">
                            <label className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-3 block">
                              {isAdmin ? 'Select Specific Classes (Optional)' :
                                user?.is_year_coordinator ? `Classes in Year ${user.year_scope}` :
                                  'Assign to Classes'}
                            </label>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                              {classes
                                .filter(c => {
                                  if (isAdmin) return !newTask.department_id || c.department_id?.toString() === newTask.department_id?.toString();
                                  if (user?.is_year_coordinator) return c.year === user.year_scope && c.department_id?.toString() === user.department_id?.toString();
                                  return c.department_id?.toString() === user?.department_id?.toString();
                                })
                                .map(c => (
                                  <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-zinc-50 rounded-md cursor-pointer transition-colors border border-transparent hover:border-zinc-200">
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded border-zinc-300 text-black focus:ring-black/20"
                                      checked={(newTask.class_ids || []).includes(c.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setNewTask(prev => ({ ...prev, class_ids: [...(prev.class_ids || []), c.id] }));
                                        } else {
                                          setNewTask(prev => ({ ...prev, class_ids: (prev.class_ids || []).filter(id => id !== c.id) }));
                                        }
                                      }}
                                    />
                                    <span className="text-sm font-medium text-zinc-700">{c.name}</span>
                                  </label>
                                ))}
                            </div>
                            {(newTask.class_ids || []).length === 0 && (
                              <p className="text-xs text-zinc-500 mt-3 bg-zinc-50 p-2 rounded">
                                ℹ️ {user?.is_year_coordinator ? `No specific classes selected. This task will be automatically assigned to ALL Year ${user.year_scope} classes.` :
                                  `No specific classes selected. This task will act as a ${newTask.department_id ? 'Department-Wide' : 'Global'} broadcast to everyone applicable.`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <textarea
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all min-h-[100px]"
                        placeholder="Task Description..."
                        value={newTask.description}
                        onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                        required
                      />
                      <div className="flex gap-4">
                        <Button type="submit" variant="secondary" className="flex-1 flex items-center justify-center gap-2">
                          <ImageIcon size={18} /> Live Preview
                        </Button>
                        <Button type="button" onClick={createTask} className="flex-1 flex items-center justify-center gap-2">
                          <ClipboardList size={18} /> Post Task
                        </Button>
                      </div>
                    </form>
                  </Card>
                )}

                <div className="space-y-4 pb-12">
                  {tasks.map(task => {
                    const submission = submissions.find(s => s.task_id === task.id && s.user_id?.toString() === user?.id?.toString());
                    const isDeadlinePassed = task.deadline && new Date(task.deadline) < new Date();
                    const isWithin24h = task.deadline && !isDeadlinePassed && (new Date(task.deadline).getTime() - new Date().getTime()) < 24 * 60 * 60 * 1000;

                    const categoryColors: Record<string, string> = {
                      'Competition': 'bg-rose-50 text-rose-600 border-rose-100',
                      'Course': 'bg-indigo-50 text-indigo-600 border-indigo-100',
                      'Workshop': 'bg-amber-50 text-amber-600 border-amber-100',
                      'College Work': 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    };
                    const categoryIcons: Record<string, string> = {
                      'Competition': '🏆',
                      'Course': '📚',
                      'Workshop': '🏫',
                      'College Work': '📋'
                    };

                    const catStyle = categoryColors[task.category] || 'bg-zinc-50 text-zinc-600 border-zinc-200';
                    const catIcon = categoryIcons[task.category] || '';

                    return (
                      <Card key={task.id} className="group hover:shadow-md transition-all duration-300">
                        <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1", catStyle)}>
                                {catIcon} {task.category || 'General'}
                              </span>
                              <h4 className="font-bold text-zinc-900 text-lg md:text-xl">{task.title}</h4>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span className="font-medium text-zinc-700">{task.creator_name}</span>
                              <span className="hidden md:inline">•</span>
                              <span>{new Date(task.created_at).toLocaleDateString()}</span>
                              <span className="hidden md:inline">•</span>
                              {Array.isArray(task.class_ids) && task.class_ids.length > 0 ? (
                                <span className="bg-purple-50 text-purple-600 border border-purple-100 flex flex-wrap gap-1 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  {task.class_ids.map(id => classes.find(c => c.id === id)?.name || id).join(', ')}
                                </span>
                              ) : (
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full border border-transparent whitespace-nowrap",
                                  task.department_name ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-orange-50 text-orange-600 border-orange-100"
                                )}>
                                  {task.department_name ? 'Department Task' : 'Global Task'}
                                </span>
                              )}
                              <span className="hidden md:inline">•</span>
                              <span className="bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 whitespace-nowrap border border-zinc-200">
                                <Users size={12} /> {task.submission_count || 0} students submitted
                              </span>
                            </div>
                          </div>
                          <div className="text-left md:text-right shrink-0">
                            <p className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1 md:justify-end">
                              <Clock size={12} /> Deadline
                            </p>
                            <p className={cn(
                              "text-sm font-bold flex flex-col md:items-end",
                              isDeadlinePassed ? "text-red-500" : (isWithin24h ? "text-orange-500" : "text-zinc-600")
                            )}>
                              {task.deadline ? new Date(task.deadline).toLocaleString() : "No deadline"}
                              {isWithin24h && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded mt-1">Due within 24h!</span>}
                            </p>
                          </div>
                        </div>

                        <p className="text-zinc-600 text-sm mb-6 whitespace-pre-wrap">{task.description}</p>

                        {task.external_link && (
                          <div className="mb-6">
                            <a
                              href={task.external_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium"
                            >
                              <ExternalLink size={16} /> Visit External Link
                            </a>
                          </div>
                        )}

                        {isStudent && task.status === 'OPEN' && (
                          <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 mt-6 shadow-sm">
                            {isDeadlinePassed ? (
                              <div className="text-center py-6">
                                <div className="w-12 h-12 bg-zinc-100 text-zinc-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                  <Clock size={24} />
                                </div>
                                <h5 className="font-bold text-zinc-500 mb-1">Uploads Closed</h5>
                                <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                                  The deadline for this task has passed. Submissions are no longer accepted.
                                </p>
                              </div>
                            ) : (
                              (() => {
                                const isLocked = submission?.status === 'REJECTED' && (submission.resubmission_count || 0) >= 2;

                                if (isLocked) {
                                  return (
                                    <div className="text-center py-6">
                                      <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <XCircle size={24} />
                                      </div>
                                      <h5 className="font-bold text-red-600 mb-1">Submission Locked</h5>
                                      <p className="text-sm text-red-500 max-w-sm mx-auto">
                                        You have exceeded the maximum number of resubmissions (2) for this task. It cannot be submitted again.
                                      </p>
                                    </div>
                                  );
                                }

                                if (!submission || submission.status === 'REJECTED') {
                                  return (
                                    <div className="space-y-4">
                                      {submission?.status === 'REJECTED' && (
                                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                                          <p className="font-bold mb-1">Status: Rejected</p>
                                          <p className="mb-1 font-semibold">Reason: {submission.rejection_reason}</p>
                                          <p>Please correct your work and resubmit proof below.</p>
                                        </div>
                                      )}
                                      <div>
                                        <label className="text-sm font-medium text-zinc-700 mb-2 block">
                                          {task.custom_field_label || "Custom Field"}
                                        </label>
                                        <Input
                                          placeholder={`Enter ${task.custom_field_label || "value"}...`}
                                          value={customFieldValue}
                                          onChange={e => setCustomFieldValue(e.target.value)}
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-zinc-700 mb-2 block">
                                          {task.screenshot_instruction || "Upload Screenshot"}
                                        </label>
                                        <div className="flex flex-col gap-4">
                                          <div className="flex items-center gap-4">
                                            <input
                                              type="file"
                                              accept="image/*"
                                              id={`file-${task.id}`}
                                              className="hidden"
                                              onChange={e => handleFileUpload(task.id, e.target.files?.[0] || null)}
                                            />
                                            <div className="flex-1 w-full">
                                              <div
                                                className={cn(
                                                  "relative w-full border-2 border-dashed rounded-xl p-6 md:p-8 flex flex-col items-center justify-center transition-all cursor-pointer group",
                                                  selectedFiles[task.id] ? "border-emerald-500 bg-emerald-50 text-emerald-600" : (isDraggingScreenshot === task.id ? "border-blue-500 bg-blue-50 scale-105" : "border-zinc-200 bg-white text-zinc-400 hover:border-black hover:text-black")
                                                )}
                                                onDragOver={(e) => { e.preventDefault(); setIsDraggingScreenshot(task.id); }}
                                                onDragLeave={() => setIsDraggingScreenshot(null)}
                                                onDrop={(e) => {
                                                  e.preventDefault();
                                                  setIsDraggingScreenshot(null);
                                                  handleFileUpload(task.id, e.dataTransfer.files[0]);
                                                }}
                                                onClick={() => document.getElementById(`file-${task.id}`)?.click()}
                                              >
                                                <input
                                                  type="file"
                                                  id={`file-${task.id}`}
                                                  className="hidden"
                                                  accept="image/*"
                                                  onChange={e => handleFileUpload(task.id, e.target.files?.[0] || null)}
                                                />
                                                {selectedFiles[task.id] ? (
                                                  <>
                                                    <CheckCircle2 size={24} className="mb-2 text-emerald-500" />
                                                    <p className="font-bold text-center text-emerald-700 text-[10px] md:text-sm uppercase tracking-wide">Image Loaded</p>
                                                    <p className="text-[10px] text-emerald-600/70 truncate w-full max-w-[200px] text-center">
                                                      {selectedFiles[task.id].name}
                                                    </p>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Upload size={24} className="mb-2 group-hover:-translate-y-1 transition-transform" />
                                                    <p className="font-bold text-center text-[10px] md:text-sm uppercase tracking-wide">Upload Screen</p>
                                                    <p className="text-[10px] opacity-60 text-center">Drag or Click</p>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                            <Button
                                              onClick={() => submitTask(task.id)}
                                              disabled={uploading === task.id || !selectedFiles[task.id]}
                                              variant={selectedFiles[task.id] ? "primary" : "secondary"}
                                              className={cn(
                                                "h-auto md:h-full px-8 py-4 shrink-0 transition-all font-black uppercase tracking-wider text-sm",
                                                (uploading === task.id || !selectedFiles[task.id]) && "opacity-50 cursor-not-allowed"
                                              )}
                                            >
                                              {uploading === task.id ? <Loader2 size={20} className="animate-spin" /> : 'Submit'}
                                            </Button>
                                          </div>
                                          <div className="mt-3 flex items-start gap-2 text-zinc-400">
                                            <span className="text-xs shrink-0 mt-0.5">*</span>
                                            <p className="text-xs italic leading-tight">
                                              {task.screenshot_instruction || "Ensure your screenshot clearly shows the completion or registration details before hitting Submit."}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center",
                                        submission.status === 'VERIFIED' ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"
                                      )}>
                                        {submission.status === 'VERIFIED' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-zinc-900">
                                          {submission.status === 'VERIFIED' ? 'Completed' : 'Under Review'}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                          {submission.status === 'VERIFIED' ? `Verified on ${new Date(submission.verified_at!).toLocaleDateString()}` : 'Waiting for verification review'}
                                        </p>
                                      </div>
                                    </div>
                                    <a
                                      href={submission.screenshot_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                      <ImageIcon size={14} /> View Screenshot
                                    </a>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        )}                {(isAdmin || (isHOD && task.department_id === user?.department_id) || (isAdvisor && Array.isArray(task.class_ids) && task.class_ids.includes(Number(user?.class_id))) || (isCoordinator && Array.isArray(task.class_ids) && task.class_ids.includes(Number(user?.class_id)))) && (
                          <div className="mt-6 flex gap-4 border-t border-zinc-100 pt-4">
                            <Button
                              variant="ghost"
                              className="text-zinc-400 hover:text-zinc-900"
                              onClick={() => toggleTaskStatus(task.id, task.status)}
                            >
                              {task.status === 'OPEN' ? 'Close Task' : 'Open Task'}
                            </Button>
                            <Button
                              variant="ghost"
                              className="text-zinc-400 hover:text-red-500"
                              onClick={() => deleteTask(task.id)}
                            >
                              <Trash2 size={18} /> Delete
                            </Button>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {view === 'verifications' && (
              <motion.div
                key="verifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    {['PENDING', 'VERIFIED', 'REJECTED', 'ALL'].map(f => (
                      <button
                        key={f}
                        onClick={() => setVerificationFilter(f as any)}
                        className={cn(
                          "px-4 py-2 rounded-full text-xs font-bold transition-all",
                          verificationFilter === f ? "bg-black text-white" : "bg-white text-zinc-400 border border-zinc-200 hover:border-zinc-300"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  {selectedSubmissions.length > 0 && (
                    <Button
                      variant="success"
                      onClick={() => {
                        if (confirm(`Verify ${selectedSubmissions.length} submissions?`)) {
                          Promise.all(selectedSubmissions.map(id =>
                            fetch(`${API_URL}/api/submissions/${id}/verify`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ status: 'VERIFIED' })
                            })
                          )).then(() => {
                            setSelectedSubmissions([]);
                            fetchInitialData();
                          });
                        }
                      }}
                    >
                      Bulk Verify ({selectedSubmissions.length})
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className={cn((isHOD || isAdmin || user?.is_year_coordinator) ? "md:col-span-2" : "md:col-span-3", "relative")}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      placeholder="Search submissions by student name or register number..."
                      className="pl-10 h-10 text-sm"
                      value={submissionSearchTerm}
                      onChange={e => { setSubmissionSearchTerm(e.target.value); setSubmissionPage(1); }}
                    />
                  </div>

                  {(isHOD || isAdmin || user?.is_year_coordinator) && (
                    <div>
                      <select
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all bg-white font-medium text-zinc-700 text-sm h-10"
                        value={verificationClassFilter}
                        onChange={e => { setVerificationClassFilter(e.target.value); setSubmissionPage(1); }}
                      >
                        <option value="">All Classes</option>
                        {classes.filter(c => {
                          if (isAdmin) return true;
                          if (isHOD) return c.department_id?.toString() === user?.department_id?.toString();
                          if (user?.is_year_coordinator) return c.department_id?.toString() === user?.department_id?.toString() && c.year === user?.year_scope;
                          return false;
                        }).map(c => (
                          <option key={c.id} value={c.id.toString()}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <select
                      className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all bg-white font-medium text-zinc-700 text-sm h-10"
                      value={verificationTaskFilter}
                      onChange={e => { setVerificationTaskFilter(e.target.value); setSubmissionPage(1); }}
                    >
                      <option value="">All Tasks</option>
                      {tasks.map(t => (
                        <option key={t.id} value={t.id.toString()}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Card className="overflow-hidden p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-zinc-300"
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedSubmissions(submissions.filter(s => s.status === 'SUBMITTED').map(s => s.id));
                              } else {
                                setSelectedSubmissions([]);
                              }
                            }}
                          />
                        </th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Student</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Task</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Custom Field</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Screenshot</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {(() => {
                        const filtered = submissions
                          .filter(s => verificationFilter === 'ALL' ? true : (verificationFilter === 'PENDING' ? s.status === 'SUBMITTED' : s.status === verificationFilter))
                          .filter(s => {
                            if (!verificationClassFilter) return true;
                            return s.class_id?.toString() === verificationClassFilter;
                          })
                          .filter(s => {
                            if (!verificationTaskFilter) return true;
                            return s.task_id?.toString() === verificationTaskFilter;
                          })
                          .filter(s => {
                            if (!submissionSearchTerm) return true;
                            const query = submissionSearchTerm.toLowerCase();
                            return (s.student_name?.toLowerCase().includes(query) || s.register_number?.toLowerCase().includes(query) || s.task_title?.toLowerCase().includes(query));
                          });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="px-8 py-16 text-center text-zinc-500">
                                <div className="flex flex-col items-center justify-center gap-2">
                                  <ImageIcon size={40} className="text-zinc-300 mb-2" />
                                  <p className="font-bold text-base text-zinc-900">No submissions found</p>
                                  <p className="text-sm text-zinc-400">There are no task submissions matching the filters.</p>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        const totalPages = Math.ceil(filtered.length / itemsPerPage);
                        const paginated = filtered.slice((submissionPage - 1) * itemsPerPage, submissionPage * itemsPerPage);

                        return (
                          <>
                            {paginated.map(s => (
                              <tr key={s.id} className={cn("hover:bg-zinc-50/50 transition-colors border-l-4", s.status === 'VERIFIED' ? "border-emerald-500" : s.status === 'REJECTED' ? "border-red-500" : "border-orange-500")}>
                                <td className="p-4">
                                  {s.status === 'SUBMITTED' && (
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded border-zinc-300"
                                      checked={selectedSubmissions.includes(s.id)}
                                      onChange={e => {
                                        if (e.target.checked) setSelectedSubmissions(prev => [...prev, s.id]);
                                        else setSelectedSubmissions(prev => prev.filter(id => id !== s.id));
                                      }}
                                    />
                                  )}
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                                      <Users size={16} className="text-zinc-500" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-zinc-900 leading-tight">{s.student_name}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-[10px] text-zinc-500 font-mono italic">{s.register_number}</p>
                                        <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 text-[8px] font-black rounded uppercase border border-zinc-200">
                                          {s.class_name || 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <p className="text-sm font-medium text-zinc-900">{s.task_title}</p>
                                  <p className="text-[10px] text-zinc-400 capitalize">{new Date(s.submitted_at).toLocaleDateString()}</p>
                                </td>
                                <td className="p-4">
                                  <p className="text-[10px] text-zinc-400 uppercase font-bold mb-1 tracking-widest">Field Data</p>
                                  <p className="text-sm font-mono text-zinc-900 bg-zinc-100 px-2 py-1 rounded inline-block">{s.custom_field_value}</p>
                                </td>
                                <td className="p-4">
                                  <div className="relative group/img">
                                    <img
                                      src={s.screenshot_url}
                                      className="w-12 h-12 object-cover rounded-lg border-2 border-zinc-200 hover:border-black transition-all cursor-zoom-in"
                                      onClick={() => window.open(s.screenshot_url, '_blank')}
                                      alt="Thumbnail"
                                    />
                                    <div className="absolute top-0 left-0 w-full h-full bg-black/5 rounded-lg pointer-events-none group-hover/img:bg-transparent transition-colors" />
                                  </div>
                                </td>
                                <td className="p-4 text-center">
                                  <div className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                                    s.status === 'VERIFIED' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                      s.status === 'REJECTED' ? "bg-red-50 text-red-700 border-red-100" : "bg-orange-50 text-orange-700 border-orange-100"
                                  )}>
                                    <span className={cn("w-1.5 h-1.5 rounded-full", s.status === 'VERIFIED' ? "bg-emerald-500" : s.status === 'REJECTED' ? "bg-red-500" : "bg-orange-500")} />
                                    {s.status === 'SUBMITTED' ? 'PENDING' : s.status}
                                  </div>
                                </td>
                                <td className="p-4 text-right">
                                  {s.status === 'SUBMITTED' && (
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="success"
                                        className="px-3 py-1.5 flex items-center gap-2 text-xs"
                                        onClick={() => verifySubmission(s.id, 'VERIFIED')}
                                      >
                                        <CheckCircle2 size={14} /> Verify
                                      </Button>
                                      <Button
                                        variant="danger"
                                        className="px-3 py-1.5 flex items-center gap-2 text-xs"
                                        onClick={() => setShowRejectionModal(s.id)}
                                      >
                                        <XCircle size={14} /> Reject
                                      </Button>
                                    </div>
                                  )}
                                  {s.status === 'REJECTED' && (
                                    <p className="text-[10px] text-red-500 font-medium">Wait for Resubmission</p>
                                  )}
                                  {s.status === 'VERIFIED' && (
                                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Completed</p>
                                  )}

                                  <Button
                                    variant="ghost"
                                    className="p-1.5 ml-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded-lg"
                                    onClick={async () => {
                                      if (confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
                                        const res = await fetch(`${API_URL}/api/submissions/${s.id}`, {
                                          method: 'DELETE',
                                          headers: { Authorization: `Bearer ${token}` }
                                        });
                                        if (res.ok) {
                                          fetchInitialData();
                                        } else {
                                          const data = await res.json();
                                          alert(data.error || 'Failed to delete submission');
                                        }
                                      }
                                    }}
                                    title="Delete Submission"
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {filtered.length > itemsPerPage && (
                              <tr>
                                <td colSpan={7} className="px-4 py-4">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-zinc-500">
                                      Showing {(submissionPage - 1) * itemsPerPage + 1} to {Math.min(submissionPage * itemsPerPage, filtered.length)} of {filtered.length} entries
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="secondary"
                                        className="px-3 py-1 text-xs"
                                        disabled={submissionPage === 1}
                                        onClick={() => setSubmissionPage(prev => prev - 1)}
                                      >
                                        Previous
                                      </Button>
                                      <div className="flex gap-1">
                                        {Array.from({ length: totalPages }).map((_, i) => (
                                          <button
                                            key={i}
                                            onClick={() => setSubmissionPage(i + 1)}
                                            className={cn(
                                              "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                              submissionPage === i + 1 ? "bg-black text-white" : "text-zinc-500 hover:bg-zinc-100"
                                            )}
                                          >
                                            {i + 1}
                                          </button>
                                        ))}
                                      </div>
                                      <Button
                                        variant="secondary"
                                        className="px-3 py-1 text-xs"
                                        disabled={submissionPage === totalPages}
                                        onClick={() => setSubmissionPage(prev => prev + 1)}
                                      >
                                        Next
                                      </Button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {filtered.length === 0 && (
                              <tr>
                                <td colSpan={7} className="p-12 text-center text-zinc-500 text-sm">
                                  No submissions found matching your filters.
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </Card>
              </motion.div>
            )
            }

            {
              view === 'submissions' && (
                <motion.div
                  key="submissions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-4">
                    {submissions.filter(s => s.user_id?.toString() === user?.id?.toString()).length === 0 ? (
                      <Card className="flex flex-col items-center justify-center py-12 text-zinc-500">
                        <ImageIcon size={48} className="mb-4 opacity-20" />
                        <p>No submissions found</p>
                      </Card>
                    ) : (
                      submissions
                        .filter(s => s.user_id?.toString() === user?.id?.toString())
                        .map(sub => (
                        <Card key={sub.id} className="flex flex-col md:flex-row gap-6">
                          <div className="w-full md:w-48 h-48 bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 flex-shrink-0">
                            <img
                              src={sub.screenshot_url}
                              alt="Submission"
                              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => window.open(sub.screenshot_url, '_blank')}
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-zinc-900 text-lg">{sub.task_title}</h4>
                                  <p className="text-sm text-zinc-500">
                                    {isAdvisor ? `Student: ${sub.student_name}` : `Submitted on ${new Date(sub.submitted_at).toLocaleString()}`}
                                  </p>
                                </div>
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-xs font-bold uppercase",
                                  sub.status === 'VERIFIED' ? "bg-emerald-100 text-emerald-700" :
                                    sub.status === 'REJECTED' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                                )}>
                                  {sub.status}
                                </span>
                              </div>
                              {sub.verified_at && (
                                <p className="text-[10px] text-zinc-400 mt-2 uppercase font-bold">
                                  Verified on {new Date(sub.verified_at).toLocaleString()}
                                </p>
                              )}
                            </div>

                            {(isHOD || isAdmin) && sub.status === 'SUBMITTED' && (
                              <div className="flex gap-2 mt-4">
                                <Button
                                  variant="success"
                                  className="flex-1 flex items-center justify-center gap-2"
                                  onClick={() => verifySubmission(sub.id, 'VERIFIED')}
                                >
                                  <CheckCircle2 size={18} /> Verify
                                </Button>
                                <Button
                                  variant="danger"
                                  className="flex-1 flex items-center justify-center gap-2"
                                  onClick={() => verifySubmission(sub.id, 'REJECTED')}
                                >
                                  <XCircle size={18} /> Reject
                                </Button>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              className="mt-4 text-xs flex items-center gap-2 w-fit"
                              onClick={() => window.open(sub.screenshot_url, '_blank')}
                            >
                              <ExternalLink size={14} /> View Full Screenshot
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </motion.div>
              )
            }
          </AnimatePresence >
        </div >

        <footer className="mt-auto border-t border-zinc-200 bg-zinc-50 py-8 shrink-0">
          <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row items-center justify-between text-zinc-500">
            <div className="mb-4 md:mb-0 text-center md:text-left">
              <p className="text-sm font-bold text-zinc-900">VSBEC Academic Task Management System</p>
              <p className="text-xs mt-1">Empowering students through structured achievements.</p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1">
              <div className="flex gap-6 text-sm">
                <button onClick={() => setShowFooterModal('PRIVACY')} className="hover:text-zinc-900 transition-colors">Privacy Policy</button>
                <button onClick={() => setShowFooterModal('TERMS')} className="hover:text-zinc-900 transition-colors">Terms of Service</button>
                <button onClick={() => setShowFooterModal('SUPPORT')} className="hover:text-zinc-900 transition-colors">Support</button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-2 font-medium">
                Developed and maintained by the Department of Information Technology, VSB Engineering College. ✨
              </p>
            </div>
          </div>
        </footer>

        <AnimatePresence>
          {showExportModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative border border-zinc-100"
              >
                <button
                  onClick={() => setShowExportModal(false)}
                  className="absolute top-8 right-8 p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-zinc-400" />
                </button>

                <h3 className="text-3xl font-black text-zinc-900 tracking-tight">Report Studio</h3>
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-2 mb-8">
                  {isHOD ? 'Configure your department report' : `Exporting report for ${user?.class_name || 'your class'}`}
                </p>

                <div className="space-y-6">
                  {isHOD && (
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block">Target Class</label>
                      <select
                        className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={reportFilters.classId}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, classId: e.target.value }))}
                      >
                        <option value="">All Department Classes</option>
                        {hodStats?.classStats.map(c => (
                          <option key={c.id} value={c.id.toString()}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block">Target Event (Task)</label>
                    <select
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={reportFilters.taskId}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, taskId: e.target.value }))}
                    >
                      <option value="">{isHOD ? 'All Department Tasks' : 'All Class Events'}</option>
                      {(isHOD ? (hodStats?.taskStats || []) : tasks).map((t: any) => (
                        <option key={t.id} value={t.id.toString()}>{t.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block">Task Category</label>
                      <select
                        className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={reportFilters.category}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, category: e.target.value }))}
                      >
                        <option value="">All Categories</option>
                        {['Competition', 'Course', 'Workshop', 'College Work', 'Project', 'Form'].map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block">Submission Status</label>
                    <select
                      className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={reportFilters.status}
                      onChange={(e) => setReportFilters(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="">All Statuses</option>
                      <option value="VERIFIED">✅ Verified</option>
                      <option value="SUBMITTED">🔵 Submitted (Pending)</option>
                      <option value="REJECTED">🟠 Rejected</option>
                      <option value="NOT_SUBMITTED">🔴 Not Submitted</option>
                    </select>
                  </div>

                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mt-4">
                    <div className="flex gap-4">
                      <div className="p-3 bg-blue-600 rounded-2xl text-white">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-blue-900 leading-tight">Detailed Report Mode</p>
                        <p className="text-[11px] font-bold text-blue-600 mt-1">Downloading detailed student names, register numbers, and verification statuses.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button variant="ghost" onClick={() => setShowExportModal(false)} className="flex-1 rounded-2xl">Cancel</Button>
                    <Button
                      onClick={() => isHOD ? exportToExcel(reportFilters) : exportToExcelForClass(reportFilters)}
                      className="flex-2 rounded-2xl bg-black hover:bg-zinc-800 text-white flex items-center justify-center gap-2"
                    >
                      <FileDown size={18} /> Download Excel
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {showFooterModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl relative"
              >
                <button
                  onClick={() => setShowFooterModal(null)}
                  className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <XCircle size={24} className="text-zinc-400" />
                </button>

                {showFooterModal === 'PRIVACY' && (
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black">Privacy Policy</h3>
                    <div className="text-zinc-600 leading-relaxed text-sm space-y-4">
                      <p>The VSBEC Academic Task Management System respects the privacy of all users.</p>
                      <p>Information collected through the platform, including login credentials, academic task records, submissions, and user activity, is used only for academic administration and internal institutional purposes.</p>
                      <p>User data is securely stored and accessed only by authorized administrators, department staff, and relevant academic authorities. The system does not share personal information with external parties without institutional approval.</p>
                      <p>All users are expected to maintain confidentiality of their account credentials and report any unauthorized access immediately.</p>
                    </div>
                  </div>
                )}

                {showFooterModal === 'TERMS' && (
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black">Terms of Service</h3>
                    <div className="text-zinc-600 leading-relaxed text-sm space-y-4">
                      <p>By using the VSBEC Academic Task Management System, users agree to use the platform only for academic and institutional purposes.</p>
                      <p>Students, faculty, and administrators must provide accurate information and use their assigned accounts responsibly.</p>
                      <p>Any misuse of the system, unauthorized access, manipulation of records, or disruption of platform operations may lead to institutional action.</p>
                      <p>The institution reserves the right to modify features, permissions, or policies whenever required for academic management.</p>
                    </div>
                  </div>
                )}

                {showFooterModal === 'SUPPORT' && (
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black">Support</h3>
                    <div className="text-zinc-600 leading-relaxed text-sm space-y-4">
                      <p>For technical assistance, login issues, task-related concerns, or system access problems, users may contact the concerned department administrator or system support team.</p>
                      <p>Support is provided during working hours through the institution’s official communication channels.</p>
                      <p>For unresolved issues, users may report directly to the IT Department responsible for maintaining the platform.</p>
                    </div>
                  </div>
                )}

                <Button onClick={() => setShowFooterModal(null)} className="w-full mt-8">Close</Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main >
    </div >
  );
}

// --- Helper Components ---

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all font-medium",
        active
          ? "bg-black text-white shadow-lg shadow-black/10"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
      )}
    >
      {icon}
      <span>{label}</span>
      {active && <ChevronRight size={16} className="ml-auto opacity-50" />}
    </button>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10", color)} />
      <div className="flex items-center gap-4">
        <div className={cn("p-3 rounded-xl text-white", color)}>
          {React.cloneElement(icon as React.ReactElement, { size: 24 })}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <p className="text-2xl font-bold text-zinc-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}
