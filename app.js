/************ FIREBASE INIT ************/
firebase.initializeApp({
 apiKey: "AIzaSyCsYhAzSyPp1PQH3skrrnVuKRiQmzZHNGo",
  authDomain: "research-lab-portal.firebaseapp.com",
  projectId: "research-lab-portal",
  storageBucket: "research-lab-portal.firebasestorage.app"
});

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const $ = id => document.getElementById(id);

/************ AUTH ************/
function togglePassword(){
  const p = $("password");
  if(p) p.type = p.type==="password"?"text":"password";
}

function login(){
  auth.signInWithEmailAndPassword($("email").value,$("password").value)
  .then(r=>{
    db.doc(`admins/${r.user.uid}`).get().then(d=>{
      location.href = d.exists ? "admin.html" : "user.html";
    });
  }).catch(e=>alert(e.message));
}

function logout(){
  auth.signOut().then(()=>location.href="index.html");
}

/************ USER ************/
function loadUser(){
  auth.onAuthStateChanged(u=>{
    if(!u) return location.href="index.html";

    db.doc(`users/${u.uid}`).onSnapshot(d=>{
      const x=d.data();
      $("total").innerText=x.totalLeaves;
      $("used").innerText=x.usedLeaves;
      $("remaining").innerText=x.totalLeaves-x.usedLeaves;
    });

    db.collection("leaves").where("uid","==",u.uid)
    .onSnapshot(s=>{
      $("myLeaves").innerHTML="";
      s.forEach(d=>{
        const x=d.data();
        $("myLeaves").innerHTML+=`
        <tr>
          <td>${x.from} → ${x.to}</td>
          <td>${x.cl}</td>
          <td>${x.lop}</td>
          <td>${x.status}</td>
        </tr>`;
      });
    });

    db.collection("notifications")
    .where("uid","==",u.uid)
    .onSnapshot(s=>{
      $("notes").innerHTML="";
      s.forEach(d=>$("notes").innerHTML+=`<li>${d.data().msg}</li>`);
    });
  });
}

function applyLeave(){
  const from=new Date($("from").value);
  const to=new Date($("to").value);
  const reason=$("reason").value;
  if(!reason) return alert("Reason required");

  const days=(to-from)/86400000+1;
  let cl=Math.min(2,days);
  let lop=Math.max(0,days-2);

  const file=$("document").files[0];

  const saveLeave=(url="")=>{
    db.collection("leaves").add({
      uid:auth.currentUser.uid,
      email:auth.currentUser.email,
      from:$("from").value,
      to:$("to").value,
      cl, lop,
      reason,
      document:url,
      status:"PENDING"
    });

    db.collection("notifications").add({
      uid:"ADMIN",
      msg:`${auth.currentUser.email} applied for leave`
    });
  };

  if(file){
    const ref=storage.ref(`docs/${auth.currentUser.uid}/${file.name}`);
    ref.put(file).then(s=>s.ref.getDownloadURL().then(saveLeave));
  } else saveLeave();
}

/************ ADMIN ************/
function loadAdmin(){
  auth.onAuthStateChanged(()=>{
    db.collection("leaves").onSnapshot(s=>{
      $("allLeaves").innerHTML="";
      s.forEach(d=>{
        const x=d.data();
        if($("searchEmail").value &&
           !x.email.includes($("searchEmail").value)) return;

        $("allLeaves").innerHTML+=`
        <tr>
          <td>${x.email}</td>
          <td>${x.cl}</td>
          <td>${x.lop}</td>
          <td>${x.status}</td>
          <td>
            <button onclick="approve('${d.id}','${x.uid}',${x.cl})">✔</button>
            <button onclick="reject('${d.id}','${x.uid}')">✖</button>
          </td>
        </tr>`;
      });
    });

    db.collection("notifications").where("uid","==","ADMIN")
    .onSnapshot(s=>{
      $("adminNotes").innerHTML="";
      s.forEach(d=>$("adminNotes").innerHTML+=`<li>${d.data().msg}</li>`);
    });
  });
}

function approve(id,uid,cl){
  db.doc(`leaves/${id}`).update({status:"APPROVED"});
  db.doc(`users/${uid}`).update({
    usedLeaves:firebase.firestore.FieldValue.increment(cl)
  });
  db.collection("notifications").add({uid,msg:"Leave approved"});
}

function reject(id,uid){
  db.doc(`leaves/${id}`).update({status:"REJECTED"});
  db.collection("notifications").add({uid,msg:"Leave rejected"});
}

/************ EXCEL ************/
function exportExcel(){
  let csv="Email,CL,LOP,Status\n";
  db.collection("leaves").get().then(s=>{
    s.forEach(d=>{
      const x=d.data();
      csv+=`${x.email},${x.cl},${x.lop},${x.status}\n`;
    });
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv]));
    a.download="leave-report.csv";
    a.click();
  });
}

/************ AUTO LOAD ************/
if($("userPage")) loadUser();
if($("adminPage")) loadAdmin();
