import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import {
  Target,
  Briefcase,
  Award,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Search,
  Download,
  Filter,
  Sparkles,
  Code,
  FileCheck,
  Building2,
  Star,
  RefreshCw,
  UserCheck,
  ArrowUpRight
} from 'lucide-react';
import { API_URL } from './config';

interface PlacementReadinessViewProps {
  user: any;
  token: string | null;
  addToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToAssessment?: () => void;
}

export const PlacementReadinessView: React.FC<PlacementReadinessViewProps> = ({
  user,
  token,
  addToast,
  onNavigateToAssessment
}) => {
  const isHOD = user?.role === 'HOD' || user?.role === 'SUPREME_ADMIN';
  const isAdvisor = user?.role === 'CLASS_ADVISOR';
  const isStudent = user?.role === 'STUDENT';

  // HOD / Advisor Dashboard State
  const [metrics, setMetrics] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Student Profile State
  const [myProfile, setMyProfile] = useState<any>(null);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isHOD || isAdvisor) {
      fetchDashboardData();
    }
    if (isStudent) {
      fetchMyReadinessProfile();
    }
  }, [selectedTier, selectedClassId]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      let url = `${API_URL}/api/placement/readiness-dashboard?`;
      if (selectedTier && selectedTier !== 'ALL') url += `tier=${selectedTier}&`;
      if (selectedClassId) url += `class_id=${selectedClassId}&`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setMetrics(data.metrics);
        setStudents(data.students || []);
        if (data.classes && classes.length === 0) {
          setClasses(data.classes);
        }
      }
    } catch (e) {
      console.error('Error fetching placement readiness:', e);
      addToast('Error loading placement readiness data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyReadinessProfile = async () => {
    setIsProfileLoading(true);
    try {
      const authHeaders: any = {};
      if (token) authHeaders['Authorization'] = `Bearer ${token}`;
      const url = user?.id ? `${API_URL}/api/placement/my-readiness?user_id=${user.id}` : `${API_URL}/api/placement/my-readiness`;
      const res = await fetch(url, { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setMyProfile(data.profile);
      }
    } catch (e) {
      console.error('Error fetching student readiness profile:', e);
    } finally {
      setIsProfileLoading(false);
    }
  };

  // ── Export Company-Ready Shortlist to Excel ────────────────────────────────
  const handleExportCompanyReadyList = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Placement Ready Students');

      worksheet.columns = [
        { header: 'S.No', key: 'sno', width: 8 },
        { header: 'Student Name', key: 'name', width: 26 },
        { header: 'Register Number', key: 'regNo', width: 18 },
        { header: 'Class / Section', key: 'className', width: 18 },
        { header: 'Readiness Score (%)', key: 'readiness', width: 22 },
        { header: 'Placement Tier', key: 'tier', width: 26 },
        { header: 'Aptitude Benchmark (%)', key: 'aptitude', width: 24 },
        { header: 'LeetCode Weekly Streak (Days)', key: 'lcStreak', width: 26 },
        { header: 'LeetCode Consistency (%)', key: 'lcConsistency', width: 24 },
        { header: 'Projects Portfolio Count', key: 'projects', width: 22 },
        { header: 'Task Discipline (%)', key: 'tasks', width: 20 },
        { header: 'Eligible Companies', key: 'companies', width: 35 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Phone', key: 'phone', width: 18 }
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' }
      };

      const dataToExport = filteredStudents;

      dataToExport.forEach((s, idx) => {
        worksheet.addRow({
          sno: idx + 1,
          name: s.full_name,
          regNo: s.register_number,
          className: s.class_name,
          readiness: `${s.readiness_score}%`,
          tier: s.tier_label,
          aptitude: s.aptitude_completed ? `${s.aptitude_score}%` : 'Not Attempted',
          lcStreak: `${s.leetcode_weekly_streak ?? s.pillars?.leetcode?.weekly_streak ?? 0} Days/Wk`,
          lcConsistency: `${s.leetcode_consistency ?? s.pillars?.leetcode?.consistency ?? 0}%`,
          projects: `${s.project_count ?? s.pillars?.projects?.count ?? 0} Projects`,
          tasks: `${s.task_completion_rate}%`,
          companies: Array.isArray(s.eligible_companies) ? s.eligible_companies.join(', ') : (s.eligible_companies || 'N/A'),
          email: s.email || 'N/A',
          phone: s.phone || 'N/A'
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Company_Placement_Ready_List_${selectedTier}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      addToast(`Exported ${dataToExport.length} company-ready candidates to Excel!`, 'success');
    } catch (e) {
      console.error('Export error:', e);
      addToast('Error exporting shortlist', 'error');
    }
  };

  const filteredStudents = students.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.register_number?.toLowerCase().includes(q) ||
      s.class_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="absolute inset-0 overflow-y-auto overflow-x-hidden p-4 md:p-8 bg-[#F5F5F4] flex flex-col min-h-0">
      <div className="w-full flex flex-col min-h-full space-y-6">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Target size={20} />
              </div>
              <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
                Placement Readiness Rating
              </h1>
            </div>
            <p className="text-xs text-zinc-500 font-semibold mt-1">
              Unified 0–100% Placement Eligibility Index (Aptitude 35% • LeetCode Consistency 25% • Projects 20% • Tasks 20%)
            </p>
          </div>

          {(isHOD || isAdvisor) && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchDashboardData}
                className="p-2 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 rounded-xl transition"
                title="Refresh Metrics"
              >
                <RefreshCw size={15} />
              </button>
              <button
                type="button"
                onClick={handleExportCompanyReadyList}
                className="px-4 py-2 bg-black hover:bg-zinc-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download size={14} /> Export Company Shortlist (.xlsx)
              </button>
            </div>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            STUDENT VIEW: INDIVIDUAL READINESS PROFILE & 4-PILLAR BREAKDOWN
            ═════════════════════════════════════════════════════════════════════ */}
        {isStudent && (
          <div className="space-y-6">
            {isProfileLoading ? (
              <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center text-zinc-500 text-xs font-semibold">
                Calculating your real-time placement readiness score...
              </div>
            ) : myProfile ? (
              <>
                {/* Hero Card: Overall Placement Readiness Rating */}
                <div className="bg-white border border-zinc-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                    
                    {/* Dial Gauge */}
                    <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" stroke="#f4f4f5" strokeWidth="8" fill="none" />
                        <circle
                          cx="50" cy="50" r="42"
                          stroke={
                            myProfile.readiness_score >= 80
                              ? '#10b981'
                              : myProfile.readiness_score >= 65
                              ? '#6366f1'
                              : myProfile.readiness_score >= 50
                              ? '#f59e0b'
                              : '#f43f5e'
                          }
                          strokeWidth="8"
                          strokeDasharray="263.89"
                          strokeDashoffset={263.89 - (263.89 * myProfile.readiness_score) / 100}
                          strokeLinecap="round"
                          fill="none"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-3xl font-extrabold text-zinc-900">{myProfile.readiness_score}%</span>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Readiness</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        myProfile.readiness_score >= 80
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : myProfile.readiness_score >= 65
                          ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                          : myProfile.readiness_score >= 50
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        <Award size={13} /> {myProfile.tier_label}
                      </span>

                      <h2 className="text-xl font-bold text-zinc-900">
                        {myProfile.full_name} ({myProfile.register_number})
                      </h2>
                      <p className="text-xs text-zinc-500 max-w-lg leading-relaxed">
                        Your consolidated placement score reflects academic discipline, algorithmic consistency on LeetCode, verified software projects, and aptitude benchmark performance.
                      </p>
                    </div>
                  </div>

                  {/* Company Eligibility Status */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 w-full md:w-80 space-y-2 text-left shrink-0">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-800">
                      <Building2 size={15} className="text-zinc-600" />
                      <span>Eligible Company Tiers</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {myProfile.eligible_companies?.length > 0 ? (
                        myProfile.eligible_companies.map((c: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-1 bg-white text-zinc-800 rounded-lg text-xs font-bold border border-zinc-200 shadow-2xs">
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Score ≥65% to unlock TCS/Infosys IT tier.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4 Pillars Breakdown Cards (100% Real Live Metrics) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Pillar 1: Aptitude */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pillar 1 (35%)</span>
                      <Sparkles size={16} className="text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-zinc-900">
                          {myProfile.pillars?.aptitude?.completed ? `${myProfile.pillars.aptitude.score}%` : '0%'}
                        </span>
                        <span className="text-xs font-bold text-zinc-500">
                          {myProfile.pillars?.aptitude?.completed ? 'Benchmark Score' : 'Not Attempted'}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-indigo-700 block mt-0.5">
                        +{myProfile.pillars?.aptitude?.contribution ?? 0} / 35 pts earned
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      {myProfile.pillars?.aptitude?.completed
                        ? 'Proctored 15-Question Skill Assessment Benchmark.'
                        : 'Take the proctored 15-Q aptitude test to earn up to +35 points!'}
                    </p>
                    {onNavigateToAssessment && (
                      <button
                        type="button"
                        onClick={onNavigateToAssessment}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1 cursor-pointer"
                      >
                        {myProfile.pillars?.aptitude?.completed ? 'View Marks & Scorecard' : 'Take Assessment Now'} <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>

                  {/* Pillar 2: LeetCode Weekly Streak & Consistency */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pillar 2 (25%)</span>
                      <Code size={16} className="text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-zinc-900">
                          {myProfile.pillars.leetcode?.weekly_streak ?? 0}d
                        </span>
                        <span className="text-xs font-bold text-zinc-500">Weekly Streak</span>
                      </div>
                      <span className="text-xs font-bold text-amber-700 block mt-0.5">
                        +{myProfile.pillars.leetcode?.contribution ?? 0} / 25 pts ({myProfile.pillars.leetcode?.consistency ?? 0}% Consistency)
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px] text-zinc-500">
                      <div className="flex justify-between">
                        <span>Weekly Streak Target:</span>
                        <span className="font-bold text-zinc-800">7 Days / Week</span>
                      </div>
                      {myProfile.leetcode_url && (
                        <a
                          href={myProfile.leetcode_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:underline pt-0.5"
                        >
                          Verified LeetCode Profile <ArrowUpRight size={11} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Pillar 3: Technical Project Portfolio */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pillar 3 (20%)</span>
                      <Briefcase size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-zinc-900">
                          {myProfile.pillars.projects?.count ?? 0}
                        </span>
                        <span className="text-xs font-bold text-zinc-500">Projects Built</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 block mt-0.5">
                        +{myProfile.pillars.projects?.contribution ?? 0} / 20 pts (Benchmark: 3+ Projects)
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px] text-zinc-500">
                      <div className="flex justify-between">
                        <span>Portfolio Target:</span>
                        <span className="font-bold text-zinc-800">3+ Core Projects</span>
                      </div>
                      {myProfile.pillars.projects?.projects_list?.length > 0 ? (
                        <div className="pt-1 flex flex-wrap gap-1">
                          {myProfile.pillars.projects.projects_list.slice(0, 2).map((p: any) => (
                            <span key={p.id} className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200 truncate max-w-[140px]" title={p.project_name}>
                              {p.project_name}
                            </span>
                          ))}
                          {myProfile.pillars.projects.projects_list.length > 2 && (
                            <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">
                              +{myProfile.pillars.projects.projects_list.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400 italic">No projects registered yet</span>
                      )}
                    </div>
                  </div>

                  {/* Pillar 4: Tasks */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pillar 4 (20%)</span>
                      <FileCheck size={16} className="text-purple-600" />
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-zinc-900">
                          {myProfile.pillars?.tasks?.rate ?? 0}%
                        </span>
                        <span className="text-xs font-bold text-zinc-500">Discipline Rate</span>
                      </div>
                      <span className="text-xs font-bold text-purple-700 block mt-0.5">
                        +{myProfile.pillars?.tasks?.contribution ?? 0} / 20 pts ({myProfile.pillars?.tasks?.submitted ?? 0}/{myProfile.pillars?.tasks?.total_assigned ?? 0} tasks)
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-medium">
                      Verified academic tasks and laboratory assignments submitted on portal.
                    </p>
                  </div>
                </div>

                {/* Actionable Recommendations to Level Up */}
                {myProfile.recommendations?.length > 0 && (
                  <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={18} className="text-indigo-600" />
                      <h3 className="text-sm font-bold text-zinc-900">
                        How to Boost Your Placement Readiness Score
                      </h3>
                    </div>

                    <div className="space-y-2">
                      {myProfile.recommendations.map((rec: string, idx: number) => (
                        <div key={idx} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-700 flex items-start gap-2.5">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-zinc-500 text-xs">
                Could not load profile. Please verify credentials.
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            HOD / ADVISOR DASHBOARD: AGGREGATE STATS, COMPANY FILTERS & TABLE
            ═════════════════════════════════════════════════════════════════════ */}
        {(isHOD || isAdvisor) && (
          <div className="space-y-6">

            {/* Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Placement Eligible (≥75%)</span>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1">{metrics?.eligible_count || 0}</p>
                <span className="text-[11px] font-medium text-zinc-500 mt-0.5 block">
                  {metrics?.pass_rate || 0}% of cohort ready
                </span>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Average Readiness</span>
                <p className="text-2xl font-extrabold text-zinc-900 mt-1">{metrics?.average_readiness || 0}%</p>
                <span className="text-[11px] font-medium text-zinc-500 mt-0.5 block">Cohort weighted rating</span>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Zoho / Product Tier (≥80%)</span>
                <p className="text-2xl font-extrabold text-indigo-600 mt-1">{metrics?.tier1_count || 0}</p>
                <span className="text-[11px] font-medium text-indigo-600 mt-0.5 block">Top dream placement</span>
              </div>

              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Action Needed (&lt;50%)</span>
                <p className="text-2xl font-extrabold text-rose-600 mt-1">{metrics?.needs_attention_count || 0}</p>
                <span className="text-[11px] font-medium text-rose-600 mt-0.5 block">Requires intervention</span>
              </div>
            </div>

            {/* Filter Bar with 1-Click Company Presets */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                
                {/* Company & Tier Filter Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-zinc-400 mr-1.5 flex items-center gap-1">
                    <Filter size={13} /> Filter:
                  </span>

                  <button
                    type="button"
                    onClick={() => setSelectedTier('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                      selectedTier === 'ALL'
                        ? 'bg-black text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    All Students ({metrics?.total_students || 0})
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTier('ZOHO')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                      selectedTier === 'ZOHO'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <Star size={12} /> Zoho / Product (≥80%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTier('TCS')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                      selectedTier === 'TCS'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
                    }`}
                  >
                    <Briefcase size={12} /> TCS / Infosys (≥65%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTier('ELIGIBLE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                      selectedTier === 'ELIGIBLE'
                        ? 'bg-black text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    <UserCheck size={12} /> Placement Ready (≥75%)
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTier('NEEDS_ATTENTION')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                      selectedTier === 'NEEDS_ATTENTION'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    <AlertTriangle size={12} /> Action Needed (&lt;50%)
                  </button>
                </div>

                {/* Class Dropdown & Search Input */}
                <div className="flex items-center gap-2.5 w-full md:w-auto">
                  <select
                    value={selectedClassId}
                    onChange={e => setSelectedClassId(e.target.value)}
                    className="py-1.5 px-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black"
                  >
                    <option value="">All Classes & Sections</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Year {c.year})
                      </option>
                    ))}
                  </select>

                  <div className="relative flex-1 md:w-60">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search name or reg no..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Candidate List Table */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-bold text-zinc-900">
                  Candidate Readiness Ranking ({filteredStudents.length} Students)
                </h3>
                <span className="text-xs text-zinc-400">
                  Sorted by Register Number
                </span>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                  <Target size={28} className="mx-auto text-zinc-400 mb-2" />
                  <p className="text-sm font-bold text-zinc-700">No Candidates Match the Filter</p>
                  <p className="text-xs text-zinc-400">Try selecting "All Students" or resetting the search query.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-bold uppercase tracking-wider">
                        <th className="p-3">Candidate</th>
                        <th className="p-3">Class</th>
                        <th className="p-3">Readiness Rating</th>
                        <th className="p-3">Placement Tier</th>
                        <th className="p-3">Aptitude (35%)</th>
                        <th className="p-3">LeetCode Streak (25%)</th>
                        <th className="p-3">Projects Built (20%)</th>
                        <th className="p-3">Tasks (20%)</th>
                        <th className="p-3 text-right">Eligible Companies</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredStudents.map(s => (
                        <tr key={s.id} className="hover:bg-zinc-50/80 font-medium">
                          {/* Student Info */}
                          <td className="p-3 font-bold text-zinc-900 flex items-center gap-2.5">
                            {s.proctor_photo_url ? (
                              <img
                                src={s.proctor_photo_url}
                                alt={s.full_name}
                                className="w-9 h-9 rounded-full object-cover border border-zinc-300 shadow-2xs shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[11px] font-bold text-zinc-600 shrink-0">
                                {s.full_name?.charAt(0) || 'S'}
                              </div>
                            )}
                            <div>
                              <span>{s.full_name}</span>
                              <span className="block text-[10px] text-zinc-400 font-mono">{s.register_number}</span>
                            </div>
                          </td>

                          {/* Class */}
                          <td className="p-3 text-zinc-600 font-semibold">{s.class_name}</td>

                          {/* Readiness Rating Bar */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-zinc-900">{s.readiness_score}%</span>
                              <div className="w-16 h-2 bg-zinc-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    s.readiness_score >= 80
                                      ? 'bg-emerald-500'
                                      : s.readiness_score >= 65
                                      ? 'bg-indigo-500'
                                      : s.readiness_score >= 50
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${s.readiness_score}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Tier Badge */}
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded font-bold text-[11px] ${
                              s.tier === 'TIER_1'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : s.tier === 'TIER_2'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : s.tier === 'TIER_3'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}>
                              {s.tier === 'TIER_1'
                                ? 'Tier 1 (Product)'
                                : s.tier === 'TIER_2'
                                ? 'Tier 2 (Services)'
                                : s.tier === 'TIER_3'
                                ? 'Tier 3 (Baseline)'
                                : 'Action Required'}
                            </span>
                          </td>

                          {/* Aptitude */}
                          <td className="p-3 font-semibold text-zinc-700">
                            {s.aptitude_completed ? `${s.aptitude_score}%` : <span className="text-zinc-400 italic">Not taken</span>}
                          </td>

                          {/* LeetCode Weekly Streak & Consistency */}
                          <td className="p-3 font-semibold text-zinc-700">
                            <div className="flex flex-col">
                              <span className="font-bold text-zinc-900">
                                {s.leetcode_weekly_streak ?? s.pillars?.leetcode?.weekly_streak ?? 0}d / Wk
                              </span>
                              <span className="text-[10px] text-zinc-400 font-mono">
                                {s.leetcode_consistency ?? s.pillars?.leetcode?.consistency ?? 0}% Consistency
                              </span>
                            </div>
                          </td>

                          {/* Projects Built */}
                          <td className="p-3 font-semibold text-zinc-700">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                              (s.project_count ?? s.pillars?.projects?.count ?? 0) >= 3
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : (s.project_count ?? s.pillars?.projects?.count ?? 0) > 0
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-zinc-100 text-zinc-500'
                            }`}>
                              <Briefcase size={12} />
                              {s.project_count ?? s.pillars?.projects?.count ?? 0} Projects
                            </span>
                          </td>

                          {/* Tasks */}
                          <td className="p-3 font-semibold text-zinc-700">
                            {s.task_completion_rate}%
                          </td>

                          {/* Eligible Companies */}
                          <td className="p-3 text-right">
                            <span className="text-[11px] font-semibold text-zinc-600">
                              {s.eligible_companies?.slice(0, 2).join(', ') || 'None yet'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
export default PlacementReadinessView;
