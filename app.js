// 🔥 Firebase Config (USE YOUR OWN)
var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app",
   appId: "1:149246738052:web:f751d671a4ee32b3acccd1"
};

firebase.initializeApp(firebaseConfig);

var auth = firebase.auth();
var db = firebase.firestore();
var storage = firebase.storage();

/* ================= LOGIN ================= */
function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  auth.signInWithEmailAndPassword(email, password)
    .then(res => {
      const uid = res.user.uid;

      db.collection("admins").doc(uid).get().then(doc => {
        if (doc.exists) {
          window.location.href = "admin-dashboard.html";
        } else {
          window.location.href = "user-dashboard.html";
        }
      });
    })
    .catch(err => alert(err.message));
}

/* ================= AUTH CHECK ================= */
auth.onAuthStateChanged(user => {
  if (!user) return;

  if (location.pathname.includes("user-dashboard")) {
    db.collection("users").doc(user.uid).get().then(doc => {
      const d = doc.data();
      totalLeaves.innerText = d.totalLeaves;
      usedLeaves.innerText = d.usedLeaves;
      remainingLeaves.innerText = d.totalLeaves - d.usedLeaves;
    });
  }

  if (location.pathname.includes("admin-dashboard")) {
    loadLeaves();
  }
});

/* ================= APPLY LEAVE ================= */
function applyLeave() {
  const from = fromDate.value;
  const to = toDate.value;
  const days = Number(daysInput.value);
  const file = docFile.files[0];

  auth.currentUser && db.collection("users").doc(auth.currentUser.uid).get()
    .then(doc => {
      const remaining = doc.data().totalLeaves - doc.data().usedLeaves;
      if (days > remaining) {
        alert("Not enough leaves");
        return;
      }

      if (file) {
        const ref = storage.ref(`leave-documents/${auth.currentUser.uid}/${file.name}`);
        ref.put(file).then(s =>
          s.ref.getDownloadURL().then(url => saveLeave(url))
        );
      } else {
        saveLeave("");
      }
    });
}

function saveLeave(url) {
  db.collection("leaves").add({
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    days: Number(daysInput.value),
    fromDate: fromDate.value,
    toDate: toDate.value,
    documentUrl: url,
    status: "PENDING"
  }).then(() => alert("Leave Applied"));
}

/* ================= ADMIN ================= */
function loadLeaves() {
  db.collection("leaves").onSnapshot(snap => {
    leaveList.innerHTML = "";
    snap.forEach(doc => {
      const l = doc.data();
      leaveList.innerHTML += `
        <tr>
          <td>${l.email}</td>
          <td>${l.days}</td>
          <td>${l.status}</td>
          <td>
            <button onclick="approve('${doc.id}', '${l.uid}', ${l.days})">Approve</button>
            <button onclick="reject('${doc.id}')">Reject</button>
          </td>
        </tr>`;
    });
  });
}

function approve(id, uid, days) {
  db.collection("leaves").doc(id).update({ status: "APPROVED" });
  db.collection("users").doc(uid).update({
    usedLeaves: firebase.firestore.FieldValue.increment(days)
  });
}

function reject(id) {
  db.collection("leaves").doc(id).update({ status: "REJECTED" });
}

/* ================= LOGOUT ================= */
function logout() {
  auth.signOut().then(() => location.href = "index.html");
}
