firebase.initializeApp({
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
  storageBucket: "research-lab-portal.firebasestorage.app"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/***************************************
 🔐 AUTH STATE HANDLER
***************************************/
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  const userDoc = await db.collection("users").doc(user.uid).get();
  const adminDoc = await db.collection("admins").doc(user.uid).get();

  if (adminDoc.exists && location.pathname.includes("admin")) {
    loadAdminDashboard(user);
  } else if (userDoc.exists && location.pathname.includes("user")) {
    loadUserDashboard(user);
  }
});

/***************************************
 🔑 LOGIN
***************************************/
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Email & password required");
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);

    const uid = auth.currentUser.uid;
    const admin = await db.collection("admins").doc(uid).get();

    if (admin.exists) {
      window.location.href = "admin.html";
    } else {
      window.location.href = "user.html";
    }
  } catch (e) {
    alert(e.message);
  }
}

/***************************************
 👁️ PASSWORD TOGGLE
***************************************/
function togglePassword() {
  const p = document.getElementById("password");
  p.type = p.type === "password" ? "text" : "password";
}

/***************************************
 🚪 LOGOUT
***************************************/
function logout() {
  auth.signOut().then(() => (window.location.href = "index.html"));
}

/***************************************
 👤 USER DASHBOARD
***************************************/
async function loadUserDashboard(user) {
  document.getElementById("welcome").innerText = user.email;

  const snap = await db
    .collection("leaveRequests")
    .where("userId", "==", user.uid)
    .get();

  let approvedCL = 0;
  let approvedLOP = 0;

  const table = document.getElementById("myLeaves");
  table.innerHTML = "";

  snap.forEach((doc) => {
    const d = doc.data();

    if (d.status === "APPROVED") {
      approvedCL += d.cl;
      approvedLOP += d.lop;
    }

    table.innerHTML += `
      <tr>
        <td>${d.from}</td>
        <td>${d.to}</td>
        <td>${d.cl}</td>
        <td>${d.lop}</td>
        <td>${d.status}</td>
      </tr>
    `;
  });

  approvedCL = Math.min(approvedCL, 12);
  const remaining = Math.max(12 - approvedCL, 0);

  document.getElementById("totalCL").innerText = 12;
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

  if (!from || !to || !reason) {
    alert("All fields required");
    return;
  }

  const user = auth.currentUser;
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
    const ref = storage.ref(`leave-docs/${user.uid}/${file.name}`);
    await ref.put(file);
    documentUrl = await ref.getDownloadURL();
  }

  await db.collection("leaveRequests").add({
    userId: user.uid,
    email: user.email,
    from,
    to,
    totalDays: days,
    cl,
    lop,
    reason,
    documentUrl,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  alert("Leave applied successfully");
  location.reload();
}

/***************************************
 👑 ADMIN DASHBOARD
***************************************/
async function loadAdminDashboard() {
  const table = document.getElementById("allLeaves");
  table.innerHTML = "";

  db.collection("leaveRequests")
    .orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      table.innerHTML = "";
      snap.forEach((doc) => {
        const d = doc.data();
        table.innerHTML += `
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
          </tr>
        `;
      });
    });
}

/***************************************
 ✅ APPROVE / ❌ REJECT
***************************************/
function approve(id) {
  db.collection("leaveRequests").doc(id).update({ status: "APPROVED" });
}

function reject(id) {
  db.collection("leaveRequests").doc(id).update({ status: "REJECTED" });
}
