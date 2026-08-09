import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

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
                  constantStudentsByClassMap.get(classKey)!.push(s);
                }
                if (s.year) {
                  const yearKey = String(s.year);
                  if (!constantStudentsByYearMap.has(yearKey)) constantStudentsByYearMap.set(yearKey, []);
                  constantStudentsByYearMap.get(yearKey)!.push(s);
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
      constantStudentsByClassMap.get(classKey)!.push(student);

      const yearKey = String(student.year || 0);
      if (!constantStudentsByYearMap.has(yearKey)) {
        constantStudentsByYearMap.set(yearKey, []);
      }
      constantStudentsByYearMap.get(yearKey)!.push(student);

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
