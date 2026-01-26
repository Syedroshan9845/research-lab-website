/************ FIREBASE CONFIG ************/
var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/************ PASSWORD TOGGLE ************/
function togglePassword() {
  const p = document.getElementById("password");
  if (p) p.type = p.type === "password" ? "text" : "password";
}

/************ LOGIN ************/
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Email and password required");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .catch(e => alert(e.message));
}

/************ LOGOUT ************/
function logout() {
  auth.signOut().then(() => location.replace("index.html"));
}

/************ AUTH ROUTING (NO LOOP) ************/
auth.onAuthStateChanged(async (user) => {
  const path = location.pathname;

  if (!user) {
    if (!path.endsWith("index.html")) location.replace("index.html");
    return;
  }

  const admin = await db.collection("admins").doc(user.uid).get();
  const normal = await db.collection("users").doc(user.uid).get();

  if (admin.exists) {
    if (!path.endsWith("admin.html")) location.replace("admin.html");
    else loadAdmin();
  } else if (normal.exists) {
    if (!path.endsWith("user.html")) location.replace("user.html");
    else loadUser(user);
  } else {
    alert("Role not assigned");
    auth.signOut();
  }
});

/************ USER DASHBOARD ************/
async function loadUser(user) {
  document.getElementById("welcome").innerText = user.email;

  let approvedCL = 0;
  let lopTaken = 0;
  const tbody = document.getElementById("myLeaves");
  tbody.innerHTML = "";

  const snap = await db.collection("leaves")
    .where("uid", "==", user.uid)
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
      </tr>`;
  });

  approvedCL = Math.min(approvedCL, 12);
  document.getElementById("approvedCL").innerText = approvedCL;
  document.getElementById("remainingCL").innerText = Math.max(12 - approvedCL, 0);
  document.getElementById("lopTaken").innerText = lopTaken;
}

/************ APPLY LEAVE ************/
async function applyLeave() {
  const user = auth.currentUser;
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const reason = document.getElementById("reason").value.trim();

  if (!from || !to || !reason) {
    alert("Reason is mandatory");
    return;
  }

  const days = (new Date(to) - new Date(from)) / 86400000 + 1;
  if (days <= 0) {
    alert("Invalid date range");
    return;
  }

  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  await db.collection("leaves").add({
    uid: user.uid,
    email: user.email,
    from,
    to,
    cl,
    lop,
    reason,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Leave applied");
  location.reload();
}

/************ ADMIN DASHBOARD ************/
function loadAdmin() {
  const tbody = document.getElementById("allLeaves");

  db.collection("leaves")
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

/************ APPROVE / REJECT ************/
function approve(id) {
  db.collection("leaves").doc(id).update({ status: "APPROVED" });
}

function reject(id) {
  db.collection("leaves").doc(id).update({
    status: "REJECTED",
    cl: 0,
    lop: 0
  });
}

/************ SEARCH ************/
function searchLeaves() {
  const q = document.getElementById("searchEmail").value.toLowerCase();
  document.querySelectorAll("#allLeaves tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
  });
}

/************ EXPORT CSV (DATE FILTER) ************/
function exportCSV() {
  const from = document.getElementById("fromDate").value;
  const to = document.getElementById("toDate").value;

  let csv = "Email,From,To,CL,LOP,Reason,Status\n";

  document.querySelectorAll("#allLeaves tr").forEach(row => {
    const cols = row.querySelectorAll("td");
    if (!cols.length) return;

    const rowFrom = cols[1].innerText;
    const rowTo = cols[2].innerText;

    if ((!from || rowFrom >= from) && (!to || rowTo <= to)) {
      csv += Array.from(cols)
        .slice(0, 7)
        .map(td => td.innerText.replace(/,/g, " "))
        .join(",") + "\n";
    }
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv]));
  a.download = "leave_report.csv";
  a.click();
}
