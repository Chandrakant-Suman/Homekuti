// data.js
const sampleListings = [

  {
    title: "Royal Haveli Heritage Stay",
    description: "Traditional Rajasthani haveli with heritage interiors and courtyard dining.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771086037/Homekuti_DEV/pkrc2pivxsp5l56swdob.webp",
      filename: "Homekuti_DEV/pkrc2pivxsp5l56swdob"
    },
    price: 2200,
    location: "Jaipur",
    country: "India",
    geometry: { type: "Point", coordinates: [75.8189817, 26.9154576] },
  },

  {
    title: "Pink City Palace Inn",
    description: "Palace-style boutique hotel inspired by royal Jaipur architecture.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771086213/Homekuti_DEV/m1yqqivq2yjcggrsjaov.jpg",
      filename: "Homekuti_DEV/m1yqqivq2yjcggrsjaov"
    },
    price: 2000,
    location: "Jaipur",
    country: "India",
    geometry: { type: "Point", coordinates: [75.8189817, 26.9154576] },
  },

  {
    title: "Himalayan Ridge Resort",
    description: "Resort offering panoramic Himalayan mountain views.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770853711/Homekuti_DEV/a1sj1lfxpijfkrjl60jz.jpg",
      filename: "a1sj1lfxpijfkrjl60jz.jpg"
    },
    price: 1800,
    location: "Manali",
    country: "India",
    geometry: { type: "Point", coordinates: [77.1892, 32.2396] },
  },

  {
    title: "Snow Valley Lodge",
    description: "Snow-covered mountain lodge for winter stays.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770853712/Homekuti_DEV/t9r9etmuhkxor4seitak.jpg",
      filename: "t9r9etmuhkxor4seitak.jpg"
    },
    price: 1700,
    location: "Manali",
    country: "India",
    geometry: { type: "Point", coordinates: [77.1892, 32.2396] },
  },

  {
    title: "Apple Orchard Cottage",
    description: "Wooden cottage surrounded by apple orchards.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770853714/Homekuti_DEV/vschklx2zjsy3kyfljxl.jpg",
      filename: "vschklx2zjsy3kyfljxl.jpg"
    },
    price: 1500,
    location: "Shimla",
    country: "India",
    geometry: { type: "Point", coordinates: [77.1734, 31.1048] },
  },

  {
    title: "Shimla Ridge View Hotel",
    description: "Hotel overlooking the famous Shimla Ridge.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770853715/Homekuti_DEV/o8hhwpxmsmb579fi7izq.jpg",
      filename: "o8hhwpxmsmb579fi7izq.jpg"
    },
    price: 1650,
    location: "Shimla",
    country: "India",
    geometry: { type: "Point", coordinates: [77.1734, 31.1048] },
  },

  {
    title: "Lake Palace Heritage Hotel",
    description: "Royal heritage palace hotel beside Lake Pichola.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770853718/Homekuti_DEV/flb6fle7mlvjwjhbggtu.jpg",
      filename: "flb6fle7mlvjwjhbggtu.jpg"
    },
    price: 4500,
    location: "Udaipur",
    country: "India",
    geometry: { type: "Point", coordinates: [73.7125, 24.5854] },
  },

  {
    title: "Udaipur Palace View Residency",
    description: "Luxury palace-view stay with royal interiors.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770853719/Homekuti_DEV/smg54jp4gdv1vjmiqmjs.jpg",
      filename: "smg54jp4gdv1vjmiqmjs.jpg"
    },
    price: 3900,
    location: "Udaipur",
    country: "India",
    geometry: { type: "Point", coordinates: [73.7125, 24.5854] },
  },

  {
    title: "Goan Palm Beach Resort",
    description: "Beachfront resort with infinity pool and sunset views.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770853720/Homekuti_DEV/l57r42hox4yntfmozxru.jpg",
      filename: "l57r42hox4yntfmozxru.jpg"
    },
    price: 2600,
    location: "Goa",
    country: "India",
    geometry: { type: "Point", coordinates: [73.8278, 15.4909] },
  },

  {
    title: "Portuguese Villa Stay",
    description: "Private Goan villa with pool and garden.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771085770/Homekuti_DEV/bxuvw28rolkg4r7qbftr.webp",
      filename: "Homekuti_DEV/bxuvw28rolkg4r7qbftr"
    },
    price: 2800,
    location: "Goa",
    country: "India",
    geometry: { type: "Point", coordinates: [74.0855134, 15.3004543] },
  },

  {
    title: "Marine Drive Sea View Hotel",
    description: "Luxury sea-facing hotel near Marine Drive.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770986671/Homekuti_DEV/eauolsjdvae7r1cgi1hd.jpg",
      filename: "Homekuti_DEV/eauolsjdvae7r1cgi1hd"
    },
    price: 3500,
    location: "Mumbai",
    country: "India",
    geometry: { type: "Point", coordinates: [72.8777, 19.076] },
  },

  {
    title: "BKC Business Suites",
    description: "Corporate-friendly hotel in Mumbai business district.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770986953/Homekuti_DEV/ccbwq3bd6tcnczsg6hxz.jpg",
      filename: "Homekuti_DEV/ccbwq3bd6tcnczsg6hxz"
    },
    price: 3200,
    location: "Mumbai",
    country: "India",
    geometry: { type: "Point", coordinates: [72.8777, 19.076] },
  },

  {
    title: "Pune Hillside Retreat",
    description: "Eco resort near Western Ghats hills.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770986909/Homekuti_DEV/fszm7pbiaydofnldcd5e.jpg",
      filename: "Homekuti_DEV/fszm7pbiaydofnldcd5e"
    },
    price: 2100,
    location: "Pune",
    country: "India",
    geometry: { type: "Point", coordinates: [73.8567, 18.5204] },
  },

  {
    title: "Ahmedabad Heritage Inn",
    description: "Gujarati heritage hotel with traditional decor.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771085488/Homekuti_DEV/aqnqlxpbqsnrzd4ipy7j.jpg",
      filename: "Homekuti_DEV/aqnqlxpbqsnrzd4ipy7j"
    },
    price: 1900,
    location: "Ahmedabad",
    country: "India",
    geometry: { type: "Point", coordinates: [72.5800568, 23.0215374] },
  },

  {
    title: "Kerala Backwater Houseboat",
    description: "Traditional houseboat stay in Alleppey backwaters.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770986548/Homekuti_DEV/lb7z4udpmxg3harimzl5.jpg",
      filename: "Homekuti_DEV/lb7z4udpmxg3harimzl5"
    },
    price: 2400,
    location: "Alleppey",
    country: "India",
    geometry: { type: "Point", coordinates: [76.3388, 9.4981] },
  },

  {
    title: "Munnar Tea Estate Bungalow",
    description: "Colonial bungalow inside tea plantations.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770853735/Homekuti_DEV/byqzttyotltjhiiriwye.jpg",
      filename: "byqzttyotltjhiiriwye.jpg"
    },
    price: 2100,
    location: "Munnar",
    country: "India",
    geometry: { type: "Point", coordinates: [77.0595, 10.0889] },
  },

  {
    title: "Ooty Hill Crest Resort",
    description: "Valley-facing resort in Nilgiri hills.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770986638/Homekuti_DEV/yntgzvtcwd85hvzrmkyl.jpg",
      filename: "Homekuti_DEV/yntgzvtcwd85hvzrmkyl"
    },
    price: 1700,
    location: "Ooty",
    country: "India",
    geometry: { type: "Point", coordinates: [76.695, 11.4064] },
  },

  {
    title: "Bangalore Tech Park Hotel",
    description: "Modern hotel near IT corridors.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770986842/Homekuti_DEV/xvkatphciwas7xzpkmt1.jpg",
      filename: "Homekuti_DEV/xvkatphciwas7xzpkmt1"
    },
    price: 2600,
    location: "Bengaluru",
    country: "India",
    geometry: { type: "Point", coordinates: [77.5946, 12.9716] },
  },

  {
    title: "Pondicherry French Villa",
    description: "Colonial French-style villa stay.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771085594/Homekuti_DEV/o4wqsiugp3dkj2pprz9n.jpg",
      filename: "Homekuti_DEV/o4wqsiugp3dkj2pprz9n"
    },
    price: 2300,
    location: "Pondicherry",
    country: "India",
    geometry: { type: "Point", coordinates: [79.80694879844232, 10.91564885] },
  },

  {
    title: "Shillong Pinewood Retreat",
    description: "Wooden cottages in pine forests.",
    image: {
      url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1770853742/Homekuti_DEV/yx5ioae2du7dydodax3h.jpg",
      filename: "yx5ioae2du7dydodax3h.jpg"
    },
    price: 1800,
    location: "Shillong",
    country: "India",
    geometry: { type: "Point", coordinates: [91.8933, 25.5788] },
  },

];

module.exports = { data: sampleListings };
