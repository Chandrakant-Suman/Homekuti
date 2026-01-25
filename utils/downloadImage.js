const axios = require("axios");
const fs = require("fs");
const path = require("path");

const downloadImage = async (url, filename) => {
  const folderPath = path.join(
    __dirname,
    "..",
    "public",
    "images",
    "listings"
  );

  // Ensure folder exists
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const filePath = path.join(folderPath, filename);

  const response = await axios({
    method: "GET",
    url,
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);
  });
};

module.exports = downloadImage;
