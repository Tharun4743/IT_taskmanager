/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { API_URL } from './config';
import {
  isPushSupported,
  getNotificationPermissionState,
  checkIsPushSubscribed,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestPushNotification
} from './pushNotificationClient';
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
  BellOff,
  Smartphone,
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
  RotateCcw,
  AlertTriangle,
  Loader2,
  CalendarRange,
  Share2,
  Copy,
  Maximize2,
  FileText,
  GraduationCap,
  UserCheck,
  User,
  Trophy,
  BookOpen,
  Briefcase,
  Mail,
  Phone,
  Shield,
  Edit3,
  Save,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Award,
  Activity,
  Github,
  Linkedin,
  Globe,
  Code,
  Layers,
  Calendar,
  MapPin,
  FileUp,
  Languages,
  Compass,
  Lock,
  Settings,
  Megaphone,
  Pin,
  Send,
  Filter,
  Paperclip,
  Zap,
  Target,
  Hourglass,
  TrendingUp,
  Terminal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Helper to render Lucide vector icons for task categories
const renderCategoryIcon = (category: string, size = 14) => {
  switch (category) {
    case 'Competition':
      return <Trophy size={size} />;
    case 'Course':
      return <BookOpen size={size} />;
    case 'Workshop':
      return <Briefcase size={size} />;
    case 'College Work':
      return <Building2 size={size} />;
    default:
      return <ClipboardList size={size} />;
  }
};

// --- Types ---
interface YearStats {
  total_students: number;
  total_classes: number;
  taskStats: { id: string; title: string; submitted: number; verified: number; pending: number; rejected: number; }[];
  classStats: { id: string; name: string; total_students: number; participating_students: number; }[];
  year: number;
}

interface User {
  id: string | number;
  username: string;
  role: 'SUPREME_ADMIN' | 'HOD' | 'CLASS_ADVISOR' | 'STUDENT';
  full_name: string;
  department_id: string | number | null;
  department_name?: string;
  class_id?: string | number | null;
  class_name?: string;
  email?: string;
  register_number?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'Not Specified' | string;
  phone?: string;
  bio?: string;
  github_url?: string;
  linkedin_url?: string;
  avatar_url?: string;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  telegram_linked_at?: string | null;
  year?: number | string;
  batch?: string;
  is_coordinator?: boolean;
  is_year_coordinator?: boolean;
  year_scope?: number | null;
  is_active?: boolean;
  created_at?: string;
}

interface Department {
  id: string | number;
  name: string;
}

interface Class {
  id: string | number;
  name: string;
  department_id: string | number;
  department_name?: string;
  year?: number;
  batch?: string;
}

interface Task {
  id: string | number;
  title: string;
  description: string;
  category?: string;
  external_link?: string;
  deadline?: string;
  screenshot_instruction?: string;
  custom_field_label?: string;
  creator_name: string;
  department_name: string | null;
  class_ids: (string | number)[];
  status: 'OPEN' | 'CLOSED';
  submission_type?: 'INDIVIDUAL' | 'TEAM';
  min_team_size?: number;
  max_team_size?: number;
  created_at: string;
  submission_status?: string;
  submission_count?: number;
  poster_url?: string | null;
  poster_cloudinary_public_id?: string | null;
}

interface TeamMember {
  id: string;
  team_id: string;
  student_id: string;
  full_name?: string;
  register_number?: string;
  username?: string;
  email?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REMOVED';
  accepted_at?: string;
  joined_at: string;
}

interface TeamInvitation {
  id: string;
  team_id: string;
  student_id: string;
  invited_by: string;
  inviter_name?: string;
  team_name?: string;
  task_title?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  created_at: string;
}

interface TeamSubmission {
  id: string;
  team_id: string;
  submitted_by: string;
  proof_url: string;
  cloudinary_public_id?: string;
  remarks?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  team_name?: string;
  leader_name?: string;
  leader_regno?: string;
  members?: TeamMember[];
}

interface Team {
  id: string;
  task_id: string;
  class_id: string;
  leader_id: string;
  leader_name?: string;
  leader_regno?: string;
  team_name: string;
  status: 'FORMING' | 'READY' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  created_at: string;
  updated_at: string;
  members?: TeamMember[];
  invitations?: TeamInvitation[];
  submission?: TeamSubmission | null;
  min_team_size?: number;
  max_team_size?: number;
  task_title?: string;
}

interface Submission {
  id: string | number;
  task_id: string | number;
  task_title: string;
  user_id: string | number;
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
  not_participating?: boolean;
  not_participating_reason?: string;
  class_name?: string;
  class_year?: number;
  class_ids?: (string | number)[];
  task_category?: string;
}

interface Notification {
  id: string | number;
  message: string;
  type: 'VERIFIED' | 'REJECTED' | 'TASK_CREATED' | 'DISCUSSION_REPLY' | 'DISCUSSION_MENTION' | 'NOTICE_PUBLISHED' | 'TASK_DEADLINE_TOMORROW' | 'TASK_OVERDUE';
  is_read: boolean;
  created_at: string;
}

interface Discussion {
  id: string;
  task_id: string;
  parent_id?: string | null;
  user_id: string;
  message: string;
  is_pinned?: boolean;
  is_edited?: boolean;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  author_name: string;
  author_role: string;
  author_regno?: string;
  replies?: Discussion[];
  reply_count?: number;
}

interface Notice {
  id: string;
  title: string;
  description: string;
  scope: 'ALL' | 'DEPARTMENT' | 'YEAR' | 'CLASS';
  department_id?: string | null;
  class_id?: string | null;
  year?: number | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  attachment_url?: string | null;
  attachment_cloudinary_public_id?: string | null;
  created_by: string;
  creator_name?: string;
  creator_role?: string;
  department_name?: string;
  class_name?: string;
  is_pinned?: boolean;
  publish_at: string;
  expire_at?: string | null;
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
  total_students?: number;
  submitted_tasks_count?: number;
  verified_tasks_count?: number;
  rejected_tasks_count?: number;
  pending_tasks_count?: number;
  total_boys?: number;
  total_girls?: number;
  boys_verified?: number;
  girls_verified?: number;
  boys_incomplete?: number;
  girls_incomplete?: number;
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

const getCloudinaryThumbnail = (url: string | undefined | null, width = 400) => {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', `/upload/w_${width},c_scale,q_auto,f_auto/`);
  }
  return url;
};

const getStudentTaskStatusBadge = (task: any, user: any, submissions: any[]) => {
  if (user?.role !== 'STUDENT') {
    return (
      <span className={cn(
        "px-3 py-1 rounded-full text-xs font-bold border",
        task.status === 'OPEN' ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-zinc-100 text-zinc-600 border-zinc-200"
      )}>
        {task.status}
      </span>
    );
  }

  const sub = submissions.find(s => String(s.task_id) === String(task.id) && String(s.user_id) === String(user?.id));
  if (sub) {
    if (sub.status === 'VERIFIED') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 inline-flex items-center gap-1">
          <CheckCircle2 size={12} /> VERIFIED
        </span>
      );
    }
    if (sub.status === 'SUBMITTED') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 inline-flex items-center gap-1">
          <Clock size={12} /> PENDING VERIFICATION
        </span>
      );
    }
    if (sub.status === 'REJECTED') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200 inline-flex items-center gap-1">
          <XCircle size={12} /> REJECTED
        </span>
      );
    }
    if (sub.status === 'NOT_PARTICIPATING') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200 inline-flex items-center gap-1">
          <AlertTriangle size={12} /> NOT INTERESTED
        </span>
      );
    }
  }

  const isDeadlinePassed = task.deadline && new Date(task.deadline) < new Date();
  const isClosed = task.status === 'CLOSED' || isDeadlinePassed;

  if (isClosed) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 inline-flex items-center gap-1">
        <Clock size={12} /> INCOMPLETE (CLOSED)
      </span>
    );
  }

  return (
    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 inline-flex items-center gap-1">
      <Clock size={12} /> PENDING SUBMISSION
    </span>
  );
};

interface StudentStats {
  total_tasks: number;
  verified_tasks: number;
  submitted_tasks: number;
  rejected_tasks: number;
}

interface CoordinatorStats {
  class_student_count?: number;
  total_students?: number;
  pending_reviews?: number;
  verified_submissions?: number;
  rejected_submissions?: number;
  total_boys?: number;
  total_girls?: number;
  boys_verified?: number;
  girls_verified?: number;
  boys_incomplete?: number;
  girls_incomplete?: number;
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
    register_number?: string;
    completed_tasks: number;
    total_tasks: number;
  }[];
}

import * as XLSX from 'xlsx';

// --- Components ---

const Button = ({ className, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' }) => {
  const variants = {
    primary: 'bg-black text-white hover:bg-zinc-800 focus:ring-black/10',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 focus:ring-zinc-200/50',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500/20',
    ghost: 'hover:bg-zinc-100 text-zinc-600 focus:ring-zinc-200/50',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600/20'
  };
  return (
    <button
      className={cn('h-11 px-4 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 shrink-0', variants[variant], className)}
      {...props}
    />
  );
};

const Input = ({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={cn('w-full h-11 px-4 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm bg-white truncate', className)}
    {...props}
  />
);

const Select = ({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={cn('w-full h-11 px-4 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm bg-white', className)}
    {...props}
  >
    {children}
  </select>
);

const CATEGORY_OPTIONS = [
  { value: 'Competition', label: 'Competition', icon: Trophy, symbol: '🏆', color: 'text-rose-600' },
  { value: 'Course', label: 'Course', icon: BookOpen, symbol: '📚', color: 'text-indigo-600' },
  { value: 'Workshop', label: 'Workshop', icon: Briefcase, symbol: '💼', color: 'text-amber-600' },
  { value: 'College Work', label: 'College Work', icon: Building2, symbol: '🏢', color: 'text-emerald-600' },
];

function CategoryDropdown({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOpt = CATEGORY_OPTIONS.find(o => o.value === value) || CATEGORY_OPTIONS[0];
  const IconComp = selectedOpt.icon;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm bg-white font-medium flex items-center justify-between shadow-sm hover:border-zinc-300"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <IconComp size={18} className={cn("shrink-0", selectedOpt.color)} />
          <span className="truncate text-zinc-900 font-bold">{selectedOpt.label}</span>
        </div>
        <ChevronRight size={16} className={cn("text-zinc-400 transition-transform duration-200 shrink-0", isOpen ? "rotate-90" : "")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 bg-white rounded-xl border border-zinc-200 shadow-xl py-1 overflow-hidden mt-1 max-h-60 overflow-y-auto"
          >
            {CATEGORY_OPTIONS.map(opt => {
              const OptIcon = opt.icon;
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full px-3.5 py-2.5 text-xs font-bold flex items-center justify-between transition-colors text-left",
                    isSelected ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <OptIcon size={18} className={cn("shrink-0", opt.color)} />
                    <span className="text-sm font-semibold">{opt.label}</span>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="text-zinc-900 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All', icon: LayoutDashboard, color: 'text-zinc-500' },
  { value: 'VERIFIED', label: 'Verified', icon: CheckCircle2, color: 'text-emerald-600' },
  { value: 'SUBMITTED', label: 'Submitted', icon: Upload, color: 'text-blue-600' },
  { value: 'REJECTED', label: 'Rejected', icon: XCircle, color: 'text-red-500' },
  { value: 'NOT_SUBMITTED', label: 'Not Submitted', icon: Clock, color: 'text-amber-500' },
  { value: 'NOT_PARTICIPATING', label: 'Not Participating', icon: AlertTriangle, color: 'text-orange-500' },
];

function StatusDropdown({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = STATUS_OPTIONS.find(o => o.value === value) || STATUS_OPTIONS[0];
  const SelIcon = selected.icon;

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 px-3.5 rounded-xl border border-zinc-100 bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold flex items-center justify-between hover:border-zinc-300"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <SelIcon size={16} className={cn('shrink-0', selected.color)} />
          <span className="truncate text-zinc-900">{selected.label}</span>
        </div>
        <ChevronRight size={15} className={cn('text-zinc-400 transition-transform duration-200 shrink-0', isOpen ? 'rotate-90' : '')} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden"
          >
            {STATUS_OPTIONS.map(opt => {
              const OptIcon = opt.icon;
              const isSel = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={cn(
                    'w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-sm font-semibold transition-colors',
                    isSel ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-50 text-zinc-700'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <OptIcon size={15} className={isSel ? 'text-white' : opt.color} />
                    <span>{opt.label}</span>
                  </div>
                  {isSel && <CheckCircle2 size={15} className="text-white shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Textarea = ({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={cn('w-full px-4 py-2.5 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm min-h-[100px] resize-y bg-white', className)}
    {...props}
  />
);

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white border border-zinc-200 rounded-xl p-4 md:p-6 shadow-sm', className)} {...props}>
    {children}
  </div>
);

// --- Feature Comparison Component ---
const FeatureComparisonView = () => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'details'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');

  const comparisonData = useMemo(() => [
    {
      category: "Live LeetCode Progress Tracking",
      oldRepo: "Focused on core academic coursework and curriculum submissions.",
      newRepo: "Integrated LeetCode Engine: Real-time problem counts, daily & weekly progress tracking, active target inheritance, and daily completion metrics.",
      tag: "Core Tracking",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Live GitHub Activity Tracking",
      oldRepo: "Standard manual repository link attachments on assignments.",
      newRepo: "Automated GitHub Tracker: Live commit velocity, repository creation tracking, weekly commit aggregates, and 7-day Monday–Sunday timeline breakdown.",
      tag: "Core Tracking",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Combined Coding Progress View",
      oldRepo: "Standard individual student assignment status lists.",
      newRepo: "Unified Coding Dashboard: Single multi-metric monitor displaying LeetCode and GitHub statistics side-by-side with class and target filtering.",
      tag: "Core Tracking",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Multi-Level Target Engine",
      oldRepo: "Uniform assignment due dates for all students.",
      newRepo: "4-Level Target Resolver: Set customized daily/weekly expectations at Student, Class, Year, or Department level with automatic priority inheritance.",
      tag: "Core Tracking",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Telegram Bot & Instant Analysis",
      oldRepo: "In-app browser notifications and dashboard alerts.",
      newRepo: "Dedicated Telegram Bot (@IT_TaskManager_Alerts_bot): Instant student status lookup by Register Number, class shortcuts (/3ita, /2ita, /2it, /year3) with section breakdown, 1-to-1 deadline reminders, and daily department briefs with deduplication locks.",
      tag: "Collaborative",
      isNew: true,
      hasOptimized: true,
    },
    {
      category: "Pure ExcelJS 9-Exporter Suite",
      oldRepo: "Standard CSV tabular export for general records.",
      newRepo: "Direct ExcelJS Reporting Suite: 9 specialized multi-sheet OpenXML (.xlsx) exports with dynamic boundary trimming (no blank rows/columns), custom headers, and auto-fitted columns.",
      tag: "Analytics",
      isNew: true,
      hasOptimized: true,
    },
    {
      category: "RAM Directory & Git Auto-Sync",
      oldRepo: "Standard database relational queries per profile lookup.",
      newRepo: "RAM Directory Cache & Dual-Mode Git Sync (studentDirectoryService.ts): Pre-indexed memory cache for sub-millisecond lookups and automated GitHub profile sync via Contents REST API / Git CLI.",
      tag: "Performance",
      isNew: true,
      hasOptimized: true,
    },
    {
      category: "Tab-Scoped Parallel Batching",
      oldRepo: "Sequential API fetching for active views.",
      newRepo: "Parallel Batching: Grouped Promise.all asynchronous requests scoped to active tabs, optimizing network throughput by 60–75%.",
      tag: "Performance",
      isNew: true,
      hasOptimized: true,
    },
    {
      category: "Cloud Keep-Alive & Cron Webhooks",
      oldRepo: "Standard on-demand server execution.",
      newRepo: "Automated Service Health: Dedicated /api/health endpoint (< 2ms response) for uptime monitoring + secured cron triggers for automated daily progress syncs.",
      tag: "System Services",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Digital Notice Board",
      oldRepo: "Task-specific assignment instructions.",
      newRepo: "Department Notice Board: Multi-class scoping, priority flags (Urgent, High, Normal), file attachments, and broadcast pinning.",
      tag: "Collaborative",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Team Tasks & Group Formation",
      oldRepo: "Individual student task workflow.",
      newRepo: "Team Task Engine: Configurable team sizes (2–5 members), interactive invitations, leader/member roles, and group proof submission.",
      tag: "Collaborative",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Student Opt-Out Tracking",
      oldRepo: "Standard submission requirement for assigned tasks.",
      newRepo: "Opt-Out Governance: Structured participation choice with mandatory reason logging for institutional analysis.",
      tag: "Collaborative",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Peer Discussions & Mentions",
      oldRepo: "Direct submission feedback channel.",
      newRepo: "Threaded Q&A Discussions: Interactive discussion thread per task with @mentions and real-time alerts.",
      tag: "Collaborative",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Submission Review Pipeline",
      oldRepo: "Standard submission verification and approval.",
      newRepo: "Multi-Stage Review: Detailed rejection feedback notes, real-time alert banners, and 1-click proof resubmission.",
      tag: "Collaborative",
      isNew: false,
      hasOptimized: true,
    },
    {
      category: "Task Expiry Management",
      oldRepo: "Fixed deadline enforcement.",
      newRepo: "Flexible Lifecycle Management: Administrative deadline extensions, task reopening, and automated student notifications.",
      tag: "System Services",
      isNew: true,
      hasOptimized: true,
    },
    {
      category: "Authentication & Identity",
      oldRepo: "Standard username and password authentication.",
      newRepo: "Multi-Identifier Authentication: Official College Email ID and Register Number login with sanitized input handling.",
      tag: "System Services",
      isNew: false,
      hasOptimized: true,
    },
    {
      category: "Database Snapshot Backups",
      oldRepo: "Standard cloud database persistence.",
      newRepo: "Automated Daily Snapshots (dbBackupService.ts): Scheduled JSON database backups with rolling retention policy to ensure data safety.",
      tag: "System Services",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Media Storage Management",
      oldRepo: "Cloudinary asset storage.",
      newRepo: "Automated Storage Lifecycle (imageCleanupService.ts): Scheduled cleanup worker to manage temporary upload storage efficiently.",
      tag: "System Services",
      isNew: true,
      hasOptimized: true,
    },
    {
      category: "Server Caching & Optimization",
      oldRepo: "Direct database querying with connection pooling.",
      newRepo: "High-Speed In-Memory Cache: Scoped caching for authentication and read-heavy routes, tuned pool timeouts, and 11 compound indexes.",
      tag: "Performance",
      isNew: true,
      hasOptimized: true,
    },
    {
      category: "Error Diagnostics",
      oldRepo: "Standard server console error logging.",
      newRepo: "Centralized Error Tracking (sentryService.ts): Integrated Sentry monitoring for real-time exception diagnostics.",
      tag: "System Services",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Student Portfolio & Resume Builder",
      oldRepo: "Core academic task profile.",
      newRepo: "Comprehensive Portfolio Builder: Full resume builder with personal info, skills, projects, internships, certifications, coding handles, and career goals.",
      tag: "Collaborative",
      isNew: true,
      hasOptimized: false,
    },
    {
      category: "Database Architecture",
      oldRepo: "Foundational 6 relational tables.",
      newRepo: "29 Specialized Relational Tables supporting coding analytics, teams, notices, student profiles, and system automations.",
      tag: "System Services",
      isNew: true,
      hasOptimized: true,
    }
  ], []);

  const tags = useMemo(() => ['ALL', 'Core Tracking', 'Collaborative', 'Performance', 'System Services', 'Analytics'], []);

  const filteredData = useMemo(() => {
    return comparisonData.filter(item => {
      const matchesSearch = item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.newRepo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === 'ALL' || item.tag === selectedTag;
      return matchesSearch && matchesTag;
    });
  }, [searchQuery, selectedTag, comparisonData]);

  const detailedSections = useMemo(() => [
    {
      title: "1. Live Coding Progress & Target Management",
      features: "Dual platform tracking (LeetCode GraphQL API & GitHub REST/GraphQL API), 4-level target inheritance priority, combined progress matrix, Monday–Sunday weekly breakdown, and live target configuration manager.",
      endpoints: ["GET/POST/DELETE /api/leetcode/targets", "GET/POST/DELETE /api/github/targets", "GET /api/leetcode/progress/daily", "GET /api/github/progress/daily", "GET /api/coding/progress/combined"]
    },
    {
      title: "2. Interactive Telegram Bot & Analysis Engine",
      features: "Dedicated Telegram Bot (@IT_TaskManager_Alerts_bot) with long-polling daemon, native commands menu, instant student status lookup by Register Number (/check <reg_no>), Class & Year analysis shortcuts (/3ita, /2ita, /2it, /year3) with section-wise breakdowns, task lifecycle alerts, 8:00 PM IST private reminders, and 9:00 PM IST group summary briefs with PostgreSQL deduplication locks.",
      files: ["telegramService.ts", "server.ts"],
      endpoints: ["GET /api/telegram/status", "POST /api/telegram/set-group-chat", "POST /api/telegram/send-group-summary", "POST /api/telegram/send-reminders", "POST /api/telegram/test", "DELETE /api/student/unlink-telegram"]
    },
    {
      title: "3. Pure ExcelJS 9-Exporter Analytics Suite",
      features: "Direct ExcelJS workbook generator eliminating XML formatting issues and unused cells. Dynamically bounds used ranges and formats 9 specialized reports: Daily, Weekly, Mon-Sun Detailed, and Defaulters reports for LeetCode, GitHub, and Combined coding progress.",
      files: ["server.ts (buildExcelReportBuffer)"]
    },
    {
      title: "4. High-Speed RAM Student Directory & Git Auto-Sync",
      features: "Pre-indexes student handles, register numbers, classes, and emails in Node.js RAM (studentDirectoryService.ts). Drops student lookup latency from ~30ms to < 0.01ms. Debounces and queues updates to auto-commit and push student coding profile changes to GitHub using either the GitHub Contents REST API (for Render cloud environments without local credentials) or local Git CLI dynamically.",
      files: ["studentDirectoryService.ts"]
    },
    {
      title: "5. Cloud Keep-Alive & Cron Automation",
      features: "GET /api/health endpoint (< 2ms response) for keep-alive monitoring + POST /api/cron/sync-coding-progress webhook protected by CRON_SECRET header for external cron sync.",
      files: ["server.ts"]
    },
    {
      title: "6. Digital Notice Board",
      features: "Multi-class target picker, department-level notices, global announcements, priority tags (Urgent, High, Normal), pinning, file attachments, and direct link sharing.",
      endpoints: ["GET /api/notices", "POST /api/notices", "PUT /api/notices/:id", "DELETE /api/notices/:id"]
    },
    {
      title: "7. Team Task System",
      features: "Individual vs Team task mode, configurable team sizes (2–5 members), interactive invitation dashboard banner, leader/member role badges, and pre-approval editing.",
      endpoints: ["GET /api/tasks/:id/teams", "POST /api/teams/create", "POST /api/teams/invite", "POST /api/teams/respond", "POST /api/teams/submit"]
    },
    {
      title: "8. Student Opt-Out & Not Participating Tracking",
      features: "Choice cards (\"Yes I'll Submit\" vs \"Skip / Not Interested\"), mandatory reason collection, reason editing option, and HOD dashboard analytics cards for opted-out students.",
      endpoints: ["POST /api/tasks/:id/opt-out", "GET /api/tasks/:id/opt-outs"]
    },
    {
      title: "9. Submission Rejection & Proof Re-Upload",
      features: "Staff can reject submissions with detailed rejection feedback notes. Students see red alerts on task cards with exact comments and can re-upload proof with 1-click.",
      endpoints: ["POST /api/submissions/:id/review"]
    },
    {
      title: "10. Student Profile & Resume Builder Suite",
      features: "Comprehensive dashboard allowing students to construct profile resumes: personal information, skills portfolios, academic projects, internships, industry certifications, extra coding platform links, custom resume document uploads, language profiles, achievements, and career placement preferences.",
      files: ["db.ts (Schema setup)", "server.ts (API endpoints)", "src/App.tsx (UI views)"],
      endpoints: [
        "GET /api/student/profile",
        "GET /api/student/profile/:studentId",
        "POST /api/student/profile/avatar",
        "PUT /api/student/profile/personal",
        "POST/DELETE /api/student/profile/skills",
        "POST/DELETE /api/student/profile/projects",
        "POST/DELETE /api/student/profile/internships",
        "POST/DELETE /api/student/profile/certifications",
        "PUT /api/student/profile/coding-profiles",
        "POST /api/student/profile/resume",
        "POST/DELETE /api/student/profile/achievements",
        "POST/DELETE /api/student/profile/languages",
        "PUT /api/student/profile/career-preferences"
      ]
    },
    {
      title: "11. High-Concurrency Server Cache & Connection Engine",
      features: "Caches authenticated user objects in memory (45s TTL) to bypass redundant database SQL queries per request. Scoped in-memory caching for read-heavy /api/tasks (5s TTL) and /api/notices (15s TTL) with smart invalidation upon database mutations. Implements 11 compound database indexes, configured connection pooling timeouts, and Node.js keep-alive tuning (65s) to avoid socket hangups behind cloud proxies.",
      files: ["db.ts (Connection Pool & Indexes)", "server.ts (In-memory Caching & Server Listener)"]
    }
  ], []);

  return (
    <div className="space-y-6">
      {/* Sleek Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 p-6 md:p-8 text-white shadow-xl border border-zinc-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-15 blur-3xl">
          <div className="w-80 h-80 rounded-full bg-indigo-500" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Architecture Blueprint
              </span>
              <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Production Release
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">Platform Evolution & Features</h2>
            <p className="text-zinc-400 text-xs md:text-sm max-w-xl leading-relaxed">
              Technical overview of the progression from the foundational task manager (<code className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">PratapSakthivel</code>) to the production analytics system (<code className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded font-mono text-[11px]">Tharun4743</code>).
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-zinc-800/90 border border-zinc-700/80 px-4 py-3 rounded-2xl text-center shadow-sm">
              <div className="text-2xl font-black text-white">29</div>
              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Postgres Tables</div>
            </div>
            <div className="bg-zinc-800/90 border border-zinc-700/80 px-4 py-3 rounded-2xl text-center shadow-sm">
              <div className="text-2xl font-black text-indigo-400">11+</div>
              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Core Modules</div>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="bg-zinc-100 p-1 rounded-2xl flex gap-1 border border-zinc-200/80 max-w-md">
        <button
          onClick={() => setActiveTab('matrix')}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2",
            activeTab === 'matrix'
              ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/50"
              : "text-zinc-500 hover:text-zinc-900"
          )}
        >
          📊 Feature Comparison
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={cn(
            "flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2",
            activeTab === 'details'
              ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/50"
              : "text-zinc-500 hover:text-zinc-900"
          )}
        >
          🔬 Technical Breakdown
        </button>
      </div>

      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search capabilities..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white border border-zinc-200 rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition-all shadow-sm"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  <XCircle size={14} />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-wrap">
              {tags.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTag(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                    selectedTag === t
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/80 shadow-xs"
                  )}
                >
                  {t === 'ALL' ? 'All Modules' : t}
                </button>
              ))}
            </div>
          </div>

          {/* Matrix Table */}
          <div className="border border-zinc-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200/80 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                    <th className="py-3.5 px-4 md:px-6 w-1/4">Capability Area</th>
                    <th className="py-3.5 px-4 md:px-6 w-1/3">Base Architecture (PratapSakthivel)</th>
                    <th className="py-3.5 px-4 md:px-6 w-5/12">Enhanced Platform (Tharun4743)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {filteredData.length > 0 ? (
                    filteredData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/60 transition-colors group">
                        <td className="py-4 px-4 md:px-6 font-bold text-zinc-900 space-y-1.5 align-top">
                          <div className="text-zinc-900 font-extrabold">{item.category}</div>
                          <span className="inline-block text-[9.5px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-zinc-200/60">
                            {item.tag}
                          </span>
                        </td>
                        <td className="py-4 px-4 md:px-6 text-zinc-500 align-top leading-relaxed">
                          {item.oldRepo}
                        </td>
                        <td className="py-4 px-4 md:px-6 text-zinc-800 align-top bg-zinc-50/30 group-hover:bg-zinc-50/80 transition-colors">
                          <div className="space-y-1.5">
                            <span className="font-medium text-zinc-800 leading-relaxed block">{item.newRepo}</span>
                            <div className="flex gap-1.5 flex-wrap pt-0.5">
                              {item.isNew && (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                  Enhanced Module
                                </span>
                              )}
                              {item.hasOptimized && (
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                  Optimized
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-zinc-400 font-bold text-xs">
                        No capabilities found matching "{searchQuery}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'details' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {detailedSections.map((sec, idx) => (
            <div key={idx} className="border border-zinc-200/80 rounded-2xl p-5 bg-white shadow-xs flex flex-col space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-black text-zinc-900 leading-snug">{sec.title}</h4>
                <span className="bg-zinc-100 text-zinc-700 border border-zinc-200/80 text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full shrink-0">
                  {idx + 1}
                </span>
              </div>
              <p className="text-zinc-600 text-xs leading-relaxed flex-1">{sec.features}</p>
              
              {/* Core files metadata */}
              {sec.files && sec.files.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={11} /> Core Implementation Files
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sec.files.map(f => (
                      <span key={f} className="bg-zinc-50 text-zinc-700 font-mono text-[10px] px-2 py-0.5 rounded-md border border-zinc-200/70 font-semibold">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Endpoints metadata */}
              {sec.endpoints && sec.endpoints.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal size={11} /> Key API Endpoints
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1 border border-zinc-100 rounded-xl p-2 bg-zinc-50/50 scrollbar-thin">
                    {sec.endpoints.map(e => (
                      <div key={e} className="font-mono text-[9.5px] text-zinc-600 bg-white border border-zinc-200/40 px-2 py-0.5 rounded-md leading-tight">
                        {e}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FooterContext = React.createContext<((type: 'PRIVACY' | 'TERMS' | 'SUPPORT' | 'SOURCES') => void) | null>(null);

const Footer = ({ onShowModal }: { onShowModal: (type: 'PRIVACY' | 'TERMS' | 'SUPPORT' | 'SOURCES') => void }) => (
  <footer className="mt-8 pt-4 pb-4 border-t border-zinc-200/80 shrink-0 w-full bg-white/60 backdrop-blur-md px-4 md:px-8">
    <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-3 text-xs min-w-0">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2.5 shrink-0 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-white p-0.5 overflow-hidden shrink-0 border border-zinc-200 shadow-2xs flex items-center justify-center">
          <img src="/logo.png" alt="VSBEC Logo" className="w-full h-full object-contain" />
        </div>
        <span className="font-extrabold text-zinc-900 text-xs tracking-tight whitespace-nowrap">VSBEC IT Task Manager</span>
      </div>

      {/* Center: Legal Links */}
      <div className="flex items-center gap-3 text-xs font-medium text-zinc-600 flex-wrap justify-center">
        <button onClick={() => onShowModal('PRIVACY')} className="hover:text-indigo-600 transition-colors whitespace-nowrap">
          Privacy Policy
        </button>
        <span className="text-zinc-300">•</span>
        <button onClick={() => onShowModal('TERMS')} className="hover:text-indigo-600 transition-colors whitespace-nowrap">
          Terms of Service
        </button>
        <span className="text-zinc-300">•</span>
        <button onClick={() => onShowModal('SUPPORT')} className="hover:text-indigo-600 transition-colors whitespace-nowrap">
          Help & Support
        </button>
        <span className="text-zinc-300">•</span>
        <button onClick={() => onShowModal('SOURCES')} className="hover:text-indigo-600 transition-colors whitespace-nowrap">
          Sources
        </button>
      </div>

      {/* Right: Developed & Maintained By */}
      <div className="text-center lg:text-right text-zinc-600 text-xs font-medium leading-tight shrink-0">
        <span>Developed and maintained by </span>
        <a
          href="https://tharunkumark4743.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-zinc-900 hover:text-indigo-600 transition-colors underline decoration-zinc-300 underline-offset-2"
        >
          Tharunkumar K
        </a>
        <div className="text-[11px] text-zinc-500 font-medium mt-0.5">
          Department of Information Technology, VSB Engineering College
        </div>
      </div>
    </div>
  </footer>
);

const PageLayout = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const onShowModal = React.useContext(FooterContext);
  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden p-4 md:p-8 bg-[#F5F5F4] flex flex-col min-h-0">
      <div className="w-full flex flex-col min-h-full">
        <div className={cn("flex-1 flex flex-col space-y-6 w-full", className)} {...props}>
          {children}
        </div>
        {onShowModal && <Footer onShowModal={onShowModal} />}
      </div>
    </div>
  );
};

const ContentCard = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm w-full", className)} {...props}>
    {children}
  </div>
);

const Badge = ({ children, variant, className }: { children: React.ReactNode; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'; className?: string }) => {
  const styles = {
    success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border border-amber-100",
    danger: "bg-red-50 text-red-700 border border-red-100",
    info: "bg-blue-50 text-blue-700 border border-blue-100",
    neutral: "bg-zinc-100 text-zinc-600 border border-zinc-200",
    primary: "bg-indigo-50 text-indigo-700 border border-indigo-100"
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-bold uppercase tracking-tight inline-flex items-center gap-1.5", styles[variant], className)}>
      {children}
    </span>
  );
};

const Table = ({ children, className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto custom-scrollbar border border-zinc-200 rounded-2xl bg-white shadow-sm">
    <table className={cn("w-full text-left border-collapse", className)} {...props}>
      {children}
    </table>
  </div>
);

const THead = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn("bg-zinc-50 border-b border-zinc-200", className)} {...props}>
    {children}
  </thead>
);

const TBody = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn("divide-y divide-zinc-100 bg-white", className)} {...props}>
    {children}
  </tbody>
);

const TR = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn("hover:bg-zinc-50/50 transition-colors h-14 text-sm", className)} {...props}>
    {children}
  </tr>
);

const TH = ({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn("px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider", className)} {...props}>
    {children}
  </th>
);

const TD = ({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn("px-4 py-3 text-sm text-zinc-900", className)} {...props}>
    {children}
  </td>
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
          <span className={cn("font-bold text-zinc-900", size === 'lg' ? "text-lg" : "text-xs")}>{Math.round(percentage)}%</span>
        </div>
      </div>
      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</span>
    </div>
  );
};

const SimpleBarChart = ({ data, label, color = "bg-indigo-500" }: { data: { label: string; value: number; total: number }[]; label: string; color?: string }) => {
  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 border-b border-zinc-100 pb-2">{label}</h4>
      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {data.map((item, i) => {
          const percentage = item.total > 0 ? (item.value / item.total) * 100 : 0;
          return (
            <div key={i} className="group">
              <div className="flex justify-between items-center mb-1.5 text-xs font-bold text-zinc-700">
                <span className="truncate mr-4">{item.label}</span>
                <span className="text-zinc-400 font-mono text-xs whitespace-nowrap">{item.value}/{item.total}</span>
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
export type ToastType = 'success' | 'error' | 'info' | 'warning';
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
                  toast.type === 'warning' ? "bg-amber-50/90 border-amber-200 text-amber-800" :
                    "bg-blue-50/90 border-blue-200 text-blue-800"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> :
                toast.type === 'error' ? <XCircle size={18} className="text-red-500" /> :
                  toast.type === 'warning' ? <AlertTriangle size={18} className="text-amber-500" /> :
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

function StudentProfileView({
  user,
  token,
  addToast
}: {
  user: User | null;
  token: string | null;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('personal');

  // Form states for Personal & Avatar Photo
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [semester, setSemester] = useState<number>(1);
  const [cgpa, setCgpa] = useState<number | string>(0);
  const [currentArrears, setCurrentArrears] = useState<number>(0);
  const [historyOfArrears, setHistoryOfArrears] = useState<number>(0);
  const [aboutMe, setAboutMe] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Form states for Skills
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('Technical');
  const [newSkillLevel, setNewSkillLevel] = useState('Intermediate');
  const [addingSkill, setAddingSkill] = useState(false);

  // Form states for Projects
  const [newProjName, setNewProjName] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');
  const [newProjTech, setNewProjTech] = useState('');
  const [newProjGithub, setNewProjGithub] = useState('');
  const [newProjDemo, setNewProjDemo] = useState('');
  const [addingProject, setAddingProject] = useState(false);

  // Form states for Internships
  const [newInternCompany, setNewInternCompany] = useState('');
  const [newInternRole, setNewInternRole] = useState('');
  const [newInternDuration, setNewInternDuration] = useState('');
  const [newInternMode, setNewInternMode] = useState('Offline');
  const [newInternCertUrl, setNewInternCertUrl] = useState('');
  const [addingInternship, setAddingInternship] = useState(false);

  // Form states for Certifications
  const [newCertName, setNewCertName] = useState('');
  const [newCertProvider, setNewCertProvider] = useState('');
  const [newCertIssueDate, setNewCertIssueDate] = useState('');
  const [newCertCredentialId, setNewCertCredentialId] = useState('');
  const [newCertUrl, setNewCertUrl] = useState('');
  const [addingCert, setAddingCert] = useState(false);

  // Form states for Coding Profiles
  const [codingGithub, setCodingGithub] = useState('');
  const [codingLeetcode, setCodingLeetcode] = useState('');
  const [codingHackerrank, setCodingHackerrank] = useState('');
  const [codingCodechef, setCodingCodechef] = useState('');
  const [codingGfg, setCodingGfg] = useState('');
  const [codingLinkedin, setCodingLinkedin] = useState('');
  const [codingPortfolio, setCodingPortfolio] = useState('');
  const [savingCoding, setSavingCoding] = useState(false);

  // Form states for Resume
  const [resumeUrl, setResumeUrl] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [savingResume, setSavingResume] = useState(false);

  // Form states for Achievements
  const [newAchTitle, setNewAchTitle] = useState('');
  const [newAchCategory, setNewAchCategory] = useState('Hackathons');
  const [newAchDesc, setNewAchDesc] = useState('');
  const [newAchDate, setNewAchDate] = useState('');
  const [addingAch, setAddingAch] = useState(false);

  // Form states for Languages
  const [newLangName, setNewLangName] = useState('');
  const [newLangProf, setNewLangProf] = useState('Fluent');
  const [addingLang, setAddingLang] = useState(false);

  // Form states for Career Preferences
  const [prefRole, setPrefRole] = useState('');
  const [prefDomain, setPrefDomain] = useState('');
  const [prefLocation, setPrefLocation] = useState('');
  const [prefRelocate, setPrefRelocate] = useState(true);
  const [prefWorkMode, setPrefWorkMode] = useState('Hybrid');
  const [savingCareer, setSavingCareer] = useState(false);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/student/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        if (data.academic && data.academic.avatar_url) {
          setAvatarUrl(data.academic.avatar_url);
        }
        if (data.personal) {
          setMobileNumber(data.personal.mobile_number || '');
          setDateOfBirth(data.personal.date_of_birth || '');
          setSemester(data.personal.semester || 1);
          setCgpa(data.personal.cgpa || 0);
          setCurrentArrears(data.personal.current_arrears || 0);
          setHistoryOfArrears(data.personal.history_of_arrears || 0);
          setAboutMe(data.personal.about_me || '');
        }
        if (data.coding_profiles) {
          setCodingGithub(data.coding_profiles.github || '');
          setCodingLeetcode(data.coding_profiles.leetcode || '');
          setCodingHackerrank(data.coding_profiles.hackerrank || '');
          setCodingCodechef(data.coding_profiles.codechef || '');
          setCodingGfg(data.coding_profiles.geeksforgeeks || '');
          setCodingLinkedin(data.coding_profiles.linkedin || '');
          setCodingPortfolio(data.coding_profiles.portfolio || '');
        }
        if (data.resume) {
          setResumeUrl(data.resume.resume_url || '');
          setResumeFileName(data.resume.file_name || 'Resume.pdf');
        }
        if (data.career_preferences) {
          setPrefRole(data.career_preferences.preferred_role || '');
          setPrefDomain(data.career_preferences.preferred_domain || '');
          setPrefLocation(data.career_preferences.preferred_location || '');
          setPrefRelocate(data.career_preferences.willing_to_relocate ?? true);
          setPrefWorkMode(data.career_preferences.work_mode || 'Hybrid');
        }
      }
    } catch (e) {
      addToast('Error loading profile data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchProfileData();
  }, [token]);

  // Avatar Photo Handlers
  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setUploadingAvatar(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setAvatarUrl(data.avatar_url);
        addToast('Profile photo updated successfully!', 'success');
        fetchProfileData();
      } else {
        addToast(data.error || 'Failed to upload photo', 'error');
      }
    } catch {
      addToast('Error uploading photo', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarUrlSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingAvatar(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatar_url: avatarUrl })
      });
      if (res.ok) {
        addToast('Profile photo URL saved!', 'success');
        fetchProfileData();
      }
    } catch {
      addToast('Error saving photo URL', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ remove: true })
      });
      if (res.ok) {
        setAvatarUrl('');
        addToast('Profile photo removed', 'info');
        fetchProfileData();
      }
    } catch {
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Submit Handlers
  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPersonal(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/personal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mobile_number: mobileNumber,
          date_of_birth: dateOfBirth,
          semester: Number(semester),
          cgpa: Number(cgpa),
          current_arrears: Number(currentArrears),
          history_of_arrears: Number(historyOfArrears),
          about_me: aboutMe
        })
      });
      if (res.ok) {
        addToast('Personal information updated!', 'success');
        fetchProfileData();
      } else {
        addToast('Failed to update personal info', 'error');
      }
    } catch {
      addToast('Network error saving personal details', 'error');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    setAddingSkill(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ skill_name: newSkillName, category: newSkillCategory, level: newSkillLevel })
      });
      if (res.ok) {
        addToast('Skill added!', 'success');
        setNewSkillName('');
        fetchProfileData();
      }
    } catch {
      addToast('Failed to add skill', 'error');
    } finally {
      setAddingSkill(false);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/student/profile/skills/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('Skill removed', 'info');
        fetchProfileData();
      }
    } catch { }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName.trim()) return;
    setAddingProject(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          project_name: newProjName,
          description: newProjDesc,
          tech_stack: newProjTech,
          github_url: newProjGithub,
          live_demo_url: newProjDemo
        })
      });
      if (res.ok) {
        addToast('Project added!', 'success');
        setNewProjName(''); setNewProjDesc(''); setNewProjTech(''); setNewProjGithub(''); setNewProjDemo('');
        fetchProfileData();
      }
    } catch {
      addToast('Failed to add project', 'error');
    } finally {
      setAddingProject(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/student/profile/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Project removed', 'info');
      fetchProfileData();
    } catch { }
  };

  const handleAddInternship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInternCompany.trim()) return;
    setAddingInternship(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/internships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          company: newInternCompany,
          role: newInternRole,
          duration: newInternDuration,
          mode: newInternMode,
          certificate_url: newInternCertUrl
        })
      });
      if (res.ok) {
        addToast('Internship added!', 'success');
        setNewInternCompany(''); setNewInternRole(''); setNewInternDuration(''); setNewInternCertUrl('');
        fetchProfileData();
      }
    } catch {
      addToast('Failed to add internship', 'error');
    } finally {
      setAddingInternship(false);
    }
  };

  const handleDeleteInternship = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/student/profile/internships/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Internship removed', 'info');
      fetchProfileData();
    } catch { }
  };

  const handleAddCertification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCertName.trim()) return;
    setAddingCert(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/certifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          certificate_name: newCertName,
          provider: newCertProvider,
          issue_date: newCertIssueDate,
          credential_id: newCertCredentialId,
          certificate_url: newCertUrl
        })
      });
      if (res.ok) {
        addToast('Certification added!', 'success');
        setNewCertName(''); setNewCertProvider(''); setNewCertIssueDate(''); setNewCertCredentialId(''); setNewCertUrl('');
        fetchProfileData();
      }
    } catch {
      addToast('Failed to add certification', 'error');
    } finally {
      setAddingCert(false);
    }
  };

  const handleDeleteCert = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/student/profile/certifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Certification removed', 'info');
      fetchProfileData();
    } catch { }
  };

  const handleSaveCodingProfiles = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCoding(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/coding-profiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          github: codingGithub,
          leetcode: codingLeetcode,
          hackerrank: codingHackerrank,
          codechef: codingCodechef,
          geeksforgeeks: codingGfg,
          linkedin: codingLinkedin,
          portfolio: codingPortfolio
        })
      });
      if (res.ok) {
        addToast('Coding profiles saved!', 'success');
        fetchProfileData();
      }
    } catch {
      addToast('Failed to save coding profiles', 'error');
    } finally {
      setSavingCoding(false);
    }
  };

  const handleSaveResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeUrl.trim()) return;
    setSavingResume(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resume_url: resumeUrl, file_name: resumeFileName || 'Resume.pdf' })
      });
      if (res.ok) {
        addToast('Resume updated!', 'success');
        fetchProfileData();
      }
    } catch {
      addToast('Failed to update resume', 'error');
    } finally {
      setSavingResume(false);
    }
  };

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAchTitle.trim()) return;
    setAddingAch(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/achievements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newAchTitle,
          category: newAchCategory,
          description: newAchDesc,
          event_date: newAchDate
        })
      });
      if (res.ok) {
        addToast('Achievement added!', 'success');
        setNewAchTitle(''); setNewAchDesc(''); setNewAchDate('');
        fetchProfileData();
      }
    } catch {
      addToast('Failed to add achievement', 'error');
    } finally {
      setAddingAch(false);
    }
  };

  const handleDeleteAchievement = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/student/profile/achievements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Achievement removed', 'info');
      fetchProfileData();
    } catch { }
  };

  const handleAddLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangName.trim()) return;
    setAddingLang(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/languages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: newLangName, proficiency: newLangProf })
      });
      if (res.ok) {
        addToast('Language added!', 'success');
        setNewLangName('');
        fetchProfileData();
      }
    } catch {
      addToast('Failed to add language', 'error');
    } finally {
      setAddingLang(false);
    }
  };

  const handleDeleteLanguage = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/student/profile/languages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Language removed', 'info');
      fetchProfileData();
    } catch { }
  };

  const handleSaveCareer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCareer(true);
    try {
      const res = await fetch(`${API_URL}/api/student/profile/career-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          preferred_role: prefRole,
          preferred_domain: prefDomain,
          preferred_location: prefLocation,
          willing_to_relocate: prefRelocate,
          work_mode: prefWorkMode
        })
      });
      if (res.ok) {
        addToast('Career preferences saved!', 'success');
        fetchProfileData();
      }
    } catch {
      addToast('Failed to save career preferences', 'error');
    } finally {
      setSavingCareer(false);
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <Card className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <Loader2 size={40} className="animate-spin text-black mb-4" />
          <p className="font-semibold text-sm">Loading Student Profile...</p>
        </Card>
      </PageLayout>
    );
  }

  const sections = [
    { id: 'personal', label: '1. Personal Information', icon: User },
    { id: 'skills', label: '2. Skills', icon: Code },
    { id: 'projects', label: '3. Projects', icon: Layers },
    { id: 'internships', label: '4. Internships', icon: Briefcase },
    { id: 'certifications', label: '5. Certifications', icon: Award },
    { id: 'coding', label: '6. Coding Profiles', icon: Globe },
    { id: 'resume', label: '7. Resume', icon: FileText },
    { id: 'achievements', label: '8. Achievements', icon: Sparkles },
    { id: 'languages', label: '9. Languages', icon: Languages },
    { id: 'career', label: '10. Career Preferences', icon: Compass },
  ];

  const acad = {
    full_name: profile?.academic?.full_name || user?.full_name || 'N/A',
    register_number: profile?.academic?.register_number || user?.register_number || user?.username || 'N/A',
    email: profile?.academic?.email || user?.email || 'N/A',
    department_name: profile?.academic?.department_name || user?.department_name || 'Information Technology',
    class_name: profile?.academic?.class_name || user?.class_name || 'Unassigned Section',
    batch: profile?.academic?.batch || user?.batch || '2023 - 2027',
    year: profile?.academic?.year ? (String(profile.academic.year).startsWith('Year') ? profile.academic.year : `Year ${profile.academic.year}`) : (user?.year ? `Year ${user.year}` : 'N/A'),
    gender: profile?.academic?.gender || user?.gender || 'Not Specified',
    avatar_url: profile?.academic?.avatar_url || user?.avatar_url || ''
  };

  return (
    <PageLayout>
      <div className="space-y-6 pb-12">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight flex items-center gap-2">
              <GraduationCap size={28} className="text-indigo-600" /> Student Academic Profile
            </h1>
            <p className="text-xs text-zinc-500 font-semibold">
              Official records for {acad.full_name} ({acad.register_number})
            </p>
          </div>

          {/* Section Pill Selectors */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 custom-scrollbar">
            {sections.map(s => {
              const SIcon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0",
                    activeSection === s.id
                      ? "bg-black text-white shadow-md"
                      : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
                  )}
                >
                  <SIcon size={13} />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. PERSONAL INFORMATION */}
        {activeSection === 'personal' && (
          <div className="space-y-6">
            {/* Student Profile Photo Card */}
            <Card className="p-5 md:p-6 bg-white border-zinc-200">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Camera size={16} className="text-indigo-600" /> Student Profile Photo
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Photo Display Avatar */}
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 rounded-2xl bg-zinc-900 p-1 shadow-md border border-zinc-200 flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={acad.full_name || 'Profile'} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl font-black">
                        {(acad.full_name || 'ST').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload & URL Controls */}
                <div className="space-y-3 flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer px-4 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all flex items-center gap-2">
                      {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      <span>Upload Image File</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileUpload}
                        disabled={uploadingAvatar}
                        className="hidden"
                      />
                    </label>

                    {avatarUrl && (
                      <Button type="button" onClick={handleRemoveAvatar} disabled={uploadingAvatar} variant="secondary" className="text-xs text-red-600 hover:text-red-700">
                        <Trash2 size={14} /> Remove Photo
                      </Button>
                    )}
                  </div>

                  <form onSubmit={handleAvatarUrlSave} className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="Or paste image URL (https://...)"
                      value={avatarUrl}
                      onChange={e => setAvatarUrl(e.target.value)}
                      className="text-xs flex-1"
                    />
                    <Button type="submit" disabled={uploadingAvatar} variant="secondary" className="text-xs shrink-0">
                      <Save size={14} /> Save Link
                    </Button>
                  </form>
                </div>
              </div>
            </Card>

            {/* Read Only Academic Info */}
            <Card className="p-5 md:p-6 bg-white border-zinc-200">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Shield size={16} className="text-indigo-600" /> Read-Only Academic Identity
                </h3>
                <span className="text-[11px] text-zinc-400 font-semibold flex items-center gap-1">
                  <Lock size={12} /> Institutional Record
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Full Name</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{acad.full_name}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Register Number</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{acad.register_number}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">College Email</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{acad.email}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Department</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{acad.department_name}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Section</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{acad.class_name}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Batch</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{acad.batch}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Year</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{acad.year}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Gender</p>
                  <p className="text-sm font-bold text-zinc-900 truncate">{acad.gender}</p>
                </div>
              </div>
            </Card>

            {/* Editable Personal Form */}
            <Card className="p-5 md:p-6 bg-white border-zinc-200">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
                <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                  <Edit3 size={16} className="text-indigo-600" /> Editable Personal Information
                </h3>
              </div>

              <form onSubmit={handleSavePersonal} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Mobile Number</label>
                    <Input
                      type="tel"
                      value={mobileNumber}
                      onChange={e => setMobileNumber(e.target.value)}
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Date of Birth</label>
                    <Input
                      type="date"
                      value={dateOfBirth}
                      onChange={e => setDateOfBirth(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Semester</label>
                    <Select value={semester} onChange={e => setSemester(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">CGPA</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={cgpa}
                      onChange={e => setCgpa(e.target.value)}
                      placeholder="e.g. 8.50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Current Arrears</label>
                    <Input
                      type="number"
                      min="0"
                      value={currentArrears}
                      onChange={e => setCurrentArrears(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">History of Arrears</label>
                    <Input
                      type="number"
                      min="0"
                      value={historyOfArrears}
                      onChange={e => setHistoryOfArrears(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">About Me</label>
                  <Textarea
                    value={aboutMe}
                    onChange={e => setAboutMe(e.target.value)}
                    placeholder="Brief intro about your academic focus, career goals, or technical interests..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={savingPersonal} variant="primary" className="px-6">
                    {savingPersonal ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>Save Personal Information</span>
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* 2. SKILLS */}
        {activeSection === 'skills' && (
          <Card className="p-5 md:p-6 bg-white border-zinc-200">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Code size={16} className="text-indigo-600" /> Technical & Soft Skills
            </h3>

            {/* Add Skill Form */}
            <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row gap-3 mb-6 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <Input
                type="text"
                placeholder="Skill name (e.g. React, Python, Communication)"
                value={newSkillName}
                onChange={e => setNewSkillName(e.target.value)}
                required
                className="flex-1"
              />
              <Select value={newSkillCategory} onChange={e => setNewSkillCategory(e.target.value)} className="sm:w-40">
                <option value="Technical">Technical</option>
                <option value="Soft Skill">Soft Skill</option>
                <option value="Tool">Tool</option>
                <option value="Domain">Domain</option>
              </Select>
              <Select value={newSkillLevel} onChange={e => setNewSkillLevel(e.target.value)} className="sm:w-40">
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </Select>
              <Button type="submit" disabled={addingSkill} variant="primary" className="shrink-0">
                {addingSkill ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>Add Skill</span>
              </Button>
            </form>

            {/* Skills Pills List */}
            <div className="flex flex-wrap gap-2">
              {(profile?.skills || []).length === 0 ? (
                <p className="text-xs text-zinc-400 py-4">No skills added yet.</p>
              ) : (
                profile.skills.map((sk: any) => (
                  <div key={sk.id} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900">
                    <span>{sk.skill_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-bold uppercase">{sk.level}</span>
                    <button type="button" onClick={() => handleDeleteSkill(sk.id)} className="text-zinc-400 hover:text-red-600 transition-colors ml-1">
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* 3. PROJECTS */}
        {activeSection === 'projects' && (
          <Card className="p-5 md:p-6 bg-white border-zinc-200 space-y-6">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-indigo-600" /> Academic & Personal Projects
            </h3>

            <form onSubmit={handleAddProject} className="space-y-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Project Name *" value={newProjName} onChange={e => setNewProjName(e.target.value)} required />
                <Input placeholder="Tech Stack (e.g. React, Node.js, PostgreSQL)" value={newProjTech} onChange={e => setNewProjTech(e.target.value)} />
                <Input type="url" placeholder="GitHub Repository URL" value={newProjGithub} onChange={e => setNewProjGithub(e.target.value)} />
                <Input type="url" placeholder="Live Demo URL" value={newProjDemo} onChange={e => setNewProjDemo(e.target.value)} />
              </div>
              <Textarea placeholder="Project Description..." value={newProjDesc} onChange={e => setNewProjDesc(e.target.value)} rows={2} />
              <div className="flex justify-end">
                <Button type="submit" disabled={addingProject} variant="primary">
                  {addingProject ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Add Project</span>
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              {(profile?.projects || []).length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center">No projects added yet.</p>
              ) : (
                profile.projects.map((p: any) => (
                  <div key={p.id} className="p-4 bg-white border border-zinc-200 rounded-xl flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-sm font-bold text-zinc-900">{p.project_name}</h4>
                      {p.tech_stack && <p className="text-xs font-semibold text-indigo-600">{p.tech_stack}</p>}
                      {p.description && <p className="text-xs text-zinc-600">{p.description}</p>}
                      <div className="flex gap-3 pt-1 text-xs">
                        {p.github_url && <a href={p.github_url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline flex items-center gap-1"><Github size={12} /> GitHub</a>}
                        {p.live_demo_url && <a href={p.live_demo_url} target="_blank" rel="noreferrer" className="text-emerald-600 font-bold hover:underline flex items-center gap-1"><Globe size={12} /> Live Demo</a>}
                      </div>
                    </div>
                    <button type="button" onClick={() => handleDeleteProject(p.id)} className="text-zinc-400 hover:text-red-600 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* 4. INTERNSHIPS */}
        {activeSection === 'internships' && (
          <Card className="p-5 md:p-6 bg-white border-zinc-200 space-y-6">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Briefcase size={16} className="text-indigo-600" /> Internship & Work Experience
            </h3>

            <form onSubmit={handleAddInternship} className="space-y-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <Input placeholder="Company / Organization *" value={newInternCompany} onChange={e => setNewInternCompany(e.target.value)} required />
                <Input placeholder="Role (e.g. Web Dev Intern)" value={newInternRole} onChange={e => setNewInternRole(e.target.value)} />
                <Input placeholder="Duration (e.g. 3 Months, Jun-Aug 2025)" value={newInternDuration} onChange={e => setNewInternDuration(e.target.value)} />
                <Select value={newInternMode} onChange={e => setNewInternMode(e.target.value)}>
                  <option value="Offline">Offline / On-site</option>
                  <option value="Online">Online / Remote</option>
                  <option value="Hybrid">Hybrid</option>
                </Select>
                <Input type="url" placeholder="Certificate Link / URL" value={newInternCertUrl} onChange={e => setNewInternCertUrl(e.target.value)} className="sm:col-span-2" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={addingInternship} variant="primary">
                  {addingInternship ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Add Internship</span>
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              {(profile?.internships || []).length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center">No internships added yet.</p>
              ) : (
                profile.internships.map((intern: any) => (
                  <div key={intern.id} className="p-4 bg-white border border-zinc-200 rounded-xl flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900">{intern.company}</h4>
                      <p className="text-xs font-semibold text-zinc-600">{intern.role} • {intern.duration} ({intern.mode})</p>
                      {intern.certificate_url && (
                        <a href={intern.certificate_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 mt-1">
                          <ExternalLink size={12} /> View Certificate
                        </a>
                      )}
                    </div>
                    <button type="button" onClick={() => handleDeleteInternship(intern.id)} className="text-zinc-400 hover:text-red-600 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* 5. CERTIFICATIONS */}
        {activeSection === 'certifications' && (
          <Card className="p-5 md:p-6 bg-white border-zinc-200 space-y-6">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Award size={16} className="text-indigo-600" /> Certifications & Courses
            </h3>

            <form onSubmit={handleAddCertification} className="space-y-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Certificate Name *" value={newCertName} onChange={e => setNewCertName(e.target.value)} required />
                <Input placeholder="Provider (e.g. Coursera, NPTEL, AWS)" value={newCertProvider} onChange={e => setNewCertProvider(e.target.value)} />
                <Input type="date" placeholder="Issue Date" value={newCertIssueDate} onChange={e => setNewCertIssueDate(e.target.value)} />
                <Input placeholder="Credential ID" value={newCertCredentialId} onChange={e => setNewCertCredentialId(e.target.value)} />
                <Input type="url" placeholder="Certificate URL / Link" value={newCertUrl} onChange={e => setNewCertUrl(e.target.value)} className="sm:col-span-2" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={addingCert} variant="primary">
                  {addingCert ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Add Certification</span>
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              {(profile?.certifications || []).length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center">No certifications added yet.</p>
              ) : (
                profile.certifications.map((c: any) => (
                  <div key={c.id} className="p-4 bg-white border border-zinc-200 rounded-xl flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900">{c.certificate_name}</h4>
                      <p className="text-xs font-semibold text-zinc-600">{c.provider} {c.issue_date ? `• Issued ${c.issue_date}` : ''}</p>
                      {c.credential_id && <p className="text-[11px] text-zinc-400">Credential ID: {c.credential_id}</p>}
                      {c.certificate_url && (
                        <a href={c.certificate_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 mt-1">
                          <ExternalLink size={12} /> View Credential
                        </a>
                      )}
                    </div>
                    <button type="button" onClick={() => handleDeleteCert(c.id)} className="text-zinc-400 hover:text-red-600 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* 6. CODING PROFILES */}
        {activeSection === 'coding' && (
          <Card className="p-5 md:p-6 bg-white border-zinc-200">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Globe size={16} className="text-indigo-600" /> Coding & Professional Profiles
            </h3>

            <form onSubmit={handleSaveCodingProfiles} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">GitHub</label>
                  <Input type="url" placeholder="https://github.com/username" value={codingGithub} onChange={e => setCodingGithub(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">LeetCode</label>
                  <Input type="url" placeholder="https://leetcode.com/username" value={codingLeetcode} onChange={e => setCodingLeetcode(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">HackerRank</label>
                  <Input type="url" placeholder="https://hackerrank.com/username" value={codingHackerrank} onChange={e => setCodingHackerrank(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">CodeChef</label>
                  <Input type="url" placeholder="https://codechef.com/users/username" value={codingCodechef} onChange={e => setCodingCodechef(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">GeeksforGeeks</label>
                  <Input type="url" placeholder="https://geeksforgeeks.org/user/username" value={codingGfg} onChange={e => setCodingGfg(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">LinkedIn</label>
                  <Input type="url" placeholder="https://linkedin.com/in/username" value={codingLinkedin} onChange={e => setCodingLinkedin(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Personal Portfolio / Website</label>
                  <Input type="url" placeholder="https://yourportfolio.com" value={codingPortfolio} onChange={e => setCodingPortfolio(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={savingCoding} variant="primary" className="px-6">
                  {savingCoding ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Save Coding Profiles</span>
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* 7. RESUME */}
        {activeSection === 'resume' && (
          <Card className="p-5 md:p-6 bg-white border-zinc-200">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText size={16} className="text-indigo-600" /> Student Resume & CV
            </h3>

            <form onSubmit={handleSaveResume} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Resume File Link / PDF URL</label>
                <Input
                  type="url"
                  placeholder="https://drive.google.com/... or Cloudinary PDF URL"
                  value={resumeUrl}
                  onChange={e => setResumeUrl(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Display File Name</label>
                <Input
                  type="text"
                  placeholder="e.g. John_Doe_Resume_2026.pdf"
                  value={resumeFileName}
                  onChange={e => setResumeFileName(e.target.value)}
                />
              </div>

              {profile?.resume && (
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-zinc-900">{profile.resume.file_name || 'Resume.pdf'}</p>
                    <p className="text-[10px] text-zinc-400">Last Updated: {new Date(profile.resume.last_updated).toLocaleString()}</p>
                  </div>
                  <a href={profile.resume.resume_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-black text-white rounded-lg font-bold hover:bg-zinc-800 flex items-center gap-1">
                    <ExternalLink size={12} /> View Resume
                  </a>
                </div>
              )}

              <div className="pt-2">
                <Button type="submit" disabled={savingResume} variant="primary" className="px-6">
                  {savingResume ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                  <span>Save Resume</span>
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* 8. ACHIEVEMENTS */}
        {activeSection === 'achievements' && (
          <Card className="p-5 md:p-6 bg-white border-zinc-200 space-y-6">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" /> Honors, Hackathons & Achievements
            </h3>

            <form onSubmit={handleAddAchievement} className="space-y-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input placeholder="Achievement / Event Title *" value={newAchTitle} onChange={e => setNewAchTitle(e.target.value)} required className="sm:col-span-2" />
                <Select value={newAchCategory} onChange={e => setNewAchCategory(e.target.value)}>
                  <option value="Hackathons">Hackathons</option>
                  <option value="SIH">Smart India Hackathon (SIH)</option>
                  <option value="Coding Competitions">Coding Competitions</option>
                  <option value="Paper Presentations">Paper Presentations</option>
                  <option value="Awards">Awards & Honors</option>
                </Select>
                <Input placeholder="Date / Year (e.g. Feb 2026)" value={newAchDate} onChange={e => setNewAchDate(e.target.value)} />
              </div>
              <Textarea placeholder="Description / Details of your achievement..." value={newAchDesc} onChange={e => setNewAchDesc(e.target.value)} rows={2} />
              <div className="flex justify-end">
                <Button type="submit" disabled={addingAch} variant="primary">
                  {addingAch ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Add Achievement</span>
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              {(profile?.achievements || []).length === 0 ? (
                <p className="text-xs text-zinc-400 py-4 text-center">No achievements added yet.</p>
              ) : (
                profile.achievements.map((ach: any) => (
                  <div key={ach.id} className="p-4 bg-white border border-zinc-200 rounded-xl flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-zinc-900">{ach.title}</h4>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold uppercase">{ach.category}</span>
                      </div>
                      {ach.event_date && <p className="text-[11px] text-zinc-400">{ach.event_date}</p>}
                      {ach.description && <p className="text-xs text-zinc-600 mt-1">{ach.description}</p>}
                    </div>
                    <button type="button" onClick={() => handleDeleteAchievement(ach.id)} className="text-zinc-400 hover:text-red-600 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* 9. LANGUAGES */}
        {activeSection === 'languages' && (
          <Card className="p-5 md:p-6 bg-white border-zinc-200">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Languages size={16} className="text-indigo-600" /> Languages Spoken
            </h3>

            <form onSubmit={handleAddLanguage} className="flex flex-col sm:flex-row gap-3 mb-6 p-3 bg-zinc-50 rounded-xl border border-zinc-200">
              <Input placeholder="Language (e.g. English, Tamil, Hindi)" value={newLangName} onChange={e => setNewLangName(e.target.value)} required className="flex-1" />
              <Select value={newLangProf} onChange={e => setNewLangProf(e.target.value)} className="sm:w-44">
                <option value="Basic">Basic</option>
                <option value="Conversational">Conversational</option>
                <option value="Fluent">Fluent</option>
                <option value="Native">Native / Bilingual</option>
              </Select>
              <Button type="submit" disabled={addingLang} variant="primary">
                {addingLang ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>Add Language</span>
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              {(profile?.languages || []).length === 0 ? (
                <p className="text-xs text-zinc-400 py-4">No languages added yet.</p>
              ) : (
                profile.languages.map((l: any) => (
                  <div key={l.id} className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900">
                    <span>{l.language}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-bold uppercase">{l.proficiency}</span>
                    <button type="button" onClick={() => handleDeleteLanguage(l.id)} className="text-zinc-400 hover:text-red-600 ml-1">
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* 10. CAREER PREFERENCES */}
        {activeSection === 'career' && (
          <Card className="p-5 md:p-6 bg-white border-zinc-200">
            <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Compass size={16} className="text-indigo-600" /> Career Preferences
            </h3>

            <form onSubmit={handleSaveCareer} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Preferred Role</label>
                  <Input placeholder="e.g. Software Engineer, Data Analyst" value={prefRole} onChange={e => setPrefRole(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Preferred Domain</label>
                  <Input placeholder="e.g. Web Development, AI/ML, Cloud" value={prefDomain} onChange={e => setPrefDomain(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Preferred Location</label>
                  <Input placeholder="e.g. Chennai, Bangalore, Hyderabad" value={prefLocation} onChange={e => setPrefLocation(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1">Work Mode Preference</label>
                  <Select value={prefWorkMode} onChange={e => setPrefWorkMode(e.target.value)}>
                    <option value="On-site">On-site</option>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                  </Select>
                </div>
                <div className="sm:col-span-2 flex items-center gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="relocateCheck"
                    checked={prefRelocate}
                    onChange={e => setPrefRelocate(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-black focus:ring-black"
                  />
                  <label htmlFor="relocateCheck" className="text-xs font-bold text-zinc-800 cursor-pointer">
                    Willing to Relocate to job location
                  </label>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={savingCareer} variant="primary" className="px-6">
                  {savingCareer ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Save Career Preferences</span>
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}

function SettingsView({
  user,
  token,
  addToast
}: {
  user: User | null;
  token: string | null;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');



  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/api/settings/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Password changed successfully!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.error || 'Failed to change password');
        addToast(data.error || 'Failed to change password', 'error');
      }
    } catch (err) {
      setPasswordError('Error connecting to server');
      addToast('Error changing password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const [telegramStats, setTelegramStats] = useState<any>(null);
  const [groupChatIdInput, setGroupChatIdInput] = useState('');
  const [savingGroupChat, setSavingGroupChat] = useState(false);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Web Push Notification States
  const [pushSupported, setPushSupported] = useState<boolean>(false);
  const [pushSubscribed, setPushSubscribed] = useState<boolean>(false);
  const [pushPermission, setPushPermission] = useState<string>('default');
  const [pushLoading, setPushLoading] = useState<boolean>(false);
  const [pushTestLoading, setPushTestLoading] = useState<boolean>(false);

  useEffect(() => {
    const checkPush = async () => {
      const supported = isPushSupported();
      setPushSupported(supported);
      if (supported) {
        const perm = getNotificationPermissionState();
        setPushPermission(perm);
        const isSub = await checkIsPushSubscribed();
        setPushSubscribed(isSub);

        // If user already granted permission in browser, ensure subscription is synced to DB
        if (perm === 'granted' && token) {
          subscribeToPushNotifications(token, API_URL)
            .then(res => {
              if (res.success) {
                setPushSubscribed(true);
              }
            })
            .catch(() => {});
        }
      }
    };
    checkPush();
  }, [token]);

  const handleTogglePush = async () => {
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        const res = await unsubscribeFromPushNotifications(token, API_URL);
        if (res.success) {
          setPushSubscribed(false);
          addToast(res.message, 'info');
        } else {
          addToast(res.message, 'error');
        }
      } else {
        const res = await subscribeToPushNotifications(token, API_URL);
        if (res.success) {
          setPushSubscribed(true);
          setPushPermission('granted');
          addToast(res.message, 'success');
        } else {
          setPushPermission(getNotificationPermissionState());
          addToast(res.message, 'error');
        }
      }
    } catch {
      addToast('Failed to update push notification settings', 'error');
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setPushTestLoading(true);
    try {
      // Show immediate notification on laptop/desktop via active Service Worker
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          if (reg && reg.showNotification) {
            reg.showNotification('🔔 VSBEC IT TaskManager', {
              body: '✅ Desktop notification test succeeded on this laptop!',
              icon: `${window.location.origin}/logo.png`,
              badge: `${window.location.origin}/badge.png`,
              tag: `test-local-${Date.now()}`,
              requireInteraction: true
            });
          }
        } catch (localErr) {
          console.warn('[Push] Local notification warning:', localErr);
        }
      }

      const res = await sendTestPushNotification(token, API_URL);
      if (res.success) {
        addToast(res.message, 'success');
      } else {
        addToast(res.message, 'error');
      }
    } catch {
      addToast('Error sending test push notification', 'error');
    } finally {
      setPushTestLoading(false);
    }
  };

  const fetchTelegramStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/telegram/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTelegramStats(data);
        if (data.groupChatId) setGroupChatIdInput(data.groupChatId);
      }
    } catch (err) {
      console.error('Error fetching Telegram status:', err);
    }
  };

  useEffect(() => {
    fetchTelegramStatus();
  }, [token]);

  const handleSaveGroupChat = async () => {
    if (!groupChatIdInput.trim()) {
      addToast('Please enter a valid Group Chat ID', 'error');
      return;
    }
    setSavingGroupChat(true);
    try {
      const res = await fetch(`${API_URL}/api/telegram/set-group-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId: groupChatIdInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Group Chat ID saved!', 'success');
        fetchTelegramStatus();
      } else {
        addToast(data.error || 'Failed to save Group Chat ID', 'error');
      }
    } catch {
      addToast('Error saving Group Chat ID', 'error');
    } finally {
      setSavingGroupChat(false);
    }
  };

  const handleSendGroupSummaryNow = async () => {
    setSendingSummary(true);
    try {
      const res = await fetch(`${API_URL}/api/telegram/send-group-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetChatId: groupChatIdInput.trim() || undefined })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || 'Group summary sent to Telegram!', 'success');
      } else {
        addToast(data.message || data.error || 'Failed to send group summary', 'error');
      }
    } catch {
      addToast('Error sending group summary', 'error');
    } finally {
      setSendingSummary(false);
    }
  };

  const handleSendRemindersNow = async () => {
    setSendingReminders(true);
    try {
      const res = await fetch(`${API_URL}/api/telegram/send-reminders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.details || `Reminders sent to ${data.notifiedCount} student(s)!`, 'success');
      } else {
        addToast(data.details || data.error || 'Failed to send reminders', 'error');
      }
    } catch {
      addToast('Error triggering reminders', 'error');
    } finally {
      setSendingReminders(false);
    }
  };

  const handleSendTestMessage = async (targetId?: string) => {
    setSendingTest(true);
    try {
      const res = await fetch(`${API_URL}/api/telegram/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetChatId: targetId })
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Test notification sent successfully to Telegram!', 'success');
      } else {
        addToast(data.error || 'Failed to send test message', 'error');
      }
    } catch {
      addToast('Error sending test message', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm('Are you sure you want to disconnect your Telegram account from IT TaskManager?')) return;
    try {
      const res = await fetch(`${API_URL}/api/student/unlink-telegram`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('Telegram disconnected successfully.', 'info');
        fetchTelegramStatus();
      }
    } catch {
      addToast('Error disconnecting Telegram', 'error');
    }
  };

  return (
    <PageLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
          <div>
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight flex items-center gap-2">
              <Settings size={24} className="text-zinc-900" /> Account Settings
            </h1>
            <p className="text-xs text-zinc-500 font-medium">Manage your account security and preferences</p>
          </div>
        </div>

        {/* Account Details Overview */}
        <Card className="p-6 bg-white border-zinc-200">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <User size={16} className="text-indigo-600" /> Account Identity Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Full Name</p>
              <p className="text-sm font-bold text-zinc-900 truncate">{user?.full_name}</p>
            </div>
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Role</p>
              <p className="text-sm font-bold text-zinc-900 truncate">{user?.role}</p>
            </div>
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Username / ID</p>
              <p className="text-sm font-bold text-zinc-900 truncate">{user?.register_number || user?.username}</p>
            </div>
            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase">Email</p>
              <p className="text-sm font-bold text-zinc-900 truncate">{user?.email || 'N/A'}</p>
            </div>
          </div>
        </Card>

        {/* ── Native Mobile & Lock Screen Web Push Notifications Section ── */}
        <Card className="p-6 bg-white border-zinc-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center border border-zinc-200 shadow-sm p-1.5 shrink-0">
                <img src="/logo.png" alt="VSBEC IT Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                  Mobile & Lock Screen Notifications (PWA)
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    pushSubscribed 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                      : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                  }`}>
                    {pushSubscribed ? '🟢 Active & Subscribed' : '⚪ Inactive'}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">Real-time alerts on your phone lock screen for new assignments & verification results</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {!pushSupported ? (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-center gap-3">
                <AlertTriangle size={18} className="shrink-0 text-amber-600" />
                <span>
                  Push notifications are not supported on this specific browser. If you are on an iPhone/iPad, please tap <b>Share &gt; Add to Home Screen</b> to install the app and enable notifications (iOS 16.4+).
                </span>
              </div>
            ) : (
              <div className="p-5 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-extrabold text-zinc-900 text-sm flex items-center gap-2">
                    {pushSubscribed ? '🔔 Lock Screen Alerts Enabled' : '🔕 Lock Screen Alerts Disabled'}
                  </h4>
                  <p className="text-xs text-zinc-600 max-w-xl">
                    {pushSubscribed
                      ? 'This device is registered to receive instant push alerts whenever a task is assigned, reviewed, or verified.'
                      : 'Enable lock-screen notifications to get notified instantly even when the app is closed or in your pocket.'}
                  </p>
                  {pushPermission === 'denied' && (
                    <p className="text-xs font-semibold text-rose-600 mt-1">
                      ⚠️ Notifications are currently blocked in your browser settings. Please allow notifications for this site.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Button
                    variant={pushSubscribed ? 'outline' : 'primary'}
                    className={`text-xs py-2.5 px-4 font-bold ${
                      pushSubscribed
                        ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                    }`}
                    disabled={pushLoading || pushPermission === 'denied'}
                    onClick={handleTogglePush}
                  >
                    {pushLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : pushSubscribed ? (
                      <BellOff size={14} />
                    ) : (
                      <Bell size={14} />
                    )}
                    <span>{pushSubscribed ? 'Disable on this Device' : 'Enable Phone Notifications'}</span>
                  </Button>

                  {pushSubscribed && (
                    <Button
                      variant="outline"
                      className="text-xs py-2.5 px-3.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold"
                      disabled={pushTestLoading}
                      onClick={handleSendTestPush}
                    >
                      {pushTestLoading ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
                      <span>Send Test Push</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Mobile App Installation Tip */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200/80 text-[11px] text-zinc-500 flex items-start gap-2.5">
              <Info size={15} className="shrink-0 text-zinc-400 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-zinc-700">📱 Mobile App Installation Tip:</span>
                <p>
                  For the best experience on mobile, install this app on your Home Screen (Android: Tap <b>Install App</b>; iOS: Tap <b>Share &gt; Add to Home Screen</b>).
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Telegram Notifications Section ── */}
        <Card className="p-6 bg-white border-zinc-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                <Send size={20} className="-rotate-12 translate-x-0.5" />
              </div>
              <div>
                <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                  Telegram Automated Notifications
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    100% Free & Auto
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">Instant 1-to-1 deadline reminders and department group summaries</p>
              </div>
            </div>
          </div>

          {/* Student Specific Telegram Connection */}
          {user?.role === 'STUDENT' && (
            <div className="space-y-4">
              {telegramStats?.currentUserLinked ? (
                <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 size={22} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-emerald-950 text-sm flex items-center gap-2">
                        Connected to @{telegramStats.botUsername}
                      </h4>
                      <p className="text-xs text-emerald-800">
                        {telegramStats.currentUserTelegram ? `@${telegramStats.currentUserTelegram} • ` : ''}
                        You are set up to receive 1-to-1 deadline reminders on Telegram!
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      className="text-xs py-2 px-3 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      disabled={sendingTest}
                      onClick={() => handleSendTestMessage()}
                    >
                      {sendingTest ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                      <span>Send Test Alert</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-xs py-2 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={handleUnlinkTelegram}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-gradient-to-br from-sky-50 to-indigo-50/50 rounded-2xl border border-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-zinc-900 text-sm flex items-center gap-2">
                      <Bell size={16} className="text-sky-600" /> Never Miss a Task Deadline!
                    </h4>
                    <p className="text-xs text-zinc-600 max-w-md">
                      Connect your Telegram in 1 click to get private alerts directly on your phone 24 hours before assignment deadlines.
                    </p>
                  </div>
                  <a
                    href={`https://t.me/${telegramStats?.botUsername || 'IT_TaskManager_Alerts_bot'}?start=${user?.register_number || user?.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs text-white bg-sky-500 hover:bg-sky-600 shadow-md shadow-sky-500/25 transition-all whitespace-nowrap"
                  >
                    <Send size={14} className="-rotate-12" />
                    <span>Connect Telegram in 1-Click</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Admin / Faculty Management Section */}
          {user?.role !== 'STUDENT' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Telegram Bot</p>
                  <p className="text-xs font-bold text-zinc-900 flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    @{telegramStats?.botUsername || 'IT_TaskManager_Alerts_bot'}
                  </p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Students Connected</p>
                  <p className="text-sm font-black text-indigo-600 mt-0.5">
                    {telegramStats?.linkedStudents || 0} <span className="text-zinc-400 text-xs font-normal">/ {telegramStats?.totalStudents || 0} students</span>
                  </p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Auto Schedule</p>
                  <p className="text-xs font-bold text-zinc-700 mt-0.5">
                    ⏰ 8 PM (Reminders) • 9 PM (Summary)
                  </p>
                </div>
              </div>

              {/* Group Chat Configuration */}
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-extrabold text-zinc-800 block">Department / Class Telegram Group Chat ID</label>
                    <p className="text-[11px] text-zinc-500">Group summaries will automatically be posted to this group ID every evening.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={groupChatIdInput}
                    onChange={e => setGroupChatIdInput(e.target.value)}
                    placeholder="e.g. -1001234567890 (or group username)"
                    className="text-xs bg-white"
                  />
                  <Button
                    onClick={handleSaveGroupChat}
                    disabled={savingGroupChat}
                    className="bg-black hover:bg-zinc-800 text-white text-xs font-bold shrink-0"
                  >
                    {savingGroupChat ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>Save</span>
                  </Button>
                </div>
              </div>

              {/* Instant Broadcast Actions */}
              <div className="pt-2 border-t border-zinc-100">
                <p className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2.5">Manual Notification Triggers</p>
                <div className="flex flex-wrap gap-2.5">
                  <Button
                    variant="primary"
                    disabled={sendingSummary}
                    onClick={handleSendGroupSummaryNow}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2"
                  >
                    {sendingSummary ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
                    <span>Broadcast Group Summary Now</span>
                  </Button>

                  <Button
                    variant="outline"
                    disabled={sendingReminders}
                    onClick={handleSendRemindersNow}
                    className="text-xs font-bold border-zinc-300 text-zinc-800 hover:bg-zinc-100 flex items-center gap-2"
                  >
                    {sendingReminders ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                    <span>Send Reminders to Pending Students Now</span>
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={sendingTest}
                    onClick={() => handleSendTestMessage(groupChatIdInput.trim() || undefined)}
                    className="text-xs font-bold text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5"
                  >
                    {sendingTest ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    <span>Test Notification</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Change Password Card */}
        <Card className="p-6 bg-white border-zinc-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <KeyRound size={18} className="text-amber-600" /> Change Password
              </h3>
              <p className="text-xs text-zinc-500">Update your login security credentials</p>
            </div>
          </div>

          {passwordError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={changingPassword} variant="primary" className="px-6 flex items-center gap-2">
                {changingPassword ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                <span>Update Password</span>
              </Button>
            </div>
          </form>
        </Card>


      </div>
    </PageLayout>
  );
}

function StaffStudentProfileModal({
  studentId,
  token,
  onClose
}: {
  studentId: string;
  token: string | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('personal');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/student/profile/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          const err = await res.json();
          setError(err.error || 'Failed to load student profile');
        }
      } catch {
        setError('Error connecting to server');
      } finally {
        setLoading(false);
      }
    };
    if (studentId) fetchProfile();
  }, [studentId, token]);

  const acad = profile?.academic || {};

  const sections = [
    { id: 'personal', label: '1. Personal & Academic', icon: User },
    { id: 'skills', label: '2. Skills', icon: Code },
    { id: 'projects', label: '3. Projects', icon: Layers },
    { id: 'internships', label: '4. Internships', icon: Briefcase },
    { id: 'certifications', label: '5. Certifications', icon: Award },
    { id: 'coding', label: '6. Coding Profiles', icon: Globe },
    { id: 'resume', label: '7. Resume', icon: FileText },
    { id: 'achievements', label: '8. Achievements', icon: Sparkles },
    { id: 'languages', label: '9. Languages', icon: Languages },
    { id: 'career', label: '10. Career Preferences', icon: Compass },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-4xl shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden border border-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 overflow-hidden flex items-center justify-center text-white font-bold shrink-0">
              {acad.avatar_url ? (
                <img src={acad.avatar_url} alt={acad.full_name} className="w-full h-full object-cover" />
              ) : (
                (acad.full_name || 'ST').substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-zinc-900 flex items-center gap-2">
                {acad.full_name || 'Student Profile'}
              </h2>
              <p className="text-xs text-zinc-500 font-semibold">
                Reg No: {acad.register_number} • Section: {acad.class_name || 'N/A'} • Dept: {acad.department_name || 'IT'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-800 transition-colors border border-transparent hover:border-zinc-200 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Section Pill Selectors */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-3 custom-scrollbar shrink-0 border-b border-zinc-200">
          {sections.map(s => {
            const SIcon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 border cursor-pointer",
                  isActive
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-sm scale-[1.01]"
                    : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900"
                )}
              >
                <SIcon size={13} className={cn(isActive ? "text-white" : "text-zinc-400")} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-4 pr-1">
          {loading ? (
            <div className="py-20 text-center text-zinc-500">
              <Loader2 size={32} className="animate-spin mx-auto mb-2 text-black" />
              <p className="text-xs font-semibold">Loading student details...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200">
              {error}
            </div>
          ) : (
            <>
              {activeSection === 'personal' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-zinc-50/50 rounded-xl border border-zinc-200/60 flex gap-2.5 items-center">
                      <Mail size={16} className="text-zinc-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">College Email</p>
                        <p className="text-xs font-bold text-zinc-900 truncate" title={acad.email}>{acad.email || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-50/50 rounded-xl border border-zinc-200/60 flex gap-2.5 items-center">
                      <User size={16} className="text-zinc-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Gender</p>
                        <p className="text-xs font-bold text-zinc-900 truncate">{acad.gender || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-50/50 rounded-xl border border-zinc-200/60 flex gap-2.5 items-center">
                      <Phone size={16} className="text-zinc-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Mobile Number</p>
                        <p className="text-xs font-bold text-zinc-900 truncate">{profile.personal?.mobile_number || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-50/50 rounded-xl border border-zinc-200/60 flex gap-2.5 items-center">
                      <Calendar size={16} className="text-zinc-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Date of Birth</p>
                        <p className="text-xs font-bold text-zinc-900 truncate">{profile.personal?.date_of_birth || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-50/50 rounded-xl border border-zinc-200/60 flex gap-2.5 items-center">
                      <BookOpen size={16} className="text-zinc-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Semester</p>
                        <p className="text-xs font-bold text-zinc-900 truncate">{profile.personal?.semester ? `Semester ${profile.personal.semester}` : 'N/A'}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-50/50 rounded-xl border border-zinc-200/60 flex gap-2.5 items-center">
                      <GraduationCap size={16} className="text-emerald-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">CGPA</p>
                        <p className="text-xs font-bold text-emerald-600 truncate">{profile.personal?.cgpa || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-50/50 rounded-xl border border-zinc-200/60 flex gap-2.5 items-center">
                      <AlertTriangle size={16} className={cn("shrink-0", (profile.personal?.current_arrears > 0) ? "text-rose-500" : "text-emerald-500")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Current Arrears</p>
                        <p className={cn("text-xs font-bold truncate", (profile.personal?.current_arrears > 0) ? "text-rose-600" : "text-emerald-600")}>
                          {profile.personal?.current_arrears ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-50/50 rounded-xl border border-zinc-200/60 flex gap-2.5 items-center">
                      <RotateCcw size={16} className={cn("shrink-0", (profile.personal?.history_of_arrears > 0) ? "text-amber-500" : "text-zinc-400")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">History of Arrears</p>
                        <p className={cn("text-xs font-bold truncate", (profile.personal?.history_of_arrears > 0) ? "text-amber-600" : "text-zinc-600")}>
                          {profile.personal?.history_of_arrears ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {profile.personal?.about_me && (
                    <div className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-200/60">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5 tracking-wider">About Student</p>
                      <p className="text-xs text-zinc-700 leading-relaxed">{profile.personal.about_me}</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'skills' && (
                <div className="space-y-4">
                  {(() => {
                    const grouped: Record<string, any[]> = {};
                    (profile.skills || []).forEach((sk: any) => {
                      const cat = sk.category || 'Other';
                      if (!grouped[cat]) grouped[cat] = [];
                      grouped[cat].push(sk);
                    });
                    const categories = Object.keys(grouped).sort();
                    if (categories.length === 0) {
                      return <p className="text-xs text-zinc-400 py-8 text-center">No skills recorded.</p>;
                    }
                    return categories.map(cat => (
                      <div key={cat} className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-200/60 shadow-2xs">
                        <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Code size={13} className="text-zinc-500" /> {cat}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {grouped[cat].map((sk: any) => {
                            const isLvlAdvanced = sk.level?.toLowerCase() === 'advanced';
                            const isLvlIntermediate = sk.level?.toLowerCase() === 'intermediate';
                            return (
                              <div key={sk.id} className="px-3 py-1.5 bg-white rounded-xl border border-zinc-200/80 text-xs font-semibold flex items-center gap-2 hover:border-zinc-400 transition-colors">
                                <span className="text-zinc-800">{sk.skill_name}</span>
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase",
                                  isLvlAdvanced ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                  isLvlIntermediate ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-zinc-100 text-zinc-600"
                                )}>
                                  {sk.level || 'Unknown'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {activeSection === 'projects' && (
                <div className="space-y-4">
                  {(profile.projects || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-8 text-center">No projects recorded.</p>
                  ) : (
                    profile.projects.map((p: any) => (
                      <div key={p.id} className="p-5 bg-zinc-50/50 border border-zinc-200/60 rounded-2xl shadow-2xs hover:shadow-xs transition-shadow space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                              <Layers size={14} className="text-zinc-500" /> {p.project_name}
                            </h4>
                            {p.tech_stack && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {p.tech_stack.split(',').map((tech: string, tIdx: number) => (
                                  <span key={tIdx} className="px-2 py-0.5 rounded-md bg-indigo-50/50 border border-indigo-100 text-[10px] font-bold text-indigo-600">
                                    {tech.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {p.description && <p className="text-xs text-zinc-600 leading-relaxed">{p.description}</p>}
                        <div className="flex gap-3 pt-1 text-xs">
                          {p.github_url && (
                            <a href={p.github_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-400 text-zinc-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors">
                              <Github size={13} /> Code Repository
                            </a>
                          )}
                          {p.live_demo_url && (
                            <a href={p.live_demo_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 hover:border-emerald-300 text-emerald-700 font-bold rounded-xl flex items-center gap-1.5 transition-colors">
                              <Globe size={13} /> Live Preview
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'internships' && (
                <div className="space-y-4">
                  {(profile.internships || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-8 text-center">No internships recorded.</p>
                  ) : (
                    profile.internships.map((intern: any) => (
                      <div key={intern.id} className="p-5 bg-zinc-50/50 border border-zinc-200/60 rounded-2xl shadow-2xs hover:shadow-xs transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                            <Briefcase size={14} className="text-zinc-500" /> {intern.company}
                          </h4>
                          <p className="text-xs font-bold text-zinc-600">
                            {intern.role}
                          </p>
                          <p className="text-[11px] text-zinc-400 font-semibold">
                            {intern.duration} • <span className="uppercase text-[10px] bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded text-zinc-500 font-bold">{intern.mode}</span>
                          </p>
                        </div>
                        {intern.certificate_url && (
                          <a href={intern.certificate_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-400 text-indigo-600 hover:text-indigo-800 font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0 text-xs shadow-2xs">
                            <ExternalLink size={13} /> View Certificate
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'certifications' && (
                <div className="space-y-4">
                  {(profile.certifications || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-8 text-center">No certifications recorded.</p>
                  ) : (
                    profile.certifications.map((c: any) => (
                      <div key={c.id} className="p-5 bg-zinc-50/50 border border-zinc-200/60 rounded-2xl shadow-2xs hover:shadow-xs transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                            <Award size={14} className="text-zinc-500" /> {c.certificate_name}
                          </h4>
                          <p className="text-xs font-semibold text-zinc-600">
                            {c.provider} {c.issue_date ? `• Issued ${c.issue_date}` : ''}
                          </p>
                        </div>
                        {c.certificate_url && (
                          <a href={c.certificate_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-white border border-zinc-200 hover:border-zinc-400 text-indigo-600 hover:text-indigo-800 font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0 text-xs shadow-2xs">
                            <ExternalLink size={13} /> View Credential
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'coding' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.coding_profiles?.github && (
                    <a href={profile.coding_profiles.github} target="_blank" rel="noreferrer" className="p-4 bg-zinc-900 border border-zinc-950 text-xs font-bold text-white rounded-2xl flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all group">
                      <span className="flex items-center gap-2.5">
                        <Github size={18} />
                        <span>GitHub Profile</span>
                      </span>
                      <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
                    </a>
                  )}
                  {profile.coding_profiles?.leetcode && (
                    <a href={profile.coding_profiles.leetcode} target="_blank" rel="noreferrer" className="p-4 bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 rounded-2xl flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all group">
                      <span className="flex items-center gap-2.5">
                        <Globe size={18} className="text-amber-600" />
                        <span>LeetCode Profile</span>
                      </span>
                      <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
                    </a>
                  )}
                  {profile.coding_profiles?.linkedin && (
                    <a href={profile.coding_profiles.linkedin} target="_blank" rel="noreferrer" className="p-4 bg-blue-50 border border-blue-200 text-xs font-bold text-blue-800 rounded-2xl flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all group">
                      <span className="flex items-center gap-2.5">
                        <Linkedin size={18} className="text-blue-600" />
                        <span>LinkedIn Profile</span>
                      </span>
                      <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
                    </a>
                  )}
                  {profile.coding_profiles?.geeksforgeeks && (
                    <a href={profile.coding_profiles.geeksforgeeks} target="_blank" rel="noreferrer" className="p-4 bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 rounded-2xl flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all group">
                      <span className="flex items-center gap-2.5">
                        <Globe size={18} className="text-emerald-600" />
                        <span>GeeksforGeeks Profile</span>
                      </span>
                      <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
                    </a>
                  )}
                  {profile.coding_profiles?.portfolio && (
                    <a href={profile.coding_profiles.portfolio} target="_blank" rel="noreferrer" className="p-4 bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-800 rounded-2xl flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] transition-all group">
                      <span className="flex items-center gap-2.5">
                        <Globe size={18} className="text-indigo-600" />
                        <span>Portfolio Website</span>
                      </span>
                      <ExternalLink size={13} className="opacity-60 group-hover:opacity-100" />
                    </a>
                  )}
                </div>
              )}

              {activeSection === 'resume' && (
                <div>
                  {profile.resume ? (
                    <div className="p-5 bg-zinc-50/50 rounded-2xl border border-zinc-200/60 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 shrink-0">
                          <FileText size={24} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-900">{profile.resume.file_name || 'Resume.pdf'}</p>
                          <p className="text-[10px] text-zinc-400 font-semibold">Last updated: {new Date(profile.resume.last_updated).toLocaleString()}</p>
                        </div>
                      </div>
                      <a href={profile.resume.resume_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shrink-0 shadow-sm shadow-black/10">
                        <ExternalLink size={13} /> Open PDF
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 py-8 text-center">No resume uploaded.</p>
                  )}
                </div>
              )}

              {activeSection === 'achievements' && (
                <div className="space-y-4">
                  {(profile.achievements || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-8 text-center">No achievements recorded.</p>
                  ) : (
                    profile.achievements.map((ach: any) => (
                      <div key={ach.id} className="p-5 bg-zinc-50/50 border border-zinc-200/60 rounded-2xl shadow-2xs hover:shadow-xs transition-shadow space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                            <Trophy size={14} className="text-amber-500" /> {ach.title}
                          </h4>
                          <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[9px] font-black text-indigo-600 uppercase">
                            {ach.category}
                          </span>
                        </div>
                        {ach.event_date && <p className="text-[10px] text-zinc-400 font-semibold">{ach.event_date}</p>}
                        {ach.description && <p className="text-xs text-zinc-600 mt-2 leading-relaxed">{ach.description}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'languages' && (
                <div className="flex flex-wrap gap-2.5">
                  {(profile.languages || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-8 text-center">No languages recorded.</p>
                  ) : (
                    profile.languages.map((l: any) => (
                      <div key={l.id} className="px-3 py-2 bg-zinc-50 rounded-xl border border-zinc-200/80 text-xs font-semibold flex items-center gap-2">
                        <Languages size={13} className="text-zinc-500" />
                        <span className="text-zinc-800">{l.language}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-200/60 text-zinc-600 font-bold uppercase">{l.proficiency}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'career' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-200/60 flex gap-3 items-center">
                    <Briefcase size={16} className="text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Preferred Role</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">{profile.career_preferences?.preferred_role || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-200/60 flex gap-3 items-center">
                    <Compass size={16} className="text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Preferred Domain</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">{profile.career_preferences?.preferred_domain || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-200/60 flex gap-3 items-center">
                    <MapPin size={16} className="text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Preferred Location</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">{profile.career_preferences?.preferred_location || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="p-4 bg-zinc-50/50 rounded-2xl border border-zinc-200/60 flex gap-3 items-center">
                    <Globe size={16} className="text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Work Mode & Relocation</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">
                        {profile.career_preferences?.work_mode || 'Hybrid'} • {profile.career_preferences?.willing_to_relocate ? 'Willing to Relocate' : 'No Relocation'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function HistoryChartWrapper({ studentId, type, token }: { studentId: string; type: 'daily' | 'weekly'; token: string | null }) {
  const [history, setHistory] = useState<any>(null);
  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/leetcode/progress/student/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setHistory(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (studentId) fetchHistory();
    return () => { isMounted = false; };
  }, [studentId, token]);

  if (!history) return <div className="text-zinc-400 text-xs font-semibold py-10">Fetching history logs...</div>;

  const data = type === 'daily' ? history.daily : history.weekly;
  if (!data || data.length === 0) return <div className="text-zinc-400 text-xs font-semibold py-10">No progress logs found</div>;

  const maxVal = Math.max(...data.map((d: any) => Math.max(d.actual, d.target)), 5);
  const height = 120;
  const width = 500;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 20;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;

  if (type === 'daily') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#e4e4e7" strokeDasharray="3,3" />
        <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="#e4e4e7" strokeDasharray="3,3" />
        <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#e4e4e7" />
        {data.map((d: any, i: number) => {
          const x = paddingLeft + (i * (chartWidth / data.length));
          const barWidth = Math.max(2, (chartWidth / data.length) - 4);
          const barHeight = (d.actual / maxVal) * chartHeight;
          const targetY = height - paddingBottom - (d.target / maxVal) * chartHeight;
          return (
            <g key={i}>
              <rect x={x} y={height - paddingBottom - barHeight} width={barWidth} height={barHeight} fill="#f97316" rx={1} />
              {d.target > 0 && <circle cx={x + barWidth / 2} cy={targetY} r={2} fill="#ef4444" />}
              <title>{`Date: ${d.date}\nSolved: ${d.actual}\nTarget: ${d.target}`}</title>
            </g>
          );
        })}
      </svg>
    );
  } else {
    const points = data.map((d: any, i: number) => {
      const x = paddingLeft + (i * (chartWidth / Math.max(1, data.length - 1)));
      const y = height - paddingBottom - (d.actual / maxVal) * chartHeight;
      return `${x},${y}`;
    }).join(' ');
    const areaPoints = `${paddingLeft},${height - paddingBottom} ${points} ${paddingLeft + chartWidth},${height - paddingBottom}`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#e4e4e7" strokeDasharray="3,3" />
        <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#e4e4e7" />
        <polygon points={areaPoints} fill="rgba(99, 102, 241, 0.1)" />
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth={2} />
        {data.map((d: any, i: number) => {
          const x = paddingLeft + (i * (chartWidth / Math.max(1, data.length - 1)));
          const y = height - paddingBottom - (d.actual / maxVal) * chartHeight;
          const targetY = height - paddingBottom - (d.target / maxVal) * chartHeight;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={4} fill="#6366f1" />
              <line x1={x - 5} y1={targetY} x2={x + 5} y2={targetY} stroke="#dc2626" strokeWidth={1} />
              <text x={x} y={height - 5} textAnchor="middle" className="text-[8px] font-semibold text-zinc-400">{d.week}</text>
              <title>{`Week: ${d.start} to ${d.end}\nSolved: ${d.actual}\nTarget: ${d.target}`}</title>
            </g>
          );
        })}
      </svg>
    );
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<string>('dashboard');
  const [viewingStudentProfileId, setViewingStudentProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isServerAwake, setIsServerAwake] = useState(false);
  const [isWakingServer, setIsWakingServer] = useState(true);
  const [wakeAttempt, setWakeAttempt] = useState(0);

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
  const [supremeStats, setSupremeStats] = useState<any>(null);
  const [myClass, setMyClass] = useState<Class | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [reportFilters, setReportFilters] = useState<{ classIds: string[]; taskId: string; status: string }>({ classIds: [], taskId: '', status: 'ALL' });

  // LeetCode Target Tracking State
  const [myLeetcodeProgress, setMyLeetcodeProgress] = useState<any>(null);
  const [leetcodeStats, setLeetcodeStats] = useState<any>(null);
  const [leetcodeProgressList, setLeetcodeProgressList] = useState<any[]>([]);
  const [leetcodeTargets, setLeetcodeTargets] = useState<any[]>([]);
  const [showAssignTargetModal, setShowAssignTargetModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<any>(null);
  const [studentHistoryData, setStudentHistoryData] = useState<any>(null);
  const [syncingLeetcode, setSyncingLeetcode] = useState(false);
  const [submittingTarget, setSubmittingTarget] = useState(false);

  const [leetcodeDate, setLeetcodeDate] = useState<string>(new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [leetcodeStatusFilter, setLeetcodeStatusFilter] = useState<string>('ALL');
  const [leetcodeSearch, setLeetcodeSearch] = useState<string>('');
  const [leetcodeViewType, setLeetcodeViewType] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [leetcodeActiveTab, setLeetcodeActiveTab] = useState<'MONITOR' | 'TARGETS'>('MONITOR');
  const [selectedLeetcodeDeptId, setSelectedLeetcodeDeptId] = useState<string>('ALL');
  const [selectedLeetcodeYear, setSelectedLeetcodeYear] = useState<string>('ALL');
  const [selectedLeetcodeClassId, setSelectedLeetcodeClassId] = useState<string>('ALL');
  const [leetcodeSortColumn, setLeetcodeSortColumn] = useState<string>('registerNumber');
  const [leetcodeSortOrder, setLeetcodeSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (user && classes.length > 0) {
      if (user.role === 'CLASS_ADVISOR' || (user.role === 'STUDENT' && user.is_coordinator)) {
        if (user.class_id) setSelectedLeetcodeClassId(user.class_id.toString());
        if (user.department_id) setSelectedLeetcodeDeptId(user.department_id.toString());
        const userClassObj = classes.find(c => String(c.id) === String(user.class_id));
        if (userClassObj?.year) setSelectedLeetcodeYear(String(userClassObj.year));
      } else if (user.is_year_coordinator) {
        if (user.year_scope || user.year) setSelectedLeetcodeYear(String(user.year_scope || user.year));
        if (user.department_id) setSelectedLeetcodeDeptId(user.department_id.toString());
      } else if (user.role === 'HOD') {
        if (user.department_id) setSelectedLeetcodeDeptId(user.department_id.toString());
      }
    }
  }, [user, classes]);

  // GitHub & Combined Progress Tracking State
  const [codingPlatformTab, setCodingPlatformTab] = useState<'LEETCODE' | 'GITHUB'>('LEETCODE');
  const [myGithubProgress, setMyGithubProgress] = useState<any>(null);
  const [githubStats, setGithubStats] = useState<any>(null);
  const [githubProgressList, setGithubProgressList] = useState<any[]>([]);
  const [combinedProgressList, setCombinedProgressList] = useState<any[]>([]);
  const [syncingGithub, setSyncingGithub] = useState(false);

  const sortedLeetcodeProgressList = useMemo(() => {
    return [...leetcodeProgressList].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (leetcodeSortColumn) {
        case 'registerNumber':
          valA = a.registerNumber || '';
          valB = b.registerNumber || '';
          break;
        case 'fullName':
          valA = a.fullName || '';
          valB = b.fullName || '';
          break;
        case 'className':
          valA = a.className || '';
          valB = b.className || '';
          break;
        case 'hasProfile':
          valA = a.leetcodeUsername ? 1 : 0;
          valB = b.leetcodeUsername ? 1 : 0;
          break;
        case 'target':
          valA = leetcodeViewType === 'DAILY' ? a.dailyTarget : a.weeklyTarget;
          valB = leetcodeViewType === 'DAILY' ? b.dailyTarget : b.weeklyTarget;
          break;
        case 'solved':
          valA = leetcodeViewType === 'DAILY' ? a.solvedToday : a.solvedThisWeek;
          valB = leetcodeViewType === 'DAILY' ? b.solvedToday : b.solvedThisWeek;
          break;
        case 'completionPct':
          valA = leetcodeViewType === 'DAILY' ? a.completionDailyPct : a.completionWeeklyPct;
          valB = leetcodeViewType === 'DAILY' ? b.completionDailyPct : b.completionWeeklyPct;
          break;
        case 'status':
          valA = leetcodeViewType === 'DAILY' ? a.dailyStatus : a.weeklyStatus;
          valB = leetcodeViewType === 'DAILY' ? b.dailyStatus : b.weeklyStatus;
          break;
        default:
          valA = a.registerNumber || '';
          valB = b.registerNumber || '';
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return leetcodeSortOrder === 'asc' ? comp : -comp;
      }
      const comp = valA > valB ? 1 : valA < valB ? -1 : 0;
      return leetcodeSortOrder === 'asc' ? comp : -comp;
    });
  }, [leetcodeProgressList, leetcodeSortColumn, leetcodeSortOrder, leetcodeViewType]);

  const sortedGithubProgressList = useMemo(() => {
    return [...githubProgressList].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (leetcodeSortColumn) {
        case 'registerNumber':
          valA = a.registerNumber || '';
          valB = b.registerNumber || '';
          break;
        case 'fullName':
          valA = a.fullName || '';
          valB = b.fullName || '';
          break;
        case 'className':
          valA = a.className || '';
          valB = b.className || '';
          break;
        case 'hasProfile':
          valA = a.githubUsername ? 1 : 0;
          valB = b.githubUsername ? 1 : 0;
          break;
        case 'commitsToday':
          valA = a.commitsToday ?? 0;
          valB = b.commitsToday ?? 0;
          break;
        case 'commitsThisWeek':
          valA = a.commitsThisWeek ?? 0;
          valB = b.commitsThisWeek ?? 0;
          break;
        case 'syncStatus':
          valA = a.syncStatus || '';
          valB = b.syncStatus || '';
          break;
        default:
          valA = a.registerNumber || '';
          valB = b.registerNumber || '';
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return leetcodeSortOrder === 'asc' ? comp : -comp;
      }
      const comp = valA > valB ? 1 : valA < valB ? -1 : 0;
      return leetcodeSortOrder === 'asc' ? comp : -comp;
    });
  }, [githubProgressList, leetcodeSortColumn, leetcodeSortOrder, leetcodeViewType]);

const githubTop3 = useMemo(() => {
    const isDaily = leetcodeViewType === 'DAILY';
    return [...githubProgressList]
      .filter(s => {
        const count = isDaily ? (s.commitsToday ?? 0) : (s.commitsThisWeek ?? 0);
        return count > 0;
      })
      .sort((a, b) => {
        const countA = isDaily ? (a.commitsToday ?? 0) : (a.commitsThisWeek ?? 0);
        const countB = isDaily ? (b.commitsToday ?? 0) : (b.commitsThisWeek ?? 0);
        if (countB !== countA) return countB - countA;
        return (a.fullName || '').localeCompare(b.fullName || '');
      })
      .slice(0, 3);
  }, [githubProgressList, leetcodeViewType]);

  const sortedCombinedProgressList = useMemo(() => {
    return [...combinedProgressList].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (leetcodeSortColumn) {
        case 'registerNumber':
          valA = a.registerNumber || '';
          valB = b.registerNumber || '';
          break;
        case 'fullName':
          valA = a.fullName || '';
          valB = b.fullName || '';
          break;
        case 'className':
          valA = a.className || '';
          valB = b.className || '';
          break;
        case 'leetcodeStatus':
          valA = leetcodeViewType === 'DAILY' ? a.leetcodeDailyStatus : a.leetcodeWeeklyStatus;
          valB = leetcodeViewType === 'DAILY' ? b.leetcodeDailyStatus : b.leetcodeWeeklyStatus;
          break;
        case 'githubStatus':
          valA = leetcodeViewType === 'DAILY' ? a.githubDailyStatus : a.githubWeeklyStatus;
          valB = leetcodeViewType === 'DAILY' ? b.githubDailyStatus : b.githubWeeklyStatus;
          break;
        case 'overallStatus':
          valA = leetcodeViewType === 'DAILY' ? a.overallDailyStatus : a.overallWeeklyStatus;
          valB = leetcodeViewType === 'DAILY' ? b.overallDailyStatus : b.overallWeeklyStatus;
          break;
        default:
          valA = a.registerNumber || '';
          valB = b.registerNumber || '';
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        return leetcodeSortOrder === 'asc' ? comp : -comp;
      }
      const comp = valA > valB ? 1 : valA < valB ? -1 : 0;
      return leetcodeSortOrder === 'asc' ? comp : -comp;
    });
  }, [combinedProgressList, leetcodeSortColumn, leetcodeSortOrder, leetcodeViewType]);

  const handleSortHeader = (col: string) => {
    if (leetcodeSortColumn === col) {
      setLeetcodeSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setLeetcodeSortColumn(col);
      setLeetcodeSortOrder('asc');
    }
  };

  const getISTDateForTarget = () => {
    return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  };
  const getEndDateForTarget = (date: Date) => {
    const end = new Date(date);
    end.setDate(date.getDate() + 6);
    return end.toISOString().split('T')[0];
  };

  const [assignTargetForm, setAssignTargetForm] = useState({
    dailyTarget: '2',
    weeklyTarget: '14',
    startDate: getISTDateForTarget().toISOString().split('T')[0],
    endDate: getEndDateForTarget(getISTDateForTarget()),
    scopeType: 'CLASS',
    targetValue: ''
  });

  // Reviews Timeline State
  const [selectedSubReviews, setSelectedSubReviews] = useState<any[]>([]);
  const [showReviewsModal, setShowReviewsModal] = useState<boolean>(false);

  // Team Task State
  const [teamModalTask, setTeamModalTask] = useState<Task | null>(null);
  const [currentTaskTeam, setCurrentTaskTeam] = useState<Team | null>(null);
  const [eligibleClassmates, setEligibleClassmates] = useState<any[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedClassmateIds, setSelectedClassmateIds] = useState<string[]>([]);
  const [classmateSearchTerm, setClassmateSearchTerm] = useState('');
  const [teamProofFile, setTeamProofFile] = useState<File | null>(null);
  const [teamRemarks, setTeamRemarks] = useState('');
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);
  const [teamSubmissions, setTeamSubmissions] = useState<TeamSubmission[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [myInvitations, setMyInvitations] = useState<TeamInvitation[]>([]);
  const [reviewingTeamSubmission, setReviewingTeamSubmission] = useState<TeamSubmission | null>(null);
  const [teamRejectionReason, setTeamRejectionReason] = useState('');

  // HOD Task Reopen & Deadline Extension State
  const [extendingTask, setExtendingTask] = useState<Task | null>(null);
  const [extendedDeadline, setExtendedDeadline] = useState('');

  // Forms
  const [newDept, setNewDept] = useState('');
  const [newClass, setNewClass] = useState({ name: '', department_id: '', year: '', batch: '' });
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    category: 'Competition',
    external_link: '',
    deadline: '',
    screenshot_instruction: '',
    custom_field_label: '',
    department_id: '',
    class_ids: [] as (string | number)[],
    submission_type: 'INDIVIDUAL',
    min_team_size: 2,
    max_team_size: 5
  });
  const [uploading, setUploading] = useState<number | null>(null);
  const [showTaskPreview, setShowTaskPreview] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALL'>('PENDING');
  const [verificationDeptFilter, setVerificationDeptFilter] = useState('');
  const [verificationYearFilter, setVerificationYearFilter] = useState('');
  const [verificationClassFilter, setVerificationClassFilter] = useState('');
  const [verificationTaskFilter, setVerificationTaskFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState<'ALL' | 'COORDINATORS'>('ALL');
  const [showFooterModal, setShowFooterModal] = useState<'PRIVACY' | 'TERMS' | 'SUPPORT' | 'SOURCES' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [submissionSearchTerm, setSubmissionSearchTerm] = useState('');
  const [submissionPage, setSubmissionPage] = useState(1);
  const [itemsPerPage] = useState(15);

  const getPaginationRange = (current: number, total: number) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  };
  const [selectedSubmissions, setSelectedSubmissions] = useState<number[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState<number | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [analyzerClassFilter, setAnalyzerClassFilter] = useState('');
  const [analyzerYearFilter, setAnalyzerYearFilter] = useState('');
  const [analyzerTaskFilter, setAnalyzerTaskFilter] = useState('');
  const [analyzerStatusFilter, setAnalyzerStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [analyzerGenderFilter, setAnalyzerGenderFilter] = useState<'ALL' | 'BOYS' | 'GIRLS'>('ALL');
  const [adminDeptFilter, setAdminDeptFilter] = useState('');
  const [customFieldValue, setCustomFieldValue] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Record<number, File>>({});
  const [isDraggingScreenshot, setIsDraggingScreenshot] = useState<number | null>(null);
  const [notParticipating, setNotParticipating] = useState<Record<number, boolean>>({});
  const [notParticipatingReason, setNotParticipatingReason] = useState<Record<number, string>>({});
  const [isEditingOptOut, setIsEditingOptOut] = useState<Record<number, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [userYearFilter, setUserYearFilter] = useState('');
  const [userClassFilter, setUserClassFilter] = useState('');
  // Telegram Link Prompt State
  const [showTelegramLinkModal, setShowTelegramLinkModal] = useState(false);
  const [telegramChatIdInput, setTelegramChatIdInput] = useState('');
  const [telegramUsernameInput, setTelegramUsernameInput] = useState('');
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);

  const handleLinkTelegram = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!telegramChatIdInput.trim()) {
      addToast('Please enter your Telegram Chat ID', 'warning');
      return;
    }
    const cleanChatId = telegramChatIdInput.trim();
    if (cleanChatId.startsWith('-')) {
      addToast('Please enter your personal Telegram Chat ID, not a group ID', 'error');
      return;
    }
    setIsLinkingTelegram(true);
    try {
      const res = await fetch(`${API_URL}/api/student/link-telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          chatId: cleanChatId,
          telegramUsername: telegramUsernameInput.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast(data.message || 'Telegram account linked successfully!', 'success');
        setUser((prev: any) => prev ? {
          ...prev,
          telegram_chat_id: cleanChatId,
          telegram_username: telegramUsernameInput.trim() || prev.telegram_username
        } : prev);
        setShowTelegramLinkModal(false);
        setTelegramChatIdInput('');
        setTelegramUsernameInput('');
      } else {
        addToast(data.error || 'Failed to link Telegram account', 'error');
      }
    } catch {
      addToast('Error connecting to server to link Telegram', 'error');
    } finally {
      setIsLinkingTelegram(false);
    }
  };

  // Notice Board State
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeSearch, setNoticeSearch] = useState('');
  const [noticePriorityFilter, setNoticePriorityFilter] = useState('');
  const [noticeScopeFilter, setNoticeScopeFilter] = useState('');
  const [showCreateNoticeModal, setShowCreateNoticeModal] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ title: '', description: '', scope: 'ALL', department_id: '', class_id: '', class_ids: [] as string[], year: '', priority: 'NORMAL' });
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const [isPublishingNotice, setIsPublishingNotice] = useState(false);

  const openCreateNoticeModal = () => {
    const defaultScope = isAdmin ? 'ALL' : (isHOD ? 'DEPARTMENT' : 'CLASS');
    setNoticeForm({
      title: '',
      description: '',
      scope: defaultScope,
      department_id: user?.department_id || '',
      class_id: '',
      class_ids: [],
      year: '',
      priority: 'NORMAL'
    });
    setNoticeFile(null);
    setShowCreateNoticeModal(true);
  };

  
  const fetchNotices = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/notices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotices(data);
      }
    } catch (e) {
      console.error('Error fetching notices:', e);
    }
  };

    const handlePinNotice = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/notices/${id}/pin`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotices();
        addToast('Notice pin status updated', 'success');
      }
    } catch (e) {
      addToast('Failed to pin notice', 'error');
    }
  };

  const handleDeleteNotice = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notice?')) return;
    try {
      const res = await fetch(`${API_URL}/api/notices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNotices();
        addToast('Notice deleted', 'success');
      }
    } catch (e) {
      addToast('Failed to delete notice', 'error');
    }
  };

  const handleShareNotice = (noticeId: string, title?: string) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?tab=notice-board&noticeId=${noticeId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        addToast(title ? `Share link copied for "${title.length > 25 ? title.substring(0, 25) + '...' : title}"!` : 'Notice share link copied to clipboard!', 'success');
      }).catch(() => {
        copyNoticeFallback(shareUrl);
      });
    } else {
      copyNoticeFallback(shareUrl);
    }
  };

  const handleShareNoticeBoard = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?tab=notice-board`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        addToast('Notice Board share link copied to clipboard!', 'success');
      }).catch(() => {
        copyNoticeFallback(shareUrl);
      });
    } else {
      copyNoticeFallback(shareUrl);
    }
  };

  const copyNoticeFallback = (text: string) => {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    addToast('Link copied to clipboard!', 'success');
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeForm.title.trim() || !noticeForm.description.trim()) {
      addToast('Title and Description are required', 'error');
      return;
    }
    const selectedClasses = noticeForm.class_ids && noticeForm.class_ids.length > 0
      ? noticeForm.class_ids
      : (noticeForm.class_id ? [noticeForm.class_id] : []);

    if (noticeForm.scope === 'CLASS' && selectedClasses.length === 0) {
      addToast('Please select at least one target class', 'error');
      return;
    }

    setIsPublishingNotice(true);
    try {
      let attachment_url = null;
      let attachment_cloudinary_public_id = null;
      if (noticeFile) {
        const formData = new FormData();
        formData.append('attachment', noticeFile);
        const uploadRes = await fetch(`${API_URL}/api/notices/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          attachment_url = uploadData.attachment_url;
          attachment_cloudinary_public_id = uploadData.attachment_cloudinary_public_id;
        }
      }

      const effectiveScope = isAdvisor ? 'CLASS' : (isHOD && noticeForm.scope === 'ALL' ? 'DEPARTMENT' : noticeForm.scope);

      const res = await fetch(`${API_URL}/api/notices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...noticeForm,
          scope: effectiveScope,
          department_id: noticeForm.department_id || (user?.department_id || null),
          class_ids: selectedClasses,
          class_id: selectedClasses[0] || null,
          attachment_url,
          attachment_cloudinary_public_id
        })
      });
      if (res.ok) {
        addToast('Notice published successfully!', 'success');
        setShowCreateNoticeModal(false);
        setNoticeForm({ title: '', description: '', scope: 'ALL', department_id: '', class_id: '', class_ids: [], year: '', priority: 'NORMAL' });
        setNoticeFile(null);
        fetchNotices();
      } else {
        const err = await res.json();
        addToast(err.error || 'Failed to publish notice', 'error');
      }
    } catch (e) {
      addToast('Network error publishing notice', 'error');
    } finally {
      setIsPublishingNotice(false);
    }
  };

    // Task Poster & Share Link State
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [selectedPosterModal, setSelectedPosterModal] = useState<string | null>(null);
  const [studentTaskFilter, setStudentTaskFilter] = useState<'ALL' | 'PENDING_ACTION' | 'UNDER_REVIEW' | 'VERIFIED' | 'OVERDUE'>('ALL');
  const [sharedTaskModal, setSharedTaskModal] = useState<Task | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [highlightedNoticeId, setHighlightedNoticeId] = useState<string | null>(null);

  // Role Helpers
  const isAdmin = user?.role === 'SUPREME_ADMIN';
  const isHOD = user?.role === 'HOD';
  const isAdvisor = user?.role === 'CLASS_ADVISOR';
  const isStudent = user?.role === 'STUDENT';
  const isCoordinator = Boolean(user?.role === 'STUDENT' && user?.is_coordinator);

  // Deep Link Handling for Shared Tasks (?taskId=... or ?task=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskIdParam = params.get('taskId') || params.get('task');
    if (taskIdParam) {
      sessionStorage.setItem('pendingTaskId', taskIdParam);
      setHighlightedTaskId(taskIdParam);
      if (token) {
        setView('tasks');
      }
    }
  }, [token]);

  // Deep Link Handling for Shared Notice Board & Notices (?tab=notice-board or ?noticeId=... or ?notice=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const noticeIdParam = params.get('noticeId') || params.get('notice');
    if (tabParam === 'notice-board' || tabParam === 'notices' || noticeIdParam) {
      if (noticeIdParam) {
        sessionStorage.setItem('pendingNoticeId', noticeIdParam);
        setHighlightedNoticeId(noticeIdParam);
      } else {
        sessionStorage.setItem('pendingNoticeBoard', 'true');
      }
      if (token) {
        setView('notice-board');
        fetchNotices();
      }
    }
  }, [token]);

  useEffect(() => {
    if (highlightedNoticeId && notices.length > 0 && view === 'notice-board') {
      setTimeout(() => {
        const el = document.getElementById(`notice-${highlightedNoticeId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
    }
  }, [highlightedNoticeId, notices, view]);

  useEffect(() => {
    if (token && view === 'notice-board' && notices.length === 0) {
      fetchNotices();
    }
  }, [view, token]);

  useEffect(() => {
    if (highlightedTaskId && tasks.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`task-${highlightedTaskId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
    }
  }, [highlightedTaskId, tasks, view]);

  useEffect(() => {
    if (token && (view === 'verifications' || ['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR'].includes(user?.role || '') || (user?.role === 'STUDENT' && user?.is_coordinator))) {
      fetchTeamSubmissionsForTask(verificationTaskFilter);
    }
  }, [verificationTaskFilter, view, token, user?.role, user?.is_coordinator]);

  const runHealthCheckWithRetries = async () => {
    setIsWakingServer(true);
    setHasError(false);

    const delays = [0, 2000, 4000, 8000, 16000, 32000, 30000]; // 7 attempts, up to ~92 seconds total wait
    for (let i = 0; i < delays.length; i++) {
      setWakeAttempt(i + 1);
      if (delays[i] > 0) {
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(`${API_URL}/health`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok') {
            setIsServerAwake(true);
            setIsWakingServer(false);
            return;
          }
        }
      } catch (err) {
        console.warn(`Health check attempt ${i + 1} failed, retrying...`, err);
      }
    }
    setIsWakingServer(false);
    setHasError(true);
  };

  // ── Coding Targets & Progress Operations ──────────────────────────────
  const fetchMyLeetcodeProgress = async () => {
    try {
      const res = await fetch(`${API_URL}/api/leetcode/progress/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyLeetcodeProgress(data);
      }
    } catch (err) {
      console.error('Error fetching personal LeetCode progress:', err);
    }
  };

  const fetchLeetcodeStats = async () => {
    try {
      const deptParam = selectedLeetcodeDeptId !== 'ALL' ? `&departmentId=${selectedLeetcodeDeptId}` : '';
      const yearParam = selectedLeetcodeYear !== 'ALL' ? `&year=${selectedLeetcodeYear}` : '';
      const classParam = selectedLeetcodeClassId !== 'ALL' ? `&classId=${selectedLeetcodeClassId}` : '';
      const res = await fetch(`${API_URL}/api/leetcode/stats?date=${leetcodeDate}${deptParam}${yearParam}${classParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeetcodeStats(data);
      }
    } catch (err) {
      console.error('Error fetching LeetCode stats:', err);
    }
  };

  const fetchLeetcodeProgress = async () => {
    try {
      const endpoint = leetcodeViewType === 'DAILY' ? 'daily' : 'weekly';
      const deptParam = selectedLeetcodeDeptId !== 'ALL' ? `&departmentId=${selectedLeetcodeDeptId}` : '';
      const yearParam = selectedLeetcodeYear !== 'ALL' ? `&year=${selectedLeetcodeYear}` : '';
      const classParam = selectedLeetcodeClassId !== 'ALL' ? `&classId=${selectedLeetcodeClassId}` : '';
      const searchParam = leetcodeSearch ? `&search=${encodeURIComponent(leetcodeSearch)}` : '';
      const res = await fetch(`${API_URL}/api/leetcode/progress/${endpoint}?date=${leetcodeDate}&status=${leetcodeStatusFilter}${searchParam}${deptParam}${yearParam}${classParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeetcodeProgressList(data);
      }
    } catch (err) {
      console.error('Error fetching LeetCode progress:', err);
    }
  };

  const fetchLeetcodeTargets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/leetcode/targets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLeetcodeTargets(data);
      }
    } catch (err) {
      console.error('Error fetching LeetCode targets:', err);
    }
  };

  const fetchMyGithubProgress = async () => {
    try {
      const res = await fetch(`${API_URL}/api/github/progress/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setMyGithubProgress(await res.json());
    } catch (err) {
      console.error('Error fetching personal GitHub progress:', err);
    }
  };

  const fetchGithubStats = async () => {
    try {
      const deptParam = selectedLeetcodeDeptId !== 'ALL' ? `&departmentId=${selectedLeetcodeDeptId}` : '';
      const yearParam = selectedLeetcodeYear !== 'ALL' ? `&year=${selectedLeetcodeYear}` : '';
      const classParam = selectedLeetcodeClassId !== 'ALL' ? `&classId=${selectedLeetcodeClassId}` : '';
      const res = await fetch(`${API_URL}/api/github/stats?date=${leetcodeDate}${deptParam}${yearParam}${classParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setGithubStats(await res.json());
    } catch (err) {
      console.error('Error fetching GitHub stats:', err);
    }
  };

  const fetchGithubProgress = async () => {
    try {
      const deptParam = selectedLeetcodeDeptId !== 'ALL' ? `&departmentId=${selectedLeetcodeDeptId}` : '';
      const yearParam = selectedLeetcodeYear !== 'ALL' ? `&year=${selectedLeetcodeYear}` : '';
      const classParam = selectedLeetcodeClassId !== 'ALL' ? `&classId=${selectedLeetcodeClassId}` : '';
      const searchParam = leetcodeSearch ? `&search=${encodeURIComponent(leetcodeSearch)}` : '';
      const res = await fetch(`${API_URL}/api/github/daily-commits?date=${leetcodeDate}&status=${leetcodeStatusFilter}${searchParam}${deptParam}${yearParam}${classParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setGithubProgressList(await res.json());
    } catch (err) {
      console.error('Error fetching GitHub progress:', err);
    }
  };

  const fetchCombinedProgress = async () => {
    try {
      const deptParam = selectedLeetcodeDeptId !== 'ALL' ? `&departmentId=${selectedLeetcodeDeptId}` : '';
      const yearParam = selectedLeetcodeYear !== 'ALL' ? `&year=${selectedLeetcodeYear}` : '';
      const classParam = selectedLeetcodeClassId !== 'ALL' ? `&classId=${selectedLeetcodeClassId}` : '';
      const searchParam = leetcodeSearch ? `&search=${encodeURIComponent(leetcodeSearch)}` : '';
      const res = await fetch(`${API_URL}/api/coding/progress/combined?date=${leetcodeDate}&view=${leetcodeViewType}&status=${leetcodeStatusFilter}${searchParam}${deptParam}${yearParam}${classParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setCombinedProgressList(await res.json());
    } catch (err) {
      console.error('Error fetching combined progress:', err);
    }
  };

  const handleDeleteLeetcodeTarget = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this LeetCode target?')) return;
    try {
      const res = await fetch(`${API_URL}/api/leetcode/targets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('LeetCode target deleted successfully', 'success');
        fetchLeetcodeTargets();
        fetchLeetcodeProgress();
        fetchLeetcodeStats();
      } else {
        const data = await res.json();
        addToast(data.error || 'Failed to delete LeetCode target', 'error');
      }
    } catch (err) {
      addToast('Error deleting LeetCode target', 'error');
    }
  };



  useEffect(() => {
    runHealthCheckWithRetries();
  }, []);

  useEffect(() => {
    if (isServerAwake) {
      if (token) {
        fetchInitialData();
        // Poll for live updates every 60 seconds
        const interval = setInterval(() => {
          fetchTasks();
          fetchSubmissions();
          fetchNotifications();
          if (user?.role === 'STUDENT') fetchMyTeamsAndInvitations();
        }, 60000);
        return () => clearInterval(interval);
      } else {
        setIsLoading(false);
      }
    }
  }, [isServerAwake, token]);

  useEffect(() => {
    if (token && user?.role === 'STUDENT' && view === 'tasks') {
      fetchMyTeamsAndInvitations();
    }
  }, [view, token, user?.role]);

  useEffect(() => {
    if (token && (view === 'leetcode-targets' || view === 'coding-progress' || view === 'leetcode_targets' || view === 'coding_progress')) {
      if (codingPlatformTab === 'LEETCODE') {
        Promise.all([
          fetchLeetcodeStats(),
          fetchLeetcodeProgress(),
          fetchLeetcodeTargets(),
          ...(user?.role === 'STUDENT' ? [fetchMyLeetcodeProgress()] : [])
        ]);
      } else if (codingPlatformTab === 'GITHUB') {
        Promise.all([
          fetchGithubStats(),
          fetchGithubProgress(),
          ...(user?.role === 'STUDENT' ? [fetchMyGithubProgress()] : [])
        ]);
      } else {
        Promise.all([
          fetchCombinedProgress(),
          fetchLeetcodeStats(),
          fetchLeetcodeProgress(),
          fetchLeetcodeTargets(),
          fetchGithubStats(),
          fetchGithubProgress(),
          ...(user?.role === 'STUDENT' ? [fetchMyLeetcodeProgress(), fetchMyGithubProgress()] : [])
        ]);
      }
    }
  }, [view, codingPlatformTab, leetcodeViewType, leetcodeDate, leetcodeStatusFilter, leetcodeSearch, selectedLeetcodeDeptId, selectedLeetcodeYear, selectedLeetcodeClassId, token, user?.role]);

  const fetchInitialData = async () => {
    try {
      setHasError(false);
      const headers = { Authorization: `Bearer ${token}` };

      const savedUserStr = localStorage.getItem('user');
      const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;

      // Fire all requests in parallel
      const [deptsRes, classesRes, usersRes, tasksRes, submissionsRes, notificationsRes] = await Promise.all([
        fetch(`${API_URL}/api/departments`, { headers }),
        fetch(`${API_URL}/api/classes`, { headers }),
        fetch(`${API_URL}/api/users`, { headers }),
        fetch(`${API_URL}/api/tasks`, { headers }),
        fetch(`${API_URL}/api/submissions`, { headers }),
        fetch(`${API_URL}/api/notifications`, { headers })
      ]);

      const responses = [deptsRes, classesRes, usersRes, tasksRes, submissionsRes, notificationsRes].filter(Boolean) as Response[];

      const hasAuthError = responses.some(r => r.status === 401);
      if (hasAuthError) {
        console.error("Auth error detected, clearing token:", responses.map(r => `${r.url}: ${r.status}`).join(', '));
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        setLoginRole(null);
        setLoginData({ username: '', password: '' });
        setView('dashboard');
        setIsLoading(false);
        return;
      }

      // Helper to safely parse JSON or return an empty array if the request failed or was skipped
      const parseJSON = async (res: Response | null) => {
        if (res && res.ok) {
          try {
            return await res.json();
          } catch (e) {
            return [];
          }
        }
        return [];
      };

      // Parse JSON in parallel too
      const [depts, classes, users, tasks, submissions, notifications] = await Promise.all([
        parseJSON(deptsRes),
        parseJSON(classesRes),
        parseJSON(usersRes),
        parseJSON(tasksRes),
        parseJSON(submissionsRes),
        parseJSON(notificationsRes),
      ]);

      const sortClassesList = (clsList: Class[]) => [...(clsList || [])].sort((a, b) => (a.year || 0) - (b.year || 0) || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));
      const sortDeptsList = (deptList: Department[]) => [...(deptList || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));

      setDepartments(sortDeptsList(depts));
      setClasses(sortClassesList(classes));
      setUsers(users);
      setTasks(tasks);
      setSubmissions(submissions);
      setNotifications(notifications);

      if (savedUser) {
        // Refresh user data from server to avoid stale session flags
        try {
          const meRes = await fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (meRes.ok) {
            const freshUser = await meRes.json();
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
            if (freshUser.role === 'SUPREME_ADMIN') fetchSupremeStats();
            if (freshUser.role === 'HOD') fetchHODStats();
            if (freshUser.role === 'CLASS_ADVISOR' || (freshUser.role === 'STUDENT' && freshUser.is_coordinator)) {
              if (freshUser.role === 'CLASS_ADVISOR') fetchAdvisorStats();
              if (freshUser.role === 'STUDENT' && freshUser.is_coordinator) fetchCoordinatorStats();
              fetchMyClass();
            }
            if (freshUser.role === 'STUDENT') {
              fetchStudentStats();
              fetchMyTeamsAndInvitations();
            }
            if (freshUser.is_year_coordinator) fetchYearStats();
          } else {
            // Fallback to saved user if refresh fails
            setUser(savedUser);
            if (savedUser.role === 'SUPREME_ADMIN') fetchSupremeStats();
            if (savedUser.role === 'STUDENT') fetchMyTeamsAndInvitations();
          }
        } catch (err) {
          setUser(savedUser);
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
      const savedUserStr = localStorage.getItem('user');
      const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      if (!savedUser || (!['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR'].includes(savedUser.role) && !(savedUser.role === 'STUDENT' && savedUser.is_coordinator))) {
        return;
      }
      const res = await fetch(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (e) { }
  };

  const fetchSupremeStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats/supreme`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSupremeStats(await res.json());
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

  const fetchReviews = async (subId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/submissions/${subId}/reviews`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedSubReviews(await res.json());
        setShowReviewsModal(true);
      } else {
        addToast("Failed to fetch review history", "error");
      }
    } catch (e) {
      addToast("Network error fetching reviews", "error");
    }
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
        body: JSON.stringify({ ...loginData })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);

        const pendingTaskId = sessionStorage.getItem('pendingTaskId');
        const pendingNoticeId = sessionStorage.getItem('pendingNoticeId');
        const pendingNoticeBoard = sessionStorage.getItem('pendingNoticeBoard');
        if (pendingTaskId) {
          setView('tasks');
          setHighlightedTaskId(pendingTaskId);
          sessionStorage.removeItem('pendingTaskId');
          addToast('Redirected to shared task page!', 'info');
        } else if (pendingNoticeId || pendingNoticeBoard) {
          setView('notice-board');
          fetchNotices();
          if (pendingNoticeId) {
            setHighlightedNoticeId(pendingNoticeId);
            sessionStorage.removeItem('pendingNoticeId');
          }
          sessionStorage.removeItem('pendingNoticeBoard');
          addToast('Redirected to Digital Notice Board!', 'info');
        } else {
          setView('dashboard');
        }
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

    // Clear all fetched state variables to prevent leakage
    setDepartments([]);
    setClasses([]);
    setUsers([]);
    setTasks([]);
    setSubmissions([]);
    setHodStats(null);
    setAdvisorStats(null);
    setStudentStats(null);
    setCoordinatorStats(null);
    setYearStats(null);
    setSupremeStats(null);
    setMyClass(null);
    setNotifications([]);
  };

  const fetchMyTeamsAndInvitations = async () => {
    if (!token || user?.role !== 'STUDENT') return;
    try {
      const res = await fetch(`${API_URL}/api/team/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyTeams(data.teams || []);
        setMyInvitations(data.invitations || []);
      }
    } catch (e) {
      console.error('Failed to fetch my teams:', e);
    }
  };

  const openTeamModal = async (task: Task) => {
    setTeamModalTask(task);
    setTeamProofFile(null);
    setTeamRemarks('');
    setSelectedClassmateIds([]);
    setNewTeamName('');

    try {
      const res = await fetch(`${API_URL}/api/team/task/${task.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentTaskTeam(data.team || null);

        if (!data.team && user?.role === 'STUDENT') {
          const classmatesRes = await fetch(`${API_URL}/api/team/classmates/${task.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (classmatesRes.ok) {
            setEligibleClassmates(await classmatesRes.json());
          }
        }
      }
    } catch (e) {
      addToast('Failed to load team details', 'error');
    }
  };

  const handleCreateTeam = async () => {
    if (!teamModalTask) return;
    if (!newTeamName.trim()) return addToast('Please enter a team name', 'error');

    setIsSubmittingTeam(true);
    try {
      const res = await fetch(`${API_URL}/api/team/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          taskId: teamModalTask.id,
          teamName: newTeamName.trim(),
          members: selectedClassmateIds
        })
      });

      const data = await res.json();
      if (res.ok) {
        addToast('Team created successfully and invitations sent!', 'success');
        setNewTeamName('');
        setSelectedClassmateIds([]);
        openTeamModal(teamModalTask);
        fetchMyTeamsAndInvitations();
      } else {
        addToast(data.error || 'Failed to create team', 'error');
      }
    } catch (e) {
      addToast('Network error creating team', 'error');
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  const handleCreateSoloTeam = async () => {
    if (!teamModalTask) return;
    setIsSubmittingTeam(true);
    try {
      const soloTeamName = newTeamName.trim() || `${user?.full_name || user?.username || 'Student'} (Solo)`;
      const res = await fetch(`${API_URL}/api/team/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          taskId: teamModalTask.id,
          teamName: soloTeamName,
          members: []
        })
      });

      const data = await res.json();
      if (res.ok) {
        addToast('Solo submission mode activated! You can now submit your proof.', 'success');
        openTeamModal(teamModalTask);
        fetchMyTeamsAndInvitations();
      } else {
        addToast(data.error || 'Failed to activate solo mode', 'error');
      }
    } catch (e) {
      addToast('Network error creating solo entry', 'error');
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  const handleInviteMoreClassmates = async () => {
    if (!currentTaskTeam || selectedClassmateIds.length === 0) return;
    try {
      const res = await fetch(`${API_URL}/api/team/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          teamId: currentTaskTeam.id,
          studentIds: selectedClassmateIds
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Invitations sent successfully!', 'success');
        setSelectedClassmateIds([]);
        if (teamModalTask) openTeamModal(teamModalTask);
      } else {
        addToast(data.error || 'Failed to send invitations', 'error');
      }
    } catch (e) {
      addToast('Network error sending invitations', 'error');
    }
  };

  const handleRespondInvitation = async (invitationId: string, response: 'ACCEPT' | 'DECLINE') => {
    setMyInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    try {
      const res = await fetch(`${API_URL}/api/team/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ invitationId, response })
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`Invitation ${response === 'ACCEPT' ? 'accepted' : 'declined'} successfully!`, 'success');
        Promise.all([
          fetchMyTeamsAndInvitations(),
          fetchTasks(),
          fetchSubmissions()
        ]);
        if (teamModalTask) openTeamModal(teamModalTask);
      } else {
        addToast(data.error || 'Failed to respond to invitation', 'error');
        fetchMyTeamsAndInvitations();
      }
    } catch (e) {
      addToast('Network error responding to invitation', 'error');
      fetchMyTeamsAndInvitations();
    }
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    if (!confirm('Remove this member from team?')) return;
    try {
      const res = await fetch(`${API_URL}/api/team/member/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Member removed from team', 'info');
        if (teamModalTask) openTeamModal(teamModalTask);
      } else {
        addToast(data.error || 'Failed to remove member', 'error');
      }
    } catch (e) {
      addToast('Network error removing member', 'error');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Delete this team? All invitations and member details will be deleted.')) return;
    try {
      const res = await fetch(`${API_URL}/api/team/${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Team deleted', 'info');
        setCurrentTaskTeam(null);
        fetchMyTeamsAndInvitations();
        if (teamModalTask) openTeamModal(teamModalTask);
      } else {
        addToast(data.error || 'Failed to delete team', 'error');
      }
    } catch (e) {
      addToast('Network error deleting team', 'error');
    }
  };

  const handleSubmitTeamProof = async () => {
    if (!currentTaskTeam || !teamProofFile) {
      return addToast('Please select a proof screenshot file', 'error');
    }

    setIsSubmittingTeam(true);
    try {
      const formData = new FormData();
      formData.append('teamId', currentTaskTeam.id);
      formData.append('remarks', teamRemarks);
      formData.append('screenshot', teamProofFile);

      const res = await fetch(`${API_URL}/api/team/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        addToast('Team task submitted successfully!', 'success');
        setTeamProofFile(null);
        setTeamRemarks('');
        if (teamModalTask) openTeamModal(teamModalTask);
        fetchSubmissions();
      } else {
        addToast(data.error || 'Failed to submit team task', 'error');
      }
    } catch (e) {
      addToast('Network error submitting team task', 'error');
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  const fetchTeamSubmissionsForTask = async (taskId?: string) => {
    try {
      const url = taskId ? `${API_URL}/api/team/submissions?taskId=${taskId}` : `${API_URL}/api/team/submissions`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setTeamSubmissions(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch team submissions:', e);
    }
  };

  const handleReviewTeamSubmission = async (submissionId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`${API_URL}/api/team/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          submissionId,
          status,
          feedback: status === 'REJECTED' ? teamRejectionReason : 'Approved team submission'
        })
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`Team submission ${status.toLowerCase()} successfully!`, 'success');
        setReviewingTeamSubmission(null);
        setTeamRejectionReason('');
        if (verificationTaskFilter) {
          fetchTeamSubmissionsForTask(verificationTaskFilter);
        }
        fetchSubmissions();
      } else {
        addToast(data.error || 'Failed to review submission', 'error');
      }
    } catch (e) {
      addToast('Network error reviewing team submission', 'error');
    }
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
      if (classesRes.ok) {
        const rawCls = await classesRes.json();
        const sortClassesList = (clsList: Class[]) => [...(clsList || [])].sort((a, b) => (a.year || 0) - (b.year || 0) || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));
        setClasses(sortClassesList(rawCls));
      }
      fetchMyClass();
    }
  };

  const handlePosterSelect = (file: File | null) => {
    if (!file) {
      setPosterFile(null);
      setPosterPreview(null);
      return;
    }
    const isImg = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isImg && !isPdf) {
      addToast('Please select a valid image or PDF file for the poster.', 'error');
      return;
    }
    setPosterFile(file);
    if (isPdf) {
      setPosterPreview('PDF_DOCUMENT');
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPosterPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyTaskShareLink = (taskId: string | number) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?taskId=${taskId}`;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        addToast('Task share link copied to clipboard!', 'success');
      }).catch(() => {
        prompt('Copy Task Share Link:', shareUrl);
      });
    } else {
      prompt('Copy Task Share Link:', shareUrl);
    }
  };

  const handleTaskPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (isHOD && (!newTask.class_ids || newTask.class_ids.length === 0)) {
      addToast('Please select at least one class for the task.', 'error');
      return;
    }
    setShowTaskPreview(true);
  };

  const createTask = async () => {
    if (isHOD && (!newTask.class_ids || newTask.class_ids.length === 0)) {
      addToast('Please select at least one class for the task.', 'error');
      return;
    }

    setIsUploadingPoster(true);
    let poster_url: string | null = null;
    let poster_cloudinary_public_id: string | null = null;

    try {
      if (posterFile) {
        const formData = new FormData();
        formData.append('poster', posterFile);
        const uploadRes = await fetch(`${API_URL}/api/upload/poster`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          poster_url = uploadData.poster_url;
          poster_cloudinary_public_id = uploadData.poster_cloudinary_public_id;
        } else {
          addToast('Poster image upload failed. Posting task without poster image.', 'warning');
        }
      }

      const res = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...newTask,
          poster_url,
          poster_cloudinary_public_id
        })
      });

      if (res.ok) {
        const createdTask = await res.json();
        setNewTask({ title: '', description: '', category: 'Competition', external_link: '', deadline: '', screenshot_instruction: '', custom_field_label: '', department_id: '', class_ids: [], submission_type: 'INDIVIDUAL', min_team_size: 2, max_team_size: 5 });
        setPosterFile(null);
        setPosterPreview(null);
        setShowTaskPreview(false);
        addToast('Task created successfully!', 'success');
        fetchTasks();
        setSharedTaskModal(createdTask);
      } else {
        const data = await res.json();
        addToast(`Failed to create task: ${data.error}`, 'error');
        setShowTaskPreview(false);
      }
    } catch (e) {
      addToast('Network error while creating task. Please try again.', 'error');
      setShowTaskPreview(false);
    } finally {
      setIsUploadingPoster(false);
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
    if (!fileForTask) return addToast('Screenshot is required to participate.', 'error');
    if (!customFieldValue.trim()) return addToast('Please fill the required custom field.', 'error');

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

  const submitNotParticipating = async (taskId: number) => {
    const reason = notParticipatingReason[taskId] || '';
    if (!reason.trim()) return addToast('Please enter your reason for not participating.', 'error');
    setUploading(taskId);
    try {
      const res = await fetch(`${API_URL}/api/submissions/not-participating`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, not_participating_reason: reason.trim() })
      });
      if (res.ok) {
        setNotParticipating(prev => ({ ...prev, [taskId]: false }));
        setNotParticipatingReason(prev => ({ ...prev, [taskId]: '' }));
        setIsEditingOptOut(prev => ({ ...prev, [taskId]: false }));
        addToast('Recorded: Not participating in this task.', 'info');
        fetchSubmissions();
      } else {
        const data = await res.json();
        addToast(`Failed: ${data.error}`, 'error');
      }
    } catch {
      addToast('Network error. Please try again.', 'error');
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

  const handleDeleteScreenshot = (taskId: number) => {
    setSelectedFiles(prev => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    const fileInput = document.getElementById(`file-${taskId}`) as HTMLInputElement | null;
    if (fileInput) {
      fileInput.value = '';
    }
    addToast('Screenshot removed.', 'info');
  };

  const toggleTaskStatus = async (id: number | string, currentStatus: string) => {
    const newStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    setTasks(prev => prev.map(t => t.id.toString() === id.toString() ? { ...t, status: newStatus as any } : t));
    addToast(`Task status updated to ${newStatus}`, 'info');

    try {
      const res = await fetch(`${API_URL}/api/tasks/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        setTasks(prev => prev.map(t => t.id.toString() === id.toString() ? { ...t, status: currentStatus as any } : t));
        const data = await res.json();
        addToast(data.error || 'Failed to update task status', 'error');
      }
    } catch (e) {
      setTasks(prev => prev.map(t => t.id.toString() === id.toString() ? { ...t, status: currentStatus as any } : t));
      addToast('Network error updating task status', 'error');
    }
  };

  const handleExtendDeadlineAndReopen = async (taskId: string | number, deadlineIso: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/${taskId}/reopen`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deadline: deadlineIso })
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Task reopened and deadline extended successfully!', 'success');
        setExtendingTask(null);
        setExtendedDeadline('');
        fetchTasks();
      } else {
        addToast(data.error || 'Failed to extend deadline and reopen task', 'error');
      }
    } catch (e) {
      addToast('Network error reopening task', 'error');
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

  const exportToExcel = async (filters?: { classIds?: string[]; taskId?: string; status?: string; }) => {
    const isAdminRole = user?.role === 'SUPREME_ADMIN';
    const isHODRole = user?.role === 'HOD';
    const isYearCoordRole = user?.is_year_coordinator;
    const isClsRole = user?.role === 'CLASS_ADVISOR' || (user?.role === 'STUDENT' && user?.is_coordinator);
    const selectedClassIds = filters?.classIds || [];

    // ── Small helpers ──────────────────────────────────────────────────────────
    const ACADEMIC_YEAR = '2024-2028';
    const romanYearMap: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
    const toRomanYear = (yr: number) => romanYearMap[yr] ? `${romanYearMap[yr]} YEAR` : `YEAR ${yr}`;
    const getDeptAbbr = (name: string) => {
      const words = (name || '').toUpperCase().split(/\s+/).filter(w => w.length > 2);
      return words.length ? words.map(w => w[0]).join('') : (name || 'DEPT').slice(0, 4).toUpperCase();
    };
    const getSection = (cn: string) => { const m = cn.trim().match(/([A-Za-z])$/); return m ? m[1].toUpperCase() : ''; };

    const getExcelColumnName = (colIndex: number): string => {
      let temp = colIndex;
      let letter = '';
      while (temp > 0) {
        const rem = (temp - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        temp = Math.floor((temp - 1) / 26);
      }
      return letter;
    };

    const WATERMARK_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAARgAAAEYCAYAAACHjumMAAAQAElEQVR4AexdBYBcRdL+qp/MzFp24+4CBLcAwSW4O4f/6OFwuHP43eFw+B1y6OFwwd0hOCFGIMRd1kae/F/1zGw2HoIEyDze99qru6urq6u7J4tB6VmROJCoSiR6t66o2Kxj69b7d23X7uTunTpd3rtr19s3WGutxzZce+1XNlxnnY8HrrvusE3WX3/spgMGTNtsgw3qNt1gg8wmAwaEA9dbLx6w1lrx2quuGq7at2+mX48edb26dJnWo1Onsa2rqoa1qqj4uGV5+SuVicRjFYnE7WWue3kCONkH9neBzcjo3gSj+C29KwQHSgrmDzbM6wBe/7591xi4wXr7br/NFufvsetO9+675+5vH3PYYeOPO/z/0occdPDIgw486PU/7bf/Awfst/+1f9p3v7P323ufI7fdZtAeg7beZsttt95mnW222rrf1ltu1ZloRZRvvdVW/rbbbmu233577Lzzzth9993NPvvs4x9wwAHlBx98cKtDDz2087HHHtvvqKOPXueQQw/dkvF77LrLLkeyzNlbbrXVtZttttkD/fuv8vrKfXqP7NapY7p1ddX4skTibQe41wDn093XA9bgUNDht/T+YTjA8f3D9GWF68g6ffu23mLD9bfdYevNzzryoAMePPawQ77e+OgjstsP2uqzjdZb76FV+va7pEv79ge1qakZOG3qlI4TJkzAt99+i88++wxvvfUWBg8ejMceewwPP/ww7rrrLos777wTijvuuAO33347brvtNoubb74Zt9z6T9x6+2246193497778MDDz2Ihx99BI8+9l+88dab+PDjjzBi1EjMnD0LfjKBTl06o/9qq2Ld9dfDHrvtjr333Av77bMvsV/HvffYY+DOO+xw0JabbnrJRgMGPFTdosVnLSsqshW+/3XSmAdp8ZxFbMtBbU2U3t8pB0oK5nc0cNtuvPEah+2797FnnXDcvRed8Zdh2+6w3dRVV+n/fPvWba+YMG78fiOGDVvlvXfexbNPP4MH7v8P7r7zLtx5+52468678cyzz+G55wfj5ddexdvvv4chn3+GoSOG49sx3+P7cWMxdfo0iyl0FZPpNmHaNEyfOQNT6U6aPBnjxo/Hd9+PwchvR2PYiJEYOmw43n73Pbz2xpsY/MKLePyJJ/DA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";

    const createExcelReportWorkbook = async (
      sheetsData: { name: string; cols: string[]; dataRows: any[]; line5: string }[]
    ): Promise<ArrayBuffer> => {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'IT Task Manager';
      workbook.created = new Date();

      let logoId: number | undefined;
      try {
        logoId = workbook.addImage({
          base64: WATERMARK_BASE64,
          extension: 'png',
        });
      } catch (err) {
        console.warn('Could not load logo into workbook:', err);
      }

      const deptFull = (user?.department_name || 'INFORMATION TECHNOLOGY').toUpperCase();

      sheetsData.forEach(({ name, cols, dataRows, line5 }) => {
        const worksheet = workbook.addWorksheet(name, {
          views: [{ showGridLines: true }]
        });

        const numCols = Math.max(cols.length, 5);
        const startCol = numCols >= 3 ? 3 : 1;

        // Rows 1-5: College Header
        const headerRows = [
          { text: 'VSB ENGINEERING COLLEGE, KARUR', size: 14, bold: true, italic: false, color: 'FF1E3A8A', height: 24 },
          { text: '(AN AUTONOMOUS INSTITUTION)', size: 10, bold: true, italic: true, color: 'FF475569', height: 20 },
          { text: `DEPARTMENT OF ${deptFull}`, size: 11, bold: true, italic: false, color: 'FF1E3A8A', height: 20 },
          { text: `ACADEMIC YEAR ${ACADEMIC_YEAR}`, size: 11, bold: true, italic: false, color: 'FF475569', height: 20 },
          { text: line5, size: 12, bold: true, italic: false, color: 'FF1E3A8A', height: 20 }
        ];

        headerRows.forEach((h, idx) => {
          const rowNum = idx + 1;
          const cell = worksheet.getCell(rowNum, startCol);
          cell.value = h.text;
          cell.font = {
            name: 'Calibri',
            size: h.size,
            bold: h.bold,
            italic: h.italic,
            color: { argb: h.color }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          worksheet.getRow(rowNum).height = h.height;
          if (numCols > startCol) {
            try {
              worksheet.mergeCells(rowNum, startCol, rowNum, numCols);
            } catch (e) {}
          }
        });

        // Row 6: Blank separator
        worksheet.getRow(6).height = 15;

        // Add single header logo at top-left (A1 area) with fixed size (75x75 px)
        if (logoId !== undefined && numCols >= 3) {
          try {
            worksheet.addImage(logoId, {
              tl: { col: 0.15, row: 0.15 } as any,
              ext: { width: 75, height: 75 },
              editAs: 'oneCell'
            });
          } catch (e) {
            console.warn('Could not attach header logo:', e);
          }
        }

        // Row 7: Column Table Headers
        const tableHeaderRow = worksheet.getRow(7);
        tableHeaderRow.height = 24;
        cols.forEach((colName, cIdx) => {
          const cell = tableHeaderRow.getCell(cIdx + 1);
          cell.value = colName;
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E3A8A' }
          };
          cell.alignment = { horizontal: cIdx === 0 ? 'center' : 'left', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
          };
        });

        // Rows 8+: Data rows
        let currentRowNum = 8;
        dataRows.forEach((rowObj) => {
          const dataRow = worksheet.getRow(currentRowNum);
          dataRow.height = 20;
          cols.forEach((colName, cIdx) => {
            const cell = dataRow.getCell(cIdx + 1);
            const val = rowObj[colName] ?? '';
            cell.value = val;
            cell.font = { name: 'Calibri', size: 10 };
            cell.alignment = {
              horizontal: cIdx === 0 ? 'center' : 'left',
              vertical: 'middle'
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            // Status color highlight
            if (typeof val === 'string') {
              const lower = val.toLowerCase();
              if (lower === 'verified' || lower === 'yes') {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF16A34A' } };
              } else if (lower === 'rejected' || lower === 'no') {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
              } else if (lower === 'submitted') {
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFD97706' } };
              }
            }
          });
          currentRowNum++;
        });

        let lastUsedRow = currentRowNum - 1;
        let lastUsedCol = cols.length;

        // Auto-fit column widths strictly for actual columns 1 to lastUsedCol
        cols.forEach((colName, cIdx) => {
          let maxLen = colName.length;
          dataRows.forEach((rowObj) => {
            const val = rowObj[colName];
            if (val !== undefined && val !== null) {
              const s = String(val);
              if (s.length > maxLen) maxLen = s.length;
            }
          });
          const col = worksheet.getColumn(cIdx + 1);
          col.width = Math.min(Math.max(maxLen + 4, cIdx < 2 ? 14 : 12), 45);
        });

        // Calculate actual last used row and column based on populated cells
        let actualLastRow = 0;
        let actualLastCol = 0;
        worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
          let rowHasValue = false;
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
              rowHasValue = true;
              if (colNumber > actualLastCol) {
                actualLastCol = colNumber;
              }
            }
          });
          if (rowHasValue && rowNumber > actualLastRow) {
            actualLastRow = rowNumber;
          }
        });
        if (actualLastRow === 0) actualLastRow = lastUsedRow || 1;
        if (actualLastCol === 0) actualLastCol = lastUsedCol || 1;

        // Trim trailing generated/instantiated rows after that boundary where safely supported
        if (worksheet.rowCount > actualLastRow) {
          try {
            worksheet.spliceRows(actualLastRow + 1, worksheet.rowCount - actualLastRow);
          } catch (e) {
            console.warn('[Excel Export] Error splicing rows:', e);
          }
        }

        // Trim trailing generated/instantiated columns after that boundary where safely supported
        if (worksheet.columnCount > actualLastCol) {
          try {
            worksheet.spliceColumns(actualLastCol + 1, worksheet.columnCount - actualLastCol);
          } catch (e) {
            console.warn('[Excel Export] Error splicing columns:', e);
          }
        }

        // Use actual boundaries for print setup
        lastUsedRow = actualLastRow;
        lastUsedCol = actualLastCol;

        // Set Print Area and page boundary strictly to exact report range (e.g. A1:F55)
        const lastColLetter = getExcelColumnName(lastUsedCol);
        worksheet.pageSetup.printArea = `A1:${lastColLetter}${lastUsedRow}`;
        worksheet.pageSetup.fitToPage = true;
        worksheet.pageSetup.fitToWidth = 1;
        worksheet.pageSetup.fitToHeight = 0;
      });

      return await workbook.xlsx.writeBuffer();
    };

    // Build "III YEAR IT SECTION A" style string from a Class object
    const buildClassInfo = (cls: Class): string => {
      const yr = cls.year ? toRomanYear(Number(cls.year)) : '';
      const dept = getDeptAbbr(cls.department_name || user?.department_name || 'IT');
      const sec = getSection(cls.name);
      return [yr, dept, sec ? `SECTION ${sec}` : ''].filter(Boolean).join(' ');
    };

    // 1. Scope students by role and optional classIds filter
    const targetStudents = users.filter(u => {
      if (u.role !== 'STUDENT') return false;

      let inScope = true;
      if (isClsRole && !isAdminRole && !isHODRole && !isYearCoordRole) {
        const cid = (user?.class_id || myClass?.id)?.toString();
        inScope = cid ? u.class_id?.toString() === cid : false;
      } else if (isYearCoordRole && !isAdminRole && !isHODRole) {
        const sc = classes.find(c => c.id.toString() === u.class_id?.toString());
        inScope = u.department_id?.toString() === user?.department_id?.toString() && Number(sc?.year) === Number(user?.year_scope);
      } else if (isHODRole && !isAdminRole) {
        inScope = u.department_id?.toString() === user?.department_id?.toString();
      }

      if (!inScope) return false;

      if (selectedClassIds.length > 0) {
        return selectedClassIds.includes(u.class_id?.toString() || '');
      }

      return true;
    });

    if (targetStudents.length === 0) {
      addToast('No student records found for the selected filters.', 'error');
      return;
    }

    // 2. Scope tasks
    let targetTasks = tasks;
    if (filters?.taskId) {
      targetTasks = tasks.filter(t => t.id?.toString() === filters.taskId);
    } else {
      targetTasks = tasks.filter(t => {
        if (isAdminRole) return true;
        if (isHODRole || isYearCoordRole) {
          return t.department_id?.toString() === user?.department_id?.toString() || (!t.department_id && (!t.class_ids || !t.class_ids.length));
        }
        const userClassId = (user?.class_id || myClass?.id)?.toString();
        if (Array.isArray(t.class_ids) && t.class_ids.length > 0) {
          return t.class_ids.some((cid: any) => cid.toString() === userClassId);
        }
        return t.department_id?.toString() === user?.department_id?.toString() || (!t.department_id);
      });
    }

    const selectedStatus = filters?.status || 'ALL';

    // Helper: get submission for a student+task pair
    const getSub = (studentId: number, regNo: string | undefined, taskId: number) =>
      submissions.find(s =>
        (s.user_id?.toString() === studentId.toString() || (regNo && s.register_number === regNo)) &&
        s.task_id?.toString() === taskId.toString()
      );

    // ── Resolve class info string for header line 5 ────────────────────────────
    const resolveClassInfoStr = (): string => {
      const cids = selectedClassIds.length > 0
        ? selectedClassIds
        : isClsRole
          ? [(user?.class_id || myClass?.id)?.toString() || '']
          : [];

      if (cids.length > 0) {
        const parts = cids
          .map(cid => { const cls = classes.find(c => c.id.toString() === cid); return cls ? buildClassInfo(cls) : cid; })
          .filter(Boolean);
        return parts.join(' & ');
      }

      // HOD/Admin with no specific class selected — gather from scoped students
      const seen = new Set<string>();
      const parts: string[] = [];
      targetStudents.forEach(st => {
        const cid = st.class_id?.toString() || '';
        if (!seen.has(cid)) {
          seen.add(cid);
          const cls = classes.find(c => c.id.toString() === cid);
          const info = cls ? buildClassInfo(cls) : (st.class_name || cid);
          if (info) parts.push(info);
        }
      });
      return parts.length > 0 && parts.length <= 4 ? parts.join(' & ') : 'ALL CLASSES';
    };

    const classInfoStr = resolveClassInfoStr();
    const selectedTaskTitle = filters?.taskId
      ? (tasks.find(t => t.id?.toString() === filters.taskId)?.title || 'TASK REPORT')
      : 'ALL TASKS';

    const sheet1Line5 = `${selectedTaskTitle} - ${classInfoStr}`;
    const sheet2Line5 = `TASK COMPLETION SUMMARY - ${classInfoStr}`;

    // ── PRE-FETCH TEAM REPORT DATA ──────────────────────────────────────────────
    const teamRows: any[] = [];
    const teamStudentMap = new Map<string, { status: string; teamName: string; remarks?: string }>();

    try {
      const classQuery = selectedClassIds.length > 0 ? `?class_ids=${encodeURIComponent(selectedClassIds.join(','))}` : '';
      const taskQuery = filters?.taskId ? `${classQuery ? '&' : '?'}task_id=${encodeURIComponent(filters.taskId)}` : '';
      const teamRes = await fetch(`${API_URL}/api/team/report${classQuery}${taskQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (teamRes.ok) {
        const teamData: any[] = await teamRes.json();
        let teamSno = 1;

        teamData.forEach(t => {
          if (filters?.taskId && t.task_id?.toString() !== filters.taskId.toString()) {
            return;
          }

          const subStat = (t.submission_status || '').toUpperCase();
          const teamStat = (t.team_status || '').toUpperCase();

          let mappedStatus = 'NOT_SUBMITTED';
          if (subStat === 'APPROVED' || subStat === 'VERIFIED' || teamStat === 'APPROVED') {
            mappedStatus = 'VERIFIED';
          } else if (subStat === 'PENDING' || subStat === 'SUBMITTED' || teamStat === 'SUBMITTED') {
            mappedStatus = 'SUBMITTED';
          } else if (subStat === 'REJECTED' || teamStat === 'REJECTED') {
            mappedStatus = 'REJECTED';
          }

          const info = {
            status: mappedStatus,
            teamName: t.team_name || 'Team',
            remarks: t.remarks || ''
          };

          if (t.leader_id && t.task_id) {
            teamStudentMap.set(`${t.leader_id.toString()}_${t.task_id.toString()}`, info);
          }

          if (Array.isArray(t.members)) {
            t.members.forEach((m: any) => {
              if (m.student_id && t.task_id) {
                teamStudentMap.set(`${m.student_id.toString()}_${t.task_id.toString()}`, info);
              }
            });
          }

          const leaderStr = `${t.leader_name || 'Leader'} (${t.leader_regno || 'N/A'})`;
          const statusStr = t.submission_status || t.team_status || 'FORMING';

          const membersList = Array.isArray(t.members) && t.members.length > 0 ? t.members : [];
          const participantsStr = membersList.length > 0
            ? membersList.map((m: any) => {
                const memberText = `${m.full_name || 'Student'} (${m.register_number || 'N/A'})`;
                return m.status === 'PENDING' ? `${memberText} [Pending]` : memberText;
              }).join(', ')
            : leaderStr;

          teamRows.push({
            'S.No': teamSno,
            'Team Name': t.team_name || '—',
            'Team Leader': leaderStr,
            'Team Participants': participantsStr,
            'Hackathon / Task Name': t.task_title || '—',
            'Category': t.task_category || 'Competition',
            'Team Status': statusStr,
          });
          teamSno++;
        });
      }
    } catch (err) {
      console.error('Error fetching team report data for excel:', err);
    }

    // ── SHEET 1: Detailed rows ─────────────────────────────────────────────────
    const detailedRows: any[] = [];
    let sno = 1;

    if (!filters?.taskId) {
      // Matrix Mode (Multiple Tasks): One row per student
      targetStudents.forEach(student => {
        const studentRow: any = {
          'S.No': sno,
          'Reg No': student.register_number || '—',
          'Name': student.full_name || '—',
          'Mail ID': student.email || '—'
        };

        let hasMatchingStatus = (selectedStatus === 'ALL');

        targetTasks.forEach((task, idx) => {
          if (Array.isArray(task.class_ids) && task.class_ids.length > 0 && !task.class_ids.some((cid: any) => cid.toString() === student.class_id?.toString())) {
            studentRow[`Task ${idx + 1}: ${task.title}`] = 'N/A';
            return;
          }

          const sub = getSub(student.id, student.register_number, task.id);
          const teamInfo = teamStudentMap.get(`${student.id}_${task.id}`);

          let rawStatus = sub ? sub.status : 'NOT_SUBMITTED';
          if (teamInfo && rawStatus === 'NOT_SUBMITTED') {
            rawStatus = teamInfo.status;
          }

          const statusLabel =
            rawStatus === 'VERIFIED' ? 'Verified' :
              rawStatus === 'SUBMITTED' ? 'Submitted' :
                rawStatus === 'REJECTED' ? 'Rejected' :
                  rawStatus === 'NOT_PARTICIPATING' ? 'Not Interested' : 'Not Submitted';

          studentRow[`Task ${idx + 1}: ${task.title}`] = statusLabel;

          if (selectedStatus !== 'ALL' && rawStatus === selectedStatus) {
            hasMatchingStatus = true;
          }
        });

        if (hasMatchingStatus) {
          studentRow['S.No'] = sno++;
          detailedRows.push(studentRow);
        }
      });
    } else {
      // Original Mode (Single Task): One row per student-task pair
      targetStudents.forEach(student => {
        targetTasks.forEach(task => {
          if (Array.isArray(task.class_ids) && task.class_ids.length > 0 && !task.class_ids.some((cid: any) => cid.toString() === student.class_id?.toString())) {
            return;
          }
          const sub = getSub(student.id, student.register_number, task.id);
          const teamInfo = teamStudentMap.get(`${student.id}_${task.id}`);

          let rawStatus = sub ? sub.status : 'NOT_SUBMITTED';
          let customFieldValue = sub?.custom_field_value || '—';

          if (teamInfo && rawStatus === 'NOT_SUBMITTED') {
            rawStatus = teamInfo.status;
            customFieldValue = `Team: ${teamInfo.teamName}${teamInfo.remarks ? ` (${teamInfo.remarks})` : ''}`;
          }

          const isNotParticipating = rawStatus === 'NOT_PARTICIPATING';
          const isParticipating = rawStatus === 'SUBMITTED' || rawStatus === 'VERIFIED' || rawStatus === 'REJECTED';

          const statusLabel =
            rawStatus === 'VERIFIED' ? 'Verified' :
              rawStatus === 'SUBMITTED' ? 'Submitted' :
                rawStatus === 'REJECTED' ? 'Rejected' :
                  rawStatus === 'NOT_PARTICIPATING' ? 'Not Interested' : 'Not Submitted';

          let include = false;
          if (selectedStatus === 'ALL') include = true;
          else if (selectedStatus === 'VERIFIED') include = rawStatus === 'VERIFIED';
          else if (selectedStatus === 'SUBMITTED') include = rawStatus === 'SUBMITTED';
          else if (selectedStatus === 'REJECTED') include = rawStatus === 'REJECTED';
          else if (selectedStatus === 'NOT_SUBMITTED') include = rawStatus === 'NOT_SUBMITTED';
          else if (selectedStatus === 'NOT_PARTICIPATING') include = rawStatus === 'NOT_PARTICIPATING';

          if (include) {
            detailedRows.push({
              'S.No': sno++,
              'Name': student.full_name || '—',
              'Reg No': student.register_number || '—',
              'Mail ID': student.email || '—',
              'Task Name': task.title,
              'Participating / Interested': isParticipating ? 'Yes' : isNotParticipating ? 'No' : '—',
              'Task Status': statusLabel,
              'Custom Field': customFieldValue,
              'Reason (If Not Participating)': isNotParticipating ? (sub?.not_participating_reason || '—') : '—',
            });
          }
        });
      });
    }

    if (detailedRows.length === 0) {
      addToast('No records matched the selected filters.', 'error');
      return;
    }

    // ── SHEET 2: Summary per task per class ────────────────────────────────────
    const classGroups: { classId: string; className: string }[] = [];
    if (selectedClassIds.length > 0) {
      selectedClassIds.forEach(cid => {
        const cls = classes.find(c => c.id.toString() === cid);
        classGroups.push({ classId: cid, className: cls?.name || cid });
      });
    } else if (isClsRole) {
      const cid = (user?.class_id || myClass?.id)?.toString() || '';
      const cls = classes.find(c => c.id.toString() === cid);
      classGroups.push({ classId: cid, className: cls?.name || cid });
    } else {
      const seen = new Set<string>();
      targetStudents.forEach(st => {
        const cid = st.class_id?.toString() || '';
        if (!seen.has(cid)) {
          seen.add(cid);
          const cls = classes.find(c => c.id.toString() === cid);
          classGroups.push({ classId: cid, className: cls?.name || st.class_name || cid });
        }
      });
    }

    const summaryRows: any[] = [];
    targetTasks.forEach(task => {
      classGroups.forEach(({ classId, className }) => {
        if (Array.isArray(task.class_ids) && task.class_ids.length > 0 && !task.class_ids.some((cid: any) => cid.toString() === classId)) {
          return;
        }
        const classStudents = targetStudents.filter(st => st.class_id?.toString() === classId);
        if (classStudents.length === 0) return;

        let verifiedCount = 0, submittedCount = 0, rejectedCount = 0, notSubmittedCount = 0, notParticipatingCount = 0;
        classStudents.forEach(st => {
          const sub = getSub(st.id, st.register_number, task.id);
          const teamInfo = teamStudentMap.get(`${st.id}_${task.id}`);
          let rs = sub ? sub.status : 'NOT_SUBMITTED';
          if (teamInfo && rs === 'NOT_SUBMITTED') {
            rs = teamInfo.status;
          }

          if (rs === 'VERIFIED') verifiedCount++;
          else if (rs === 'SUBMITTED') submittedCount++;
          else if (rs === 'REJECTED') rejectedCount++;
          else if (rs === 'NOT_PARTICIPATING') notParticipatingCount++;
          else notSubmittedCount++;
        });

        summaryRows.push({
          'Task Name': task.title,
          'Class': className,
          'Total Students': classStudents.length,
          'Verified': verifiedCount,
          'Submitted': submittedCount,
          'Rejected': rejectedCount,
          'Not Participating': notParticipatingCount,
          'Not Submitted': notSubmittedCount,
        });
      });
    });

    // ── Build Workbook ─────────────────────────────────────────────────────────
    let sheet1Cols: string[] = [];
    if (!filters?.taskId) {
      sheet1Cols = ['S.No', 'Reg No', 'Name', 'Mail ID'];
      targetTasks.forEach((task, idx) => {
        sheet1Cols.push(`Task ${idx + 1}: ${task.title}`);
      });
    } else {
      sheet1Cols = [
        'S.No',
        'Name',
        'Reg No',
        'Mail ID',
        'Task Name',
        'Participating / Interested',
        'Task Status',
        'Custom Field',
        'Reason (If Not Participating)'
      ];
    }
    const sheet2Cols = ['Task Name', 'Class', 'Total Students', 'Verified', 'Submitted', 'Rejected', 'Not Participating', 'Not Submitted'];
    const sheet3Cols = [
      'S.No',
      'Team Name',
      'Team Leader',
      'Team Participants',
      'Hackathon / Task Name',
      'Category',
      'Team Status'
    ];

    const sheet3Line5 = `TEAM WISE TASK REPORT - ${classInfoStr}`;

    const sheetsData = [
      {
        name: 'Detailed Report',
        cols: sheet1Cols,
        dataRows: detailedRows,
        line5: sheet1Line5
      },
      {
        name: 'Summary',
        cols: sheet2Cols,
        dataRows: summaryRows.length ? summaryRows : [{ 'Task Name': 'No summary data.' }],
        line5: sheet2Line5
      },
      {
        name: 'Team Wise Report',
        cols: sheet3Cols,
        dataRows: teamRows.length ? teamRows : [{ 'S.No': 1, 'Team Name': 'No team data available for selection' }],
        line5: sheet3Line5
      }
    ];

    const dateTag = new Date().toISOString().split('T')[0];
    const roleTag = isAdminRole ? 'SuperAdmin' : isHODRole ? 'HOD' : isYearCoordRole ? `Year${user?.year_scope}_Coord` : 'Class';
    const statusTag = selectedStatus === 'ALL' ? 'All' : selectedStatus.charAt(0) + selectedStatus.slice(1).toLowerCase();

    try {
      const finalBuffer = await createExcelReportWorkbook(sheetsData);
      const blob = new Blob([finalBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${roleTag}_Report_${statusTag}_${dateTag}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (exportErr) {
      console.error('Error exporting excel report:', exportErr);
      addToast('Failed to generate Excel report', 'error');
    }
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
            <div className="w-24 h-24 rounded-3xl bg-white p-3 mb-6 shadow-2xl border-2 border-zinc-200 ring-4 ring-indigo-50 flex items-center justify-center">
              <img src="/logo.png" alt="VSBEC Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-4xl font-black text-zinc-900 tracking-tight">Academic Portal</h1>
            <p className="text-zinc-500 mt-2 text-lg">VSBEC IT Task Management System</p>
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
                    <label className="text-sm font-medium text-zinc-700 mb-1 block">Email ID</label>
                    <Input
                      placeholder="student@gmail.com"
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
                        placeholder="Enter Password"
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
      // HOD year filter: when a year is selected but no specific class, filter students by year
      if (isDept && analyzerYearFilter && !analyzerClassFilter) {
        const studentClass = classes.find(c => c.id.toString() === u.class_id?.toString());
        return String(studentClass?.year) === analyzerYearFilter;
      }
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
          submissionLabel = sub.status === 'VERIFIED' ? 'Verified' : sub.status === 'REJECTED' ? 'Rejected' : sub.status === 'NOT_PARTICIPATING' ? 'Not Interested' : 'Submitted';
        }
      } else {
        const studentSubs = submissions.filter(s => s.user_id?.toString() === student.id?.toString());
        const visibleTasks = tasks.filter(t => {
          if (analyzerClassFilter) {
            if ((t.class_ids || []).some(cid => cid.toString() === analyzerClassFilter)) return true;
            if (t.department_id && t.department_id.toString() === student.department_id?.toString() && (!(t.class_ids || []).length)) return true;
            if (!t.department_id && (!(t.class_ids || []).length)) return true;
            return false;
          }
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

    const getStudentGender = (student: any): 'MALE' | 'FEMALE' => {
      const g = (student.gender || '').toUpperCase();
      if (g === 'FEMALE' || g === 'GIRLS') return 'FEMALE';
      return 'MALE';
    };

    const isStudentDone = (s: any) => {
      if (analyzerTaskFilter) {
        return s.submissionStatus === 'VERIFIED' || s.submissionStatus === 'SUBMITTED';
      }
      return s.submissionStatus === 'VERIFIED';
    };

    const isStudentResponded = (s: any) => {
      const studentSubs = submissions.filter(sub => sub.user_id?.toString() === s.id?.toString() && sub.status !== 'NOT_PARTICIPATING');
      if (analyzerTaskFilter) {
        return studentSubs.some(sub => sub.task_id?.toString() === analyzerTaskFilter);
      }
      return studentSubs.length > 0;
    };

    const isStudentSkipped = (s: any) => {
      const studentSubs = submissions.filter(sub => sub.user_id?.toString() === s.id?.toString());
      if (analyzerTaskFilter) {
        return studentSubs.some(sub => sub.task_id?.toString() === analyzerTaskFilter && sub.status === 'NOT_PARTICIPATING');
      }
      return studentSubs.some(sub => sub.status === 'NOT_PARTICIPATING');
    };

    const boysEnriched = enriched.filter(s => getStudentGender(s) === 'MALE');
    const girlsEnriched = enriched.filter(s => getStudentGender(s) === 'FEMALE');

    const boysCompleted = boysEnriched.filter(isStudentDone).length;
    const boysPending = boysEnriched.length - boysCompleted;

    const girlsCompleted = girlsEnriched.filter(isStudentDone).length;
    const girlsPending = girlsEnriched.length - girlsCompleted;

    const completedCount = enriched.filter(isStudentDone).length;
    const pendingCount = enriched.length - completedCount;

    const respondedCount = enriched.filter(isStudentResponded).length;
    const boysResponded = boysEnriched.filter(isStudentResponded).length;
    const girlsResponded = girlsEnriched.filter(isStudentResponded).length;

    const skippedCount = enriched.filter(isStudentSkipped).length;
    const boysSkipped = boysEnriched.filter(isStudentSkipped).length;
    const girlsSkipped = girlsEnriched.filter(isStudentSkipped).length;

    const filtered = enriched.filter(s => {
      const g = getStudentGender(s);
      if (analyzerGenderFilter === 'BOYS' && g !== 'MALE') return false;
      if (analyzerGenderFilter === 'GIRLS' && g !== 'FEMALE') return false;
      if (analyzerStatusFilter === 'COMPLETED') return isStudentDone(s);
      if (analyzerStatusFilter === 'PENDING') return !isStudentDone(s) && s.submissionStatus !== 'NOT_PARTICIPATING';
      if (analyzerStatusFilter === 'NOT_PARTICIPATING') return s.submissionStatus === 'NOT_PARTICIPATING';
      return true;
    });

    return (
      <ContentCard className="p-0 overflow-hidden mt-10">
        <div className="p-6 border-b border-zinc-200 bg-zinc-50/50">
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">{title}</h3>
          <p className="text-xs font-medium text-zinc-500 mt-1">Track student progress and events by class and gender</p>
        </div>

        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-5 gap-4 bg-white border-b border-zinc-200">
          {isGlobal && (
            <div>
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Departments</label>
              <Select
                value={adminDeptFilter}
                onChange={e => {
                  setAdminDeptFilter(e.target.value);
                  setAnalyzerYearFilter('');
                  setAnalyzerClassFilter('');
                }}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id.toString()}>{d.name}</option>)}
              </Select>
            </div>
          )}
          {!isCls && (
            <>
              {/* YEAR filter — HOD / Admin */}
              {(isDept || isGlobal) && (
                <div>
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Year</label>
                  <Select
                    value={analyzerYearFilter}
                    onChange={e => {
                      setAnalyzerYearFilter(e.target.value);
                      setAnalyzerClassFilter(''); // reset class when year changes
                    }}
                  >
                    <option value="">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Section / Class</label>
                <Select
                  value={analyzerClassFilter}
                  onChange={e => setAnalyzerClassFilter(e.target.value)}
                >
                  <option value="">All Classes / Sections</option>
                  {classes.filter(c => {
                    if (analyzerYearFilter && String(c.year) !== analyzerYearFilter) return false;
                    if (currentDeptId && c.department_id?.toString() !== currentDeptId) return false;
                    if (isYear && Number(c.year) !== currentYearScope) return false;
                    return true;
                  }).sort((a, b) => (a.year || 0) - (b.year || 0) || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })).map(c => (
                    <option key={c.id} value={c.id.toString()}>{c.name}</option>
                  ))}
                </Select>
              </div>
            </>
          )}
          <div className={cn(isGlobal ? "md:col-span-1" : isCls ? "md:col-span-2" : "md:col-span-1")}>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Event</label>
            <Select
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
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Gender</label>
            <Select
              value={analyzerGenderFilter}
              onChange={e => setAnalyzerGenderFilter(e.target.value as any)}
            >
              <option value="ALL">All Students</option>
              <option value="BOYS">Boys</option>
              <option value="GIRLS">Girls</option>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block">Status</label>
            <Select
              value={analyzerStatusFilter}
              onChange={e => setAnalyzerStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Not Registered</option>
              <option value="NOT_PARTICIPATING">Not Interested</option>
            </Select>
          </div>
        </div>

        {/* Separate Gender Breakdown Cards */}
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-zinc-50 border-b border-zinc-200">
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Students</p>
              <p className="text-2xl font-black text-zinc-900 mt-0.5">{enriched.length}</p>
            </div>
            <div className="text-right text-xs font-semibold text-zinc-600 space-y-0.5">
              <p className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md flex items-center justify-end gap-1"><User size={12} /> Boys: {boysEnriched.length}</p>
              <p className="bg-pink-50 text-pink-700 px-2 py-0.5 rounded-md flex items-center justify-end gap-1"><User size={12} /> Girls: {girlsEnriched.length}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-indigo-200 flex items-center justify-between shadow-sm bg-gradient-to-br from-indigo-50/30 to-white">
            <div>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Responded Students</p>
              <p className="text-2xl font-black text-indigo-700 mt-0.5">{respondedCount}</p>
              <span className="text-[9px] font-semibold text-indigo-500">Interested</span>
            </div>
            <div className="text-right text-xs font-semibold space-y-0.5">
              <p className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md flex items-center justify-end gap-1"><User size={12} /> Boys: {boysResponded}</p>
              <p className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md flex items-center justify-end gap-1"><User size={12} /> Girls: {girlsResponded}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Completed / Verified</p>
              <p className="text-2xl font-black text-emerald-600 mt-0.5">{completedCount}</p>
            </div>
            <div className="text-right text-xs font-semibold space-y-0.5">
              <p className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md flex items-center justify-end gap-1"><User size={12} /> Boys: {boysCompleted}</p>
              <p className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md flex items-center justify-end gap-1"><User size={12} /> Girls: {girlsCompleted}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Skipped / Not Interested</p>
              <p className="text-2xl font-black text-orange-600 mt-0.5">{skippedCount}</p>
            </div>
            <div className="text-right text-xs font-semibold space-y-0.5">
              <p className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md flex items-center justify-end gap-1"><User size={12} /> Boys: {boysSkipped}</p>
              <p className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded-md flex items-center justify-end gap-1"><User size={12} /> Girls: {girlsSkipped}</p>
            </div>
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
                  if (currentClassId) return !(t.class_ids || []).length || (t.class_ids || []).some(cid => cid.toString() === currentClassId);
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

        <div className="overflow-x-auto custom-scrollbar">
          <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50/30">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-zinc-200">
                <span className="text-xs font-bold text-zinc-700">{filtered.length} Students</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                <span className="text-xs font-bold text-emerald-700">{filtered.filter(isStudentDone).length} Done</span>
              </div>
              <div className="flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-full border border-red-100">
                <span className="text-xs font-bold text-red-700">{filtered.length - filtered.filter(isStudentDone).length} Not Registered</span>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-zinc-200/60 p-1 rounded-full border border-zinc-200">
              <button
                type="button"
                onClick={() => setAnalyzerGenderFilter('ALL')}
                className={cn(
                  "px-3.5 py-1 rounded-full text-xs font-bold transition-all",
                  analyzerGenderFilter === 'ALL'
                    ? "bg-black text-white shadow-sm"
                    : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                )}
              >
                All ({enriched.length})
              </button>
              <button
                type="button"
                onClick={() => setAnalyzerGenderFilter('BOYS')}
                className={cn(
                  "px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1",
                  analyzerGenderFilter === 'BOYS'
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-blue-700 hover:bg-blue-50"
                )}
              >
                Boys ({boysEnriched.length})
              </button>
              <button
                type="button"
                onClick={() => setAnalyzerGenderFilter('GIRLS')}
                className={cn(
                  "px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1",
                  analyzerGenderFilter === 'GIRLS'
                    ? "bg-pink-600 text-white shadow-sm"
                    : "text-pink-700 hover:bg-pink-50"
                )}
              >
                Girls ({girlsEnriched.length})
              </button>
            </div>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Student</TH>
                <TH className="text-center">Status</TH>
                <TH className="text-right">Progress</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map(student => {
                const isCompleted = student.submissionStatus === 'VERIFIED' || student.submissionStatus === 'SUBMITTED';
                return (
                  <TR key={student.id}>
                    <TD className="text-sm text-zinc-900">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900">{student.full_name}</span>
                        {student.gender && (() => {
                          const isBoy = ['MALE', 'BOYS', 'BOY', 'M'].includes((student.gender || '').toUpperCase());
                          return (
                            <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded uppercase border flex items-center gap-1", isBoy ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-pink-50 text-pink-600 border-pink-100")}>
                              <User size={10} /> {isBoy ? 'Boy' : 'Girl'}
                            </span>
                          );
                        })()}
                        {!analyzerClassFilter && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-500 text-xs font-bold rounded uppercase border border-indigo-100">
                            {student.clsName}
                          </span>
                        )}
                        <span className="text-xs text-zinc-400 font-mono italic">{student.register_number}</span>
                      </div>
                      {!analyzerTaskFilter && student.missingTasks && student.missingTasks.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="text-xs text-zinc-400 font-bold uppercase mr-1">Missing:</span>
                          {student.missingTasks.slice(0, 3).map((t: any) => (
                            <span key={t.id} className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded text-xs font-medium">{t.title}</span>
                          ))}
                          {student.missingTasks.length > 3 && <span className="text-xs text-zinc-400">+{student.missingTasks.length - 3} more</span>}
                        </div>
                      )}
                    </TD>
                    <TD className="text-center">
                      <Badge variant={
                        student.submissionStatus === 'VERIFIED' ? 'success' :
                          student.submissionStatus === 'SUBMITTED' ? 'warning' : 'danger'
                      }>
                        {student.submissionStatus === 'SUBMITTED' && !analyzerTaskFilter ? 'In Progress' :
                          student.submissionStatus === 'SUBMITTED' && analyzerTaskFilter ? 'Submitted' :
                            student.submissionLabel}
                      </Badge>
                    </TD>
                    <TD className="text-right font-black text-zinc-400">
                      {(() => {
                        if (analyzerTaskFilter) return isCompleted ? '100%' : '0%';
                        const parts = student.submissionLabel.split('/');
                        if (parts.length < 2) return '0%';
                        const done = parseInt(parts[0].trim());
                        const total = parseInt(parts[1].trim().split(' ')[0]);
                        if (isNaN(done) || isNaN(total) || total === 0) return '0%';
                        return `${Math.min(100, Math.round((done / total) * 100))}%`;
                      })()}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      </ContentCard>
    );
  };

  if (isWakingServer) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-zinc-50 text-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-zinc-200">
            <Loader2 className="w-8 h-8 text-black animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900">Connecting to Server</h2>
          <p className="text-zinc-500 text-sm">
            Waking up the server — this can take up to a minute on first load...
          </p>
          <div className="px-3 py-1.5 bg-zinc-100 rounded-full text-xs font-semibold text-zinc-600">
            Attempt {wakeAttempt} of 6
          </div>
        </Card>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-[#F5F5F4] flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Connection Error</h2>
          <p className="text-zinc-500 text-sm mb-6">
            We are unable to connect to the portal. Please verify your internet connection or backend server status.
          </p>
          <Button
            className="w-full flex items-center justify-center gap-2"
            onClick={() => {
              setIsLoading(true);
              setHasError(false);
              runHealthCheckWithRetries();
            }}
          >
            Retry Connection
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#F5F5F4] font-sans text-zinc-900 overflow-hidden">
        {/* Sidebar Skeleton */}
        <div className="w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-zinc-100 flex items-center gap-3 shrink-0 h-20">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          {/* User bottom panel skeleton */}
          <div className="p-4 border-t border-zinc-100 shrink-0 bg-white space-y-3">
            <div className="px-4 py-2 bg-zinc-50 rounded-xl space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>

        {/* Content Pane Skeleton */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navbar Skeleton */}
          <div className="h-20 bg-white border-b border-zinc-200 flex items-center justify-between px-8 shrink-0">
            <Skeleton className="h-8 w-48" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full animate-pulse" />
              <Skeleton className="h-10 w-10 rounded-full animate-pulse" />
              <Skeleton className="h-10 w-24 rounded-xl animate-pulse" />
            </div>
          </div>
          
          {/* Scrollable Content Workspace Skeleton */}
          <div className="flex-1 p-8 overflow-y-auto space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              <Skeleton className="h-32 w-full rounded-2xl bg-white border border-zinc-200 shadow-sm" />
              <Skeleton className="h-32 w-full rounded-2xl bg-white border border-zinc-200 shadow-sm" />
              <Skeleton className="h-32 w-full rounded-2xl bg-white border border-zinc-200 shadow-sm" />
              <Skeleton className="h-32 w-full rounded-2xl bg-white border border-zinc-200 shadow-sm" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Skeleton className="h-[450px] lg:col-span-2 rounded-2xl bg-white border border-zinc-200 shadow-sm" />
              <Skeleton className="h-[450px] rounded-2xl bg-white border border-zinc-200 shadow-sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSyncGithubProgress = async () => {
    setSyncingGithub(true);
    try {
      const res = await fetch(`${API_URL}/api/github/sync/daily-commits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        addToast(data.message || 'GitHub daily commits sync completed', 'success');
        fetchGithubProgress();
        fetchGithubStats();
        fetchCombinedProgress();
      } else {
        addToast('Failed to sync GitHub daily commits', 'error');
      }
    } catch (err) {
      addToast('Network error syncing GitHub daily commits', 'error');
    } finally {
      setSyncingGithub(false);
    }
  };

  const handleDownloadCombinedExcel = async () => {
    try {
      const deptParam = selectedLeetcodeDeptId !== 'ALL' ? `&departmentId=${selectedLeetcodeDeptId}` : '';
      const yearParam = selectedLeetcodeYear !== 'ALL' ? `&year=${selectedLeetcodeYear}` : '';
      const classParam = selectedLeetcodeClassId !== 'ALL' ? `&classId=${selectedLeetcodeClassId}` : '';
      const exportView = codingPlatformTab === 'GITHUB'
        ? (leetcodeViewType === 'DAILY' ? 'GITHUB_DAILY' : 'GITHUB_WEEKLY')
        : leetcodeViewType;
      const downloadUrl = `${API_URL}/api/coding/export-excel?date=${leetcodeDate}&view=${exportView}${deptParam}${yearParam}${classParam}`;

      const res = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        let errMessage = 'Failed to export excel report';
        try {
          const data = await res.json();
          errMessage = data.error || errMessage;
        } catch (e) {}
        addToast(errMessage, 'error');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Try to parse the filename from Content-Disposition header if available
      const contentDisposition = res.headers.get('content-disposition');
      let fileName = `${exportView}_Progress_Report_${leetcodeDate}.xlsx`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=(?:"([^"]+)"|([^;]+))/);
        if (match) {
          fileName = (match[1] || match[2]).trim();
        }
      }

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading combined excel:', err);
      addToast('Network error exporting Excel', 'error');
    }
  };

  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingTarget) return;
    setSubmittingTarget(true);
    try {
      const res = await fetch(`${API_URL}/api/leetcode/targets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(assignTargetForm)
      });
      if (res.ok) {
        addToast('LeetCode target created successfully', 'success');
        setShowAssignTargetModal(false);
        fetchLeetcodeTargets();
        fetchLeetcodeProgress();
        fetchLeetcodeStats();
      } else {
        const data = await res.json();
        addToast(data.error || 'Failed to create LeetCode target', 'error');
      }
    } catch (err) {
      addToast('Network error creating LeetCode target', 'error');
    } finally {
      setSubmittingTarget(false);
    }
  };

  const handleSyncProgress = async () => {
    setSyncingLeetcode(true);
    try {
      const res = await fetch(`${API_URL}/api/leetcode/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        addToast(`Sync finished: Synced ${data.synced} profiles, ${data.failed} failed.`, 'success');
        fetchLeetcodeProgress();
        fetchLeetcodeStats();
      } else {
        addToast('Failed to sync LeetCode progress', 'error');
      }
    } catch (err) {
      addToast('Network error syncing LeetCode progress', 'error');
    } finally {
      setSyncingLeetcode(false);
    }
  };

  const handleViewStudentHistory = async (student: any) => {
    setSelectedStudentHistory(student);
    setShowHistoryModal(true);
    try {
      const endpoint = codingPlatformTab === 'GITHUB'
        ? `${API_URL}/api/github/daily-commits/${student.studentId}`
        : `${API_URL}/api/leetcode/progress/student/${student.studentId}`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudentHistoryData(data);
      }
    } catch (err) {
      console.error('Error fetching student history details:', err);
    }
  };

  const renderDailyChart = () => {
    let data: any[] = [];
    if (codingPlatformTab === 'GITHUB') {
      const historyList = studentHistoryData?.history || [];
      data = historyList.map((h: any) => ({
        date: h.date,
        actual: h.commits ?? h.daily_commit_count ?? 0,
        target: 0
      }));
    } else {
      data = studentHistoryData?.daily || [];
    }
    if (data.length === 0) return <div className="text-center text-xs py-10 text-zinc-400 font-bold">No progress data logged yet</div>;
    const maxVal = Math.max(...data.map((d: any) => Math.max(d.actual, d.target)), 5);
    const height = 120;
    const width = 500;
    const paddingLeft = 30;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 20;
    const chartHeight = height - paddingTop - paddingBottom;
    const chartWidth = width - paddingLeft - paddingRight;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
        <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#e4e4e7" strokeDasharray="3,3" />
        <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="#e4e4e7" strokeDasharray="3,3" />
        <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#e4e4e7" />

        {data.map((d: any, i: number) => {
          const x = paddingLeft + (i * (chartWidth / data.length));
          const barWidth = Math.max(2, (chartWidth / data.length) - 4);
          const barHeight = (d.actual / maxVal) * chartHeight;
          const targetY = height - paddingBottom - (d.target / maxVal) * chartHeight;

          return (
            <g key={i} className="group">
              <rect
                x={x}
                y={height - paddingBottom - barHeight}
                width={barWidth}
                height={barHeight}
                fill={codingPlatformTab === 'GITHUB' ? "#4f46e5" : "#f97316"}
                rx={1}
              />
              {d.target > 0 && (
                <circle cx={x + barWidth / 2} cy={targetY} r={2} fill="#ef4444" />
              )}
              <title>{codingPlatformTab === 'GITHUB' ? `Date: ${d.date}\nCommits: ${d.actual}` : `Date: ${d.date}\nSolved: ${d.actual}\nTarget: ${d.target}`}</title>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderLeetcodeTargetsView = () => {
    const isStaff = ['SUPREME_ADMIN', 'HOD', 'CLASS_ADVISOR'].includes(user?.role || '') || (user?.role === 'STUDENT' && (user?.is_coordinator || user?.is_year_coordinator));

    if (!isStaff) {
      // Student View
      return (
        <PageLayout>
          <div className="mb-6">
            <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
              <Code className="text-orange-500" size={26} /> Coding Progress Tracking
            </h2>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Your Daily & Weekly LeetCode + GitHub Solved Progress</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* LeetCode Daily Card */}
            <Card className="flex flex-col justify-between border-l-4 border-l-orange-500 bg-white">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Code size={16} className="text-orange-500" /> LeetCode Daily</span>
                  {myLeetcodeProgress?.dailyStatus === 'COMPLETED' ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">MET</span>
                  ) : myLeetcodeProgress?.dailyStatus === 'DATA_UNAVAILABLE' ? (
                    <span className="bg-zinc-100 text-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded-full">NO SYNC</span>
                  ) : (
                    <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">PENDING</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl font-black text-zinc-900">{myLeetcodeProgress?.solvedToday ?? 0}</span>
                  <span className="text-zinc-400 font-bold">/ {myLeetcodeProgress?.dailyTarget ?? 0} solved today (Yesterday: {myLeetcodeProgress?.solvedYesterday ?? 0})</span>
                </div>
              </div>
              <div>
                <div className="w-full bg-zinc-100 rounded-full h-2 mb-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, myLeetcodeProgress?.completionDailyPct ?? 0)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 font-bold">{myLeetcodeProgress?.completionDailyPct ?? 0}% completed today</span>
              </div>
            </Card>

            {/* GitHub Daily Card */}
            <Card className="flex flex-col justify-between border-l-4 border-l-zinc-900 bg-white">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Github size={16} className="text-zinc-900" /> GitHub Daily Commits</span>
                  {myGithubProgress?.commitsToday > 0 ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ACTIVE</span>
                  ) : (
                    <span className="bg-zinc-100 text-zinc-600 text-[10px] font-bold px-2 py-0.5 rounded-full">NO COMMITS</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-black text-zinc-900">{myGithubProgress?.commitsToday ?? 0}</span>
                  <span className="text-zinc-500 font-bold">commits pushed today</span>
                </div>
              </div>
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500 font-semibold">
                <span>Total this week: <strong className="text-zinc-900 font-bold">{myGithubProgress?.commitsThisWeek ?? 0}</strong> commits</span>
                {myGithubProgress?.githubUrl && (
                  <a href={myGithubProgress.githubUrl} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                    Profile <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white">
              <h3 className="text-md font-black text-zinc-900 mb-4 flex items-center gap-1.5">
                <Activity size={18} className="text-orange-500" /> LeetCode Solved History (Last 30 Days)
              </h3>
              <div className="h-44 flex items-end justify-center">
                {myLeetcodeProgress?.studentId ? (
                  <HistoryChartWrapper studentId={myLeetcodeProgress.studentId} type="daily" token={token} />
                ) : (
                  <div className="text-zinc-400 font-bold text-xs py-10">Loading chart...</div>
                )}
              </div>
            </Card>

            <Card className="bg-white">
              <h3 className="text-md font-black text-zinc-900 mb-4 flex items-center gap-1.5">
                <Activity size={18} className="text-indigo-500" /> LeetCode Weekly History
              </h3>
              <div className="h-44 flex items-end justify-center">
                {myLeetcodeProgress?.studentId ? (
                  <HistoryChartWrapper studentId={myLeetcodeProgress.studentId} type="weekly" token={token} />
                ) : (
                  <div className="text-zinc-400 font-bold text-xs py-10">Loading chart...</div>
                )}
              </div>
            </Card>
          </div>
        </PageLayout>
      );
    }

    // Staff View — Separate Dedicated Views for LeetCode Tracker & GitHub Tracker
    return (
      <PageLayout>
        {/* Platform Selection Tabs & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 mb-6 pb-2 md:pb-0">
          <div className="flex items-center gap-2 overflow-x-auto -mb-px">
            <button
              type="button"
              onClick={() => setCodingPlatformTab('LEETCODE')}
              className={cn(
                "flex items-center gap-2 px-5 py-3 border-b-2 font-black text-sm transition-all cursor-pointer",
                codingPlatformTab === 'LEETCODE' || codingPlatformTab === 'COMBINED'
                  ? "border-orange-600 text-orange-600 bg-orange-50/50 rounded-t-xl"
                  : "border-transparent text-zinc-500 hover:text-zinc-900"
              )}
            >
              <Code size={18} className="text-orange-500" />
              <span>LeetCode Tracker</span>
              <span className="ml-1 bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {leetcodeProgressList.length} Students
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCodingPlatformTab('GITHUB')}
              className={cn(
                "flex items-center gap-2 px-5 py-3 border-b-2 font-black text-sm transition-all cursor-pointer",
                codingPlatformTab === 'GITHUB'
                  ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                  : "border-transparent text-zinc-500 hover:text-zinc-900"
              )}
            >
              <Github size={18} className="text-indigo-600" />
              <span>GitHub Tracker</span>
              <span className="ml-1 bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {githubProgressList.length} Students
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 -mt-1 md:-mt-2 pb-1.5 md:pb-1">
            {codingPlatformTab === 'LEETCODE' && (
              <>
                <Button
                  onClick={handleSyncProgress}
                  disabled={syncingLeetcode}
                  variant="outline"
                  className="border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold px-3 py-1.5 text-xs rounded-xl flex items-center gap-1.5 bg-white cursor-pointer"
                >
                  {syncingLeetcode ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  <span>Sync LeetCode</span>
                </Button>

                <Button
                  onClick={() => {
                    setAssignTargetForm(prev => ({
                      ...prev,
                      targetValue: classes[0]?.id || ''
                    }));
                    setShowAssignTargetModal(true);
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-3 py-1.5 text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus size={14} /> LeetCode Target
                </Button>
              </>
            )}

            {codingPlatformTab === 'GITHUB' && (
              <Button
                onClick={handleSyncGithubProgress}
                disabled={syncingGithub}
                variant="outline"
                className="border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold px-3 py-1.5 text-xs rounded-xl flex items-center gap-1.5 bg-white cursor-pointer"
              >
                {syncingGithub ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                <span>Sync GitHub</span>
              </Button>
            )}
          </div>
        </div>

        {/* ─── LEETCODE TRACKER VIEW ─── */}
        {(codingPlatformTab === 'LEETCODE' || codingPlatformTab === 'COMBINED') && (
          <div>
            {/* LeetCode Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard title="Total Students" value={leetcodeStats?.totalStudents || leetcodeProgressList.length || 0} color="orange" icon={<Zap />} />
              <StatCard title="Target Met Today" value={leetcodeStats?.metDaily || 0} color="emerald" icon={<Target />} />
              <StatCard title="In Progress Today" value={leetcodeStats?.inProgressDaily || 0} color="amber" icon={<Hourglass />} />
              <StatCard title="Completion Rate" value={`${leetcodeStats?.completionDailyRate || 0}%`} color="indigo" icon={<TrendingUp />} />
            </div>

            {/* Row 1: Sub-navigation Tabs & View Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              {/* Sub-tab: Monitor vs Targets */}
              <div className="flex bg-zinc-100/80 rounded-xl p-1 border border-zinc-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setLeetcodeActiveTab('MONITOR')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    leetcodeActiveTab === 'MONITOR' ? "bg-white shadow-xs text-orange-600 font-extrabold" : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  Live Progress Monitor
                </button>
                <button
                  type="button"
                  onClick={() => setLeetcodeActiveTab('TARGETS')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    leetcodeActiveTab === 'TARGETS' ? "bg-white shadow-xs text-orange-600 font-extrabold" : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  Target Configurations ({leetcodeTargets.length})
                </button>
              </div>

              {/* View type & Date selection */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-zinc-100/80 rounded-xl p-1 border border-zinc-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setLeetcodeViewType('DAILY')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      leetcodeViewType === 'DAILY' ? "bg-white shadow-xs text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    Daily View
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeetcodeViewType('WEEKLY')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      leetcodeViewType === 'WEEKLY' ? "bg-white shadow-xs text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    Weekly View
                  </button>
                </div>

                <div className="flex items-center gap-1.5 border border-zinc-200/80 rounded-xl px-3 py-1.5 bg-white shadow-2xs">
                  <Calendar size={14} className="text-zinc-400" />
                  <input
                    type="date"
                    value={leetcodeDate}
                    onChange={(e) => setLeetcodeDate(e.target.value)}
                    className="text-xs font-bold text-zinc-700 bg-transparent border-none outline-none p-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Unified Filter & Search Toolbar */}
            <div className="bg-white p-3 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Department Filter */}
                {isAdmin && (
                  <div className="flex items-center gap-1.5 border border-zinc-200 rounded-xl px-3 py-1.5 bg-zinc-50/50">
                    <Building2 size={14} className="text-zinc-400" />
                    <select
                      value={selectedLeetcodeDeptId}
                      onChange={(e) => {
                        setSelectedLeetcodeDeptId(e.target.value);
                        setSelectedLeetcodeYear('ALL');
                        setSelectedLeetcodeClassId('ALL');
                      }}
                      className="text-xs font-bold text-zinc-700 bg-transparent border-none outline-none p-0 pr-6 cursor-pointer"
                    >
                      <option value="ALL">All Departments</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id.toString()}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Year Filter */}
                {(isAdmin || isHOD) && (
                  <div className="flex items-center gap-1.5 border border-zinc-200 rounded-xl px-3 py-1.5 bg-zinc-50/50">
                    <Filter size={14} className="text-zinc-400" />
                    <select
                      value={selectedLeetcodeYear}
                      onChange={(e) => {
                        setSelectedLeetcodeYear(e.target.value);
                        setSelectedLeetcodeClassId('ALL');
                      }}
                      className="text-xs font-bold text-zinc-700 bg-transparent border-none outline-none p-0 pr-6 cursor-pointer"
                    >
                      <option value="ALL">All Years</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                )}

                {/* Section / Class Filter */}
                {(isAdmin || isHOD || user?.is_year_coordinator) && (
                  <div className="flex items-center gap-1.5 border border-zinc-200 rounded-xl px-3 py-1.5 bg-zinc-50/50">
                    <Filter size={14} className="text-zinc-400" />
                    <select
                      value={selectedLeetcodeClassId}
                      onChange={(e) => setSelectedLeetcodeClassId(e.target.value)}
                      className="text-xs font-bold text-zinc-700 bg-transparent border-none outline-none p-0 pr-6 cursor-pointer"
                    >
                      <option value="ALL">All Sections</option>
                      {classes
                        .filter(c => {
                          if (selectedLeetcodeDeptId && selectedLeetcodeDeptId !== 'ALL' && c.department_id?.toString() !== selectedLeetcodeDeptId) return false;
                          if (selectedLeetcodeYear && selectedLeetcodeYear !== 'ALL' && String(c.year) !== selectedLeetcodeYear) return false;
                          if (isAdmin) return true;
                          if (isHOD) return c.department_id?.toString() === user?.department_id?.toString();
                          if (user?.is_year_coordinator) return c.department_id?.toString() === user?.department_id?.toString() && Number(c.year) === Number(user?.year_scope || user?.year);
                          if (isAdvisor || (user?.role === 'STUDENT' && user?.is_coordinator)) return String(c.id) === String(user?.class_id);
                          return c.department_id?.toString() === user?.department_id?.toString();
                        })
                        .sort((a, b) => (a.year || 0) - (b.year || 0) || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 border border-zinc-200 rounded-xl px-3 py-1.5 bg-zinc-50/50">
                  <Filter size={14} className="text-zinc-400" />
                  <select
                    value={leetcodeStatusFilter}
                    onChange={(e) => setLeetcodeStatusFilter(e.target.value)}
                    className="text-xs font-bold text-zinc-700 bg-transparent border-none outline-none p-0 pr-6 cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="INCOMPLETE">Incomplete</option>
                    <option value="DATA_UNAVAILABLE">No Sync Data</option>
                  </select>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                <input
                  type="text"
                  placeholder="Search student or reg no..."
                  value={leetcodeSearch}
                  onChange={(e) => setLeetcodeSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 bg-zinc-50/50 focus:bg-white focus:outline-hidden transition-all"
                />
                {leetcodeSearch && (
                  <button
                    onClick={() => setLeetcodeSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-0.5 rounded-full"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* LeetCode Live Progress Monitor Table */}
            {leetcodeActiveTab === 'MONITOR' ? (
              <Card className="p-0 overflow-hidden border border-zinc-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
<th onClick={() => handleSortHeader('registerNumber')} className="px-6 py-4 cursor-pointer select-none">
                          REGISTER NO {leetcodeSortColumn === 'registerNumber' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortHeader('fullName')} className="px-6 py-4 cursor-pointer select-none">
                          STUDENT NAME {leetcodeSortColumn === 'fullName' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortHeader('className')} className="px-6 py-4 cursor-pointer select-none">
                          SECTION /CLASS {leetcodeSortColumn === 'className' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th className="px-6 py-4">LEETCODE PROFILE</th>
                        <th className="px-6 py-4 text-center">
                          {leetcodeViewType === 'DAILY' ? 'TODAY' : 'THIS WEEK'}
                        </th>
                        {leetcodeViewType === 'DAILY' && (
                          <th className="px-6 py-4 text-center">YESTERDAY</th>
                        )}
                        <th onClick={() => handleSortHeader('status')} className="px-6 py-4 text-center cursor-pointer select-none">
                          TARGET (completed / Incomplete) {leetcodeSortColumn === 'status' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>

                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-sm">
                      {sortedLeetcodeProgressList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-semibold">
                            No LeetCode student records match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        sortedLeetcodeProgressList.map((row) => {
                          const isDaily = leetcodeViewType === 'DAILY';
                          const solved = isDaily ? (row.solvedToday ?? 0) : (row.solvedThisWeek ?? 0);
                          const target = isDaily ? (row.dailyTarget ?? 0) : (row.weeklyTarget ?? 0);
const status = (isDaily ? row.dailyStatus : row.weeklyStatus) || 'PENDING';
                          const profileUrl = row.leetcodeUsername
                            ? (row.leetcodeUsername.startsWith('http') ? row.leetcodeUsername : `https://leetcode.com/u/${row.leetcodeUsername}/`)
                            : null;

                          const displayStatus = status === 'COMPLETED' ? 'COMPLETED' :
                                                status === 'NO_TARGET' ? 'NO TARGET' : 'INCOMPLETE';

                          return (
                            <tr key={row.studentId} className="hover:bg-zinc-50 transition-colors">
                              <td className="px-6 py-4 font-mono text-xs font-bold text-zinc-500">{row.registerNumber}</td>
                              <td className="px-6 py-4 font-bold text-zinc-900">
                                <button
                                  type="button"
                                  onClick={() => handleViewStudentHistory(row)}
                                  className="hover:underline hover:text-indigo-600 text-left cursor-pointer"
                                >
                                  {row.fullName}
                                </button>
                              </td>
                              <td className="px-6 py-4 font-semibold text-zinc-600">{row.className}</td>
                              <td className="px-6 py-4">
                                {profileUrl ? (
                                  <a
                                    href={profileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-bold text-orange-600 hover:underline flex items-center gap-1"
                                  >
                                    <Code size={13} /> {row.leetcodeUsername || 'LeetCode Profile'} <ExternalLink size={11} />
                                  </a>
                                ) : (
                                  <span className="text-xs text-zinc-400 font-medium">Not Linked</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center font-semibold">
                                <span className="text-zinc-900 font-bold">{solved}</span> / <span className="text-zinc-400">{target}</span>
                              </td>
                              {isDaily && (
                                <td className="px-6 py-4 text-center font-semibold text-zinc-600">
                                  {row.solvedYesterday ?? 0}
                                </td>
                              )}
<td className="px-6 py-4 text-center">
                                <span className={cn(
                                  "inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full",
                                  displayStatus === 'COMPLETED' ? "bg-emerald-100 text-emerald-800" :
                                    displayStatus === 'NO TARGET' ? "bg-zinc-50 text-zinc-400" : "bg-orange-100 text-orange-800"
                                )}>
                                  {displayStatus}
                                </span>
                              </td>

                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card className="p-0 overflow-hidden border border-zinc-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        <th className="px-6 py-4">Scope</th>
                        <th className="px-6 py-4">Target Audience / Value</th>
                        <th className="px-6 py-4 text-center">Daily Target</th>
                        <th className="px-6 py-4 text-center">Weekly Target</th>
                        <th className="px-6 py-4">Duration</th>
                        <th className="px-6 py-4">Created By</th>
                        {user?.role !== 'STUDENT' && <th className="px-6 py-4 text-center">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-sm">
                      {leetcodeTargets.length === 0 ? (
                        <tr>
                          <td colSpan={user?.role !== 'STUDENT' ? 7 : 6} className="px-6 py-12 text-center text-zinc-400 font-semibold">
                            No active LeetCode target configurations found. Click "LeetCode Target" to add one.
                          </td>
                        </tr>
                      ) : (
                        leetcodeTargets.map((target) => (
                          <tr key={target.id} className="hover:bg-zinc-50">
                            <td className="px-6 py-4 font-bold text-zinc-800">{target.scope_type || 'CLASS'}</td>
                            <td className="px-6 py-4 font-semibold text-zinc-900">{target.target_value_name || target.class_name || 'All Students'}</td>
                            <td className="px-6 py-4 text-center font-bold text-orange-600">{target.daily_target} / day</td>
                            <td className="px-6 py-4 text-center font-bold text-indigo-600">{target.weekly_target} / week</td>
                            <td className="px-6 py-4 text-xs font-medium text-zinc-500">{target.start_date} to {target.end_date}</td>
                            <td className="px-6 py-4 text-xs text-zinc-600">{target.creator_name || 'Staff'}</td>
                            {user?.role !== 'STUDENT' && (
                              <td className="px-6 py-4 text-center">
                                <button type="button" onClick={() => handleDeleteLeetcodeTarget(target.id)} className="text-zinc-400 hover:text-red-600 p-1" title="Delete Target">
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ─── GITHUB TRACKER VIEW ─── */}
        {codingPlatformTab === 'GITHUB' && (
          <div>
{/* GitHub Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard title="Total Students" value={githubStats?.totalStudents || githubProgressList.length || 0} color="purple" icon={<Zap />} />
              <StatCard title="Active Committers Today" value={githubStats?.activeCommitters || 0} color="emerald" icon={<Terminal />} />
              
              {/* Top 3 Leaderboard Card */}
              <Card className="p-4 border border-zinc-200 bg-white shadow-xs sm:col-span-2 lg:col-span-2 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Trophy size={16} className="text-amber-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      GitHub Top 3 Leaderboard ({leetcodeViewType === 'DAILY' ? 'Today' : 'This Week'})
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Champions
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 flex-1 items-center">
                  {githubTop3.length === 0 ? (
                    <div className="col-span-3 text-center py-2 text-zinc-400 text-xs font-semibold">
                      No commits recorded {leetcodeViewType === 'DAILY' ? 'today' : 'this week'} yet.
                    </div>
                  ) : (
                    [0, 1, 2].map((index) => {
                      const item = githubTop3[index];
                      if (!item) {
                        return (
                          <div key={index} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 justify-center">
                            <span className="text-[10px] font-bold text-zinc-300">#{index + 1} Empty</span>
                          </div>
                        );
                      }
                      
                      const commits = leetcodeViewType === 'DAILY' ? (item.commitsToday ?? 0) : (item.commitsThisWeek ?? 0);
                      const rankColors = index === 0 ? "bg-amber-100 text-amber-800 border-amber-200" :
                                         index === 1 ? "bg-slate-100 text-slate-700 border-slate-200" :
                                         "bg-orange-100 text-orange-800 border-orange-200";
                      
                      const rankEmoji = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";

                      return (
                        <div key={item.studentId || index} className="flex items-center gap-2 p-2 rounded-xl border border-zinc-100 bg-zinc-50/80 shadow-2xs hover:bg-zinc-50 transition-colors">
                          <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border",
                            rankColors
                          )}>
                            {rankEmoji}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-zinc-800 truncate" title={item.fullName}>
                              {item.fullName}
                            </p>
                            <p className="text-[10px] font-bold text-indigo-600">
                              {commits} {commits === 1 ? 'commit' : 'commits'}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>

            {/* Row 1: View Controls & Date */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-600 bg-zinc-100 px-3 py-1.5 rounded-xl border border-zinc-200">
                  Daily Commit Tracker
                </span>
              </div>

              {/* View type & Date selection */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-zinc-100/80 rounded-xl p-1 border border-zinc-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setLeetcodeViewType('DAILY')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      leetcodeViewType === 'DAILY' ? "bg-white shadow-xs text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    Daily View
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeetcodeViewType('WEEKLY')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      leetcodeViewType === 'WEEKLY' ? "bg-white shadow-xs text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                    )}
                  >
                    Weekly View
                  </button>
                </div>

                <div className="flex items-center gap-1.5 border border-zinc-200/80 rounded-xl px-3 py-1.5 bg-white shadow-2xs">
                  <Calendar size={14} className="text-zinc-400" />
                  <input
                    type="date"
                    value={leetcodeDate}
                    onChange={(e) => setLeetcodeDate(e.target.value)}
                    className="text-xs font-bold text-zinc-700 bg-transparent border-none outline-none p-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Unified Filter & Search Toolbar */}
            <div className="bg-white p-3 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Department Filter */}
                {isAdmin && (
                  <div className="flex items-center gap-1.5 border border-zinc-200 rounded-xl px-3 py-1.5 bg-zinc-50/50">
                    <Building2 size={14} className="text-zinc-400" />
                    <select
                      value={selectedLeetcodeDeptId}
                      onChange={(e) => {
                        setSelectedLeetcodeDeptId(e.target.value);
                        setSelectedLeetcodeYear('ALL');
                        setSelectedLeetcodeClassId('ALL');
                      }}
                      className="text-xs font-bold text-zinc-700 bg-transparent border-none outline-none p-0 pr-6 cursor-pointer"
                    >
                      <option value="ALL">All Departments</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id.toString()}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Year Filter */}
                {(isAdmin || isHOD) && (
                  <div className="flex items-center gap-1.5 border border-zinc-200 rounded-xl px-3 py-1.5 bg-zinc-50/50">
                    <Filter size={14} className="text-zinc-400" />
                    <select
                      value={selectedLeetcodeYear}
                      onChange={(e) => {
                        setSelectedLeetcodeYear(e.target.value);
                        setSelectedLeetcodeClassId('ALL');
                      }}
                      className="text-xs font-bold text-zinc-700 bg-transparent border-none outline-none p-0 pr-6 cursor-pointer"
                    >
                      <option value="ALL">All Years</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                )}

                {/* Section / Class Filter */}
                {(isAdmin || isHOD || user?.is_year_coordinator) && (
                  <div className="flex items-center gap-1.5 border border-zinc-200 rounded-xl px-3 py-1.5 bg-zinc-50/50">
                    <Filter size={14} className="text-zinc-400" />
                    <select
                      value={selectedLeetcodeClassId}
                      onChange={(e) => setSelectedLeetcodeClassId(e.target.value)}
                      className="text-xs font-bold text-zinc-700 bg-transparent border-none outline-none p-0 pr-6 cursor-pointer"
                    >
                      <option value="ALL">All Sections</option>
                      {classes
                        .filter(c => {
                          if (selectedLeetcodeDeptId && selectedLeetcodeDeptId !== 'ALL' && c.department_id?.toString() !== selectedLeetcodeDeptId) return false;
                          if (selectedLeetcodeYear && selectedLeetcodeYear !== 'ALL' && String(c.year) !== selectedLeetcodeYear) return false;
                          if (isAdmin) return true;
                          if (isHOD) return c.department_id?.toString() === user?.department_id?.toString();
                          if (user?.is_year_coordinator) return c.department_id?.toString() === user?.department_id?.toString() && Number(c.year) === Number(user?.year_scope || user?.year);
                          if (isAdvisor || (user?.role === 'STUDENT' && user?.is_coordinator)) return String(c.id) === String(user?.class_id);
                          return c.department_id?.toString() === user?.department_id?.toString();
                        })
                        .sort((a, b) => (a.year || 0) - (b.year || 0) || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Search Box */}
              <div className="relative flex-1 md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                <input
                  type="text"
                  placeholder="Search student or reg no..."
                  value={leetcodeSearch}
                  onChange={(e) => setLeetcodeSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-800 bg-zinc-50/50 focus:bg-white focus:outline-hidden transition-all"
                />
                {leetcodeSearch && (
                  <button
                    onClick={() => setLeetcodeSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-0.5 rounded-full"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* GitHub Live Progress Monitor Table */}
            <Card className="p-0 overflow-hidden border border-zinc-200 bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left border-collapse">
                  <thead>
<tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      <th onClick={() => handleSortHeader('registerNumber')} className="px-6 py-4 cursor-pointer select-none">
                        REGISTER NO {leetcodeSortColumn === 'registerNumber' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th onClick={() => handleSortHeader('fullName')} className="px-6 py-4 cursor-pointer select-none">
                        STUDENT NAME {leetcodeSortColumn === 'fullName' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th onClick={() => handleSortHeader('className')} className="px-6 py-4 cursor-pointer select-none">
                        SECTION/CLASS {leetcodeSortColumn === 'className' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-6 py-4">GITHUB PROFILE</th>
                      {leetcodeViewType === 'DAILY' ? (
                        <th onClick={() => handleSortHeader('commitsToday')} className="px-6 py-4 text-center cursor-pointer select-none">
                          COMMITS TODAY {leetcodeSortColumn === 'commitsToday' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      ) : (
                        <th onClick={() => handleSortHeader('commitsThisWeek')} className="px-6 py-4 text-center cursor-pointer select-none">
                          COMMITS THIS WEEK {leetcodeSortColumn === 'commitsThisWeek' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      )}
                      <th onClick={() => handleSortHeader('syncStatus')} className="px-6 py-4 text-center cursor-pointer select-none">
                        SYNC STATUS {leetcodeSortColumn === 'syncStatus' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-sm">
                    {sortedGithubProgressList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-400 font-semibold">
                          No GitHub student records match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      sortedGithubProgressList.map((row) => {
                        const commitsToday = row.commitsToday ?? row.dailyCommitCount ?? 0;
                        const commitsThisWeek = row.commitsThisWeek ?? 0;
                        const profileUrl = row.githubUsername
                          ? (row.githubUsername.startsWith('http') ? row.githubUsername : `https://github.com/${row.githubUsername}`)
                          : (row.githubUrl || null);

                        return (
                          <tr key={row.studentId} className="hover:bg-zinc-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs font-bold text-zinc-500">{row.registerNumber}</td>
                            <td className="px-6 py-4 font-bold text-zinc-900">
                              <button
                                type="button"
                                onClick={() => handleViewStudentHistory(row)}
                                className="hover:underline hover:text-indigo-600 text-left cursor-pointer"
                              >
                                {row.fullName}
                              </button>
                            </td>
                            <td className="px-6 py-4 font-semibold text-zinc-600">{row.className}</td>
                            <td className="px-6 py-4">
                              {profileUrl ? (
                                <a
                                  href={profileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                >
                                  <Github size={13} /> {row.githubUsername || 'GitHub Profile'} <ExternalLink size={11} />
                                </a>
                              ) : (
                                <span className="text-xs text-zinc-400 font-medium">Not Linked</span>
                              )}
                            </td>
                            {leetcodeViewType === 'DAILY' ? (
                              <td className="px-6 py-4 text-center">
                                <span className={cn(
                                  "font-bold text-sm",
                                  commitsToday > 0 ? "text-emerald-600 font-extrabold" : "text-zinc-400"
                                )}>
                                  {commitsToday}
                                </span>
                              </td>
                            ) : (
                              <td className="px-6 py-4 text-center font-bold text-zinc-800">
                                {commitsThisWeek}
                              </td>
                            )}
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full",
                                row.syncStatus === 'SUCCESS' ? "bg-emerald-100 text-emerald-800" :
                                row.syncStatus === 'NO_PROFILE' ? "bg-zinc-100 text-zinc-600" : "bg-amber-100 text-amber-800"
                              )}>
                                {row.syncStatus === 'SUCCESS' ? 'SYNCED' : row.syncStatus === 'NO_PROFILE' ? 'NO HANDLE' : 'PENDING'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </PageLayout>
    );
  };

  const renderTelegramLinkModal = () => {
    if (!showTelegramLinkModal) return null;
    const botUrl = `https://t.me/IT_TaskManager_Alerts_bot?start=link_${user?.register_number || user?.username}`;
    const linkCommand = `/link ${user?.register_number || user?.username}`;

    return (
      <AnimatePresence>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative overflow-hidden border border-zinc-100 max-h-[95vh] overflow-y-auto"
          >
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-sky-400 via-indigo-500 to-violet-600" />

            <button
              onClick={() => setShowTelegramLinkModal(false)}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-all"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/20 shrink-0">
                <Send size={24} className="-rotate-12" />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900 tracking-tight">Connect Telegram Alerts</h3>
                <p className="text-xs text-zinc-500 font-medium">Instant task notifications, deadline alerts & coding reports</p>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200/70 mb-5 text-xs text-zinc-700">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">✓</span>
                <span>Instant New Tasks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">✓</span>
                <span>24h Deadline Alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">✓</span>
                <span>Verification Results</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black">✓</span>
                <span>LeetCode / GitHub Cards</span>
              </div>
            </div>

            {/* Option 1: 1-Click Bot Link */}
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100 mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">Method 1: Open Bot (Instant)</span>
                <span className="bg-sky-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">FASTEST</span>
              </div>
              <p className="text-xs text-sky-900 leading-relaxed">
                Click below to open our official bot in Telegram and tap <b>START</b> to link automatically:
              </p>
              <a
                href={botUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 active:scale-98 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md transition-all text-center"
              >
                <Send size={16} /> Open @IT_TaskManager_Alerts_bot
              </a>
              <div className="text-[11px] text-zinc-500 flex items-center justify-between pt-1">
                <span>Or message the bot with:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(linkCommand);
                    addToast('Command copied to clipboard!', 'info');
                  }}
                  className="font-mono font-bold text-sky-700 bg-white px-2 py-0.5 rounded border border-sky-200 hover:bg-sky-100 transition-colors"
                >
                  {linkCommand} 📋
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-zinc-400 hover:text-zinc-600 text-xs"
                onClick={() => setShowTelegramLinkModal(false)}
              >
                Maybe Later
              </Button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  };

  const renderAssignTargetModal = () => {
    if (!showAssignTargetModal) return null;
    const isYearCoordinator = user?.is_year_coordinator;
    const isAdvisor = user?.role === 'CLASS_ADVISOR' || (user?.role === 'STUDENT' && user?.is_coordinator);

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[200] animate-fade-in">
        <Card className="w-full max-w-md bg-white shadow-xl rounded-2xl overflow-hidden p-6 border border-zinc-200">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-3">
            <h3 className="text-lg font-black text-zinc-900 flex items-center gap-1.5">
              <Code size={20} className="text-orange-500" /> Assign LeetCode Target
            </h3>
            <button
              onClick={() => setShowAssignTargetModal(false)}
              className="text-zinc-400 hover:text-zinc-600 font-bold p-1 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreateTarget} className="space-y-4">
            {/* Target Scope */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Target Scope</label>
              <select
                value={assignTargetForm.scopeType}
                onChange={(e) => {
                  const val = e.target.value;
                  let defVal = '';
                  if (val === 'CLASS') defVal = classes[0]?.id || '';
                  if (val === 'STUDENT') defVal = users.filter(u => u.role === 'STUDENT')[0]?.id || '';
                  if (val === 'YEAR') defVal = '3';
                  if (val === 'DEPARTMENT') defVal = departments[0]?.id || '';

                  setAssignTargetForm(prev => ({
                    ...prev,
                    scopeType: val,
                    targetValue: defVal
                  }));
                }}
                className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
              >
                {!isYearCoordinator && !isAdvisor && <option value="DEPARTMENT">Department-wide</option>}
                {!isAdvisor && <option value="YEAR">Batch / Year-wide</option>}
                <option value="CLASS">Class Section-wide</option>
                <option value="STUDENT">Individual Student</option>
              </select>
            </div>

            {/* Scope Value */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Select Option</label>
              {assignTargetForm.scopeType === 'DEPARTMENT' && (
                <select
                  value={assignTargetForm.targetValue}
                  onChange={(e) => setAssignTargetForm(prev => ({ ...prev, targetValue: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}

              {assignTargetForm.scopeType === 'YEAR' && (
                <select
                  value={assignTargetForm.targetValue}
                  onChange={(e) => setAssignTargetForm(prev => ({ ...prev, targetValue: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              )}

              {assignTargetForm.scopeType === 'CLASS' && (
                <select
                  value={assignTargetForm.targetValue}
                  onChange={(e) => setAssignTargetForm(prev => ({ ...prev, targetValue: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Year {c.year})</option>
                  ))}
                </select>
              )}

              {assignTargetForm.scopeType === 'STUDENT' && (
                <select
                  value={assignTargetForm.targetValue}
                  onChange={(e) => setAssignTargetForm(prev => ({ ...prev, targetValue: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                >
                  {users.filter(u => u.role === 'STUDENT').map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.register_number})</option>
                  ))}
                </select>
              )}
            </div>

            {/* Targets */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Daily Target</label>
                <input
                  type="number"
                  min="0"
                  value={assignTargetForm.dailyTarget}
                  onChange={(e) => {
                    const val = e.target.value;
                    const parsed = parseInt(val, 10) || 0;
                    setAssignTargetForm(prev => ({
                      ...prev,
                      dailyTarget: val,
                      weeklyTarget: String(parsed * 7)
                    }));
                  }}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Weekly Target</label>
                <input
                  type="number"
                  min="0"
                  value={assignTargetForm.weeklyTarget}
                  onChange={(e) => setAssignTargetForm(prev => ({ ...prev, weeklyTarget: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Start Date</label>
                <input
                  type="date"
                  value={assignTargetForm.startDate}
                  onChange={(e) => {
                    const startVal = e.target.value;
                    const parts = startVal.split('-');
                    const yr = parseInt(parts[0], 10);
                    const mo = parseInt(parts[1], 10) - 1;
                    const dy = parseInt(parts[2], 10);

                    const localDate = new Date(yr, mo, dy);
                    localDate.setDate(localDate.getDate() + 6);

                    const endVal = localDate.getFullYear() + '-' +
                      String(localDate.getMonth() + 1).padStart(2, '0') + '-' +
                      String(localDate.getDate()).padStart(2, '0');

                    setAssignTargetForm(prev => ({
                      ...prev,
                      startDate: startVal,
                      endDate: endVal
                    }));
                  }}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">End Date</label>
                <input
                  type="date"
                  value={assignTargetForm.endDate}
                  onChange={(e) => setAssignTargetForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button type="submit" disabled={submittingTarget} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold p-3 rounded-xl transition-all disabled:opacity-50">
                {submittingTarget ? 'Creating...' : 'Create Target'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  };



  const renderHistoryDetailsModal = () => {
    if (!showHistoryModal || !selectedStudentHistory) return null;

    const student = selectedStudentHistory;
    const isGithub = codingPlatformTab === 'GITHUB';
    const hasData = studentHistoryData && (
      isGithub 
        ? (studentHistoryData.history && studentHistoryData.history.length > 0)
        : (studentHistoryData.daily && studentHistoryData.daily.length > 0)
    );

    return (
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[200] animate-fade-in"
        onClick={() => setShowHistoryModal(false)}
      >
        <Card 
          className="w-full max-w-2xl bg-white shadow-2xl rounded-2xl overflow-hidden border border-zinc-200 flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="p-6 border-b border-zinc-100 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                {isGithub ? (
                  <Github size={20} className="text-indigo-600" />
                ) : (
                  <Code size={20} className="text-orange-500" />
                )}
                <span>{isGithub ? 'GitHub Commit History' : 'LeetCode Progress History'}</span>
              </h3>
              <p className="text-xs text-zinc-500 font-bold mt-1">
                {student.fullName || student.full_name || ''} ({student.registerNumber || student.register_number || ''}) • {student.className || 'IT'}
              </p>
            </div>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="text-zinc-400 hover:text-zinc-600 font-bold p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {/* Student Profile Info */}
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Username / Handle</span>
                <span className="text-sm font-black text-zinc-800">
                  {isGithub ? (student.githubUsername || 'Not Configured') : (student.leetcodeUsername || 'Not Configured')}
                </span>
              </div>
              <div>
                {isGithub ? (
                  student.githubUrl && (
                    <a
                      href={student.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-black text-indigo-600 inline-flex items-center gap-1.5 shadow-2xs transition-all"
                    >
                      <Github size={14} /> View Profile
                    </a>
                  )
                ) : (
                  student.leetcodeUrl && (
                    <a
                      href={student.leetcodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-xl text-xs font-black text-orange-600 inline-flex items-center gap-1.5 shadow-2xs transition-all"
                    >
                      <Code size={14} /> View Profile
                    </a>
                  )
                )}
              </div>
            </div>

            {/* Performance Stats Summaries */}
            {isGithub ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Commits Today</span>
                  <span className="text-2xl font-black text-indigo-700">{studentHistoryData?.commitsToday ?? 0}</span>
                </div>
                <div className="p-4 bg-violet-50/50 border border-violet-100 rounded-xl">
                  <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider block">Commits This Week</span>
                  <span className="text-2xl font-black text-violet-700">{studentHistoryData?.commitsThisWeek ?? 0}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
                  <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider block">Solved Today</span>
                  <span className="text-2xl font-black text-orange-700">{studentHistoryData?.solvedToday ?? 0}</span>
                </div>
                <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Solved This Week</span>
                  <span className="text-2xl font-black text-amber-700">{studentHistoryData?.solvedThisWeek ?? 0}</span>
                </div>
              </div>
            )}

            {/* Chart Area */}
            <div className="border border-zinc-100 rounded-2xl p-4 bg-zinc-50/30">
              <h4 className="text-xs font-black text-zinc-700 uppercase tracking-wider mb-4">
                {isGithub ? '30-Day Activity History' : 'Daily Solving Progress'}
              </h4>
              {renderDailyChart()}
            </div>

            {/* Logs List Table */}
            <div>
              <h4 className="text-xs font-black text-zinc-700 uppercase tracking-wider mb-3">Detailed History Log</h4>
              {!hasData ? (
                <div className="text-center text-xs py-8 text-zinc-400 font-bold border border-zinc-100 rounded-xl bg-zinc-50/20">
                  No records logged yet.
                </div>
              ) : (
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider border-b border-zinc-200">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">
                          {isGithub ? 'Commits Pushed' : 'Problems Solved'}
                        </th>
                        {!isGithub && <th className="px-4 py-3 text-right">Daily Target</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700 font-semibold">
                      {isGithub ? (
                        studentHistoryData.history.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="px-4 py-3 text-zinc-500">{row.date}</td>
                            <td className="px-4 py-3 text-right text-indigo-600 font-bold">
                              {row.commits ?? row.daily_commit_count ?? 0}
                            </td>
                          </tr>
                        ))
                      ) : (
                        studentHistoryData.daily.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="px-4 py-3 text-zinc-500">{row.date}</td>
                            <td className="px-4 py-3 text-right text-orange-600 font-bold">{row.actual}</td>
                            <td className="px-4 py-3 text-right text-zinc-500">{row.target}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between shrink-0 h-20">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white p-1.5 overflow-hidden shrink-0 shadow-sm border border-zinc-200 flex items-center justify-center">
            <img src="/logo.png" alt="VSBEC Logo" className="w-full h-full object-contain" />
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
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="p-1 text-zinc-400 hover:text-zinc-900 md:hidden rounded-lg hover:bg-zinc-100"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        <>
          <SidebarItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active={view === 'dashboard'}
            onClick={() => { setView('dashboard'); setIsMobileSidebarOpen(false); }}
          />

          <SidebarItem
            icon={<ClipboardList size={20} />}
            label="Tasks"
            active={view === 'tasks'}
            onClick={() => { setView('tasks'); setIsMobileSidebarOpen(false); }}
          />

          <SidebarItem
            icon={<Code size={20} />}
            label="Coding Progress"
            active={view === 'leetcode-targets' || view === 'coding-progress'}
            onClick={() => { setView('leetcode-targets'); setIsMobileSidebarOpen(false); }}
          />

          <SidebarItem
            icon={<Megaphone size={20} />}
            label="Notice Board"
            active={view === 'notice-board'}
            onClick={() => { setView('notice-board'); fetchNotices(); setIsMobileSidebarOpen(false); }}
          />

          {isAdmin && (
            <>
              <SidebarItem
                icon={<Building2 size={20} />}
                label="Departments"
                active={view === 'departments'}
                onClick={() => { setView('departments'); setIsMobileSidebarOpen(false); }}
              />
              <SidebarItem
                icon={<Users size={20} />}
                label="HOD Accounts"
                active={view === 'users'}
                onClick={() => { setView('users'); setIsMobileSidebarOpen(false); }}
              />
            </>
          )}

          {isHOD && (
            <>
              <SidebarItem
                icon={<Building2 size={20} />}
                label="Classes"
                active={view === 'classes'}
                onClick={() => { setView('classes'); setIsMobileSidebarOpen(false); }}
              />
              <SidebarItem
                icon={<Users size={20} />}
                label="Users"
                active={view === 'users'}
                onClick={() => { setView('users'); setIsMobileSidebarOpen(false); }}
              />
            </>
          )}

          {isAdvisor && (
            <>
              <SidebarItem
                icon={<Building2 size={20} />}
                label="My Class"
                active={view === 'my-class'}
                onClick={() => { setView('my-class'); setIsMobileSidebarOpen(false); }}
              />
              <SidebarItem
                icon={<Users size={20} />}
                label="Students"
                active={view === 'users'}
                onClick={() => { setView('users'); setIsMobileSidebarOpen(false); }}
              />
            </>
          )}

          {(isAdvisor || isHOD || isAdmin || isCoordinator) && (
            <SidebarItem
              icon={<ShieldCheck size={20} />}
              label="Verifications"
              active={view === 'verifications'}
              onClick={() => { setView('verifications'); setIsMobileSidebarOpen(false); }}
            />
          )}

          {isStudent && (
            <>
              <SidebarItem
                icon={<CheckCircle2 size={20} />}
                label="My Submissions"
                active={view === 'submissions'}
                onClick={() => { setView('submissions'); setIsMobileSidebarOpen(false); }}
              />
              <SidebarItem
                icon={<User size={20} />}
                label="Profile"
                active={view === 'profile'}
                onClick={() => { setView('profile'); setIsMobileSidebarOpen(false); }}
              />
            </>
          )}


          <SidebarItem
            icon={<Settings size={20} />}
            label="Settings"
            active={view === 'settings'}
            onClick={() => { setView('settings'); setIsMobileSidebarOpen(false); }}
          />
        </>
      </nav>

      <div className="p-4 border-t border-zinc-100 shrink-0 bg-white">
        <div className="px-4 py-2 mb-4 bg-zinc-50 rounded-xl">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Logged in as</p>
          <p className="text-sm font-semibold text-zinc-900 truncate">{user?.full_name}</p>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">
            {user?.is_year_coordinator ? `Year ${user.year_scope} Coordinator` : user?.role}
            {user?.department_name ? ` • ${user.department_name}` : ''}
          </p>
        </div>
        <button
          onClick={() => { handleLogout(); setIsMobileSidebarOpen(false); }}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all font-semibold text-sm"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>

      </div>
    </div>
  );

  return (
    <FooterContext.Provider value={setShowFooterModal}>
      <div className="h-screen bg-[#F5F5F4] flex overflow-hidden">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        {renderAssignTargetModal()}
        {renderTelegramLinkModal()}
        {renderHistoryDetailsModal()}
        {/* Rejection Modal */}
        <AnimatePresence>
          {showRejectionModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <h2 className="text-xl font-bold mb-4">Reject Submission</h2>
                <Textarea
                  placeholder="Reason for rejection..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  required
                  className="mb-4"
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
          {viewingStudentProfileId && (
            <StaffStudentProfileModal
              studentId={viewingStudentProfileId}
              token={token}
              onClose={() => setViewingStudentProfileId(null)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showTaskPreview && (() => {
            const previewCatColors: Record<string, string> = {
              'Competition': 'bg-rose-50 text-rose-600 border-rose-100',
              'Course': 'bg-indigo-50 text-indigo-600 border-indigo-100',
              'Workshop': 'bg-amber-50 text-amber-600 border-amber-100',
              'College Work': 'bg-emerald-50 text-emerald-600 border-emerald-100'
            };
            const previewCategoryIcons: Record<string, string> = {
              'Competition': '',
              'Course': '',
              'Workshop': '',
              'College Work': ''
            };
            const catStyle = previewCatColors[newTask.category] || 'bg-zinc-50 text-zinc-600 border-zinc-200';
            const catIcon = previewCategoryIcons[newTask.category] || '';

            const previewDeadlinePassed = newTask.deadline && new Date(newTask.deadline) < new Date();
            const previewWithin24h = newTask.deadline && !previewDeadlinePassed && (new Date(newTask.deadline).getTime() - new Date().getTime()) < 24 * 60 * 60 * 1000;

            return (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-4xl shadow-2xl relative max-h-[95vh] md:max-h-[90vh] flex flex-col"
                >
                  <button
                    onClick={() => setShowTaskPreview(false)}
                    className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                  <h2 className="text-2xl font-bold mb-2">Live Preview</h2>
                  <p className="text-zinc-500 text-sm mb-6">This is exactly what students will see.</p>

                  <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
                    <Card className="border border-zinc-200 shadow-sm p-4 md:p-6 mb-6">
                      <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5", catStyle)}>
                              {renderCategoryIcon(newTask.category, 12)}
                              <span>{newTask.category || 'General'}</span>
                            </span>
                            <h4 className="font-bold text-zinc-900 text-lg md:text-xl break-words">{newTask.title || "Untitled Task"}</h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span className="font-medium text-zinc-700">{user?.name || "Task Creator"}</span>
                            <span className="hidden md:inline">•</span>
                            <span>{new Date().toLocaleDateString()}</span>
                            <span className="hidden md:inline">•</span>
                            <span className="px-2 py-0.5 rounded-full border border-transparent whitespace-nowrap bg-blue-50 text-blue-600 border-blue-100">
                              Class Task
                            </span>
                            <span className="hidden md:inline">•</span>
                            <span className="bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 whitespace-nowrap border border-zinc-200">
                              <Users size={12} /> 0 students submitted
                            </span>
                          </div>
                        </div>
                        <div className="text-left md:text-right shrink-0">
                          <p className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1 md:justify-end">
                            <Clock size={12} /> Deadline
                          </p>
                          <p className={cn(
                            "text-sm font-bold flex flex-col md:items-end",
                            previewDeadlinePassed ? "text-red-500" : (previewWithin24h ? "text-orange-500" : "text-zinc-600")
                          )}>
                            {newTask.deadline ? new Date(newTask.deadline).toLocaleString() : "No deadline"}
                            {previewWithin24h && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded mt-1">Due within 24h!</span>}
                          </p>
                        </div>
                      </div>

                      <p className="text-zinc-600 text-sm mb-6 whitespace-pre-wrap break-words">{newTask.description || "No description provided."}</p>

                      {newTask.external_link && (
                        <div className="mb-6">
                          <a
                            href={newTask.external_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium"
                          >
                            <ExternalLink size={16} /> Visit Apply Link
                          </a>
                        </div>
                      )}

                      <div className="bg-zinc-50 p-6 rounded-xl border border-zinc-200 mt-6 shadow-sm">
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-zinc-700 mb-2 block">
                              {newTask.custom_field_label || "Custom Field"}
                            </label>
                            <Input
                              placeholder={`Enter ${newTask.custom_field_label || "value"}...`}
                              disabled
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-zinc-700 mb-2 block">
                              {newTask.screenshot_instruction || "Upload Screenshot"}
                            </label>
                            <div className="flex flex-col gap-4">
                              <div className="flex items-center gap-4">
                                <div className="flex-1 w-full">
                                  <div
                                    className="relative w-full border-2 border-dashed rounded-xl p-6 md:p-8 flex flex-col items-center justify-center transition-all cursor-not-allowed border-zinc-200 bg-white text-zinc-400"
                                  >
                                    <Upload size={24} className="mb-2" />
                                    <p className="font-bold text-center text-[10px] md:text-sm uppercase tracking-wide">Upload Screen</p>
                                    <p className="text-[10px] opacity-60 text-center">Drag or Click</p>
                                  </div>
                                </div>
                                <Button
                                  disabled
                                  variant="secondary"
                                  className="h-auto md:h-full px-8 py-4 shrink-0 transition-all font-black uppercase tracking-wider text-sm opacity-50 cursor-not-allowed"
                                >
                                  Submit
                                </Button>
                              </div>
                              <div className="mt-3 flex items-start gap-2 text-zinc-400">
                                <span className="text-xs shrink-0 mt-0.5">*</span>
                                <p className="text-xs italic leading-tight">
                                  {newTask.screenshot_instruction || "Ensure your screenshot clearly shows the completion or registration details before hitting Submit."}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="mt-6 pt-4 border-t border-zinc-100 flex gap-4 shrink-0">
                    <Button variant="secondary" className="flex-1" onClick={() => setShowTaskPreview(false)}>Back to Edit</Button>
                    <Button className="flex-1" onClick={() => { createTask(); setShowTaskPreview(false); }}>Publish Task</Button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>
        {/* Reviews Modal */}
        <AnimatePresence>
          {showReviewsModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto"
              >
                <button
                  onClick={() => setShowReviewsModal(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <XCircle size={24} className="text-zinc-400" />
                </button>
                <h3 className="text-xl font-bold text-zinc-900 mb-6">Review & Feedback History</h3>
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {selectedSubReviews.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-4">No review history available.</p>
                  ) : (
                    selectedSubReviews.map((review: any) => (
                      <div key={review.id} className="relative pl-6 border-l-2 border-zinc-200 last:border-transparent pb-4">
                        <div className={cn(
                          "absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white",
                          review.new_status === 'VERIFIED' ? "bg-emerald-500" :
                            review.new_status === 'REJECTED' ? "bg-red-500" : "bg-orange-500"
                        )} />
                        <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="text-xs font-bold text-zinc-700">{review.reviewer_name}</span>
                              <span className="text-xs text-zinc-400 bg-zinc-200 px-1.5 py-0.5 rounded ml-2 font-mono uppercase">
                                {review.reviewer_role === 'CLASS_ADVISOR' ? 'Advisor' : review.reviewer_role}
                              </span>
                            </div>
                            <span className="text-xs text-zinc-400">{new Date(review.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-zinc-500">
                            Status: <span className="font-bold">{review.previous_status || 'PENDING'}</span> &rarr; <span className="font-bold">{review.new_status}</span>
                          </p>
                          {review.feedback && (
                            <div className="mt-2 text-xs font-medium text-zinc-600 bg-white p-2 rounded-lg border border-zinc-150 whitespace-pre-wrap">
                              "{review.feedback}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <Button onClick={() => setShowReviewsModal(false)} className="w-full mt-6">Close History</Button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Sidebar - Desktop */}
        <aside className="w-64 bg-white border-r border-zinc-200 shrink-0 hidden md:flex md:flex-col h-full">
          {renderSidebarContent()}
        </aside>

        {/* Sidebar - Mobile Drawer */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-50 flex md:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileSidebarOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-64 max-w-xs bg-white h-full flex flex-col border-r border-zinc-200 shadow-2xl z-10"
              >
                {renderSidebarContent()}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="h-20 bg-white border-b border-zinc-200 px-4 md:px-8 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 -ml-2 text-zinc-500 hover:text-zinc-900 md:hidden rounded-lg hover:bg-zinc-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-zinc-900 tracking-tight truncate">
                  {(() => {
                    if (view === 'leetcode-targets' || view === 'coding-progress') {
                      if (codingPlatformTab === 'LEETCODE') return 'LeetCode';
                      if (codingPlatformTab === 'GITHUB') return 'GitHub';
                      return 'Combined Coding Progress';
                    }
                    if (view === 'departments') return 'Departments';
                    if (view === 'my-class') return 'My Class';
                    if (view === 'notice-board') return 'Notice Board';
                    if (view === 'analyzer') return 'Student Progress Analyzer';
                    if (view === 'verification') return 'Task Verification';
                    if (view === 'users') return 'User Management';
                    if (view === 'tasks') return 'Tasks';
                    return view.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  })()}
                </h2>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider truncate">Academic Management System</p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {(isAdmin || isHOD || isAdvisor || isCoordinator || user?.is_year_coordinator) && (
                <Button variant="success" className="flex items-center gap-2" onClick={() => (view === 'leetcode-targets' || view === 'coding-progress') ? handleDownloadCombinedExcel() : setShowExportModal(true)}>
                  <FileDown size={18} /> {isAdmin || isHOD ? 'Export Custom Report' : 'Export Class Report'}
                </Button>
              )}
              <div className="flex-1" />
              {isStudent && !user?.telegram_chat_id && (
                <button
                  onClick={() => setShowTelegramLinkModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-sky-500 via-indigo-600 to-violet-600 text-white shadow-md hover:shadow-lg hover:scale-105 transition-all animate-pulse shrink-0"
                >
                  <Send size={13} className="-rotate-12" /> Connect Telegram
                </button>
              )}
              {isStudent && user?.telegram_chat_id && (
                <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <CheckCircle2 size={12} /> Telegram Linked
                </span>
              )}
              <div className="relative group">
                <button
                  className="p-2.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/80 rounded-xl transition-all relative"
                  onClick={markNotificationsRead}
                  title="Notifications"
                >
                  <Bell size={20} />
                  {notifications.filter(n => !n.is_read).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white" />
                  )}
                </button>
                <div className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-4">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-100">
                    <div className="flex items-center gap-2">
                      <img src="/logo.png" alt="VSBEC Logo" className="w-5 h-5 object-contain" />
                      <h3 className="text-sm font-extrabold text-zinc-900">Notifications</h3>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                      {notifications.length} updates
                    </span>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-zinc-400 text-center py-4">No notifications yet</p>
                    ) : (
                      notifications.map(n => {
                        const matchingInv = myInvitations.find(inv =>
                          n.message.includes(inv.team_name) || n.message.includes(inv.task_title)
                        ) || myInvitations[0];
                        const isTeamInv = n.type === 'TEAM_INVITATION' || n.message.toLowerCase().includes('invited');
                        return (
                          <div key={n.id} className={cn("p-3 rounded-xl text-xs flex items-start gap-3 transition-colors", n.is_read ? "bg-zinc-50" : "bg-indigo-50/70 border border-indigo-100")}>
                            <img src="/logo.png" alt="VSBEC IT" className="w-8 h-8 rounded-lg object-contain bg-white p-1 border border-zinc-200 shrink-0 shadow-xs mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-zinc-900 mb-1 font-semibold leading-snug">{n.message}</p>
                              <p className="text-[10px] text-zinc-400 font-medium">{new Date(n.created_at).toLocaleString()}</p>
                              {isTeamInv && myInvitations.length > 0 && (
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-indigo-200/50">
                                  <Button
                                    onClick={(e) => { e.stopPropagation(); handleRespondInvitation((matchingInv || myInvitations[0]).id, 'ACCEPT'); }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1 h-auto rounded-lg shadow-sm"
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); handleRespondInvitation((matchingInv || myInvitations[0]).id, 'DECLINE'); }}
                                    className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-[11px] font-bold px-3 py-1 h-auto rounded-lg"
                                  >
                                    Decline
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 min-h-0 bg-[#F5F5F4] relative">
            <AnimatePresence mode="wait">
              {view === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="w-full h-full flex flex-col min-h-0"
                >
                  <PageLayout>
                    {isAdmin ? (
                      <UnifiedAnalyzer role="SUPREME_ADMIN" title="Global System Analyzer" />
                    ) : isHOD ? (
                      <div className="flex flex-col gap-10">
                        {/* Premium Header Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                          <StatCard title="Active Classes" value={hodStats?.total_classes || 0} icon={<Building2 />} color="blue" />
                          <StatCard title="Class Advisors" value={hodStats?.total_advisors || 0} icon={<UserCheck />} color="emerald" />
                          <StatCard title="Total Enrollment" value={hodStats?.total_students || 0} icon={<GraduationCap />} color="indigo" />
                          <StatCard title="Not Interested / Opted Out" value={hodStats?.not_participating_submissions ?? submissions.filter(s => s.status === 'NOT_PARTICIPATING').length} icon={<AlertTriangle />} color="bg-orange-500" />
                          <StatCard title="Tasks Under Oversight" value={hodStats?.taskStats?.length || 0} icon={<ClipboardList />} color="orange" />
                        </div>

                        {/* Full Width Class Analyzer */}
                        <div className="w-full">
                          <UnifiedAnalyzer role="HOD" title="Class Analyzer" />
                        </div>
                      </div>
                    ) : user?.is_year_coordinator ? (
                      <div className="flex flex-col gap-10">
                        {/* Coordinator Header Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <StatCard title={`Oversight for Year ${user.year_scope}`} value={yearStats?.total_classes || 0} icon={<Building2 />} color="blue" />
                          <StatCard title="Total Students in Year" value={yearStats?.total_students || 0} icon={<Users />} color="indigo" />
                          <StatCard title="Active Year-wide Tasks" value={yearStats?.taskStats?.length || 0} icon={<ClipboardList />} color="orange" />
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
                              <StatCard title="Class Students" value={coordinatorStats?.total_students || 0} icon={<Users />} color="bg-blue-500" />
                              <StatCard title="Submitted" value={coordinatorStats?.pending_reviews || 0} icon={<Clock />} color="bg-orange-500" />
                              <StatCard title="Verified" value={coordinatorStats?.verified_submissions || 0} icon={<CheckCircle2 />} color="bg-emerald-500" />
                            </div>
                            <div className="mt-8">
                              <UnifiedAnalyzer role="CLASS_ADVISOR" title="Class Performance Analyzer" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : isAdvisor ? (() => {
                      const activeClassId = user?.class_id || myClass?.id;
                      const myClassStudentsCount = users.filter(u => u.role === 'STUDENT' && (activeClassId ? String(u.class_id) === String(activeClassId) : true)).length;
                      const totalClassStudents = myClassStudentsCount || advisorStats?.total_students || 0;
                      const respondedCount = new Set(submissions.filter(s => {
                        const std = users.find(u => u.id === s.user_id);
                        const cid = s.class_id || std?.class_id;
                        return s.status !== 'NOT_PARTICIPATING' && (activeClassId ? String(cid) === String(activeClassId) : true);
                      }).map(s => s.user_id)).size;
                      const pendingCount = new Set(submissions.filter(s => {
                        const std = users.find(u => u.id === s.user_id);
                        const cid = s.class_id || std?.class_id;
                        return s.status === 'SUBMITTED' && (activeClassId ? String(cid) === String(activeClassId) : true);
                      }).map(s => s.user_id)).size || advisorStats?.submitted_tasks_count || 0;
                      const verifiedCount = new Set(submissions.filter(s => {
                        const std = users.find(u => u.id === s.user_id);
                        const cid = s.class_id || std?.class_id;
                        return s.status === 'VERIFIED' && (activeClassId ? String(cid) === String(activeClassId) : true);
                      }).map(s => s.user_id)).size || advisorStats?.verified_tasks_count || 0;

                      return (
                        <div className="flex flex-col gap-10">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Class Students" value={totalClassStudents} icon={<Users />} color="bg-blue-500" />
                            <StatCard title="Responded Students" value={respondedCount} icon={<CheckCircle2 />} color="bg-indigo-500" />
                            <StatCard title="Pending Verification" value={pendingCount} icon={<Clock />} color="bg-orange-500" />
                            <StatCard title="Verified Students" value={verifiedCount} icon={<CheckCircle2 />} color="bg-emerald-500" />
                          </div>
                          <UnifiedAnalyzer role="CLASS_ADVISOR" title="Class Performance Analyzer" />
                        </div>
                      );
                    })() : (
                      <div className="flex flex-col gap-8">
                        {isCoordinator ? (() => {
                          const activeClassId = user?.class_id || myClass?.id;
                          const myClassStudentsCount = users.filter(u => u.role === 'STUDENT' && (activeClassId ? String(u.class_id) === String(activeClassId) : true)).length;
                          const totalClassStudents = myClassStudentsCount || coordinatorStats?.class_student_count || coordinatorStats?.total_students || 0;
                          const respondedCount = new Set(submissions.filter(s => {
                            const std = users.find(u => u.id === s.user_id);
                            const cid = s.class_id || std?.class_id;
                            return s.status !== 'NOT_PARTICIPATING' && (activeClassId ? String(cid) === String(activeClassId) : true);
                          }).map(s => s.user_id)).size;
                          const pendingCount = new Set(submissions.filter(s => {
                            const std = users.find(u => u.id === s.user_id);
                            const cid = s.class_id || std?.class_id;
                            return s.status === 'SUBMITTED' && (activeClassId ? String(cid) === String(activeClassId) : true);
                          }).map(s => s.user_id)).size || coordinatorStats?.pending_reviews || 0;
                          const verifiedCount = new Set(submissions.filter(s => {
                            const std = users.find(u => u.id === s.user_id);
                            const cid = s.class_id || std?.class_id;
                            return s.status === 'VERIFIED' && (activeClassId ? String(cid) === String(activeClassId) : true);
                          }).map(s => s.user_id)).size || coordinatorStats?.verified_submissions || 0;

                          return (
                            <>
                              <div>
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="w-1.5 h-6 bg-zinc-900 rounded-full" />
                                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight">My Class Summary</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                  <StatCard title="Class Students" value={totalClassStudents} icon={<Users />} color="bg-blue-500" />
                                  <StatCard title="Responded Students" value={respondedCount} icon={<CheckCircle2 />} color="bg-indigo-500" />
                                  <StatCard title="Pending Verification" value={pendingCount} icon={<Clock />} color="bg-orange-500" />
                                  <StatCard title="Verified Students" value={verifiedCount} icon={<CheckCircle2 />} color="bg-emerald-500" />
                                </div>
                              </div>

                              <div
                                className="bg-zinc-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer hover:bg-black transition-all group shadow-md"
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
                                  <span className="text-4xl font-black">{submissions.filter(s => {
                                    const std = users.find(u => u.id === s.user_id);
                                    const cid = s.class_id || std?.class_id;
                                    return s.status === 'SUBMITTED' && cid && String(cid) === String(user?.class_id);
                                  }).length}</span>
                                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Pending Tasks</span>
                                </div>
                              </div>

                              <UnifiedAnalyzer role="COORDINATOR" title="Class Achievement Analyzer" />
                            </>
                          );
                        })() : (
                          <div>
                            {/* Prominent Telegram Connect Banner for unlinked students */}
                            {isStudent && !user?.telegram_chat_id && (
                              <div className="mb-6 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-700 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-white/20">
                                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                                <div className="absolute left-1/3 -top-10 w-32 h-32 bg-sky-400/20 rounded-full blur-xl pointer-events-none" />

                                <div className="flex items-start gap-4 relative z-10">
                                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 shadow-inner border border-white/30 text-white">
                                    <Send size={24} className="-rotate-12 text-sky-200" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider backdrop-blur-md">
                                        Action Recommended
                                      </span>
                                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-200">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Instant Phone Notifications
                                      </span>
                                    </div>
                                    <h2 className="text-lg sm:text-xl font-black mt-1 text-white tracking-tight">
                                      Connect your Telegram for Live Task Alerts & Coding Reports
                                    </h2>
                                    <p className="text-xs sm:text-sm text-sky-100/90 mt-1 max-w-2xl leading-relaxed">
                                      Receive automatic alerts for newly assigned tasks, upcoming deadlines within 24 hours, and submission status — plus check your LeetCode and GitHub scores on Telegram anytime!
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto shrink-0 relative z-10">
                                  <button
                                    onClick={() => setShowTelegramLinkModal(true)}
                                    className="w-full md:w-auto px-5 py-2.5 bg-white text-indigo-900 rounded-xl font-bold text-xs sm:text-sm shadow-lg hover:bg-sky-50 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                                  >
                                    <Send size={16} className="text-sky-500" />
                                    Connect in 1-Click
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <StatCard title="Total Assigned Tasks" value={studentStats?.total_tasks || 0} icon={<ClipboardList />} color="bg-blue-500" />
                              <StatCard title="Submitted" value={studentStats?.submitted_tasks || 0} icon={<Clock />} color="bg-orange-500" />
                              <StatCard title="Verified" value={studentStats?.verified_tasks || 0} icon={<CheckCircle2 />} color="bg-emerald-500" />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                              <Card className="border border-zinc-200 flex flex-col justify-between bg-white">
                                <div>
                                  <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-black text-zinc-950 flex items-center gap-1.5 uppercase tracking-wider">
                                      <Code size={16} className="text-orange-500" /> LeetCode Daily Target
                                    </h3>
                                    {myLeetcodeProgress?.dailyStatus === 'COMPLETED' ? (
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">MET</span>
                                    ) : (
                                      <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">PENDING</span>
                                    )}
                                  </div>
                                  <div className="flex items-baseline gap-2 mb-4">
                                    <span className="text-4xl font-black text-zinc-900">{myLeetcodeProgress?.solvedToday ?? 0}</span>
                                    <span className="text-xs font-bold text-zinc-400">/ {myLeetcodeProgress?.dailyTarget ?? 0} solved today (Yesterday: {myLeetcodeProgress?.solvedYesterday ?? 0})</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-2">
                                    <div
                                      className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
                                      style={{ width: `${Math.min(100, myLeetcodeProgress?.completionDailyPct ?? 0)}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
                                    <span>{myLeetcodeProgress?.completionDailyPct ?? 0}% Done</span>
                                    <button onClick={() => setView('leetcode-targets')} className="text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 font-bold">
                                      View Details <ChevronRight size={10} />
                                    </button>
                                  </div>
                                </div>
                              </Card>

                              <Card className="border border-zinc-200 flex flex-col justify-between bg-white">
                                <div>
                                  <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-black text-zinc-950 flex items-center gap-1.5 uppercase tracking-wider">
                                      <Code size={16} className="text-indigo-500" /> LeetCode Weekly Target
                                    </h3>
                                    {myLeetcodeProgress?.weeklyStatus === 'COMPLETED' ? (
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">MET</span>
                                    ) : (
                                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">PENDING</span>
                                    )}
                                  </div>
                                  <div className="flex items-baseline gap-2 mb-4">
                                    <span className="text-4xl font-black text-zinc-900">{myLeetcodeProgress?.solvedThisWeek ?? 0}</span>
                                    <span className="text-xs font-bold text-zinc-400">/ {myLeetcodeProgress?.weeklyTarget ?? 0} solved this week</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-2">
                                    <div
                                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                                      style={{ width: `${Math.min(100, myLeetcodeProgress?.completionWeeklyPct ?? 0)}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500">
                                    <span>{myLeetcodeProgress?.completionWeeklyPct ?? 0}% Done</span>
                                    <button onClick={() => setView('leetcode-targets')} className="text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 font-bold">
                                      View Details <ChevronRight size={10} />
                                    </button>
                                  </div>
                                </div>
                              </Card>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Removed redundant HOD Stats section */}

                    <ContentCard>
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
                            {getStudentTaskStatusBadge(task, user, submissions)}
                          </div>
                        ))}
                      </div>
                    </ContentCard>
                  </PageLayout>
                </motion.div>
              )}

              {view === 'departments' && isAdmin && (
                <motion.div
                  key="departments"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full h-full flex flex-col min-h-0"
                >
                  <PageLayout>
                    <ContentCard>
                      <h3 className="text-lg font-semibold mb-4">Create New Department</h3>
                      <form onSubmit={createDepartment} className="flex gap-4">
                        <Input
                          placeholder="e.g. Computer Science & Engineering"
                          value={newDept}
                          onChange={e => setNewDept(e.target.value)}
                          required
                        />
                        <Button className="whitespace-nowrap flex items-center gap-2">
                          <Plus size={18} /> Create Department
                        </Button>
                      </form>
                    </ContentCard>

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
                  </PageLayout>
                </motion.div>
              )}

              {view === 'classes' && isHOD && (
                <motion.div
                  key="classes"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full h-full flex flex-col min-h-0"
                >
                  <PageLayout>


                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {classes.slice().sort((a, b) => (a.year || 0) - (b.year || 0) || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })).map(c => (
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
                            <div className="mt-auto pt-6 flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-widest">
                              <span>Class ID: {c.id}</span>
                              <span className="px-2 py-0.5 bg-zinc-100 rounded text-zinc-500">Class Pool</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </PageLayout>
                </motion.div>
              )}

              {view === 'my-class' && isAdvisor && (
                <motion.div
                  key="my-class"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full h-full flex flex-col min-h-0"
                >
                  <PageLayout>
                    <ContentCard>
                      <h3 className="text-lg font-semibold mb-4">Class Details</h3>
                      <form onSubmit={createClass} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Class Name</label>
                            <Input
                              value={newClass.name !== undefined && newClass.name !== '' ? newClass.name : (myClass?.name || '')}
                              onChange={e => setNewClass(prev => ({ ...prev, name: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Year</label>
                            <Input
                              type="number"
                              value={newClass.year !== undefined && newClass.year !== '' ? newClass.year : (myClass?.year || '')}
                              onChange={e => setNewClass(prev => ({ ...prev, year: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-zinc-500 uppercase">Batch</label>
                            <Input
                              value={newClass.batch !== undefined && newClass.batch !== '' ? newClass.batch : (myClass?.batch || '')}
                              onChange={e => setNewClass(prev => ({ ...prev, batch: e.target.value }))}
                              required
                            />
                          </div>
                        </div>
                        <Button className="flex items-center gap-2">
                          <Plus size={18} /> Update Class Info
                        </Button>
                      </form>
                    </ContentCard>

                    {myClass && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard title="Class Name" value={myClass.name as any} icon={<Building2 />} color="bg-blue-500" />
                        <StatCard title="Year" value={myClass.year as any} icon={<ClipboardList />} color="bg-emerald-500" />
                        <StatCard title="Batch" value={myClass.batch as any} icon={<Users />} color="bg-purple-500" />
                      </div>
                    )}
                  </PageLayout>
                </motion.div>
              )}

              {view === 'users' && (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full h-full flex flex-col min-h-0"
                >
                  <PageLayout>
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
                            onChange={e => {
                              setUserDeptFilter(e.target.value);
                              setUserYearFilter('');
                              setUserClassFilter('');
                              setUserPage(1);
                            }}
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
                            {['ALL', 'COORDINATORS'].map(filter => (
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
                        </div>
                      )}
                    </div>

                    <div className="mb-6 flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <Input
                          placeholder={`Search ${isAdmin ? 'HODs' : isHOD ? 'Advisors or Students' : 'Students'} by name or registration number...`}
                          className="pl-10 h-11"
                          value={searchTerm}
                          onChange={e => { setSearchTerm(e.target.value); setUserPage(1); }}
                        />
                      </div>

                      {/* HOD / Admin Year & Section Filters */}
                      {(isHOD || isAdmin) && (
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            className="h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-black/5"
                            value={userYearFilter}
                            onChange={e => {
                              setUserYearFilter(e.target.value);
                              setUserClassFilter('');
                              setUserPage(1);
                            }}
                          >
                            <option value="">All Years</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                          </select>

                          <select
                            className="h-11 px-3 rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-black/5"
                            value={userClassFilter}
                            onChange={e => {
                              setUserClassFilter(e.target.value);
                              setUserPage(1);
                            }}
                          >
                            <option value="">All Classes / Sections</option>
                            {classes
                              .filter(c => (!userDeptFilter || String(c.department_id) === String(userDeptFilter)) && (!userYearFilter || String(c.year) === userYearFilter))
                              .sort((a, b) => (a.year || 0) - (b.year || 0) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                              .map(c => (
                                <option key={c.id} value={c.id.toString()}>{c.name}</option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>



                    <Table className="min-w-[700px] md:min-w-0">
                      <THead>
                        <TR>
                          <TH>Name</TH>
                          <TH>{isAdvisor ? 'Register No' : 'Username'}</TH>
                          {isAdvisor && <TH>Email</TH>}
                          {!isAdvisor && <TH>{isAdmin ? 'Department' : 'Section / Class'}</TH>}
                          <TH className="text-right">Actions</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {(() => {
                          const filtered = users
                            .filter(u => {
                              if (isAdmin) {
                                if (userRoleFilter && u.role !== userRoleFilter) return false;
                                if (userDeptFilter && u.department_id?.toString() !== userDeptFilter.toString()) return false;
                                return u.role !== 'SUPREME_ADMIN'; // Don't show SA itself
                              }
                              if (isAdvisor) {
                                if (studentFilter === 'COORDINATORS') return u.is_coordinator;
                              } else if (isHOD) {
                                if (studentFilter === 'CLASS_ADVISOR') return u.role === 'CLASS_ADVISOR';
                                if (studentFilter === 'STUDENT') return u.role === 'STUDENT';
                              }
                              return true;
                            })
                            .filter(u => {
                              if (!isAdmin && !isHOD && !user?.is_year_coordinator) {
                                const userClassId = (user?.class_id || myClass?.id)?.toString();
                                if (userClassId && u.class_id?.toString() !== userClassId) return false;
                              }
                              if (userYearFilter) {
                                const cls = classes.find(c => c.id?.toString() === u.class_id?.toString());
                                const yr = cls?.year || (u as any).class_year;
                                if (String(yr) !== userYearFilter) return false;
                              }
                              if (userClassFilter) {
                                if (u.class_id?.toString() !== userClassFilter) return false;
                              }
                              return true;
                            })
                            .filter(u => {
                              if (!searchTerm) return true;
                              const query = searchTerm.toLowerCase();
                              return u.full_name?.toLowerCase().includes(query) || (u.register_number || u.username).toLowerCase().includes(query) || u.department_name?.toLowerCase().includes(query);
                            });

                          const totalPages = Math.ceil(filtered.length / itemsPerPage);
                          const sortedFiltered = [...filtered].sort((a, b) => {
                            if (a.role === 'CLASS_ADVISOR' && b.role === 'CLASS_ADVISOR') {
                              const cA = classes.find(c => c.id?.toString() === a.class_id?.toString());
                              const cB = classes.find(c => c.id?.toString() === b.class_id?.toString());
                              const yrA = cA?.year || (a as any).class_year || 0;
                              const yrB = cB?.year || (b as any).class_year || 0;
                              if (yrA !== yrB) return yrA - yrB;
                              const nameA = cA?.name || a.class_name || a.full_name || '';
                              const nameB = cB?.name || b.class_name || b.full_name || '';
                              return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
                            }
                            if (a.role === 'STUDENT' && b.role === 'STUDENT') {
                              if (a.register_number && b.register_number) {
                                return a.register_number.localeCompare(b.register_number, undefined, { numeric: true });
                              }
                            }
                            return (a.full_name || '').localeCompare(b.full_name || '', undefined, { numeric: true, sensitivity: 'base' });
                          });
                          const paginated = sortedFiltered.slice((userPage - 1) * itemsPerPage, userPage * itemsPerPage);

                          return (
                            <>
                              {paginated.map(u => (
                                <TR key={u.id}>
                                  <TD className="font-medium text-zinc-900 break-words">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {u.full_name}
                                      {u.is_year_coordinator && (
                                        <Badge variant="primary" className="bg-indigo-600 text-white border-none shadow-sm px-3 py-1 rounded-full">
                                          <CalendarRange size={12} />
                                          Year {u.year_scope} Overall Coord
                                        </Badge>
                                      )}
                                      {!!u.is_coordinator && (
                                        <Badge variant="warning">Class Coord</Badge>
                                      )}
                                      {isAdmin && (
                                        <Badge variant={
                                          u.role === 'HOD' ? 'info' :
                                            u.role === 'CLASS_ADVISOR' ? 'primary' : 'neutral'
                                        }>
                                          {u.role === 'CLASS_ADVISOR' ? 'Advisor' : u.role}
                                        </Badge>
                                      )}
                                    </div>
                                  </TD>
                                  <TD className="text-zinc-500 break-all">{u.register_number || u.username}</TD>
                                  {isAdvisor && <TD className="text-zinc-500">{u.email}</TD>}
                                  {!isAdvisor && (
                                    <TD>
                                      <span className="px-2 py-1 bg-zinc-100 rounded text-xs text-zinc-600">
                                        {isAdmin ? (u.department_name || '—') : u.class_name}
                                      </span>
                                    </TD>
                                  )}
                                  <TD className="text-right">
                                    <div className="flex justify-end gap-2">
                                      {u.role === 'STUDENT' && (
                                        <Button
                                          variant="ghost"
                                          className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                                          onClick={() => {
                                            const activeClassId = (user?.class_id || myClass?.id)?.toString();
                                            const isMyClassStudent = activeClassId && u.class_id?.toString() === activeClassId;
                                            if (isAdmin || isHOD || isMyClassStudent || user?.is_year_coordinator) {
                                              setViewingStudentProfileId(u.id);
                                            } else {
                                              addToast('Class Advisors can only view profiles of students in their assigned class', 'error');
                                            }
                                          }}
                                          title="View Full Student Profile"
                                        >
                                          <User size={18} />
                                        </Button>
                                      )}
                                      {(isAdvisor || isHOD || isAdmin) && u.role === 'STUDENT' && (
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
                                  </TD>
                                </TR>
                              ))}
                              {filtered.length > itemsPerPage && (
                                <TR>
                                  <TD colSpan={6} className="bg-zinc-50/30">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-1">
                                      <p className="text-xs font-medium text-zinc-500 whitespace-nowrap">
                                        Showing {(userPage - 1) * itemsPerPage + 1} to {Math.min(userPage * itemsPerPage, filtered.length)} of {filtered.length} entries
                                      </p>
                                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                        <Button
                                          variant="secondary"
                                          className="px-3 py-1 h-8 text-xs font-semibold"
                                          disabled={userPage === 1}
                                          onClick={() => setUserPage(prev => prev - 1)}
                                        >
                                          Previous
                                        </Button>
                                        <div className="flex items-center gap-1">
                                          {getPaginationRange(userPage, totalPages).map((p, idx) => typeof p === 'number' ? (
                                            <button
                                              key={idx}
                                              onClick={() => setUserPage(p)}
                                              className={cn(
                                                "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                                userPage === p ? "bg-black text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"
                                              )}
                                            >
                                              {p}
                                            </button>
                                          ) : (
                                            <span key={idx} className="w-5 text-center text-xs text-zinc-400 font-bold">...</span>
                                          ))}
                                        </div>
                                        <Button
                                          variant="secondary"
                                          className="px-3 py-1 h-8 text-xs font-semibold"
                                          disabled={userPage === totalPages}
                                          onClick={() => setUserPage(prev => prev + 1)}
                                        >
                                          Next
                                        </Button>
                                      </div>
                                    </div>
                                  </TD>
                                </TR>
                              )}
                              {filtered.length === 0 && (
                                <TR>
                                  <TD colSpan={6} className="text-center text-zinc-500 text-sm py-12">
                                    No matching records found.
                                  </TD>
                                </TR>
                              )}
                            </>
                          );
                        })()}
                      </TBody>
                    </Table>
                  </PageLayout>
                </motion.div>
              )}

              {view === 'tasks' && (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full h-full flex flex-col min-h-0"
                >
                  <PageLayout>
                    {isStudent && myInvitations.length > 0 && (
                      <div className="space-y-4 mb-8">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                            <h3 className="text-sm font-extrabold uppercase tracking-wider text-indigo-950 flex items-center gap-2">
                              <Users size={18} className="text-indigo-600" />
                              Pending Team Formation Invitation{myInvitations.length > 1 ? 's' : ''} ({myInvitations.length})
                            </h3>
                          </div>
                        </div>
                        {myInvitations.map(inv => (
                          <div
                            key={inv.id}
                            className="p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-2xl shadow-xl border border-indigo-700/50 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all hover:shadow-2xl"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
                                <Users size={24} className="text-indigo-200" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                                    Team Invitation
                                  </span>
                                  {inv.task_category && (
                                    <span className="bg-purple-500/30 text-purple-200 border border-purple-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                      {inv.task_category}
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-base font-extrabold text-white leading-snug">
                                  You are invited to join team <span className="text-amber-300 underline font-black">"{inv.team_name}"</span>
                                </h4>
                                <p className="text-xs text-indigo-200 font-medium flex items-center gap-1.5 flex-wrap">
                                  <span>Invited by: <strong className="text-white">{inv.inviter_name || 'Classmate'}</strong></span>
                                  <span>•</span>
                                  <span>Task: <strong className="text-indigo-100">{inv.task_title}</strong></span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-indigo-700/50">
                              <Button
                                type="button"
                                onClick={() => handleRespondInvitation(inv.id, 'ACCEPT')}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs px-5 py-2.5 rounded-xl border-none shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer"
                              >
                                <CheckCircle2 size={16} /> Accept Invitation
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleRespondInvitation(inv.id, 'DECLINE')}
                                className="bg-white/10 hover:bg-white/20 text-indigo-100 hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-white/20 backdrop-blur-sm transition-all cursor-pointer"
                              >
                                Decline
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(isAdmin || isHOD || isAdvisor || isCoordinator) && (
                      <ContentCard className={cn(
                        user?.is_year_coordinator ? "border-indigo-100 bg-indigo-50/10" : ""
                      )}>
                        <h3 className={cn(
                          "text-xl font-bold mb-6 flex items-center gap-3",
                          user?.is_year_coordinator ? "text-indigo-900" : "text-zinc-900"
                        )}>
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                            user?.is_year_coordinator ? "bg-indigo-600 text-white" : "bg-black text-white"
                          )}>
                            <Plus size={20} />
                          </div>
                          {user?.is_year_coordinator ? `Post Year ${user.year_scope} Task` : 'Post New Task'}
                        </h3>
                        <form onSubmit={handleTaskPreview} className="space-y-4 w-full">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full min-w-0">
                            <div className="min-w-0">
                              <Input
                                placeholder="Task Title"
                                value={newTask.title}
                                onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                                required
                              />
                            </div>
                            <div className="min-w-0">
                              <CategoryDropdown
                                value={newTask.category}
                                onChange={val => setNewTask(prev => ({ ...prev, category: val }))}
                              />
                            </div>
                            <div className="min-w-0">
                              <Input
                                placeholder="Apply Link (Optional)"
                                value={newTask.external_link}
                                onChange={e => setNewTask(prev => ({ ...prev, external_link: e.target.value }))}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-col gap-1.5">
                                <div className="relative flex items-center">
                                  <input
                                    type="datetime-local"
                                    value={newTask.deadline}
                                    onChange={e => setNewTask(prev => ({ ...prev, deadline: e.target.value }))}
                                    required
                                    title="Select Deadline Date and Time"
                                    min={(() => { const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })()}
                                    className="w-full h-11 px-4 rounded-lg border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all text-sm bg-white text-zinc-800 cursor-pointer [color-scheme:light]"
                                  />
                                </div>
                                {/* Quick shortcut pills & selected formatted preview */}
                                <div className="flex flex-wrap gap-1 items-center">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-0.5">Quick:</span>
                                  {[
                                    { label: '+1 Day', ms: 24 * 60 * 60 * 1000 },
                                    { label: '+3 Days', ms: 3 * 24 * 60 * 60 * 1000 },
                                    { label: '+7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
                                    { label: '+30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
                                  ].map(({ label, ms }) => {
                                    const d = new Date(Date.now() + ms);
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                    return (
                                      <button
                                        key={label}
                                        type="button"
                                        onClick={() => setNewTask(prev => ({ ...prev, deadline: iso }))}
                                        className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:border-zinc-300 transition-all"
                                      >
                                        {label}
                                      </button>
                                    );
                                  })}
                                  {newTask.deadline && (
                                    <button
                                      type="button"
                                      onClick={() => setNewTask(prev => ({ ...prev, deadline: '' }))}
                                      className="px-2 py-0.5 text-[11px] font-medium rounded-md border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all ml-auto"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="min-w-0">
                              <Input
                                placeholder="Screenshot Instruction (e.g. Upload registration page)"
                                value={newTask.screenshot_instruction}
                                onChange={e => setNewTask(prev => ({ ...prev, screenshot_instruction: e.target.value }))}
                                required
                              />
                            </div>
                            <div className="min-w-0">
                              <Input
                                placeholder="Custom Verification Field Label (e.g. Team ID)"
                                value={newTask.custom_field_label}
                                onChange={e => setNewTask(prev => ({ ...prev, custom_field_label: e.target.value }))}
                                required
                              />
                            </div>

                            {/* Task Submission Type Selector */}
                            <div className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 md:col-span-2 space-y-3">
                              <label className="text-xs font-bold text-zinc-600 uppercase tracking-widest block">
                                Task Submission Type
                              </label>
                              <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm text-zinc-800">
                                  <input
                                    type="radio"
                                    name="submission_type"
                                    value="INDIVIDUAL"
                                    checked={newTask.submission_type === 'INDIVIDUAL'}
                                    onChange={() => setNewTask(prev => ({ ...prev, submission_type: 'INDIVIDUAL' }))}
                                    className="w-4 h-4 text-black border-zinc-300 focus:ring-black"
                                  />
                                  <span>Individual Task</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm text-zinc-800">
                                  <input
                                    type="radio"
                                    name="submission_type"
                                    value="TEAM"
                                    checked={newTask.submission_type === 'TEAM'}
                                    onChange={() => setNewTask(prev => ({ ...prev, submission_type: 'TEAM' }))}
                                    className="w-4 h-4 text-indigo-600 border-zinc-300 focus:ring-indigo-500"
                                  />
                                  <span className="flex items-center gap-1.5 font-bold text-indigo-600">
                                    <Users size={16} /> Team Task
                                  </span>
                                </label>
                              </div>

                              {newTask.submission_type === 'TEAM' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-200">
                                  <div>
                                    <label className="text-xs font-bold text-zinc-600 mb-1 block">
                                      Minimum Team Size
                                    </label>
                                    <Input
                                      type="number"
                                      min={2}
                                      max={10}
                                      value={newTask.min_team_size}
                                      onChange={e => setNewTask(prev => ({ ...prev, min_team_size: parseInt(e.target.value, 10) || 2 }))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-bold text-zinc-600 mb-1 block">
                                      Maximum Team Size
                                    </label>
                                    <Input
                                      type="number"
                                      min={2}
                                      max={20}
                                      value={newTask.max_team_size}
                                      onChange={e => setNewTask(prev => ({ ...prev, max_team_size: parseInt(e.target.value, 10) || 5 }))}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {isAdmin && (
                              <div className="min-w-0">
                                <Select
                                  value={newTask.department_id || ''}
                                  onChange={e => setNewTask(prev => ({ ...prev, department_id: e.target.value, class_ids: [] }))}
                                >
                                  <option value="">Global Task (Visible to All)</option>
                                  {[...departments].sort((a, b) => a.name.localeCompare(b.name)).map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                  ))}
                                </Select>
                              </div>
                            )}

                            {user?.is_year_coordinator && (
                              <div className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <p className="text-sm font-bold text-indigo-700 mb-1 flex items-center gap-2">
                                  <CalendarRange size={16} /> Year {user.year_scope} Coordinator Scope
                                </p>
                                <p className="text-xs text-indigo-600 font-medium">
                                  This task will be automatically assigned to all classes in Year {user.year_scope}.
                                </p>
                              </div>
                            )}

                            {(isAdmin || isHOD || user?.is_year_coordinator) && (
                              <div className="w-full bg-white border border-zinc-200 rounded-lg p-3 md:col-span-2 min-w-0">
                                <div className="flex items-center justify-between mb-3">
                                  <label className="text-xs font-bold text-zinc-600 uppercase tracking-widest block">
                                    {isAdmin ? 'Select Specific Classes (Optional)' :
                                      user?.is_year_coordinator ? `Classes in Year ${user.year_scope}` :
                                        'Assign to Classes'}
                                  </label>
                                  {(() => {
                                    const availClasses = classes.filter(c => {
                                      if (isAdmin) return !newTask.department_id || c.department_id?.toString() === newTask.department_id?.toString();
                                      if (user?.is_year_coordinator) return c.year === user.year_scope && c.department_id?.toString() === user.department_id?.toString();
                                      return c.department_id?.toString() === user?.department_id?.toString();
                                    });
                                    const allSelected = availClasses.length > 0 && availClasses.every(c => (newTask.class_ids || []).map(String).includes(String(c.id)));
                                    return (
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (allSelected) {
                                              setNewTask(prev => ({ ...prev, class_ids: [] }));
                                            } else {
                                              setNewTask(prev => ({ ...prev, class_ids: availClasses.map(c => c.id) }));
                                            }
                                          }}
                                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                        >
                                          {allSelected ? 'Deselect All' : `Select All (${availClasses.length})`}
                                        </button>
                                      </div>
                                    );
                                  })()}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                  {[...classes]
                                    .filter(c => {
                                      if (isAdmin) return !newTask.department_id || c.department_id?.toString() === newTask.department_id?.toString();
                                      if (user?.is_year_coordinator) return c.year === user.year_scope && c.department_id?.toString() === user.department_id?.toString();
                                      return c.department_id?.toString() === user?.department_id?.toString();
                                    })
                                    .sort((a, b) => (a.year || 0) - (b.year || 0) || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }))
                                    .map(c => (
                                      <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-zinc-50 rounded-md cursor-pointer transition-colors border border-transparent hover:border-zinc-200">
                                        <input
                                          type="checkbox"
                                          className="w-4 h-4 rounded border-zinc-300 text-black focus:ring-black/20 font-medium text-xs"
                                          checked={(newTask.class_ids || []).map(String).includes(String(c.id))}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setNewTask(prev => ({ ...prev, class_ids: [...(prev.class_ids || []), c.id] }));
                                            } else {
                                              setNewTask(prev => ({ ...prev, class_ids: (prev.class_ids || []).filter(id => String(id) !== String(c.id)) }));
                                            }
                                          }}
                                        />
                                        <span className="text-sm font-medium text-zinc-700">{c.name}</span>
                                      </label>
                                    ))}
                                </div>
                                <p className="text-xs text-zinc-500 mt-3 bg-zinc-50 p-2 rounded min-h-[2.5rem] flex items-center font-medium">
                                  {(newTask.class_ids || []).length === 0 ? (
                                    <>
                                      <Info size={14} className="inline mr-1 text-zinc-400 shrink-0" /> {user?.is_year_coordinator ? `No specific classes selected. This task will be automatically assigned to ALL Year ${user.year_scope} classes.` :
                                        `No specific classes selected. This task will act as a ${newTask.department_id ? 'Class-Wide' : 'Global'} broadcast to everyone applicable.`}
                                    </>
                                  ) : (
                                    <>
                                      Assigned to: {(newTask.class_ids || []).map(id => classes.find(c => String(c.id) === String(id))?.name || id).join(', ')}
                                    </>
                                  )}
                                </p>
                              </div>
                            )}

                            <div className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 md:col-span-2 min-w-0">
                              <label className="text-xs font-bold text-zinc-600 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                                <ImageIcon size={14} /> Hackathon / Event Poster (Image or PDF) (Optional)
                              </label>
                              {posterPreview ? (
                                <div className="relative rounded-lg overflow-hidden border border-zinc-200 bg-white p-3 flex items-center justify-between group">
                                  {posterPreview === 'PDF_DOCUMENT' ? (
                                    <div className="flex items-center gap-3">
                                      <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                                        <FileText size={24} />
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-zinc-900">{posterFile?.name || 'Event_Poster.pdf'}</p>
                                        <p className="text-xs text-zinc-500 font-medium">PDF Document Poster Attached</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <img src={posterPreview} alt="Poster preview" className="max-h-48 rounded object-contain" />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handlePosterSelect(null)}
                                    className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow"
                                    title="Remove poster"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <label className="border-2 border-dashed border-zinc-200 hover:border-black rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all bg-white hover:bg-zinc-50">
                                  <Upload size={24} className="text-zinc-400 mb-1" />
                                  <span className="text-xs font-bold text-zinc-700">Click or Drag & Drop poster (Image or PDF) here</span>
                                  <span className="text-[10px] text-zinc-400 font-medium">Upload poster banner or PDF flyer (e.g. Hackathon, Workshop, Event Poster)</span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf,application/pdf"
                                    className="hidden"
                                    onChange={e => handlePosterSelect(e.target.files?.[0] || null)}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                          <Textarea
                            placeholder="Task Description..."
                            value={newTask.description}
                            onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                            required
                          />
                          <div className="flex gap-4">
                            <Button type="submit" variant="secondary" className="flex-1">
                              <ImageIcon size={18} /> Live Preview
                            </Button>
                            <Button type="button" onClick={createTask} disabled={isUploadingPoster} className="flex-1">
                              {isUploadingPoster ? <Loader2 size={18} className="animate-spin" /> : <ClipboardList size={18} />} Post Task
                            </Button>
                          </div>
                        </form>
                      </ContentCard>
                    )}

                    <div className="space-y-4 pb-12">
                      {isStudent && myInvitations.length > 0 && (
                        <div className="space-y-3 mb-6">
                          {myInvitations.map(inv => (
                            <div key={inv.id} className="p-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                  <Users size={20} className="text-white" />
                                </div>
                                <div>
                                  <p className="font-bold text-sm">Team Invitation Received!</p>
                                  <p className="text-xs text-indigo-100 font-medium">
                                    {inv.inviter_name || 'Classmate'} invited you to join team <span className="font-bold text-white">"{inv.team_name}"</span> for task <span className="font-bold text-white">"{inv.task_title}"</span>
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  onClick={() => handleRespondInvitation(inv.id, 'ACCEPT')}
                                  className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs px-4 py-2 rounded-xl border-none shadow-sm"
                                >
                                  Accept Invitation
                                </Button>
                                <Button
                                  onClick={() => handleRespondInvitation(inv.id, 'DECLINE')}
                                  className="bg-white/20 hover:bg-white/30 text-white font-semibold text-xs px-4 py-2 rounded-xl border border-white/30"
                                >
                                  Decline
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {isStudent && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar mb-4">
                          <button
                            type="button"
                            onClick={() => setStudentTaskFilter('ALL')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer",
                              studentTaskFilter === 'ALL' ? "bg-black text-white border-black shadow-sm" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
                            )}
                          >
                            All Tasks ({tasks.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentTaskFilter('PENDING_ACTION')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer flex items-center gap-1.5",
                              studentTaskFilter === 'PENDING_ACTION' ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                            )}
                          >
                            <Clock size={14} /> Pending Action
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentTaskFilter('UNDER_REVIEW')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer flex items-center gap-1.5",
                              studentTaskFilter === 'UNDER_REVIEW' ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            )}
                          >
                            <Clock size={14} /> Under Review
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentTaskFilter('VERIFIED')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer flex items-center gap-1.5",
                              studentTaskFilter === 'VERIFIED' ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            )}
                          >
                            <CheckCircle2 size={14} /> Verified
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudentTaskFilter('OVERDUE')}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer flex items-center gap-1.5",
                              studentTaskFilter === 'OVERDUE' ? "bg-rose-600 text-white border-rose-600 shadow-sm" : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            )}
                          >
                            <AlertTriangle size={14} /> Overdue / Closed
                          </button>
                        </div>
                      )}

                      {tasks.filter(task => {
                        if (!isStudent || studentTaskFilter === 'ALL') return true;
                        const sub = submissions.find(s => String(s.task_id) === String(task.id) && String(s.user_id) === String(user?.id));
                        const isDeadlinePassed = task.deadline && new Date(task.deadline) < new Date();
                        const isClosed = task.status === 'CLOSED' || isDeadlinePassed;

                        if (studentTaskFilter === 'PENDING_ACTION') return !sub && !isClosed;
                        if (studentTaskFilter === 'UNDER_REVIEW') return sub?.status === 'SUBMITTED';
                        if (studentTaskFilter === 'VERIFIED') return sub?.status === 'VERIFIED';
                        if (studentTaskFilter === 'OVERDUE') return (!sub && isClosed) || sub?.status === 'REJECTED';
                        return true;
                      }).map(task => {
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
                          'Competition': '',
                          'Course': '',
                          'Workshop': '',
                          'College Work': ''
                        };

                        const catStyle = categoryColors[task.category || ''] || 'bg-zinc-50 text-zinc-600 border-zinc-200';
                        const catIcon = categoryIcons[task.category || ''] || '';
                        const isHighlighted = String(highlightedTaskId) === String(task.id);

                        return (
                          <Card
                            key={task.id}
                            id={`task-${task.id}`}
                            className={cn(
                              "group hover:shadow-md transition-all duration-300",
                              isHighlighted ? "ring-2 ring-indigo-500 bg-indigo-50/15 shadow-xl" : ""
                            )}
                          >
                            {task.poster_url && (
                              <div className="relative mb-5 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-200 group/poster max-h-80 flex items-center justify-center">
                                {task.poster_url.toLowerCase().includes('.pdf') ? (
                                  <div
                                    onClick={() => setSelectedPosterModal(task.poster_url || null)}
                                    className="w-full p-6 bg-gradient-to-r from-red-900/80 via-zinc-900 to-zinc-950 text-white flex items-center justify-between cursor-pointer group-hover/poster:opacity-90 transition-opacity"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg">
                                        <FileText size={28} />
                                      </div>
                                      <div>
                                        <p className="text-sm font-bold text-white">Event / Hackathon Poster (PDF)</p>
                                        <p className="text-xs text-zinc-400 font-medium">Click to View or Download PDF Flyer</p>
                                      </div>
                                    </div>
                                    <span className="text-xs font-bold flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                      <Maximize2 size={14} /> Open PDF
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <img
                                      src={task.poster_url}
                                      alt={`${task.title} Poster`}
                                      className="w-full h-full max-h-80 object-cover object-center group-hover/poster:scale-105 transition-transform duration-500 cursor-pointer"
                                      onClick={() => setSelectedPosterModal(task.poster_url || null)}
                                    />
                                    <div
                                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-end justify-between p-4 cursor-pointer"
                                      onClick={() => setSelectedPosterModal(task.poster_url || null)}
                                    >
                                      <span className="text-white text-xs font-bold flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                                        <Maximize2 size={14} /> Click to View Full Poster
                                      </span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5", catStyle)}>
                                    {renderCategoryIcon(task.category || '', 12)}
                                    <span>{task.category || 'General'}</span>
                                  </span>
                                  {task.submission_type === 'TEAM' && (
                                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                      <Users size={12} /> Team (Min {task.min_team_size || 2} - Max {task.max_team_size || 5})
                                    </span>
                                  )}
                                  <h4 className="font-bold text-zinc-900 text-lg md:text-xl break-words">{task.title}</h4>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                  <span className="font-medium text-zinc-700">{task.creator_name}</span>
                                  <span className="hidden md:inline">•</span>
                                  <span>{new Date(task.created_at).toLocaleDateString()}</span>
                                  <span className="hidden md:inline">•</span>
                                  {Array.isArray(task.class_ids) && task.class_ids.length > 0 ? (
                                    (() => {
                                      const names = task.class_ids
                                        .map(id => classes.find(c => String(c.id) === String(id))?.name)
                                        .filter((name): name is string => Boolean(name));
                                      const displayText = names.length > 0 ? names.join(', ') : 'Assigned Section';
                                      return (
                                        <span
                                          className="bg-purple-50 text-purple-600 border border-purple-100 px-2.5 py-0.5 rounded-full text-xs font-semibold max-w-[240px] md:max-w-md truncate inline-block align-middle"
                                          title={displayText}
                                        >
                                          {displayText}
                                        </span>
                                      );
                                    })()
                                  ) : (
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full border border-transparent whitespace-nowrap",
                                      task.department_name ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-orange-50 text-orange-600 border-orange-100"
                                    )}>
                                      {task.department_name ? 'Class Task' : 'Global Task'}
                                    </span>
                                  )}
                                  {(!isStudent || isCoordinator) && (
                                    <>
                                      <span className="hidden md:inline">•</span>
                                      <span className="bg-zinc-100 text-zinc-700 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 whitespace-nowrap border border-zinc-200 font-semibold text-xs">
                                        <Users size={12} className="text-zinc-500" /> {task.submission_count || 0} {isHOD || isAdmin ? 'submitted (All Sections)' : 'submitted (Class)'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-left md:text-right shrink-0 flex flex-col items-start md:items-end gap-2">
                                <div>
                                  <p className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1 md:justify-end">
                                    <Clock size={12} /> Deadline
                                  </p>
                                  <p className={cn(
                                    "text-sm font-bold flex flex-col md:items-end",
                                    isDeadlinePassed ? "text-red-500" : (isWithin24h ? "text-orange-500" : "text-zinc-600")
                                  )}>
                                    {task.deadline ? new Date(task.deadline).toLocaleString() : "No deadline"}
                                    {isDeadlinePassed ? (
                                      <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-extrabold mt-1 uppercase">Deadline Passed</span>
                                    ) : isWithin24h ? (
                                      <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-extrabold mt-1 uppercase">Due within 24h</span>
                                    ) : task.deadline ? (
                                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold mt-1">
                                        {(() => {
                                          const diffMs = new Date(task.deadline).getTime() - Date.now();
                                          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                          return `${diffDays}d ${diffHours}h remaining`;
                                        })()}
                                      </span>
                                    ) : null}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <p className="text-zinc-600 text-sm mb-6 whitespace-pre-wrap break-words">{task.description}</p>

                            <div className="flex flex-wrap items-center gap-3 mb-6">
                              <button
                                type="button"
                                onClick={() => copyTaskShareLink(task.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 transition-colors"
                                title="Share Task Link"
                              >
                                <Share2 size={14} /> Share Task Link
                              </button>

                              {task.external_link && (
                                <a
                                  href={task.external_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-blue-600 hover:underline text-xs font-semibold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                                >
                                  <ExternalLink size={14} /> Apply Link
                                </a>
                              )}
                            </div>

                            {isStudent && task.status === 'OPEN' && (
                              <div className="bg-zinc-50 p-5 rounded-xl border border-zinc-200 mt-6 shadow-sm space-y-4">
                                {task.submission_type === 'TEAM' ? (
                                  <div className="space-y-3">
                                    {(() => {
                                      const pendingInvForTask = myInvitations.find(inv => String(inv.task_id) === String(task.id));
                                      if (pendingInvForTask) {
                                        return (
                                          <div className="p-4 bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-700 text-white rounded-xl shadow-md flex flex-wrap items-center justify-between gap-4">
                                            <div className="space-y-0.5">
                                              <div className="flex items-center gap-2">
                                                <Badge variant="primary" className="bg-white text-indigo-900 font-extrabold border-none">
                                                  PENDING INVITATION
                                                </Badge>
                                              </div>
                                              <p className="text-sm font-black">
                                                {pendingInvForTask.inviter_name || 'A classmate'} invited you to join team <span className="underline">"{pendingInvForTask.team_name}"</span>!
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <Button
                                                type="button"
                                                onClick={() => handleRespondInvitation(pendingInvForTask.id, 'ACCEPT')}
                                                className="bg-white text-indigo-700 hover:bg-indigo-50 font-black text-xs px-4 py-2 rounded-xl shadow-sm border-none"
                                              >
                                                Accept Invitation
                                              </Button>
                                              <Button
                                                type="button"
                                                onClick={() => handleRespondInvitation(pendingInvForTask.id, 'DECLINE')}
                                                className="bg-black/30 hover:bg-black/50 text-white font-bold text-xs px-4 py-2 rounded-xl border border-white/30"
                                              >
                                                Decline
                                              </Button>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-indigo-50/90 border border-indigo-200 rounded-xl shadow-xs">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="primary" className="bg-indigo-600 text-white border-none">
                                            <Users size={12} /> Team Task
                                          </Badge>
                                          <span className="text-xs font-bold text-indigo-950">
                                            Requires Team of {task.min_team_size || 2} - {task.max_team_size || 5} Members
                                          </span>
                                        </div>
                                        <p className="text-xs text-indigo-700 font-medium">
                                          Form a team with your classmates, accept pending invitations, or manage your current team and proof submission.
                                        </p>
                                      </div>
                                      <Button
                                        type="button"
                                        onClick={() => openTeamModal(task)}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm shrink-0 flex items-center gap-2"
                                      >
                                        <Users size={16} /> Manage / View Team
                                      </Button>
                                    </div>
                                  </div>
                                ) : isDeadlinePassed ? (
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

                                    // Already opted out (show reason banner with option to edit)
                                    if (submission?.status === 'NOT_PARTICIPATING' && !isEditingOptOut[task.id]) {
                                      return (
                                        <div className="p-4 bg-orange-50/90 border border-orange-200 rounded-xl space-y-3 shadow-sm">
                                          <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 text-orange-800 font-bold text-sm">
                                              <AlertTriangle size={18} className="text-orange-500 shrink-0" />
                                              <span>Status: Skip / Not Interested</span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setNotParticipating(prev => ({ ...prev, [task.id]: true }));
                                                setNotParticipatingReason(prev => ({ ...prev, [task.id]: submission.not_participating_reason || '' }));
                                                setIsEditingOptOut(prev => ({ ...prev, [task.id]: true }));
                                              }}
                                              className="text-xs font-bold text-orange-700 hover:text-orange-950 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg border border-orange-300 transition-colors"
                                            >
                                              Edit Reason / Change Option
                                            </button>
                                          </div>
                                          <div className="pl-4 border-l-3 border-orange-400 bg-white/70 p-3 rounded-r-lg border border-zinc-200/60">
                                            <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider mb-0.5">Submitted Reason:</p>
                                            <p className="text-sm text-zinc-900 font-semibold break-words leading-relaxed">
                                              "{submission.not_participating_reason || 'No specific reason provided'}"
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    }

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
                                      const isOptingOut = notParticipating[task.id] || false;
                                      return (
                                        <div className="space-y-4">
                                          {submission?.status === 'REJECTED' && (
                                            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-xs text-red-700 shadow-sm space-y-2">
                                              <p className="font-extrabold text-sm mb-1 flex items-center gap-1.5 text-red-800">
                                                <XCircle size={16} className="text-red-500" /> Submission Rejected by Advisor / HOD
                                              </p>
                                              <p className="font-medium bg-white/80 p-2.5 rounded-lg border border-red-200 text-zinc-900">
                                                <strong>Note / Reason:</strong> "{submission.rejection_reason || submission.verification_note || 'No specific note provided'}"
                                              </p>
                                              <p className="font-bold text-red-700">Please review the reason above, update your proof, and resubmit below.</p>
                                            </div>
                                          )}

                                          {/* ── Intent Selector (works for any task type) ── */}
                                          <div>
                                            <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Will you be submitting this task?</p>
                                            <div className="grid grid-cols-2 gap-3">
                                              {/* Yes, submit */}
                                              <button
                                                type="button"
                                                onClick={() => setNotParticipating(prev => ({ ...prev, [task.id]: false }))}
                                                className={cn(
                                                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all font-semibold text-sm',
                                                  !isOptingOut
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                                    : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300'
                                                )}
                                              >
                                                <CheckCircle2 size={22} className={!isOptingOut ? 'text-emerald-500' : 'text-zinc-300'} />
                                                <span>Yes, I'll Submit</span>
                                              </button>

                                              {/* Skip / Not Interested */}
                                              <button
                                                type="button"
                                                onClick={() => setNotParticipating(prev => ({ ...prev, [task.id]: true }))}
                                                className={cn(
                                                  'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all font-semibold text-sm',
                                                  isOptingOut
                                                    ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm'
                                                    : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300'
                                                )}
                                              >
                                                <AlertTriangle size={22} className={isOptingOut ? 'text-orange-500' : 'text-zinc-300'} />
                                                <span>Skip / Not Interested</span>
                                              </button>
                                            </div>
                                          </div>

                                          {/* ── If NOT participating: just reason ── */}
                                          {isOptingOut ? (
                                            <div className="space-y-3 pt-1">
                                              <label className="text-sm font-bold text-zinc-700 flex items-center gap-1.5">
                                                <AlertTriangle size={14} className="text-orange-500" />
                                                Reason for Not Participating <span className="text-red-500">*</span>
                                              </label>
                                              <Textarea
                                                placeholder="e.g. Already participated in a similar event / Not relevant to my current semester..."
                                                value={notParticipatingReason[task.id] || ''}
                                                onChange={e => setNotParticipatingReason(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                className="min-h-[90px]"
                                              />
                                              <Button
                                                onClick={() => submitNotParticipating(task.id)}
                                                disabled={uploading === task.id || !(notParticipatingReason[task.id] || '').trim()}
                                                className={cn(
                                                  'w-full font-bold bg-orange-500 hover:bg-orange-600 text-white',
                                                  (uploading === task.id || !(notParticipatingReason[task.id] || '').trim()) && 'opacity-50 cursor-not-allowed'
                                                )}
                                              >
                                                {uploading === task.id
                                                  ? <Loader2 size={18} className="animate-spin" />
                                                  : <><AlertTriangle size={16} /> Confirm: Not Participating</>}
                                              </Button>
                                            </div>
                                          ) : (
                                            /* ── If PARTICIPATING: custom field + screenshot both mandatory ── */
                                            <div className="space-y-4 pt-1">
                                              <div>
                                                <label className="text-sm font-bold text-zinc-700 mb-1.5 flex items-center gap-1">
                                                  {task.custom_field_label || 'Custom Field'}
                                                  <span className="text-red-500 ml-0.5">*</span>
                                                  <span className="text-[10px] font-medium text-zinc-400 ml-1">(Required)</span>
                                                </label>
                                                <Input
                                                  placeholder={`Enter ${task.custom_field_label || 'value'}...`}
                                                  value={customFieldValue}
                                                  onChange={e => setCustomFieldValue(e.target.value)}
                                                  className={cn(!customFieldValue.trim() && 'border-red-200 focus:border-red-400')}
                                                />
                                              </div>
                                              <div>
                                                <label className="text-sm font-bold text-zinc-700 mb-1.5 flex items-center gap-1">
                                                  {task.screenshot_instruction || 'Upload Screenshot'}
                                                  <span className="text-red-500 ml-0.5">*</span>
                                                  <span className="text-[10px] font-medium text-zinc-400 ml-1">(Required)</span>
                                                </label>
                                                <div className="flex flex-col gap-3">
                                                  <input
                                                    type="file"
                                                    accept="image/*"
                                                    id={`file-${task.id}`}
                                                    className="hidden"
                                                    onChange={e => handleFileUpload(task.id, e.target.files?.[0] || null)}
                                                  />
                                                  <div className="flex items-center gap-3">
                                                    <div className="flex-1 w-full">
                                                      {selectedFiles[task.id] ? (
                                                        <div className="relative w-full border-2 border-emerald-400 bg-emerald-50/80 rounded-xl p-3 md:p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
                                                          <div className="flex items-center gap-3 min-w-0 flex-1 w-full">
                                                            <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-emerald-300 bg-white shrink-0 shadow-sm flex items-center justify-center">
                                                              <img
                                                                src={URL.createObjectURL(selectedFiles[task.id])}
                                                                alt="Screenshot preview"
                                                                className="w-full h-full object-cover"
                                                              />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                              <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs md:text-sm">
                                                                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                                                <span>Screenshot Loaded</span>
                                                              </div>
                                                              <p className="text-xs text-zinc-700 font-semibold truncate mt-0.5" title={selectedFiles[task.id].name}>
                                                                {selectedFiles[task.id].name}
                                                              </p>
                                                              <p className="text-[10px] text-emerald-700/70 font-medium">
                                                                {(selectedFiles[task.id].size / (1024 * 1024)).toFixed(2)} MB
                                                              </p>
                                                            </div>
                                                          </div>
                                                          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                document.getElementById(`file-${task.id}`)?.click();
                                                              }}
                                                              className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white hover:bg-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-200 transition-colors flex items-center gap-1 shadow-xs"
                                                              title="Change screenshot"
                                                            >
                                                              <Upload size={13} /> Change
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteScreenshot(task.id);
                                                              }}
                                                              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors flex items-center gap-1.5 shadow-xs"
                                                              title="Delete screenshot if wrongly uploaded before submission"
                                                            >
                                                              <Trash2 size={14} /> Delete
                                                            </button>
                                                          </div>
                                                        </div>
                                                      ) : (
                                                        <div
                                                          className={cn(
                                                            'relative w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer group',
                                                            isDraggingScreenshot === task.id ? 'border-blue-500 bg-blue-50 scale-105' : 'border-red-200 bg-white text-zinc-400 hover:border-black hover:text-black'
                                                          )}
                                                          onDragOver={e => { e.preventDefault(); setIsDraggingScreenshot(task.id); }}
                                                          onDragLeave={() => setIsDraggingScreenshot(null)}
                                                          onDrop={e => { e.preventDefault(); setIsDraggingScreenshot(null); handleFileUpload(task.id, e.dataTransfer.files[0]); }}
                                                          onClick={() => document.getElementById(`file-${task.id}`)?.click()}
                                                        >
                                                          <Upload size={24} className="mb-2 group-hover:-translate-y-1 transition-transform" />
                                                          <p className="font-bold text-center text-[10px] md:text-sm uppercase tracking-wide">Upload Screenshot</p>
                                                          <p className="text-[10px] opacity-60 text-center">Drag or Click to upload (Max 5MB)</p>
                                                        </div>
                                                      )}
                                                    </div>
                                                    <Button
                                                      onClick={() => submitTask(task.id)}
                                                      disabled={uploading === task.id || !selectedFiles[task.id] || !customFieldValue.trim()}
                                                      variant={selectedFiles[task.id] && customFieldValue.trim() ? 'primary' : 'secondary'}
                                                      className={cn(
                                                        'h-auto px-6 py-4 shrink-0 font-black uppercase tracking-wider text-sm',
                                                        (uploading === task.id || !selectedFiles[task.id] || !customFieldValue.trim()) && 'opacity-50 cursor-not-allowed'
                                                      )}
                                                    >
                                                      {uploading === task.id ? <Loader2 size={20} className="animate-spin" /> : 'Submit'}
                                                    </Button>
                                                  </div>
                                                  <div className="flex items-start gap-2 text-zinc-400">
                                                    <span className="text-xs shrink-0 mt-0.5">*</span>
                                                    <p className="text-xs italic leading-tight">{task.screenshot_instruction || 'Ensure your screenshot clearly shows completion or registration details before submitting.'}</p>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          )}
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
                            )}
                            {((isHOD && (String(task.department_id) === String(user?.department_id) || (Array.isArray(task.class_ids) && task.class_ids.some(cid => classes.find(c => String(c.id) === String(cid))?.department_id?.toString() === user?.department_id?.toString()))))) && (
                              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
                                <Button
                                  variant="secondary"
                                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 text-xs font-bold flex items-center gap-1.5"
                                  onClick={() => {
                                    setExtendingTask(task);
                                    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
                                    const pad = (n: number) => String(n).padStart(2, '0');
                                    setExtendedDeadline(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                                  }}
                                >
                                  <Clock size={14} /> Extend Deadline & Reopen
                                </Button>

                                <Button
                                  variant="ghost"
                                  className="text-zinc-500 hover:text-zinc-900 text-xs font-semibold"
                                  onClick={() => toggleTaskStatus(task.id, task.status)}
                                >
                                  {task.status === 'OPEN' ? 'Close Task' : 'Open Task'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="text-zinc-400 hover:text-red-500 text-xs font-semibold"
                                  onClick={() => deleteTask(task.id)}
                                >
                                  <Trash2 size={16} /> Delete
                                </Button>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </PageLayout>
                </motion.div>
              )}

              {view === 'verifications' && (
                <motion.div
                  key="verifications"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full h-full flex flex-col min-h-0"
                >
                  <PageLayout>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2 flex-wrap">
                        {['PENDING', 'VERIFIED', 'REJECTED', 'NOT INTERESTED', 'ALL'].map(f => (
                          <button
                            key={f}
                            onClick={() => setVerificationFilter(f as any)}
                            className={cn(
                              "px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap",
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

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 items-start">
                      <div className={cn((isHOD || isAdmin || user?.is_year_coordinator) ? "md:col-span-2" : "md:col-span-3", "relative self-start")}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <Input
                          placeholder="Search submissions by student name or register number..."
                          className="pl-10 h-10 text-sm"
                          value={submissionSearchTerm}
                          onChange={e => { setSubmissionSearchTerm(e.target.value); setSubmissionPage(1); }}
                        />
                      </div>

                      {(isHOD || isAdmin || user?.is_year_coordinator) && (
                        <div className="flex flex-wrap items-center gap-2">
                          {isAdmin && (
                            <Select
                              value={verificationDeptFilter}
                              onChange={e => {
                                setVerificationDeptFilter(e.target.value);
                                setVerificationYearFilter('');
                                setVerificationClassFilter('');
                                setSubmissionPage(1);
                              }}
                            >
                              <option value="">All Departments</option>
                              {departments.map(d => (
                                <option key={d.id} value={d.id.toString()}>{d.name}</option>
                              ))}
                            </Select>
                          )}
                          {(isHOD || isAdmin) && (
                            <Select
                              value={verificationYearFilter}
                              onChange={e => {
                                setVerificationYearFilter(e.target.value);
                                setVerificationClassFilter('');
                                setSubmissionPage(1);
                              }}
                            >
                              <option value="">All Years</option>
                              <option value="1">1st Year</option>
                              <option value="2">2nd Year</option>
                              <option value="3">3rd Year</option>
                              <option value="4">4th Year</option>
                            </Select>
                          )}
                          <Select
                            value={verificationClassFilter}
                            onChange={e => { setVerificationClassFilter(e.target.value); setSubmissionPage(1); }}
                          >
                            <option value="">All Classes / Sections</option>
                            {classes.filter(c => {
                              if (verificationDeptFilter && c.department_id?.toString() !== verificationDeptFilter) return false;
                              if (verificationYearFilter && String(c.year) !== verificationYearFilter) return false;
                              if (isAdmin) return true;
                              if (isHOD) return c.department_id?.toString() === user?.department_id?.toString();
                              if (user?.is_year_coordinator) return c.department_id?.toString() === user?.department_id?.toString() && Number(c.year) === Number(user?.year_scope || user?.year);
                              if (isAdvisor || (user?.role === 'STUDENT' && user?.is_coordinator)) return String(c.id) === String(user?.class_id);
                              return c.department_id?.toString() === user?.department_id?.toString();
                            }).sort((a, b) => (a.year || 0) - (b.year || 0) || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })).map(c => (
                              <option key={c.id} value={c.id.toString()}>{c.name}</option>
                            ))}
                          </Select>
                        </div>
                      )}

                      <div>
                        <Select
                          value={verificationTaskFilter}
                          onChange={e => { setVerificationTaskFilter(e.target.value); setSubmissionPage(1); }}
                        >
                          <option value="">All Tasks</option>
                          {tasks.map(t => (
                            <option key={t.id} value={t.id.toString()}>{t.title}</option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {/* Faculty & Coordinator Team Submissions Review Section */}
                    {(!verificationTaskFilter || tasks.find(t => t.id.toString() === verificationTaskFilter)?.submission_type === 'TEAM') && (() => {
                      const filteredTeamSubs = teamSubmissions.filter(sub => {
                        // 0. Filter by Task Dropdown
                        if (verificationTaskFilter && sub.task_id?.toString() !== verificationTaskFilter) {
                          return false;
                        }

                        // 1. Filter by Status Tab
                        if (verificationFilter === 'PENDING') {
                          if (sub.status !== 'PENDING') return false;
                        } else if (verificationFilter === 'VERIFIED') {
                          if (sub.status !== 'APPROVED' && sub.status !== 'VERIFIED') return false;
                        } else if (verificationFilter === 'REJECTED') {
                          if (sub.status !== 'REJECTED') return false;
                        } else if (verificationFilter === 'NOT INTERESTED') {
                          return false;
                        }
                        // 'ALL' tab includes all team submissions

                        // 2. Filter by Search Query
                        if (submissionSearchTerm) {
                          const q = submissionSearchTerm.toLowerCase();
                          const matchesTeamName = sub.team_name?.toLowerCase().includes(q);
                          const matchesLeader = sub.leader_name?.toLowerCase().includes(q) || sub.leader_regno?.toLowerCase().includes(q);
                          const matchesMember = sub.members?.some(m => (m.full_name || m.username)?.toLowerCase().includes(q) || m.register_number?.toLowerCase().includes(q));
                          const matchesTaskTitle = sub.task_title?.toLowerCase().includes(q);
                          if (!matchesTeamName && !matchesLeader && !matchesMember && !matchesTaskTitle) return false;
                        }

                        // 3. Filter by Class
                        if (!isAdmin && !isHOD && !user?.is_year_coordinator) {
                          const userClassId = user?.class_id?.toString();
                          const matchesTeamClass = sub.class_id?.toString() === userClassId;
                          const leaderUser = users.find(u => u.id === sub.leader_id || u.register_number === sub.leader_regno);
                          const matchesClass = matchesTeamClass || leaderUser?.class_id?.toString() === userClassId ||
                            sub.members?.some(m => users.find(u => u.id === m.id || u.register_number === m.register_number)?.class_id?.toString() === userClassId);
                          if (!matchesClass) return false;
                        } else if (verificationDeptFilter || verificationClassFilter || verificationYearFilter) {
                          const leaderUser = users.find(u => u.id === sub.leader_id || u.register_number === sub.leader_regno);
                          const subClassId = sub.class_id?.toString() || leaderUser?.class_id?.toString();
                          const subClass = classes.find(c => c.id.toString() === subClassId);

                          if (verificationDeptFilter) {
                            const deptId = subClass?.department_id?.toString() || leaderUser?.department_id?.toString();
                            if (deptId && deptId !== verificationDeptFilter) return false;
                          }
                          if (verificationYearFilter && subClass && String(subClass.year) !== verificationYearFilter) {
                            return false;
                          }
                          if (verificationClassFilter) {
                            const matchesTeamClass = sub.class_id?.toString() === verificationClassFilter;
                            const matchesClass = matchesTeamClass || leaderUser?.class_id?.toString() === verificationClassFilter ||
                              sub.members?.some(m => users.find(u => u.id === m.id || u.register_number === m.register_number)?.class_id?.toString() === verificationClassFilter);
                            if (!matchesClass) return false;
                          }
                        } else if (user?.is_year_coordinator) {
                          const leaderUser = users.find(u => u.id === sub.leader_id || u.register_number === sub.leader_regno);
                          const subClassId = sub.class_id?.toString() || leaderUser?.class_id?.toString();
                          const subClass = classes.find(c => c.id.toString() === subClassId);
                          if (subClass && Number(subClass.year) !== Number(user?.year_scope)) return false;
                        }

                        return true;
                      });

                      if (filteredTeamSubs.length === 0 && teamSubmissions.length === 0) return null;

                      return (
                        <div className="mb-8 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="primary" className="bg-indigo-600 text-white border-none">
                                <Users size={12} /> Team Task Submissions
                              </Badge>
                              <span className="text-xs text-zinc-500 font-bold">
                                {filteredTeamSubs.length} Team{filteredTeamSubs.length !== 1 ? 's' : ''} {verificationFilter === 'ALL' ? 'Submitted' : verificationFilter}
                              </span>
                            </div>
                          </div>

                          {filteredTeamSubs.length === 0 ? (
                            <div className="p-8 bg-zinc-50 border border-zinc-200 rounded-2xl text-center text-xs text-zinc-500">
                              No {verificationFilter.toLowerCase()} team submissions found.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {filteredTeamSubs.map(sub => (
                                <Card key={sub.id} className="p-5 space-y-4 border border-zinc-200 hover:border-indigo-300 transition-colors">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                                          {sub.task_title || tasks.find(t => String(t.id) === String(sub.task_id))?.title || 'Team Task'}
                                        </span>
                                      </div>
                                      <h4 className="font-extrabold text-zinc-900 text-base flex items-center gap-2">
                                        {sub.team_name}
                                      </h4>
                                      <p className="text-xs text-zinc-500 font-medium">
                                        Leader: <span className="font-bold text-zinc-800">{sub.leader_name}</span> ({sub.leader_regno})
                                      </p>
                                    </div>
                                    <Badge variant={
                                      sub.status === 'APPROVED' || sub.status === 'VERIFIED' ? 'success' :
                                        sub.status === 'REJECTED' ? 'danger' : 'warning'
                                    }>
                                      {sub.status}
                                    </Badge>
                                  </div>

                                  {/* Members list */}
                                  {sub.members && sub.members.length > 0 && (
                                    <div className="bg-zinc-50 p-3 rounded-xl space-y-1 border border-zinc-100">
                                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Accepted Members ({sub.members.length})</p>
                                      <div className="flex flex-wrap gap-1.5 pt-1">
                                        {sub.members.map(m => {
                                          const isLeader = String(m.student_id) === String(sub.leader_id) || m.register_number === sub.leader_regno;
                                          return (
                                            <span key={m.id} className={cn(
                                              "border px-2 py-0.5 rounded-lg text-xs font-semibold flex items-center gap-1.5",
                                              isLeader ? "bg-indigo-50 border-indigo-200 text-indigo-900" : "bg-white border-zinc-200 text-zinc-700"
                                            )}>
                                              {m.full_name || m.username} ({m.register_number})
                                              {isLeader ? (
                                                <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase">Leader</span>
                                              ) : (
                                                <span className="bg-zinc-100 text-zinc-600 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">Member</span>
                                              )}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Proof Image */}
                                  {sub.proof_url && (
                                    <div className="rounded-xl overflow-hidden bg-zinc-900 border border-zinc-200 max-h-48 flex items-center justify-center cursor-pointer" onClick={() => window.open(sub.proof_url, '_blank')}>
                                      <img src={sub.proof_url} alt="Team Proof" className="max-h-48 object-contain" />
                                    </div>
                                  )}

                                  {sub.remarks && (
                                    <p className="text-xs text-zinc-600 italic bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                                      "{sub.remarks}"
                                    </p>
                                  )}

                                  {sub.status === 'PENDING' && (
                                    <div className="flex gap-2 pt-2 border-t border-zinc-100">
                                      <Button
                                        variant="success"
                                        className="flex-1 text-xs py-2 font-bold"
                                        onClick={() => handleReviewTeamSubmission(sub.id, 'APPROVED')}
                                      >
                                        <CheckCircle2 size={16} /> Approve Team
                                      </Button>
                                      <Button
                                        variant="danger"
                                        className="flex-1 text-xs py-2 font-bold"
                                        onClick={() => handleReviewTeamSubmission(sub.id, 'REJECTED')}
                                      >
                                        <XCircle size={16} /> Reject Team
                                      </Button>
                                    </div>
                                  )}
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <Table className="min-w-[800px] md:min-w-0">
                      <THead>
                        <TR>
                          <TH className="w-12">
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
                          </TH>
                          <TH>Student</TH>
                          <TH>Task</TH>
                          {verificationFilter === 'NOT INTERESTED' ? (
                            <TH colSpan={2}>Reason for Not Interested</TH>
                          ) : (
                            <>
                              <TH>Custom Field</TH>
                              <TH>Screenshot</TH>
                            </>
                          )}
                          <TH className="text-center">Status</TH>
                          <TH className="text-right">Actions</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {(() => {
                          const filtered = submissions
                            .filter(s => {
                              if (verificationFilter === 'ALL') return true;
                              if (verificationFilter === 'PENDING') return s.status === 'SUBMITTED';
                              if (verificationFilter === 'NOT INTERESTED') return s.status === 'NOT_PARTICIPATING';
                              return s.status === verificationFilter;
                            })
                            .filter(s => {
                              const std = users.find(u => u.id === s.user_id);
                              const subClassId = s.class_id?.toString() || std?.class_id?.toString();

                              if (!isAdmin && !isHOD && !user?.is_year_coordinator) {
                                const userClassId = user?.class_id?.toString();
                                return userClassId ? subClassId === userClassId : true;
                              }
                              if (verificationDeptFilter) {
                                const std = users.find(u => u.id === s.user_id);
                                const subClass = classes.find(c => c.id.toString() === subClassId);
                                const deptId = subClass?.department_id?.toString() || std?.department_id?.toString();
                                if (deptId && deptId !== verificationDeptFilter) return false;
                              }
                              if (verificationYearFilter) {
                                const subClass = classes.find(c => c.id.toString() === subClassId);
                                if (subClass && String(subClass.year) !== verificationYearFilter) return false;
                              }
                              if (verificationClassFilter) {
                                return subClassId === verificationClassFilter;
                              }
                              if (user?.is_year_coordinator) {
                                const subClass = classes.find(c => c.id.toString() === subClassId);
                                return subClass ? Number(subClass.year) === Number(user?.year_scope) : true;
                              }
                              return true;
                            })
                            .filter(s => verificationTaskFilter ? s.task_id?.toString() === verificationTaskFilter : true)
                            .filter(s => {
                              if (!submissionSearchTerm) return true;
                              const query = submissionSearchTerm.toLowerCase();
                              return s.student_name?.toLowerCase().includes(query) || s.register_number?.toLowerCase().includes(query) || s.task_title?.toLowerCase().includes(query) || s.not_participating_reason?.toLowerCase().includes(query);
                            });

                          if (filtered.length === 0) {
                            return (
                              <TR>
                                <TD colSpan={7} className="text-center py-12">
                                  <div className="max-w-md mx-auto">
                                    <Users size={48} className="mx-auto text-zinc-300 mb-4" />
                                    <p className="font-bold text-base text-zinc-900">No submissions found</p>
                                    <p className="text-sm text-zinc-400">There are no task submissions matching the filters.</p>
                                  </div>
                                </TD>
                              </TR>
                            );
                          }

                          const totalPages = Math.ceil(filtered.length / itemsPerPage);
                          const paginated = filtered.slice((submissionPage - 1) * itemsPerPage, submissionPage * itemsPerPage);

                          return (
                            <>
                              {paginated.map(s => (
                                <TR key={s.id} className={cn("border-l-4", s.status === 'VERIFIED' ? "border-emerald-500" : s.status === 'REJECTED' ? "border-red-500" : s.status === 'NOT_PARTICIPATING' ? "border-orange-400" : "border-amber-500")}>
                                  <TD>
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
                                  </TD>
                                  <TD>
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                                        <Users size={16} className="text-zinc-500" />
                                      </div>
                                      <div className="break-words min-w-0">
                                        <p className="text-sm font-bold text-zinc-900 leading-tight break-words">{s.student_name}</p>
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs text-zinc-500 font-mono italic break-all">{s.register_number}</p>
                                          <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 text-xs font-bold rounded uppercase border border-zinc-200">
                                            {s.class_name || 'N/A'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </TD>
                                  <TD>
                                    <p className="text-sm font-medium text-zinc-900 break-words">{s.task_title}</p>
                                    <p className="text-xs text-zinc-400 capitalize">{new Date(s.submitted_at).toLocaleDateString()}</p>
                                  </TD>
                                  {s.status === 'NOT_PARTICIPATING' ? (
                                    <TD colSpan={2}>
                                      <div className="p-3 bg-orange-50/90 border border-orange-200 rounded-xl max-w-md shadow-xs">
                                        <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                          <AlertTriangle size={12} className="text-orange-500 shrink-0" />
                                          <span>Reason for Not Interested</span>
                                        </p>
                                        <p className="text-xs text-orange-950 font-semibold break-words leading-relaxed">
                                          "{s.not_participating_reason || 'No specific reason provided'}"
                                        </p>
                                      </div>
                                    </TD>
                                  ) : (
                                    <>
                                      <TD>
                                        <p className="text-xs text-zinc-400 uppercase font-bold mb-1 tracking-widest">Field Data</p>
                                        <p className="text-sm font-mono text-zinc-900 bg-zinc-100 px-2 py-1 rounded inline-block break-all">
                                          {s.custom_field_value || '—'}
                                        </p>
                                      </TD>
                                      <TD>
                                        {s.screenshot_url ? (
                                          <div className="relative group/img">
                                            <img
                                              src={getCloudinaryThumbnail(s.screenshot_url, 150)}
                                              className="w-12 h-12 object-cover rounded-lg border-2 border-zinc-200 hover:border-black transition-all cursor-zoom-in"
                                              onClick={() => window.open(s.screenshot_url, '_blank')}
                                              alt="Thumbnail"
                                            />
                                            <div className="absolute top-0 left-0 w-full h-full bg-black/5 rounded-lg pointer-events-none group-hover/img:bg-transparent transition-colors" />
                                          </div>
                                        ) : (
                                          <span className="text-xs text-zinc-400 font-mono italic">No File</span>
                                        )}
                                      </TD>
                                    </>
                                  )}
                                  <TD className="text-center">
                                    <Badge variant={
                                      s.status === 'VERIFIED' ? 'success' :
                                        s.status === 'REJECTED' ? 'danger' : 'warning'
                                    } className={s.status === 'NOT_PARTICIPATING' ? 'bg-orange-100 text-orange-700 border-orange-200' : ''}>
                                      {s.status === 'SUBMITTED' ? 'PENDING' : s.status === 'NOT_PARTICIPATING' ? 'NOT INTERESTED' : s.status}
                                    </Badge>
                                  </TD>
                                  <TD className="text-right">
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
                                      <p className="text-xs text-red-500 font-medium">Wait for Resubmission</p>
                                    )}
                                    {s.status === 'VERIFIED' && (
                                      <p className="text-xs text-emerald-500 font-medium flex items-center gap-1 justify-end">
                                        <CheckCircle2 size={14} /> Verified
                                      </p>
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
                                  </TD>
                                </TR>
                              ))}
                              {filtered.length > itemsPerPage && (
                                <TR>
                                  <TD colSpan={7} className="bg-zinc-50/30">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-1">
                                      <p className="text-xs font-medium text-zinc-500 whitespace-nowrap">
                                        Showing {(submissionPage - 1) * itemsPerPage + 1} to {Math.min(submissionPage * itemsPerPage, filtered.length)} of {filtered.length} entries
                                      </p>
                                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                        <Button
                                          variant="secondary"
                                          className="px-3 py-1 h-8 text-xs font-semibold"
                                          disabled={submissionPage === 1}
                                          onClick={() => setSubmissionPage(prev => prev - 1)}
                                        >
                                          Previous
                                        </Button>
                                        <div className="flex items-center gap-1">
                                          {getPaginationRange(submissionPage, totalPages).map((p, idx) => typeof p === 'number' ? (
                                            <button
                                              key={idx}
                                              onClick={() => setSubmissionPage(p)}
                                              className={cn(
                                                "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                                                submissionPage === p ? "bg-black text-white shadow-sm" : "text-zinc-600 hover:bg-zinc-100"
                                              )}
                                            >
                                              {p}
                                            </button>
                                          ) : (
                                            <span key={idx} className="w-5 text-center text-xs text-zinc-400 font-bold">...</span>
                                          ))}
                                        </div>
                                        <Button
                                          variant="secondary"
                                          className="px-3 py-1 h-8 text-xs font-semibold"
                                          disabled={submissionPage === totalPages}
                                          onClick={() => setSubmissionPage(prev => prev + 1)}
                                        >
                                          Next
                                        </Button>
                                      </div>
                                    </div>
                                  </TD>
                                </TR>
                              )}
                              {filtered.length === 0 && (
                                <TR>
                                  <TD colSpan={7} className="text-center text-zinc-500 text-sm py-12">
                                    No submissions found matching your filters.
                                  </TD>
                                </TR>
                              )}
                            </>
                          );
                        })()}
                      </TBody>
                    </Table>
                  </PageLayout>
                </motion.div>
              )}

              {
                view === 'submissions' && (
                  <motion.div
                    key="submissions"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full h-full flex flex-col min-h-0"
                  >
                    <PageLayout>
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
                                {sub.status === 'NOT_PARTICIPATING' ? (
                                  <div className="w-full md:w-48 h-48 bg-orange-50 rounded-xl border border-orange-200 p-4 flex flex-col items-center justify-center text-center shrink-0">
                                    <AlertTriangle size={32} className="text-orange-500 mb-2" />
                                    <p className="text-xs font-bold text-orange-700 uppercase">Not Participating</p>
                                    <p className="text-xs text-orange-800 mt-1 line-clamp-4 font-medium">"{sub.not_participating_reason || 'No reason provided'}"</p>
                                  </div>
                                ) : (
                                  <div className="w-full md:w-48 h-48 bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                                    {sub.screenshot_url ? (
                                      <img
                                        src={getCloudinaryThumbnail(sub.screenshot_url, 400)}
                                        alt="Submission"
                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                        onClick={() => window.open(sub.screenshot_url, '_blank')}
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs">No image uploaded</div>
                                    )}
                                  </div>
                                )}
                                <div className="flex-1 flex flex-col justify-between">
                                  <div>
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h4 className="font-bold text-zinc-900 text-lg">{sub.task_title}</h4>
                                        <p className="text-sm text-zinc-500">
                                          {isAdvisor ? `Student: ${sub.student_name}` : `Submitted on ${new Date(sub.submitted_at).toLocaleString()}`}
                                        </p>
                                      </div>
                                      <Badge variant={
                                        sub.status === 'VERIFIED' ? 'success' :
                                          sub.status === 'REJECTED' ? 'danger' : 'warning'
                                      } className={sub.status === 'NOT_PARTICIPATING' ? 'bg-orange-100 text-orange-700 border-orange-200' : ''}>
                                        {sub.status === 'NOT_PARTICIPATING' ? 'NOT INTERESTED' : sub.status}
                                      </Badge>
                                    </div>
                                    {sub.verified_at && (
                                      <p className="text-xs text-zinc-400 mt-2 uppercase font-bold">
                                        Verified on {new Date(sub.verified_at).toLocaleString()}
                                      </p>
                                    )}
                                  </div>

                                  {(isHOD || isAdmin || isAdvisor || isCoordinator) && sub.status === 'SUBMITTED' && (
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

                                  {sub.screenshot_url && (
                                    <Button
                                      variant="ghost"
                                      className="mt-4 text-xs flex items-center gap-2 w-fit"
                                      onClick={() => window.open(sub.screenshot_url, '_blank')}
                                    >
                                      <ExternalLink size={14} /> View Full Screenshot
                                    </Button>
                                  )}
                                </div>
                              </Card>
                            ))
                        )}
                      </div>
                    </PageLayout>
                  </motion.div>
                )
              }

              {
                view === 'profile' && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full h-full flex flex-col min-h-0 overflow-y-auto"
                  >
                    {isStudent ? (
                      <StudentProfileView
                        user={user}
                        token={token}
                        addToast={addToast}
                      />
                    ) : (
                      <PageLayout>
                        <Card className="p-8 text-center text-zinc-500">
                          <Shield size={48} className="mx-auto mb-4 text-zinc-400" />
                          <h3 className="text-lg font-bold text-zinc-900 mb-1">Student Profile Only</h3>
                          <p className="text-sm">This profile module is exclusively available to logged-in student accounts.</p>
                        </Card>
                      </PageLayout>
                    )}
                  </motion.div>
                )
              }

              {
                view === 'leetcode-targets' && (
                  <motion.div
                    key="leetcode-targets"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full h-full flex flex-col min-h-0 overflow-y-auto"
                  >
                    {renderLeetcodeTargetsView()}
                  </motion.div>
                )
              }

              {
                view === 'notice-board' && (
                  <motion.div
                    key="notice-board"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full h-full flex flex-col min-h-0"
                  >
                    <PageLayout>
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                        <div>
                          <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                            <Megaphone className="text-indigo-600" size={26} /> Digital Notice Board
                          </h2>
                          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Official Announcements & Communications</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            onClick={handleShareNoticeBoard}
                            variant="outline"
                            className="border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold px-4 rounded-xl flex items-center gap-1.5"
                            title="Copy Notice Board link"
                          >
                            <Share2 size={16} /> Share Board
                          </Button>
                          {(isAdvisor || isHOD || isAdmin) && (
                            <Button
                              onClick={openCreateNoticeModal}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 rounded-xl shadow-lg shadow-indigo-600/20"
                            >
                              <Plus size={18} /> Publish Notice
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mb-6">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                          <Input
                            placeholder="Search notices..."
                            value={noticeSearch}
                            onChange={e => setNoticeSearch(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <select
                          value={noticePriorityFilter}
                          onChange={e => setNoticePriorityFilter(e.target.value)}
                          className="h-11 px-3 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700"
                        >
                          <option value="">All Priorities</option>
                          <option value="URGENT">🚨 Urgent</option>
                          <option value="HIGH">🔥 High</option>
                          <option value="NORMAL">📌 Normal</option>
                          <option value="LOW">ℹ️ Low</option>
                        </select>
                        <select
                          value={noticeScopeFilter}
                          onChange={e => setNoticeScopeFilter(e.target.value)}
                          className="h-11 px-3 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700"
                        >
                          <option value="">All Scopes</option>
                          <option value="ALL">🌐 All</option>
                          <option value="DEPARTMENT">🏢 Department</option>
                          <option value="CLASS">🎓 Class</option>
                        </select>
                      </div>

                      <div className="space-y-4">
                        {notices.length === 0 ? (
                          <Card className="p-12 text-center text-zinc-400">
                            <Megaphone size={40} className="mx-auto mb-3 text-zinc-300" />
                            <p className="font-bold text-zinc-600 text-base">No notices posted yet</p>
                            <p className="text-xs text-zinc-400 mt-1">Check back later for announcements</p>
                          </Card>
                        ) : (
                          notices.map(notice => {
                            const isHighlighted = String(highlightedNoticeId) === String(notice.id);
                            return (
                              <Card
                                id={`notice-${notice.id}`}
                                key={notice.id}
                                className={cn(
                                  "p-6 relative transition-all border",
                                  isHighlighted
                                    ? "border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-50/20 shadow-lg"
                                    : notice.is_pinned
                                      ? "border-amber-300 bg-amber-50/20 shadow-md"
                                      : "border-zinc-200 hover:border-zinc-300"
                                )}
                              >
                                <div className="flex items-start justify-between gap-4 mb-3">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {isHighlighted && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white border border-indigo-700 flex items-center gap-1">
                                          <Share2 size={10} /> SHARED LINK TARGET
                                        </span>
                                      )}
                                      {notice.is_pinned && (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                          <Pin size={10} /> PINNED
                                        </span>
                                      )}
                                      <span className={cn(
                                        "px-2.5 py-0.5 rounded-full text-[10px] font-black border",
                                        notice.priority === 'URGENT' ? "bg-red-50 text-red-600 border-red-200" :
                                          notice.priority === 'HIGH' ? "bg-orange-50 text-orange-600 border-orange-200" :
                                            notice.priority === 'LOW' ? "bg-zinc-100 text-zinc-600 border-zinc-200" :
                                              "bg-blue-50 text-blue-600 border-blue-200"
                                      )}>
                                        {notice.priority}
                                      </span>
                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                                        {notice.scope === 'ALL' ? '🌐 GLOBAL' : notice.scope === 'DEPARTMENT' ? `🏢 DEPT: ${notice.department_name || 'DEPARTMENT'}` : notice.scope === 'CLASS' ? `🎓 CLASS: ${notice.class_name || 'CLASS'}` : `${notice.scope} SCOPE`}
                                      </span>
                                    </div>
                                    <h3 className="text-lg font-black text-zinc-900 leading-snug">{notice.title}</h3>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => handleShareNotice(notice.id, notice.title)}
                                      className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold px-2.5 border border-zinc-200 hover:border-indigo-300"
                                      title="Share Notice Link"
                                    >
                                      <Share2 size={14} />
                                      <span className="hidden sm:inline">Share</span>
                                    </button>
                                    {(isAdvisor || isHOD || isAdmin) && (
                                      <button
                                        onClick={() => handlePinNotice(notice.id)}
                                        className={cn("p-1.5 rounded-lg hover:bg-zinc-100 transition-colors", notice.is_pinned ? "text-amber-600" : "text-zinc-400")}
                                        title={notice.is_pinned ? "Unpin Notice" : "Pin Notice"}
                                      >
                                        <Pin size={16} />
                                      </button>
                                    )}
                                    {(isAdmin || String(notice.created_by) === String(user?.id)) && (
                                      <button
                                        onClick={() => handleDeleteNotice(notice.id)}
                                        className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Notice"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed mb-4">{notice.description}</p>

                                {notice.attachment_url && (
                                  <div className="mb-4">
                                    <a
                                      href={notice.attachment_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors border border-indigo-200"
                                    >
                                      <Paperclip size={14} /> Download Notice Attachment
                                    </a>
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-xs font-medium text-zinc-400 border-t border-zinc-100 pt-3">
                                  <span>Posted by <strong className="text-zinc-700">{notice.creator_name}</strong> ({notice.creator_role})</span>
                                  <span>{new Date(notice.created_at).toLocaleString()}</span>
                                </div>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </PageLayout>
                  </motion.div>
                )
              }

              {
                view === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full h-full flex flex-col min-h-0"
                  >
                    <SettingsView
                      user={user}
                      token={token}
                      addToast={addToast}
                    />
                  </motion.div>
                )
              }
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showExportModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-white rounded-[2rem] p-6 md:p-8 max-w-xl w-full shadow-2xl relative border border-zinc-100 max-h-[90vh] overflow-y-auto"
                >
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="absolute top-5 right-5 p-2 hover:bg-zinc-100 rounded-full transition-colors"
                  >
                    <X size={20} className="text-zinc-400" />
                  </button>

                  <h3 className="text-2xl font-black text-zinc-900 tracking-tight pr-8">Report Studio</h3>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1.5 mb-6">
                    {isAdmin ? 'System-Wide Report' : isHOD ? 'Department Report' : user?.is_year_coordinator ? `Year ${user?.year_scope} Report` : `Class Report — ${user?.class_name || 'My Class'}`}
                  </p>

                  <div className="space-y-4">

                    {/* HOD / Admin: multi-class checkbox picker */}
                    {(isAdmin || isHOD) && (() => {
                      const availableClasses = isAdmin
                        ? classes
                        : (hodStats?.classStats || classes.filter(c => c.department_id?.toString() === user?.department_id?.toString()));
                      return (
                        <div>
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                            <Users size={11} />
                            Select Classes <span className="normal-case text-zinc-300 font-medium">(pick multiple)</span>
                          </label>
                          <div className="max-h-40 overflow-y-auto border border-zinc-100 rounded-2xl bg-zinc-50 p-3 flex flex-col gap-2">
                            {(availableClasses as any[]).slice().sort((a: any, b: any) => (a.year || 0) - (b.year || 0) || (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })).map((c: any) => {
                              const cid = c.id.toString();
                              const checked = reportFilters.classIds.includes(cid);
                              return (
                                <label key={cid} className="flex items-center gap-3 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setReportFilters(prev => ({
                                      ...prev,
                                      classIds: checked
                                        ? prev.classIds.filter(id => id !== cid)
                                        : [...prev.classIds, cid]
                                    }))}
                                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                  />
                                  <span className={`text-sm font-bold transition-colors ${checked ? 'text-blue-700' : 'text-zinc-700 group-hover:text-zinc-900'}`}>{c.name}</span>
                                </label>
                              );
                            })}
                          </div>
                          {reportFilters.classIds.length > 0 && (
                            <p className="text-[10px] font-bold text-blue-600 mt-1.5">
                              {reportFilters.classIds.length} class{reportFilters.classIds.length > 1 ? 'es' : ''} selected — report will combine all selected classes
                            </p>
                          )}
                          {reportFilters.classIds.length === 0 && (
                            <p className="text-[10px] font-medium text-zinc-400 mt-1.5">No class selected — will include all classes</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Year Coordinator: multi-class checkbox picker */}
                    {user?.is_year_coordinator && !isAdmin && !isHOD && (() => {
                      const availableClasses = classes.filter(c => Number(c.year) === Number(user?.year_scope) && c.department_id?.toString() === user?.department_id?.toString());
                      return (
                        <div>
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                            <Users size={11} />
                            Select Classes <span className="normal-case text-zinc-300 font-medium">(pick multiple)</span>
                          </label>
                          <div className="max-h-40 overflow-y-auto border border-zinc-100 rounded-2xl bg-zinc-50 p-3 flex flex-col gap-2">
                            {availableClasses.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })).map((c: any) => {
                              const cid = c.id.toString();
                              const checked = reportFilters.classIds.includes(cid);
                              return (
                                <label key={cid} className="flex items-center gap-3 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => setReportFilters(prev => ({
                                      ...prev,
                                      classIds: checked
                                        ? prev.classIds.filter(id => id !== cid)
                                        : [...prev.classIds, cid]
                                    }))}
                                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                                  />
                                  <span className={`text-sm font-bold transition-colors ${checked ? 'text-blue-700' : 'text-zinc-700 group-hover:text-zinc-900'}`}>{c.name}</span>
                                </label>
                              );
                            })}
                          </div>
                          {reportFilters.classIds.length > 0 && (
                            <p className="text-[10px] font-bold text-blue-600 mt-1.5">
                              {reportFilters.classIds.length} class{reportFilters.classIds.length > 1 ? 'es' : ''} selected — report will combine all selected classes
                            </p>
                          )}
                          {reportFilters.classIds.length === 0 && (
                            <p className="text-[10px] font-medium text-zinc-400 mt-1.5">No class selected — will include all year classes</p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Class Advisor & Student Coordinator: assigned class indicator */}
                    {(isAdvisor || isCoordinator) && !isAdmin && !isHOD && !user?.is_year_coordinator && (
                      <div>
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 block">Assigned Class</label>
                        <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold text-zinc-800">
                          {myClass?.name || classes.find(c => c.id.toString() === user?.class_id?.toString())?.name || 'My Class'}
                        </div>
                      </div>
                    )}

                    {/* Task selector */}
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><ClipboardList size={11} /> Task</label>
                      <select
                        className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={reportFilters.taskId}
                        onChange={(e) => setReportFilters(prev => ({ ...prev, taskId: e.target.value }))}
                      >
                        <option value="">All Tasks</option>
                        {tasks.map((t: any) => (
                          <option key={t.id} value={t.id.toString()}>{t.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Submission Status */}
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5"><ShieldCheck size={11} /> Submission Status</label>
                      <StatusDropdown
                        value={reportFilters.status || 'ALL'}
                        onChange={(val) => setReportFilters(prev => ({ ...prev, status: val }))}
                      />
                    </div>




                    <div className="flex gap-4 pt-2">
                      <Button variant="ghost" onClick={() => { setShowExportModal(false); setReportFilters({ classIds: [], taskId: '', status: 'ALL' }); }} className="flex-1 rounded-2xl">Cancel</Button>
                      <Button
                        onClick={() => exportToExcel(reportFilters)}
                        className="flex-1 rounded-2xl bg-black hover:bg-zinc-800 text-white flex items-center justify-center gap-2"
                      >
                        <FileDown size={18} /> Download Excel
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {showFooterModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "bg-white rounded-3xl p-6 md:p-8 w-full max-h-[85vh] overflow-y-auto shadow-2xl relative scrollbar-thin",
                    showFooterModal === 'SOURCES' ? 'max-w-5xl' : 'max-w-2xl'
                  )}
                >
                  <button
                    onClick={() => setShowFooterModal(null)}
                    className="absolute top-6 right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors z-20"
                  >
                    <XCircle size={24} className="text-zinc-400 hover:text-zinc-600 transition-colors" />
                  </button>

                  {showFooterModal === 'PRIVACY' && (
                    <div className="space-y-4">
                      <h3 className="text-2xl font-black text-zinc-900">Privacy Policy</h3>
                      <div className="text-zinc-600 leading-relaxed text-sm space-y-4">
                        <p>The VSBEC IT Academic Task Management System respects the privacy of all users.</p>
                        <p>Information collected through the platform, including login credentials, academic task records, submissions, and user activity, is used only for academic administration and internal institutional purposes.</p>
                        <p>User data is securely stored and accessed only by authorized administrators, department staff, and relevant academic authorities. The system does not share personal information with external parties without institutional approval.</p>
                        <p>All users are expected to maintain confidentiality of their account credentials and report any unauthorized access immediately.</p>
                      </div>
                    </div>
                  )}

                  {showFooterModal === 'TERMS' && (
                    <div className="space-y-4">
                      <h3 className="text-2xl font-black text-zinc-900">Terms of Service</h3>
                      <div className="text-zinc-600 leading-relaxed text-sm space-y-4">
                        <p>By using the VSBEC IT Academic Task Management System, users agree to use the platform only for academic and institutional purposes.</p>
                        <p>Students, faculty, and administrators must provide accurate information and use their assigned accounts responsibly.</p>
                        <p>Any misuse of the system, unauthorized access, manipulation of records, or disruption of platform operations may lead to institutional action.</p>
                        <p>The institution reserves the right to modify features, permissions, or policies whenever required for academic management.</p>
                      </div>
                    </div>
                  )}

                  {showFooterModal === 'SUPPORT' && (
                    <div className="space-y-4">
                      <h3 className="text-2xl font-black text-zinc-900">Support</h3>
                      <div className="text-zinc-600 leading-relaxed text-sm space-y-4">
                        <p>For technical assistance, login issues, task-related concerns, or system access problems, users may contact the concerned department administrator or system support team.</p>
                        <p>Support is provided during working hours through the institution’s official communication channels.</p>
                        <p>For unresolved issues, users may report directly to the IT Department responsible for maintaining the platform.</p>
                      </div>
                    </div>
                  )}

                  {showFooterModal === 'SOURCES' && (
                    <FeatureComparisonView />
                  )}

                  <Button onClick={() => setShowFooterModal(null)} className="w-full mt-8">Close</Button>
                </motion.div>
              </div>
            )}

            {selectedPosterModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center p-2"
                >
                  <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                    <a
                      href={selectedPosterModal}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors border border-white/20 flex items-center gap-1.5 text-xs font-bold px-4"
                    >
                      <ExternalLink size={16} /> Open in New Tab
                    </a>
                    <button
                      onClick={() => setSelectedPosterModal(null)}
                      className="p-2.5 bg-black/70 text-white rounded-full hover:bg-black/90 transition-colors border border-white/20"
                      title="Close Poster View"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  {selectedPosterModal.toLowerCase().includes('.pdf') ? (
                    <iframe
                      src={selectedPosterModal}
                      title="Event Poster PDF Viewer"
                      className="w-full h-[85vh] rounded-xl shadow-2xl border border-zinc-700 bg-white"
                    />
                  ) : (
                    <img
                      src={selectedPosterModal}
                      alt="Full Poster View"
                      className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-zinc-700"
                    />
                  )}
                </motion.div>
              </div>
            )}

            {sharedTaskModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative space-y-6 max-h-[95vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">
                        ✓
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900">Task Posted Successfully!</h3>
                        <p className="text-xs text-zinc-500 font-medium">Ready to share with students and advisors</p>
                      </div>
                    </div>
                    <button onClick={() => setSharedTaskModal(null)} className="p-1 hover:bg-zinc-100 rounded-full">
                      <X size={20} className="text-zinc-400" />
                    </button>
                  </div>

                  {sharedTaskModal.poster_url && (
                    <div className="rounded-xl overflow-hidden max-h-44 bg-zinc-950 border border-zinc-200 flex items-center justify-center">
                      <img src={sharedTaskModal.poster_url} alt="Poster" className="max-h-44 object-contain" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Task Title</p>
                    <p className="text-base font-bold text-zinc-900">{sharedTaskModal.title}</p>
                  </div>

                  <div className="space-y-2 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                    <label className="text-xs font-bold text-zinc-600 uppercase tracking-widest block">Direct Share Link</label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={`${window.location.origin}${window.location.pathname}?taskId=${sharedTaskModal.id}`}
                        className="text-xs font-mono bg-white"
                      />
                      <Button
                        type="button"
                        onClick={() => copyTaskShareLink(sharedTaskModal.id)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 font-bold"
                      >
                        <Copy size={16} /> Copy
                      </Button>
                    </div>
                  </div>

                  <Button onClick={() => setSharedTaskModal(null)} className="w-full">
                    Done
                  </Button>
                </motion.div>
              </div>
            )}

            {teamModalTask && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                        <Users size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-zinc-900">{teamModalTask.title} — Team Management</h3>
                        <p className="text-xs text-zinc-500 font-medium">Min {teamModalTask.min_team_size || 2} - Max {teamModalTask.max_team_size || 5} Members</p>
                      </div>
                    </div>
                    <button onClick={() => { setTeamModalTask(null); setCurrentTaskTeam(null); }} className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors">
                      <X size={20} className="text-zinc-400" />
                    </button>
                  </div>

                  {!currentTaskTeam ? (
                    /* Form a New Team View */
                    <div className="space-y-6">
                      <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl space-y-1">
                        <h4 className="font-bold text-sm text-indigo-900">Form a New Team</h4>
                        <p className="text-xs text-indigo-700">
                          Create a team for this task and invite your classmates. As team leader, you will be able to manage members and upload the final proof submission.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">Team Name <span className="text-red-500">*</span></label>
                        <Input
                          placeholder="e.g. Cyber Squad / Tech Titans"
                          value={newTeamName}
                          onChange={e => setNewTeamName(e.target.value)}
                          className="h-11 font-semibold"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-zinc-700 uppercase tracking-wider block">
                            Select Classmates to Invite (Optional)
                          </label>
                          <span className="text-xs text-zinc-400 font-mono">
                            Max {teamModalTask.max_team_size ? teamModalTask.max_team_size - 1 : 4} invites
                          </span>
                        </div>

                        {eligibleClassmates.length > 0 && (
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <Input
                              placeholder="Search classmate by Name or Reg No..."
                              value={classmateSearchTerm}
                              onChange={e => setClassmateSearchTerm(e.target.value)}
                              className="pl-9 h-9 text-xs"
                            />
                          </div>
                        )}

                        {(() => {
                          const filtered = eligibleClassmates.filter(s =>
                            !classmateSearchTerm ||
                            (s.full_name || '').toLowerCase().includes(classmateSearchTerm.toLowerCase()) ||
                            (s.register_number || '').toLowerCase().includes(classmateSearchTerm.toLowerCase()) ||
                            (s.username || '').toLowerCase().includes(classmateSearchTerm.toLowerCase())
                          );

                          if (filtered.length === 0) {
                            return (
                              <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-2xl text-center text-xs text-zinc-500">
                                {classmateSearchTerm ? 'No matching classmates found.' : 'No available classmates in your section for this task (all students might already be in teams).'}
                              </div>
                            );
                          }

                          return (
                            <div className="max-h-60 overflow-y-auto border border-zinc-200 rounded-2xl p-3 bg-zinc-50/50 space-y-2 custom-scrollbar">
                              {filtered.map(student => {
                                const isSelected = selectedClassmateIds.includes(student.id);
                                return (
                                  <label
                                    key={student.id}
                                    className={cn(
                                      "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border",
                                      isSelected ? "bg-indigo-50/90 border-indigo-300 shadow-sm" : "bg-white border-zinc-200 hover:border-indigo-300"
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={e => {
                                          if (e.target.checked) {
                                            if (selectedClassmateIds.length >= (teamModalTask.max_team_size ? teamModalTask.max_team_size - 1 : 4)) {
                                              return addToast(`Max team limit is ${teamModalTask.max_team_size || 5} including leader`, 'warning');
                                            }
                                            setSelectedClassmateIds(prev => [...prev, student.id]);
                                          } else {
                                            setSelectedClassmateIds(prev => prev.filter(id => id !== student.id));
                                          }
                                        }}
                                        className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                      />
                                      <div>
                                        <p className="text-sm font-extrabold text-zinc-900">{student.full_name}</p>
                                        <p className="text-xs text-indigo-600 font-mono font-semibold">Reg No: {student.register_number || student.username}</p>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <Badge variant="primary" className="bg-indigo-600 text-white text-[10px]">
                                        Selected
                                      </Badge>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={handleCreateSoloTeam}
                          disabled={isSubmittingTeam}
                          variant="secondary"
                          className="flex-1 h-12 border-zinc-300 font-bold rounded-2xl flex items-center justify-center gap-2 text-xs"
                        >
                          <User size={16} /> Complete as Solo (Individual)
                        </Button>
                        <Button
                          onClick={handleCreateTeam}
                          disabled={isSubmittingTeam || !newTeamName.trim()}
                          className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 text-xs"
                        >
                          {isSubmittingTeam ? <Loader2 size={18} className="animate-spin" /> : <Users size={16} />} Create Team & Send Invites
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Manage Existing Team View */
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-extrabold text-zinc-900">{currentTaskTeam.team_name}</h4>
                            <Badge variant={
                              currentTaskTeam.status === 'APPROVED' ? 'success' :
                                currentTaskTeam.status === 'REJECTED' ? 'danger' :
                                  currentTaskTeam.status === 'SUBMITTED' ? 'info' :
                                    currentTaskTeam.status === 'READY' ? 'warning' : 'neutral'
                            }>
                              {currentTaskTeam.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-zinc-500 font-medium mt-0.5">
                            Leader: <span className="font-bold text-zinc-800">{currentTaskTeam.leader_name}</span> ({currentTaskTeam.leader_regno})
                          </p>
                        </div>

                        {user?.id?.toString() === currentTaskTeam.leader_id?.toString() && currentTaskTeam.status !== 'APPROVED' && (
                          <Button
                            variant="ghost"
                            onClick={() => handleDeleteTeam(currentTaskTeam.id)}
                            className="text-red-500 hover:bg-red-50 hover:text-red-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-100"
                          >
                            <Trash2 size={14} /> Delete Team
                          </Button>
                        )}
                      </div>

                      {/* Team Members List */}
                      <div className="space-y-3">
                        <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                          Team Members ({(currentTaskTeam.members || []).filter(m => m.status === 'ACCEPTED').length} Accepted)
                        </h5>
                        <div className="space-y-2">
                          {(currentTaskTeam.members || []).map(m => {
                            const isLeader = m.student_id?.toString() === currentTaskTeam.leader_id?.toString();
                            return (
                              <div key={m.id} className="flex items-center justify-between p-3 bg-white border border-zinc-200 rounded-2xl">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                    isLeader ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"
                                  )}>
                                    {isLeader ? 'L' : 'M'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                      {m.full_name || m.username}
                                      {isLeader && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold">Leader</span>}
                                    </p>
                                    <p className="text-xs text-zinc-400 font-mono">{m.register_number}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <Badge variant={
                                    m.status === 'ACCEPTED' ? 'success' :
                                      m.status === 'PENDING' ? 'warning' :
                                        m.status === 'DECLINED' ? 'danger' : 'neutral'
                                  }>
                                    {m.status}
                                  </Badge>

                                  {user?.id?.toString() === currentTaskTeam.leader_id?.toString() && !isLeader && currentTaskTeam.status !== 'APPROVED' && (
                                    <button
                                      onClick={() => handleRemoveTeamMember(m.id)}
                                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Remove Member"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Pending Invitations */}
                      {currentTaskTeam.invitations && currentTaskTeam.invitations.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Pending Invitations</h5>
                          <div className="space-y-2">
                            {currentTaskTeam.invitations.map(inv => {
                              const isMe = String(inv.student_id) === String(user?.id);
                              return (
                                <div key={inv.id} className="flex items-center justify-between p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 font-semibold shadow-xs">
                                  <span>{isMe ? "You have been invited to join this team!" : `Waiting for ${inv.student_name} to respond...`}</span>
                                  {isMe ? (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleRespondInvitation(inv.id, 'ACCEPT')}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-sm border-none"
                                      >
                                        Accept
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRespondInvitation(inv.id, 'DECLINE')}
                                        className="bg-white hover:bg-zinc-100 text-zinc-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-zinc-200"
                                      >
                                        Decline
                                      </Button>
                                    </div>
                                  ) : (
                                    <Badge variant="warning">Pending</Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Invite Additional Classmates Section for Leader */}
                      {user?.id?.toString() === currentTaskTeam.leader_id?.toString() && currentTaskTeam.status !== 'APPROVED' && (
                        <div className="pt-4 border-t border-zinc-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                              Invite Additional Classmates
                            </h5>
                            <span className="text-xs text-zinc-400 font-mono">
                              Max {teamModalTask?.max_team_size || 5} members
                            </span>
                          </div>

                          {eligibleClassmates.length > 0 ? (
                            <div className="space-y-3">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                <Input
                                  placeholder="Search classmate by Name or Reg No..."
                                  value={classmateSearchTerm}
                                  onChange={e => setClassmateSearchTerm(e.target.value)}
                                  className="pl-9 h-9 text-xs"
                                />
                              </div>

                              {(() => {
                                const filtered = eligibleClassmates.filter(s =>
                                  !classmateSearchTerm ||
                                  (s.full_name || '').toLowerCase().includes(classmateSearchTerm.toLowerCase()) ||
                                  (s.register_number || '').toLowerCase().includes(classmateSearchTerm.toLowerCase()) ||
                                  (s.username || '').toLowerCase().includes(classmateSearchTerm.toLowerCase())
                                );

                                if (filtered.length === 0) {
                                  return (
                                    <p className="text-xs text-zinc-400 italic">No matching classmates found.</p>
                                  );
                                }

                                const currentTotal = ((currentTaskTeam.members || []).filter(m => ['ACCEPTED', 'PENDING'].includes(m.status)).length) + (currentTaskTeam.invitations || []).length;
                                const maxAllowed = teamModalTask?.max_team_size || 5;

                                return (
                                  <div className="max-h-40 overflow-y-auto border border-zinc-200 rounded-2xl p-2.5 bg-zinc-50/50 space-y-1.5 custom-scrollbar">
                                    {filtered.map(student => {
                                      const isSelected = selectedClassmateIds.includes(student.id);
                                      return (
                                        <label
                                          key={student.id}
                                          className={cn(
                                            "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all border text-xs",
                                            isSelected ? "bg-indigo-50/90 border-indigo-300 shadow-sm" : "bg-white border-zinc-200 hover:border-indigo-300"
                                          )}
                                        >
                                          <div className="flex items-center gap-2.5">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={e => {
                                                if (e.target.checked) {
                                                  if (currentTotal + selectedClassmateIds.length >= maxAllowed) {
                                                    return addToast(`Max team limit is ${maxAllowed} members`, 'warning');
                                                  }
                                                  setSelectedClassmateIds(prev => [...prev, student.id]);
                                                } else {
                                                  setSelectedClassmateIds(prev => prev.filter(id => id !== student.id));
                                                }
                                              }}
                                              className="w-3.5 h-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <div>
                                              <p className="font-bold text-zinc-900">{student.full_name}</p>
                                              <p className="text-[10px] text-zinc-400 font-mono">Reg No: {student.register_number || student.username}</p>
                                            </div>
                                          </div>
                                          {isSelected && (
                                            <Badge variant="primary" className="bg-indigo-600 text-white text-[10px]">
                                              Selected
                                            </Badge>
                                          )}
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })()}

                              {selectedClassmateIds.length > 0 && (
                                <Button
                                  onClick={handleInviteMoreClassmates}
                                  className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2"
                                >
                                  <UserPlus size={16} /> Send Invitation ({selectedClassmateIds.length})
                                </Button>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-400 italic">No available classmates in your section to invite.</p>
                          )}
                        </div>
                      )}

                      {/* Team Task Proof Submission / Status Section */}
                      <div className="pt-4 border-t border-zinc-200 space-y-4">
                        <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Team Submission Status</h5>

                        {currentTaskTeam.submission ? (
                          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-zinc-600">Submitted Proof</span>
                              <Badge variant={
                                currentTaskTeam.submission.status === 'APPROVED' ? 'success' :
                                  currentTaskTeam.submission.status === 'REJECTED' ? 'danger' : 'warning'
                              }>
                                {currentTaskTeam.submission.status}
                              </Badge>
                            </div>

                            {currentTaskTeam.submission.status === 'REJECTED' && (
                              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-xs text-red-700">
                                <p className="font-extrabold flex items-center gap-1.5 text-red-800">
                                  <XCircle size={15} /> Submission Rejected
                                </p>
                                <p className="font-semibold">
                                  <span className="font-bold text-red-900">Feedback / Reason:</span> {currentTaskTeam.submission.remarks || 'Please check task instructions and upload corrected proof screenshot below.'}
                                </p>
                              </div>
                            )}

                            {currentTaskTeam.submission.proof_url && (
                              <img
                                src={currentTaskTeam.submission.proof_url}
                                alt="Team Proof"
                                className="max-h-48 rounded-xl object-contain border border-zinc-200 cursor-pointer"
                                onClick={() => window.open(currentTaskTeam.submission?.proof_url, '_blank')}
                              />
                            )}

                            {currentTaskTeam.submission.remarks && currentTaskTeam.submission.status !== 'REJECTED' && (
                              <p className="text-xs text-zinc-600 bg-white p-3 rounded-xl border border-zinc-200">
                                <span className="font-bold text-zinc-800">Remarks:</span> {currentTaskTeam.submission.remarks}
                              </p>
                            )}
                          </div>
                        ) : null}

                        {user?.id?.toString() === currentTaskTeam.leader_id?.toString() && (!currentTaskTeam.submission || currentTaskTeam.submission.status === 'REJECTED') && (
                          /* Leader Proof Upload / Re-upload */
                          <div className="space-y-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                            <h6 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                              {currentTaskTeam.submission?.status === 'REJECTED' ? 'Resubmit Team Task Proof' : 'Submit Team Task Proof'}
                            </h6>
                            <div>
                              <label className="text-xs font-bold text-zinc-700 mb-1.5 block">Proof Screenshot <span className="text-red-500">*</span></label>
                              {teamProofFile ? (
                                <div className="bg-white p-3 rounded-xl border border-indigo-200 flex items-center justify-between gap-3 shadow-xs">
                                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-indigo-100 bg-zinc-50 shrink-0 flex items-center justify-center">
                                      <img
                                        src={URL.createObjectURL(teamProofFile)}
                                        alt="Team proof preview"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-zinc-800 truncate" title={teamProofFile.name}>{teamProofFile.name}</p>
                                      <p className="text-[10px] text-zinc-400 font-medium">{(teamProofFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTeamProofFile(null);
                                      const teamInput = document.getElementById('team-proof-file-input') as HTMLInputElement | null;
                                      if (teamInput) teamInput.value = '';
                                      addToast('Team proof screenshot removed', 'info');
                                    }}
                                    className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 shrink-0 ml-2 transition-colors"
                                    title="Delete screenshot before submission"
                                  >
                                    <Trash2 size={13} /> Delete / Change
                                  </button>
                                </div>
                              ) : (
                                <input
                                  type="file"
                                  id="team-proof-file-input"
                                  accept="image/*"
                                  onChange={e => setTeamProofFile(e.target.files?.[0] || null)}
                                  className="w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                                />
                              )}
                            </div>

                            <div>
                              <label className="text-xs font-bold text-zinc-700 mb-1.5 block">Remarks / Notes (Optional)</label>
                              <Textarea
                                placeholder="Add any additional notes for the reviewer..."
                                value={teamRemarks}
                                onChange={e => setTeamRemarks(e.target.value)}
                                className="min-h-[80px]"
                              />
                            </div>

                            <Button
                              onClick={handleSubmitTeamProof}
                              disabled={isSubmittingTeam || !teamProofFile}
                              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                            >
                              {isSubmittingTeam ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} {currentTaskTeam.submission?.status === 'REJECTED' ? 'Resubmit Proof' : 'Submit Task Proof'}
                            </Button>
                          </div>
                        )}

                        {user?.id?.toString() !== currentTaskTeam.leader_id?.toString() && !currentTaskTeam.submission && (
                          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-center text-xs text-zinc-500 font-medium">
                            Waiting for team leader (<span className="font-bold text-zinc-800">{currentTaskTeam.leader_name}</span>) to submit the team proof.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </main >
        {/* HOD Extend Deadline & Reopen Modal */}
        <AnimatePresence>
          {extendingTask && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                    <Clock className="text-indigo-600" size={20} /> Extend Deadline & Reopen
                  </h3>
                  <button onClick={() => setExtendingTask(null)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={18} />
                  </button>
                </div>

                <p className="text-xs text-zinc-600 font-medium">
                  Task: <span className="font-bold text-zinc-900">{extendingTask.title}</span>
                </p>

                <div>
                  <label className="text-xs font-bold text-zinc-700 block mb-1">New Extended Deadline Date & Time <span className="text-red-500">*</span></label>
                  <input
                    type="datetime-local"
                    value={extendedDeadline}
                    onChange={e => setExtendedDeadline(e.target.value)}
                    min={(() => { const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; })()}
                    className="w-full h-11 px-4 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold cursor-pointer [color-scheme:light]"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setExtendingTask(null)}>Cancel</Button>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 rounded-xl text-xs"
                    onClick={() => handleExtendDeadlineAndReopen(extendingTask.id, extendedDeadline)}
                    disabled={!extendedDeadline}
                  >
                    Save New Deadline & Reopen
                  </Button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Publish Notice Modal */}
          {showCreateNoticeModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-2xl border border-zinc-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                    <Megaphone className="text-indigo-600" size={20} /> Publish New Notice
                  </h3>
                  <button onClick={() => setShowCreateNoticeModal(false)} className="text-zinc-400 hover:text-zinc-600">
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCreateNotice} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">Notice Title <span className="text-red-500">*</span></label>
                    <Input
                      placeholder="e.g. Schedule for Mid-Term Exams"
                      value={noticeForm.title}
                      onChange={e => setNoticeForm(prev => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">Description / Content <span className="text-red-500">*</span></label>
                    <textarea
                      rows={4}
                      placeholder="Enter full notice announcement details here..."
                      value={noticeForm.description}
                      onChange={e => setNoticeForm(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full p-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-black text-sm bg-white text-zinc-800"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 block mb-1">Priority</label>
                      <Select
                        value={noticeForm.priority}
                        onChange={e => setNoticeForm(prev => ({ ...prev, priority: e.target.value }))}
                      >
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-700 block mb-1">Target Scope</label>
                      <Select
                        value={noticeForm.scope}
                        onChange={e => setNoticeForm(prev => ({ ...prev, scope: e.target.value }))}
                      >
                        {isAdmin && <option value="ALL">All (Global)</option>}
                        {(isAdmin || isHOD) && <option value="DEPARTMENT">Department</option>}
                        <option value="CLASS">Class</option>
                      </Select>
                    </div>
                  </div>

                  {noticeForm.scope === 'CLASS' && (() => {
                    const deptClasses = isHOD && user?.department_id
                      ? classes.filter(c => String(c.department_id) === String(user.department_id))
                      : (isAdvisor && user?.class_id ? classes.filter(c => String(c.id) === String(user.class_id)) : classes);
                    const availClasses = deptClasses.length > 0 ? deptClasses : classes;
                    const selectedIds = noticeForm.class_ids && noticeForm.class_ids.length > 0
                      ? noticeForm.class_ids
                      : (noticeForm.class_id ? [noticeForm.class_id] : []);
                    const allSelected = availClasses.length > 0 && availClasses.every(c => selectedIds.includes(String(c.id)));

                    return (
                      <div className="space-y-2 border border-zinc-200 p-3.5 rounded-xl bg-zinc-50/50">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                            <GraduationCap size={16} className="text-indigo-600" /> Target Classes <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-200 px-2 py-0.5 rounded-full">
                              {selectedIds.length} selected
                            </span>
                            {availClasses.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (allSelected) {
                                    setNoticeForm(prev => ({ ...prev, class_ids: [], class_id: '' }));
                                  } else {
                                    const allCids = availClasses.map(c => String(c.id));
                                    setNoticeForm(prev => ({ ...prev, class_ids: allCids, class_id: allCids[0] || '' }));
                                  }
                                }}
                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                              >
                                {allSelected ? 'Deselect All' : 'Select All'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1">
                          {availClasses.map(c => {
                            const isSelected = selectedIds.includes(String(c.id));
                            return (
                              <label
                                key={c.id}
                                className={cn(
                                  "flex items-center gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-all",
                                  isSelected
                                    ? "bg-indigo-50/80 border-indigo-300 text-indigo-900 shadow-sm"
                                    : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      const next = [...selectedIds, String(c.id)];
                                      setNoticeForm(prev => ({ ...prev, class_ids: next, class_id: next[0] || '' }));
                                    } else {
                                      const next = selectedIds.filter(id => id !== String(c.id));
                                      setNoticeForm(prev => ({ ...prev, class_ids: next, class_id: next[0] || '' }));
                                    }
                                  }}
                                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                                />
                                <span className="truncate">{c.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="text-xs font-bold text-zinc-700 block mb-1">Attachment File (Optional PDF / Image)</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={e => setNoticeFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-zinc-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                    <Button variant="ghost" type="button" onClick={() => setShowCreateNoticeModal(false)}>Cancel</Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" disabled={isPublishingNotice}>
                      {isPublishingNotice ? 'Publishing...' : 'Publish Notice'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {renderAssignTargetModal()}
          {renderHistoryDetailsModal()}
        </AnimatePresence>
      </div>
    </FooterContext.Provider>


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

function StatCard({ title, value, icon, color, emoji }: { title: string; value: number | string; icon?: React.ReactNode; color?: string; emoji?: string }) {
  const key = color?.replace('bg-', '')?.replace('-500', '')?.replace('-600', '') || 'blue';
  const colorMap: Record<string, { bg: string; border: string }> = {
    blue: { bg: 'bg-blue-600', border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-600', border: 'border-emerald-100' },
    indigo: { bg: 'bg-indigo-600', border: 'border-indigo-100' },
    orange: { bg: 'bg-amber-500', border: 'border-amber-100' },
    amber: { bg: 'bg-amber-500', border: 'border-amber-100' },
    purple: { bg: 'bg-purple-600', border: 'border-purple-100' },
  };

  const scheme = colorMap[key] || colorMap.blue;

  return (
    <Card className={cn("relative overflow-hidden p-5 border shadow-sm hover:shadow-md transition-all bg-white rounded-2xl", scheme.border)}>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider truncate">{title}</p>
          <p className="text-3xl font-black text-zinc-900 tracking-tight">{value}</p>
        </div>
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0", scheme.bg)}>
          {icon ? (React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { size: 22 }) : icon) : (emoji || <LayoutDashboard size={22} />)}
        </div>
      </div>
    </Card>
  );
}
