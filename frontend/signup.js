console.log("SIGNUP.JS LOADED!");
const url = "http://localhost:5500"

// Check URL parameters and set default role
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');
  
  if (roleParam) {
    const roleSelect = document.getElementById("role");
    if (roleSelect) {
      // Set the role from URL parameter (rider or driver)
      if (roleParam.toLowerCase() === 'driver') {
        roleSelect.value = 'driver';
      } else if (roleParam.toLowerCase() === 'rider') {
        roleSelect.value = 'rider';
      }
      console.log(`Role set to: ${roleSelect.value} from URL parameter`);
    }
  }
});

async function signup() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const role = document.getElementById("role").value;

  if (!name || !email || !phone || !password || !confirmPassword) {
    alert("Please fill in all fields");
    return;
  }

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  if (phone.length < 10) {
    alert("Please enter a valid phone number");
    return;
  }

  try {
    const res = await fetch(`${url}/auth/signup`, {  
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password, role })
    });

    const data = await res.json();
    console.log("Signup response:", data);

    if (data.success) {
      alert("Signup successful! Redirecting to login...");
      window.location.href = "login.html";
    } else {
      alert("Signup failed: " + data.message);
    }
  } catch (error) {
    alert("ERROR: " + error.message);
    console.error("Full error:", error);
  }
}