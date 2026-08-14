/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  RotateCcw,
  AlertTriangle,
  Loader2,
  CalendarRange,
  Share2,
  Copy,
  Maximize2,
  FileImage,
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
  Percent,
  Award,
  Activity,
  Check,
  Github,
  BarChart3,
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
  MessageSquare,
  Pin,
  MessageCircle,
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
    ghost: 'hover:bg-zinc-100 text-zinc-600 focus:ring-zinc-150',
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

const FooterContext = React.createContext<((type: 'PRIVACY' | 'TERMS' | 'SUPPORT') => void) | null>(null);

const Footer = ({ onShowModal }: { onShowModal: (type: 'PRIVACY' | 'TERMS' | 'SUPPORT') => void }) => (
  <footer className="mt-8 pt-4 pb-4 border-t border-zinc-200/80 shrink-0 w-full bg-white/60 backdrop-blur-md px-4 md:px-8">
    <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-3 text-xs min-w-0">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2.5 shrink-0 min-w-0">
        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-zinc-200 shadow-sm">
          <img src="/logo.png" alt="VSBEC Logo" className="w-full h-full object-cover" />
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

const EmptyState = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-zinc-200 rounded-3xl bg-zinc-50/50">
    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-zinc-400 mb-4 shadow-sm">
      <Icon size={32} />
    </div>
    <h3 className="text-xl font-bold text-zinc-900 mb-2">{title}</h3>
    <p className="text-zinc-500 max-w-sm">{description}</p>
  </div>
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

  const [reminderSettings, setReminderSettings] = useState({
    task_reminders: true,
    event_reminders: true,
    notice_reminders: true,
    
  });

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/reminders/settings`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setReminderSettings(data); })
      .catch(err => console.error('Failed to load reminder settings:', err));
  }, [token]);

  const handleUpdateReminderSettings = async (newSettings: typeof reminderSettings) => {
    setReminderSettings(newSettings);
    try {
      const res = await fetch(`${API_URL}/api/reminders/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        addToast('Reminder preferences updated', 'success');
      } else {
        addToast('Failed to save reminder preferences', 'error');
      }
    } catch (e) {
      addToast('Error saving reminder preferences', 'error');
    }
  };

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
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [groupChatIdInput, setGroupChatIdInput] = useState('');
  const [savingGroupChat, setSavingGroupChat] = useState(false);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const fetchTelegramStatus = async () => {
    if (!token) return;
    try {
      setLoadingTelegram(true);
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
    } finally {
      setLoadingTelegram(false);
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

        {/* Smart Reminder & Notification Settings */}
        <Card className="p-6 bg-white border-zinc-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-100">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Bell size={18} className="text-indigo-600" /> Smart Reminders & Notification Preferences
              </h3>
              <p className="text-xs text-zinc-500">Control automated alerts and system notification preferences</p>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { key: 'task_reminders', title: 'Task Deadline Reminders', desc: 'Get automated in-app alerts 24 hours before deadlines and when tasks are overdue' },
              { key: 'notice_reminders', title: 'Digital Notice Board Alerts', desc: 'Receive notifications when new announcements or urgent notices are published' },
              { key: 'event_reminders', title: 'Event & Calendar Notifications', desc: 'Receive reminders for scheduled academic department events' }
            ].map(({ key, title, desc }) => (
              <label key={key} className="flex items-start justify-between gap-4 p-3 hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer border border-zinc-100">
                <div>
                  <p className="text-sm font-bold text-zinc-800">{title}</p>
                  <p className="text-xs text-zinc-500">{desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={(reminderSettings as any)[key]}
                  onChange={e => handleUpdateReminderSettings({ ...reminderSettings, [key]: e.target.checked })}
                  className="w-5 h-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5"
                />
              </label>
            ))}
          </div>
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

          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-900 transition-colors">
            <XCircle size={24} />
          </button>
        </div>

        {/* Section Pill Selectors */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-3 custom-scrollbar shrink-0 border-b border-zinc-100">
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
                    ? "bg-black text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                )}
              >
                <SIcon size={13} />
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
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">College Email</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">{acad.email || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Gender</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">{acad.gender || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Mobile Number</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">{profile.personal?.mobile_number || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Date of Birth</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">{profile.personal?.date_of_birth || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Semester</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">{profile.personal?.semester ? `Semester ${profile.personal.semester}` : 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">CGPA</p>
                      <p className="text-xs font-bold text-emerald-600 truncate">{profile.personal?.cgpa || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Current Arrears</p>
                      <p className="text-xs font-bold text-rose-600 truncate">{profile.personal?.current_arrears ?? 0}</p>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">History of Arrears</p>
                      <p className="text-xs font-bold text-zinc-900 truncate">{profile.personal?.history_of_arrears ?? 0}</p>
                    </div>
                  </div>

                  {profile.personal?.about_me && (
                    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">About Student</p>
                      <p className="text-xs text-zinc-700 leading-relaxed">{profile.personal.about_me}</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'skills' && (
                <div className="flex flex-wrap gap-2">
                  {(profile.skills || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4">No skills recorded.</p>
                  ) : (
                    profile.skills.map((sk: any) => (
                      <div key={sk.id} className="px-3 py-1.5 bg-zinc-100 rounded-xl border border-zinc-200 text-xs font-semibold flex items-center gap-2">
                        <span>{sk.skill_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-bold uppercase">{sk.level}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'projects' && (
                <div className="space-y-3">
                  {(profile.projects || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center">No projects recorded.</p>
                  ) : (
                    profile.projects.map((p: any) => (
                      <div key={p.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1">
                        <h4 className="text-sm font-bold text-zinc-900">{p.project_name}</h4>
                        {p.tech_stack && <p className="text-xs text-indigo-600 font-semibold">{p.tech_stack}</p>}
                        {p.description && <p className="text-xs text-zinc-600">{p.description}</p>}
                        <div className="flex gap-3 pt-1 text-xs">
                          {p.github_url && <a href={p.github_url} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline flex items-center gap-1"><Github size={12} /> GitHub</a>}
                          {p.live_demo_url && <a href={p.live_demo_url} target="_blank" rel="noreferrer" className="text-emerald-600 font-bold hover:underline flex items-center gap-1"><Globe size={12} /> Live Demo</a>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'internships' && (
                <div className="space-y-3">
                  {(profile.internships || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center">No internships recorded.</p>
                  ) : (
                    profile.internships.map((intern: any) => (
                      <div key={intern.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                        <h4 className="text-sm font-bold text-zinc-900">{intern.company}</h4>
                        <p className="text-xs font-semibold text-zinc-600">{intern.role} • {intern.duration} ({intern.mode})</p>
                        {intern.certificate_url && (
                          <a href={intern.certificate_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 mt-1">
                            <ExternalLink size={12} /> View Certificate
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'certifications' && (
                <div className="space-y-3">
                  {(profile.certifications || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center">No certifications recorded.</p>
                  ) : (
                    profile.certifications.map((c: any) => (
                      <div key={c.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                        <h4 className="text-sm font-bold text-zinc-900">{c.certificate_name}</h4>
                        <p className="text-xs font-semibold text-zinc-600">{c.provider} {c.issue_date ? `• Issued ${c.issue_date}` : ''}</p>
                        {c.certificate_url && (
                          <a href={c.certificate_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 mt-1">
                            <ExternalLink size={12} /> View Credential
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'coding' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.coding_profiles?.github && <a href={profile.coding_profiles.github} target="_blank" rel="noreferrer" className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-bold text-blue-600 flex items-center gap-2"><Github size={16} /> GitHub Profile</a>}
                  {profile.coding_profiles?.leetcode && <a href={profile.coding_profiles.leetcode} target="_blank" rel="noreferrer" className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-bold text-amber-600 flex items-center gap-2"><Globe size={16} /> LeetCode Profile</a>}
                  {profile.coding_profiles?.hackerrank && <a href={profile.coding_profiles.hackerrank} target="_blank" rel="noreferrer" className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-bold text-emerald-600 flex items-center gap-2"><Globe size={16} /> HackerRank Profile</a>}
                  {profile.coding_profiles?.codechef && <a href={profile.coding_profiles.codechef} target="_blank" rel="noreferrer" className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-bold text-purple-600 flex items-center gap-2"><Globe size={16} /> CodeChef Profile</a>}
                  {profile.coding_profiles?.geeksforgeeks && <a href={profile.coding_profiles.geeksforgeeks} target="_blank" rel="noreferrer" className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-bold text-green-600 flex items-center gap-2"><Globe size={16} /> GeeksforGeeks Profile</a>}
                  {profile.coding_profiles?.linkedin && <a href={profile.coding_profiles.linkedin} target="_blank" rel="noreferrer" className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-bold text-blue-700 flex items-center gap-2"><Linkedin size={16} /> LinkedIn Profile</a>}
                  {profile.coding_profiles?.portfolio && <a href={profile.coding_profiles.portfolio} target="_blank" rel="noreferrer" className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-bold text-indigo-600 flex items-center gap-2"><Globe size={16} /> Portfolio Website</a>}
                </div>
              )}

              {activeSection === 'resume' && (
                <div>
                  {profile.resume ? (
                    <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-zinc-900">{profile.resume.file_name || 'Resume.pdf'}</p>
                        <p className="text-[10px] text-zinc-400">Last updated: {new Date(profile.resume.last_updated).toLocaleString()}</p>
                      </div>
                      <a href={profile.resume.resume_url} target="_blank" rel="noreferrer" className="px-4 py-2 bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1">
                        <ExternalLink size={14} /> Open Resume PDF
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 py-4 text-center">No resume uploaded.</p>
                  )}
                </div>
              )}

              {activeSection === 'achievements' && (
                <div className="space-y-3">
                  {(profile.achievements || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4 text-center">No achievements recorded.</p>
                  ) : (
                    profile.achievements.map((ach: any) => (
                      <div key={ach.id} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-zinc-900">{ach.title}</h4>
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold uppercase">{ach.category}</span>
                        </div>
                        {ach.event_date && <p className="text-[11px] text-zinc-400">{ach.event_date}</p>}
                        {ach.description && <p className="text-xs text-zinc-600 mt-1">{ach.description}</p>}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'languages' && (
                <div className="flex flex-wrap gap-2">
                  {(profile.languages || []).length === 0 ? (
                    <p className="text-xs text-zinc-400 py-4">No languages recorded.</p>
                  ) : (
                    profile.languages.map((l: any) => (
                      <div key={l.id} className="px-3 py-1.5 bg-zinc-100 rounded-xl border border-zinc-200 text-xs font-semibold flex items-center gap-2">
                        <span>{l.language}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-bold uppercase">{l.proficiency}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'career' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Preferred Role</p>
                    <p className="text-xs font-bold text-zinc-900">{profile.career_preferences?.preferred_role || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Preferred Domain</p>
                    <p className="text-xs font-bold text-zinc-900">{profile.career_preferences?.preferred_domain || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Preferred Location</p>
                    <p className="text-xs font-bold text-zinc-900">{profile.career_preferences?.preferred_location || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Work Mode & Relocation</p>
                    <p className="text-xs font-bold text-zinc-900">{profile.career_preferences?.work_mode || 'Hybrid'} • {profile.career_preferences?.willing_to_relocate ? 'Willing to Relocate' : 'No Relocation'}</p>
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
  const [expandedClass, setExpandedClass] = useState<number | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<number | null>(null);

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
  const [codingPlatformTab, setCodingPlatformTab] = useState<'COMBINED' | 'LEETCODE' | 'GITHUB'>('LEETCODE');
  const [myGithubProgress, setMyGithubProgress] = useState<any>(null);
  const [githubStats, setGithubStats] = useState<any>(null);
  const [githubProgressList, setGithubProgressList] = useState<any[]>([]);
  const [githubTargets, setGithubTargets] = useState<any[]>([]);
  const [combinedProgressList, setCombinedProgressList] = useState<any[]>([]);
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [showAssignGithubTargetModal, setShowAssignGithubTargetModal] = useState(false);
  const [githubActiveTab, setGithubActiveTab] = useState<'MONITOR' | 'TARGETS'>('MONITOR');
  const [assignGithubTargetForm, setAssignGithubTargetForm] = useState({
    dailyTarget: '1',
    weeklyTarget: '7',
    startDate: new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 5.5 * 60 * 60 * 1000 + 6 * 86400000).toISOString().split('T')[0],
    scopeType: 'CLASS',
    targetValue: ''
  });

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
        case 'target':
          valA = leetcodeViewType === 'DAILY' ? a.dailyTarget : a.weeklyTarget;
          valB = leetcodeViewType === 'DAILY' ? b.dailyTarget : b.weeklyTarget;
          break;
        case 'solved':
          valA = leetcodeViewType === 'DAILY' ? a.newReposToday : a.newReposThisWeek;
          valB = leetcodeViewType === 'DAILY' ? b.newReposToday : b.newReposThisWeek;
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
  }, [githubProgressList, leetcodeSortColumn, leetcodeSortOrder, leetcodeViewType]);

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
    class_ids: [] as (string | number)[],
    submission_type: 'INDIVIDUAL',
    min_team_size: 2,
    max_team_size: 5
  });
  const [uploading, setUploading] = useState<number | null>(null);
  const [hodCreationRole, setHodCreationRole] = useState<'CLASS_ADVISOR' | 'STUDENT'>('CLASS_ADVISOR');
  const [showTaskPreview, setShowTaskPreview] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALL'>('PENDING');
  const [verificationDeptFilter, setVerificationDeptFilter] = useState('');
  const [verificationYearFilter, setVerificationYearFilter] = useState('');
  const [verificationClassFilter, setVerificationClassFilter] = useState('');
  const [verificationTaskFilter, setVerificationTaskFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState<'ALL' | 'COORDINATORS'>('ALL');
  const [showFooterModal, setShowFooterModal] = useState<'PRIVACY' | 'TERMS' | 'SUPPORT' | null>(null);
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
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isDraggingScreenshot, setIsDraggingScreenshot] = useState<number | null>(null);
  const [notParticipating, setNotParticipating] = useState<Record<number, boolean>>({});
  const [notParticipatingReason, setNotParticipatingReason] = useState<Record<number, string>>({});
  const [isEditingOptOut, setIsEditingOptOut] = useState<Record<number, boolean>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('');
  const [userYearFilter, setUserYearFilter] = useState('');
  const [userClassFilter, setUserClassFilter] = useState('');

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
  const [selectedBatchSubmissions, setSelectedBatchSubmissions] = useState<string[]>([]);
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
      const endpoint = leetcodeViewType === 'DAILY' ? 'daily' : 'weekly';
      const deptParam = selectedLeetcodeDeptId !== 'ALL' ? `&departmentId=${selectedLeetcodeDeptId}` : '';
      const yearParam = selectedLeetcodeYear !== 'ALL' ? `&year=${selectedLeetcodeYear}` : '';
      const classParam = selectedLeetcodeClassId !== 'ALL' ? `&classId=${selectedLeetcodeClassId}` : '';
      const searchParam = leetcodeSearch ? `&search=${encodeURIComponent(leetcodeSearch)}` : '';
      const res = await fetch(`${API_URL}/api/github/progress/${endpoint}?date=${leetcodeDate}&status=${leetcodeStatusFilter}${searchParam}${deptParam}${yearParam}${classParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setGithubProgressList(await res.json());
    } catch (err) {
      console.error('Error fetching GitHub progress:', err);
    }
  };

  const fetchGithubTargets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/github/targets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setGithubTargets(await res.json());
    } catch (err) {
      console.error('Error fetching GitHub targets:', err);
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

  const handleDeleteGithubTarget = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this GitHub target?')) return;
    try {
      const res = await fetch(`${API_URL}/api/github/targets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('GitHub target deleted successfully', 'success');
        fetchGithubTargets();
        fetchGithubProgress();
        fetchGithubStats();
      } else {
        const data = await res.json();
        addToast(data.error || 'Failed to delete GitHub target', 'error');
      }
    } catch (err) {
      addToast('Error deleting GitHub target', 'error');
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
          fetchGithubTargets(),
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
          fetchGithubTargets(),
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

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    let role = 'STUDENT';
    if (user?.role === 'SUPREME_ADMIN') {
      role = 'HOD';
    } else if (user?.role === 'HOD') {
      role = studentFilter === 'STUDENT' ? 'STUDENT' : (studentFilter === 'CLASS_ADVISOR' ? 'CLASS_ADVISOR' : hodCreationRole);
    } else if (user?.role === 'CLASS_ADVISOR') {
      role = 'STUDENT';
    }

    let url = `${API_URL}/api/users`;
    let bodyData: any = {};

    if (role === 'STUDENT') {
      url = `${API_URL}/api/users/students`;
      bodyData = {
        fullName: newUser.full_name,
        registrationNumber: newUser.username,
        password: newUser.password,
        classId: newUser.class_id || (user?.role === 'CLASS_ADVISOR' ? user.class_id : null)
      };
    } else if (role === 'CLASS_ADVISOR') {
      url = `${API_URL}/api/users/advisors`;
      bodyData = {
        fullName: newUser.full_name,
        username: newUser.username,
        password: newUser.password,
        classId: newUser.class_id || null,
        is_year_coordinator: newUser.is_year_coordinator,
        year_scope: newUser.year_scope ? parseInt(newUser.year_scope) : null
      };
    } else {
      // HOD or generic
      bodyData = {
        ...newUser,
        role,
        department_id: newUser.department_id || null,
        class_id: newUser.class_id || null,
        register_number: newUser.register_number || null,
        email: newUser.email || null,
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(bodyData)
    });
    if (res.ok) {
      setNewUser({ username: '', password: '', full_name: '', department_id: '', class_id: '', email: '', register_number: '', is_year_coordinator: false, year_scope: '' });
      fetchInitialData();
      addToast(`${role === 'HOD' ? 'HOD' : role === 'CLASS_ADVISOR' ? 'Advisor' : 'Student'} account created successfully!`, 'success');
    } else {
      const data = await res.json();
      addToast(data.error || 'Failed to create user', 'error');
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

  const unlockSubmission = async (id: number) => {
    const res = await fetch(`${API_URL}/api/submissions/${id}/unlock`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      addToast('Submission unlocked for student resubmission', 'success');
      fetchSubmissions();
    } else {
      const data = await res.json();
      addToast(data.error || 'Failed to unlock submission', 'error');
    }
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

    // Build "III YEAR IT SECTION A" style string from a Class object
    const buildClassInfo = (cls: Class): string => {
      const yr = cls.year ? toRomanYear(Number(cls.year)) : '';
      const dept = getDeptAbbr(cls.department_name || user?.department_name || 'IT');
      const sec = getSection(cls.name);
      return [yr, dept, sec ? `SECTION ${sec}` : ''].filter(Boolean).join(' ');
    };

    // Build a worksheet that starts with the VSB college header block
    const buildSheetWithHeader = (cols: string[], dataRows: any[], line5: string): XLSX.WorkSheet => {
      const numCols = cols.length;
      const deptFull = (user?.department_name || 'INFORMATION TECHNOLOGY').toUpperCase();

      const aoaRows: any[][] = [
        ['VSB ENGINEERING COLLEGE, KARUR', ...Array(numCols - 1).fill(null)],
        ['(AN AUTONOMOUS INSTITUTION)', ...Array(numCols - 1).fill(null)],
        [`DEPARTMENT OF ${deptFull}`, ...Array(numCols - 1).fill(null)],
        [`ACADEMIC YEAR ${ACADEMIC_YEAR}`, ...Array(numCols - 1).fill(null)],
        [line5, ...Array(numCols - 1).fill(null)],
        Array(numCols).fill(null),           // blank separator
        [...cols],                           // column header row (index 6)
        ...dataRows.map(r => cols.map(c => r[c] ?? '')),
        Array(numCols).fill(null),           // blank separator
        ['Developed and maintained by Tharunkumar K (https://tharunkumark4743.netlify.app/)', ...Array(numCols - 1).fill(null)],
        ['Department of Information Technology, VSB Engineering College', ...Array(numCols - 1).fill(null)]
      ];

      const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(aoaRows);
      // Merge the 5 info rows across all columns
      ws['!merges'] = [0, 1, 2, 3, 4].map(r => ({ s: { r, c: 0 }, e: { r, c: numCols - 1 } }));
      const lastRow = aoaRows.length - 1;
      ws['!merges'].push({ s: { r: lastRow - 1, c: 0 }, e: { r: lastRow - 1, c: numCols - 1 } });
      ws['!merges'].push({ s: { r: lastRow, c: 0 }, e: { r: lastRow, c: numCols - 1 } });
      return ws;
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
    const sheet1Cols = [
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

    const ws1 = buildSheetWithHeader(sheet1Cols, detailedRows, sheet1Line5);
    const ws2 = buildSheetWithHeader(
      sheet2Cols,
      summaryRows.length ? summaryRows : [{ 'Task Name': 'No summary data.' }],
      sheet2Line5
    );
    const ws3 = buildSheetWithHeader(
      sheet3Cols,
      teamRows.length ? teamRows : [{ 'S.No': 1, 'Team Name': 'No team data available for selection' }],
      sheet3Line5
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Detailed Report');
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');
    XLSX.utils.book_append_sheet(wb, ws3, 'Team Wise Report');

    const dateTag = new Date().toISOString().split('T')[0];
    const roleTag = isAdminRole ? 'SuperAdmin' : isHODRole ? 'HOD' : isYearCoordRole ? `Year${user?.year_scope}_Coord` : 'Class';
    const statusTag = selectedStatus === 'ALL' ? 'All' : selectedStatus.charAt(0) + selectedStatus.slice(1).toLowerCase();
    XLSX.writeFile(wb, `${roleTag}_Report_${statusTag}_${dateTag}.xlsx`);
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
            <div className="w-24 h-24 rounded-full overflow-hidden mb-6 shadow-2xl border-4 border-white ring-2 ring-zinc-200">
              <img src="/logo.png" alt="VSBEC Logo" className="w-full h-full object-cover" />
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
      const studentSubs = submissions.filter(sub => sub.user_id?.toString() === s.id?.toString());
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
              <span className="text-[9px] font-semibold text-indigo-500">Interested or Skipped</span>
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
      const res = await fetch(`${API_URL}/api/github/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        addToast(`GitHub sync finished: Synced ${data.synced} profiles, ${data.failed} failed.`, 'success');
        fetchGithubProgress();
        fetchGithubStats();
        fetchCombinedProgress();
      } else {
        addToast('Failed to sync GitHub progress', 'error');
      }
    } catch (err) {
      addToast('Network error syncing GitHub progress', 'error');
    } finally {
      setSyncingGithub(false);
    }
  };

  const handleCreateGithubTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingTarget) return;
    setSubmittingTarget(true);
    try {
      const res = await fetch(`${API_URL}/api/github/targets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(assignGithubTargetForm)
      });
      if (res.ok) {
        addToast('GitHub target created successfully', 'success');
        setShowAssignGithubTargetModal(false);
        fetchGithubTargets();
        fetchGithubProgress();
        fetchGithubStats();
        fetchCombinedProgress();
      } else {
        const data = await res.json();
        addToast(data.error || 'Failed to create GitHub target', 'error');
      }
    } catch (err) {
      addToast('Network error creating GitHub target', 'error');
    } finally {
      setSubmittingTarget(false);
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

  const handleDeleteTarget = async (id: string) => {
    if (!confirm('Are you sure you want to delete this target?')) return;
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
      addToast('Network error deleting LeetCode target', 'error');
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
      const res = await fetch(`${API_URL}/api/leetcode/progress/student/${student.studentId}`, {
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
    const data = studentHistoryData?.daily || [];
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
                fill="#f97316"
                rx={1}
              />
              {d.target > 0 && (
                <circle cx={x + barWidth / 2} cy={targetY} r={2} fill="#ef4444" />
              )}
              <title>{`Date: ${d.date}\nSolved: ${d.actual}\nTarget: ${d.target}`}</title>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderWeeklyChart = () => {
    const data = studentHistoryData?.weekly || [];
    if (data.length === 0) return <div className="text-center text-xs py-10 text-zinc-400 font-bold">No progress data logged yet</div>;
    const maxVal = Math.max(...data.map((d: any) => Math.max(d.actual, d.target)), 10);
    const height = 120;
    const width = 500;
    const paddingLeft = 30;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 20;
    const chartHeight = height - paddingTop - paddingBottom;
    const chartWidth = width - paddingLeft - paddingRight;

    const points = data.map((d: any, i: number) => {
      const x = paddingLeft + (i * (chartWidth / Math.max(1, data.length - 1)));
      const y = height - paddingBottom - (d.actual / maxVal) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    const areaPoints = `${paddingLeft},${height - paddingBottom} ${points} ${paddingLeft + chartWidth},${height - paddingBottom}`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40">
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
              <line x1={x} y1={targetY} x2={x + 10} y2={targetY} stroke="#dc2626" strokeWidth={1} strokeDasharray="2,2" />
              <text x={x} y={height - 5} textAnchor="middle" className="text-[8px] font-semibold text-zinc-400">{d.week}</text>
              <title>{`Week: ${d.start} to ${d.end}\nSolved: ${d.actual}\nTarget: ${d.target}`}</title>
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
                  <span className="text-sm font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5"><Github size={16} className="text-zinc-900" /> GitHub Daily</span>
                  {myGithubProgress?.dailyStatus === 'COMPLETED' ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">MET</span>
                  ) : myGithubProgress?.dailyStatus === 'DATA_UNAVAILABLE' ? (
                    <span className="bg-zinc-100 text-zinc-800 text-[10px] font-bold px-2 py-0.5 rounded-full">NO SYNC</span>
                  ) : (
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">PENDING</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl font-black text-zinc-900">{myGithubProgress?.newReposToday ?? 0}</span>
                  <span className="text-zinc-400 font-bold">/ {myGithubProgress?.dailyTarget ?? 0} repos today</span>
                </div>
              </div>
              <div>
                <div className="w-full bg-zinc-100 rounded-full h-2 mb-2">
                  <div
                    className="bg-zinc-900 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, myGithubProgress?.completionDailyPct ?? 0)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 font-bold">{myGithubProgress?.completionDailyPct ?? 0}% completed today</span>
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
              <>
                <Button
                  onClick={handleSyncGithubProgress}
                  disabled={syncingGithub}
                  variant="outline"
                  className="border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold px-3 py-1.5 text-xs rounded-xl flex items-center gap-1.5 bg-white cursor-pointer"
                >
                  {syncingGithub ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  <span>Sync GitHub</span>
                </Button>

                <Button
                  onClick={() => {
                    setAssignGithubTargetForm(prev => ({
                      ...prev,
                      targetValue: classes[0]?.id || ''
                    }));
                    setShowAssignGithubTargetModal(true);
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold px-3 py-1.5 text-xs rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus size={14} /> GitHub Target
                </Button>
              </>
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
                    <option value="NOT_COMPLETED">Pending / Incomplete</option>
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
                          Register No {leetcodeSortColumn === 'registerNumber' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortHeader('fullName')} className="px-6 py-4 cursor-pointer select-none">
                          Student Name {leetcodeSortColumn === 'fullName' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortHeader('className')} className="px-6 py-4 cursor-pointer select-none">
                          Section / Class {leetcodeSortColumn === 'className' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th className="px-6 py-4">LeetCode Profile</th>
                        <th className="px-6 py-4 text-center">
                          {leetcodeViewType === 'DAILY' ? 'Today / Target' : 'This Week / Target'}
                        </th>
                        {leetcodeViewType === 'DAILY' && (
                          <th className="px-6 py-4 text-center">Yesterday</th>
                        )}
                        <th onClick={() => handleSortHeader('status')} className="px-6 py-4 text-center cursor-pointer select-none">
                          Status {leetcodeSortColumn === 'status' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
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
                                  status === 'COMPLETED' ? "bg-emerald-100 text-emerald-800" :
                                    status === 'DATA_UNAVAILABLE' ? "bg-zinc-100 text-zinc-800" :
                                      status === 'NO_TARGET' ? "bg-zinc-50 text-zinc-400" : "bg-orange-100 text-orange-800"
                                )}>
                                  {(status || 'PENDING').replace('_', ' ')}
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
              <StatCard title="Target Met Today" value={githubStats?.metDaily || 0} color="emerald" icon={<Target />} />
              <StatCard title="Active Committers" value={githubStats?.inProgressDaily || 0} color="blue" icon={<Terminal />} />
              <StatCard title="Completion Rate" value={`${githubStats?.completionDailyRate || 0}%`} color="indigo" icon={<TrendingUp />} />
            </div>

            {/* Row 1: Sub-navigation Tabs & View Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              {/* Sub-tab: Monitor vs Targets */}
              <div className="flex bg-zinc-100/80 rounded-xl p-1 border border-zinc-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setGithubActiveTab('MONITOR')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    githubActiveTab === 'MONITOR' ? "bg-white shadow-xs text-indigo-600 font-extrabold" : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  Live Progress Monitor
                </button>
                <button
                  type="button"
                  onClick={() => setGithubActiveTab('TARGETS')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    githubActiveTab === 'TARGETS' ? "bg-white shadow-xs text-indigo-600 font-extrabold" : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  Target Configurations ({githubTargets.length})
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
                    <option value="NOT_COMPLETED">Pending / Incomplete</option>
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

            {/* GitHub Live Progress Monitor Table */}
            {githubActiveTab === 'MONITOR' ? (
              <Card className="p-0 overflow-hidden border border-zinc-200 bg-white shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        <th onClick={() => handleSortHeader('registerNumber')} className="px-6 py-4 cursor-pointer select-none">
                          Register No {leetcodeSortColumn === 'registerNumber' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortHeader('fullName')} className="px-6 py-4 cursor-pointer select-none">
                          Student Name {leetcodeSortColumn === 'fullName' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th onClick={() => handleSortHeader('className')} className="px-6 py-4 cursor-pointer select-none">
                          Section / Class {leetcodeSortColumn === 'className' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>
                        <th className="px-6 py-4">GitHub Profile</th>
                        <th className="px-6 py-4 text-center">Active Repositories / Target</th>
                        <th onClick={() => handleSortHeader('status')} className="px-6 py-4 text-center cursor-pointer select-none">
                          Status {leetcodeSortColumn === 'status' ? (leetcodeSortOrder === 'asc' ? '↑' : '↓') : ''}
                        </th>

                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 text-sm">
                      {sortedGithubProgressList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 font-semibold">
                            No GitHub student records match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        sortedGithubProgressList.map((row) => {
                          const isDaily = leetcodeViewType === 'DAILY';
                          const solved = isDaily ? (row.dailyRepos ?? row.reposToday ?? 0) : (row.weeklyRepos ?? row.reposThisWeek ?? 0);
                          const target = isDaily ? (row.dailyTarget ?? 0) : (row.weeklyTarget ?? 0);
                          const status = (isDaily ? row.dailyStatus : row.weeklyStatus) || 'PENDING';
                          const profileUrl = row.githubUsername
                            ? (row.githubUsername.startsWith('http') ? row.githubUsername : `https://github.com/${row.githubUsername}`)
                            : null;

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
                              <td className="px-6 py-4 text-center font-semibold">
                                <span className="text-zinc-900 font-bold">{solved}</span> / <span className="text-zinc-400">{target}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={cn(
                                  "inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full",
                                  status === 'COMPLETED' ? "bg-emerald-100 text-emerald-800" :
                                    status === 'DATA_UNAVAILABLE' ? "bg-zinc-100 text-zinc-800" :
                                      status === 'NO_TARGET' ? "bg-zinc-50 text-zinc-400" : "bg-blue-100 text-blue-800"
                                )}>
                                  {(status || 'PENDING').replace('_', ' ')}
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
              /* GitHub Targets Configuration Table */
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
                      {githubTargets.length === 0 ? (
                        <tr>
                          <td colSpan={user?.role !== 'STUDENT' ? 7 : 6} className="px-6 py-12 text-center text-zinc-400 font-semibold">
                            No active GitHub target configurations found. Click "GitHub Target" to add one.
                          </td>
                        </tr>
                      ) : (
                        githubTargets.map((target) => (
                          <tr key={target.id} className="hover:bg-zinc-50">
                            <td className="px-6 py-4 font-bold text-zinc-800">{target.scope_type || 'CLASS'}</td>
                            <td className="px-6 py-4 font-semibold text-zinc-900">{target.target_value_name || target.class_name || 'All Students'}</td>
                            <td className="px-6 py-4 text-center font-bold text-orange-600">{target.daily_target} / day</td>
                            <td className="px-6 py-4 text-center font-bold text-indigo-600">{target.weekly_target} / week</td>
                            <td className="px-6 py-4 text-xs font-medium text-zinc-500">{target.start_date} to {target.end_date}</td>
                            <td className="px-6 py-4 text-xs text-zinc-600">{target.creator_name || 'Staff'}</td>
                            {user?.role !== 'STUDENT' && (
                              <td className="px-6 py-4 text-center">
                                <button type="button" onClick={() => handleDeleteGithubTarget(target.id)} className="text-zinc-400 hover:text-red-600 p-1" title="Delete Target">
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
      </PageLayout>
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

  const renderAssignGithubTargetModal = () => {
    if (!showAssignGithubTargetModal) return null;
    const isYearCoordinator = user?.is_year_coordinator;
    const isAdvisor = user?.role === 'CLASS_ADVISOR' || (user?.role === 'STUDENT' && user?.is_coordinator);

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[200] animate-fade-in">
        <Card className="w-full max-w-md bg-white shadow-xl rounded-2xl overflow-hidden p-6 border border-zinc-200">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-3">
            <h3 className="text-lg font-black text-zinc-900 flex items-center gap-1.5">
              <Github size={20} className="text-zinc-900" /> Assign GitHub Target
            </h3>
            <button
              onClick={() => setShowAssignGithubTargetModal(false)}
              className="text-zinc-400 hover:text-zinc-600 font-bold p-1 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreateGithubTarget} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Daily Target (Repos)</label>
                <input
                  type="number"
                  min="0"
                  value={assignGithubTargetForm.dailyTarget}
                  onChange={(e) => setAssignGithubTargetForm(prev => ({ ...prev, dailyTarget: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-zinc-900 bg-white"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Weekly Target (Repos)</label>
                <input
                  type="number"
                  min="0"
                  value={assignGithubTargetForm.weeklyTarget}
                  onChange={(e) => setAssignGithubTargetForm(prev => ({ ...prev, weeklyTarget: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-zinc-900 bg-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Start Date</label>
                <input
                  type="date"
                  value={assignGithubTargetForm.startDate}
                  onChange={(e) => setAssignGithubTargetForm(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:border-zinc-900 bg-white cursor-pointer"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">End Date</label>
                <input
                  type="date"
                  value={assignGithubTargetForm.endDate}
                  onChange={(e) => setAssignGithubTargetForm(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 focus:outline-none focus:border-zinc-900 bg-white cursor-pointer"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Target Scope</label>
              <select
                value={assignGithubTargetForm.scopeType}
                onChange={(e) => {
                  const scope = e.target.value;
                  let initialVal = '';
                  if (scope === 'CLASS') initialVal = classes[0]?.id || '';
                  if (scope === 'YEAR') initialVal = '1';
                  if (scope === 'DEPARTMENT') initialVal = departments[0]?.id || user?.department_id || '';
                  if (scope === 'STUDENT') initialVal = users.find(u => u.role === 'STUDENT')?.id || '';
                  setAssignGithubTargetForm(prev => ({ ...prev, scopeType: scope, targetValue: initialVal }));
                }}
                className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
              >
                {!isYearCoordinator && !isAdvisor && <option value="DEPARTMENT">Entire Department</option>}
                {!isAdvisor && <option value="YEAR">Specific Academic Year</option>}
                <option value="CLASS">Specific Section / Class</option>
                <option value="STUDENT">Individual Student</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1">Select Value</label>
              {assignGithubTargetForm.scopeType === 'DEPARTMENT' && (
                <select
                  value={assignGithubTargetForm.targetValue}
                  onChange={(e) => setAssignGithubTargetForm(prev => ({ ...prev, targetValue: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}

              {assignGithubTargetForm.scopeType === 'YEAR' && (
                <select
                  value={assignGithubTargetForm.targetValue}
                  onChange={(e) => setAssignGithubTargetForm(prev => ({ ...prev, targetValue: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              )}

              {assignGithubTargetForm.scopeType === 'CLASS' && (
                <select
                  value={assignGithubTargetForm.targetValue}
                  onChange={(e) => setAssignGithubTargetForm(prev => ({ ...prev, targetValue: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Year {c.year})</option>
                  ))}
                </select>
              )}

              {assignGithubTargetForm.scopeType === 'STUDENT' && (
                <select
                  value={assignGithubTargetForm.targetValue}
                  onChange={(e) => setAssignGithubTargetForm(prev => ({ ...prev, targetValue: e.target.value }))}
                  className="w-full p-2.5 border border-zinc-200 rounded-xl text-sm font-semibold text-zinc-700 focus:outline-none bg-white cursor-pointer"
                >
                  {users.filter(u => u.role === 'STUDENT').map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.register_number})</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAssignGithubTargetModal(false)}
                className="border-zinc-200 text-zinc-600 font-bold px-4 rounded-xl text-xs bg-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingTarget}
                className="bg-zinc-900 text-white font-bold px-4 rounded-xl text-xs hover:bg-zinc-800"
              >
                {submittingTarget ? 'Creating...' : 'Create Target'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  };

  const renderHistoryDetailsModal = () => {
    return null;
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-zinc-100 flex items-center justify-between shrink-0 h-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-md border-2 border-zinc-200">
            <img src="/logo.png" alt="VSBEC Logo" className="w-full h-full object-cover" />
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
        <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0 hidden md:flex h-full">
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
                      notifications.map(n => {
                        const matchingInv = myInvitations.find(inv =>
                          n.message.includes(inv.team_name) || n.message.includes(inv.task_title)
                        ) || myInvitations[0];
                        const isTeamInv = n.type === 'TEAM_INVITATION' || n.message.toLowerCase().includes('invited');
                        return (
                          <div key={n.id} className={cn("p-3 rounded-lg text-xs", n.is_read ? "bg-zinc-50" : "bg-blue-50 border border-blue-100")}>
                            <p className="text-zinc-900 mb-1 font-medium">{n.message}</p>
                            <p className="text-[10px] text-zinc-400 mb-2">{new Date(n.created_at).toLocaleString()}</p>
                            {isTeamInv && myInvitations.length > 0 && (
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-200/50">
                                <Button
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleRespondInvitation((matchingInv || myInvitations[0]).id, 'ACCEPT'); }}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1 h-auto rounded-lg shadow-sm"
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => { e.stopPropagation(); handleRespondInvitation((matchingInv || myInvitations[0]).id, 'DECLINE'); }}
                                  className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-[11px] font-bold px-3 py-1 h-auto rounded-lg"
                                >
                                  Decline
                                </Button>
                              </div>
                            )}
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
                        return activeClassId ? String(cid) === String(activeClassId) : true;
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
                            return activeClassId ? String(cid) === String(activeClassId) : true;
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
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative"
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
                        <p>The VSBEC IT Academic Task Management System respects the privacy of all users.</p>
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
                        <p>By using the VSBEC IT Academic Task Management System, users agree to use the platform only for academic and institutional purposes.</p>
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
          {renderAssignGithubTargetModal()}
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
