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

/******** LOGIN ********/
async function login() {
  const email = emailInput();
  const password = passInput();

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    const admin = await db.collection("admins").doc(uid).get();
    const user = await db.collection("users").doc(uid).get();

    if (admin.exists) location.href = "admin.html";
    else if (user.exists) location.href = "user.html";
    else {
      alert("Access not approved");
      auth.signOut();
    }
  } catch (e) {
    alert(e.message);
  }
}

/******** AUTH GUARD ********/
auth.onAuthStateChanged(user => {
  if (!user && !location.pathname.includes("index.html")) {
    location.replace("index.html");
  }
  if (user && location.pathname.includes("user.html")) loadUserDashboard(user);
  if (user && location.pathname.includes("admin.html")) loadAdminDashboard();
});

/******** LOGOUT ********/
function logout() {
  auth.signOut().then(() => location.replace("index.html"));
}

/******** APPLY LEAVE ********/
async function applyLeave() {
  const user = auth.currentUser;
  const from = fromInput();
  const to = toInput();
  const reason = reasonInput();
  const file = document.getElementById("document").files[0];

  const days = Math.floor((new Date(to) - new Date(from)) / 86400000) + 1;
  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  let fileUrl = null;
  if (file) {
    const ref = storage.ref(`docs/${user.uid}/${file.name}`);
    await ref.put(file);
    fileUrl = await ref.getDownloadURL();
  }

  await db.collection("leaveRequests").add({
    uid: user.uid,
    email: user.email,
    from, to, cl, lop,
    reason,
    fileUrl,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("notifications").add({
    to: "ADMIN",
    message: `${user.email} applied for leave`,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Leave applied");
  location.reload();
}

/******** USER DASHBOARD ********/
async function loadUserDashboard(user) {
  document.getElementById("welcome").innerText = user.email;

  let approvedCL = 0, lopTaken = 0;
  const tbody = document.getElementById("myLeaves");
  tbody.innerHTML = "";

  const snap = await db.collection("leaveRequests")
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
        <td>${d.status}</td>
      </tr>`;
  });

  approvedCL = Math.min(approvedCL, 12);
  document.getElementById("approvedCL").innerText = approvedCL;
  document.getElementById("remainingCL").innerText = Math.max(12 - approvedCL, 0);
  document.getElementById("lopTaken").innerText = lopTaken;

  loadNotifications(user.uid);
}

/******** ADMIN DASHBOARD ********/
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
            <td>${d.status}</td>
            <td>
              <button onclick="approve('${doc.id}')">✔</button>
              <button onclick="reject('${doc.id}','${d.uid}')">✖</button>
            </td>
          </tr>`;
      });
    });

  loadNotifications("ADMIN");
}

/******** APPROVE / REJECT ********/
async function approve(id) {
  await db.collection("leaveRequests").doc(id).update({ status: "APPROVED" });
  await db.collection("notifications").add({
    to: "USER",
    message: "Your leave was approved",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function reject(id, uid) {
  await db.collection("leaveRequests").doc(id).update({ status: "REJECTED" });
  await db.collection("notifications").add({
    to: uid,
    message: "Your leave was rejected",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/******** NOTIFICATIONS ********/
function loadNotifications(target) {
  const list = document.getElementById("notifications");
  if (!list) return;

  db.collection("notifications")
    .orderBy("createdAt", "desc")
    .limit(5)
    .onSnapshot(snap => {
      list.innerHTML = "";
      snap.forEach(doc => {
        list.innerHTML += `<li>${doc.data().message}</li>`;
      });
    });
}

/******** SEARCH ********/
document.addEventListener("input", e => {
  if (e.target.id !== "searchEmail") return;
  const value = e.target.value.toLowerCase();
  document.querySelectorAll("#allLeaves tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(value) ? "" : "none";
  });
});

/******** CSV EXPORT ********/
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

/******** ADD USER ********/
async function addUser() {
  const email = document.getElementById("newUserEmail").value.trim();
  if (!email) return alert("Email required");

  await db.collection("users").add({
    email,
    totalLeaves: 12,
    usedLeaves: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("User profile added (Auth account must exist)");
}

/******** HELPERS ********/
function emailInput(){ return document.getElementById("email").value.trim(); }
function passInput(){ return document.getElementById("password").value; }
function fromInput(){ return document.getElementById("from").value; }
function toInput(){ return document.getElementById("to").value; }
function reasonInput(){ return document.getElementById("reason").value.trim(); }
