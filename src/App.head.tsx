/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// --- Types ---
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
  class_id: number | null;
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
  class_id?: number;
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

const CircularProgress = ({ value, total, label, color = "stroke-indigo-600" }: { value: number; total: number; label: string; color?: string }) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle cx="48" cy="48" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-zinc-100" />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: offset }}
            className={cn("transition-all duration-1000 ease-out", color)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-zinc-900">{Math.round(percentage)}%</span>
        </div>
      </div>
      <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<string>('dashboard');

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
  const [myClass, setMyClass] = useState<Class | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [reportFilters, setReportFilters] = useState({ classId: '', year: '', category: '' });
  const [expandedClass, setExpandedClass] = useState<number | null>(null);

  // Forms
  const [newDept, setNewDept] = useState('');
  const [newClass, setNewClass] = useState({ name: '', department_id: '', year: '', batch: '' });
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', department_id: '', class_id: '', email: '', register_number: '' });
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'Competition',
    external_link: '',
    deadline: '',
    screenshot_instruction: '',
    custom_field_label: '',
    department_id: '',
    class_id: ''
  });
  const [uploading, setUploading] = useState<number | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showTaskPreview, setShowTaskPreview] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALL'>('PENDING');
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
  const [customFieldValue, setCustomFieldValue] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isDraggingScreenshot, setIsDraggingScreenshot] = useState<number | null>(null);

  useEffect(() => {
    if (token) {
      fetchInitialData();
    }
  }, [token]);

  const fetchInitialData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [deptsRes, classesRes, usersRes, tasksRes, submissionsRes, notificationsRes] = await Promise.all([
        fetch('/api/departments', { headers }),
        fetch('/api/classes', { headers }),
        fetch('/api/users', { headers }),
        fetch('/api/tasks', { headers }),
        fetch('/api/submissions', { headers }),
        fetch('/api/notifications', { headers })
      ]);

      if (deptsRes.ok) setDepartments(await deptsRes.json());
      if (classesRes.ok) setClasses(await classesRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (submissionsRes.ok) setSubmissions(await submissionsRes.json());
      if (notificationsRes.ok) setNotifications(await notificationsRes.json());

      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        if (parsedUser.must_change_password) setShowPasswordModal(true);
        if (parsedUser.role === 'HOD') fetchHODStats();
        if (parsedUser.role === 'CLASS_ADVISOR' || (parsedUser.role === 'STUDENT' && parsedUser.is_coordinator)) {
          if (parsedUser.role === 'CLASS_ADVISOR') fetchAdvisorStats();
          if (parsedUser.role === 'STUDENT' && parsedUser.is_coordinator) fetchCoordinatorStats();
          fetchMyClass();
        }
        if (parsedUser.role === 'STUDENT') fetchStudentStats();
      }
    } catch (e) {
      console.error('Failed to fetch data', e);
    }
  };

  const fetchHODStats = async () => {
    try {
      const res = await fetch('/api/stats/hod', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setHodStats(await res.json());
    } catch (e) { }
  };

  const fetchAdvisorStats = async () => {
    try {
      const res = await fetch('/api/stats/advisor', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAdvisorStats(await res.json());
    } catch (e) { }
  };

  const fetchCoordinatorStats = async () => {
    try {
      const res = await fetch('/api/stats/coordinator', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCoordinatorStats(await res.json());
    } catch (e) { }
  };

  const fetchMyClass = async () => {
    try {
      const res = await fetch('/api/my-class', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMyClass(await res.json());
    } catch (e) { }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setNotifications(await res.json());
    } catch (e) { }
  };

  const markNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/read', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchNotifications();
    } catch (e) { }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/change-password', {
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
    const res = await fetch(`/api/users/${id}/coordinator`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_coordinator: !currentStatus })
    });
    if (res.ok) {
      fetchInitialData();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const toggleUserStatus = async (id: number, currentStatus: boolean) => {
    const res = await fetch(`/api/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: !currentStatus })
    });
    if (res.ok) {
      fetchInitialData();
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

        const res = await fetch('/api/students/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ students })
        });

        if (res.ok) {
          const result = await res.json();
          alert(`Imported ${result.success} students. Failed/Duplicates: ${result.failed}`);
          fetchInitialData();
        } else {
          const err = await res.json();
          alert(`Server error: ${err.error || 'Failed to import students'}`);
        }
      } catch (err) {
        console.error("Excel parse error", err);
        alert('Invalid Excel file format.');
      } finally {
        // Reset file input to allow re-uploading the same file if needed
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const fetchStudentStats = async () => {
    try {
      const res = await fetch('/api/stats/student', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setStudentStats(await res.json());
    } catch (e) { }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
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
        const data = await res.json();
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
    const res = await fetch('/api/departments', {
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

    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setNewClass({ name: '', department_id: '', year: '', batch: '' });
      fetchInitialData();
      fetchMyClass();
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    let role = 'STUDENT';
    if (user?.role === 'SUPREME_ADMIN') role = 'HOD';
    else if (user?.role === 'HOD') role = 'CLASS_ADVISOR';

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...newUser, role })
    });
    if (res.ok) {
      setNewUser({ username: '', password: '', full_name: '', department_id: '', class_id: '', email: '', register_number: '' });
      fetchInitialData();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const handleTaskPreview = (e: React.FormEvent) => {
    e.preventDefault();
    setShowTaskPreview(true);
  };

  const createTask = async () => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newTask)
    });
    if (res.ok) {
      setNewTask({ title: '', description: '', category: 'Competition', external_link: '', deadline: '', screenshot_instruction: '', custom_field_label: '', department_id: '', class_id: '' });
      fetchInitialData();
    }
  };

  const resetPassword = async (id: number) => {
    if (!confirm('Reset this user\'s password to their Register Number/Username? They will be prompted to change it on next login.')) return;
    const res = await fetch(`/api/users/${id}/reset-password`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      alert(data.message || 'Password reset successful');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to reset password');
    }
  };

  const submitTask = async (taskId: number) => {
    if (!selectedFile) return alert('Please select a screenshot');
    if (!customFieldValue) return alert('Please fill the custom field');

    setUploading(taskId);
    const formData = new FormData();
    formData.append('task_id', taskId.toString());
    formData.append('screenshot', selectedFile);
    formData.append('custom_field_value', customFieldValue);

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        setSelectedFile(null);
        setCustomFieldValue('');
        alert('Task submitted successfully!');
        fetchInitialData();
      } else {
        const data = await res.json();
        alert(`Submission failed: ${data.error}`);
      }
    } catch (e) {
      alert('Network error during submission');
    }
    setUploading(null);
  };

  const verifySubmission = async (id: number, status: string) => {
    await fetch(`/api/submissions/${id}/verify`, {
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
    fetchInitialData();
  };

  const handleFileUpload = (taskId: number, file: File | null) => {
    if (file) {
      setSelectedFile(file);
    }
  };

  const toggleTaskStatus = async (id: number, currentStatus: string) => {
    const status = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      fetchInitialData();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update task status');
    }
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Hard delete this task? This cannot be undone.')) return;
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      fetchInitialData();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete task');
    }
  };

  const exportToExcel = (filters?: { classId?: string, year?: string, category?: string }) => {
    if (!hodStats) return;

    let filteredSubmissions = submissions.filter(s => {
      // HOD should see submissions for tasks belonging to their department OR global tasks
      const task = tasks.find(t => t.id === s.task_id);
      if (!task) return false;

      const isDeptTask = task.department_id === user?.department_id;
      const isGlobalTask = task.department_id === null && task.class_id === null;

      if (!isDeptTask && !isGlobalTask) return false;

      if (filters?.classId && s.class_id?.toString() !== filters.classId) return false;
      if (filters?.year && s.class_year?.toString() !== filters.year) return false;
      if (filters?.category && s.task_category !== filters.category) return false;
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
            <h1 className="text-4xl font-bold text-zinc-900 tracking-tight">Academic Portal</h1>
            <p className="text-zinc-500 mt-2 text-lg">VSBEC Task Management System</p>
          </div>

          <AnimatePresence mode="wait">
            {!loginRole ? (
              <motion.div
                key="role-selection"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setLoginRole(role.id)}
                    className="group bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-black transition-all text-left flex items-start gap-4 active:scale-[0.98]"
                  >
                    <div className="p-3 bg-zinc-100 rounded-xl group-hover:bg-black group-hover:text-white transition-colors">
                      {role.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-900 group-hover:text-black">{role.title}</h3>
                      <p className="text-sm text-zinc-500 mt-1">{role.desc}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="login-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md mx-auto w-full"
              >
                <Card className="p-8">
                  <button
                    onClick={() => { setLoginRole(null); setError(''); }}
                    className="text-sm text-zinc-400 hover:text-black mb-6 flex items-center gap-1 transition-colors"
                  >
                    ← Back to Roles
                  </button>
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-zinc-900">
                      {roles.find(r => r.id === loginRole)?.title} Login
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">Please enter your credentials</p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-zinc-700 mb-1 block">
                        {loginRole === 'STUDENT' ? 'Register Number' : 'Username'}
                      </label>
                      <Input
                        placeholder={loginRole === 'STUDENT' ? 'e.g. CSE001' : 'Username'}
                        value={loginData.username}
                        onChange={e => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                        required
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-zinc-700 mb-1 block">Password</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={e => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        required
                      />
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
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  const isAdmin = user?.role === 'SUPREME_ADMIN';
  const isHOD = user?.role === 'HOD';
  const isAdvisor = user?.role === 'CLASS_ADVISOR';
  const isStudent = user?.role === 'STUDENT';
  const isCoordinator = user?.role === 'STUDENT' && user?.is_coordinator;

  return (
    <div className="min-h-screen bg-[#F5F5F4] flex">
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
            <span className="font-bold text-zinc-900">
              {isAdmin ? 'SUPREME' : isHOD ? 'HOD PORTAL' : isAdvisor ? 'ADVISOR' : isCoordinator ? 'COORDINATOR' : 'STUDENT'}
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

          {isStudent && (
            <>
              <SidebarItem
                icon={<CheckCircle2 size={20} />}
                label="My Submissions"
                active={view === 'submissions'}
                onClick={() => setView('submissions')}
              />
              {isCoordinator && (
                <SidebarItem
                  icon={<ShieldCheck size={20} />}
                  label="Verifications"
                  active={view === 'verifications'}
                  onClick={() => setView('verifications')}
                />
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="px-4 py-2 mb-4">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Logged in as</p>
            <p className="text-sm font-medium text-zinc-900 truncate">{user?.full_name}</p>
            <p className="text-[10px] text-zinc-500">{user?.role} {user?.department_name ? `• ${user.department_name}` : ''}</p>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Total Departments" value={departments.length} icon={<Building2 />} color="bg-blue-500" />
                    <StatCard title="Active HODs" value={users.filter(u => u.role === 'HOD').length} icon={<Users />} color="bg-emerald-500" />
                    <StatCard title="Total Tasks" value={tasks.length} icon={<ClipboardList />} color="bg-orange-500" />
                  </div>
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

                      {/* Right Column: Class detail Explorer */}
                      <div className="lg:col-span-8 space-y-10">
                        <Card className="p-0 overflow-hidden rounded-[2.5rem] border-zinc-100 shadow-xl bg-white">
                          <div className="p-8 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                            <div>
                              <h3 className="text-2xl font-black text-zinc-900 tracking-tight">Class Detail Explorer</h3>
                              <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-1">Granular student performance monitoring</p>
                            </div>
                          </div>

                          <div className="p-4 space-y-4 max-h-[1000px] overflow-y-auto bg-zinc-50/20">
                            {hodStats?.classStats.map((cls, idx) => {
                              const isExpanded = expandedClass === cls.id;
                              const classSubmissions = submissions.filter(s => s.class_name === cls.name);

                              return (
                                <div key={cls.id} className={cn(
                                  "rounded-[1.5rem] border transition-all duration-500 overflow-hidden",
                                  isExpanded ? "bg-white border-blue-200 shadow-xl ring-4 ring-blue-50" : "bg-white border-zinc-100 hover:border-blue-100"
                                )}>
                                  <div
                                    className="p-6 cursor-pointer flex items-center justify-between"
                                    onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
                                  >
                                    <div className="flex items-center gap-6">
                                      <div className={cn(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl transition-all",
                                        isExpanded ? "bg-blue-600 text-white rotate-6" : "bg-zinc-100 text-zinc-400 group-hover:bg-blue-50"
                                      )}>
                                        {cls.name.charAt(0)}
                                      </div>
                                      <div>
                                        <h4 className="text-lg font-black text-zinc-900">{cls.name}</h4>
                                        <div className="flex items-center gap-4 mt-1">
                                          <div className="flex items-center gap-1.5">
                                            <Users size={12} className="text-zinc-400" />
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{cls.total_students} Students</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 uppercase tracking-widest">
                                            <CheckCircle2 size={12} className="text-emerald-500" />
                                            <span className="text-[10px] font-bold text-emerald-600">{Math.round((cls.participating_students / cls.total_students) * 100)}% Active</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                      <div className="hidden md:block w-48 h-2 bg-zinc-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-1000 ease-out"
                                          style={{ width: `${(cls.participating_students / cls.total_students) * 100}%` }}
                                        />
                                      </div>
                                      <button className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                        isExpanded ? "bg-blue-50 text-blue-600 rotate-180" : "bg-zinc-50 text-zinc-400"
                                      )}>
                                        <ChevronRight size={18} />
                                      </button>
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-t border-zinc-100 bg-zinc-50/30"
                                      >
                                        <div className="p-8">
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {/* We simulate student records here as the backend has them in stats or submissions */}
                                            {users.filter(u => u.class_id === cls.id && u.role === 'STUDENT').map(student => {
                                              const studentSubs = classSubmissions.filter(s => s.student_name === student.full_name);
                                              const verifiedCount = studentSubs.filter(s => s.status === 'VERIFIED').length;
                                              const totalTasks = tasks.filter(t => t.class_id === cls.id || (t.class_id === null && (t.department_id === user?.department_id || t.department_id === null))).length;

                                              return (
                                                <div key={student.id} className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all">
                                                  <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs font-black text-zinc-900 truncate max-w-[120px]">{student.full_name}</span>
                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">{student.register_number}</span>
                                                  </div>
                                                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 mb-2 uppercase tracking-widest">
                                                    <span>Verified Tasks</span>
                                                    <span className="text-zinc-900">{verifiedCount} / {totalTasks}</span>
                                                  </div>
                                                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                                    <div
                                                      className="h-full bg-emerald-500"
                                                      style={{ width: `${(verifiedCount / Math.max(1, totalTasks)) * 100}%` }}
                                                    />
                                                  </div>
                                                </div>
                                              );
                                            })}
                                            {users.filter(u => u.class_id === cls.id && u.role === 'STUDENT').length === 0 && (
                                              <p className="col-span-full text-center py-6 text-xs font-bold text-zinc-400 uppercase tracking-widest">No student records found</p>
                                            )}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </Card>

                        <Card className="p-8 rounded-[2.5rem] bg-indigo-600 text-white overflow-hidden relative">
                          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div>
                              <h3 className="text-2xl font-black tracking-tight">Generate Detailed Academic Reports</h3>
                              <p className="text-indigo-100 mt-2 font-medium">Download filtered records including student names, register numbers, and verification status across your department.</p>
                            </div>
                            <button
                              onClick={() => setShowExportModal(true)}
                              className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-sm shadow-xl hover:scale-105 transition-transform shrink-0"
                            >
                              Open Report Studio
                            </button>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </div>
                ) : isAdvisor ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Class Students" value={users.length} icon={<Users />} color="bg-blue-500" />
                    <StatCard title="Class Tasks" value={tasks.filter(t => t.class_id === user?.class_id).length} icon={<ClipboardList />} color="bg-purple-500" />
                    <StatCard title="Total Assigned Tasks" value={tasks.length} icon={<ClipboardList />} color="bg-orange-500" />
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
                            <span className="text-4xl font-black">{submissions.filter(s => s.status === 'SUBMITTED').length}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Pending Tasks</span>
                          </div>
                        </div>

                        {coordinatorStats && (
                          <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                              <div className="hidden" />
                              <div className="hidden" />
                            </div>
                            <Card>
                              <h3 className="text-lg font-semibold mb-6">Student Achievement Grid</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {coordinatorStats.studentStats.map(student => (
                                  <div key={student.full_name} className="flex flex-col p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-colors">
                                    <span className="text-sm font-bold text-zinc-900 truncate">{student.full_name}</span>
                                    <div className="mt-2 flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-zinc-400">COMPLETED</span>
                                      <span className="text-xs font-bold text-indigo-600">{student.completed_tasks} / {student.total_tasks}</span>
                                    </div>
                                    <div className="mt-2 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                                      <div className="bg-indigo-500 h-full" style={{ width: `${(student.completed_tasks / (student.total_tasks || 1)) * 100}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isAdvisor && advisorStats && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="hidden" />
                      <div className="hidden" />
                    </div>
                    <Card>
                      <h3 className="text-lg font-semibold mb-6">Student Completion</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {advisorStats.studentStats.map(student => (
                          <div key={student.full_name} className="flex flex-col p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-colors">
                            <span className="text-sm font-bold text-zinc-900 truncate">{student.full_name}</span>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-zinc-400">COMPLETED</span>
                              <span className="text-xs font-bold text-indigo-600">{student.completed_tasks} / {student.total_tasks}</span>
                            </div>
                            <div className="mt-2 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                              <div className="bg-indigo-500 h-full" style={{ width: `${(student.completed_tasks / (student.total_tasks || 1)) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
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
                          <p className="text-xs text-zinc-500">{task.department_name || 'Global Task'} • {new Date(task.created_at).toLocaleDateString()}</p>
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
                            fetch(`/api/departments/${dept.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(() => fetchInitialData());
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
                                fetch(`/api/classes/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).then(() => fetchInitialData());
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
                    {isAdmin ? 'HOD Accounts' : isHOD ? 'Class Advisors' : 'Students'}
                  </h3>
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
                            return u.full_name.toLowerCase().includes(query) || (u.register_number || u.username).toLowerCase().includes(query);
                          });

                        const totalPages = Math.ceil(filtered.length / itemsPerPage);
                        const paginated = filtered.slice((userPage - 1) * itemsPerPage, userPage * itemsPerPage);

                        return (
                          <>
                            {paginated.map(u => (
                              <tr key={u.id} className={cn("hover:bg-zinc-50 transition-colors", !u.is_active && "opacity-50 grayscale")}>
                                <td className="px-6 py-4 font-medium text-zinc-900">
                                  <div className="flex items-center gap-2">
                                    {u.full_name}
                                    {!!u.is_coordinator && (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase">Coordinator</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-zinc-500">{u.register_number || u.username}</td>
                                {isAdvisor && <td className="px-6 py-4 text-zinc-500">{u.email}</td>}
                                {!isAdvisor && (
                                  <td className="px-6 py-4">
                                    <span className="px-2 py-1 bg-zinc-100 rounded text-xs text-zinc-600">
                                      {isAdmin ? u.department_name : u.class_name}
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
                                        if (confirm(`Delete ${u.role === 'CLASS_ADVISOR' ? 'Advisor' : 'User'} ${u.full_name}?`)) {
                                          const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                                          if (res.ok) {
                                            fetchInitialData();
                                          } else {
                                            const data = await res.json();
                                            alert(data.error || 'Failed to delete user');
                                          }
                                        }
                                      }}
                                      className={cn("p-2 transition-colors", u.role === 'HOD' ? "text-zinc-200 cursor-not-allowed" : "text-zinc-400 hover:text-red-500")}
                                      disabled={u.role === 'HOD'}
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
                  <Card>
                    <h3 className="text-lg font-semibold mb-4">Post New Task</h3>
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
                            onChange={e => setNewTask(prev => ({ ...prev, department_id: e.target.value, class_id: '' }))}
                          >
                            <option value="">Global Task (Visible to All)</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        )}

                        {(isAdmin || isHOD) && (
                          <select
                            className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all bg-white"
                            value={newTask.class_id || ''}
                            onChange={e => setNewTask(prev => ({ ...prev, class_id: e.target.value }))}
                          >
                            <option value="">{isHOD ? 'Department Wide Task' : 'Select Specific Class (Optional)'}</option>
                            {classes
                              .filter(c => !newTask.department_id || c.department_id === Number(newTask.department_id))
                              .map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                          </select>
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
                    const submission = submissions.find(s => s.task_id === task.id);
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
                              <span className={cn(
                                "px-2 py-0.5 rounded-full border border-transparent whitespace-nowrap",
                                task.class_id ? "bg-purple-50 text-purple-600 border-purple-100" :
                                  task.department_name ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-orange-50 text-orange-600 border-orange-100"
                              )}>
                                {task.class_id ? 'Class Task' : task.department_name ? 'Department Task' : 'Global Task'}
                              </span>
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
                                          <p className="font-bold mb-1">Rejected: {submission.rejection_reason}</p>
                                          <p>Please re-submit with the requested changes.</p>
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
                                            <label
                                              htmlFor={`file-${task.id}`}
                                              className={cn(
                                                "flex-1 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer",
                                                selectedFile ? "border-emerald-500 bg-emerald-50 text-emerald-600" : (isDraggingScreenshot === task.id ? "border-blue-500 bg-blue-50 scale-105" : "border-zinc-200 bg-white text-zinc-400 hover:border-black hover:text-black")
                                              )}
                                              onDragOver={(e) => { e.preventDefault(); setIsDraggingScreenshot(task.id); }}
                                              onDragLeave={() => setIsDraggingScreenshot(null)}
                                              onDrop={(e) => {
                                                e.preventDefault();
                                                setIsDraggingScreenshot(null);
                                                const file = e.dataTransfer.files[0];
                                                if (file && file.type.startsWith('image/')) {
                                                  handleFileUpload(task.id, file);
                                                } else {
                                                  alert('Please drop a valid image file');
                                                }
                                              }}
                                            >
                                              {selectedFile ? (
                                                <div className="text-center">
                                                  <CheckCircle2 size={24} className="mb-1 mx-auto" />
                                                  <p className="text-xs font-bold uppercase tracking-tight">Image Loaded</p>
                                                  <p className="text-[10px] opacity-70 truncate max-w-[150px] mx-auto">
                                                    {selectedFile.name}
                                                  </p>
                                                </div>
                                              ) : (
                                                <>
                                                  <Upload size={24} className="mb-1" />
                                                  <p className="text-xs font-bold">SELECT SCREENSHOT</p>
                                                  <p className="text-[10px] uppercase opacity-50">Click to browse gallery</p>
                                                </>
                                              )}
                                            </label>
                                            <Button
                                              onClick={() => submitTask(task.id)}
                                              disabled={uploading === task.id || !selectedFile}
                                              variant={selectedFile ? "primary" : "secondary"}
                                              className="h-[74px] px-8"
                                            >
                                              {uploading === task.id ? 'Uploading...' : 'Submit'}
                                            </Button>
                                          </div>
                                          {selectedFile && (
                                            <p className="text-[10px] text-zinc-500 italic">
                                              * Ensure your screenshot clearly shows the completion or registration details before hitting Submit.
                                            </p>
                                          )}
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
                                          {submission.status === 'VERIFIED' ? 'Verified' : 'Submitted & Pending'}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                          {submission.status === 'VERIFIED' ? `Verified on ${new Date(submission.verified_at!).toLocaleDateString()}` : 'Waiting for verification'}
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
                              })())}
                          </div>
                        )}

                        {(isAdmin || (isHOD && task.department_id === user?.department_id) || (isAdvisor && task.class_id === user?.class_id) || (isCoordinator && task.class_id === user?.class_id)) && (
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
                            fetch(`/api/submissions/${id}/verify`, {
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

                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      placeholder="Search submissions by student name or register number..."
                      className="pl-10"
                      value={submissionSearchTerm}
                      onChange={e => { setSubmissionSearchTerm(e.target.value); setSubmissionPage(1); }}
                    />
                  </div>
                </div>

                <Card className="overflow-hidden p-0">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          <input
                            type="checkbox"
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
                            if (!submissionSearchTerm) return true;
                            const query = submissionSearchTerm.toLowerCase();
                            return (s.student_name?.toLowerCase().includes(query) || s.register_number?.toLowerCase().includes(query) || s.task_title?.toLowerCase().includes(query));
                          });

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
                                      <p className="text-[10px] text-zinc-500 font-mono">{s.register_number}</p>
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
                                        const res = await fetch(`/api/submissions/${s.id}`, {
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
            )}

            {view === 'submissions' && (
              <motion.div
                key="submissions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-4">
                  {submissions.length === 0 ? (
                    <Card className="flex flex-col items-center justify-center py-12 text-zinc-500">
                      <ImageIcon size={48} className="mb-4 opacity-20" />
                      <p>No submissions found</p>
                    </Card>
                  ) : (
                    submissions.map(sub => (
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
            )}
          </AnimatePresence>
        </div>

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
                <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest mt-2 mb-8">Configure your department report</p>

                <div className="space-y-6">
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block">Year Filter</label>
                      <select
                        className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={reportFilters.year}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, year: e.target.value }))}
                      >
                        <option value="">Any Year</option>
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y.toString()}>{y}</option>
                        ))}
                      </select>
                    </div>
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
                      onClick={() => exportToExcel(reportFilters)}
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
