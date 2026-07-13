
const cfg = window.LOTUS_CONFIG;
const sb = supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
const WHATSAPP = cfg.whatsapp;
const BUCKET = "product-images";

let products = [];
let categories = [];
let orders = [];
let settings = {};
let cart = [];
let currentCategory = "Todos";
let currentUser = null;
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const money = (value) => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

function setMode(mode){
  const admin = mode === "admin";
  $("publicView").classList.toggle("hidden", admin);
  $("adminView").classList.toggle("hidden", !admin);
  $("cart").classList.toggle("hidden", admin);
  if(admin) prepareAdmin();
}

async function prepareAdmin(){
  const {data} = await sb.auth.getUser();
  currentUser = data?.user || null;
  updateAdminState();
}

function updateAdminState(){
  const logged = !!currentUser;
  $("loginBox").classList.toggle("hidden", logged);
  $("adminBox").classList.toggle("hidden", !logged);
  $("logout").classList.toggle("hidden", !logged);
  if(logged) loadAll();
}

async function loadAll(){
  await Promise.all([loadSettings(),loadCategories(),loadProducts(),loadOrders()]);
  renderAll();
}

async function loadSettings(){
  const {data,error} = await sb.from("settings").select("*").eq("id",1).single();
  if(!error && data) settings = data;
  applySettings();
}

function applySettings(){
  $("publicTitle").textContent = settings.title || "Lótus Confeitaria";
  $("publicSubtitle").textContent = settings.subtitle || "Doces artesanais, bolos e encomendas especiais.";
  $("bannerTitle").textContent = settings.banner_title || "Monte seu pedido online";
  $("bannerText").textContent = settings.banner_text || "Escolha os produtos e finalize pelo WhatsApp.";
  $("pixKeyText").textContent = settings.pix_key || "Não configurada";
  $("settingTitle").value = settings.title || "";
  $("settingSubtitle").value = settings.subtitle || "";
  $("settingBannerTitle").value = settings.banner_title || "";
  $("settingBannerText").value = settings.banner_text || "";
  $("settingPixKey").value = settings.pix_key || "";
  $("settingPixName").value = settings.pix_name || "";
  $("settingDeliveryFee").value = settings.delivery_fee || 0;
  $("settingMinOrder").value = settings.min_order || 0;
}

async function loadCategories(){
  const {data,error} = await sb.from("categories").select("*").order("position",{ascending:true}).order("name",{ascending:true});
  if(error){ console.error(error); categories=[]; return; }
  categories = data || [];
}

async function loadProducts(){
  const {data,error} = await sb.from("products").select("*").order("created_at",{ascending:false});
  if(error){ console.error(error); alert("Erro ao carregar produtos."); return; }
  products = data || [];
}

async function loadOrders(){
  if(!currentUser) return;
  let query = sb.from("orders").select("*").order("created_at",{ascending:false});
  const status = $("orderStatusFilter")?.value;
  if(status) query = query.eq("status",status);
  const {data,error} = await query;
  if(error){ console.error(error); return; }
  orders = data || [];
  renderOrders();
  renderDashboard();
}

function renderAll(){
  renderCategories();
  renderProducts();
  renderCart();
  renderAdminProducts();
  renderAdminCategories();
  renderOrders();
  renderDashboard();
}

function visibleCategories(){
  return categories.filter(c=>c.visible).sort((a,b)=>(a.position||0)-(b.position||0)||a.name.localeCompare(b.name));
}

function renderCategories(){
  const list = ["Todos", ...visibleCategories().map(c=>c.name)];
  if(currentCategory!=="Todos" && !list.includes(currentCategory)) currentCategory="Todos";
  $("cats").innerHTML="";
  $("category").innerHTML="";
  categories.forEach(c=>{
    const o=document.createElement("option");o.value=c.name;o.textContent=c.name;$("category").appendChild(o);
  });
  list.forEach(name=>{
    const meta=categories.find(c=>c.name===name);
    const btn=document.createElement("button");
    btn.className="cat"+(name===currentCategory?" active":"");
    btn.innerHTML=name==="Todos"?"Todos":`${meta?.icon?`<span class="cat-icon">${meta.icon}</span>`:""}${name}`;
    btn.onclick=()=>{currentCategory=name;renderCategories();renderProducts()};
    $("cats").appendChild(btn);
  });
}

function productCard(p){
  const stock = Number(p.stock || 0);
  const stockLimited = stock > 0;
  const available = p.available && (!stockLimited || stock > 0);
  return `
    ${p.featured?'<div class="featured-tag">Destaque</div>':""}
    ${stockLimited?`<div class="stock-tag">Estoque: ${stock}</div>`:""}
    ${p.image_url?`<img src="${p.image_url}" alt="${p.name}">`:`<div class="ph">Foto do produto</div>`}
    <div class="card-body">
      <h3>${p.name}</h3>
      <p>${p.description||"Sem descrição."}</p>
      <small>${p.category||""}</small>
      <div class="price">${money(p.price)}</div>
      ${available?`<div class="qty"><input id="qty-${p.id}" type="number" min="1" ${stockLimited?`max="${stock}"`:""} value="1"><button class="btn" onclick="addCart('${p.id}')">Adicionar</button></div>`:`<button class="btn light" disabled>Indisponível</button>`}
    </div>`;
}

function renderProducts(){
  const term = ($("search").value||"").toLowerCase().trim();
  let list = currentCategory==="Todos"?products:products.filter(p=>p.category===currentCategory);
  if(term) list=list.filter(p=>(p.name||"").toLowerCase().includes(term)||(p.description||"").toLowerCase().includes(term)||(p.category||"").toLowerCase().includes(term));
  const featured = products.filter(p=>p.featured&&p.available).slice(0,4);
  $("featuredArea").innerHTML = featured.length&&currentCategory==="Todos"&&!term
    ? `<h3>Produtos em destaque</h3><div class="grid">${featured.map(p=>`<div class="card">${productCard(p)}</div>`).join("")}</div>`
    : "";
  $("grid").innerHTML = list.length ? "" : "<p>Nenhum produto encontrado.</p>";
  list.forEach(p=>{const card=document.createElement("div");card.className="card";card.innerHTML=productCard(p);$("grid").appendChild(card)});
}

function addCart(id){
  const p=products.find(x=>String(x.id)===String(id));
  if(!p) return;
  const input=$("qty-"+id);
  let qty=Math.max(1,Number(input.value||1));
  if(Number(p.stock||0)>0) qty=Math.min(qty,Number(p.stock));
  const existing=cart.find(i=>String(i.id)===String(id));
  if(existing) existing.qty+=qty; else cart.push({id,qty});
  renderCart();
}

function removeCart(id){ cart=cart.filter(i=>String(i.id)!==String(id)); renderCart(); }

function calculateTotals(){
  let subtotal=0;
  cart.forEach(i=>{const p=products.find(x=>String(x.id)===String(i.id));if(p) subtotal+=Number(p.price)*i.qty});
  const delivery=$("deliveryType").value==="entrega"?Number(settings.delivery_fee||0):0;
  return {subtotal,delivery,total:subtotal+delivery};
}

function renderCart(){
  $("cartItems").innerHTML=cart.length?"":"<small>Nenhum item adicionado.</small>";
  cart.forEach(i=>{
    const p=products.find(x=>String(x.id)===String(i.id));if(!p)return;
    const row=document.createElement("div");row.className="cartitem";
    row.innerHTML=`<span>${i.qty}x ${p.name}<br><b>${money(Number(p.price)*i.qty)}</b></span><button onclick="removeCart('${i.id}')">x</button>`;
    $("cartItems").appendChild(row);
  });
  const t=calculateTotals();
  $("subtotal").textContent="Subtotal: "+money(t.subtotal);
  $("deliveryLine").textContent="Entrega: "+money(t.delivery);
  $("total").textContent="Total: "+money(t.total);
  $("addressFields").classList.toggle("hidden",$("deliveryType").value!=="entrega");
  $("pixBox").classList.toggle("hidden",$("paymentMethod").value!=="pix");
}

async function checkout(){
  if(!cart.length) return alert("Adicione pelo menos um produto.");
  const totals=calculateTotals();
  if(totals.subtotal < Number(settings.min_order||0)) return alert("O pedido mínimo é "+money(settings.min_order));

  const customer=$("customer").value.trim();
  const phone=$("customerPhone").value.trim();
  if(!customer||!phone) return alert("Preencha nome e telefone.");

  const orderItems=cart.map(i=>{
    const p=products.find(x=>String(x.id)===String(i.id));
    return {product_id:p.id,name:p.name,price:Number(p.price),qty:i.qty,subtotal:Number(p.price)*i.qty};
  });

  const payload={
    customer_name:customer,
    customer_phone:phone,
    delivery_type:$("deliveryType").value,
    address:$("address").value.trim(),
    neighborhood:$("neighborhood").value.trim(),
    scheduled_date:$("orderDate").value||null,
    scheduled_time:$("orderTime").value||null,
    payment_method:$("paymentMethod").value,
    notes:$("note").value.trim(),
    items:orderItems,
    subtotal:totals.subtotal,
    delivery_fee:totals.delivery,
    total:totals.total,
    status:"novo"
  };

  const {error}=await sb.from("orders").insert(payload);
  if(error){ console.error(error); return alert("Não foi possível registrar o pedido."); }

  let msg="Olá, Lótus Confeitaria! Gostaria de fazer este pedido:%0A%0A";
  msg+=`Nome: ${customer}%0ATelefone: ${phone}%0A%0A`;
  orderItems.forEach(i=>msg+=`• ${i.qty}x ${i.name} - ${money(i.subtotal)}%0A`);
  msg+=`%0ASubtotal: ${money(totals.subtotal)}%0AEntrega: ${money(totals.delivery)}%0ATotal: ${money(totals.total)}%0A`;
  msg+=`%0AOpção: ${payload.delivery_type}%0APagamento: ${payload.payment_method}`;
  if(payload.scheduled_date) msg+=`%0AData: ${payload.scheduled_date}`;
  if(payload.scheduled_time) msg+=`%0AHorário: ${payload.scheduled_time}`;
  if(payload.address) msg+=`%0AEndereço: ${payload.address}`;
  if(payload.neighborhood) msg+=`%0ABairro: ${payload.neighborhood}`;
  if(payload.notes) msg+=`%0AObservações: ${payload.notes}`;
  msg+="%0A%0AAguardo confirmação.";
  window.open(`https://wa.me/${WHATSAPP}?text=${msg}`,"_blank");
  cart=[];renderCart();
}

async function login(){
  const {data,error}=await sb.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});
  if(error) return alert("Login não autorizado.");
  currentUser=data.user;updateAdminState();
}
async function logout(){await sb.auth.signOut();currentUser=null;updateAdminState()}

async function uploadImage(file){
  if(!file) return "";
  const ext=file.name.split(".").pop();
  const path=`products/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const {error}=await sb.storage.from(BUCKET).upload(path,file);
  if(error){console.error(error);alert("Erro ao enviar foto.");return""}
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function saveProduct(e){
  e.preventDefault();
  const id=$("productId").value;
  const img=await uploadImage($("imageFile").files[0]);
  const payload={name:$("name").value.trim(),category:$("category").value,price:Number($("price").value),description:$("description").value.trim(),available:$("available").value==="true",featured:$("featured").value==="true",stock:Number($("stock").value||0)};
  if(img) payload.image_url=img;
  const result=id?await sb.from("products").update(payload).eq("id",id):await sb.from("products").insert(payload);
  if(result.error){console.error(result.error);return alert("Erro ao salvar produto.")}
  clearProductForm();await loadProducts();renderAll();alert("Produto salvo!");
}
function clearProductForm(){$("productForm").reset();$("productId").value="";$("stock").value=0}
function editProduct(id){const p=products.find(x=>String(x.id)===String(id));if(!p)return;$("productId").value=p.id;$("name").value=p.name||"";$("category").value=p.category||"";$("price").value=p.price||0;$("description").value=p.description||"";$("available").value=String(!!p.available);$("featured").value=String(!!p.featured);$("stock").value=p.stock||0;window.scrollTo({top:0,behavior:"smooth"})}
async function deleteProduct(id){if(!confirm("Excluir produto?"))return;const {error}=await sb.from("products").delete().eq("id",id);if(error)return alert("Erro ao excluir.");await loadProducts();renderAll()}

function renderAdminProducts(){
  $("adminProductList").innerHTML="";
  products.forEach(p=>{
    const row=document.createElement("div");row.className="admin-item";
    row.innerHTML=`${p.image_url?`<img src="${p.image_url}">`:`<div class="mini">Sem foto</div>`}<div><b>${p.name}</b><br><small>${p.category} • ${money(p.price)} • estoque ${p.stock||0}</small></div><div class="actions"><button class="btn light" onclick="editProduct('${p.id}')">Editar</button><button class="btn danger" onclick="deleteProduct('${p.id}')">Excluir</button></div>`;
    $("adminProductList").appendChild(row);
  });
}

async function saveCategory(e){
  e.preventDefault();
  const id=$("categoryId").value;
  const old=id?categories.find(c=>String(c.id)===String(id)):null;
  const payload={name:$("categoryName").value.trim(),icon:$("categoryIcon").value.trim(),position:Number($("categoryPosition").value||0),visible:$("categoryVisible").value==="true"};
  const result=id?await sb.from("categories").update(payload).eq("id",id):await sb.from("categories").insert(payload);
  if(result.error){console.error(result.error);return alert("Erro ao salvar categoria.")}
  if(old&&old.name!==payload.name) await sb.from("products").update({category:payload.name}).eq("category",old.name);
  clearCategoryForm();await loadCategories();await loadProducts();renderAll();alert("Categoria salva!");
}
function clearCategoryForm(){$("categoryForm").reset();$("categoryId").value="";$("categoryPosition").value=categories.length;$("categoryVisible").value="true"}
function editCategory(id){const c=categories.find(x=>String(x.id)===String(id));if(!c)return;$("categoryId").value=c.id;$("categoryName").value=c.name;$("categoryIcon").value=c.icon||"";$("categoryPosition").value=c.position||0;$("categoryVisible").value=String(c.visible)}
async function toggleCategory(id){const c=categories.find(x=>String(x.id)===String(id));if(!c)return;await sb.from("categories").update({visible:!c.visible}).eq("id",id);await loadCategories();renderAll()}
async function deleteCategory(id){const c=categories.find(x=>String(x.id)===String(id));if(!c)return;const used=products.filter(p=>p.category===c.name).length;if(used)return alert("Mova os produtos desta categoria antes de excluir.");if(!confirm("Excluir categoria?"))return;await sb.from("categories").delete().eq("id",id);await loadCategories();renderAll()}

function renderAdminCategories(){
  $("categoryAdminList").innerHTML="";
  categories.forEach(c=>{
    const used=products.filter(p=>p.category===c.name).length;
    const row=document.createElement("div");row.className="category-admin-item";
    row.innerHTML=`<div class="category-icon">${c.icon||"📁"}</div><div><b>${c.name}</b><br><small>Ordem ${c.position||0} • ${used} produto(s) • ${c.visible?"visível":"oculta"}</small></div><div class="actions"><button class="btn light" onclick="editCategory('${c.id}')">Editar</button><button class="btn light" onclick="toggleCategory('${c.id}')">${c.visible?"Ocultar":"Mostrar"}</button><button class="btn danger" onclick="deleteCategory('${c.id}')">Excluir</button></div>`;
    $("categoryAdminList").appendChild(row);
  });
}

function renderOrders(){
  const area=$("ordersList");if(!area)return;area.innerHTML=orders.length?"":"<p>Nenhum pedido encontrado.</p>";
  orders.forEach(o=>{
    const row=document.createElement("div");row.className="order-item";
    const items=Array.isArray(o.items)?o.items:[];
    row.innerHTML=`<div class="order-head"><div><b>${o.customer_name}</b><div class="order-meta">${new Date(o.created_at).toLocaleString("pt-BR")} • ${o.customer_phone}<br>${o.delivery_type} • ${o.payment_method}</div></div><span class="status ${o.status}">${o.status}</span></div><ul class="order-items">${items.map(i=>`<li>${i.qty}x ${i.name} — ${money(i.subtotal)}</li>`).join("")}</ul><b>Total: ${money(o.total)}</b><div class="actions"><button class="btn light" onclick="updateOrderStatus('${o.id}','confirmado')">Confirmar</button><button class="btn light" onclick="updateOrderStatus('${o.id}','em_preparo')">Em preparo</button><button class="btn light" onclick="updateOrderStatus('${o.id}','concluido')">Concluir</button><button class="btn danger" onclick="updateOrderStatus('${o.id}','cancelado')">Cancelar</button></div>`;
    area.appendChild(row);
  });
}
async function updateOrderStatus(id,status){await sb.from("orders").update({status}).eq("id",id);await loadOrders()}

function renderDashboard(){
  $("dashProducts").textContent=products.length;
  $("dashCategories").textContent=categories.length;
  $("dashOrders").textContent=orders.length;
  $("dashRevenue").textContent=money(orders.filter(o=>o.status==="concluido").reduce((s,o)=>s+Number(o.total||0),0));
}

async function saveSettings(){
  const payload={id:1,title:$("settingTitle").value,subtitle:$("settingSubtitle").value,banner_title:$("settingBannerTitle").value,banner_text:$("settingBannerText").value,pix_key:$("settingPixKey").value,pix_name:$("settingPixName").value,delivery_fee:Number($("settingDeliveryFee").value||0),min_order:Number($("settingMinOrder").value||0)};
  const {error}=await sb.from("settings").upsert(payload);
  if(error)return alert("Erro ao salvar configurações.");
  settings=payload;applySettings();renderCart();alert("Configurações salvas!");
}

function exportBackup(){
  const backup={products,categories,settings,exported_at:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="lotus-backup-3.0.json";a.click();URL.revokeObjectURL(url);
}
function importBackup(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async()=>{try{const b=JSON.parse(reader.result);if(Array.isArray(b.categories))for(const c of b.categories)await sb.from("categories").upsert({id:c.id,name:c.name,icon:c.icon,position:c.position,visible:c.visible});if(Array.isArray(b.products))for(const p of b.products)await sb.from("products").upsert(p);if(b.settings)await sb.from("settings").upsert({...b.settings,id:1});await loadAll();alert("Backup importado!")}catch(err){console.error(err);alert("Backup inválido.")}};
  reader.readAsText(file);
}

function switchTab(name){
  document.querySelectorAll(".admin-tab").forEach(x=>x.classList.add("hidden"));
  document.querySelectorAll(".admin-tabs button").forEach(x=>x.classList.remove("active"));
  $("tab-"+name).classList.remove("hidden");
  document.querySelector(`[data-tab="${name}"]`).classList.add("active");
}

window.addEventListener("beforeinstallprompt",(e)=>{e.preventDefault();deferredPrompt=e;$("installAppBtn").classList.remove("hidden")});
$("installAppBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installAppBtn").classList.add("hidden")};
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");

$("btnPublic").onclick=()=>setMode("public");
$("btnAdmin").onclick=()=>setMode("admin");
$("login").onclick=login;
$("logout").onclick=logout;
$("productForm").onsubmit=saveProduct;
$("clearProduct").onclick=clearProductForm;
$("categoryForm").onsubmit=saveCategory;
$("clearCategory").onclick=clearCategoryForm;
$("saveSettings").onclick=saveSettings;
$("refreshOrders").onclick=loadOrders;
$("orderStatusFilter").onchange=loadOrders;
$("exportJson").onclick=exportBackup;
$("importJson").onchange=importBackup;
$("search").oninput=renderProducts;
$("deliveryType").onchange=renderCart;
$("paymentMethod").onchange=renderCart;
$("checkout").onclick=checkout;
$("clearCart").onclick=()=>{cart=[];renderCart()};
$("copyPix").onclick=async()=>{await navigator.clipboard.writeText(settings.pix_key||"");alert("Chave Pix copiada!")};
document.querySelectorAll(".admin-tabs button").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));

(async function init(){
  const {data}=await sb.auth.getUser();
  currentUser=data?.user||null;
  await Promise.all([loadSettings(),loadCategories(),loadProducts()]);
  renderAll();
})();
