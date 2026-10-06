if(location.protocol==="file:"){
    window.location.replace("http://localhost:3000/"+location.pathname.split("/").pop());
}

async function api(method, url, body){
    try{
        let res=await fetch(url,{method:method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,credentials:"same-origin"});
        let data={};
        try{data=await res.json();}catch(e){}
        return {ok:res.ok,status:res.status,data:data};
    }catch(e){
        return {ok:false,status:0,data:{error:"Cannot reach the server. Run 'npm start' and open http://localhost:3000"}};
    }
}
function serverDown(r){
    if(r.status===0){alert(r.data.error);return true;}
    return false;
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

// Signup function
async function signup(event){
    event.preventDefault();
    let name=document.getElementById("name").value.trim();
    let email=document.getElementById("email").value.trim().toLowerCase();
    let password=document.getElementById("password").value;
    let confirm=document.getElementById("confirm").value;
    if(password!==confirm){document.getElementById("message").innerText="Passwords do not match";return;}
    let r=await api("POST","/api/signup",{name:name,email:email,password:password,confirm:confirm});
    if(serverDown(r))return;
    if(!r.ok){document.getElementById("message").innerText=r.data.error||"Signup failed";return;}
    alert("Signup successful. Please login.");
    window.location.href="login.html";
}

// Login and module-wise redirection
async function login(event){
    event.preventDefault();
    let email=document.getElementById("email").value.trim().toLowerCase();
    let password=document.getElementById("password").value;
    let r=await api("POST","/api/login",{email:email,password:password});
    if(serverDown(r))return;
    if(r.ok){
        if(r.data.user.role==="admin"){window.location.href="admin.html";}
        else{window.location.href="user.html";}
    }else{
        document.getElementById("message").innerText="Invalid email or password";
    }
}

// Protect pages by checking logged-in role (session is verified by the server)
async function checkUser(){
    let r=await api("GET","/api/me");
    if(serverDown(r))return;
    if(!r.ok){window.location.href="login.html";return;}
    let user=r.data.user;
    if(user.role!=="user"){window.location.href="admin.html";return;}
    document.getElementById("welcome").innerText="Hi, "+user.name;
    showMyBookings();
}
async function checkAdmin(){
    let r=await api("GET","/api/me");
    if(serverDown(r))return;
    if(!r.ok){window.location.href="login.html";return;}
    if(r.data.user.role!=="admin"){window.location.href="user.html";return;}
    showAdmin();
}

// Save a booking on the server
async function book(service){
    let r=await api("POST","/api/bookings",{service:service});
    if(serverDown(r))return;
    if(!r.ok){window.location.href="login.html";return;}
    alert(service+" booking request submitted!");
    showMyBookings();
}
async function showMyBookings(){
    let r=await api("GET","/api/bookings/mine");
    let area=document.getElementById("mybookings");
    if(!area)return;
    let mine=r.ok?r.data.bookings:[];
    if(mine.length===0){area.innerHTML="<p>No bookings yet.</p>";return;}
    area.innerHTML=mine.map(b=>`<div class="booking"><div><b>${esc(b.service)}</b><p>Booking ID: ${b.id}</p><p>Status: ${esc(b.status)}</p></div></div>`).join("");
}
async function showAdmin(){
    let r=await api("GET","/api/admin/summary");
    if(serverDown(r))return;
    if(!r.ok){window.location.href="login.html";return;}
    let users=r.data.users;
    let bookings=r.data.bookings;
    document.getElementById("stats").innerHTML=
        `<div class="stat"><h2>${bookings.length}</h2>Total Bookings</div>
         <div class="stat"><h2>${users.filter(u=>u.role==="user").length}</h2>Registered Users</div>`;
    let area=document.getElementById("allbookings");
    if(bookings.length===0){area.innerHTML="<p>No bookings yet.</p>";}
    else{
        area.innerHTML=bookings.map(b=>`<div class="booking"><div><b>${esc(b.service)}</b><p>Customer: ${esc(b.name)}</p><p>Booking ID: ${b.id}</p><p>Status: ${esc(b.status)}</p></div><select onchange="updateStatus(${b.id},this.value)"><option ${b.status==="Pending"?"selected":""}>Pending</option><option ${b.status==="Confirmed"?"selected":""}>Confirmed</option><option ${b.status==="Completed"?"selected":""}>Completed</option><option ${b.status==="Cancelled"?"selected":""}>Cancelled</option></select></div>`).join("");
    }
    let customerUsers=users.filter(u=>u.role==="user");
    document.getElementById("users").innerHTML=customerUsers.length?customerUsers.map(u=>`<div class="booking"><b>${esc(u.name)}</b><span>${esc(u.email)}</span></div>`).join(""):"<p>No registered users yet.</p>";
}
async function updateStatus(id,status){
    let r=await api("PUT","/api/bookings/"+id+"/status",{status:status});
    if(r.ok){showAdmin();}
}
async function logout(){
    await api("POST","/api/logout");
    window.location.href="index.html";
}
