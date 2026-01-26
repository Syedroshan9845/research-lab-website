firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    // Not logged in → force login
    if (!location.pathname.includes("index.html")) {
      location.replace("index.html");
    }
    return;
  }

  const uid = user.uid;

  // Check admin
  const adminSnap = await firebase.firestore()
    .collection("admins")
    .doc(uid)
    .get();

  // Check user
  const userSnap = await firebase.firestore()
    .collection("users")
    .doc(uid)
    .get();

  // ADMIN LOGIC
  if (adminSnap.exists) {
    if (!location.pathname.includes("admin.html")) {
      location.replace("admin.html");
    }
    return;
  }

  // USER LOGIC
  if (userSnap.exists) {
    if (!location.pathname.includes("user.html")) {
      location.replace("user.html");
    }
    return;
  }

  // Fallback
  alert("Role not assigned. Contact admin.");
  firebase.auth().signOut();
  location.replace("index.html");
});

/************ FIREBASE CONFIG ************/
firebase.initializeApp({
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app"
});

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/************ PASSWORD TOGGLE ************/
function togglePassword() {
  const p = document.getElementById("password");
  p.type = p.type === "password" ? "text" : "password";
}

/************ LOGIN ************/
function login() {
  auth.signInWithEmailAndPassword(
    document.getElementById("email").value,
    document.getElementById("password").value
  ).catch(e => alert(e.message));
}

/************ AUTH ROUTING ************/
auth.onAuthStateChanged(async user => {
  if (!user) return;

  const admin = await db.collection("admins").doc(user.uid).get();
  const usr = await db.collection("users").doc(user.uid).get();

  if (admin.exists) location.href = "admin.html";
  else if (usr.exists) location.href = "user.html";
  else alert("Role not assigned");
});

/************ LOGOUT ************/
function logout() {
  auth.signOut().then(() => location.href = "index.html");
}

/************ USER DASHBOARD ************/
async function loadUser() {
  const user = auth.currentUser;
  document.getElementById("emailTxt").innerText = user.email;

  let approvedCL = 0, lopTaken = 0;
  const tbody = document.getElementById("history");

  const snap = await db.collection("leaveRequests")
    .where("uid", "==", user.uid).get();

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
  document.getElementById("remainingCL").innerText = 12 - approvedCL;
  document.getElementById("lopTaken").innerText = lopTaken;
}

/************ APPLY LEAVE ************/
async function applyLeave() {
  const user = auth.currentUser;
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const reason = document.getElementById("reason").value;
  const file = document.getElementById("doc").files[0];

  const days = (new Date(to) - new Date(from)) / 86400000 + 1;
  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  let url = "";
  if (file) {
    const ref = storage.ref(`docs/${user.uid}/${file.name}`);
    await ref.put(file);
    url = await ref.getDownloadURL();
  }

  await db.collection("leaveRequests").add({
    uid: user.uid,
    email: user.email,
    from, to, cl, lop, reason,
    documentUrl: url,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("notifications").add({
    uid: user.uid,
    message: "Leave applied",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  location.reload();
}

/************ ADMIN ************/
function loadAdmin() {
  const tbody = document.getElementById("adminTable");

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
              <button onclick="approve('${doc.id}','${d.uid}',${d.cl})">✔</button>
              <button onclick="reject('${doc.id}','${d.uid}')">✖</button>
            </td>
          </tr>`;
      });
    });
}

async function approve(id, uid, cl) {
  await db.collection("leaveRequests").doc(id).update({ status: "APPROVED" });
  await db.collection("notifications").add({
    uid,
    message: "Leave approved",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function reject(id, uid) {
  await db.collection("leaveRequests").doc(id).update({ status: "REJECTED" });
  await db.collection("notifications").add({
    uid,
    message: "Leave rejected",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/************ EXPORT ************/
function exportExcel() {
  db.collection("leaveRequests").get().then(snap => {
    let csv = "Email,From,To,CL,LOP,Status\n";
    snap.forEach(d => {
      const x = d.data();
      csv += `${x.email},${x.from},${x.to},${x.cl},${x.lop},${x.status}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "leaves.csv";
    a.click();
  });
}

