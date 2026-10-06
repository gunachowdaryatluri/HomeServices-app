// REST API routes (same endpoints and responses as before; data now lives in MongoDB Atlas)
const crypto = require("crypto");
const store = require("./db");

const STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];
const SERVICES = ["Plumbing", "Electrical", "Cleaning"];

function publicUser(u) { return { name: u.name, email: u.email, role: u.role }; }

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
async function currentUser(req) {
  const token = getCookie(req, "hs_session");
  if (!token) return null;
  const email = await store.getSessionEmail(token);
  return email ? await store.findUserByEmail(email) : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 1e6) { reject(new Error("Too large")); req.destroy(); } });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const routes = {
  // POST /api/signup
  "POST /api/signup": async (req, res, body) => {
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const confirm = String(body.confirm || "");
    if (!name || !email || password.length < 4) return send(res, 400, { error: "Please fill all fields correctly" });
    if (password !== confirm) return send(res, 400, { error: "Passwords do not match" });
    const created = await store.createUser({ name, email, password: store.hashPassword(password), role: "user" });
    if (!created) return send(res, 409, { error: "Email already registered" });
    send(res, 201, { message: "Signup successful" });
  },

  // POST /api/login
  "POST /api/login": async (req, res, body) => {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const user = await store.findUserByEmail(email);
    if (!user || !store.verifyPassword(password, user.password)) return send(res, 401, { error: "Invalid email or password" });
    const token = crypto.randomBytes(32).toString("hex");
    await store.createSession(token, user.email);
    send(res, 200, { user: publicUser(user) }, {
      "Set-Cookie": `hs_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`
    });
  },

  // POST /api/logout
  "POST /api/logout": async (req, res) => {
    const token = getCookie(req, "hs_session");
    if (token) await store.deleteSession(token);
    send(res, 200, { message: "Logged out" }, { "Set-Cookie": "hs_session=; HttpOnly; Path=/; Max-Age=0" });
  },

  // GET /api/me  -> currently logged in user
  "GET /api/me": async (req, res) => {
    const user = await currentUser(req);
    if (!user) return send(res, 401, { error: "Not logged in" });
    send(res, 200, { user: publicUser(user) });
  },

  // POST /api/bookings  (user creates a booking)
  "POST /api/bookings": async (req, res, body) => {
    const user = await currentUser(req);
    if (!user) return send(res, 401, { error: "Not logged in" });
    const service = String(body.service || "");
    if (!SERVICES.includes(service)) return send(res, 400, { error: "Invalid service" });
    const booking = await store.createBooking({ name: user.name, email: user.email, service });
    send(res, 201, { booking });
  },

  // GET /api/bookings/mine  (user's own bookings)
  "GET /api/bookings/mine": async (req, res) => {
    const user = await currentUser(req);
    if (!user) return send(res, 401, { error: "Not logged in" });
    send(res, 200, { bookings: await store.getBookingsByEmail(user.email) });
  },

  // GET /api/admin/summary  (admin: all bookings + users)
  "GET /api/admin/summary": async (req, res) => {
    const user = await currentUser(req);
    if (!user) return send(res, 401, { error: "Not logged in" });
    if (user.role !== "admin") return send(res, 403, { error: "Admin only" });
    const [bookings, users] = await Promise.all([store.getAllBookings(), store.getAllUsers()]);
    send(res, 200, { bookings, users: users.map(publicUser) });
  }
};

// PUT /api/bookings/:id/status  (admin updates status)
async function updateStatus(req, res, id, body) {
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: "Not logged in" });
  if (user.role !== "admin") return send(res, 403, { error: "Admin only" });
  if (!STATUSES.includes(body.status)) return send(res, 400, { error: "Invalid status" });
  const booking = await store.updateBookingStatus(id, body.status);
  if (!booking) return send(res, 404, { error: "Booking not found" });
  send(res, 200, { booking });
}

async function handle(req, res, pathname) {
  let body = {};
  try {
    if (req.method !== "GET") body = await readBody(req);
  } catch (e) {
    return send(res, 400, { error: "Bad request" });
  }
  try {
    const m = pathname.match(/^\/api\/bookings\/(\d+)\/status$/);
    if (m && req.method === "PUT") return await updateStatus(req, res, Number(m[1]), body);
    const route = routes[req.method + " " + pathname];
    if (!route) return send(res, 404, { error: "API route not found" });
    await route(req, res, body);
  } catch (e) {
    console.error("API error:", e);
    send(res, 500, { error: "Server error" });
  }
}

module.exports = { handle };
