<h1 align="center">
  <img src="public/images/logo.jpg" width="52"/>
  <br/>
  Homekuti
</h1>

<p align="center">
  <em>Where every stay feels like home.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-success"/>
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/Express.js-Backend-black?logo=express&logoColor=white"/>
  <img src="https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb&logoColor=white"/>
  <img src="https://img.shields.io/badge/Cloudinary-Images-blue?logo=cloudinary"/>
  <img src="https://img.shields.io/badge/Leaflet-Maps-199900?logo=leaflet&logoColor=white"/>
</p>

---

## 🏡 Overview

**Homekuti** is a full-stack homestay listing platform inspired by modern booking systems.  
Built using **Node.js, Express, MongoDB, and EJS**, it allows users to explore stays, manage listings, upload images, write reviews, and view locations on an interactive map.

Unlike basic CRUD apps, Homekuti implements:

- Resilient backend architecture
- Smart fallback handling (images & location)
- Session-based authentication
- Interactive map experience
- MVC design pattern

---

## ✨ Key Features

### 🔐 Authentication System
- Passport.js local authentication
- Session-based login
- Flash messaging system
- Protected routes

### 🏡 Listing Management
- Create, edit, delete listings
- Owner-based permissions
- Cloudinary image upload
- Automatic fallback image if upload fails

### 🗺️ Smart Map Integration
- Leaflet interactive map
- Custom logo marker
- Smart zoom logic
- Default New Delhi fallback
- India-wide view for approximate locations

### ⭐ Reviews & Ratings
- Star rating system
- Add & delete reviews
- Ownership validation

### ⚙️ Error Handling & Stability
- Centralized error handler
- Mongoose validation handling
- Multer upload safeguards
- Graceful degradation strategy

---

## 🧠 Engineering Highlights

### 📍 Graceful Degradation Strategy

If external services fail:

- Listing still saves
- Default coordinates used
- India zoomed-out map view
- “Approximate location” indicator shown

This mirrors real-world marketplace architecture.

---

### ☁️ Cloudinary Integration

Uploads never block listing creation:

- Successful upload → Cloudinary image used
- Failure → Default image automatically applied

---

### 🧭 Clean MVC Architecture

controllers → business logic
models → database schema
routes → request flow
views → UI rendering
utils → reusable helpers


---

## 🛠️ Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | EJS, Bootstrap, Custom CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | Passport.js |
| Maps | Leaflet.js |
| Images | Cloudinary |
| Sessions | express-session |

---

## 📂 Project Structure

```text
Project/
├── controllers/
├── middlewares/
├── models/
├── public/
│   ├── css/
│   ├── images/
│   └── js/
├── routes/
├── utils/
├── views/
│
├── app.js
├── cloudConfig.js
└── README.md

## 🖼️ Screenshots

### 🏠 Listing Page
<p align="center">
  <img src="https://github.com/Chandrakant-Suman/Homekuti/blob/main/public/images/demo-listing.png" width="800"/>
</p>

### 🗺️ Map View
<p align="center">
  <img src="https://github.com/Chandrakant-Suman/Homekuti/blob/main/public/images/demo-map.png" width="800"/>
</p>

🚀 Installation

git clone https://github.com/Chandrakant-Suman/Homekuti.git
cd Homekuti
npm install
npm start
Server runs at:

http://localhost:8000
⚙️ Environment Variables
Create .env file:

DB_URL=mongodb://127.0.0.1:27017/homekuti
SESSION_SECRET=your_secret

CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_KEY=your_key
CLOUDINARY_SECRET=your_secret
📈 Future Enhancements
Real geocoding API integration

Booking system with date selection

Payment gateway support

Admin dashboard

Advanced filtering & search

👨‍💻 Author
Chandrakant Suman
GitHub: https://github.com/Chandrakant-Suman
