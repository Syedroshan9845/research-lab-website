/*************************************************
 🔥 FIREBASE CONFIG – REPLACE WITH YOUR REAL KEYS
*************************************************/
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

/*************************************************
 👁 PASSWORD TOGGLE
*************************************************/
function togglePassword() {
  const p = document.getElementById("password");
  if (!p) return;
  p.type = p.type === "password" ? "text" : "password";
}

/*************************************************
 🔐 LOGIN (NO REDIRECT HERE)
*************************************************/
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

/*************************************************
 🚪 LOGOUT (WORKS 100%)
*************************************************/
function logout() {
  auth.signOut().then(() => {
    location.replace("index.html");
  });
}

/*************************************************
 🔁 AUTH STATE HANDLER (NO RELOAD LOOP)
*************************************************/
auth.onAuthStateChanged(async (user) => {
  const path = location.pathname;

  // NOT LOGGED IN
  if (!user) {
    if (!path.endsWith("index.html")) {
      location.replace("index.html");
    }
    return;
  }

  const uid = user.uid;

  const adminDoc = await db.collection("admins").doc(uid).get();
  const userDoc  = await db.collection("users").doc(uid).get();

  // ADMIN
  if (adminDoc.exists) {
    if (!path.endsWith("admin.html")) {
      location.replace("admin.html");
    } else {
      loadAdminDashboard();
    }
    return;
  }

  // USER
  if (userDoc.exists) {
    if (!path.endsWith("user.html")) {
      location.replace("user.html");
    } else {
      loadUserDashboard(user);
    }
    return;
  }

  alert("No role assigned");
  auth.signOut();
});

/*************************************************
 👤 USER DASHBOARD
*************************************************/
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
        <td class="status ${d.status}">${d.status}</td>
      </tr>`;
  });

  approvedCL = Math.min(approvedCL, 12);

  document.getElementById("totalCL").innerText = 12;
  document.getElementById("approvedCL").innerText = approvedCL;
  document.getElementById("remainingCL").innerText = Math.max(12 - approvedCL, 0);
  document.getElementById("lopTaken").innerText = approvedLOP;

  loadUserNotifications(user.uid);
}

/*************************************************
 📝 APPLY LEAVE (WORKING)
*************************************************/
async function applyLeave() {
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const reason = document.getElementById("reason").value.trim();
  const file = document.getElementById("document").files[0];
  const user = auth.currentUser;

  if (!from || !to || !reason) {
    alert("All fields required");
    return;
  }

  const days = Math.floor(
    (new Date(to) - new Date(from)) / 86400000
  ) + 1;

  if (days <= 0) {
    alert("Invalid date range");
    return;
  }

  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  let documentUrl = null;
  if (file) {
    const ref = storage.ref(`documents/${user.uid}/${file.name}`);
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

  // USER NOTIFICATION
  await db.collection("notifications").add({
    uid: user.uid,
    message: "Leave request submitted",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // ADMIN NOTIFICATION
  await db.collection("notifications").add({
    uid: "ADMIN",
    message: `${user.email} applied for leave`,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Leave applied successfully");
  location.reload();
}

/*************************************************
 🔔 USER NOTIFICATIONS
*************************************************/
async function loadUserNotifications(uid) {
  const box = document.getElementById("userNotifications");
  box.innerHTML = "";

  const snap = await db.collection("notifications")
    .where("uid", "in", [uid, "ALL"])
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  snap.forEach(doc => {
    box.innerHTML += `<li>${doc.data().message}</li>`;
  });
}

/*************************************************
 👑 ADMIN DASHBOARD
*************************************************/
function loadAdminDashboard() {
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
            <td class="status ${d.status}">${d.status}</td>
            <td>
              <button onclick="approve('${doc.id}')">✔</button>
              <button onclick="reject('${doc.id}')">✖</button>
            </td>
          </tr>`;
      });
    });

  loadAdminNotifications();
}

/*************************************************
 ✅ APPROVE / ❌ REJECT
*************************************************/
async function approve(id) {
  const ref = db.collection("leaves").doc(id);
  const snap = await ref.get();
  const d = snap.data();

  await ref.update({ status: "APPROVED" });

  await db.collection("users").doc(d.uid).update({
    usedLeaves: firebase.firestore.FieldValue.increment(d.cl)
  });

  await db.collection("notifications").add({
    uid: d.uid,
    message: "Your leave was APPROVED",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function reject(id) {
  const ref = db.collection("leaves").doc(id);
  const snap = await ref.get();
  const d = snap.data();

  await ref.update({ status: "REJECTED" });

  await db.collection("notifications").add({
    uid: d.uid,
    message: "Your leave was REJECTED",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/*************************************************
 🔍 SEARCH (CLIENT SIDE)
*************************************************/
function searchLeaves() {
  const q = document.getElementById("searchEmail").value.toLowerCase();
  document.querySelectorAll("#allLeaves tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
  });
}

/*************************************************
 📤 EXPORT CSV
*************************************************/
function exportCSV() {
  let csv = "Email,From,To,CL,LOP,Status\n";
  document.querySelectorAll("#allLeaves tr").forEach(row => {
    const cols = row.querySelectorAll("td");
    if (cols.length) {
      csv += Array.from(cols).slice(0, 6).map(td => td.innerText).join(",") + "\n";
    }
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leave_report.csv";
  a.click();
}

/*************************************************
 🔔 ADMIN NOTIFICATIONS
*************************************************/
async function loadAdminNotifications() {
  const box = document.getElementById("adminNotifications");
  box.innerHTML = "";

  const snap = await db.collection("notifications")
    .where("uid", "==", "ADMIN")
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  snap.forEach(doc => {
    box.innerHTML += `<li>${doc.data().message}</li>`;
  });
}
