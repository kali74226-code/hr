import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, get, update, remove, onValue, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCZ7dAobvWvvQUI0msIkE1_pRb46QrUKPM",
    authDomain: "hr2026-b1a2c.firebaseapp.com",
    projectId: "hr2026-b1a2c",
    storageBucket: "hr2026-b1a2c.firebasestorage.app",
    messagingSenderId: "991247865259",
    appId: "1:991247865259:web:c37ad58f8df76c4e1a2eee",
    measurementId: "G-TGBQ5GXDQZ",
    databaseURL: "https://hr2026-b1a2c-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentCandidateId = null;
let recentTableDT, recordsTableDT;
let currentUserPerms = [];

$(document).ready(function() {
    const dtOptions = {
        language: { url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/ar.json' },
        pageLength: 5, lengthChange: false, ordering: true, info: false
    };
    recentTableDT = $('#recent-interviews-dt').DataTable(dtOptions);
    recordsTableDT = $('#all-records-dt').DataTable({ ...dtOptions, pageLength: 10 });
});

// --- التنقل والصلاحيات وفتح القائمة في الجوال ---
window.toggleSidebar = () => {
    document.getElementById('mainSidebar').classList.toggle('active-mobile');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
};

const navTriggers = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-section');

navTriggers.forEach(item => {
    item.addEventListener('click', () => {
        const targetView = item.getAttribute('data-target');
        if(currentUserPerms.length > 0 && !currentUserPerms.includes(targetView)) {
            alert('عذراً، ليس لديك صلاحية للوصول لهذه الصفحة.');
            return;
        }
        
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        views.forEach(view => view.classList.remove('active'));
        document.getElementById(targetView).classList.add('active');
        
        // إغلاق القائمة في الموبايل عند النقر
        if(window.innerWidth <= 768) window.toggleSidebar();
    });
});

// --- تسجيل الدخول ---
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userVal = document.getElementById('username').value.trim();
    const passVal = document.getElementById('password').value.trim();
    const submitBtn = e.target.querySelector('.btn-login-solid');

    submitBtn.disabled = true; submitBtn.innerText = "جاري التحقق...";
    try {
        const dbRef = ref(db);
        const usersSnap = await get(child(dbRef, 'users'));
        
        if (!usersSnap.exists()) {
            await update(dbRef, { 
                'users/admin_user_id': { 
                    username: 'Noragami', 
                    password: 'Noragami', 
                    perms: ['dashboard-view', 'interviews-view', 'records-view', 'reports-view', 'users-view', 'delete-privilege'] 
                } 
            });
        }

        const newSnap = await get(child(dbRef, 'users'));
        let foundUser = null;
        if (newSnap.exists()) {
            newSnap.forEach((childSnap) => {
                const u = childSnap.val();
                if (u.username === userVal && u.password === passVal) foundUser = u;
            });
        }

        if (foundUser) processLogin(foundUser.username, foundUser.perms || []);
        else alert("البيانات غير صحيحة! (المدير الافتراضي: Noragami)");
        
    } catch (error) {
        alert("خطأ في الاتصال بقاعدة البيانات.");
    } finally {
        submitBtn.disabled = false; submitBtn.innerText = "تسجيل الدخول";
    }
});

function processLogin(username, perms) {
    currentUserPerms = perms;
    document.getElementById('welcome-text').innerHTML = `مرحباً بك، <span>${username}</span> <i class="fa-solid fa-hand-wave text-accent"></i>`;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        if(!perms.includes(item.getAttribute('data-target'))) item.style.display = 'none';
        else item.style.display = 'flex';
    });

    document.getElementById('login-view').classList.remove('active');
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-layout').style.display = 'flex';
    
    fetchAndListenToData();
    loadUsersAdmin();
}

document.getElementById('logoutBtn').addEventListener('click', () => location.reload());

// --- النوافذ المنبثقة ---
window.openAddCandidateModal = () => document.getElementById('addCandidateModal').classList.add('active');
window.openEvalModal = (id, name) => {
    currentCandidateId = id;
    document.getElementById('modalName').innerText = `إجراء تقييم: ${name}`;
    document.getElementById('evaluationModal').classList.add('active');
};
window.closeModal = (id) => document.getElementById(id).classList.remove('active');

// --- المهارات واللغات ---
window.addSkillRow = () => {
    document.getElementById('skills-container').insertAdjacentHTML('beforeend', `<div class="skill-row"><input type="text" class="skill-input" placeholder="اكتب مهارة..."></div>`);
};
window.addLangRow = () => {
    document.getElementById('langs-container').insertAdjacentHTML('beforeend', `<div class="lang-row"><input type="text" class="lang-name" placeholder="اللغة"><select class="lang-level"><option value="مبتدئ">مبتدئ</option><option value="متوسط">متوسط</option><option value="متقدم">متقدم</option><option value="محترف">محترف</option></select></div>`);
};

// --- حفظ متقدم جديد ---
document.getElementById('candidateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const skills = [];
    document.querySelectorAll('.skill-input').forEach(inp => { if(inp.value.trim() !== '') skills.push(inp.value.trim()); });
    
    const langs = [];
    document.querySelectorAll('.lang-row').forEach(row => {
        const name = row.querySelector('.lang-name').value.trim();
        const lvl = row.querySelector('.lang-level').value;
        if(name !== '') langs.push(`${name} (${lvl})`);
    });

    const candidateData = {
        fullName: document.getElementById('candName').value,
        age: document.getElementById('candAge').value,
        location: document.getElementById('candLocation').value,
        phone: document.getElementById('candPhone').value,
        interviewDate: document.getElementById('candDate').value,
        interviewLoc: document.getElementById('candInterviewLoc').value, 
        skills: skills,
        languages: langs,
        status: "لم تتم المقابلة",
        interviewCount: 0
    };

    try {
        await push(ref(db, 'candidates'), candidateData);
        alert('تم إضافة المتقدم بنجاح!');
        document.getElementById('candidateForm').reset();
        closeModal('addCandidateModal');
    } catch (error) { alert('حدث خطأ أثناء الحفظ.'); }
});

// --- حذف المتقدم ---
window.deleteCandidate = async (id) => {
    if(!currentUserPerms.includes('delete-privilege')) {
        alert("عذراً، أنت لا تملك صلاحية لحذف السجلات!");
        return;
    }
    
    if(confirm("تحذير: هل أنت متأكد من رغبتك بحذف هذا المتقدم نهائياً؟")) {
        try {
            await remove(ref(db, `candidates/${id}`));
            alert("تم حذف المتقدم بنجاح.");
        } catch(error) {
            alert("حدث خطأ أثناء محاولة الحذف.");
        }
    }
};

// --- جلب البيانات ---
function fetchAndListenToData() {
    const candidatesRef = ref(db, 'candidates');
    onValue(candidatesRef, (snapshot) => {
        let total = 0, accepted = 0, pending = 0, rejected = 0;
        recentTableDT.clear(); recordsTableDT.clear();
        const cardsGrid = document.getElementById('candidates-cards');
        const todayList = document.getElementById('today-appointments-list');
        
        cardsGrid.innerHTML = '';
        todayList.innerHTML = '';
        let hasTodayApps = false;
        const todayDateString = new Date().toDateString();

        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const id = childSnapshot.key;
                const data = childSnapshot.val();
                
                total++;
                if(data.status === 'مقبول') accepted++;
                else if(data.status === 'مرفوض') rejected++;
                else pending++;

                let statusBadge = '';
                if(data.status === 'مقبول') statusBadge = `<span class="text-green text-bold"><i class="fa-solid fa-check"></i> ${data.status}</span>`;
                else if(data.status === 'مرفوض') statusBadge = `<span class="text-red text-bold"><i class="fa-solid fa-xmark"></i> ${data.status}</span>`;
                else statusBadge = `<span style="color:var(--color-orange);" class="text-bold"><i class="fa-regular fa-clock"></i> ${data.status}</span>`;

                const locText = data.interviewLoc || 'غير محدد';
                
                const appDate = new Date(data.interviewDate);
                if (appDate.toDateString() === todayDateString) {
                    hasTodayApps = true;
                    const timeString = appDate.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
                    const cancelBtn = currentUserPerms.includes('delete-privilege') ? `<button class="btn-outline-red" style="padding: 2px 8px; font-size:11px; float:left; margin-top:-5px;" onclick="deleteCandidate('${id}')"><i class="fa-solid fa-trash"></i> إلغاء الموعد</button>` : '';

                    todayList.innerHTML += `
                        <div class="appointment-item">
                            ${cancelBtn}
                            <span class="app-time"><i class="fa-regular fa-clock"></i> ${timeString}</span>
                            <h4 class="app-name">${data.fullName}</h4>
                            <p class="app-loc"><i class="fa-solid fa-map-marker-alt"></i> الموقع: <strong>${locText}</strong></p>
                        </div>`;
                }

                const deleteBtn = currentUserPerms.includes('delete-privilege') ? `<button class="btn-outline-red" style="font-size:12px; margin-right:5px;" onclick="deleteCandidate('${id}')"><i class="fa-solid fa-trash"></i> حذف</button>` : '';
                const reEvalBtn = `<button class="btn-accent-solid" style="padding: 5px 12px; font-size:12px; display:inline-block;" onclick="openEvalModal('${id}', '${data.fullName}')"><i class="fa-solid fa-rotate"></i> مقابلة</button>`;

                recentTableDT.row.add([ `<strong>${data.fullName}</strong>`, `${new Date(data.interviewDate).toLocaleDateString('ar-IQ')} <br><small class="text-muted"><i class="fa-solid fa-map-marker-alt"></i> ${locText}</small>`, statusBadge ]);
                
                recordsTableDT.row.add([ 
                    `<strong>${data.fullName}</strong>`, 
                    `${data.location} <br><small class="text-accent">${locText}</small>`, 
                    data.skills ? data.skills.join('، ') : 'لا يوجد', 
                    data.interviewCount || 0, 
                    statusBadge, 
                    `<div style="display:flex;">${reEvalBtn} ${deleteBtn}</div>` 
                ]);

                if (data.status === 'لم تتم المقابلة' || data.status === 'يؤجل') {
                    const deleteCardBtn = currentUserPerms.includes('delete-privilege') ? `<button class="btn-outline-red w-100 mt-10" onclick="deleteCandidate('${id}')"><i class="fa-solid fa-trash"></i> إلغاء وحذف</button>` : '';
                    
                    cardsGrid.innerHTML += `
                        <div class="candidate-card">
                            <h3 class="text-accent mb-10">${data.fullName}</h3>
                            <p class="text-small text-muted mb-5"><i class="fa-solid fa-map-marker-alt"></i> مقابلة: ${locText}</p>
                            <p class="text-small text-muted mb-10"><i class="fa-solid fa-phone"></i> ${data.phone}</p>
                            <p class="text-small text-bold mb-20">الحالة: ${statusBadge}</p>
                            <button class="btn-outline-dark w-100" onclick="openEvalModal('${id}', '${data.fullName}')">إجراء المقابلة</button>
                            ${deleteCardBtn}
                        </div>`;
                }
            });
            
            recentTableDT.draw(); recordsTableDT.draw();
        }
        
        if (!hasTodayApps) todayList.innerHTML = `<p class="text-muted text-small" style="text-align:center; padding: 20px;">لا توجد مواعيد مبرمجة لهذا اليوم.</p>`;

        document.getElementById('stat-total').innerText = total;
        document.getElementById('stat-accepted').innerText = accepted;
        document.getElementById('stat-rejected').innerText = rejected;
        document.getElementById('stat-pending').innerText = pending;

        const totalEvaluated = accepted + rejected;
        document.getElementById('rep-total-interviews').innerText = totalEvaluated;
        document.getElementById('rep-accept-rate').innerText = totalEvaluated ? Math.round((accepted / totalEvaluated) * 100) + '%' : '0%';
        document.getElementById('rep-reject-rate').innerText = totalEvaluated ? Math.round((rejected / totalEvaluated) * 100) + '%' : '0%';
    });
}

// --- حفظ التقييم ---
document.getElementById('evalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentCandidateId) return;

    const candRef = ref(db, `candidates/${currentCandidateId}`);
    const snapshot = await get(candRef);
    const data = snapshot.val();

    const newEval = {
        score: document.getElementById('evalScore').value,
        pros: document.getElementById('evalPros').value,
        cons: document.getElementById('evalCons').value,
        status: document.getElementById('evalStatus').value,
        date: new Date().toISOString()
    };

    let history = data.interviewHistory || [];
    if (data.currentEvaluation) history.push(data.currentEvaluation); 

    await update(candRef, {
        status: newEval.status,
        currentEvaluation: newEval,
        interviewHistory: history,
        interviewCount: (data.interviewCount || 0) + 1
    });

    closeModal('evaluationModal');
    document.getElementById('evalForm').reset();
    document.getElementById('scoreValue').innerText = "5";
    alert('تم حفظ التقييم بنجاح!');
});

// --- إدارة المستخدمين ---
document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedPerms = Array.from(document.querySelectorAll('.perm-cb:checked')).map(cb => cb.value);
    
    const newUser = {
        username: document.getElementById('newUsername').value.trim(),
        password: document.getElementById('newPassword').value.trim(),
        perms: selectedPerms
    };

    try {
        await push(ref(db, 'users'), newUser);
        alert('تم إضافة المستخدم بنجاح');
        document.getElementById('addUserForm').reset();
    } catch (e) { alert('حدث خطأ'); }
});

function loadUsersAdmin() {
    onValue(ref(db, 'users'), (snapshot) => {
        const list = document.getElementById('users-list');
        list.innerHTML = '';
        if(snapshot.exists()) {
            snapshot.forEach(child => {
                const u = child.val();
                list.innerHTML += `<li><span><i class="fa-solid fa-user-tie text-accent"></i> ${u.username}</span> <span class="text-small text-muted">${u.perms ? u.perms.length : 0} صلاحيات</span></li>`;
            });
        }
    });
}
