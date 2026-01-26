var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/**************** HELPERS ****************/
function $(id) {
  return document.getElementById(id);
}
function currentPage() {
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

/**************** AUTH ROUTING ****************/
auth.onAuthStateChanged(async user => {
  const page = currentPage();

  if (!user) {
    if (page !== "index.html") location.replace("index.html");
    return;
  }

  const adminSnap = await db.collection("admins").doc(user.uid).get();
  const userSnap  = await db.collection("users").doc(user.uid).get();

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

  alert("Role not assigned. Contact admin.");
  auth.signOut();
});

/**************** USER DASHBOARD ****************/
async function loadUserDashboard() {
  const user = auth.currentUser;
  if ($("userEmail")) $("userEmail").innerText = user.email;
  if ($("totalCL")) $("totalCL").innerText = 12;

  loadUserLeaves();
  loadUserNotifications();
}

async function loadUserLeaves() {
  const user = auth.currentUser;
  const tbody = $("myLeaves");
  if (!tbody) return;

  tbody.innerHTML = "";

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

    tbody.innerHTML += `
      <tr>
        <td>${d.from}</td>
        <td>${d.to}</td>
        <td>${d.cl}</td>
        <td>${d.lop}</td>
        <td>${d.reason}</td>
        <td>${d.status}</td>
      </tr>
    `;
  });

  if ($("approvedCL")) $("approvedCL").innerText = approvedCL;
  if ($("remainingCL")) $("remainingCL").innerText = Math.max(12 - approvedCL, 0);
  if ($("lopTaken")) $("lopTaken").innerText = lopTaken;
}

/**************** APPLY LEAVE ****************/
async function applyLeave() {
  const from = $("from").value;
  const to = $("to").value;
  const reason = $("reason").value.trim();
  const file = $("document") ? $("document").files[0] : null;
  const user = auth.currentUser;

  if (!from || !to || !reason) {
    alert("Dates and reason are mandatory");
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
    const ref = storage.ref(`leave_docs/${user.uid}/${file.name}`);
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

  alert("Leave applied successfully");
  loadUserLeaves();
}

/**************** ADMIN DASHBOARD ****************/
function loadAdminDashboard() {
  loadAdminLeaves();
  loadAdminNotifications();
}

function loadAdminLeaves() {
  const tbody = $("adminTableBody");
  if (!tbody) return;

  db.collection("leaves")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      tbody.innerHTML = "";

      snapshot.forEach(doc => {
        const d = doc.data();

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${d.email}</td>
          <td>${d.from}</td>
          <td>${d.to}</td>
          <td>${d.cl}</td>
          <td>${d.lop}</td>
          <td>${d.reason}</td>
          <td>${d.status}</td>
          <td>
            <button onclick="approveLeave('${doc.id}')">✔</button>
            <button onclick="rejectLeave('${doc.id}')">✖</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });
}

/**************** APPROVE / REJECT ****************/
async function approveLeave(id) {
  await db.collection("leaves").doc(id).update({
    status: "APPROVED"
  });
}

async function rejectLeave(id) {
  await db.collection("leaves").doc(id).update({
    status: "REJECTED",
    cl: 0,
    lop: 0
  });
}

/**************** SEARCH ****************/
function searchEmail() {
  const term = $("searchInput").value.toLowerCase();
  document.querySelectorAll("#adminTableBody tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(term)
      ? ""
      : "none";
  });
}

/**************** EXPORT CSV ****************/
function downloadExcel() {
  let csv = "Email,From,To,CL,LOP,Reason,Status\n";

  document.querySelectorAll("#adminTableBody tr").forEach(row => {
    if (row.style.display === "none") return;
    const cols = row.querySelectorAll("td");
    csv += [
      cols[0].innerText,
      cols[1].innerText,
      cols[2].innerText,
      cols[3].innerText,
      cols[4].innerText,
      `"${cols[5].innerText.replace(/"/g, "")}"`,
      cols[6].innerText
    ].join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leave_report.csv";
  a.click();
}

/**************** NOTIFICATIONS ****************/
function loadUserNotifications() {
  const box = $("userNotifications");
  if (!box) return;

  box.innerHTML = "";
  db.collection("notifications")
    .where("to", "==", auth.currentUser.uid)
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      box.innerHTML = "";
      snapshot.forEach(doc => {
        box.innerHTML += `<li>${doc.data().message}</li>`;
      });
    });
}

function loadAdminNotifications() {
  const box = $("adminNotifications");
  if (!box) return;

  box.innerHTML = "";
  db.collection("notifications")
    .where("to", "==", "ADMIN")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      box.innerHTML = "";
      snapshot.forEach(doc => {
        box.innerHTML += `<li>${doc.data().message}</li>`;
      });
    });
}

