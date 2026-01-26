var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/* PASSWORD TOGGLE */
function togglePassword() {
  const p = document.getElementById("password");
  if (p) p.type = p.type === "password" ? "text" : "password";
}

/* LOGIN */
function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  auth.signInWithEmailAndPassword(email, password)
    .catch(e => alert(e.message));
}

/* LOGOUT */
function logout() {
  auth.signOut().then(() => location.replace("index.html"));
}

/* AUTH ROUTING */
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

/* USER */
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
        <td>${d.status}</td>
      </tr>`;
  });

  approvedCL = Math.min(approvedCL, 12);
  document.getElementById("approvedCL").innerText = approvedCL;
  document.getElementById("remainingCL").innerText = 12 - approvedCL;
  document.getElementById("lopTaken").innerText = lopTaken;
}

/* APPLY LEAVE */
async function applyLeave() {
  const user = auth.currentUser;
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;

  const days = (new Date(to) - new Date(from)) / 86400000 + 1;
  if (days <= 0) return alert("Invalid dates");

  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  await db.collection("leaves").add({
    uid: user.uid,
    email: user.email,
    from,
    to,
    cl,
    lop,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Leave applied");
  location.reload();
}

/* ADMIN */
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
            <td>${d.status}</td>
            <td>
              <button onclick="approve('${doc.id}')">✔</button>
              <button onclick="reject('${doc.id}')">✖</button>
            </td>
          </tr>`;
      });
    });
}

function approve(id) {
  db.collection("leaves").doc(id).update({ status: "APPROVED" });
}
function reject(id) {
  db.collection("leaves").doc(id).update({ status: "REJECTED" });
}

/* SEARCH */
function searchLeaves() {
  const q = document.getElementById("searchEmail").value.toLowerCase();
  document.querySelectorAll("#allLeaves tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
  });
}

/* EXPORT */
function exportCSV() {
  let csv = "Email,From,To,CL,LOP,Status\n";
  document.querySelectorAll("#allLeaves tr").forEach(row => {
    const cols = row.querySelectorAll("td");
    if (cols.length) {
      csv += Array.from(cols).slice(0,6).map(td => td.innerText).join(",") + "\n";
    }
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv]));
  a.download = "leaves.csv";
  a.click();
}
