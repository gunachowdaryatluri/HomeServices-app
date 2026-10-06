// MongoDB Atlas data layer (replaces the old data/db.json file).
// Collections: users, bookings, sessions  (database name comes from MONGODB_DB)
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const config = require("./config");

const SESSION_SECONDS = 7 * 24 * 60 * 60; // 7 days, same as the cookie
const NO_ID = { projection: { _id: 0 } };  // never send Mongo's internal _id to the frontend

let client, users, bookings, sessions;

// ---------- password hashing (unchanged) ----------
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

// ---------- connection ----------
async function connect() {
  if (!config.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Create a .env file (see .env.example) with your Atlas connection string.");
  }
  client = new MongoClient(config.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(config.MONGODB_DB);
  users = db.collection("users");
  bookings = db.collection("bookings");
  sessions = db.collection("sessions");

  await users.createIndex({ email: 1 }, { unique: true });                 // one account per email
  await bookings.createIndex({ id: 1 }, { unique: true });                 // unique booking id
  await bookings.createIndex({ email: 1 });                                // fast "my bookings"
  await sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: SESSION_SECONDS }); // sessions auto-expire

  // Default admin account (same as the original project); created only if missing
  await users.updateOne(
    { email: "admin@homeservices.com" },
    { $setOnInsert: { name: "Administrator", email: "admin@homeservices.com", password: hashPassword("admin123"), role: "admin" } },
    { upsert: true }
  );
}
async function close() { if (client) await client.close(); }

// ---------- users ----------
const findUserByEmail = email => users.findOne({ email }, NO_ID);
const getAllUsers = () => users.find({}, NO_ID).sort({ _id: 1 }).toArray();
async function createUser(user) {
  try { await users.insertOne({ ...user }); return true; }
  catch (e) { if (e && e.code === 11000) return false; throw e; } // duplicate email
}

// ---------- sessions ----------
const createSession = (token, email) => sessions.insertOne({ _id: token, email, createdAt: new Date() });
async function getSessionEmail(token) {
  const s = await sessions.findOne({ _id: token });
  if (!s) return null;
  if (Date.now() - new Date(s.createdAt).getTime() > SESSION_SECONDS * 1000) return null; // TTL cleanup runs only every ~60s
  return s.email;
}
const deleteSession = token => sessions.deleteOne({ _id: token });

// ---------- bookings ----------
async function createBooking({ name, email, service }) {
  let id = Date.now();
  for (let tries = 0; tries < 20; tries++, id++) {
    const booking = { id, name, email, service, status: "Pending" };
    try { await bookings.insertOne({ ...booking }); return booking; }
    catch (e) { if (!e || e.code !== 11000) throw e; } // id taken -> try next id
  }
  throw new Error("Could not create booking");
}
const getBookingsByEmail = email => bookings.find({ email }, NO_ID).sort({ _id: 1 }).toArray();
const getAllBookings = () => bookings.find({}, NO_ID).sort({ _id: 1 }).toArray();
async function updateBookingStatus(id, status) {
  const r = await bookings.findOneAndUpdate({ id }, { $set: { status } }, { returnDocument: "after", projection: { _id: 0 } });
  return r && r.value !== undefined ? r.value : r; // supports driver v5 ({value}) and v6 (document)
}

module.exports = {
  connect, close, hashPassword, verifyPassword,
  findUserByEmail, getAllUsers, createUser,
  createSession, getSessionEmail, deleteSession,
  createBooking, getBookingsByEmail, getAllBookings, updateBookingStatus
};
