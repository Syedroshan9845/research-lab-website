/**************** FIREBASE INIT ****************/
var firebaseConfig = {
apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/**************** COMMON ****************/
function $(id){ return document.getElementById(id); }

function logout(){
  auth.signOut().then(()=>location.href="index.html");
}

function togglePassword(){
  const p = $("password");
  if(p) p.type = p.type==="password"?"text":"password";
}

/**************** LOGIN ****************/
function login(){
  auth.signInWithEmailAndPassword($("email").value, $("password").value)
  .then(res=>{
    db.doc(`admins/${res.user.uid}`).get().then(d=>{
      location.href = d.exists ? "admin.html" : "user.html";
    });
  }).catch(e=>alert(e.message));
}

/**************** USER DASHBOARD ****************/
function loadUser(){
  auth.onAuthStateChanged(u=>{
    if(!u) return location.href="index.html";

    // leave summary
    db.doc(`users/${u.uid}`).get().then(d=>{
      if(!d.exists) return;
      const x=d.data();
      $("total").innerText=x.totalLeaves;
      $("used").innerText=x.usedLeaves;
      $("remaining").innerText=x.totalLeaves-x.usedLeaves;
    });

    // notifications
    db.collection("notifications")
    .where("uid","==",u.uid)
    .orderBy("createdAt","desc")
    .onSnapshot(s=>{
      $("notes").innerHTML="";
      s.forEach(d=>$("notes").innerHTML+=`<li>${d.data().msg}</li>`);
    });

    // my leaves
    db.collection("leaves")
    .where("uid","==",u.uid)
    .onSnapshot(s=>{
      $("myLeaves").innerHTML="";
      s.forEach(d=>{
        const x=d.data();
        $("myLeaves").innerHTML+=`
        <tr><td>${x.from}</td><td>${x.to}</td><td>${x.days}</td><td>${x.type}</td><td>${x.status}</td></tr>`;
      });
    });
  });
}

function applyLeave(){
  const from=new Date($("from").value);
  const to=new Date($("to").value);
  const days=(to-from)/86400000+1;

  auth.currentUser && db.doc(`users/${auth.currentUser.uid}`).get().then(d=>{
    const u=d.data();
    let type="CL";
    if(u.usedLeaves+days>2) type="LOP";

    db.collection("leaves").add({
      uid:auth.currentUser.uid,
      email:auth.currentUser.email,
      from:$("from").value,
      to:$("to").value,
      days,
      type,
      status:"PENDING",
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

    db.collection("notifications").add({
      uid:"ADMIN",
      msg:`${auth.currentUser.email} applied leave`,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

/**************** ADMIN DASHBOARD ****************/
function loadAdmin(){
  auth.onAuthStateChanged(u=>{
    if(!u) return location.href="index.html";

    // leaves
    db.collection("leaves").onSnapshot(s=>{
      $("allLeaves").innerHTML="";
      s.forEach(d=>{
        const x=d.data();
        $("allLeaves").innerHTML+=`
        <tr>
          <td>${x.email}</td><td>${x.from}</td><td>${x.to}</td>
          <td>${x.days}</td><td>${x.type}</td><td>${x.status}</td>
          <td>
            <button onclick="approve('${d.id}','${x.uid}',${x.days},'${x.type}')">✔</button>
            <button onclick="reject('${d.id}','${x.uid}')">✖</button>
          </td>
        </tr>`;
      });
    });

    // admin notifications
    db.collection("notifications")
    .where("uid","==","ADMIN")
    .orderBy("createdAt","desc")
    .onSnapshot(s=>{
      $("adminNotes").innerHTML="";
      s.forEach(d=>$("adminNotes").innerHTML+=`<li>${d.data().msg}</li>`);
    });
  });
}

function approve(id,uid,days,type){
  db.doc(`leaves/${id}`).update({status:"APPROVED"});
  if(type==="CL"){
    db.doc(`users/${uid}`).update({
      usedLeaves:firebase.firestore.FieldValue.increment(days)
    });
  }
  db.collection("notifications").add({
    uid,
    msg:"Your leave approved",
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
}

function reject(id,uid){
  db.doc(`leaves/${id}`).update({status:"REJECTED"});
  db.collection("notifications").add({
    uid,
    msg:"Your leave rejected",
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });
}

/**************** ADMIN CREATE USER ****************/
function createUser(){
  auth.createUserWithEmailAndPassword($("newEmail").value,$("newPassword").value)
  .then(r=>{
    db.doc(`users/${r.user.uid}`).set({
      email:$("newEmail").value,
      role:"USER",
      totalLeaves:12,
      usedLeaves:0,
      active:true
    });
    alert("User created");
  });
}

/**************** EXCEL EXPORT ****************/
function exportExcel(){
  let csv="Email,From,To,Days,Type,Status\n";
  db.collection("leaves").get().then(s=>{
    s.forEach(d=>{
      const x=d.data();
      csv+=`${x.email},${x.from},${x.to},${x.days},${x.type},${x.status}\n`;
    });
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv]));
    a.download="leave-report.csv";
    a.click();
  });
}

/**************** AUTO LOAD ****************/
if($("userPage")) loadUser();
if($("adminPage")) loadAdmin();
