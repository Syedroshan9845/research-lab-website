const firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

function togglePassword() {
  const p = document.getElementById("password");
  p.type = p.type === "password" ? "text" : "password";
}

function login() {
  auth.signInWithEmailAndPassword(
    email.value.trim(),
    password.value
  ).catch(e => alert(e.message));
}

auth.onAuthStateChanged(async user => {
  if (!user) return;

  const admin = await db.collection("admins").doc(user.uid).get();
  const normal = await db.collection("users").doc(user.uid).get();

  if (admin.exists) location.replace("admin.html");
  else if (normal.exists) location.replace("user.html");
  else {
    alert("Role not assigned");
    auth.signOut();
  }
});

function logout() {
  auth.signOut().then(() => location.replace("index.html"));
}

/* USER */
async function applyLeave() {
  const from = from.value;
  const to = to.value;
  const days = (new Date(to) - new Date(from)) / 86400000 + 1;
  if (days <= 0) return alert("Invalid dates");

  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  await db.collection("leaveRequests").add({
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    from, to, cl, lop,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  alert("Leave applied");
  location.reload();
}

/* ADMIN */
function exportCSV() {
  db.collection("leaveRequests").get().then(snap => {
    let csv = "Email,From,To,CL,LOP,Status\n";
    snap.forEach(d => {
      const x = d.data();
      csv += `${x.email},${x.from},${x.to},${x.cl},${x.lop},${x.status}\n`;
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv]));
    a.download = "leaves.csv";
    a.click();
  });
}
