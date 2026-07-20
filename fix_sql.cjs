const fs = require('fs');
const bcrypt = require('bcryptjs');

// Read file and split by \n, then strip \r from every line
const content = fs.readFileSync('insert_students.sql', 'utf8');
const lines = content.split('\n').map(l => l.replace(/\r$/, ''));
let replacedCount = 0;

const newLines = lines.map((line, idx) => {
    // Only process A class students
    if (line.includes('STUDENT') && line.includes('a1a12dd8-1863-4a21-9d3d-f6d67486788a')) {
        const regMatch = line.match(/'(922524205\d{3})'/);
        const startMatch = line.match(/^(INSERT INTO users [^V]+ VALUES \('[^']+', )/);
        
        // Removed the $ anchor to be absolutely safe, though \r is gone now
        const restMatch = line.match(/(, 'STUDENT', .*)/);
        
        if (regMatch && startMatch && restMatch) {
            const regNo = regMatch[1];
            // Only generate new hash if it's currently broken (has ' in it)
            // Wait, we can just regenerate them all to be safe and clean.
            const hash = bcrypt.hashSync(regNo, 10);
            replacedCount++;
            return `${startMatch[1]}'${hash}'${restMatch[1]}`;
        } else {
            console.log(`Failed to match on line ${idx + 1}`);
        }
    }
    return line;
});

// Re-add \r\n for Windows compatibility
fs.writeFileSync('insert_students.sql', newLines.join('\r\n'));
console.log(`Successfully fixed insert_students.sql. Replaced ${replacedCount} lines.`);
