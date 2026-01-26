// Firebase Init
firebase.initializeApp({
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
});

const auth = firebase.auth();
const db = firebase.firestore();

// ROUTE GUARD
auth.onAuthStateChanged(async user => {
  const page = location.pathname.split("/").pop();

  if (!user) {
    if (page !== "index.html") location.replace("index.html");
    return;
  }

  const admin = await db.collection("admins").doc(user.uid).get();
  const usr   = await db.collection("users").doc(user.uid).get();

  if (admin.exists && page !== "admin.html") location.replace("admin.html");
  if (usr.exists && page !== "user.html") location.replace("user.html");
});

// LOGIN
function login() {
  auth.signInWithEmailAndPassword(
    email.value, password.value
  ).catch(e => alert(e.message));
}

// LOGOUT
function logout() {
  auth.signOut().then(() => location.replace("index.html"));
}

// PASSWORD TOGGLE
function togglePassword() {
  password.type = password.type === "password" ? "text" : "password";
}

// APPLY LEAVE
async function applyLeave() {
  if (!reason.value.trim()) return alert("Reason required");

  const from = fromDate.value;
  const to   = toDate.value;
  const days = (new Date(to) - new Date(from)) / 86400000 + 1;

  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  const user = auth.currentUser;

  await db.collection("leaves").add({
    uid: user.uid,
    email: user.email,
    from, to, days, cl, lop,
    reason: reason.value,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("notifications").add({
    to: "ADMIN",
    message: `${user.email} applied for leave`,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Leave applied");
}
