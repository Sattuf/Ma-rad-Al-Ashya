const fs = require('fs');
const path = require('path');

const usersDir = path.join(__dirname, 'src', 'users');
if (fs.existsSync(usersDir)) {
  fs.rmSync(usersDir, { recursive: true, force: true });
}

const v4Migration = path.join(__dirname, 'src', 'database', 'migrations', 'V004__add_profile_fields.sql');
if (fs.existsSync(v4Migration)) {
  fs.rmSync(v4Migration);
}

console.log('Cleanup done.');
