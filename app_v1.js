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

/**************** PASSWORD TOGGLE ****************/
function togglePassword() {
  const p = document.getElementById("password");
  if (p) p.type = p.type === "password" ? "text" : "password";
}

/**************** LOGIN ****************/
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

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
    window.location.href = "index.html";
  });
}

/**************** AUTH STATE ****************/
auth.onAuthStateChanged(async user => {
  if (!user) return;

  const adminSnap = await db.collection("admins").doc(user.uid).get();
  const userSnap  = await db.collection("users").doc(user.uid).get();

  if (adminSnap.exists) {
    if (!location.pathname.includes("admin.html")) {
      window.location.href = "admin.html";
    } else {
      loadAdminDashboard();
    }
  } else if (userSnap.exists) {
    if (!location.pathname.includes("user.html")) {
      window.location.href = "user.html";
    } else {
      loadUserDashboard(user);
    }
  } else {
    alert("Role not assigned");
    auth.signOut();
  }
});

/**************** USER DASHBOARD ****************/
async function loadUserDashboard(user) {
  document.getElementById("welcome").innerText = user.email;

  let approvedCL = 0;
  let approvedLOP = 0;

  const tbody = document.getElementById("myLeaves");
  tbody.innerHTML = "";

  const snap = await db.collection("leaves")
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
        <td>${d.reason}</td>
        <td>${d.status}</td>
      </tr>`;
  });

  document.getElementById("approvedCL").innerText = approvedCL;
  document.getElementById("remainingCL").innerText = Math.max(12 - approvedCL, 0);
  document.getElementById("lopTaken").innerText = approvedLOP;
}

/**************** APPLY LEAVE ****************/
async function applyLeave() {
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const reason = document.getElementById("reason").value.trim();
  const file = document.getElementById("document").files[0];
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
    const ref = storage.ref(`leaveDocs/${user.uid}/${Date.now()}_${file.name}`);
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

  alert("Leave applied successfully");
  loadUserDashboard(user);
}

/**************** ADMIN DASHBOARD ****************/
function loadAdminDashboard() {
  const tbody = document.getElementById("allLeaves");

  db.collection("leaves")
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      tbody.innerHTML = "";

      snapshot.forEach(doc => {
        const d = doc.data();

        tbody.innerHTML += `
          <tr>
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
          </tr>`;
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

/**************** SEARCH (ADMIN) ****************/
async function searchByEmail() {
  const email = document.getElementById("searchEmail").value.trim();
  const tbody = document.getElementById("allLeaves");
  tbody.innerHTML = "";

  const snap = await db.collection("leaves")
    .where("email", "==", email)
    .get();

  snap.forEach(doc => {
    const d = doc.data();
    tbody.innerHTML += `
      <tr>
        <td>${d.email}</td>
        <td>${d.from}</td>
        <td>${d.to}</td>
        <td>${d.cl}</td>
        <td>${d.lop}</td>
        <td>${d.reason}</td>
        <td>${d.status}</td>
        <td></td>
      </tr>`;
  });
}

/**************** EXPORT CSV ****************/
async function exportCSV() {
  const snap = await db.collection("leaves").get();
  let csv = "Email,From,To,CL,LOP,Reason,Status\n";

  snap.forEach(doc => {
    const d = doc.data();
    csv += `${d.email},${d.from},${d.to},${d.cl},${d.lop},"${d.reason}",${d.status}\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leave_report.csv";
  a.click();
}
