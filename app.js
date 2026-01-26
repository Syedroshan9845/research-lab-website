/**************** FIREBASE CONFIG ****************/
var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app",
  messagingSenderId: "149246738052",
  appId: "1:149246738052:web:f751d671a4ee32b3acccd1"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/**************** UTIL ****************/
function $(id) {
  return document.getElementById(id);
}
function pageName() {
  return location.pathname.split("/").pop();
}

/**************** PASSWORD TOGGLE ****************/
function togglePassword() {
  const p = $("password");
  if (p) p.type = p.type === "password" ? "text" : "password";
}

/**************** LOGIN ****************/
function login() {
  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    alert("Email and password required");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => alert(err.message));
}

/**************** LOGOUT ****************/
function logout() {
  auth.signOut().then(() => {
    location.replace("index.html");
  });
}

/**************** AUTH HANDLER ****************/
auth.onAuthStateChanged(async user => {
  const page = pageName();

  if (!user) {
    if (page !== "index.html") location.replace("index.html");
    return;
  }

  // fetch role
  const adminSnap = await db.collection("admins").doc(user.uid).get();
  const userSnap = await db.collection("users").doc(user.uid).get();

  if (adminSnap.exists) {
    if (page !== "admin.html") location.replace("admin.html");
    if (page === "admin.html") loadAdminDashboard();
    return;
  }

  if (userSnap.exists) {
    if (page !== "user.html") location.replace("user.html");
    if (page === "user.html") loadUserDashboard();
    return;
  }

  alert("No role assigned. Contact admin.");
  auth.signOut();
});

/**************** USER DASHBOARD ****************/
async function loadUserDashboard() {
  const user = auth.currentUser;
  $("userEmail").innerText = user.email;
  $("totalCL").innerText = 12;

  loadUserLeaves();
  loadUserNotifications();
}

async function loadUserLeaves() {
  const user = auth.currentUser;
  const table = $("leaveTable");

  table.innerHTML = `
    <tr>
      <th>From</th><th>To</th><th>CL</th><th>LOP</th><th>Reason</th><th>Status</th>
    </tr>`;

  let approvedCL = 0;
  let lopTaken = 0;

  const snap = await db.collection("leaves")
    .where("uid", "==", user.uid)
    .orderBy("createdAt", "desc")
    .get();

  snap.forEach(doc => {
    const d = doc.data();
    if (d.status === "APPROVED") {
      approvedCL += d.cl;
      lopTaken += d.lop;
    }

    table.innerHTML += `
      <tr>
        <td>${d.from}</td>
        <td>${d.to}</td>
        <td>${d.cl}</td>
        <td>${d.lop}</td>
        <td>${d.reason}</td>
        <td>${d.status}</td>
      </tr>`;
  });

  $("approvedCL").innerText = approvedCL;
  $("remainingCL").innerText = Math.max(12 - approvedCL, 0);
  $("lopTaken").innerText = lopTaken;
}

/**************** APPLY LEAVE ****************/
async function applyLeave() {
  const from = $("from").value;
  const to = $("to").value;
  const reason = $("reason").value.trim();
  const file = $("document").files[0];
  const user = auth.currentUser;

  if (!from || !to || !reason) {
    alert("Reason and dates are mandatory");
    return;
  }

  const days = Math.floor((new Date(to) - new Date(from)) / 86400000) + 1;
  if (days <= 0) {
    alert("Invalid date range");
    return;
  }

  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  let documentUrl = "";
  if (file) {
    const ref = storage.ref(`docs/${user.uid}/${file.name}`);
    await ref.put(file);
    documentUrl = await ref.getDownloadURL();
  }

  await db.collection("leaves").add({
    uid: user.uid,
    email: user.email,
    from,
    to,
    days,
    cl,
    lop,
    reason,
    documentUrl,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("notifications").add({
    to: "ADMIN",
    message: `${user.email} applied for leave`,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Leave applied");
  loadUserLeaves();
}

/**************** ADMIN DASHBOARD ****************/
function loadAdminDashboard() {
  loadAdminLeaves();
  loadAdminNotifications();
}

function loadAdminLeaves() {
  const table = $("adminTable");

  table.innerHTML = `
    <tr>
      <th>Email</th><th>From</th><th>To</th>
      <th>CL</th><th>LOP</th><th>Reason</th>
      <th>Status</th><th>Action</th>
    </tr>`;

  db.collection("leaves")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      snap.forEach(doc => {
        const d = doc.data();
        table.innerHTML += `
          <tr>
            <td>${d.email}</td>
            <td>${d.from}</td>
            <td>${d.to}</td>
            <td>${d.cl}</td>
            <td>${d.lop}</td>
            <td>${d.reason}</td>
            <td>${d.status}</td>
            <td>
              <button onclick="approve('${doc.id}')">✔</button>
              <button onclick="reject('${doc.id}')">✖</button>
            </td>
          </tr>`;
      });
    });
}

/**************** APPROVE / REJECT ****************/
async function approve(id) {
  const ref = db.collection("leaves").doc(id);
  const snap = await ref.get();
  const d = snap.data();

  await ref.update({ status: "APPROVED" });

  await db.collection("users").doc(d.uid).update({
    usedLeaves: firebase.firestore.FieldValue.increment(d.cl)
  });

  await db.collection("notifications").add({
    to: d.uid,
    message: "Your leave was approved",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function reject(id) {
  await db.collection("leaves").doc(id).update({
    status: "REJECTED",
    cl: 0,
    lop: 0
  });
}

/**************** SEARCH (CLIENT SIDE) ****************/
function searchEmail() {
  const term = $("searchEmail").value.toLowerCase();
  const rows = $("adminTable").rows;

  for (let i = 1; i < rows.length; i++) {
    rows[i].style.display =
      rows[i].innerText.toLowerCase().includes(term) ? "" : "none";
  }
}

/**************** EXPORT CSV ****************/
function downloadExcel() {
  let csv = "Email,From,To,CL,LOP,Reason,Status\n";
  const rows = $("adminTable").rows;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i].style.display === "none") continue;
    csv += [...rows[i].cells].slice(0, 7).map(c => `"${c.innerText}"`).join(",") + "\n";
  }

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leaves.csv";
  a.click();
}

/**************** NOTIFICATIONS ****************/
function loadUserNotifications() {
  const box = $("userNotifications");
  box.innerHTML = "";

  db.collection("notifications")
    .where("to", "==", auth.currentUser.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      snap.forEach(d => box.innerHTML += `<li>${d.data().message}</li>`);
    });
}

function loadAdminNotifications() {
  const box = $("adminNotifications");
  box.innerHTML = "";

  db.collection("notifications")
    .where("to", "==", "ADMIN")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      snap.forEach(d => box.innerHTML += `<li>${d.data().message}</li>`);
    });
}
