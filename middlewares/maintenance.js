// middleware/maintenance.js
module.exports = (req, res, next) => {
    const maintenanceMode = process.env.MAINTENANCE === "true";

    if (maintenanceMode) {
        return res.render("maintenance");
    }
    next();
};
