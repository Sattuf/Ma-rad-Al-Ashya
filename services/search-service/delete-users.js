const fs = require('fs');
fs.rmSync('c:/Users/sattuf/Desktop/marad/services/search-service/users-service', { recursive: true, force: true });
console.log('Deleted users-service');
