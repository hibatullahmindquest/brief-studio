(async()=>{
  const res = await fetch('http://localhost:3000/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({email:'test@example.com',password:'password123',name:'Test User',username:'testuser'})});
  console.log('status',res.status);
  console.log(await res.text());
})();