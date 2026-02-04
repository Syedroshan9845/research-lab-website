firebase.initializeApp({
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app"
});

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* ---------- AUTH STATE ---------- */
auth.onAuthStateChanged(async user => {
  if (!user) return;

  const snap = await db.collection("users").doc(user.uid).get();
  if (!snap.exists) return auth.signOut();

  const role = snap.data().role;

  if (role === "ADMIN" && !location.pathname.includes("admin"))
    location.replace("admin.html");

  if (role === "USER" && !location.pathname.includes("user"))
    location.replace("user.html");
});

/* ---------- LOGIN ---------- */
function login() {
  auth.signInWithEmailAndPassword(email.value, password.value)
    .catch(e => alert(e.message));
}

/* ---------- LOGOUT ---------- */
function logout() {
  auth.signOut().then(() => location.replace("index.html"));
}

/* ---------- PASSWORD ---------- */
function togglePassword() {
  password.type = password.type === "password" ? "text" : "password";
}

/* ---------- APPLY LEAVE ---------- */
async function applyLeave() {
  if (!reason.value.trim()) return alert("Reason required");

  const days = Math.floor(
    (new Date(to.value) - new Date(from.value)) / 86400000
  ) + 1;

  const approved = await db.collection("leaves")
    .where("uid", "==", auth.currentUser.uid)
    .where("status", "==", "APPROVED")
    .get();

  let usedCL = 0;
  approved.forEach(d => usedCL += d.data().cl);

  const month = new Date().getMonth() + 1;
  const maxCL = Math.min(month, 3);
  const remaining = Math.max(maxCL - usedCL, 0);

  const cl = Math.min(days, remaining);
  const lop = Math.max(days - remaining, 0);

  let fileUrl = "";
  if (file.files[0]) {
    const ref = storage.ref(`docs/${auth.currentUser.uid}/${file.files[0].name}`);
    await ref.put(file.files[0]);
    fileUrl = await ref.getDownloadURL();
  }

  await db.collection("leaves").add({
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    from: from.value,
    to: to.value,
    cl, lop,
    reason: reason.value,
    fileUrl,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Leave applied");
}

/* ---------- USER LEAVES ---------- */
function loadUserLeaves() {
  db.collection("leaves")
    .where("uid", "==", auth.currentUser.uid)
    .onSnapshot(snap => {
      myLeaves.innerHTML = "";
      snap.forEach(d => {
        const x = d.data();
        myLeaves.innerHTML += `
          <tr>
            <td>${x.from}</td>
            <td>${x.to}</td>
            <td>${x.cl}</td>
            <td>${x.lop}</td>
            <td>${x.status}</td>
          </tr>`;
      });
    });
}

/* ---------- ADMIN ---------- */
function loadAdmin() {
  db.collection("leaves")
    .onSnapshot(snap => {
      allLeaves.innerHTML = "";
      snap.forEach(d => {
        const x = d.data();
        allLeaves.innerHTML += `
          <tr>
            <td>${x.email}</td>
            <td>${x.from}</td>
            <td>${x.to}</td>
            <td>${x.cl}</td>
            <td>${x.lop}</td>
            <td>${x.reason}</td>
            <td>${x.status}</td>
            <td>
              <button onclick="confirmApprove('${d.id}')">✔</button>
              <button onclick="confirmReject('${d.id}')">✖</button>
            </td>
          </tr>`;
      });
    });
}

function confirmApprove(id) {
  if (confirm("Approve leave?"))
    db.collection("leaves").doc(id).update({ status: "APPROVED" });
}

function confirmReject(id) {
  if (confirm("Reject leave?"))
    db.collection("leaves").doc(id).update({ status: "REJECTED", cl: 0, lop: 0 });
}

/* ---------- EXPORT ---------- */
async function exportCSV() {
  let csv = "Email,From,To,CL,LOP,Reason,Status\n";
  const snap = await db.collection("leaves")
    .where("from", ">=", exportFrom.value)
    .where("to", "<=", exportTo.value)
    .get();

  snap.forEach(d => {
    const x = d.data();
    csv += `${x.email},${x.from},${x.to},${x.cl},${x.lop},"${x.reason}",${x.status}\n`;
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv]));
  a.download = "leaves.csv";
  a.click();
}
