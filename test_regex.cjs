const line = "INSERT INTO users (username, password, role, department_id, class_id, full_name, register_number, email, is_coordinator) VALUES ('priyankamk@gmail.com', '$2bVALUES ('priyankamk@gmail.com', 0$pCDHCk98PcG0QkSB5GAOie/l.GzPXvLEorcacJdrCGmJOpg4myD2W', 'STUDENT', 'a6a12dd8-1863-4a21-9d3d-f6d67486788a', 'a1a12dd8-1863-4a21-9d3d-f6d67486788a', 'PRIYANKA M K', '922524205125', 'priyankamk@gmail.com', FALSE);";
const regMatch = line.match(/'(922524205\d{3})'/);
const startMatch = line.match(/^(INSERT INTO users [^V]+ VALUES \('[^']+', )/);
const restMatch = line.match(/(, 'STUDENT', .*)$/);

console.log('regMatch:', regMatch ? regMatch[1] : 'null');
console.log('startMatch:', startMatch ? startMatch[1] : 'null');
console.log('restMatch:', restMatch ? restMatch[1] : 'null');
