const url = location.origin;
async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = document.getElementById("role").value;

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  try {
    const res = await fetch(`${url}/auth/login`, {  
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role })
    });

    // Debug: log status and raw response before parsing
    console.log('Login response status:', res.status, res.statusText);
    const raw = await res.text();
    console.log('Login raw response:', raw);

    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.error('Failed to parse login response as JSON:', err);
      alert('Server returned invalid response. Check server logs.');
      return;
    }

    if (data.success) {
      localStorage.setItem("token", data.token);
      
      // Store user data based on role
      if (data.user) {
        const userData = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          phone: data.user.phone,
          role: data.user.role
        };
        
        if (data.user.role === 'admin') {
          localStorage.setItem('rapidride_admin', JSON.stringify(userData));
        } else if (data.user.role === 'driver') {
          localStorage.setItem('rapidride_driver', JSON.stringify(userData));
        } else {
          localStorage.setItem('rapidride_rider', JSON.stringify(userData));
        }
      }
      
      alert("Login successful!");
      
      // Redirect based on user role
      if (data.user && data.user.role === 'admin') {
        window.location.href = `${location.origin}/admin/pages/dashboard.html`;
      } else if (data.user && data.user.role === 'driver') {
        window.location.href = `${location.origin}/driver/pages/dashboard.html`;
      } else {
        window.location.href = `${location.origin}/rider/pages/dashboard.html`;
      }
    } else {
      alert(data.message || "Login failed");
    }
  } catch (error) {
    alert("Network error: " + error.message);
  }
}