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

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/*************** PASSWORD TOGGLE ***************/
function togglePassword() {
  const p = document.getElementById("password");
  if (p) p.type = p.type === "password" ? "text" : "password";
}

/*************** LOGIN ***************/
function login() {
  const email = emailInput();
  const password = passInput();

  if (!email || !password) {
    alert("Email & password required");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .catch(e => alert(e.message));
}

function emailInput() { return document.getElementById("email").value.trim(); }
function passInput() { return document.getElementById("password").value; }

/*************** AUTH STATE ***************/
auth.onAuthStateChanged(async user => {
  if (!user) return;

  const uid = user.uid;

  const adminDoc = await db.collection("admins").doc(uid).get();
  const userDoc = await db.collection("users").doc(uid).get();

  if (adminDoc.exists) {
    if (!location.pathname.includes("admin.html")) {
      location.replace("admin.html");
      return;
    }
    loadAdminDashboard();
  } else if (userDoc.exists) {
    if (!location.pathname.includes("user.html")) {
      location.replace("user.html");
      return;
    }
    loadUserDashboard(user);
  } else {
    alert("User role not assigned");
    auth.signOut();
  }
});

/*************** LOGOUT ***************/
function logout() {
  auth.signOut().then(() => location.replace("index.html"));
}

/*************** USER DASHBOARD ***************/
async function loadUserDashboard(user) {
  document.getElementById("welcome").innerText = user.email;

  let approvedCL = 0;
  let approvedLOP = 0;

  const snap = await db.collection("leaveRequests")
    .where("uid", "==", user.uid)
    .get();

  const tbody = document.getElementById("myLeaves");
  tbody.innerHTML = "";

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
        <td>${d.status}</td>
      </tr>`;
  });

  approvedCL = Math.min(approvedCL, 12);
  document.getElementById("approvedCL").innerText = approvedCL;
  document.getElementById("remainingCL").innerText = Math.max(12 - approvedCL, 0);
  document.getElementById("lopTaken").innerText = approvedLOP;
}

/*************** APPLY LEAVE ***************/
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

  const days = Math.floor((new Date(to) - new Date(from)) / 86400000) + 1;
  if (days <= 0) {
    alert("Invalid date range");
    return;
  }

  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  let documentUrl = null;
  if (file) {
    const ref = storage.ref(`leaveDocs/${user.uid}/${file.name}`);
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

  alert("Leave applied");
  location.reload();
}

/*************** ADMIN DASHBOARD ***************/
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
              <button onclick="reject('${doc.id}')">✖</button>
            </td>
          </tr>`;
      });
    });
}

/*************** APPROVE / REJECT ***************/
async function approve(id) {
  const ref = db.collection("leaveRequests").doc(id);
  const snap = await ref.get();
  const d = snap.data();

  await ref.update({ status: "APPROVED" });
  await db.collection("users").doc(d.uid).update({
    usedLeaves: firebase.firestore.FieldValue.increment(d.cl)
  });
}

async function reject(id) {
  await db.collection("leaveRequests").doc(id).update({ status: "REJECTED" });
}

