import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { pool } from './db.js';

const execPromise = util.promisify(exec);

export interface ConstantStudent {
  id: string;
  register_number: string;
  full_name: string;
  email: string;
  gender: string;
  class_id: string;
  class_name: string;
  department_id: string;
  department_name: string;
  year: number | string;
  batch: string;
  leetcode?: string;
  github?: string;
}

// In-Memory Constant Caches
export const constantStudentByIdMap = new Map<string, ConstantStudent>();
export const constantStudentByRegNoMap = new Map<string, ConstantStudent>();
export const constantStudentByEmailMap = new Map<string, ConstantStudent>();
export const constantStudentsByClassMap = new Map<string, ConstantStudent[]>();
export const constantStudentsByYearMap = new Map<string, ConstantStudent[]>();

export function loadDirectoryFromDisk() {
  try {
    const baseDir = path.join(process.cwd(), 'students_directory');
    if (!fs.existsSync(baseDir)) return;

    constantStudentByIdMap.clear();
    constantStudentByRegNoMap.clear();
    constantStudentByEmailMap.clear();
    constantStudentsByClassMap.clear();
    constantStudentsByYearMap.clear();

    function scan(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          try {
            const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as ConstantStudent[];
            if (Array.isArray(data)) {
              for (const s of data) {
                if (s.id) constantStudentByIdMap.set(s.id.toString(), s);
                if (s.register_number) constantStudentByRegNoMap.set(s.register_number.toLowerCase().trim(), s);
                if (s.email) constantStudentByEmailMap.set(s.email.toLowerCase().trim(), s);
                if (s.class_id) {
                  const classKey = s.class_id.toString();
                  if (!constantStudentsByClassMap.has(classKey)) constantStudentsByClassMap.set(classKey, []);
                  const list = constantStudentsByClassMap.get(classKey)!;
                  if (!list.some(existing => String(existing.id) === String(s.id))) {
                    list.push(s);
                  }
                }
                if (s.year) {
                  const yearKey = String(s.year);
                  if (!constantStudentsByYearMap.has(yearKey)) constantStudentsByYearMap.set(yearKey, []);
                  const list = constantStudentsByYearMap.get(yearKey)!;
                  if (!list.some(existing => String(existing.id) === String(s.id))) {
                    list.push(s);
                  }
                }
              }
            }
          } catch (e) {
            console.error(`[StudentDirectory] Failed to parse ${fullPath}:`, e);
          }
        }
      }
    }

    scan(baseDir);
    console.log(`[StudentDirectory] Loaded ${constantStudentByRegNoMap.size} students across all classes from disk.`);
  } catch (err) {
    console.error('[StudentDirectory] Error loading directory from disk:', err);
  }
}

/**
 * Fetches all constant student details from Supabase/PostgreSQL,
 * builds the in-memory constant cache, and writes Year-wise folders
 * and Section-wise JSON and CSV files.
 */
export async function syncAndGenerateStudentDirectory() {
  try {
    const query = `
      SELECT 
        u.id,
        COALESCE(u.register_number, u.username) AS register_number,
        COALESCE(u.full_name, 'Unknown') AS full_name,
        COALESCE(u.email, '') AS email,
        COALESCE(u.gender, 'Not Specified') AS gender,
        u.class_id,
        COALESCE(c.name, 'Unassigned Section') AS class_name,
        u.department_id,
        COALESCE(d.name, 'Unassigned Dept') AS department_name,
        COALESCE(c.year, 0) AS year,
        COALESCE(c.batch, 'N/A') AS batch
      FROM users u
      LEFT JOIN classes c ON u.class_id = c.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'STUDENT'
      ORDER BY c.year ASC, c.name ASC, u.register_number ASC;
    `;

    const res = await pool.query(query);
    const students: ConstantStudent[] = res.rows;

    // Reset In-Memory Caches
    constantStudentByIdMap.clear();
    constantStudentByRegNoMap.clear();
    constantStudentsByClassMap.clear();
    constantStudentsByYearMap.clear();

    // Load from disk first so disk cache is available
    loadDirectoryFromDisk();

    const outputBaseDir = path.join(process.cwd(), 'students_directory');
    if (!fs.existsSync(outputBaseDir)) {
      fs.mkdirSync(outputBaseDir, { recursive: true });
    }

    // Grouping by Year -> Section
    const yearSectionGroup: Record<string, Record<string, ConstantStudent[]>> = {};

    for (const student of students) {
      // Merge LeetCode and GitHub URL from existing disk files to keep it strictly file-based
      const regKey = student.register_number ? student.register_number.toLowerCase().trim() : '';
      const existing = constantStudentByRegNoMap.get(regKey);
      student.leetcode = existing?.leetcode || '';
      student.github = existing?.github || '';

      // 1. Populate In-Memory Caches
      constantStudentByIdMap.set(student.id.toString(), student);
      if (student.register_number) {
        constantStudentByRegNoMap.set(student.register_number.toLowerCase().trim(), student);
      }

      const classKey = student.class_id ? student.class_id.toString() : 'unassigned';
      if (!constantStudentsByClassMap.has(classKey)) {
        constantStudentsByClassMap.set(classKey, []);
      }
      const classList = constantStudentsByClassMap.get(classKey)!;
      if (!classList.some(existing => String(existing.id) === String(student.id))) {
        classList.push(student);
      }

      const yearKey = String(student.year || 0);
      if (!constantStudentsByYearMap.has(yearKey)) {
        constantStudentsByYearMap.set(yearKey, []);
      }
      const yearList = constantStudentsByYearMap.get(yearKey)!;
      if (!yearList.some(existing => String(existing.id) === String(student.id))) {
        yearList.push(student);
      }

      // 2. Group for file exports
      const yearFolder = `Year_${student.year || 'Unassigned'}`;
      const sectionName = student.class_name ? student.class_name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Unassigned_Section';

      if (!yearSectionGroup[yearFolder]) {
        yearSectionGroup[yearFolder] = {};
      }
      if (!yearSectionGroup[yearFolder][sectionName]) {
        yearSectionGroup[yearFolder][sectionName] = [];
      }
      yearSectionGroup[yearFolder][sectionName].push(student);
    }

    // 3. Write files to Year-wise folders and Section-wise file names
    for (const [yearFolder, sections] of Object.entries(yearSectionGroup)) {
      const yearDirPath = path.join(outputBaseDir, yearFolder);
      if (!fs.existsSync(yearDirPath)) {
        fs.mkdirSync(yearDirPath, { recursive: true });
      }

      for (const [sectionName, list] of Object.entries(sections)) {
        // Write Section JSON file
        const jsonFilePath = path.join(yearDirPath, `Section_${sectionName}.json`);
        fs.writeFileSync(jsonFilePath, JSON.stringify(list, null, 2), 'utf-8');

        // Write Section CSV file
        const csvFilePath = path.join(yearDirPath, `Section_${sectionName}.csv`);
        const csvHeaders = 'Register_Number,Full_Name,Email,Gender,Class_Name,Department_Name,Year,Batch,Class_ID,Department_ID,Leetcode,Github\n';
        const csvRows = list.map(s => 
          `"${s.register_number}","${s.full_name}","${s.email}","${s.gender}","${s.class_name}","${s.department_name}","${s.year}","${s.batch}","${s.class_id}","${s.department_id}","${s.leetcode || ''}","${s.github || ''}"`
        ).join('\n');

        fs.writeFileSync(csvFilePath, csvHeaders + csvRows, 'utf-8');
      }
    }


    console.log(`[StudentDirectory] Synced ${students.length} students into Year folders & Section files at: ${outputBaseDir}`);
    return {
      success: true,
      totalStudents: students.length,
      directoryPath: outputBaseDir,
      yearFolders: Object.keys(yearSectionGroup)
    };
  } catch (error) {
    console.error('[StudentDirectory] Error syncing student directory:', error);
    throw error;
  }
}

/**
 * Updates a single student's coding profile (LeetCode & GitHub URLs) in memory
 * and immediately persists the update to the corresponding Section JSON and CSV on disk.
 */
export function updateStudentCodingProfileInDirectory(userId: string, leetcodeUrl: string, githubUrl: string) {
  try {
    const student = constantStudentByIdMap.get(String(userId));
    if (student) {
      student.leetcode = leetcodeUrl || '';
      student.github = githubUrl || '';

      if (student.register_number) {
        constantStudentByRegNoMap.set(student.register_number.toLowerCase().trim(), student);
      }
      if (student.email) {
        constantStudentByEmailMap.set(student.email.toLowerCase().trim(), student);
      }

      // Update in Section files on disk
      const baseDir = path.join(process.cwd(), 'students_directory');
      const yearFolder = `Year_${student.year || 'Unassigned'}`;
      const sectionName = student.class_name ? student.class_name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Unassigned_Section';
      const yearDirPath = path.join(baseDir, yearFolder);
      const jsonFilePath = path.join(yearDirPath, `Section_${sectionName}.json`);
      const csvFilePath = path.join(yearDirPath, `Section_${sectionName}.csv`);

      const classKey = student.class_id ? student.class_id.toString() : 'unassigned';
      const list = constantStudentsByClassMap.get(classKey);

      if (list && fs.existsSync(jsonFilePath)) {
        // Rewrite the JSON file for this section
        fs.writeFileSync(jsonFilePath, JSON.stringify(list, null, 2), 'utf-8');

        // Rewrite the CSV file for this section
        const csvHeaders = 'Register_Number,Full_Name,Email,Gender,Class_Name,Department_Name,Year,Batch,Class_ID,Department_ID,Leetcode,Github\n';
        const csvRows = list.map(s => 
          `"${s.register_number}","${s.full_name}","${s.email}","${s.gender}","${s.class_name}","${s.department_name}","${s.year}","${s.batch}","${s.class_id}","${s.department_id}","${s.leetcode || ''}","${s.github || ''}"`
        ).join('\n');
        fs.writeFileSync(csvFilePath, csvHeaders + csvRows, 'utf-8');

        // Queue automated GitHub commit and push (via GitHub Contents API and Git CLI)
        queueGitHubDirectoryPush(`${student.full_name} (${student.register_number})`, jsonFilePath, csvFilePath);
      }
    }
  } catch (err) {
    console.error('[StudentDirectory] Failed to update coding profile on disk/cache:', err);
  }
}

let gitPushTimeout: NodeJS.Timeout | null = null;
const pendingUpdateStudents = new Set<string>();
const pendingUpdatedFiles = new Set<string>();

/**
 * Updates a file directly on GitHub repository using GitHub Contents API.
 * Works seamlessly in cloud containers (e.g. Render) without needing local git credentials.
 */
async function updateGitHubFileViaAPI(filePath: string, commitMsg: string): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN;
  if (!token || !fs.existsSync(filePath)) return false;

  const repo = 'Tharun4743/IT_taskmanager';
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const url = `https://api.github.com/repos/${repo}/contents/${relativePath}`;

  try {
    const fileContentUtf8 = fs.readFileSync(filePath, 'utf-8');

    // 1. Get existing file SHA
    const getRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'IT-TaskManager-App'
      }
    });

    let sha: string | undefined;
    if (getRes.ok) {
      const json = await getRes.json() as { sha: string };
      sha = json.sha;
    }

    // 2. Put updated content (base64)
    const base64Content = Buffer.from(fileContentUtf8, 'utf-8').toString('base64');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'IT-TaskManager-App'
      },
      body: JSON.stringify({
        message: commitMsg,
        content: base64Content,
        sha: sha,
        branch: 'main'
      })
    });

    if (putRes.ok) {
      console.log(`[StudentDirectory] 🚀 Auto-updated ${relativePath} on GitHub via Contents API.`);
      return true;
    } else {
      const errText = await putRes.text();
      console.warn(`[StudentDirectory] GitHub API content update warning (${putRes.status}):`, errText);
      return false;
    }
  } catch (err: any) {
    console.warn('[StudentDirectory] GitHub API upload error:', err.message);
    return false;
  }
}

export async function pushDirectoryChangesToGitHub() {
  try {
    const studentList = Array.from(pendingUpdateStudents).slice(0, 5).join(', ') || 'student profiles';
    const filesToSync = Array.from(pendingUpdatedFiles);
    pendingUpdateStudents.clear();
    pendingUpdatedFiles.clear();

    const commitMsg = `chore(directory): auto-update student directory for ${studentList}`;

    // 1. Try GitHub REST API if GITHUB_TOKEN is available (best for Render / cloud containers)
    if (process.env.GITHUB_TOKEN && filesToSync.length > 0) {
      for (const fPath of filesToSync) {
        await updateGitHubFileViaAPI(fPath, commitMsg);
      }
    }

    // 2. Also execute local git push if running in an environment with git CLI
    try {
      await execPromise('git add students_directory/');
      const statusRes = await execPromise('git status --porcelain students_directory/');
      if (statusRes.stdout.trim()) {
        await execPromise(`git commit -m "${commitMsg}"`);
        await execPromise('git push origin main');
        console.log(`[StudentDirectory] 🚀 Auto-pushed directory changes to GitHub via Git CLI: ${commitMsg}`);
      }
    } catch {
      // Ignored if local git CLI is not authenticated (GitHub API handled it above)
    }
  } catch (err: any) {
    console.warn('[StudentDirectory] Note: Auto git push status/notice:', err.message);
  }
}

export function queueGitHubDirectoryPush(studentSummary: string, jsonFilePath?: string, csvFilePath?: string) {
  pendingUpdateStudents.add(studentSummary);
  if (jsonFilePath) pendingUpdatedFiles.add(jsonFilePath);
  if (csvFilePath) pendingUpdatedFiles.add(csvFilePath);

  if (gitPushTimeout) {
    clearTimeout(gitPushTimeout);
  }
  // Debounce push by 2 seconds so rapid updates are batched together cleanly
  gitPushTimeout = setTimeout(() => {
    pushDirectoryChangesToGitHub().catch(err => console.error('[StudentDirectory] Background push error:', err));
  }, 2000);
}


