/***************************************
 🔥 FIREBASE CONFIG (REPLACE WITH YOURS)
***************************************/
var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app",
  messagingSenderId: "149246738052",
  appId: "1:149246738052:web:f751d671a4ee32b3acccd1",
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/***************************************
 👁 PASSWORD TOGGLE
***************************************/
function togglePassword() {
  const p = document.getElementById("password");
  if (p) p.type = p.type === "password" ? "text" : "password";
}

/***************************************
 🔐 LOGIN
***************************************/
function login() {
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  if (!email || !password) {
    alert("Email & password required");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .catch(err => alert(err.message));
}

/***************************************
 🔁 AUTH STATE HANDLER (VERY IMPORTANT)
***************************************/
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const uid = user.uid;

  const adminDoc = await db.collection("admins").doc(uid).get();
  const userDoc  = await db.collection("users").doc(uid).get();

  // ADMIN
  if (adminDoc.exists) {
    if (!location.pathname.includes("admin.html")) {
      location.replace("admin.html");
      return;
    }
    loadAdminDashboard();
  }

  // USER
  else if (userDoc.exists) {
    if (!location.pathname.includes("user.html")) {
      location.replace("user.html");
      return;
    }
    loadUserDashboard(user);
  }

  // NO ROLE
  else {
    alert("User role not assigned. Contact admin.");
    auth.signOut();
  }
});

/***************************************
 🚪 LOGOUT
***************************************/
function logout() {
  auth.signOut().then(() => location.replace("index.html"));
}

/***************************************
 👤 USER DASHBOARD
***************************************/
async function loadUserDashboard(user) {
  document.getElementById("welcome").innerText = user.email;

  let approvedCL = 0;
  let approvedLOP = 0;

  const tbody = document.getElementById("myLeaves");
  tbody.innerHTML = "";

  const snap = await db.collection("leaveRequests")
    .where("uid", "==", user.uid)
    .orderBy("createdAt", "desc")
    .get();

  snap.forEach(doc => {
    const d = doc.data();

    if (d.status === "APPROVED") {
      approvedCL += d.cl;
      approvedLOP += d.lop;
    }

    tbody.innerHTML += `
      <tr>
        <td>${d.from}</td>
        <td>${d.to}</td>
        <td>${d.cl}</td>
        <td>${d.lop}</td>
        <td class="status ${d.status}">${d.status}</td>
      </tr>
    `;
  });

  approvedCL = Math.min(approvedCL, 12);
  const remaining = Math.max(12 - approvedCL, 0);

  document.getElementById("approvedCL").innerText = approvedCL;
  document.getElementById("remainingCL").innerText = remaining;
  document.getElementById("lopTaken").innerText = approvedLOP;
}

/***************************************
 📝 APPLY LEAVE
***************************************/
async function applyLeave() {
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const reason = document.getElementById("reason").value.trim();
  const file = document.getElementById("document").files[0];
  const user = auth.currentUser;

  if (!from || !to || !reason) {
    alert("All fields are required");
    return;
  }

  const MS = 24 * 60 * 60 * 1000;
  const days = Math.floor((new Date(to) - new Date(from)) / MS) + 1;

  if (days <= 0) {
    alert("Invalid date range");
    return;
  }

  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  let documentUrl = null;
  if (file) {
    const ref = storage.ref(`leaveDocs/${user.uid}/${Date.now()}_${file.name}`);
    await ref.put(file);
    documentUrl = await ref.getDownloadURL();
  }

  await db.collection("leaveRequests").add({
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

  alert("Leave applied successfully");
  location.reload();
}

/***************************************
 👑 ADMIN DASHBOARD
***************************************/
function loadAdminDashboard() {
  const tbody = document.getElementById("allLeaves");

  db.collection("leaveRequests")
    .orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      tbody.innerHTML = "";

      snap.forEach(doc => {
        const d = doc.data();

        tbody.innerHTML += `
          <tr>
            <td>${d.email}</td>
            <td>${d.from}</td>
            <td>${d.to}</td>
            <td>${d.cl}</td>
            <td>${d.lop}</td>
            <td class="status ${d.status}">${d.status}</td>
            <td>
              <button onclick="approve('${doc.id}')">✔</button>
              <button onclick="reject('${doc.id}')">✖</button>
            </td>
          </tr>
        `;
      });
    });
}

/***************************************
 ✅ APPROVE / ❌ REJECT
***************************************/
async function approve(id) {
  await db.collection("leaveRequests").doc(id).update({
    status: "APPROVED"
  });
}

async function reject(id) {
  await db.collection("leaveRequests").doc(id).update({
    status: "REJECTED"
  });
}

/***************************************
 🔍 SEARCH (ADMIN)
***************************************/
document.addEventListener("input", (e) => {
  if (e.target.id !== "searchEmail") return;

  const value = e.target.value.toLowerCase();
  document.querySelectorAll("#allLeaves tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(value) ? "" : "none";
  });
});

/***************************************
 📤 EXPORT EXCEL (CSV)
***************************************/
function exportCSV() {
  let csv = "Email,From,To,CL,LOP,Status\n";

  document.querySelectorAll("#allLeaves tr").forEach(row => {
    const cols = row.querySelectorAll("td");
    if (cols.length) {
      csv += [...cols].slice(0,6).map(td => td.innerText).join(",") + "\n";
    }
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leave_report.csv";
  a.click();
}

/***************************************
 👤 ADD USER (ADMIN)
***************************************/
async function addUser() {
  const email = document.getElementById("newUserEmail").value.trim();
  if (!email) return alert("Email required");

  await db.collection("users").add({
    email,
    totalLeaves: 12,
    usedLeaves: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("User added to Firestore (Auth account must exist)");
}
