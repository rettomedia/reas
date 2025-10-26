import { User, initDatabase } from "./database.js";

await initDatabase();

const admin = await User.create({
    username: 'admin',
    email: 'admin@test.com',
    password: 'admin123',
    role: 'user'
});

console.log('✅ Admin kullanıcı oluşturuldu');
console.log('Email:', admin.email);
console.log('Password: admin123');
process.exit(0);