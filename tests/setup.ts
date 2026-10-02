// Test-only secrets — never real values, never used outside this process.
process.env.SESSION_SECRET = 'test-session-secret-not-for-real-use-32chars';
process.env.ADMIN_PASSWORD_HASH = '$2a$10$abcdefghijklmnopqrstuuJZ1s7XG8v6bHqjK9nq5X6yQvQwZ9Yy2'; // never matches any real password in tests
