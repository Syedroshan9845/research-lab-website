var firebaseConfig = {
  apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/* UI helpers */
function togglePassword() {
  const p = document.getElementById("password");
  p.type = p.type === "password" ? "text" : "password";
}

/* LOGIN */
function login() {
  auth.signInWithEmailAndPassword(
    email.value.trim(),
    password.value
  ).catch(e => alert(e.message));
}

/* LOGOUT */
function logout() {
  auth.signOut().then(() => location.href = "index.html");
}

/* AUTH ROUTING */
auth.onAuthStateChanged(async user => {
  if (!user) return;

  const admin = await db.collection("admins").doc(user.uid).get();
  const usr = await db.collection("users").doc(user.uid).get();

  if (admin.exists && !location.pathname.includes("admin.html"))
    location.href = "admin.html";

  if (usr.exists && !location.pathname.includes("user.html"))
    location.href = "user.html";

  if (location.pathname.includes("user.html")) loadUser(user);
  if (location.pathname.includes("admin.html")) loadAdmin();
});

/* USER */
async function loadUser(user) {
  welcome.innerText = user.email;

  const u = await db.collection("users").doc(user.uid).get();
  totalCL.innerText = u.data().totalLeaves;

  let cl = 0, lop = 0;
  myLeaves.innerHTML = "";

  const snap = await db.collection("leaves").where("uid","==",user.uid).get();
  snap.forEach(d => {
    const x = d.data();
    if (x.status === "APPROVED") { cl += x.cl; lop += x.lop; }
    myLeaves.innerHTML += `
      <tr>
        <td>${x.from}</td><td>${x.to}</td>
        <td>${x.cl}</td><td>${x.lop}</td>
        <td>${x.reason}</td><td>${x.status}</td>
      </tr>`;
  });

  approvedCL.innerText = cl;
  lopTaken.innerText = lop;
  remainingCL.innerText = u.data().totalLeaves - cl;
}

async function applyLeave() {
  if (!reason.value.trim()) return alert("Reason required");

  const days = (new Date(to.value)-new Date(from.value))/86400000+1;
  const cl = Math.min(days,2);
  const lop = Math.max(days-2,0);

  await db.collection("leaves").add({
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    from: from.value,
    to: to.value,
    cl, lop,
    reason: reason.value,
    status: "PENDING",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Leave applied");
  location.reload();
}

/* ADMIN */
function loadAdmin() {
  db.collection("leaves").orderBy("createdAt","desc")
    .onSnapshot(s => {
      allLeaves.innerHTML="";
      s.forEach(d=>{
        const x=d.data();
        allLeaves.innerHTML+=`
        <tr>
          <td>${x.email}</td><td>${x.from}</td><td>${x.to}</td>
          <td>${x.cl}</td><td>${x.lop}</td>
          <td>${x.reason}</td><td>${x.status}</td>
          <td>
            <button onclick="approve('${d.id}')">✔</button>
            <button onclick="reject('${d.id}')">✖</button>
          </td>
        </tr>`;
      });
    });
}

function approve(id){
  db.collection("leaves").doc(id).update({status:"APPROVED"});
}
function reject(id){
  db.collection("leaves").doc(id).update({status:"REJECTED",cl:0,lop:0});
}

/* SEARCH */
function search(){
  const v = searchEmail.value.trim();
  [...allLeaves.rows].forEach(r=>{
    r.style.display = r.cells[0].innerText.includes(v) ? "" : "none";
  });
}

/* EXPORT */
function exportCSV(){
  let csv="Email,From,To,CL,LOP,Reason,Status\n";
  [...allLeaves.rows].forEach(r=>{
    csv += [...r.cells].slice(0,7).map(c=>c.innerText).join(",")+"\n";
  });
  const a=document.createElement("a");
  a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
  a.download="leaves.csv";
  a.click();
}
