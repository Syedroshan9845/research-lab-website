firebase.initializeApp({
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
});

const auth = firebase.auth();
const db = firebase.firestore();
const $ = id => document.getElementById(id);

/* COMMON */
function togglePassword() {
  const p = $("password");
  if (p) p.type = p.type === "password" ? "text" : "password";
}
function logout() {
  auth.signOut().then(() => location.href = "index.html");
}

/* LOGIN */
if ($("loginBtn")) {
  $("loginBtn").onclick = () => {
    const email = $("email").value;
    const password = $("password").value;
    if (!email || !password) {
      $("error").innerText = "Email & password required";
      return;
    }
    auth.signInWithEmailAndPassword(email, password)
      .then(r => {
        db.doc(`admins/${r.user.uid}`).get()
          .then(d => location.href = d.exists ? "admin.html" : "user.html");
      })
      .catch(e => $("error").innerText = e.message);
  };
}

/* USER */
function loadUser() {
  auth.onAuthStateChanged(u => {
    if (!u) return location.href = "index.html";

    db.doc(`users/${u.uid}`).onSnapshot(d => {
      const used = d.exists ? d.data().usedLeaves || 0 : 0;
      $("used").innerText = used;
      $("remaining").innerText = 12 - used;
    });

    db.collection("leaves").where("uid", "==", u.uid)
      .onSnapshot(s => {
        $("myLeaves").innerHTML = "";
        s.forEach(d => {
          const x = d.data();
          $("myLeaves").innerHTML += `
            <tr>
              <td>${x.from}</td>
              <td>${x.to}</td>
              <td>${x.cl}</td>
              <td>${x.lop}</td>
              <td>${x.status}</td>
            </tr>`;
        });
      });

    db.collection("notifications").where("target", "==", u.uid)
      .onSnapshot(s => {
        $("notes").innerHTML = "";
        s.forEach(d => $("notes").innerHTML += `<li>${d.data().msg}</li>`);
      });
  });
}

function applyLeave() {
  const from = $("from").value;
  const to = $("to").value;
  const reason = $("reason").value;
  if (!from || !to || !reason) return alert("All fields required");

  const days = (new Date(to) - new Date(from)) / 86400000 + 1;
  const cl = Math.min(2, days);
  const lop = Math.max(0, days - 2);

  db.collection("leaves").add({
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    from, to, cl, lop,
    status: "PENDING"
  });

  db.collection("notifications").add({
    target: "ADMIN",
    msg: `${auth.currentUser.email} applied for leave`
  });
}

/* ADMIN */
let adminLeavesCache = [];

function loadAdmin() {
  db.collection("leaves").onSnapshot(s => {
    adminLeavesCache = [];
    s.forEach(d => adminLeavesCache.push({ id: d.id, ...d.data() }));
    renderAdminLeaves();
  });

  db.collection("notifications").where("target", "==", "ADMIN")
    .onSnapshot(s => {
      $("adminNotes").innerHTML = "";
      s.forEach(d => $("adminNotes").innerHTML += `<li>${d.data().msg}</li>`);
    });
}

function renderAdminLeaves() {
  const search = $("searchEmail").value.toLowerCase();
  $("allLeaves").innerHTML = "";
  adminLeavesCache.forEach(l => {
    if (search && !l.email.toLowerCase().includes(search)) return;
    $("allLeaves").innerHTML += `
      <tr>
        <td>${l.email}</td>
        <td>${l.from}</td>
        <td>${l.to}</td>
        <td>${l.cl}</td>
        <td>${l.lop}</td>
        <td>${l.status}</td>
        <td>
          <button onclick="approveLeave('${l.id}','${l.uid}',${l.cl})">✔</button>
          <button onclick="rejectLeave('${l.id}','${l.uid}')">✖</button>
        </td>
      </tr>`;
  });
}

function approveLeave(id, uid, cl) {
  db.doc(`leaves/${id}`).update({ status: "APPROVED" });
  db.doc(`users/${uid}`).update({
    usedLeaves: firebase.firestore.FieldValue.increment(cl)
  });
  db.collection("notifications").add({
    target: uid,
    msg: "Your leave has been APPROVED"
  });
}

function rejectLeave(id, uid) {
  db.doc(`leaves/${id}`).update({ status: "REJECTED" });
  db.collection("notifications").add({
    target: uid,
    msg: "Your leave has been REJECTED"
  });
}

function exportExcel() {
  const from = $("excelFrom").value;
  const to = $("excelTo").value;
  let csv = "Email,From,To,CL,LOP,Status\n";
  adminLeavesCache.forEach(l => {
    if (from && l.from < from) return;
    if (to && l.to > to) return;
    csv += `${l.email},${l.from},${l.to},${l.cl},${l.lop},${l.status}\n`;
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv]));
  a.download = "leave-report.csv";
  a.click();
}

/* AUTO LOAD */
if ($("userPage")) loadUser();
if ($("adminPage")) loadAdmin();
