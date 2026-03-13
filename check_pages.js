(async () => {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    redirect: 'manual',
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('cookie', cookie);
  const settings = await fetch('http://localhost:3000/dashboard/settings', { headers: { Cookie: cookie } });
  const settingsText = await settings.text();
  console.log('settings contains name?', settingsText.includes('Test User'));
  const contentLab = await fetch('http://localhost:3000/dashboard/content-lab', { headers: { Cookie: cookie } });
  const contentText = await contentLab.text();
  console.log('content lab default value has name?', contentText.includes('value="Test User"'));
})();