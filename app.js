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

function togglePassword() {
  const p = document.getElementById("password");
  if (p) p.type = p.type === "password" ? "text" : "password";
}

function login() {
  auth.signInWithEmailAndPassword(
    email.value.trim(),
    password.value
  ).catch(e => alert(e.message));
}

function logout() {
  auth.signOut().then(() => location.replace("index.html"));
}

auth.onAuthStateChanged(async user => {
  const page = location.pathname.split("/").pop();

  if (!user) {
    if (page !== "index.html") location.replace("index.html");
    return;
  }

  const admin = await db.collection("admins").doc(user.uid).get();
  const normal = await db.collection("users").doc(user.uid).get();

  if (admin.exists && page !== "admin.html") location.replace("admin.html");
  if (normal.exists && page !== "user.html") location.replace("user.html");

  if (page === "user.html") loadUser();
  if (page === "admin.html") loadAdmin();
});

async function loadUser() {
  const user = auth.currentUser;
  userEmail.innerText = user.email;

  let approvedCL = 0, lop = 0;
  myLeaves.innerHTML = "";

  const snap = await db.collection("leaves")
    .where("uid", "==", user.uid)
    .get();

  snap.forEach(d => {
    const l = d.data();
    if (l.status === "APPROVED") {
      approvedCL += l.cl;
      lop += l.lop;
    }
    myLeaves.innerHTML += `
      <tr>
        <td>${l.from}</td>
        <td>${l.to}</td>
        <td>${l.cl}</td>
        <td>${l.lop}</td>
        <td>${l.reason}</td>
        <td>${l.status}</td>
      </tr>`;
  });

  approvedCL = Math.min(approvedCL, 12);
  approvedCLSpan.innerText = approvedCL;
  remainingCL.innerText = 12 - approvedCL;
  lopTaken.innerText = lop;

  loadUserNotifications();
}

async function applyLeave() {
  if (!reason.value.trim()) return alert("Reason mandatory");

  const days =
    (new Date(to.value) - new Date(from.value)) / 86400000 + 1;

  const cl = Math.min(days, 2);
  const lop = Math.max(days - 2, 0);

  await db.collection("leaves").add({
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    from: from.value,
    to: to.value,
    cl,
    lop,
    reason: reason.value,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection("notifications").add({
    to: "ADMIN",
    message: auth.currentUser.email + " applied for leave",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  loadUser();
}

function loadAdmin() {
  allLeaves.innerHTML = "";

  db.collection("leaves").orderBy("createdAt", "desc")
    .onSnapshot(snap => {
      allLeaves.innerHTML = "";
      snap.forEach(doc => {
        const d = doc.data();
        allLeaves.innerHTML += `
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

  loadAdminNotifications();
}

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

function searchEmail() {
  const term = searchEmail.value.toLowerCase();
  [...allLeaves.rows].forEach(r => {
    r.style.display = r.innerText.toLowerCase().includes(term) ? "" : "none";
  });
}

function downloadExcel() {
  let csv = "Email,From,To,CL,LOP,Reason,Status\n";
  [...allLeaves.rows].forEach(r => {
    csv += [...r.cells].map(c => c.innerText).join(",") + "\n";
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv]));
  a.download = "leaves.csv";
  a.click();
}

function loadUserNotifications() {
  userNotifications.innerHTML = "";
  db.collection("notifications")
    .where("to", "==", auth.currentUser.uid)
    .onSnapshot(s =>
      s.forEach(d =>
        userNotifications.innerHTML += `<li>${d.data().message}</li>`
      )
    );
}

function loadAdminNotifications() {
  adminNotifications.innerHTML = "";
  db.collection("notifications")
    .where("to", "==", "ADMIN")
    .onSnapshot(s =>
      s.forEach(d =>
        adminNotifications.innerHTML += `<li>${d.data().message}</li>`
      )
    );
}
