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

**Homekuti** is a full-stack homestay booking platform that enables users to discover, book, and manage stays with secure authentication, real-time availability, and seamless online payments.

Built using a **scalable MVC architecture**, the platform focuses on reliability, user experience, and production-grade backend handling.

Unlike basic CRUD apps, Homekuti implements:

- Resilient backend architecture
- Smart fallback handling (images & location)
- Session-based authentication
- Interactive map experience
- MVC design pattern

---

## ✨ Key Features

### 🔐 Authentication & Security
- Secure login using **Passport.js (Local Strategy)**
- Session-based authentication with persistent login
- Flash messaging for user feedback
- Route protection & authorization middleware

---

### 🏡 Listing Management
- Full CRUD operations for listings
- Ownership-based access control
- Image uploads via **Cloudinary**
- Automatic fallback image handling

---

### 🗺️ Interactive Map Experience
- Integrated **Leaflet.js** maps
- Dynamic location rendering
- Smart zoom control based on coordinates
- Default fallback to New Delhi if location fails
- India-wide view for approximate data

---

### ⭐ Reviews & Ratings
- Star-based rating system
- Add/delete reviews functionality
- Ownership validation for secure actions

---

### ⚙️ Robust Error Handling
- Centralized error middleware
- Mongoose validation handling
- Multer upload protection
- Graceful failure recovery across services

---

## 🧠 Engineering Highlights

### 📍 Graceful Degradation (Production Mindset)

When external services fail:

- Listing creation still succeeds
- Default coordinates applied
- Map falls back to India view
- UI shows “Approximate location”

> 💡 Mirrors real-world fault-tolerant system design.

---

### ☁️ Fault-Tolerant Image Upload

- Cloudinary success → Image stored remotely
- Failure → Default image assigned automatically
- No user flow interruption

---

### 🧭 Clean MVC Architecture


controllers → business logic
models → schema & database
routes → API flow
views → UI rendering (EJS)
utils → reusable helpers


> 📌 Separation of concerns → scalable + maintainable codebase

---

## 🛠️ Tech Stack

| Layer        | Technology |
|-------------|-----------|
| Frontend    | EJS, Bootstrap, Custom CSS |
| Backend     | Node.js, Express.js |
| Database    | MongoDB, Mongoose |
| Authentication | Passport.js |
| Maps        | Leaflet.js, LocationIQ |
| Image Storage | Cloudinary |
| Sessions    | express-session |

---

## 📂 Project Structure

```text
Homekuti/
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
```

## 🖼️ Screenshots 📸

### 🏠 Homekuti Architecture Image
![Homekuti Architecture Image](https://raw.githubusercontent.com/Chandrakant-Suman/Homekuti/main/public/images/Homekuti-Architecture-Image.png)

### 🏠 Home Page
![Homekuti Home Page](https://raw.githubusercontent.com/Chandrakant-Suman/Homekuti/main/public/images/demo-home.png)

### 🏠 Listings
![Homekuti All Listing Page](https://raw.githubusercontent.com/Chandrakant-Suman/Homekuti/main/public/images/demo-listing.png)

### 🏠 Listing Details
![Homekuti Listing Page](https://raw.githubusercontent.com/Chandrakant-Suman/Homekuti/main/public/images/demo-show.png)

### 🗺️ Map View
![Homekuti Map View](https://raw.githubusercontent.com/Chandrakant-Suman/Homekuti/main/public/images/demo-map.png)

```
🚀 Installation

git clone https://github.com/Chandrakant-Suman/Homekuti.git
cd Homekuti
npm install
npm start

Server runs at:
https://homekuti.onrender.com/

---

## 📈 Future Enhancements

- 🌍 High-precision geocoding integration for accurate location mapping  
- 🛏️ End-to-end booking system with real-time availability tracking  
- 💳 Full payment gateway integration (Razorpay / Stripe)  
- 🛠️ Advanced admin dashboard with analytics & controls  
- 🔍 Smart search with filters (price, location, category, ratings)  
- 🧠 Enhanced system design features (scalability, caching, optimization)

---

👨‍💻 Author
Chandrakant Suman
GitHub: https://github.com/Chandrakant-Suman
