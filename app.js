/******************** FIREBASE CONFIG ********************/
var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app",
  messagingSenderId: "149246738052",
  appId: "1:149246738052:web:f751d671a4ee32b3acccd1"
};

firebase.initializeApp(firebaseConfig);

var auth = firebase.auth();
var db = firebase.firestore();
var storage = firebase.storage();

/******************** PASSWORD TOGGLE ********************/
function togglePassword() {
  const p = document.getElementById("password");
  if (p) p.type = p.type === "password" ? "text" : "password";
}

/******************** LOGIN ********************/
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Enter email and password");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      // DO NOTHING HERE
      // Redirect handled by auth listener
    })
    .catch(err => alert(err.message));
}

/******************** AUTH STATE LISTENER (CRITICAL) ********************/
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const uid = user.uid;

  // Check admin
  const adminDoc = await db.collection("admins").doc(uid).get();
  if (adminDoc.exists) {
    if (!location.pathname.includes("admin.html")) {
      window.location.replace("admin.html");
    }
    loadAdminDashboard();
    return;
  }

  // Check user
  const userDoc = await db.collection("users").doc(uid).get();
  if (userDoc.exists) {
    if (!location.pathname.includes("user.html")) {
      window.location.replace("user.html");
    }
    loadUserDashboard();
    return;
  }

  alert("No role assigned. Contact admin.");
  auth.signOut();
});

/******************** LOGOUT ********************/
function logout() {
  auth.signOut().then(() => {
    window.location.replace("index.html");
  });
}

/******************** USER DASHBOARD ********************/
async function loadUserDashboard() {
  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;
  document.getElementById("welcome").innerText = user.email;

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const data = userSnap.data();

  const totalCL = data.totalLeaves || 12;
  const approvedCL = data.usedLeaves || 0;
  const remainingCL = Math.max(totalCL - approvedCL, 0);

  document.getElementById("totalCL").innerText = totalCL;
  document.getElementById("approvedCL").innerText = approvedCL;
  document.getElementById("remainingCL").innerText = remainingCL;

  loadMyLeaves(uid);
}

/******************** APPLY LEAVE ********************/
async function applyLeave() {
  const user = auth.currentUser;
  if (!user) return;

  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const reason = document.getElementById("reason").value.trim();

  if (!from || !to || !reason) {
    alert("All fields are mandatory");
    return;
  }

  const start = new Date(from);
  const end = new Date(to);
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

  let cl = Math.min(days, 2);
  let lop = Math.max(days - 2, 0);

  await db.collection("leaveRequests").add({
    uid: user.uid,
    email: user.email,
    from,
    to,
    days,
    cl,
    lop,
    reason,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Leave applied");
  loadMyLeaves(user.uid);
}

/******************** LOAD USER LEAVES ********************/
async function loadMyLeaves(uid) {
  const tbody = document.getElementById("myLeaves");
  tbody.innerHTML = "";

  const snap = await db.collection("leaveRequests")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .get();

  snap.forEach(doc => {
    const d = doc.data();
    tbody.innerHTML += `
      <tr>
        <td>${d.from}</td>
        <td>${d.to}</td>
        <td>${d.cl}</td>
        <td>${d.lop}</td>
        <td>${d.status}</td>
      </tr>
    `;
  });
}

/******************** ADMIN DASHBOARD ********************/
async function loadAdminDashboard() {
  const tbody = document.getElementById("allLeaves");
  if (!tbody) return;

  tbody.innerHTML = "";

  const snap = await db.collection("leaveRequests")
    .orderBy("createdAt", "desc")
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
        <td>${d.status}</td>
        <td>
          <button onclick="approve('${doc.id}', '${d.uid}', ${d.cl})">✔</button>
          <button onclick="reject('${doc.id}')">✖</button>
        </td>
      </tr>
    `;
  });
}

/******************** APPROVE / REJECT ********************/
async function approve(id, uid, cl) {
  await db.collection("leaveRequests").doc(id).update({ status: "APPROVED" });
  await db.collection("users").doc(uid).update({
    usedLeaves: firebase.firestore.FieldValue.increment(cl)
  });
  loadAdminDashboard();
}

async function reject(id) {
  await db.collection("leaveRequests").doc(id).update({ status: "REJECTED" });
  loadAdminDashboard();
}
