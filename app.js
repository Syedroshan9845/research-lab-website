// 🔥 FIREBASE CONFIG
var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
};

firebase.initializeApp(firebaseConfig);

var auth = firebase.auth();
var db = firebase.firestore();

// SHOW / HIDE PASSWORD
function togglePassword() {
  const p = document.getElementById("password");
  p.type = p.type === "password" ? "text" : "password";
}

// LOGIN
function login() {
  const email = email.value;
  const password = password.value;

  auth.signInWithEmailAndPassword(email, password)
    .then(res => {
      const uid = res.user.uid;

      db.collection("admins").doc(uid).get().then(d => {
        if (d.exists) {
          window.location = "admin-dashboard.html";
        } else {
          window.location = "user-dashboard.html";
        }
      });
    })
    .catch(err => error.innerText = err.message);
}

// LOGOUT
function logout() {
  auth.signOut().then(() => window.location = "index.html");
}

// 🔥 ADMIN CREATE USER
function createUser() {
  const email = newEmail.value;
  const password = newPassword.value;
  const role = newRole.value;

  auth.createUserWithEmailAndPassword(email, password)
    .then(res => {
      const uid = res.user.uid;

      const data = {
        email,
        role,
        active: true,
        totalLeaves: 12,
        usedLeaves: 0
      };

      const col = role === "ADMIN" ? "admins" : "users";
      db.collection(col).doc(uid).set(data);

      alert("User created successfully");
    })
    .catch(e => alert(e.message));
}

// APPLY LEAVE
function applyLeave() {
  auth.onAuthStateChanged(user => {
    if (!user) return;

    const f = fromDate.value;
    const t = toDate.value;
    const days =
      (new Date(t) - new Date(f)) / (1000 * 60 * 60 * 24) + 1;

    db.collection("leaves").add({
      userId: user.uid,
      email: user.email,
      fromDate: f,
      toDate: t,
      days,
      status: "PENDING"
    });

    alert("Leave applied");
  });
}

// ADMIN VIEW LEAVES
if (leaveTable) {
  db.collection("leaves").onSnapshot(snap => {
    leaveTable.innerHTML = "";
    snap.forEach(d => {
      const l = d.data();
      leaveTable.innerHTML += `
        <tr>
          <td>${l.email}</td>
          <td>${l.days}</td>
          <td>${l.status}</td>
          <td>
            <button onclick="approve('${d.id}', '${l.userId}', ${l.days})">Approve</button>
            <button onclick="reject('${d.id}')">Reject</button>
          </td>
        </tr>`;
    });
  });
}

// APPROVE
function approve(id, uid, days) {
  db.collection("leaves").doc(id).update({ status: "APPROVED" });
  db.collection("users").doc(uid)
    .update({ usedLeaves: firebase.firestore.FieldValue.increment(days) });
}

// REJECT
function reject(id) {
  db.collection("leaves").doc(id).update({ status: "REJECTED" });
}

// USER VIEW LEAVES
if (myLeaves) {
  auth.onAuthStateChanged(user => {
    if (!user) return;

    db.collection("leaves")
      .where("userId", "==", user.uid)
      .onSnapshot(snap => {
        myLeaves.innerHTML = "";
        snap.forEach(d => {
          const l = d.data();
          myLeaves.innerHTML += `<li>${l.fromDate} → ${l.toDate} (${l.status})</li>`;
        });
      });
  });
}

// EXCEL EXPORT
function exportExcel() {
  db.collection("leaves").get().then(snap => {
    const rows = [["Email", "From", "To", "Days", "Status"]];
    snap.forEach(d => {
      const l = d.data();
      rows.push([l.email, l.fromDate, l.toDate, l.days, l.status]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Leaves");
    XLSX.writeFile(wb, "Leave_Report.xlsx");
  });
}
